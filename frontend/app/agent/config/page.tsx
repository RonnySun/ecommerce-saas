"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"

const API = "/api/v1"
const BOT_TOKEN = "bot-ecommerce-saas-2024"

type Provider = "feishu" | "dingtalk"
type ModelProvider = "minimax" | "qwen" | "deepseek" | "kimi"

type ChannelConfig = {
  provider: Provider
  feishu: {
    app_id: string
    app_secret: string
  }
  dingtalk: {
    app_key: string
    app_secret: string
    robot_code: string
  }
}

type CurrentUser = {
  full_name?: string
  tenant_name?: string
  tenant_id?: number
}

type ModelProviderConfig = {
  model: string
  api_key: string
  base_url: string
}

type ModelConfig = {
  active_provider: ModelProvider
  providers: Record<ModelProvider, ModelProviderConfig>
}

const DEFAULT_CHANNEL_CONFIG: ChannelConfig = {
  provider: "feishu",
  feishu: { app_id: "", app_secret: "" },
  dingtalk: { app_key: "", app_secret: "", robot_code: "" },
}

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  active_provider: "minimax",
  providers: {
    minimax: {
      model: "MiniMax-M2.5",
      api_key: "",
      base_url: "https://api.minimaxi.com/v1",
    },
    qwen: {
      model: "qwen-max-latest",
      api_key: "",
      base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
    deepseek: {
      model: "deepseek-chat",
      api_key: "",
      base_url: "https://api.deepseek.com/v1",
    },
    kimi: {
      model: "moonshot-v1-8k",
      api_key: "",
      base_url: "https://api.moonshot.cn/v1",
    },
  },
}

