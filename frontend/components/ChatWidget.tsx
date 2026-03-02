"use client"
import { useState, useRef, useEffect } from "react"

const API = "/api/v1"
const BOT_TOKEN = "bot-ecommerce-saas-2024"

/* ── 简单 Markdown 渲染 ─────────────────── */
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
    if (line.trim() === "") { elements.push(<div key={i} style={{ height: 4 }} />); i++; continue }
    if (line.startsWith("### ")) {
      elements.push(<p key={i} style={{ fontWeight: 600, color: "#1d1d1f", fontSize: 12, marginTop: 8, marginBottom: 2 }}>{renderInline(line.slice(4))}</p>)
      i++; continue
    }
    if (line.startsWith("## ")) {
      elements.push(<p key={i} style={{ fontWeight: 700, color: "#1d1d1f", fontSize: 13, marginTop: 10, marginBottom: 3 }}>{renderInline(line.slice(3))}</p>)
      i++; continue
    }
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i]); i++ }
      const rows = tableLines.filter(l => !l.match(/^\s*\|[\s\-:|]+\|\s*$/))
      elements.push(
        <div key={i} style={{ overflowX: "auto", margin: "4px 0", borderRadius: 8, border: "1px solid #e5e5ea" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <tbody>
              {rows.map((row, ri) => {
                const cells = row.split("|").slice(1, -1)
                const isHeader = ri === 0
                return (
                  <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? "1px solid #f2f2f7" : "none", backgroundColor: isHeader ? "#f9f9fb" : "transparent" }}>
                    {cells.map((cell, ci) => (
                      <td key={ci} style={{ padding: "5px 8px", color: isHeader ? "#6e6e73" : "#1d1d1f", fontWeight: isHeader ? 600 : 400, textAlign: "center" }}>{renderInline(cell.trim())}</td>
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
    if (line.match(/^[-•]\s/) || line.match(/^[✅⚠️🔴🔍📦📊]\s/)) {
      const items: string[] = []
      while (i < lines.length && (lines[i].match(/^[-•]\s/) || lines[i].match(/^[✅⚠️🔴🔍📦📊]\s/))) {
        items.push(lines[i].replace(/^[-•]\s/, "")); i++
      }
      elements.push(
        <ul key={i} style={{ paddingLeft: 14, margin: "3px 0" }}>
          {items.map((item, ii) => <li key={ii} style={{ color: "#3a3a3c", fontSize: 12, marginBottom: 2, lineHeight: 1.5 }}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    }
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++ }
      elements.push(
        <ol key={i} style={{ paddingLeft: 16, margin: "3px 0" }}>
          {items.map((item, ii) => <li key={ii} style={{ color: "#3a3a3c", fontSize: 12, marginBottom: 2, lineHeight: 1.5 }}>{renderInline(item)}</li>)}
        </ol>
      )
      continue
    }
    elements.push(<p key={i} style={{ color: "#3a3a3c", fontSize: 12, lineHeight: 1.65, margin: "1px 0" }}>{renderInline(line)}</p>)
    i++
  }
  return <div>{elements}</div>
}

/* ── 主组件 ─────────────────────────────── */
export default function ChatWidget() {
  const [open,      setOpen]      = useState(false)
  const [messages,  setMessages]  = useState<{ role: string; content: string }[]>([])
  const [input,     setInput]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [tenantId,  setTenantId]  = useState(1)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)

  // 从 localStorage 读租户 ID
  useEffect(() => {
    try {
      const u = localStorage.getItem("user")
      if (u) setTenantId(JSON.parse(u).tenant_id || 1)
    } catch {}
  }, [open])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setMessages(prev => [...prev, { role: "user", content: text }])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch(`${API}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, token: BOT_TOKEN, message: text, session_id: sessionId }),
      })
      const data = await res.json()
      if (data.session_id) setSessionId(data.session_id)
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || data.detail || "出错了，请重试" }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "连接失败，请检查后端服务。" }])
    } finally {
      setLoading(false)
    }
  }

  const SUGGESTED = ["近7天整体情况？", "哪个店铺ROI最差？", "有异常预警吗？", "财务成本拆分"]

  return (
    <>
      {/* 浮动按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed", bottom: 28, right: 28, zIndex: 9999,
            width: 52, height: 52, borderRadius: 18,
            background: "linear-gradient(135deg,#5856d6 0%,#af52de 100%)",
            border: "none", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(88,86,214,0.45), 0 1px 4px rgba(0,0,0,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(88,86,214,0.55), 0 1px 6px rgba(0,0,0,0.15)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(88,86,214,0.45), 0 1px 4px rgba(0,0,0,0.12)" }}
          title="掌舵"
        >
          {/* 舵轮图标 */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {/* 未读提示 */}
          {messages.length > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: "#ff3b30", border: "2px solid #fff",
              fontSize: 9, color: "#fff", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {messages.filter(m => m.role === "assistant").length}
            </span>
          )}
        </button>
      )}

      {/* 对话面板 */}
      {open && (
        <div style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 9999,
          width: 380, height: 560,
          borderRadius: 20,
          backgroundColor: "#fff",
          boxShadow: "0 16px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.06)",
          animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <style>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(16px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* 顶栏 */}
          <div style={{
            padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "linear-gradient(135deg,#5856d6 0%,#af52de 100%)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>掌舵</p>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, lineHeight: 1.2 }}>经营数据分析师</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {/* 清空会话 */}
              <button onClick={() => { setMessages([]); setSessionId(null) }}
                style={{ width: 28, height: 28, borderRadius: 8, border: "none", backgroundColor: "rgba(255,255,255,0.15)", cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                title="清空会话"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {/* 最小化 */}
              <button onClick={() => setOpen(false)}
                style={{ width: 28, height: 28, borderRadius: 8, border: "none", backgroundColor: "rgba(255,255,255,0.15)", cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
                title="最小化"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* 消息区域 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column" }}>
            {/* 空状态 */}
            {messages.length === 0 && (
              <div>
                <p style={{ textAlign: "center", color: "#8e8e93", fontSize: 12, marginBottom: 12 }}>
                  有什么需要分析的，直接问我
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {SUGGESTED.map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      style={{
                        padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e5ea",
                        backgroundColor: "#f9f9fb", cursor: "pointer", textAlign: "left",
                        fontSize: 12, color: "#3a3a3c", lineHeight: 1.4,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f0f0f5"; e.currentTarget.style.borderColor = "rgba(88,86,214,0.3)" }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f9f9fb"; e.currentTarget.style.borderColor = "#e5e5ea" }}
                    >
                      <span style={{ color: "#5856d6", marginRight: 4 }}>✦</span>{q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 消息列表 */}
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: 10, display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start", gap: 8 }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg,#5856d6,#af52de)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
                <div style={{
                  maxWidth: "78%", padding: "8px 12px", borderRadius: 14,
                  ...(msg.role === "user"
                    ? { background: "linear-gradient(135deg,#5856d6,#af52de)", color: "#fff", fontSize: 13, lineHeight: 1.5, borderBottomRightRadius: 4 }
                    : { backgroundColor: "#f5f5f7", borderBottomLeftRadius: 4 }
                  ),
                }}>
                  {msg.role === "user"
                    ? msg.content
                    : <MarkdownContent text={msg.content} />
                  }
                </div>
              </div>
            ))}

            {/* 加载动画 */}
            {loading && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg,#5856d6,#af52de)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/>
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ padding: "10px 14px", borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: "#f5f5f7", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 1, 2].map(n => (
                    <span key={n} style={{
                      width: 7, height: 7, borderRadius: "50%", backgroundColor: "#c5c5ca", display: "block",
                      animation: `widgetBounce 1.2s ease-in-out ${n * 0.2}s infinite`,
                    }} />
                  ))}
                  <style>{`@keyframes widgetBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 输入区域 */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid #f2f2f7", display: "flex", alignItems: "flex-end", gap: 8 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "34px"; e.target.style.height = Math.min(e.target.scrollHeight, 90) + "px" }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="问问你的数据…"
              disabled={loading}
              rows={1}
              style={{
                flex: 1, resize: "none", borderRadius: 12, padding: "7px 12px",
                fontSize: 13, border: "1px solid #e5e5ea", outline: "none",
                backgroundColor: "#f9f9fb", color: "#1d1d1f", lineHeight: 1.5,
                height: 34, minHeight: 34, maxHeight: 90,
              }}
              onFocus={e => (e.target.style.borderColor = "#5856d6")}
              onBlur={e => (e.target.style.borderColor = "#e5e5ea")}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0,
                background: input.trim() && !loading ? "linear-gradient(135deg,#5856d6,#af52de)" : "#e5e5ea",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: input.trim() && !loading ? "0 2px 8px rgba(88,86,214,0.35)" : "none",
                transition: "all 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={input.trim() && !loading ? "#fff" : "#aeaeb2"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
