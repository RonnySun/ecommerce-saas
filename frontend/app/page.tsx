"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

const API = "http://localhost:8000/api/v1"

const platformColor: Record<string, string> = {
  taobao: "bg-orange-100 text-orange-700",
  jd: "bg-red-100 text-red-700",
  pdd: "bg-green-100 text-green-700",
  shopify: "bg-purple-100 text-purple-700",
}
const platformLabel: Record<string, string> = {
  taobao: "天猫", jd: "京东", pdd: "拼多多", shopify: "独立站"
}

export default function Dashboard() {
  const router = useRouter()
  const [overview, setOverview] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const u = localStorage.getItem("user")
    if (!token) { router.push("/login"); return }
    if (u) setUser(JSON.parse(u))

    const tenantId = JSON.parse(u || "{}").tenant_id || 1
    const headers = { Authorization: `Bearer ${token}` }

    Promise.all([
      fetch(`${API}/stats/overview?tenant_id=${tenantId}&days=7`, { headers }).then(r => r.json()),
      fetch(`${API}/stats/trend?tenant_id=${tenantId}&days=7`, { headers }).then(r => r.json()),
      fetch(`${API}/stats/stores?tenant_id=${tenantId}&days=1`, { headers }).then(r => r.json()),
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      <p>📊 数据加载中...</p>
    </div>
  )

  const metrics = overview ? [
    { label: "近7日总GMV", value: `¥${(overview.gmv / 10000).toFixed(1)}万`, change: `${overview.gmv_change > 0 ? "+" : ""}${overview.gmv_change}%`, up: overview.gmv_change >= 0 },
    { label: "近7日净利润", value: `¥${(overview.profit / 10000).toFixed(1)}万`, change: `${overview.profit_change > 0 ? "+" : ""}${overview.profit_change}%`, up: overview.profit_change >= 0 },
    { label: "近7日订单数", value: overview.orders.toLocaleString(), change: `${overview.orders_change > 0 ? "+" : ""}${overview.orders_change}%`, up: overview.orders_change >= 0 },
    { label: "平均ROI", value: overview.roi.toFixed(2), change: "近7日", up: true },
  ] : []

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 多店铺经营看板</h1>
            <p className="text-gray-500 text-sm mt-1">
              {user?.tenant_name} · {user?.full_name}
              <Badge className="ml-2 text-xs bg-indigo-100 text-indigo-700">{user?.plan}</Badge>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/finance")}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
            >
              💰 财务分析
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border text-sm rounded-md hover:bg-gray-100"
            >
              退出
            </button>
          </div>
        </div>

        {/* 核心指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {metrics.map(item => (
            <Card key={item.label}>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-2xl font-bold mt-1">{item.value}</p>
                <p className={`text-xs mt-1 ${item.up ? "text-green-600" : "text-red-500"}`}>
                  {item.change} 较上期
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="trend">
          <TabsList className="mb-4">
            <TabsTrigger value="trend">趋势总览</TabsTrigger>
            <TabsTrigger value="stores">今日店铺</TabsTrigger>
          </TabsList>

          <TabsContent value="trend">
            <Card>
              <CardHeader><CardTitle className="text-base">近7天 GMV / 利润 / 广告费趋势</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trend}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 10000).toFixed(0)}万`} />
                    <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                    <Line type="monotone" dataKey="gmv" stroke="#6366f1" strokeWidth={2} name="GMV" dot={false} />
                    <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} name="净利润" dot={false} />
                    <Line type="monotone" dataKey="ad_cost" stroke="#f59e0b" strokeWidth={2} name="广告费" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stores">
            <Card>
              <CardHeader><CardTitle className="text-base">今日各店铺数据</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stores} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                    <Bar dataKey="gmv" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {stores.map(store => (
                    <div key={store.store_id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge className={platformColor[store.platform] || "bg-gray-100 text-gray-600"}>
                          {platformLabel[store.platform] || store.platform}
                        </Badge>
                        <span className="text-sm">{store.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">¥{store.gmv.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">ROI: {store.roi} · 利润: ¥{store.profit.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