/* ── NavBar ─────────────────────────────── */
function NavBar({ user, onLogout }: { user: CurrentUser | null; onLogout?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const links = [
    { label: "概览", href: "/" },
    { label: "财务", href: "/finance" },
    { label: "店铺", href: "/stores" },
    { label: "导入数据", href: "/import" },
    { label: "秒算", href: "/agent" },
  ]
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        backgroundColor: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(28px) saturate(200%)",
        WebkitBackdropFilter: "blur(28px) saturate(200%)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => router.push("/")}>
            <div
              className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0071e3 0%,#42a1ec 100%)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight" style={{ color: "#1d1d1f", letterSpacing: "-0.02em" }}>
              {user?.tenant_name || "多店经营"}
            </span>
          </div>
          <nav className="flex items-center gap-0.5">
            {links.map((item) => {
              const active = pathname === item.href || pathname?.startsWith("/agent")
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="px-3.5 py-1.5 rounded-xl text-sm"
                  style={{
                    color: item.href === "/agent" && active ? "#0071e3" : "#3a3a3c",
                    backgroundColor: item.href === "/agent" && active ? "rgba(0,113,227,0.10)" : "transparent",
                    fontWeight: item.href === "/agent" && active ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!(item.href === "/agent" && active)) {
                      e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.055)"
                      e.currentTarget.style.color = "#1d1d1f"
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(item.href === "/agent" && active)) {
                      e.currentTarget.style.backgroundColor = "transparent"
                      e.currentTarget.style.color = "#3a3a3c"
                    }
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#0071e3 0%,#5856d6 100%)" }}
              >
                {(user.full_name || "U").charAt(0)}
              </div>
              <span className="text-xs font-medium" style={{ color: "#3a3a3c" }}>
                {user.full_name}
              </span>
            </div>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ color: "#6e6e73", border: "1px solid #e5e5ea", backgroundColor: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f7"
                e.currentTarget.style.borderColor = "#c5c5ca"
                e.currentTarget.style.color = "#1d1d1f"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
                e.currentTarget.style.borderColor = "#e5e5ea"
                e.currentTarget.style.color = "#6e6e73"
              }}
            >
              退出
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

const MD_FILES = [
  {
    key: "soul",
    label: "SOUL.md",
    icon: "🧠",
    desc: "秒算的行为准则、回答风格、角色定位",
    hint: "控制 AI 说话的方式和边界，相当于给它定规矩",
  },
  {
    key: "skills",
    label: "SKILLS.md",
    icon: "📚",
    desc: "行业知识库：各平台 ROI 基准、异常分析框架",
    hint: "注入行业经验，让 AI 说的话更专业、更靠谱",
  },
  {
    key: "context",
    label: "CONTEXT.md",
    icon: "🏪",
    desc: "你的公司背景、主营品类、近期活动计划",
    hint: "让 AI 了解你的具体情况，分析更有针对性",
  },
] as const

const CHANNEL_TAB = {
  key: "channel",
  label: "CHANNEL",
  icon: "🔗",
  desc: "渠道接入配置：飞书 / 钉钉",
  hint: "按渠道填写必要参数，不再使用 FEISHU.md",
} as const

const MODEL_TAB = {
  key: "model",
  label: "MODEL",
  icon: "🤖",
  desc: "模型接入配置：MiniMax / Qwen / DeepSeek / Kimi",
  hint: "选择当前生效模型并填写 API Key / Base URL / 模型名",
} as const

function deepEqualConfig(a: ChannelConfig, b: ChannelConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function deepEqualModelConfig(a: ModelConfig, b: ModelConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function AgentConfigPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [tenantId, setTenantId] = useState(1)
  const [activeTab, setActiveTab] = useState("soul")

  const [contents, setContents] = useState<Record<string, string>>({})
  const [originals, setOriginals] = useState<Record<string, string>>({})

  const [channelConfig, setChannelConfig] = useState<ChannelConfig>(DEFAULT_CHANNEL_CONFIG)
  const [channelOriginal, setChannelOriginal] = useState<ChannelConfig>(DEFAULT_CHANNEL_CONFIG)
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG)
  const [modelOriginal, setModelOriginal] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG)

  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const [feishuRunning, setFeishuRunning] = useState(false)
  const [feishuLoading, setFeishuLoading] = useState(false)
  const [dingtalkRunning, setDingtalkRunning] = useState(false)
  const [dingtalkLoading, setDingtalkLoading] = useState(false)
  const [channelMsg, setChannelMsg] = useState("")
  const [modelMsg, setModelMsg] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("token")
    const u = localStorage.getItem("user")
    if (!token) {
      router.push("/login")
      return
    }
    if (u) {
      const parsed = JSON.parse(u) as CurrentUser
      setUser(parsed)
      setTenantId(parsed.tenant_id || 1)
    }
  }, [router])

  useEffect(() => {
    if (!tenantId) return

    MD_FILES.forEach(async ({ key }) => {
      try {
        const res = await fetch(`${API}/agent/config/${key}?tenant_id=${tenantId}&token=${BOT_TOKEN}`)
        const data = await res.json()
        setContents((prev) => ({ ...prev, [key]: data.content }))
        setOriginals((prev) => ({ ...prev, [key]: data.content }))
      } catch {
        // noop
      }
    })

    ;(async () => {
      try {
        const res = await fetch(`${API}/agent/channel?tenant_id=${tenantId}&token=${BOT_TOKEN}`)
        const data = await res.json()
        if (res.ok && data?.config) {
          setChannelConfig(data.config)
          setChannelOriginal(data.config)
        }
      } catch {
        // noop
      }
    })()

    ;(async () => {
      try {
        const res = await fetch(`${API}/agent/model?tenant_id=${tenantId}&token=${BOT_TOKEN}`)
        const data = await res.json()
        if (res.ok && data?.config) {
          setModelConfig(data.config)
          setModelOriginal(data.config)
        }
      } catch {
        // noop
      }
    })()
  }, [tenantId])

  const pollFeishuStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/feishu/status?token=${BOT_TOKEN}`)
      const data = await res.json()
      setFeishuRunning(!!data.running)
    } catch {
      // noop
    }
  }, [])

  const pollDingtalkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/dingtalk/status?token=${BOT_TOKEN}`)
      const data = await res.json()
      setDingtalkRunning(!!data.running)
    } catch {
      // noop
    }
  }, [])

  useEffect(() => {
    if (activeTab !== "channel") return
    if (channelConfig.provider === "feishu") {
      pollFeishuStatus()
      const t = setInterval(pollFeishuStatus, 5000)
      return () => clearInterval(t)
    }
    if (channelConfig.provider === "dingtalk") {
      pollDingtalkStatus()
      const t = setInterval(pollDingtalkStatus, 5000)
      return () => clearInterval(t)
    }
    return
  }, [activeTab, channelConfig.provider, pollFeishuStatus, pollDingtalkStatus])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
  }

  const handleSaveMd = async (key: string) => {
    setSaving(key)
    try {
      const res = await fetch(`${API}/agent/config/${key}?tenant_id=${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contents[key], token: BOT_TOKEN }),
      })
      if (res.ok) {
        setOriginals((prev) => ({ ...prev, [key]: contents[key] }))
        setSaved(key)
        setTimeout(() => setSaved(null), 2000)
      }
    } finally {
      setSaving(null)
    }
  }

  const handleSaveChannel = async () => {
    setSaving("channel")
    setChannelMsg("")
    try {
      const res = await fetch(`${API}/agent/channel?tenant_id=${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: BOT_TOKEN,
          provider: channelConfig.provider,
          feishu: channelConfig.feishu,
          dingtalk: channelConfig.dingtalk,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setChannelOriginal(channelConfig)
        setSaved("channel")
        setChannelMsg(data.message || "渠道配置已保存")
        setTimeout(() => setSaved(null), 2000)
        if (channelConfig.provider === "feishu") {
          setTimeout(pollFeishuStatus, 1000)
          setDingtalkRunning(false)
        } else {
          setTimeout(pollDingtalkStatus, 1000)
          setFeishuRunning(false)
        }
      } else {
        setChannelMsg(data.detail || "保存失败")
      }
    } catch {
      setChannelMsg("网络错误，请重试")
    } finally {
      setSaving(null)
    }
  }

  const handleSaveModel = async () => {
    setSaving("model")
    setModelMsg("")
    try {
      const res = await fetch(`${API}/agent/model?tenant_id=${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: BOT_TOKEN,
          active_provider: modelConfig.active_provider,
          providers: modelConfig.providers,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setModelOriginal(modelConfig)
        setSaved("model")
        setModelMsg(`已保存：${data.active_provider} / ${data.model}`)
        setTimeout(() => setSaved(null), 2000)
      } else {
        setModelMsg(data.detail || "模型配置保存失败")
      }
    } catch {
      setModelMsg("网络错误，请重试")
    } finally {
      setSaving(null)
    }
  }

  const handleFeishuToggle = async () => {
    setFeishuLoading(true)
    setChannelMsg("")
    try {
      const action = feishuRunning ? "stop" : "start"
      const res = await fetch(`${API}/feishu/${action}?tenant_id=${tenantId}&token=${BOT_TOKEN}`, {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        setChannelMsg(data.message || (feishuRunning ? "已停止" : "启动中…"))
        setTimeout(pollFeishuStatus, 1500)
      } else {
        setChannelMsg(data.detail || "操作失败")
      }
    } catch {
      setChannelMsg("网络错误，请重试")
    } finally {
      setFeishuLoading(false)
    }
  }

  const handleDingtalkToggle = async () => {
    setDingtalkLoading(true)
    setChannelMsg("")
    try {
      const action = dingtalkRunning ? "stop" : "start"
      const res = await fetch(`${API}/dingtalk/${action}?tenant_id=${tenantId}&token=${BOT_TOKEN}`, {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        setChannelMsg(data.message || (dingtalkRunning ? "已停止" : "启动中…"))
        setTimeout(pollDingtalkStatus, 1500)
      } else {
        setChannelMsg(data.detail || "操作失败")
      }
    } catch {
      setChannelMsg("网络错误，请重试")
    } finally {
      setDingtalkLoading(false)
    }
  }

  const isDirty = (key: string) => {
    if (key === "channel") return !deepEqualConfig(channelConfig, channelOriginal)
    if (key === "model") return !deepEqualModelConfig(modelConfig, modelOriginal)
    return contents[key] !== originals[key]
  }

  const tabs = [...MD_FILES, MODEL_TAB, CHANNEL_TAB]
  const activeFile = tabs.find((f) => f.key === activeTab) || tabs[0]

  const handleReset = () => {
    if (activeTab === "channel") {
      setChannelConfig(channelOriginal)
      setChannelMsg("")
      return
    }
    if (activeTab === "model") {
      setModelConfig(modelOriginal)
      setModelMsg("")
      return
    }
    setContents((prev) => ({ ...prev, [activeTab]: originals[activeTab] }))
  }

  const handleSave = async () => {
    if (activeTab === "channel") {
      await handleSaveChannel()
      return
    }
    if (activeTab === "model") {
      await handleSaveModel()
      return
    }
    await handleSaveMd(activeTab)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f2f2f7" }}>
      <NavBar user={user} onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm mb-2" style={{ color: "#8e8e93" }}>
            <button
              onClick={() => router.push("/agent")}
              style={{ color: "#0071e3", cursor: "pointer", background: "none", border: "none", padding: 0, fontSize: 13 }}
            >
              秒算
            </button>
            <span>/</span>
            <span>配置</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold" style={{ color: "#1d1d1f", fontSize: 26, letterSpacing: "-0.03em" }}>
                秒算配置
              </h1>
              <p className="text-sm mt-1" style={{ color: "#8e8e93" }}>
                通过 MD 文件定制秒算行为，并通过「渠道接入」配置飞书或钉钉
              </p>
            </div>
            <button
              onClick={() => router.push("/agent")}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: "#fff", border: "1px solid #e5e5ea", color: "#3a3a3c", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              ← 回到对话
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          <div style={{ width: 220, flexShrink: 0 }}>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)" }}
            >
              {tabs.map((f, i) => {
                const active = activeTab === f.key
                const dirty = isDirty(f.key)
                const isChannel = f.key === "channel"
                return (
                  <div
                    key={f.key}
                    onClick={() => setActiveTab(f.key)}
                    className="px-4 py-3.5 cursor-pointer"
                    style={{
                      borderBottom: i < tabs.length - 1 ? "1px solid #f2f2f7" : "none",
                      backgroundColor: active ? "rgba(88,86,214,0.06)" : "transparent",
                      borderLeft: active ? "3px solid #5856d6" : "3px solid transparent",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 16 }}>{f.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: active ? "#5856d6" : "#1d1d1f", fontFamily: "monospace" }}>
                          {f.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isChannel && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              backgroundColor:
                                channelConfig.provider === "feishu"
                                  ? (feishuRunning ? "#30d158" : "#aeaeb2")
                                  : (dingtalkRunning ? "#30d158" : "#aeaeb2"),
                              flexShrink: 0,
                            }}
                          />
                        )}
                        {dirty && <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#ff9f0a", flexShrink: 0 }} />}
                      </div>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#8e8e93", lineHeight: 1.4 }}>
                      {f.desc}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl p-4 mt-4" style={{ backgroundColor: "rgba(88,86,214,0.06)", border: "1px solid rgba(88,86,214,0.12)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#5856d6" }}>
                💡 配置原理
              </p>
              <p className="text-xs" style={{ color: "#6e6e73", lineHeight: 1.6 }}>
                每次对话会加载 SOUL / SKILLS / CONTEXT + MODEL；渠道接入配置仅用于飞书或钉钉连接。
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)", minHeight: 500 }}
            >
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid #f2f2f7", backgroundColor: "#fafafa" }}>
                <div className="flex items-center gap-2.5">
                  <span style={{ fontSize: 18 }}>{activeFile.icon}</span>
                  <code className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>
                    {activeFile.label}
                  </code>
                  {isDirty(activeTab) && (
                    <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: "#fff7e6", color: "#d97706", border: "1px solid #fde68a" }}>
                      未保存
                    </span>
                  )}
                  {saved === activeTab && (
                    <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: "#edfaf2", color: "#1a7f3c", border: "1px solid #bbf7d0" }}>
                      ✓ 已保存
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isDirty(activeTab) && (
                    <button onClick={handleReset} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "#6e6e73", border: "1px solid #e5e5ea" }}>
                      还原
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving === activeTab || !isDirty(activeTab)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: isDirty(activeTab) ? "linear-gradient(135deg,#5856d6,#af52de)" : "#e5e5ea",
                      color: isDirty(activeTab) ? "#fff" : "#aeaeb2",
                      border: "none",
                      cursor: isDirty(activeTab) ? "pointer" : "default",
                    }}
                  >
                    {saving === activeTab ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>

              <div className="flex-1 relative">
                {activeTab !== "channel" && activeTab !== "model" ? (
                  <textarea
                    value={contents[activeTab] || ""}
                    onChange={(e) => setContents((prev) => ({ ...prev, [activeTab]: e.target.value }))}
                    spellCheck={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: 460,
                      padding: "16px 20px",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                      fontSize: 13,
                      lineHeight: 1.8,
                      color: "#1d1d1f",
                      backgroundColor: "transparent",
                      boxSizing: "border-box",
                    }}
                    placeholder={`在这里编写 ${activeFile.label}…`}
                  />
                ) : activeTab === "model" ? (
                  <div className="p-6" style={{ minHeight: 460 }}>
                    <p className="text-sm font-semibold mb-3" style={{ color: "#1d1d1f" }}>
                      选择当前模型提供商
                    </p>
                    <div className="flex flex-wrap gap-3 mb-5">
                      {([
                        { key: "minimax", label: "MiniMax" },
                        { key: "qwen", label: "Qwen" },
                        { key: "deepseek", label: "DeepSeek" },
                        { key: "kimi", label: "Kimi" },
                      ] as const).map((item) => {
                        const selected = modelConfig.active_provider === item.key
                        return (
                          <button
                            key={item.key}
                            onClick={() => setModelConfig((prev) => ({ ...prev, active_provider: item.key }))}
                            className="px-4 py-2 rounded-xl text-sm font-semibold"
                            style={{
                              border: selected ? "1px solid #5856d6" : "1px solid #e5e5ea",
                              backgroundColor: selected ? "rgba(88,86,214,0.08)" : "#fff",
                              color: selected ? "#5856d6" : "#3a3a3c",
                            }}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>

                    <div className="grid gap-4 max-w-2xl">
                      <label className="text-xs font-semibold" style={{ color: "#6e6e73" }}>
                        模型名（必填）
                        <input
                          value={modelConfig.providers[modelConfig.active_provider].model}
                          onChange={(e) =>
                            setModelConfig((prev) => ({
                              ...prev,
                              providers: {
                                ...prev.providers,
                                [prev.active_provider]: {
                                  ...prev.providers[prev.active_provider],
                                  model: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full mt-1 px-3 py-2 rounded-lg"
                          style={{ border: "1px solid #e5e5ea", fontSize: 13, color: "#1d1d1f" }}
                          placeholder="例如：MiniMax-M2.5 / qwen-max-latest / deepseek-chat"
                        />
                      </label>
                      <label className="text-xs font-semibold" style={{ color: "#6e6e73" }}>
                        API Key（必填）
                        <input
                          value={modelConfig.providers[modelConfig.active_provider].api_key}
                          onChange={(e) =>
                            setModelConfig((prev) => ({
                              ...prev,
                              providers: {
                                ...prev.providers,
                                [prev.active_provider]: {
                                  ...prev.providers[prev.active_provider],
                                  api_key: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full mt-1 px-3 py-2 rounded-lg"
                          style={{ border: "1px solid #e5e5ea", fontSize: 13, color: "#1d1d1f" }}
                          placeholder="sk-xxxxxxxx"
                        />
                      </label>
                      <label className="text-xs font-semibold" style={{ color: "#6e6e73" }}>
                        Base URL（OpenAI 兼容接口）
                        <input
                          value={modelConfig.providers[modelConfig.active_provider].base_url}
                          onChange={(e) =>
                            setModelConfig((prev) => ({
                              ...prev,
                              providers: {
                                ...prev.providers,
                                [prev.active_provider]: {
                                  ...prev.providers[prev.active_provider],
                                  base_url: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full mt-1 px-3 py-2 rounded-lg"
                          style={{ border: "1px solid #e5e5ea", fontSize: 13, color: "#1d1d1f" }}
                          placeholder="https://api.xxx.com/v1"
                        />
                      </label>
                    </div>

                    <div className="rounded-xl p-3 mt-5" style={{ backgroundColor: "#f9f9fb", border: "1px solid #ececf2" }}>
                      <p className="text-xs" style={{ color: "#6e6e73", lineHeight: 1.6 }}>
                        当前 Agent 走 OpenAI SDK，请填写各模型厂商提供的 OpenAI 兼容网关地址。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6" style={{ minHeight: 460 }}>
                    <p className="text-sm font-semibold mb-3" style={{ color: "#1d1d1f" }}>
                      选择消息渠道
                    </p>
                    <div className="flex gap-3 mb-5">
                      {([
                        { key: "feishu", label: "飞书" },
                        { key: "dingtalk", label: "钉钉" },
                      ] as const).map((item) => {
                        const selected = channelConfig.provider === item.key
                        return (
                          <button
                            key={item.key}
                            onClick={() => setChannelConfig((prev) => ({ ...prev, provider: item.key }))}
                            className="px-4 py-2 rounded-xl text-sm font-semibold"
                            style={{
                              border: selected ? "1px solid #5856d6" : "1px solid #e5e5ea",
                              backgroundColor: selected ? "rgba(88,86,214,0.08)" : "#fff",
                              color: selected ? "#5856d6" : "#3a3a3c",
                            }}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>

                    {channelConfig.provider === "feishu" ? (
                      <div className="grid gap-4 max-w-2xl">
                        <label className="text-xs font-semibold" style={{ color: "#6e6e73" }}>
                          App ID（必填）
                          <input
                            value={channelConfig.feishu.app_id}
                            onChange={(e) =>
                              setChannelConfig((prev) => ({ ...prev, feishu: { ...prev.feishu, app_id: e.target.value } }))
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg"
                            style={{ border: "1px solid #e5e5ea", fontSize: 13, color: "#1d1d1f" }}
                            placeholder="cli_xxxxxxxxxxxxxxxx"
                          />
                        </label>
                        <label className="text-xs font-semibold" style={{ color: "#6e6e73" }}>
                          App Secret（必填）
                          <input
                            value={channelConfig.feishu.app_secret}
                            onChange={(e) =>
                              setChannelConfig((prev) => ({ ...prev, feishu: { ...prev.feishu, app_secret: e.target.value } }))
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg"
                            style={{ border: "1px solid #e5e5ea", fontSize: 13, color: "#1d1d1f" }}
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="grid gap-4 max-w-2xl">
                        <label className="text-xs font-semibold" style={{ color: "#6e6e73" }}>
                          AppKey（必填）
                          <input
                            value={channelConfig.dingtalk.app_key}
                            onChange={(e) =>
                              setChannelConfig((prev) => ({ ...prev, dingtalk: { ...prev.dingtalk, app_key: e.target.value } }))
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg"
                            style={{ border: "1px solid #e5e5ea", fontSize: 13, color: "#1d1d1f" }}
                            placeholder="dingxxxxxxxxxxxxxxxx"
                          />
                        </label>
                        <label className="text-xs font-semibold" style={{ color: "#6e6e73" }}>
                          AppSecret（必填）
                          <input
                            value={channelConfig.dingtalk.app_secret}
                            onChange={(e) =>
                              setChannelConfig((prev) => ({ ...prev, dingtalk: { ...prev.dingtalk, app_secret: e.target.value } }))
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg"
                            style={{ border: "1px solid #e5e5ea", fontSize: 13, color: "#1d1d1f" }}
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          />
                        </label>
                        <label className="text-xs font-semibold" style={{ color: "#6e6e73" }}>
                          RobotCode（必填）
                          <input
                            value={channelConfig.dingtalk.robot_code}
                            onChange={(e) =>
                              setChannelConfig((prev) => ({ ...prev, dingtalk: { ...prev.dingtalk, robot_code: e.target.value } }))
                            }
                            className="w-full mt-1 px-3 py-2 rounded-lg"
                            style={{ border: "1px solid #e5e5ea", fontSize: 13, color: "#1d1d1f" }}
                            placeholder="dingtalk-robot-code"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {activeTab === "model" && modelMsg && (
              <div className="rounded-2xl mt-4 p-4" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)" }}>
                <p className="text-xs" style={{ color: "#6e6e73" }}>
                  {modelMsg}
                </p>
              </div>
            )}

            {activeTab === "channel" && channelConfig.provider === "feishu" && (
              <div
                className="rounded-2xl mt-4 overflow-hidden"
                style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)" }}
              >
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f2f2f7" }}>
                  <div className="flex items-center gap-3">
                    <div style={{ position: "relative", width: 10, height: 10 }}>
                      <span
                        style={{
                          display: "block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: feishuRunning ? "#30d158" : "#aeaeb2",
                        }}
                      />
                      {feishuRunning && (
                        <span
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: "#30d158",
                            opacity: 0.5,
                            animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>
                        飞书频道
                        <span className="ml-2 text-xs font-normal" style={{ color: feishuRunning ? "#30d158" : "#aeaeb2" }}>
                          {feishuRunning ? "● 监听中" : "○ 未连接"}
                        </span>
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#8e8e93" }}>
                        WebSocket 长连接，无需公网 IP，本地/服务器均可运行
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleFeishuToggle}
                    disabled={feishuLoading}
                    className="px-5 py-2 rounded-xl text-sm font-semibold"
                    style={{
                      background: feishuRunning ? "linear-gradient(135deg,#ff453a,#ff6961)" : "linear-gradient(135deg,#30d158,#34c759)",
                      color: "#fff",
                      border: "none",
                      cursor: feishuLoading ? "default" : "pointer",
                      opacity: feishuLoading ? 0.6 : 1,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    }}
                  >
                    {feishuLoading ? "操作中…" : feishuRunning ? "停止监听" : "启动监听"}
                  </button>
                </div>
                {channelMsg && (
                  <div className="px-5 py-3" style={{ backgroundColor: "#f9f9fb" }}>
                    <p className="text-xs" style={{ color: "#6e6e73" }}>
                      {channelMsg}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "channel" && channelConfig.provider === "dingtalk" && (
              <div
                className="rounded-2xl mt-4 overflow-hidden"
                style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)" }}
              >
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f2f2f7" }}>
                  <div className="flex items-center gap-3">
                    <div style={{ position: "relative", width: 10, height: 10 }}>
                      <span
                        style={{
                          display: "block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: dingtalkRunning ? "#30d158" : "#aeaeb2",
                        }}
                      />
                      {dingtalkRunning && (
                        <span
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: "#30d158",
                            opacity: 0.5,
                            animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>
                        钉钉频道
                        <span className="ml-2 text-xs font-normal" style={{ color: dingtalkRunning ? "#30d158" : "#aeaeb2" }}>
                          {dingtalkRunning ? "● 监听中" : "○ 未连接"}
                        </span>
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#8e8e93" }}>
                        长连接监听，本地/服务器均可运行
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDingtalkToggle}
                    disabled={dingtalkLoading}
                    className="px-5 py-2 rounded-xl text-sm font-semibold"
                    style={{
                      background: dingtalkRunning ? "linear-gradient(135deg,#ff453a,#ff6961)" : "linear-gradient(135deg,#30d158,#34c759)",
                      color: "#fff",
                      border: "none",
                      cursor: dingtalkLoading ? "default" : "pointer",
                      opacity: dingtalkLoading ? 0.6 : 1,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    }}
                  >
                    {dingtalkLoading ? "操作中…" : dingtalkRunning ? "停止监听" : "启动监听"}
                  </button>
                </div>
                {channelMsg && (
                  <div className="px-5 py-3" style={{ backgroundColor: "#f9f9fb" }}>
                    <p className="text-xs" style={{ color: "#6e6e73" }}>
                      {channelMsg}
                    </p>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs mt-2" style={{ color: "#aeaeb2" }}>
              {activeFile.hint}
              {activeTab !== "channel" && activeTab !== "model" && " · 支持 Markdown 格式 · 改动实时生效（下次对话开始时加载）"}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
