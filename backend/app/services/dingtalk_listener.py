"""
钉钉监听器占位实现（与飞书接口保持一致）

说明：
- 当前实现提供运行状态管理能力（start/stop/status），用于前后端交互一致。
- 真实的钉钉回调验签、事件处理和机器人回复可在此基础上继续接入。
"""
from datetime import datetime
from typing import Optional

_running = False
_started_at: Optional[datetime] = None


def is_running() -> bool:
    return _running


def is_ws_alive() -> bool:
    # 钉钉当前为占位监听状态，和 running 保持一致
    return _running


def start_listener(app_key: str, app_secret: str, robot_code: str, tenant_id: int) -> None:
    global _running, _started_at

    if not app_key or not app_secret or not robot_code:
        raise ValueError("钉钉配置不完整，无法启动监听")

    _running = True
    _started_at = datetime.now()
    print(f"[DingTalk] 监听器已启动（tenant={tenant_id}, app_key={app_key}, robot_code={robot_code}）")


def stop_listener() -> None:
    global _running, _started_at
    _running = False
    _started_at = None
    print("[DingTalk] 监听器已停止")
