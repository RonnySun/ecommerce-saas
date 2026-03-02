"""
飞书 WebSocket 监听器

工作流程：
  1. 前端配置页填写 App ID / App Secret / tenant_id，保存到 agent_configs 表
  2. 服务启动时（或调用 POST /api/v1/feishu/start）自动拉起
  3. 后端从数据库读取配置，在守护线程中启动 lark WebSocket 客户端
  4. 收到用户飞书消息 -> 调用 feishu_agent.call_agent_sync -> 回复

稳定性设计：
  - lark.ws.Client 在 daemon 线程内创建（new_loop 设置后），
    确保 asyncio.Lock 绑定到正确的 loop（Python 3.9 在 __init__ 时绑定）
  - Watchdog 每 60s 检测 _conn 是否真正存活，断了自动重启
  - 进程锁避免多进程重复建立飞书长连接
"""
import json
import os
import re
import tempfile
import threading
import time
from typing import Optional, Set

import lark_oapi as lark
from lark_oapi.api.im.v1 import (
    P2ImMessageReceiveV1,
    ReplyMessageRequest,
    ReplyMessageRequestBody,
    CreateMessageRequest,
    CreateMessageRequestBody,
)

# ---- 全局状态 ----

_ws_client: Optional[lark.ws.Client] = None
_lark_client: Optional[lark.Client] = None
_listener_thread: Optional[threading.Thread] = None
_watchdog_thread: Optional[threading.Thread] = None
_running = False
_state = "stopped"  # stopped / starting / running
_processed_msg_ids: Set[str] = set()
_state_lock = threading.Lock()

# 保存启动参数，供 watchdog 自动重启使用
_last_app_id: str = ""
_last_app_secret: str = ""
_last_tenant_id: int = 1
_last_restart_at: float = 0.0

# 单实例锁：避免多 worker 重复监听
_LOCK_FILE = os.path.join(tempfile.gettempdir(), "ecommerce_saas_feishu_listener.lock")


# ---- 配置解析 ----

def parse_feishu_config(md: str) -> dict:
    config: dict = {}
    for line in md.splitlines():
        m = re.match(r"^\s*App\s+ID\s*:\s*(\S+)", line, re.IGNORECASE)
        if m:
            config["app_id"] = m.group(1)
        m = re.match(r"^\s*App\s+Secret\s*:\s*(\S+)", line, re.IGNORECASE)
        if m:
            config["app_secret"] = m.group(1)
        m = re.match(r"^\s*Verification\s+Token\s*:\s*(\S+)", line, re.IGNORECASE)
        if m:
            config["verification_token"] = m.group(1)
        m = re.match(r"^\s*Encrypt\s+Key\s*:\s*(\S+)", line, re.IGNORECASE)
        if m:
            config["encrypt_key"] = m.group(1)
        m = re.match(r"^\s*tenant_id\s*:\s*(\d+)", line, re.IGNORECASE)
        if m:
            config["tenant_id"] = int(m.group(1))
    return config


# ---- 状态查询 ----

def is_running() -> bool:
    return _running


def is_ws_alive() -> bool:
    """检测 WebSocket 底层连接是否真正存活（不只是 _running 变量）"""
    if _ws_client is None:
        return False
    conn = getattr(_ws_client, "_conn", None)
    return conn is not None


