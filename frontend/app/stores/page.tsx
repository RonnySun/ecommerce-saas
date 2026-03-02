"use client"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

const API = "/api/v1"

const PLATFORMS = [
  { value: "taobao",  label: "淘宝 / 天猫" },
  { value: "jd",      label: "京东" },
  { value: "pdd",     label: "拼多多" },
  { value: "shopify", label: "独立站 / Shopify" },
  { value: "other",   label: "其他平台" },
]

const PLATFORM: Record<string, { color: string; bg: string; label: string }> = {
  taobao:  { color: "#ff6200", bg: "#fff3ec", label: "天猫" },
  jd:      { color: "#d4121e", bg: "#fff1f1", label: "京东" },
  pdd:     { color: "#e0272b", bg: "#fff1f1", label: "拼多多" },
  shopify: { color: "#5e9e3e", bg: "#f0f9e8", label: "独立站" },
  other:   { color: "#8e8e93", bg: "#f5f5f7", label: "其他" },
}

/* ── NavBar ───────────────────────────────── */
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

/* ── 新建/编辑弹窗 ──────────────────────── */
function StoreModal({ store, onClose, onSave }: {
  store: any | null; onClose: () => void; onSave: () => void
}) {
  const [form, setForm] = useState({
    name:        store?.name        || "",
    platform:    store?.platform    || "taobao",
    external_id: store?.external_id || "",
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError("")
    const token = localStorage.getItem("token")
    try {
      const url    = store ? `${API}/stores/${store.id}` : `${API}/stores`
      const method = store ? "PUT" : "POST"
      const res  = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || "操作失败"); return }
      onSave()
    } catch { setError("网络错误") }
    finally { setLoading(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.36)", backdropFilter: "blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm mx-4 rounded-2xl p-7"
        style={{ backgroundColor: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.20),0 4px 16px rgba(0,0,0,0.08)" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold" style={{ color: "#1d1d1f" }}>
            {store ? "编辑店铺" : "添加店铺"}
          </h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#f2f2f7", color: "#8e8e93" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#e5e5ea")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#f2f2f7")}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase" style={{ color: "#8e8e93", letterSpacing: "0.04em" }}>
              店铺名称
            </label>
            <input
              value={form.name} required
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm"
              style={{ border: "1px solid #e5e5ea", color: "#1d1d1f", outline: "none", backgroundColor: "#fff" }}
              placeholder="例：张三旗舰店"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase" style={{ color: "#8e8e93", letterSpacing: "0.04em" }}>
              所在平台
            </label>
            <select
              value={form.platform}
              onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm"
              style={{ border: "1px solid #e5e5ea", color: "#1d1d1f", outline: "none", backgroundColor: "#fff", cursor: "pointer" }}
            >
              {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase" style={{ color: "#8e8e93", letterSpacing: "0.04em" }}>
              平台 ID <span style={{ color: "#aeaeb2", fontWeight: 400, textTransform: "none" }}>（可选）</span>
            </label>
            <input
              value={form.external_id}
              onChange={e => setForm(p => ({ ...p, external_id: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm"
              style={{ border: "1px solid #e5e5ea", color: "#1d1d1f", outline: "none", backgroundColor: "#fff" }}
              placeholder="用于后续对接平台 API"
            />
          </div>

          {error && (
            <p className="text-xs rounded-xl px-3.5 py-2.5" style={{ color: "#ff453a", backgroundColor: "#fff1f0" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: "1px solid #e5e5ea", color: "#6e6e73" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f5f5f7")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
              取消
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: loading ? "#aeaeb2" : "#0071e3" }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#0077ed"
                  e.currentTarget.style.transform = "translateY(-1px)"
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,113,227,0.4)"
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = loading ? "#aeaeb2" : "#0071e3"
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "none"
              }}>
              {loading ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── 主页面 ───────────────────────────────── */
export default function StoresPage() {
  const router = useRouter()
  const [stores,  setStores]  = useState<any[]>([])
  const [user,    setUser]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<{ open: boolean; store: any | null }>({ open: false, store: null })
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const isFirstVisit = stores.filter(s => s.is_active).length === 0 && !loading

  useEffect(() => {
    const token = localStorage.getItem("token")
    const u     = localStorage.getItem("user")
    if (!token) { router.push("/login"); return }
    if (u) setUser(JSON.parse(u))
    fetchStores()
  }, [])

  const fetchStores = async () => {
    const token = localStorage.getItem("token")
    try {
      const res  = await fetch(`${API}/stores`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setStores(data)
    } finally { setLoading(false) }
  }

  const handleToggleActive = async (store: any) => {
    const token = localStorage.getItem("token")
    await fetch(`${API}/stores/${store.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !store.is_active }),
    })
    fetchStores()
  }

  const handleDelete = async (id: number) => {
    const token = localStorage.getItem("token")
    await fetch(`${API}/stores/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setDeleteId(null)
    fetchStores()
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f2f2f7" }}>
      <NavBar user={user} />

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* 页头 */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-bold" style={{ color: "#1d1d1f", fontSize: 30, letterSpacing: "-0.04em" }}>
              店铺管理
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "#8e8e93" }}>
              管理你的所有电商店铺
              {stores.length > 0 && <span style={{ color: "#aeaeb2" }}> · 共 {stores.length} 个</span>}
            </p>
          </div>
          <button
            onClick={() => setModal({ open: true, store: null })}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-1.5"
            style={{ backgroundColor: "#0071e3", boxShadow: "0 2px 8px rgba(0,113,227,0.30)" }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "#0077ed"
              e.currentTarget.style.transform = "translateY(-1px)"
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,113,227,0.40)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "#0071e3"
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,113,227,0.30)"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            添加店铺
          </button>
        </div>

        {/* 空状态引导 */}
        {isFirstVisit && (
          <div
            className="rounded-2xl p-10 text-center mb-6"
            style={{
              background: "linear-gradient(135deg,#f0f6ff 0%,#e8f0fe 100%)",
              border: "1.5px dashed rgba(0,113,227,0.35)",
            }}
          >
            <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0071e3,#42a1ec)", boxShadow: "0 6px 20px rgba(0,113,227,0.35)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 22V12h6v10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-lg font-bold mb-1.5" style={{ color: "#1d1d1f" }}>添加你的第一个店铺</p>
            <p className="text-sm mb-6" style={{ color: "#6e6e73" }}>
              添加店铺后，导入数据时将自动归属到对应店铺
            </p>
            <button
              onClick={() => setModal({ open: true, store: null })}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white inline-flex items-center gap-1.5"
              style={{ backgroundColor: "#0071e3", boxShadow: "0 4px 12px rgba(0,113,227,0.35)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#0077ed"; e.currentTarget.style.transform = "translateY(-1px)" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#0071e3"; e.currentTarget.style.transform = "translateY(0)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              立即添加
            </button>
          </div>
        )}

        {/* 店铺列表 */}
        {stores.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)" }}>
            {stores.map((store, i) => {
              const p = PLATFORM[store.platform] || PLATFORM.other
              return (
                <div
                  key={store.id}
                  className="flex items-center justify-between px-5 py-4"
                  style={{
                    borderBottom: i < stores.length - 1 ? "1px solid #f2f2f7" : "none",
                    opacity: store.is_active ? 1 : 0.5,
                    cursor: "default",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {/* 左侧：头像 + 信息 */}
                  <div className="flex items-center gap-4">
                    {/* 平台色头像 */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
                      style={{ backgroundColor: p.bg, color: p.color }}
                    >
                      {store.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <p className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>{store.name}</p>
                        {!store.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                            style={{ backgroundColor: "#f2f2f7", color: "#aeaeb2" }}>已停用</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                          style={{ backgroundColor: p.bg, color: p.color }}>
                          {p.label}
                        </span>
                        <span className="text-xs" style={{ color: "#aeaeb2" }}>
                          创建于 {store.created_at?.slice(0, 10) || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 右侧：操作按钮 */}
                  <div className="flex items-center gap-2">
                    {/* 编辑 */}
                    <button
                      onClick={() => setModal({ open: true, store })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ color: "#6e6e73", border: "1px solid #e5e5ea", backgroundColor: "transparent" }}
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
                      编辑
                    </button>

                    {/* 启用/停用 */}
                    <button
                      onClick={() => handleToggleActive(store)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        color:           store.is_active ? "#d46b08" : "#1a7f3c",
                        border:          `1px solid ${store.is_active ? "#ffe7ba" : "#d9f7be"}`,
                        backgroundColor: store.is_active ? "#fffbe6" : "#f6ffed",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                    >
                      {store.is_active ? "停用" : "启用"}
                    </button>

                    {/* 删除确认 */}
                    {deleteId === store.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium" style={{ color: "#ff453a" }}>确认删除？</span>
                        <button onClick={() => handleDelete(store.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: "#ff453a" }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                          删除
                        </button>
                        <button onClick={() => setDeleteId(null)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: "#f2f2f7", color: "#6e6e73" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#e5e5ea")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#f2f2f7")}>
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteId(store.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ color: "#aeaeb2", backgroundColor: "transparent" }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = "#fff1f0"
                          e.currentTarget.style.color = "#ff453a"
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = "transparent"
                          e.currentTarget.style.color = "#aeaeb2"
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 底部操作提示 */}
        {stores.filter(s => s.is_active).length > 0 && (
          <div
            className="mt-4 px-5 py-4 rounded-2xl flex items-center justify-between"
            style={{ backgroundColor: "#fff", border: "1px solid #f2f2f7", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            <p className="text-sm" style={{ color: "#6e6e73" }}>
              已有{" "}
              <span style={{ color: "#1d1d1f", fontWeight: 600 }}>
                {stores.filter(s => s.is_active).length}
              </span>{" "}
              个活跃店铺，可以开始导入数据或查看看板
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/import")}
                className="px-4 py-1.5 rounded-xl text-sm font-medium"
                style={{ border: "1px solid #e5e5ea", color: "#3a3a3c" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f5f5f7"; e.currentTarget.style.borderColor = "#c5c5ca" }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "#e5e5ea" }}
              >
                导入数据
              </button>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-1.5 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: "#0071e3" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#0077ed"; e.currentTarget.style.transform = "translateY(-1px)" }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#0071e3"; e.currentTarget.style.transform = "translateY(0)" }}
              >
                查看看板
              </button>
            </div>
          </div>
        )}
      </div>

      {modal.open && (
        <StoreModal
          store={modal.store}
          onClose={() => setModal({ open: false, store: null })}
          onSave={() => { setModal({ open: false, store: null }); fetchStores() }}
        />
      )}
    </div>
  )
}
