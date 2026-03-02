"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

const API = "/api/v1"

const FIELD_LABELS: Record<string, string> = {
  order_no:     "订单号",
  store_name:   "店铺名称",
  gmv:          "销售额",
  ad_cost:      "广告费",
  platform_fee: "平台佣金",
  net_profit:   "净利润",
  order_date:   "订单日期",
  ignore:       "忽略此列",
}

function NavBar({ user }: { user: any }) {
  const router   = useRouter()
  const pathname = usePathname()
  const links = [
    { label: "概览",     href: "/" },
    { label: "财务",     href: "/finance" },
    { label: "店铺",     href: "/stores" },
    { label: "导入数据", href: "/import" },
    { label: "掌舵",    href: "/agent" },
  ]
  return (
    <header className="sticky top-0 z-30"
      style={{
        backgroundColor: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(28px) saturate(200%)",
        WebkitBackdropFilter: "blur(28px) saturate(200%)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.03)",
      }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => router.push("/")}>
            <div className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0071e3 0%,#42a1ec 100%)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" fill="white"/>
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
                    color:           active ? "#0071e3" : "#3a3a3c",
                    backgroundColor: active ? "rgba(0,113,227,0.10)" : "transparent",
                    fontWeight:      active ? 600 : 400,
                  }}
                  onMouseEnter={e => {
                    if (!active) { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.055)"; e.currentTarget.style.color = "#1d1d1f" }
                  }}
                  onMouseLeave={e => {
                    if (!active) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#3a3a3c" }
                  }}>
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0071e3 0%,#5856d6 100%)" }}>
              {(user.full_name || "U").charAt(0)}
            </div>
            <span className="text-xs font-medium" style={{ color: "#3a3a3c" }}>{user.full_name}</span>
          </div>
        )}
      </div>
    </header>
  )
}