def _acquire_process_lock() -> bool:
    try:
        if os.path.exists(_LOCK_FILE):
            with open(_LOCK_FILE, "r", encoding="utf-8") as f:
                pid_text = (f.read() or "").strip()
            if pid_text.isdigit():
                pid = int(pid_text)
                # pid 存在则认为已有实例
                os.kill(pid, 0)
                print(f"[Feishu] 检测到已有监听进程 PID={pid}，跳过重复启动")
                return False
    except ProcessLookupError:
        # 旧 pid 已不存在，可覆盖
        pass
    except Exception as e:
        print(f"[Feishu] 进程锁检查异常: {e}")

    try:
        with open(_LOCK_FILE, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
        return True
    except Exception as e:
        print(f"[Feishu] 写入进程锁失败: {e}")
        return False


def _release_process_lock() -> None:
    try:
        if os.path.exists(_LOCK_FILE):
            with open(_LOCK_FILE, "r", encoding="utf-8") as f:
                pid_text = (f.read() or "").strip()
            if pid_text == str(os.getpid()):
                os.remove(_LOCK_FILE)
    except Exception as e:
        print(f"[Feishu] 释放进程锁异常: {e}")


# ---- 消息解析 ----

def _extract_text_from_post(raw_content: str) -> str:
    """解析飞书 post 富文本内容，提取纯文本。"""
    try:
        parsed = json.loads(raw_content)
    except Exception:
        return ""

    # 兼容两种结构：
    # 1) {"title":"","content":[[...]]}
    # 2) {"zh_cn":{"title":"","content":[[...]]}}
    candidate = parsed
    if isinstance(parsed, dict):
        if "content" not in parsed:
            for v in parsed.values():
                if isinstance(v, dict) and "content" in v:
                    candidate = v
                    break

    if not isinstance(candidate, dict):
        return ""

    title = (candidate.get("title") or "").strip()
    blocks = candidate.get("content") or []

    lines = []
    if title:
        lines.append(title)

    for paragraph in blocks:
        if not isinstance(paragraph, list):
            continue
        text_buf = []
        for element in paragraph:
            if not isinstance(element, dict):
                continue
            tag = element.get("tag")
            if tag == "text":
                text_buf.append(element.get("text") or "")
            elif tag == "a":
                text_buf.append((element.get("text") or element.get("href") or ""))
            elif tag == "at":
                # 统一成 @name，后续统一清理
                text_buf.append(f"@{element.get('user_name') or element.get('user_id') or ''}")
            elif tag == "img":
                # 图片不拼内容；如需可追加占位符
                continue
        line = "".join(text_buf).strip()
        if line:
            lines.append(line)

    return "\n".join(lines).strip()


def _extract_user_text(msg) -> str:
    message_type = msg.message_type
    raw = msg.content or ""

    if message_type == "text":
        try:
            data = json.loads(raw)
            text = (data.get("text") or "").strip()
        except Exception:
            text = ""
    elif message_type == "post":
        text = _extract_text_from_post(raw)
    else:
        return ""

    # 清理 @xxx / @机器人 等提及内容
    text = re.sub(r"@[\w\-\.]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _is_mention_only_message(msg) -> bool:
    """仅 @机器人、不带正文的消息"""
    if msg.message_type != "text":
        return False
    raw = msg.content or ""
    try:
        data = json.loads(raw)
        text = (data.get("text") or "").strip()
    except Exception:
        return False
    return bool(text) and re.fullmatch(r"(?:@\S+\s*)+", text) is not None


# ---- 消息发送 ----

def _send_reply(chat_id: str, text: str, reply_to_msg_id: Optional[str] = None) -> None:
    if not _lark_client:
        return

    def _call_with_timeout(fn, timeout_sec: float = 12.0):
        result = {}
        error = {}
        done = threading.Event()

        def runner():
            try:
                result["value"] = fn()
            except Exception as e:
                error["err"] = e
            finally:
                done.set()

        threading.Thread(target=runner, daemon=True).start()
        if not done.wait(timeout_sec):
            raise TimeoutError(f"send timeout after {timeout_sec}s")
        if "err" in error:
            raise error["err"]
        return result.get("value")

    # reply 优先；失败后 fallback create，避免 reply 接口偶发失败导致无回包
    for attempt in range(1, 3):
        try:
            if reply_to_msg_id:
                req = (
                    ReplyMessageRequest.builder()
                    .message_id(reply_to_msg_id)
                    .request_body(
                        ReplyMessageRequestBody.builder()
                        .content(json.dumps({"text": text}))
                        .msg_type("text")
                        .build()
                    )
                    .build()
                )
                print(f"[Feishu] 准备 reply 发送 attempt={attempt}, msg_id={reply_to_msg_id}")
                resp = _call_with_timeout(lambda: _lark_client.im.v1.message.reply(req))
                if resp and getattr(resp, "success", lambda: True)():
                    print(f"[Feishu] 已回复 msg_id={reply_to_msg_id}")
                    return
                print(f"[Feishu] reply 返回失败，attempt={attempt}")
            else:
                req = (
                    CreateMessageRequest.builder()
                    .receive_id_type("chat_id")
                    .request_body(
                        CreateMessageRequestBody.builder()
                        .receive_id(chat_id)
                        .msg_type("text")
                        .content(json.dumps({"text": text}))
                        .build()
                    )
                    .build()
                )
                print(f"[Feishu] 准备 create 发送 attempt={attempt}, chat_id={chat_id}")
                resp = _call_with_timeout(lambda: _lark_client.im.v1.message.create(req))
                if resp and getattr(resp, "success", lambda: True)():
                    print(f"[Feishu] 已发送 chat_id={chat_id}")
                    return
                print(f"[Feishu] create 返回失败，attempt={attempt}")
        except Exception as e:
            print(f"[Feishu] 发送失败 attempt={attempt}: {e}")

        time.sleep(0.5)

    # 最后做一次不引用 reply_to 的兜底发送
    try:
        req = (
            CreateMessageRequest.builder()
            .receive_id_type("chat_id")
            .request_body(
                CreateMessageRequestBody.builder()
                .receive_id(chat_id)
                .msg_type("text")
                .content(json.dumps({"text": text}))
                .build()
            )
            .build()
        )
        print(f"[Feishu] 准备 fallback create 发送 chat_id={chat_id}")
        _call_with_timeout(lambda: _lark_client.im.v1.message.create(req))
        print(f"[Feishu] fallback create 已发送 chat_id={chat_id}")
    except Exception as e:
        print(f"[Feishu] fallback create 失败: {e}")


# ---- Watchdog 自动重连 ----

def _start_watchdog():
    """启动 watchdog 线程，每 60s 检测 WebSocket 是否存活，断了自动重启"""
    global _watchdog_thread, _last_restart_at

    def watchdog():
        time.sleep(20)  # 等待初始连接建立
        while True:
            time.sleep(60)
            if not _running:
                break
            alive = is_ws_alive()
            if alive:
                continue

            now = time.time()
            if now - _last_restart_at < 30:
                print("[Feishu][Watchdog] 重启过于频繁，跳过本次重启")
                continue

            _last_restart_at = now
            print("[Feishu][Watchdog] _conn=None，WebSocket 已断开，自动重启监听器...")
            try:
                stop_listener()
                time.sleep(2)
                start_listener(_last_app_id, _last_app_secret, _last_tenant_id)
                print("[Feishu][Watchdog] 监听器已自动重启")
            except Exception as e:
                print(f"[Feishu][Watchdog] 自动重启失败: {e}")
            break  # 新的 start_listener 会启动新的 watchdog

    _watchdog_thread = threading.Thread(
        target=watchdog,
        daemon=True,
        name="feishu-ws-watchdog",
    )
    _watchdog_thread.start()


# ---- 启动 ----

def start_listener(app_id: str, app_secret: str, tenant_id: int) -> None:
    global _lark_client, _listener_thread, _running, _processed_msg_ids, _state
    global _last_app_id, _last_app_secret, _last_tenant_id

    with _state_lock:
        if _state in ("starting", "running"):
            print(f"[Feishu] 已在 {_state} 状态，跳过重复 start")
            return
        _state = "starting"

    if not _acquire_process_lock():
        with _state_lock:
            _state = "stopped"
        return

    # 保存参数供 watchdog 重启使用
    _last_app_id = app_id
    _last_app_secret = app_secret
    _last_tenant_id = tenant_id

    # Lark REST 客户端（发送消息用），不涉及 asyncio，可在主线程创建
    _lark_client = (
        lark.Client.builder()
        .app_id(app_id)
        .app_secret(app_secret)
        .log_level(lark.LogLevel.WARNING)
        .build()
    )

    # 重置去重集合
    _processed_msg_ids = set()

    def on_message(data: P2ImMessageReceiveV1) -> None:
        global _processed_msg_ids

        msg = data.event.message
        msg_id = msg.message_id
        chat_id = msg.chat_id
        mtype = msg.message_type
        raw_content = msg.content or ""

        print(f"[Feishu] 收到消息 type={mtype}, msg_id={msg_id}, chat_id={chat_id}")

        # 消息去重
        if msg_id in _processed_msg_ids:
            print(f"[Feishu] 重复消息，跳过: {msg_id}")
            return
        _processed_msg_ids.add(msg_id)
        if len(_processed_msg_ids) > 500:
            _processed_msg_ids = set(list(_processed_msg_ids)[-250:])

        # 仅处理文本和富文本
        if mtype not in ("text", "post"):
            print(f"[Feishu] 非文本类消息（{mtype}），跳过")
            return

        text = _extract_user_text(msg)
        print(f"[Feishu] 解析后文本: {repr(text)}")

        if not text:
            if _is_mention_only_message(msg):
                print("[Feishu] 检测到仅@消息，发送引导回复")
                _send_reply(chat_id, "我在。你可以直接问：店铺GMV、ROI、利润、异常预警。", msg_id)
                return
            print(f"[Feishu] 内容为空，raw={raw_content[:120]}")
            return

        def process():
            print(f"[Feishu] 开始调用 agent: {repr(text)}")
            try:
                from app.services.feishu_agent import call_agent_sync
                reply = call_agent_sync(text, tenant_id)
                print(f"[Feishu] agent 回复: {reply[:120]}")
                _send_reply(chat_id, reply, msg_id)
            except Exception as e:
                import traceback
                print(f"[Feishu] agent 调用失败: {e}")
                traceback.print_exc()
                _send_reply(chat_id, f"抱歉，处理时出错：{e}", msg_id)

        threading.Thread(target=process, daemon=True).start()

    def thread_func() -> None:
        """
        关键设计：lark.ws.Client 在本线程内创建。

        原因：Python 3.9 的 asyncio.Lock.__init__ 调用 events.get_event_loop()，
        在创建时就把 lock 绑定到当前 loop。如果在主线程（FastAPI loop 运行中）
        创建 Client，lock 会绑定到 FastAPI loop；然后在 daemon 线程用 new_loop
        执行 start()，asyncio.Lock 跨 loop 使用导致连接不稳定。

        解决：在本线程里先设好 new_loop，再创建 Client，lock 绑定正确。
        """
        global _running, _ws_client, _state

        import asyncio
        import lark_oapi.ws.client as lark_ws_mod

        # 1. 先设置 new_loop，再创建任何 asyncio 对象
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        lark_ws_mod.loop = new_loop  # 替换 lark 内部 loop 引用

        # 2. 在 new_loop 上下文中创建 Client（asyncio.Lock 绑定到 new_loop）
        handler = (
            lark.EventDispatcherHandler.builder(
                lark.ENCRYPT_KEY,
                lark.VERIFICATION_TOKEN,
                lark.LogLevel.WARNING,
            )
            .register_p2_im_message_receive_v1(on_message)
            .build()
        )

        _ws_client = lark.ws.Client(
            app_id,
            app_secret,
            log_level=lark.LogLevel.WARNING,
            event_handler=handler,
        )

        _running = True
        _state = "running"
        print(f"[Feishu] WebSocket 监听已启动 (App ID: {app_id}, tenant_id: {tenant_id})")
        try:
            _ws_client.start()  # 阻塞
        except Exception as e:
            print(f"[Feishu] WebSocket 异常: {e}")
        finally:
            _running = False
            _state = "stopped"
            _ws_client = None
            try:
                new_loop.close()
            except Exception:
                pass
            asyncio.set_event_loop(None)
            _release_process_lock()
            print("[Feishu] WebSocket 监听已停止")

    _listener_thread = threading.Thread(
        target=thread_func,
        daemon=True,
        name="feishu-ws-listener",
    )
    _listener_thread.start()

    # 启动 watchdog
    _start_watchdog()


# ---- 停止 ----

def stop_listener() -> None:
    global _ws_client, _running, _state

    _running = False
    _state = "stopped"

    if _ws_client:
        try:
            import lark_oapi.ws.client as lark_ws_mod
            conn = getattr(_ws_client, "_conn", None)
            if conn is not None and lark_ws_mod.loop and lark_ws_mod.loop.is_running():
                import asyncio
                future = asyncio.run_coroutine_threadsafe(conn.close(), lark_ws_mod.loop)
                future.result(timeout=3)
        except Exception as e:
            print(f"[Feishu] 关闭 WebSocket 连接时出错: {e}")
        try:
            _ws_client._conn = None
        except Exception:
            pass
        _ws_client = None

    _release_process_lock()
    print("[Feishu] 监听器已手动停止")
