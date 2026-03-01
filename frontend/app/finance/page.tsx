"use client"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts"

const API = "/api/v1"

const PLATFORM: Record<string, { color: string; bg: string; label: string }> = {
  taobao:  { color: "#ff6200", bg: "#fff3ec", label: "天猫" },
  jd:      { color: "#d4121e", bg: "#fff1f1", label: "京东" },
  pdd:     { color: "#e0272b", bg: "#fff1f1", label: "拼多多" },
  shopify: { color: "#5e9e3e", bg: "#f0f9e8", label: "独立站" },
  other:   { color: "#8e8e93", bg: "#f5f5f7", label: "其他" },
}

/* ── NavBar（与 page.tsx 完全一致）─────────── */
function NavBar({ user }: { user: any }) {
  const router   = useRouter()
  const pathname = usePathname()
  const links = [
    { label: "概览",     href: "/" },
    { label: "财务",     href: "/finance" },
    { label: "店铺",     href: "/stores" },
    { label: "导入数据", href: "/import" },
  ]
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        backgroundColor: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(28px) saturate(200%)",
        WebkitBackdropFilter: "blur(28px) saturate(200%)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.03)",
      }}
    >
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

/* ── 图表 Tooltip ─────────────────────────── */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl px-4 py-3 text-xs"
      style={{
        backgroundColor: "rgba(28,28,30,0.94)", color: "#fff",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.36)",
        border: "1px solid rgba(255,255,255,0.10)",
        minWidth: 140,
      }}>
      <p className="font-medium mb-2" style={{ color: "#8e8e93", fontSize: 11 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color, flexShrink: 0 }} />
            <span style={{ color: "#d1d1d6" }}>{p.name}</span>
          </div>
          <span className="font-bold">{typeof p.value === "number" ? `¥${Math.abs(p.value).toLocaleString()}` : p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── 主页面 ───────────────────────────────── */
export default function FinancePage() {
  const router = useRouter()
  const [summary, setSummary] = useState<any>(null)
  const [roi,     setRoi]     = useState<any[]>([])
  const [trend,   setTrend]   = useState<any[]>([])
  const [days,    setDays]    = useState(30)
  const [user,    setUser]    = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"breakdown" | "roi" | "trend">("breakdown")

  const fetchData = async (d: number) => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const [s, r, t] = await Promise.all([
        fetch(`${API}/finance/summary?days=${d}`,       { headers }).then(res => res.json()),
        fetch(`${API}/finance/roi-analysis?days=${d}`,  { headers }).then(res => res.json()),
        fetch(`${API}/finance/profit-trend?days=${d}`,  { headers }).then(res => res.json()),
      ])
      if (s.detail === "登录已过期，请重新登录") { router.push("/login"); return }
      setSummary(s); setRoi(r)
      setTrend(t.map((x: any) => ({ ...x, date: x.date.slice(5) })))
    } catch { router.push("/login") }
  }

  const handleExport = () => {
    const token = localStorage.getItem("token")
    fetch(`${API}/export/excel?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = `订单数据_近${days}天.xlsx`
        a.click()
      })
  }

  useEffect(() => {
    const u = localStorage.getItem("user")
    if (u) setUser(JSON.parse(u))
    fetchData(days)
  }, [])

  /* 加载态 */
  if (!summary) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f2f2f7" }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full animate-spin mx-auto mb-4"
          style={{ border: "3px solid rgba(0,113,227,0.18)", borderTopColor: "#0071e3" }} />
        <p className="text-sm font-medium" style={{ color: "#8e8e93" }}>加载中…</p>
      </div>
    </div>
  )

  /* 数据 */
  const waterfallData = [
    { name: "GMV",    value: summary.gmv,          fill: "#0071e3" },
    { name: "退款",   value: -summary.refund,       fill: "#ff453a" },
    { name: "货品成本", value: -summary.goods_cost, fill: "#ff9f0a" },
    { name: "平台佣金", value: -summary.platform_fee, fill: "#bf5af2" },
    { name: "广告费", value: -summary.ad_cost,      fill: "#ff6b35" },
    { name: "净利润", value: summary.net_profit,    fill: "#30d158" },
  ]

  const costItems = [
    { label: "总 GMV",        value: summary.gmv,          color: "#0071e3" },
    { label: "退款损失",      value: summary.refund,        color: "#ff453a" },
    { label: "货品成本（估40%）", value: summary.goods_cost, color: "#ff9f0a" },
    { label: "平台佣金（估5%）", value: summary.platform_fee, color: "#bf5af2" },
    { label: "广告费",        value: summary.ad_cost,       color: "#ff6b35" },
    { label: "净利润",        value: summary.net_profit,    color: "#30d158" },
  ]

  /* ROI 颜色 */
  const roiColor = (v: number) => v >= 4 ? "#30d158" : v >= 2 ? "#ff9f0a" : "#ff453a"

  /* Tab 配置 */
  const TABS = [
    { key: "breakdown", label: "盈亏结构" },
    { key: "roi",       label: "广告 ROI" },
    { key: "trend",     label: "利润趋势" },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f2f2f7" }}>
      <NavBar user={user} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* 页头 */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-bold" style={{ color: "#1d1d1f", fontSize: 30, letterSpacing: "-0.04em" }}>
              财务分析
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "#8e8e93" }}>近 {days} 天收支概况</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 导出按钮 */}
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
              style={{ border: "1px solid #e5e5ea", color: "#3a3a3c", backgroundColor: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "#f5f5f7"
                e.currentTarget.style.borderColor = "#c5c5ca"
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.10)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "#fff"
                e.currentTarget.style.borderColor = "#e5e5ea"
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              导出 Excel
            </button>

            {/* 时间选择器 */}
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: "#e5e5ea" }}>
              {[7, 30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => { setDays(d); fetchData(d) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    backgroundColor: days === d ? "#fff" : "transparent",
                    color:           days === d ? "#1d1d1f" : "#6e6e73",
                    boxShadow:       days === d ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                    fontWeight:      days === d ? 600 : 400,
                  }}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 指标卡 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "总 GMV",  value: `¥${(summary.gmv / 10000).toFixed(1)}万`,        accent: "#0071e3" },
            { label: "净利润",  value: `¥${(summary.net_profit / 10000).toFixed(1)}万`, accent: "#30d158" },
            { label: "利润率",  value: `${summary.profit_rate}%`,                        accent: "#bf5af2" },
            { label: "客单价",  value: `¥${summary.avg_order_value}`,                   accent: "#ff9f0a" },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-2xl p-5 relative overflow-hidden"
              style={{
                backgroundColor: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
                borderTop: `3px solid ${item.accent}`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-3px)"
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10),0 16px 40px rgba(0,0,0,0.06)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)"
              }}
            >
              <div style={{
                position: "absolute", top: 0, right: 0, width: 64, height: 64,
                background: `radial-gradient(circle at 100% 0%,${item.accent}20,transparent 70%)`,
                pointerEvents: "none",
              }} />
              <p className="text-xs font-medium mb-3 uppercase" style={{ color: "#8e8e93", letterSpacing: "0.04em" }}>
                {item.label}
              </p>
              <p className="font-bold leading-none" style={{ color: "#1d1d1f", fontSize: 28, letterSpacing: "-0.04em" }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* 图表卡 */}
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)" }}>

          {/* Tab 头 */}
          <div className="flex items-center gap-1 px-6 py-4 border-b" style={{ borderColor: "#f2f2f7" }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className="px-4 py-2 rounded-xl text-sm"
                style={{
                  backgroundColor: activeTab === tab.key ? "#f2f2f7" : "transparent",
                  color:           activeTab === tab.key ? "#1d1d1f" : "#6e6e73",
                  fontWeight:      activeTab === tab.key ? 600 : 400,
                  borderBottom:    activeTab === tab.key ? "2px solid #0071e3" : "2px solid transparent",
                  borderRadius:    activeTab === tab.key ? "12px 12px 0 0" : "12px",
                }}
                onMouseEnter={e => {
                  if (activeTab !== tab.key) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)"
                }}
                onMouseLeave={e => {
                  if (activeTab !== tab.key) e.currentTarget.style.backgroundColor = "transparent"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ── 盈亏结构 ─────────────────── */}
            {activeTab === "breakdown" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-xs font-semibold mb-4 uppercase" style={{ color: "#8e8e93", letterSpacing: "0.05em" }}>
                    收支瀑布图
                  </p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={waterfallData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#aeaeb2" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#aeaeb2" }} axisLine={false} tickLine={false}
                        tickFormatter={v => `${(v / 10000).toFixed(0)}万`} width={44} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {waterfallData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <p className="text-xs font-semibold mb-4 uppercase" style={{ color: "#8e8e93", letterSpacing: "0.05em" }}>
                    成本拆分明细
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f2f2f7" }}>
                    {costItems.map((item, i) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between px-4 py-3.5"
                        style={{ borderBottom: i < costItems.length - 1 ? "1px solid #f2f2f7" : "none" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#fafafa")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm" style={{ color: "#3a3a3c" }}>{item.label}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: "#1d1d1f" }}>
                          ¥{item.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── 广告 ROI ─────────────────── */}
            {activeTab === "roi" && (
              <div>
                <p className="text-xs font-semibold mb-5 uppercase" style={{ color: "#8e8e93", letterSpacing: "0.05em" }}>
                  各店铺广告 ROI 对比
                </p>
                <ResponsiveContainer width="100%" height={Math.max(220, roi.length * 56)}>
                  <BarChart data={roi} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#aeaeb2" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#aeaeb2" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="roi" radius={[8, 8, 0, 0]} name="ROI">
                      {roi.map((entry, i) => (
                        <Cell key={i} fill={roiColor(entry.roi)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 rounded-xl overflow-hidden" style={{ border: "1px solid #f2f2f7" }}>
                  {roi.map((store, i) => {
                    const p = PLATFORM[store.platform] || PLATFORM.other
                    return (
                      <div
                        key={store.store_id}
                        className="flex items-center justify-between px-4 py-4"
                        style={{ borderBottom: i < roi.length - 1 ? "1px solid #f2f2f7" : "none" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#fafafa")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                            style={{ backgroundColor: p.bg, color: p.color }}>
                            {p.label}
                          </span>
                          <span className="text-sm font-medium" style={{ color: "#1d1d1f" }}>{store.name}</span>
                        </div>
                        <div className="flex items-center gap-5 text-sm">
                          <div className="text-right">
                            <p className="text-xs" style={{ color: "#8e8e93" }}>ROI</p>
                            <p className="font-bold" style={{ color: roiColor(store.roi) }}>{store.roi}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs" style={{ color: "#8e8e93" }}>广告占比</p>
                            <p className="font-semibold" style={{ color: "#3a3a3c" }}>{store.ad_ratio}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs" style={{ color: "#8e8e93" }}>净利润</p>
                            <p className="font-bold" style={{ color: "#30d158" }}>
                              ¥{(store.profit / 10000).toFixed(1)}万
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 利润趋势 ─────────────────── */}
            {activeTab === "trend" && (
              <div>
                <div className="flex items-center gap-5 mb-5">
                  {[
                    { color: "#30d158", label: "净利润" },
                    { color: "#0071e3", label: "GMV" },
                    { color: "#ff9f0a", label: "广告费" },
                  ].map(i => (
                    <div key={i.label} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i.color }} />
                      <span className="text-xs font-medium" style={{ color: "#6e6e73" }}>{i.label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#30d158" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#30d158" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fGmv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#0071e3" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" vertical={false} />
                    <XAxis dataKey="date"
                      tick={{ fontSize: 10, fill: "#aeaeb2" }} axisLine={false} tickLine={false}
                      interval={Math.floor(trend.length / 7)} />
                    <YAxis tick={{ fontSize: 11, fill: "#aeaeb2" }} axisLine={false} tickLine={false}
                      tickFormatter={v => `${(v / 10000).toFixed(0)}万`} width={44} />
                    <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(0,0,0,0.07)", strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="profit" stroke="#30d158" strokeWidth={2.5}
                      name="净利润" fill="url(#fProfit)" dot={false}
                      activeDot={{ r: 5, fill: "#30d158", strokeWidth: 2, stroke: "#fff" }} />
                    <Area type="monotone" dataKey="gmv" stroke="#0071e3" strokeWidth={1.5}
                      name="GMV" fill="url(#fGmv)" dot={false} strokeDasharray="5 3"
                      activeDot={{ r: 4, fill: "#0071e3", strokeWidth: 2, stroke: "#fff" }} />
                    <Area type="monotone" dataKey="ad_cost" stroke="#ff9f0a" strokeWidth={1.5}
                      name="广告费" fill="none" dot={false}
                      activeDot={{ r: 4, fill: "#ff9f0a", strokeWidth: 2, stroke: "#fff" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
