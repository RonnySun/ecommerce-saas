"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"

// 从模拟数据文件加载（后续替换为API调用）
const mockStats = [
  { date: "02-23", gmv: 218320, profit: 42100, adCost: 28500 },
  { date: "02-24", gmv: 195800, profit: 38200, adCost: 24100 },
  { date: "02-25", gmv: 267400, profit: 51800, adCost: 33200 },
  { date: "02-26", gmv: 289100, profit: 56300, adCost: 38900 },
  { date: "02-27", gmv: 243600, profit: 47200, adCost: 31400 },
  { date: "02-28", gmv: 312000, profit: 61500, adCost: 42100 },
  { date: "03-01", gmv: 218319, profit: 38000, adCost: 29800 },
]

const storeData = [
  { name: "天猫旗舰店", gmv: 80901, roi: 4.2, platform: "taobao" },
  { name: "京东自营店", gmv: 60479, roi: 3.8, platform: "jd" },
  { name: "拼多多店", gmv: 27210, roi: 2.1, platform: "pdd" },
  { name: "乐购天猫店", gmv: 35293, roi: 3.5, platform: "taobao" },
  { name: "乐购独立站", gmv: 14435, roi: 5.1, platform: "shopify" },
]

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
  const todayGMV = storeData.reduce((s, i) => s + i.gmv, 0)
  const todayProfit = mockStats[mockStats.length - 1].profit

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 顶部标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📊 多店铺经营看板</h1>
        <p className="text-gray-500 text-sm mt-1">今日数据 · 2026-03-01</p>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "今日总GMV", value: `¥${(todayGMV/10000).toFixed(1)}万`, change: "+12.3%", up: true },
          { label: "今日净利润", value: `¥${(todayProfit/10000).toFixed(1)}万`, change: "+8.7%", up: true },
          { label: "总订单数", value: "1,284", change: "+5.2%", up: true },
          { label: "平均ROI", value: "3.74", change: "-0.3", up: false },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-2xl font-bold mt-1">{item.value}</p>
              <p className={`text-xs mt-1 ${item.up ? "text-green-600" : "text-red-500"}`}>
                {item.change} 较昨日
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">趋势总览</TabsTrigger>
          <TabsTrigger value="stores">店铺对比</TabsTrigger>
        </TabsList>

        {/* 趋势图 */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">近7天GMV & 利润趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={mockStats}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/10000).toFixed(0)}万`} />
                  <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                  <Line type="monotone" dataKey="gmv" stroke="#6366f1" strokeWidth={2} name="GMV" dot={false} />
                  <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} name="净利润" dot={false} />
                  <Line type="monotone" dataKey="adCost" stroke="#f59e0b" strokeWidth={2} name="广告费" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 店铺对比 */}
        <TabsContent value="stores">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">今日各店铺GMV</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={storeData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                  <Bar dataKey="gmv" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* 店铺列表 */}
              <div className="mt-4 space-y-2">
                {storeData.map((store) => (
                  <div key={store.name} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge className={platformColor[store.platform]}>
                        {platformLabel[store.platform]}
                      </Badge>
                      <span className="text-sm">{store.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">¥{store.gmv.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">ROI: {store.roi}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
