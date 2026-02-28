"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("owner@youpin.com")
  const [password, setPassword] = useState("demo123")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || "登录失败"); return }
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("user", JSON.stringify(data.user))
      router.push("/")
    } catch {
      setError("网络错误，请检查后端服务")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">📊 电商SaaS平台</CardTitle>
          <p className="text-gray-500 text-sm mt-1">多店铺经营数据管理</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">邮箱</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">密码</label>
              <input
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
          <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-500">
            <p className="font-medium mb-1">演示账号：</p>
            <p>owner@youpin.com / demo123（优品电商·老板）</p>
            <p>finance@youpin.com / demo123（优品电商·财务）</p>
            <p>owner@legou.com / demo123（乐购网络·老板）</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
