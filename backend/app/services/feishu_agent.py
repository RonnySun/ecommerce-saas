"""
飞书 Agent 调用器

直接 HTTP 调用本机的 /api/v1/agent/chat 接口，
彻底绕开跨 event loop 的 asyncpg 连接池问题。
"""
import httpx
from app.api.v1.endpoints.bot import BOT_API_TOKEN

# 本地 API 地址（与 uvicorn 启动端口一致）
LOCAL_API = "http://127.0.0.1:8000/api/v1"

# 复用一个带 retry 的 transport，不走系统代理（避免 Clash/VPN 代理拦截 localhost 导致 502）
_transport = httpx.HTTPTransport(retries=1)
_client = httpx.Client(
    transport=_transport,
    trust_env=False,   # 关键：忽略系统 HTTP_PROXY 环境变量，直连 127.0.0.1
)


def call_agent_sync(message: str, tenant_id: int) -> str:
    """
    同步调用本机 agent 接口，返回纯文本回复。
    由飞书消息回调线程直接调用，无需 asyncio。
    """
    try:
        resp = _client.post(
            f"{LOCAL_API}/agent/chat",
            json={
                "message": message,
                "tenant_id": tenant_id,
                "token": BOT_API_TOKEN,
            },
            timeout=120.0,   # AI 调用可能需要较长时间
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("reply", "抱歉，未能获取回复")
    except httpx.TimeoutException:
        return "抱歉，查询超时，请稍后重试"
    except Exception as e:
        return f"抱歉，处理时出错：{e}"
