"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"

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
    { label: "秒算",    href: "/agent" },
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
function ImportResult({
  result,
  onReset,
  filename,
  summary,
}: {
  result: any
  onReset: () => void
  filename?: string
  summary?: any
}) {
  const total = result.success + result.failed + result.skipped
  const successRate = total > 0 ? Math.round((result.success / total) * 100) : 0
  const successPct = total > 0 ? Math.round((result.success / total) * 100) : 0
  const skipPct = total > 0 ? Math.round((result.skipped / total) * 100) : 0
  const failPct = total > 0 ? Math.round((result.failed / total) * 100) : 0
  return (
    <div className="py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 左列：文件信息 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#fafafa", border: "1px solid #f2f2f7" }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "#1d1d1f" }}>导入文件信息</h3>
          <div className="space-y-2 text-sm">
            <p style={{ color: "#6e6e73" }}>文件名：<span style={{ color: "#1d1d1f" }}>{filename || "—"}</span></p>
            <p style={{ color: "#6e6e73" }}>总行数：<span style={{ color: "#1d1d1f" }}>{total}</span></p>
            <p style={{ color: "#6e6e73" }}>入库成功率：<span style={{ color: "#1d1d1f" }}>{successRate}%</span></p>
            <p style={{ color: "#8e8e93", fontSize: 12 }}>已跳过 = 重复订单号（防止重复入库）</p>
            <p style={{ color: "#6e6e73" }}>
              日期范围：
              <span style={{ color: "#1d1d1f" }}>
                {summary?.date_from || "—"} ~ {summary?.date_to || "—"}
              </span>
            </p>
            <p style={{ color: "#6e6e73" }}>
              总 GMV：<span style={{ color: "#1d1d1f" }}>¥{Number(summary?.total_gmv || 0).toLocaleString()}</span>
            </p>
          </div>
        </div>

        {/* 右列：导入数据图形 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#fafafa", border: "1px solid #f2f2f7" }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "#1d1d1f" }}>导入数据图表</h3>
          <div className="space-y-3">
            {[
              { label: "成功导入", value: result.success, pct: successPct, color: "#34c759" },
              { label: "已跳过（重复）", value: result.skipped, pct: skipPct, color: "#ff9500" },
              { label: "失败", value: result.failed, pct: failPct, color: "#ff3b30" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: "#6e6e73" }}>{item.label}</span>
                  <span style={{ color: "#1d1d1f", fontWeight: 600 }}>{item.value} ({item.pct}%)</span>
                </div>
                <div className="h-2 rounded-full" style={{ backgroundColor: "#ededf0" }}>
                  <div className="h-2 rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="text-left rounded-xl p-4 mb-6"
          style={{ backgroundColor: "#fff2f1", border: "1px solid #ffd5d5" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "#ff3b30" }}>失败明细</p>
          {result.errors.map((e: string, i: number) => (
            <p key={i} className="text-xs mb-0.5" style={{ color: "#ff3b30" }}>· {e}</p>
          ))}
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <button
          onClick={onReset}
          className="px-5 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ border: "1px solid #d2d2d7", color: "#1d1d1f" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f5f5f7")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          继续导入
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
  const [history, setHistory] = useState<any>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [selectedBatchId, setSelectedBatchId] = useState<string>("")
  const [batchCharts, setBatchCharts] = useState<any>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [pendingDeleteBatchId, setPendingDeleteBatchId] = useState<string>("")
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false)
  const [error, setError] = useState("")
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const u = localStorage.getItem("user")
    if (!token) { router.push("/login"); return }
    if (u) setUser(JSON.parse(u))
    fetchHistory(undefined, 1)
  }, [])

  const fetchHistory = async (preferredBatchId?: string, targetPage?: number) => {
    const token = localStorage.getItem("token")
    if (!token) return
    const page = targetPage || historyPage || 1
    try {
      const res = await fetch(`${API}/import/history?page=${page}&page_size=5`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) return
      setHistoryPage(data.current_page || 1)
      setHistory(data)
      const items = data.items || []
      if (!items.length) {
        setSelectedBatchId("")
        setBatchCharts(null)
        return
      }
      const picked =
        items.find((x: any) => x.batch_id === preferredBatchId) ||
        items[0]
      if (picked?.batch_id) {
        loadBatchCharts(picked.batch_id)
      }
    } catch {
      // noop
    }
  }

  const loadBatchCharts = async (batchId: string) => {
    const token = localStorage.getItem("token")
    if (!token || !batchId) return
    setBatchLoading(true)
    setSelectedBatchId(batchId)
    try {
      const res = await fetch(`${API}/import/history/${batchId}/charts`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || "批次图表加载失败")
        setBatchCharts(null)
        return
      }
      setBatchCharts(data)
    } catch {
      setError("网络错误，批次图表加载失败")
      setBatchCharts(null)
    } finally {
      setBatchLoading(false)
    }
  }

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

  const submitImport = async () => {
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
      await fetchHistory(data.batch_id, 1)
    } catch { setError("网络错误，请重试"); setStep("mapping") }
  }

  const handleConfirm = async () => {
    if (analyzeData?.duplicate_risk) {
      setDuplicateConfirmOpen(true)
      return
    }
    await submitImport()
  }

  const handleDeleteBatchConfirmed = async (batchId: string) => {
    if (!batchId) return
    const token = localStorage.getItem("token")
    if (!token) return
    setBatchLoading(true)
    try {
      const res = await fetch(`${API}/import/history/${batchId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || "删除失败")
        return
      }
      setPendingDeleteBatchId("")
      if (selectedBatchId === batchId) {
        setSelectedBatchId("")
        setBatchCharts(null)
      }
      await fetchHistory()
    } catch {
      setError("网络错误，删除失败")
    } finally {
      setBatchLoading(false)
    }
  }

  const handleDeleteHistoryItem = async (batchId: string) => {
    if (!batchId) return
    setPendingDeleteBatchId(batchId)
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

        {/* 导入历史面板 */}
        {history && (
          <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: "#fff", border: "1px solid #f2f2f7" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>导入历史</p>
              <button
                onClick={() => fetchHistory(undefined, historyPage)}
                className="text-xs px-2.5 py-1 rounded-lg"
                style={{ border: "1px solid #e5e5ea", color: "#6e6e73", backgroundColor: "#fafafa" }}
              >
                刷新
              </button>
            </div>
            {history.reached_limit && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#fff2f1", color: "#d92d20", border: "1px solid #ffd5d5" }}>
                历史图表最多保留 20 条，已达上限。请先删除部分历史后再导入新文件。
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[
                { label: "已导入文件", value: history.total_files || 0 },
                { label: "累计行数", value: history.total_rows || 0 },
                { label: "成功行数", value: history.total_success || 0 },
                { label: "失败行数", value: history.total_failed || 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-3" style={{ backgroundColor: "#f9f9fb", border: "1px solid #f2f2f7" }}>
                  <p className="text-xs mb-1" style={{ color: "#8e8e93" }}>{item.label}</p>
                  <p className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>{Number(item.value).toLocaleString()}</p>
                </div>
              ))}
            </div>
            {(history.items || []).length > 0 ? (
              <>
                <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #f2f2f7" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: "#fafafa", borderBottom: "1px solid #f2f2f7" }}>
                        <th className="text-left py-2 px-3" style={{ color: "#6e6e73" }}>时间</th>
                        <th className="text-left py-2 px-3" style={{ color: "#6e6e73" }}>文件</th>
                        <th className="text-left py-2 px-3" style={{ color: "#6e6e73" }}>结果</th>
                        <th className="text-left py-2 px-3" style={{ color: "#6e6e73" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.items.map((item: any, idx: number) => (
                        <tr key={item.id} style={{ borderBottom: idx < history.items.length - 1 ? "1px solid #f2f2f7" : "none" }}>
                          <td className="py-2 px-3" style={{ color: "#6e6e73" }}>{item.created_at}</td>
                          <td className="py-2 px-3" style={{ color: "#1d1d1f" }}>{item.filename}</td>
                          <td className="py-2 px-3" style={{ color: "#1d1d1f" }}>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md font-medium"
                              style={{
                                backgroundColor: (item.status === "success" || item.status === "partial") ? "#eaf9ef" : "#fff2f1",
                                color: (item.status === "success" || item.status === "partial") ? "#1a7f37" : "#d92d20",
                              }}
                            >
                              {(item.status === "success" || item.status === "partial") ? "成功" : "失败"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => loadBatchCharts(item.batch_id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium"
                                style={{
                                  border: "1px solid #d2d2d7",
                                  color: selectedBatchId === item.batch_id ? "#0071e3" : "#3a3a3c",
                                  backgroundColor: selectedBatchId === item.batch_id ? "#f0f6ff" : "#fff",
                                }}
                              >
                                查看图表
                              </button>
                              <button
                                onClick={() => handleDeleteHistoryItem(item.batch_id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium"
                                style={{
                                  border: "1px solid #ffd5d5",
                                  color: "#ff3b30",
                                  backgroundColor: "#fff2f1",
                                }}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => fetchHistory(undefined, Math.max(1, history.current_page - 1))}
                    disabled={history.current_page <= 1}
                    className="px-2.5 py-1 rounded-lg text-xs"
                    style={{
                      border: "1px solid #d2d2d7",
                      color: history.current_page <= 1 ? "#aeaeb2" : "#3a3a3c",
                      backgroundColor: "#fff",
                    }}
                  >
                    上一页
                  </button>
                  <span className="text-xs" style={{ color: "#6e6e73" }}>
                    第 {history.current_page} / {history.total_pages} 页
                  </span>
                  <button
                    onClick={() => fetchHistory(undefined, Math.min(history.total_pages, history.current_page + 1))}
                    disabled={history.current_page >= history.total_pages}
                    className="px-2.5 py-1 rounded-lg text-xs"
                    style={{
                      border: "1px solid #d2d2d7",
                      color: history.current_page >= history.total_pages ? "#aeaeb2" : "#3a3a3c",
                      backgroundColor: "#fff",
                    }}
                  >
                    下一页
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs" style={{ color: "#8e8e93" }}>还没有导入记录</p>
            )}
          </div>
        )}

        {/* 批次图表分析 */}
        <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: "#fff", border: "1px solid #f2f2f7" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>
                导入批次图表分析
              </p>
                <p className="text-xs" style={{ color: "#8e8e93" }}>
                  {batchCharts?.filename || "加载中..."}
                </p>
              </div>
            </div>

            {batchLoading ? (
              <p className="text-sm" style={{ color: "#6e6e73" }}>正在加载图表...</p>
            ) : batchCharts ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "订单数", value: batchCharts?.summary?.orders || 0 },
                    { label: "GMV", value: `¥${Number(batchCharts?.summary?.gmv || 0).toLocaleString()}` },
                    { label: "广告费", value: `¥${Number(batchCharts?.summary?.ad_cost || 0).toLocaleString()}` },
                    { label: "净利润", value: `¥${Number(batchCharts?.summary?.net_profit || 0).toLocaleString()}` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl p-3" style={{ backgroundColor: "#f9f9fb", border: "1px solid #f2f2f7" }}>
                      <p className="text-xs mb-1" style={{ color: "#8e8e93" }}>{item.label}</p>
                      <p className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl p-3" style={{ border: "1px solid #f2f2f7" }}>
                    <p className="text-xs font-medium mb-2" style={{ color: "#6e6e73" }}>按日期趋势（GMV/净利润）</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={batchCharts?.trend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8e8e93" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#8e8e93" }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="gmv" stroke="#0071e3" fill="#dfefff" name="GMV" />
                        <Area type="monotone" dataKey="net_profit" stroke="#34c759" fill="#e5f9ec" name="净利润" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-xl p-3" style={{ border: "1px solid #f2f2f7" }}>
                    <p className="text-xs font-medium mb-2" style={{ color: "#6e6e73" }}>店铺贡献（GMV）</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={batchCharts?.stores || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8e8e93" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#8e8e93" }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="gmv" fill="#0071e3" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl px-4 py-10 text-center" style={{ border: "1px dashed #d2d2d7", color: "#8e8e93" }}>
                暂无图表数据。请先导入文件，或在上方历史记录点击“查看图表”。
              </div>
            )}
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
                    {(analyzeData.model || analyzeData.input_tokens > 0) && (
                      <div className="flex items-center gap-2 mt-1.5" style={{ color: "#aeaeb2", fontSize: 11 }}>
                        {analyzeData.model && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                            </svg>
                            {analyzeData.model}
                          </span>
                        )}
                        {analyzeData.model && analyzeData.input_tokens > 0 && <span style={{ opacity: 0.4 }}>·</span>}
                        {analyzeData.input_tokens > 0 && (
                          <span title={`输入 ${analyzeData.input_tokens} + 输出 ${analyzeData.output_tokens} tokens`}>
                            ↑{analyzeData.input_tokens} ↓{analyzeData.output_tokens} tokens
                          </span>
                        )}
                      </div>
                    )}
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

                {analyzeData.preview_summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {[
                      { label: "总行数", value: `${analyzeData.preview_summary.total_rows || 0}` },
                      { label: "店铺数", value: `${analyzeData.preview_summary.store_count || 0}` },
                      { label: "总 GMV", value: `¥${Number(analyzeData.preview_summary.total_gmv || 0).toLocaleString()}` },
                      { label: "预估净利润", value: `¥${Number(analyzeData.preview_summary.total_net_profit || 0).toLocaleString()}` },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl p-3" style={{ backgroundColor: "#f9f9fb", border: "1px solid #f2f2f7" }}>
                        <p className="text-xs mb-1" style={{ color: "#8e8e93" }}>{item.label}</p>
                        <p className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>{item.value}</p>
                      </div>
                    ))}
                    <div className="col-span-2 md:col-span-4 rounded-xl p-3" style={{ backgroundColor: "#f9f9fb", border: "1px solid #f2f2f7" }}>
                      <p className="text-xs" style={{ color: "#8e8e93" }}>
                        日期范围：{analyzeData.preview_summary.date_from || "—"} ~ {analyzeData.preview_summary.date_to || "—"}
                      </p>
                    </div>
                  </div>
                )}

                {analyzeData.chart_limit_reached && (
                  <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#fff2f1", color: "#d92d20", border: "1px solid #ffd5d5" }}>
                    {analyzeData.chart_limit_message || "历史图表已达上限，请先删除部分历史后再导入。"}
                  </div>
                )}

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
                      disabled={Boolean(analyzeData.chart_limit_reached)}
                      className="px-5 py-2 rounded-xl text-sm font-medium"
                      style={{
                        backgroundColor: analyzeData.chart_limit_reached ? "#c7c7cc" : "#0071e3",
                        color: "#ffffff",
                        cursor: analyzeData.chart_limit_reached ? "not-allowed" : "pointer",
                      }}>
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
              <ImportResult
                result={importResult}
                onReset={handleReset}
                filename={currentFile?.name}
                summary={analyzeData?.preview_summary}
              />
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

      {pendingDeleteBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #f2f2f7" }}>
            <p className="text-base font-semibold mb-2" style={{ color: "#1d1d1f" }}>确认删除</p>
            <p className="text-sm mb-5" style={{ color: "#6e6e73" }}>
              确认删除这条导入历史及对应入库数据吗？此操作不可恢复。
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingDeleteBatchId("")}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ border: "1px solid #d2d2d7", color: "#3a3a3c", backgroundColor: "#fff" }}
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteBatchConfirmed(pendingDeleteBatchId)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ border: "1px solid #ffd5d5", color: "#ff3b30", backgroundColor: "#fff2f1" }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <div className="w-full max-w-md rounded-2xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #f2f2f7" }}>
            <p className="text-base font-semibold mb-2" style={{ color: "#1d1d1f" }}>检测到疑似重复导入</p>
            <p className="text-sm mb-5" style={{ color: "#6e6e73" }}>
              {analyzeData?.duplicate_warning || "该文件可能与历史导入重复，继续导入可能不会新增入库数据。"}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDuplicateConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ border: "1px solid #d2d2d7", color: "#3a3a3c", backgroundColor: "#fff" }}
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setDuplicateConfirmOpen(false)
                  await submitImport()
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "#0071e3", color: "#fff" }}
              >
                继续导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