// 上传区域
function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  return (
    <div
      className="border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all"
      style={{
        borderColor: dragging ? "#0071e3" : "#d2d2d7",
        backgroundColor: dragging ? "#f0f6ff" : "#fafafa",
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ backgroundColor: "#f5f5f7" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <p className="text-base font-medium mb-1.5" style={{ color: "#1d1d1f" }}>拖拽文件到这里</p>
      <p className="text-sm mb-4" style={{ color: "#6e6e73" }}>或点击选择文件</p>
      <p className="text-xs" style={{ color: "#aeaeb2" }}>支持 .xlsx · .xls · .csv · 最大 10MB</p>
    </div>
  )
}

// 映射表格
function MappingTable({ columns, sampleRows, mapping, confidence, systemFields, onMappingChange }: {
  columns: string[]; sampleRows: string[][]; mapping: Record<string, string>
  confidence: Record<string, number>; systemFields: Record<string, string>
  onMappingChange: (col: string, field: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #f2f2f7" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#fafafa", borderBottom: "1px solid #f2f2f7" }}>
            <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: "#6e6e73" }}>你的列名</th>
            <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: "#6e6e73" }}>样本数据</th>
            <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: "#6e6e73" }}>AI 识别结果</th>
            <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: "#6e6e73" }}>置信度</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col, i) => {
            const mapped = mapping[col] || "ignore"
            const conf = confidence[col] ?? 0
            const confColor = conf >= 0.9 ? "#34c759" : conf >= 0.7 ? "#ff9500" : "#ff3b30"
            return (
              <tr key={col} style={{ borderBottom: i < columns.length - 1 ? "1px solid #f2f2f7" : "none" }}>
                <td className="py-3 px-4 font-medium text-sm" style={{ color: "#1d1d1f" }}>{col}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1">
                    {sampleRows.map((row, ri) => (
                      <span key={ri} className="text-xs px-2 py-0.5 rounded-lg w-fit max-w-[160px] truncate"
                        style={{ backgroundColor: "#f5f5f7", color: "#6e6e73" }}>
                        {row[i] || "—"}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <select value={mapped} onChange={e => onMappingChange(col, e.target.value)}
                    className="text-xs rounded-lg px-2.5 py-1.5 outline-none transition-all"
                    style={{
                      border: `1px solid ${mapped === "ignore" ? "#d2d2d7" : "#0071e3"}`,
                      color: mapped === "ignore" ? "#6e6e73" : "#0071e3",
                      backgroundColor: mapped === "ignore" ? "#fafafa" : "#f0f6ff",
                    }}>
                    {Object.entries(systemFields).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-4">
                  {mapped !== "ignore" ? (
                    <span className="text-xs font-medium" style={{ color: confColor }}>
                      {Math.round(conf * 100)}%
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "#d2d2d7" }}>—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 导入结果
function ImportResult({ result, onReset }: { result: any; onReset: () => void }) {
  const router = useRouter()
  const total = result.success + result.failed + result.skipped
  const successRate = total > 0 ? Math.round((result.success / total) * 100) : 0
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
        style={{ backgroundColor: result.success > 0 ? "#f0fff4" : "#fff2f1" }}>
        {result.success > 0
          ? <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#ff3b30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        }
      </div>
      <h3 className="text-xl font-semibold mb-1" style={{ color: "#1d1d1f" }}>导入完成</h3>
      <p className="text-sm mb-8" style={{ color: "#6e6e73" }}>成功率 {successRate}%</p>

      <div className="flex justify-center gap-3 mb-8">
        {[
          { label: "成功导入", value: result.success, color: "#34c759", bg: "#f0fff4" },
          { label: "已跳过", value: result.skipped, color: "#ff9500", bg: "#fff8f0" },
          { label: "失败", value: result.failed, color: "#ff3b30", bg: "#fff2f1" },
        ].map(item => (
          <div key={item.label} className="rounded-2xl p-5 w-28 text-center"
            style={{ backgroundColor: item.bg }}>
            <p className="text-3xl font-bold mb-1" style={{ color: item.color }}>{item.value}</p>
            <p className="text-xs" style={{ color: "#6e6e73" }}>{item.label}</p>
          </div>
        ))}
      </div>

      {result.errors.length > 0 && (
        <div className="text-left rounded-xl p-4 mb-6 max-w-md mx-auto"
          style={{ backgroundColor: "#fff2f1", border: "1px solid #ffd5d5" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "#ff3b30" }}>失败明细</p>
          {result.errors.map((e: string, i: number) => (
            <p key={i} className="text-xs mb-0.5" style={{ color: "#ff3b30" }}>· {e}</p>
          ))}
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <button onClick={onReset}
          className="px-5 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ border: "1px solid #d2d2d7", color: "#1d1d1f" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f5f5f7")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
          继续导入
        </button>
        <button onClick={() => router.push("/")}
          className="px-5 py-2 rounded-xl text-sm font-medium"
          style={{ backgroundColor: "#0071e3", color: "#ffffff" }}>
          查看看板
        </button>
      </div>
    </div>
  )
}

type Step = "upload" | "analyzing" | "mapping" | "importing" | "done"

export default function ImportPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("upload")
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [analyzeData, setAnalyzeData] = useState<any>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<any>(null)
  const [error, setError] = useState("")
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const u = localStorage.getItem("user")
    if (!token) { router.push("/login"); return }
    if (u) setUser(JSON.parse(u))
  }, [])

  const handleFile = async (file: File) => {
    setCurrentFile(file); setError(""); setStep("analyzing")
    const token = localStorage.getItem("token")
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(`${API}/import/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || "AI 分析失败"); setStep("upload"); return }
      setAnalyzeData(data); setMapping(data.mapping || {}); setStep("mapping")
    } catch { setError("网络错误，请检查后端服务"); setStep("upload") }
  }

  const handleConfirm = async () => {
    if (!currentFile || !analyzeData) return
    setStep("importing"); setError("")
    const token = localStorage.getItem("token")
    const mappings = Object.entries(mapping).map(([column, field]) => ({ column, field }))
    try {
      const res = await fetch(`${API}/import/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: currentFile.name, mappings }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || "导入失败"); setStep("mapping"); return }
      setImportResult(data); setStep("done")
    } catch { setError("网络错误，请重试"); setStep("mapping") }
  }

  const handleReset = () => {
    setStep("upload"); setCurrentFile(null); setAnalyzeData(null)
    setMapping({}); setImportResult(null); setError("")
  }

  const mappedCount = Object.values(mapping).filter(v => v !== "ignore").length
  const stepOrder = ["upload", "analyzing", "mapping", "importing", "done"]
  const currentIdx = stepOrder.indexOf(step)

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f5f7" }}>
      <NavBar user={user} />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold" style={{ color: "#1d1d1f", letterSpacing: "-0.02em" }}>导入数据</h1>
          <p className="text-sm mt-1" style={{ color: "#6e6e73" }}>上传任意电商平台订单报表，AI 自动识别字段</p>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { key: "upload", label: "上传文件" },
            { key: "mapping", label: "确认字段" },
            { key: "done", label: "导入完成" },
          ].map((s, i) => {
            const stepIdx = stepOrder.indexOf(s.key)
            const active = currentIdx >= stepIdx
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-8 rounded" style={{ backgroundColor: active ? "#0071e3" : "#d2d2d7" }} />}
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ backgroundColor: active ? "#0071e3" : "#e5e5ea", color: active ? "#fff" : "#aeaeb2" }}>
                    {i + 1}
                  </div>
                  <span className="text-xs font-medium" style={{ color: active ? "#1d1d1f" : "#aeaeb2" }}>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "#fff2f1", color: "#ff3b30", border: "1px solid #ffd5d5" }}>
            {error}
          </div>
        )}

        {/* 主内容卡片 */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="p-8">

            {step === "upload" && <UploadZone onFile={handleFile} />}

            {step === "analyzing" && (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full border-2 animate-spin mx-auto mb-5"
                  style={{ borderColor: "#0071e3", borderTopColor: "transparent" }} />
                <p className="text-base font-medium mb-2" style={{ color: "#1d1d1f" }}>AI 正在识别字段</p>
                <p className="text-sm" style={{ color: "#6e6e73" }}>
                  正在分析「{currentFile?.name}」，通常需要 3–8 秒
                </p>
              </div>
            )}

            {step === "mapping" && analyzeData && (
              <div>
                {/* 文件信息 */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#1d1d1f" }}>{currentFile?.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6e6e73" }}>共 {analyzeData.total_rows} 行数据</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {analyzeData.tips && (
                      <p className="text-xs px-3 py-1.5 rounded-xl" style={{ backgroundColor: "#f0f6ff", color: "#0071e3" }}>
                        {analyzeData.tips}
                      </p>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ backgroundColor: "#f5f5f7", color: "#1d1d1f" }}>
                      已识别 {mappedCount}/{analyzeData.columns.length} 列
                    </span>
                  </div>
                </div>

                <MappingTable
                  columns={analyzeData.columns}
                  sampleRows={analyzeData.sample_rows}
                  mapping={mapping}
                  confidence={analyzeData.confidence}
                  systemFields={analyzeData.system_fields}
                  onMappingChange={(col, field) => setMapping(prev => ({ ...prev, [col]: field }))}
                />

                <div className="flex items-center justify-between mt-6 pt-5"
                  style={{ borderTop: "1px solid #f2f2f7" }}>
                  <button onClick={handleReset}
                    className="px-4 py-2 rounded-xl text-sm transition-colors"
                    style={{ border: "1px solid #d2d2d7", color: "#6e6e73" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f5f5f7")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                    重新上传
                  </button>
                  <div className="flex items-center gap-3">
                    <p className="text-xs" style={{ color: "#aeaeb2" }}>
                      不需要的列设置为「忽略此列」即可
                    </p>
                    <button onClick={handleConfirm}
                      className="px-5 py-2 rounded-xl text-sm font-medium"
                      style={{ backgroundColor: "#0071e3", color: "#ffffff" }}>
                      导入 {analyzeData.total_rows} 条数据
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === "importing" && (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full border-2 animate-spin mx-auto mb-5"
                  style={{ borderColor: "#34c759", borderTopColor: "transparent" }} />
                <p className="text-base font-medium mb-2" style={{ color: "#1d1d1f" }}>正在写入数据库</p>
                <p className="text-sm" style={{ color: "#6e6e73" }}>
                  共 {analyzeData?.total_rows} 条数据，请稍候
                </p>
              </div>
            )}

            {step === "done" && importResult && (
              <ImportResult result={importResult} onReset={handleReset} />
            )}
          </div>
        </div>

        {/* 上传页说明 */}
        {step === "upload" && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { title: "支持所有主流平台", desc: "淘宝、京东、拼多多、抖音、Shopee 等平台导出文件均可" },
              { title: "AI 自动识别字段", desc: "无需填写模板，AI 自动判断每列含义，支持中英文" },
              { title: "一键微调确认", desc: "识别结果可手动调整，确认后数据实时更新到看板" },
            ].map(item => (
              <div key={item.title} className="rounded-2xl p-4"
                style={{ backgroundColor: "#ffffff", border: "1px solid #f2f2f7" }}>
                <p className="text-sm font-medium mb-1.5" style={{ color: "#1d1d1f" }}>{item.title}</p>
                <p className="text-xs" style={{ color: "#6e6e73" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
