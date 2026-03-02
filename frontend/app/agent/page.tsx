"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"

const API = "/api/v1"
const BOT_TOKEN = "bot-ecommerce-saas-2024"

/* ── NavBar（与 page.tsx 保持一致）─────────── */
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
            <div className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0071e3 0%,#42a1ec 100%)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight" style={{ color: "#1d1d1f", letterSpacing: "-0.02em" }}>
              {user?.tenant_name || "多店经营"}
            </span>
          </div>
          <nav className="flex items-center gap-0.5">
            {links.map(item => {
              const active = pathname === item.href
              return (
                <button key={item.href} onClick={() => router.push(item.href)}
                  className="px-3.5 py-1.5 rounded-xl text-sm"
                  style={{
                    color: active ? "#0071e3" : "#3a3a3c",
                    backgroundColor: active ? "rgba(0,113,227,0.10)" : "transparent",
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.055)"; e.currentTarget.style.color = "#1d1d1f" } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#3a3a3c" } }}
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
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#0071e3 0%,#5856d6 100%)" }}>
                {(user.full_name || "U").charAt(0)}
              </div>
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

/* ── 简单 Markdown 渲染 ─────────────────────
   处理 AI 返回的常见格式：## 标题、**粗体**、表格、列表
*/
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  const renderInline = (str: string): React.ReactNode => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, idx) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={idx} style={{ color: "#1d1d1f", fontWeight: 700 }}>{p.slice(2, -2)}</strong>
        : p
    )
  }

  while (i < lines.length) {
    const line = lines[i]

    // 空行
    if (line.trim() === "") { elements.push(<div key={i} style={{ height: 6 }} />); i++; continue }

    // ## 或 ### 标题
    if (line.startsWith("### ")) {
      elements.push(<p key={i} className="font-semibold mt-3 mb-1" style={{ color: "#1d1d1f", fontSize: 13 }}>{renderInline(line.slice(4))}</p>)
      i++; continue
    }
    if (line.startsWith("## ")) {
      elements.push(<p key={i} className="font-bold mt-4 mb-2" style={{ color: "#1d1d1f", fontSize: 14 }}>{renderInline(line.slice(3))}</p>)
      i++; continue
    }

    // 表格（以 | 开头）
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]); i++
      }
      // 过滤分隔行（|---|）
      const rows = tableLines.filter(l => !l.match(/^\s*\|[\s\-:|]+\|\s*$/))
      elements.push(
        <div key={i} className="overflow-x-auto my-2 rounded-xl" style={{ border: "1px solid #e5e5ea" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {rows.map((row, ri) => {
                const cells = row.split("|").slice(1, -1)
                const isHeader = ri === 0
                return (
                  <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? "1px solid #f2f2f7" : "none", backgroundColor: isHeader ? "#f9f9fb" : "transparent" }}>
                    {cells.map((cell, ci) => (
                      <td key={ci} style={{ padding: "7px 12px", color: isHeader ? "#6e6e73" : "#1d1d1f", fontWeight: isHeader ? 600 : 400, textAlign: "center" }}>
                        {renderInline(cell.trim())}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // 无序列表 - 或 ✅ ⚠️ 🔴 开头
    if (line.match(/^[-•]\s/) || line.match(/^[✅⚠️🔴🔍📦📊]\s/)) {
      const items: string[] = []
      while (i < lines.length && (lines[i].match(/^[-•]\s/) || lines[i].match(/^[✅⚠️🔴🔍📦📊]\s/))) {
        items.push(lines[i].replace(/^[-•]\s/, "")); i++
      }
      elements.push(
        <ul key={i} style={{ paddingLeft: 16, margin: "4px 0" }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ color: "#3a3a3c", fontSize: 13, marginBottom: 3, lineHeight: 1.6 }}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // 有序列表
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s/, "")); i++
      }
      elements.push(
        <ol key={i} style={{ paddingLeft: 20, margin: "4px 0" }}>
          {items.map((item, ii) => (
            <li key={ii} style={{ color: "#3a3a3c", fontSize: 13, marginBottom: 3, lineHeight: 1.6 }}>{renderInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // 普通段落
    elements.push(
      <p key={i} style={{ color: "#3a3a3c", fontSize: 13, lineHeight: 1.7, margin: "2px 0" }}>
        {renderInline(line)}
      </p>
    )
    i++
  }

  return <div>{elements}</div>
}

/* ── 消息气泡 ────────────────────────────── */
function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-4">
      <div
        className="px-4 py-2.5 rounded-2xl rounded-br-md max-w-sm text-sm"
        style={{
          background: "linear-gradient(135deg,#0071e3 0%,#42a1ec 100%)",
          color: "#fff",
          lineHeight: 1.6,
          boxShadow: "0 2px 8px rgba(0,113,227,0.28)",
        }}
      >
        {content}
      </div>
    </div>
  )
}

function AiBubble({ content, model, inputTokens, outputTokens, elapsed }: {
  content: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  elapsed?: string
}) {
  return (
    <div className="flex gap-3 mb-4">
      {/* AI 头像 */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg,#5856d6 0%,#af52de 100%)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 0 2h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1 0-2h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-3 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="white" />
        </svg>
      </div>
      {/* 内容卡片 */}
      <div className="flex-1">
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-md"
          style={{
            backgroundColor: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <MarkdownContent text={content} />
        </div>
        {/* 模型 + Token 信息 */}
        {(model || (inputTokens !== undefined && inputTokens > 0)) && (
          <div className="flex items-center gap-2 mt-1.5 px-1" style={{ color: "#aeaeb2", fontSize: 10 }}>
            {model && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
                {model}
              </span>
            )}
            {model && inputTokens !== undefined && <span style={{ opacity: 0.4 }}>·</span>}
            {inputTokens !== undefined && inputTokens > 0 && (
              <span title={`输入 ${inputTokens}（含prompt）+ 输出 ${outputTokens} tokens，双向计费`}>
                ↑{inputTokens} ↓{outputTokens} tokens
              </span>
            )}
            {elapsed && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                  {elapsed}s
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingBubble({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startTime), 100)
    return () => clearInterval(id)
  }, [startTime])

  const secs = (elapsed / 1000).toFixed(1)

  return (
    <div className="flex gap-3 mb-4">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#5856d6 0%,#af52de 100%)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 0 2h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1 0-2h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-3 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="white" />
        </svg>
      </div>
      <div>
        <div className="px-4 py-3 rounded-2xl rounded-tl-md flex items-center gap-2"
          style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.04)" }}>
          {/* 跳动点 */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(n => (
              <span key={n} className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "#c5c5ca", animation: `bounce 1.2s ease-in-out ${n * 0.2}s infinite` }} />
            ))}
          </div>
          {/* 分隔 */}
          <span style={{ width: 1, height: 14, backgroundColor: "#e5e5ea", flexShrink: 0 }} />
          {/* 状态文字 */}
          <span style={{ fontSize: 11, color: "#8e8e93", whiteSpace: "nowrap" }}>
            正在分析
            <span style={{
              display: "inline-block",
              width: 16,
              textAlign: "left",
              animation: "ellipsis 1.5s steps(3,end) infinite",
            }}>...</span>
          </span>
        </div>
        {/* 模型 + 计时 */}
        <div className="flex items-center gap-2 mt-1.5 px-1" style={{ color: "#aeaeb2", fontSize: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
            MiniMax-M2.5
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            {secs}s
          </span>
        </div>
        <style>{`
          @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
          @keyframes ellipsis { 0%{content:"."} 33%{content:".."} 66%{content:"..."} }
        `}</style>
      </div>
    </div>
  )
}

/* ── 主页面 ───────────────────────────────── */
export default function AgentPage() {
  const router          = useRouter()
  const [user,          setUser]          = useState<any>(null)
  const [messages,      setMessages]      = useState<{ role: string; content: string; model?: string; inputTokens?: number; outputTokens?: number; elapsed?: string }[]>([])
  const [input,         setInput]         = useState("")
  const [loading,          setLoading]          = useState(false)
  const [loadingStartTime, setLoadingStartTime] = useState<number>(0)
  const [sessionId,        setSessionId]        = useState<string | null>(null)
  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const textareaRef     = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const u     = localStorage.getItem("user")
    if (!token) { router.push("/login"); return }
    if (u) setUser(JSON.parse(u))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const tenantId = user?.tenant_id || 1

    setMessages(prev => [...prev, { role: "user", content: text }])
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "40px"
    const t0 = Date.now()
    setLoadingStartTime(t0)
    setLoading(true)

    try {
      const res = await fetch(`${API}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, token: BOT_TOKEN, message: text, session_id: sessionId }),
      })
      const data = await res.json()
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      if (data.session_id) setSessionId(data.session_id)
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || data.detail || "抱歉，出现了错误",
        model: data.model,
        inputTokens: data.input_tokens,
        outputTokens: data.output_tokens,
        elapsed,
      }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "连接失败，请检查后端服务是否运行。" }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "40px"
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
  }

  const SUGGESTED = [
    "最近7天整体经营情况怎么样？",
    "哪个店铺ROI最差？",
    "有没有需要关注的异常预警？",
    "近30天财务成本怎么拆分的？",
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f2f2f7" }}>
      <NavBar user={user} onLogout={handleLogout} />

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* 空状态：欢迎 + 快捷问题 */}
          {messages.length === 0 && (
            <div className="text-center mb-10">
              {/* AI 图标 */}
              <div className="w-16 h-16 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#5856d6 0%,#af52de 100%)", boxShadow: "0 8px 24px rgba(88,86,214,0.32)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 0 2h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1 0-2h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-3 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="white" />
                </svg>
              </div>
              <h2 className="font-bold mb-2" style={{ color: "#1d1d1f", fontSize: 22, letterSpacing: "-0.03em" }}>秒算</h2>
              <p className="text-sm" style={{ color: "#8e8e93" }}>用自然语言查询你的店铺数据，获取专业分析建议</p>
              <p className="text-xs mt-1" style={{ color: "#c5c5ca" }}>MiniMax-M2.5 · 基于openclaw架构</p>

              {/* 快捷问题 */}
              <div className="grid grid-cols-2 gap-3 mt-8 text-left">
                {SUGGESTED.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="px-4 py-3.5 rounded-2xl text-sm text-left"
                    style={{
                      backgroundColor: "#fff",
                      border: "1px solid rgba(0,0,0,0.06)",
                      color: "#3a3a3c",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      lineHeight: 1.5,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f5f5f7"; e.currentTarget.style.borderColor = "rgba(0,113,227,0.2)" }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#fff"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)" }}
                  >
                    <span style={{ color: "#0071e3", marginRight: 6 }}>✦</span>{q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 对话消息 */}
          {messages.map((msg, idx) =>
            msg.role === "user"
              ? <UserBubble key={idx} content={msg.content} />
              : <AiBubble   key={idx} content={msg.content} model={msg.model} inputTokens={msg.inputTokens} outputTokens={msg.outputTokens} elapsed={msg.elapsed} />
          )}

          {loading && <LoadingBubble startTime={loadingStartTime} />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入栏 */}
      <div style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        backgroundColor: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-end gap-3">
          {/* 配置按钮 */}
          <button onClick={() => router.push("/agent/config")}
            title="掌舵配置"
            className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "#f2f2f7", border: "1px solid #e5e5ea", color: "#8e8e93" }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#e9e9ef"; e.currentTarget.style.color = "#5856d6" }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f2f2f7"; e.currentTarget.style.color = "#8e8e93" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="问问你的数据…（Enter 发送，Shift+Enter 换行）"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
            style={{
              height: 40,
              minHeight: 40,
              maxHeight: 120,
              border: "1px solid #e5e5ea",
              backgroundColor: "#f9f9fb",
              color: "#1d1d1f",
              lineHeight: 1.6,
              transition: "border-color 0.15s",
            }}
            onFocus={e => (e.target.style.borderColor = "#0071e3")}
            onBlur={e => (e.target.style.borderColor = "#e5e5ea")}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: input.trim() && !loading
                ? "linear-gradient(135deg,#0071e3 0%,#42a1ec 100%)"
                : "#e5e5ea",
              transition: "all 0.2s",
              boxShadow: input.trim() && !loading ? "0 2px 8px rgba(0,113,227,0.32)" : "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={input.trim() && !loading ? "#fff" : "#aeaeb2"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-center pb-2" style={{ fontSize: 10, color: "#c5c5ca" }}>
          秒算 · 由 MiniMax M2.5 驱动
        </p>
      </div>
    </div>
  )
}
