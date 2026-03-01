"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ company_name: "", full_name: "", email: "", password: "", confirm: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (form.password !== form.confirm) { setError("两次密码输入不一致"); return }
    if (form.password.length < 6) { setError("密码至少 6 位"); return }

    setLoading(true)
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
      const res = await fetch(`${BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name,
          full_name: form.full_name,
          email: form.email,
          password: form.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || "注册失败"); return }
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("user", JSON.stringify(data.user))
      router.push("/stores")   // 注册成功 → 引导添加第一个店铺
    } catch { setError("网络错误，请检查后端服务") }
    finally { setLoading(false) }
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: "12px",
    border: "1px solid #d2d2d7", fontSize: "14px", color: "#1d1d1f",
    outline: "none", backgroundColor: "#fff", transition: "border-color 0.15s",
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f5f7" }}>
      <div className="w-full max-w-sm px-4">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ backgroundColor: "#1d1d1f" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" fill="white" fillOpacity="0.9"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: "#1d1d1f", letterSpacing: "-0.02em" }}>创建账号</h1>
          <p className="text-sm mt-1" style={{ color: "#6e6e73" }}>免费试用 14 天，无需绑卡</p>
        </div>

        {/* 表单 */}
        <div className="rounded-2xl p-8" style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1d1d1f" }}>公司 / 品牌名称</label>
              <input value={form.company_name} onChange={e => set("company_name", e.target.value)}
                style={inputStyle} placeholder="例：优品电商" required
                onFocus={e => (e.target.style.borderColor = "#0071e3")}
                onBlur={e => (e.target.style.borderColor = "#d2d2d7")} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1d1d1f" }}>你的姓名</label>
              <input value={form.full_name} onChange={e => set("full_name", e.target.value)}
                style={inputStyle} placeholder="例：张三" required
                onFocus={e => (e.target.style.borderColor = "#0071e3")}
                onBlur={e => (e.target.style.borderColor = "#d2d2d7")} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#1d1d1f" }}>邮箱</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                style={inputStyle} placeholder="your@email.com" required
                onFocus={e => (e.target.style.borderColor = "#0071e3")}
                onBlur={e => (e.target.style.borderColor = "#d2d2d7")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#1d1d1f" }}>密码</label>
                <input type="password" value={form.password} onChange={e => set("password", e.target.value)}
                  style={inputStyle} placeholder="至少 6 位" required
                  onFocus={e => (e.target.style.borderColor = "#0071e3")}
                  onBlur={e => (e.target.style.borderColor = "#d2d2d7")} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#1d1d1f" }}>确认密码</label>
                <input type="password" value={form.confirm} onChange={e => set("confirm", e.target.value)}
                  style={inputStyle} placeholder="再次输入" required
                  onFocus={e => (e.target.style.borderColor = "#0071e3")}
                  onBlur={e => (e.target.style.borderColor = "#d2d2d7")} />
              </div>
            </div>

            {error && (
              <p className="text-sm rounded-xl px-3.5 py-2.5" style={{ color: "#ff3b30", backgroundColor: "#fff2f1" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: loading ? "#aeaeb2" : "#0071e3", color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "注册中..." : "创建账号"}
            </button>
          </form>
        </div>

        {/* 登录入口 */}
        <p className="text-center text-sm mt-5" style={{ color: "#6e6e73" }}>
          已有账号？
          <button onClick={() => router.push("/login")}
            className="font-medium ml-1" style={{ color: "#0071e3" }}>
            直接登录
          </button>
        </p>

      </div>
    </div>
  )
}
