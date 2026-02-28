"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

const API = "http://localhost:8000/api/v1"

const platformLabel: Record<string, string> = {
  taobao: "天猫", jd: "京东", pdd: "拼多多", shopify: "独立站"
}
const platformColor: Record<string, string> = {
  taobao: "bg-orange-100 text-orange-700",
  jd: "bg-red-100 text-red-700",
  pdd: "bg-green-100 text-green-700",
  shopify: "bg-purple-100 text-purple-700",
}

export default function FinancePage() {
  const router = useRouter()
  const [summary, setSummary] = useState<any>(null)
  const [roi, setRoi] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>([])
  const [days, setDays] = useState(30)
  const [user, setUser] = useState<any>(null)

  const fetchData = async (d: number) => {
    const token = localStorage.getItem("token")
    if (!token) { router.push("/login"); return }
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const [s, r, t] = await Promise.all([
        fetch(`${API}/finance/summary?days=${d}`, { headers }).then(res => res.json()),
        fetch(`${API}/finance/roi-analysis?days=${d}`, { headers }).then(res => res.json()),
        fetch(`${API}/finance/profit-trend?days=${d}`, { headers }).then(res => res.json()),
      ])
      if (s.detail === "登录已过期，请重新登录") { router.push("/login"); return }
      setSummary(s); setRoi(r)
      setTrend(t.map((x: any) => ({ ...x, date: x.date.slice(5) })))
    } catch { router.push("/login") }
  }

  useEffect(() => {
    const u = localStorage.getItem("user")
    if (u) setUser(JSON.parse(u))
    fetchData(days)
  }, [])

  if (!summary) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      <p>📊 财务数据加载中...</p>
    </div>
  )

  // 盈亏结构数据
  const waterfallData = [
    { name: "GMV", value: summary.gmv, fill: "#6366f1" },
    { name: "退款", value: -summary.refund, fill: "#ef4444" },
    { name: "货品成本", value: -summary.goods_cost, fill: "#f59e0b" },
    { name: "平台佣金", value: -summary.platform_fee, fill: "#8b5cf6" },
    { name: "广告费", value: -summary.ad_cost, fill: "#ec4899" },
    { name: "净利润", value: summary.net_profit, fill: "#22c55e" },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💰 财务分析</h1>
            <p className="text-gray-500 text-sm mt-1">{user?.tenant_name} · {user?.full_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={e => { const d = Number(e.target.value); setDays(d); fetchData(d) }}
              className="border rounded-md px-3 py-1.5 text-sm"
            >
              <option value={7}>近7天</option>
              <option value={30}>近30天</option>
              <option value={60}>近60天</option>
              <option value={90}>近90天</option>
            </select>
            <button onClick={() => router.push("/")} className="text-sm text-indigo-600 hover:underline">
              ← 返回看板
            </button>
          </div>
        </div>

        {/* 核心财务指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "总GMV", value: `¥${(summary.gmv / 10000).toFixed(1)}万` },
            { label: "净利润", value: `¥${(summary.net_profit / 10000).toFixed(1)}万`, green: true },
            { label: "利润率", value: `${summary.profit_rate}%`, green: true },
            { label: "客单价", value: `¥${summary.avg_order_value}` },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-2xl font-bold mt-1 ${item.green ? "text-green-600" : ""}`}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="breakdown">
          <TabsList className="mb-4">
            <TabsTrigger value="breakdown">盈亏结构</TabsTrigger>
            <TabsTrigger value="roi">广告ROI</TabsTrigger>
            <TabsTrigger value="trend">利润趋势</TabsTrigger>
          </TabsList>

          {/* 盈亏结构 */}
          <TabsContent value="breakdown">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">收支明细（近{days}天）</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={waterfallData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 10000).toFixed(0)}万`} />
                      <Tooltip formatter={(v: number) => `¥${Math.abs(v).toLocaleString()}`} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {waterfallData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">成本拆分</CardTitle></CardHeader>
                <CardContent className="space-y-3 pt-2">
                  {[
                    { label: "GMV", value: summary.gmv, color: "bg-indigo-500" },
                    { label: "退款损失", value: summary.refund, color: "bg-red-400" },
                    { label: "货品成本（估40%）", value: summary.goods_cost, color: "bg-amber-400" },
                    { label: "平台佣金（估5%）", value: summary.platform_fee, color: "bg-purple-400" },
                    { label: "广告费", value: summary.ad_cost, color: "bg-pink-400" },
                    { label: "净利润", value: summary.net_profit, color: "bg-green-500" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                        <span className="text-sm text-gray-600">{item.label}</span>
                      </div>
                      <span className="text-sm font-semibold">¥{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ROI 分析 */}
          <TabsContent value="roi">
            <Card>
              <CardHeader><CardTitle className="text-base">各店铺广告ROI对比（近{days}天）</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={roi}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="roi" fill="#6366f1" radius={[4, 4, 0, 0]} name="ROI" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-3">
                  {roi.map(store => (
                    <div key={store.store_id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge className={platformColor[store.platform] || "bg-gray-100 text-gray-600"}>
                          {platformLabel[store.platform]}
                        </Badge>
                        <span className="text-sm">{store.name}</span>
                      </div>
                      <div className="text-right text-sm">
                        <span className="font-bold text-indigo-600">ROI {store.roi}</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-gray-500">广告占比 {store.ad_ratio}%</span>
                        <span className="text-gray-400 mx-2">·</span>
                        <span className="text-green-600">利润 ¥{(store.profit / 10000).toFixed(1)}万</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 利润趋势 */}
          <TabsContent value="trend">
            <Card>
              <CardHeader><CardTitle className="text-base">每日利润趋势（近{days}天）</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trend}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(trend.length / 7)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 10000).toFixed(0)}万`} />
                    <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                    <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} name="净利润" dot={false} />
                    <Line type="monotone" dataKey="gmv" stroke="#6366f1" strokeWidth={1.5} name="GMV" dot={false} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="ad_cost" stroke="#f59e0b" strokeWidth={1.5} name="广告费" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
