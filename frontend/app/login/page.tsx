"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

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
      const res = await fetch(`/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || "邮箱或密码错误"); return }
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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f5f7" }}>
      <div className="w-full max-w-sm px-4">

        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ backgroundColor: "#1d1d1f" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"
                fill="white" fillOpacity="0.9"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: "#1d1d1f", letterSpacing: "-0.02em" }}>
            多店铺经营管理
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6e6e73" }}>登录以继续</p>
        </div>

        {/* 登录卡片 */}
        <div className="rounded-2xl p-8" style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1d1d1f" }}>邮箱</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all outline-none"
                style={{
                  border: "1px solid #d2d2d7",
                  color: "#1d1d1f",
                  backgroundColor: "#fff",
                }}
                onFocus={e => e.target.style.borderColor = "#0071e3"}
                onBlur={e => e.target.style.borderColor = "#d2d2d7"}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1d1d1f" }}>密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all outline-none"
                style={{
                  border: "1px solid #d2d2d7",
                  color: "#1d1d1f",
                  backgroundColor: "#fff",
                }}
                onFocus={e => e.target.style.borderColor = "#0071e3"}
                onBlur={e => e.target.style.borderColor = "#d2d2d7"}
              />
            </div>

            {error && (
              <p className="text-sm rounded-xl px-3.5 py-2.5" style={{ color: "#ff3b30", backgroundColor: "#fff2f1" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: loading ? "#6e6e73" : "#0071e3",
                color: "#ffffff",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "验证中..." : "登录"}
            </button>
          </form>
        </div>

        {/* 演示账号 */}
        <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: "#ffffff", border: "1px solid #e5e5ea" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "#6e6e73" }}>演示账号</p>
          {[
            { email: "owner@youpin.com", name: "优品电商 · 老板" },
            { email: "finance@youpin.com", name: "优品电商 · 财务" },
            { email: "owner@legou.com", name: "乐购网络 · 老板" },
          ].map(acc => (
            <button
              key={acc.email}
              onClick={() => { setEmail(acc.email); setPassword("demo123") }}
              className="w-full text-left px-3 py-2 rounded-lg mb-1 last:mb-0 transition-colors"
              style={{ color: "#1d1d1f" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f5f5f7")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <span className="text-xs font-medium" style={{ color: "#0071e3" }}>{acc.name}</span>
              <span className="text-xs ml-2" style={{ color: "#6e6e73" }}>{acc.email}</span>
            </button>
          ))}
          <p className="text-xs mt-2" style={{ color: "#aeaeb2" }}>密码均为 demo123</p>
        </div>

        {/* 注册入口 */}
        <p className="text-center text-sm mt-5" style={{ color: "#6e6e73" }}>
          没有账号？
          <button
            onClick={() => router.push("/register")}
            className="font-medium ml-1"
            style={{ color: "#0071e3", background: "none", border: "none", cursor: "pointer" }}
          >
            免费注册
          </button>
        </p>

      </div>
    </div>
  )
}
