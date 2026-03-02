"use client"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts"

const API = "/api/v1"

/* ── 平台配置 ─────────────────────────────── */
const PLATFORM: Record<string, { color: string; bg: string; label: string }> = {
  taobao:  { color: "#ff6200", bg: "#fff3ec", label: "天猫" },
  jd:      { color: "#d4121e", bg: "#fff1f1", label: "京东" },
  pdd:     { color: "#e0272b", bg: "#fff1f1", label: "拼多多" },
  shopify: { color: "#5e9e3e", bg: "#f0f9e8", label: "独立站" },
  other:   { color: "#8e8e93", bg: "#f5f5f7", label: "其他" },
}

/* ── 通用 NavBar（所有页面共用样式）──────── */
function NavBar({ user, onLogout }: { user: any; onLogout?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()

  const links = [
    { label: "概览",     href: "/" },
    { label: "财务",     href: "/finance" },
    { label: "店铺",     href: "/stores" },
    { label: "导入数据", href: "/import" },
    { label: "掌舵",     href: "/agent" },
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
        {/* 左：品牌 + 导航 */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => router.push("/")}
          >
            <div
              className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0071e3 0%,#42a1ec 100%)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"
                  fill="white"
                />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight" style={{ color: "#1d1d1f", letterSpacing: "-0.02em" }}>
              {user?.tenant_name || "多店经营"}
            </span>
          </div>

          {/* 导航链接 */}
          <nav className="flex items-center gap-0.5">
            {links.map(item => {
              const active = pathname === item.href
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="px-3.5 py-1.5 rounded-xl text-sm"
                  style={{
                    color:           active ? "#0071e3" : "#3a3a3c",
                    backgroundColor: active ? "rgba(0,113,227,0.10)" : "transparent",
                    fontWeight:      active ? 600 : 400,
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.055)"
                      e.currentTarget.style.color = "#1d1d1f"
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
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

        {/* 右：用户 + 退出 */}
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
              style={{
                color: "#6e6e73",
                border: "1px solid #e5e5ea",
                backgroundColor: "transparent",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "#f5f5f7"
                e.currentTarget.style.borderColor = "#c5c5ca"
                e.currentTarget.style.color = "#1d1d1f"
              }}
              onMouseLeave={e => {
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

/* ── 指标卡 ───────────────────────────────── */
function MetricCard({
  label, value, change, up, accent,
}: {
  label: string; value: string; change: string; up: boolean; accent: string
}) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        backgroundColor: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
        borderTop: `3px solid ${accent}`,
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
      {/* 角落渐变装饰 */}
      <div
        style={{
          position: "absolute", top: 0, right: 0,
          width: 72, height: 72,
          background: `radial-gradient(circle at 100% 0%,${accent}22,transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: "#8e8e93", letterSpacing: "0.04em" }}>
        {label}
      </p>
      <p
        className="font-bold leading-none mb-3"
        style={{ color: "#1d1d1f", fontSize: 28, letterSpacing: "-0.04em" }}
      >
        {value}
      </p>
      <div className="flex items-center gap-1.5">
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
          style={{
            color:           up ? "#1a7f3c" : "#c0392b",
            backgroundColor: up ? "#edfaf2" : "#fff1f0",
          }}
        >
          {up ? "↑" : "↓"} {change}
        </span>
        <span className="text-xs" style={{ color: "#aeaeb2" }}>较上期</span>
      </div>
    </div>
  )
}

/* ── 图表 Tooltip ────────────────────────── */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-2xl px-4 py-3 text-xs"
      style={{
        backgroundColor: "rgba(28,28,30,0.94)",
        color: "#fff",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.36)",
        border: "1px solid rgba(255,255,255,0.10)",
        minWidth: 140,
      }}
    >
      <p className="font-medium mb-2" style={{ color: "#8e8e93", fontSize: 11 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color, flexShrink: 0 }} />
            <span style={{ color: "#d1d1d6" }}>{p.name}</span>
          </div>
          <span className="font-bold" style={{ color: "#fff" }}>
            ¥{Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── 主页面 ───────────────────────────────── */
export default function Dashboard() {
  const router   = useRouter()
  const [overview, setOverview] = useState<any>(null)
  const [trend,    setTrend]    = useState<any[]>([])
  const [stores,   setStores]   = useState<any[]>([])
  const [user,     setUser]     = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [activeTab, setActiveTab] = useState<"trend" | "stores">("trend")

  useEffect(() => {
    const token = localStorage.getItem("token")
    const u     = localStorage.getItem("user")
    if (!token) { router.push("/login"); return }
    if (u) setUser(JSON.parse(u))
    const tenantId = JSON.parse(u || "{}").tenant_id || 1
    const headers  = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${API}/stats/overview?tenant_id=${tenantId}&days=7`, { headers }).then(r => r.json()),
      fetch(`${API}/stats/trend?tenant_id=${tenantId}&days=7`,    { headers }).then(r => r.json()),
      fetch(`${API}/stats/stores?tenant_id=${tenantId}&days=1`,   { headers }).then(r => r.json()),
    ]).then(([ov, tr, st]) => {
      if (ov.detail) { router.push("/login"); return }
      setOverview(ov)
      setTrend(tr.map((d: any) => ({ ...d, date: d.date.slice(5) })))
      setStores(st)
      setLoading(false)
    }).catch(() => router.push("/login"))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
  }

  /* 加载态 */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f2f2f7" }}>
      <div className="text-center">
        <div
          className="w-10 h-10 rounded-full animate-spin mx-auto mb-4"
          style={{ border: "3px solid rgba(0,113,227,0.18)", borderTopColor: "#0071e3" }}
        />
        <p className="text-sm font-medium" style={{ color: "#8e8e93" }}>加载中…</p>
      </div>
    </div>
  )

  const ACCENTS = ["#0071e3", "#30d158", "#bf5af2", "#ff9f0a"]
  const metrics = overview ? [
    {
      label: "近 7 日 GMV",
      value: `¥${(overview.gmv / 10000).toFixed(1)}万`,
      change: `${Math.abs(overview.gmv_change)}%`,
      up: overview.gmv_change >= 0,
      accent: ACCENTS[0],
    },
    {
      label: "近 7 日净利润",
      value: `¥${(overview.profit / 10000).toFixed(1)}万`,
      change: `${Math.abs(overview.profit_change)}%`,
      up: overview.profit_change >= 0,
      accent: ACCENTS[1],
    },
    {
      label: "近 7 日订单数",
      value: overview.orders.toLocaleString(),
      change: `${Math.abs(overview.orders_change)}%`,
      up: overview.orders_change >= 0,
      accent: ACCENTS[2],
    },
    {
      label: "平均 ROI",
      value: overview.roi.toFixed(2),
      change: "近 7 日",
      up: true,
      accent: ACCENTS[3],
    },
  ] : []

  const barH = Math.max(220, stores.length * 56)

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f2f2f7" }}>
      <NavBar user={user} onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* 页头 */}
        <div className="mb-8">
          <h1
            className="font-bold"
            style={{ color: "#1d1d1f", fontSize: 30, letterSpacing: "-0.04em" }}
          >
            经营概览
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "#8e8e93" }}>近 7 天核心指标一览</p>
        </div>

        {/* 指标卡 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {metrics.map(item => <MetricCard key={item.label} {...item} />)}
        </div>

        {/* 图表卡 */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          {/* Tab 选择器 */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #f2f2f7" }}>
            <div
              className="flex items-center gap-1 p-1 rounded-xl"
              style={{ backgroundColor: "#f2f2f7" }}
            >
              {([
                { key: "trend",  label: "趋势总览" },
                { key: "stores", label: "今日店铺" },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-4 py-1.5 rounded-lg text-sm"
                  style={{
                    backgroundColor: activeTab === tab.key ? "#fff" : "transparent",
                    color:           activeTab === tab.key ? "#1d1d1f" : "#6e6e73",
                    boxShadow:       activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                    fontWeight:      activeTab === tab.key ? 600 : 400,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* ── 趋势总览 ─────────────────── */}
            {activeTab === "trend" && (
              <div>
                {/* 图例 */}
                <div className="flex items-center gap-5 mb-5">
                  {[
                    { color: "#0071e3", label: "GMV" },
                    { color: "#30d158", label: "净利润" },
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
                      <linearGradient id="gGmv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#0071e3" stopOpacity={0.20} />
                        <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#30d158" stopOpacity={0.20} />
                        <stop offset="100%" stopColor="#30d158" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#ff9f0a" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#ff9f0a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#aeaeb2" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#aeaeb2" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => `${(v / 10000).toFixed(0)}万`}
                      width={44}
                    />
                    <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(0,0,0,0.07)", strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="gmv"     stroke="#0071e3" strokeWidth={2.5}
                      name="GMV"   fill="url(#gGmv)"    dot={false}
                      activeDot={{ r: 5, fill: "#0071e3", strokeWidth: 2, stroke: "#fff" }} />
                    <Area type="monotone" dataKey="profit"  stroke="#30d158" strokeWidth={2.5}
                      name="净利润" fill="url(#gProfit)" dot={false}
                      activeDot={{ r: 5, fill: "#30d158", strokeWidth: 2, stroke: "#fff" }} />
                    <Area type="monotone" dataKey="ad_cost" stroke="#ff9f0a" strokeWidth={1.5}
                      name="广告费" fill="url(#gAd)"     dot={false} strokeDasharray="5 3"
                      activeDot={{ r: 4, fill: "#ff9f0a", strokeWidth: 2, stroke: "#fff" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── 今日店铺 ─────────────────── */}
            {activeTab === "stores" && (
              <div>
                <p className="text-xs font-semibold mb-5 uppercase tracking-wide" style={{ color: "#8e8e93", letterSpacing: "0.05em" }}>
                  今日各店铺 GMV
                </p>
                <ResponsiveContainer width="100%" height={barH}>
                  <BarChart
                    data={stores} layout="vertical"
                    margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
                    barSize={28}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#aeaeb2" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category" dataKey="name"
                      tick={{ fontSize: 12, fill: "#3a3a3c", fontWeight: 500 }}
                      width={100} axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="gmv" radius={[0, 8, 8, 0]} name="GMV">
                      {stores.map((s, i) => (
                        <Cell key={i} fill={(PLATFORM[s.platform] || PLATFORM.other).color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* 店铺明细列表 */}
                <div className="mt-6 rounded-xl overflow-hidden" style={{ border: "1px solid #f2f2f7" }}>
                  {stores.map((s, i) => {
                    const p = PLATFORM[s.platform] || PLATFORM.other
                    return (
                      <div
                        key={s.store_id}
                        className="flex items-center justify-between px-4 py-3.5"
                        style={{
                          borderBottom: i < stores.length - 1 ? "1px solid #f2f2f7" : "none",
                          cursor: "default",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#fafafa")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                            style={{ backgroundColor: p.bg, color: p.color }}
                          >
                            {p.label}
                          </span>
                          <span className="text-sm font-medium" style={{ color: "#1d1d1f" }}>{s.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: "#1d1d1f" }}>
                            ¥{s.gmv.toLocaleString()}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "#8e8e93" }}>
                            ROI{" "}
                            <span style={{ color: "#ff9f0a", fontWeight: 700 }}>{s.roi}</span>
                            {" · "}利润{" "}
                            <span style={{ color: "#30d158", fontWeight: 700 }}>¥{s.profit.toLocaleString()}</span>
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
