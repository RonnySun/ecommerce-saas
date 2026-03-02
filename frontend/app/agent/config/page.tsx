"use client"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

const API = "/api/v1"
const BOT_TOKEN = "bot-ecommerce-saas-2024"

/* ── NavBar ─────────────────────────────── */
function NavBar({ user, onLogout }: { user: any; onLogout?: () => void }) {
  const router   = useRouter()
  const pathname = usePathname()
  const links = [
    { label: "概览",    href: "/" },
    { label: "财务",    href: "/finance" },
    { label: "店铺",    href: "/stores" },
    { label: "导入数据", href: "/import" },
    { label: "掌舵",    href: "/agent" },
  ]
  return (
    <header className="sticky top-0 z-30"
      style={{ backgroundColor: "rgba(255,255,255,0.88)", backdropFilter: "blur(28px) saturate(200%)", WebkitBackdropFilter: "blur(28px) saturate(200%)", borderBottom: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)" }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => router.push("/")}>
            <div className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0071e3 0%,#42a1ec 100%)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" fill="white" /></svg>
            </div>
            <span className="text-sm font-bold tracking-tight" style={{ color: "#1d1d1f", letterSpacing: "-0.02em" }}>{user?.tenant_name || "多店经营"}</span>
          </div>
          <nav className="flex items-center gap-0.5">
            {links.map(item => {
              const active = pathname === item.href || pathname?.startsWith("/agent")
              return (
                <button key={item.href} onClick={() => router.push(item.href)} className="px-3.5 py-1.5 rounded-xl text-sm"
                  style={{ color: (item.href === "/agent" && active) ? "#0071e3" : "#3a3a3c", backgroundColor: (item.href === "/agent" && active) ? "rgba(0,113,227,0.10)" : "transparent", fontWeight: (item.href === "/agent" && active) ? 600 : 400 }}
                  onMouseEnter={e => { if (!(item.href === "/agent" && active)) { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.055)"; e.currentTarget.style.color = "#1d1d1f" } }}
                  onMouseLeave={e => { if (!(item.href === "/agent" && active)) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#3a3a3c" } }}
                >{item.label}</button>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "linear-gradient(135deg,#0071e3 0%,#5856d6 100%)" }}>{(user.full_name || "U").charAt(0)}</div>
              <span className="text-xs font-medium" style={{ color: "#3a3a3c" }}>{user.full_name}</span>
            </div>
          )}
          {onLogout && (
            <button onClick={onLogout} className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ color: "#6e6e73", border: "1px solid #e5e5ea", backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f5f5f7"; e.currentTarget.style.borderColor = "#c5c5ca"; e.currentTarget.style.color = "#1d1d1f" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "#e5e5ea"; e.currentTarget.style.color = "#6e6e73" }}
            >退出</button>
          )}
        </div>
      </div>
    </header>
  )
}

/* ── 配置文件定义 ─────────────────────────── */
const FILES = [
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
]

/* ── 主页面 ───────────────────────────────── */
export default function AgentConfigPage() {
  const router             = useRouter()
  const [user,     setUser]     = useState<any>(null)
  const [tenantId, setTenantId] = useState(1)
  const [activeTab, setActiveTab] = useState("soul")
  const [contents, setContents] = useState<Record<string, string>>({})
  const [originals, setOriginals] = useState<Record<string, string>>({})
  const [saving,   setSaving]   = useState<string | null>(null)
  const [saved,    setSaved]    = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const u = localStorage.getItem("user")
    if (!token) { router.push("/login"); return }
    if (u) {
      const parsed = JSON.parse(u)
      setUser(parsed)
      setTenantId(parsed.tenant_id || 1)
    }
  }, [])

  // 加载所有配置文件
  useEffect(() => {
    if (!tenantId) return
    FILES.forEach(async ({ key }) => {
      try {
        const res = await fetch(`${API}/agent/config/${key}?tenant_id=${tenantId}&token=${BOT_TOKEN}`)
        const data = await res.json()
        setContents(prev => ({ ...prev, [key]: data.content }))
        setOriginals(prev => ({ ...prev, [key]: data.content }))
      } catch {}
    })
  }, [tenantId])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
  }

  const handleSave = async (key: string) => {
    setSaving(key)
    try {
      const res = await fetch(`${API}/agent/config/${key}?tenant_id=${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contents[key], token: BOT_TOKEN }),
      })
      if (res.ok) {
        setOriginals(prev => ({ ...prev, [key]: contents[key] }))
        setSaved(key)
        setTimeout(() => setSaved(null), 2000)
      }
    } finally {
      setSaving(null)
    }
  }

  const isDirty = (key: string) => contents[key] !== originals[key]
  const activeFile = FILES.find(f => f.key === activeTab)!

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f2f2f7" }}>
      <NavBar user={user} onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 面包屑 + 标题 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm mb-2" style={{ color: "#8e8e93" }}>
            <button onClick={() => router.push("/agent")} style={{ color: "#0071e3", cursor: "pointer", background: "none", border: "none", padding: 0, fontSize: 13 }}>掌舵</button>
            <span>/</span>
            <span>配置</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold" style={{ color: "#1d1d1f", fontSize: 26, letterSpacing: "-0.03em" }}>秒算配置</h1>
              <p className="text-sm mt-1" style={{ color: "#8e8e93" }}>
                通过 MD 文件定制秒算的行为、知识和背景，类似 OpenClaw 的 SOUL.md / TOOLS.md
              </p>
            </div>
            <button onClick={() => router.push("/agent")}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: "#fff", border: "1px solid #e5e5ea", color: "#3a3a3c", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f5f5f7" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#fff" }}
            >
              ← 回到对话
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* 左侧文件列表 */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)" }}>
              {FILES.map((f, i) => {
                const active = activeTab === f.key
                const dirty = isDirty(f.key)
                return (
                  <div key={f.key}
                    onClick={() => setActiveTab(f.key)}
                    className="px-4 py-3.5 cursor-pointer"
                    style={{
                      borderBottom: i < FILES.length - 1 ? "1px solid #f2f2f7" : "none",
                      backgroundColor: active ? "rgba(88,86,214,0.06)" : "transparent",
                      borderLeft: active ? "3px solid #5856d6" : "3px solid transparent",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "#f9f9fb" }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 16 }}>{f.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: active ? "#5856d6" : "#1d1d1f", fontFamily: "monospace" }}>{f.label}</span>
                      </div>
                      {dirty && <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#ff9f0a", flexShrink: 0 }} />}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#8e8e93", lineHeight: 1.4 }}>{f.desc}</p>
                  </div>
                )
              })}
            </div>

            {/* 说明卡 */}
            <div className="rounded-2xl p-4 mt-4" style={{ backgroundColor: "rgba(88,86,214,0.06)", border: "1px solid rgba(88,86,214,0.12)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#5856d6" }}>💡 配置原理</p>
              <p className="text-xs" style={{ color: "#6e6e73", lineHeight: 1.6 }}>
                每次对话时，秒算会自动读取这3个文件并合并到 System Prompt，影响 AI 的行为和知识。
              </p>
            </div>
          </div>

          {/* 右侧编辑区 */}
          <div className="flex-1 flex flex-col">
            <div className="rounded-2xl overflow-hidden flex flex-col" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)", minHeight: 500 }}>
              {/* 编辑器顶栏 */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid #f2f2f7", backgroundColor: "#fafafa" }}>
                <div className="flex items-center gap-2.5">
                  <span style={{ fontSize: 18 }}>{activeFile.icon}</span>
                  <code className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>{activeFile.label}</code>
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
                    <button onClick={() => setContents(prev => ({ ...prev, [activeTab]: originals[activeTab] }))}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ color: "#6e6e73", border: "1px solid #e5e5ea" }}
                    >还原</button>
                  )}
                  <button onClick={() => handleSave(activeTab)}
                    disabled={saving === activeTab || !isDirty(activeTab)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: isDirty(activeTab) ? "linear-gradient(135deg,#5856d6,#af52de)" : "#e5e5ea",
                      color: isDirty(activeTab) ? "#fff" : "#aeaeb2",
                      border: "none", cursor: isDirty(activeTab) ? "pointer" : "default",
                    }}
                  >
                    {saving === activeTab ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>

              {/* Markdown 编辑器 */}
              <div className="flex-1 relative">
                <textarea
                  value={contents[activeTab] || ""}
                  onChange={e => setContents(prev => ({ ...prev, [activeTab]: e.target.value }))}
                  spellCheck={false}
                  style={{
                    width: "100%", height: "100%", minHeight: 460,
                    padding: "16px 20px", border: "none", outline: "none", resize: "none",
                    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                    fontSize: 13, lineHeight: 1.8, color: "#1d1d1f",
                    backgroundColor: "transparent", boxSizing: "border-box",
                  }}
                  placeholder={`在这里编写 ${activeFile.label}…`}
                />
              </div>
            </div>

            {/* 底部提示 */}
            <p className="text-xs mt-2" style={{ color: "#aeaeb2" }}>
              {activeFile.hint} · 支持 Markdown 格式 · 改动实时生效（下次对话开始时加载）
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
