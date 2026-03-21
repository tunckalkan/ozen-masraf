"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

type Profile = {
  id: string
  full_name: string
  email: string | null
  department_id: number | null
  role_id: number | null
}

export default function Page() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [email, setEmail] = useState("test@ozeniplik.com")
  const [password, setPassword] = useState("123456")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const [expenseDate, setExpenseDate] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [expenses, setExpenses] = useState<any[]>([])

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data } = await supabase.auth.getUser()
        const currentUser = data.user ?? null

        if (!mounted) return

        if (currentUser) {
          setUser(currentUser)
          await loadProfile(currentUser.id)
          await loadExpenses(currentUser.id)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setBooting(false)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null

      if (!mounted) return

      if (currentUser) {
        setUser(currentUser)
        await loadProfile(currentUser.id)
        await loadExpenses(currentUser.id)
      } else {
        setUser(null)
        setProfile(null)
        setExpenses([])
      }

      setBooting(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, department_id, role_id")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("Profile error:", error)
      setProfile(null)
      setMessage("Profil alınamadı.")
      return
    }

    setProfile(data)
  }

  async function loadExpenses(userId: string) {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Expense error:", error)
      return
    }

    setExpenses(data || [])
  }

  function roleName(roleId?: number | null) {
    if (roleId === 1) return "Personel"
    if (roleId === 2) return "Muhasebe"
    if (roleId === 3) return "Yönetici"
    if (roleId === 4) return "Admin"
    return "-"
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error || !data.user) {
        setMessage("Giriş hatası.")
        return
      }

      setUser(data.user)
      await loadProfile(data.user.id)
      await loadExpenses(data.user.id)
      setMessage("Giriş başarılı.")
    } catch (err) {
      console.error(err)
      setMessage("Giriş sırasında hata oluştu.")
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setLoading(true)
    setMessage("")

    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setExpenses([])
      setMessage("Çıkış yapıldı.")
    } catch (err) {
      console.error(err)
      setMessage("Çıkış yapılamadı.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")

    if (!user || !profile) {
      setMessage("Önce giriş yapmalısınız.")
      return
    }

    if (!expenseDate || !description || !amount) {
      setMessage("Tarih, açıklama ve tutar zorunlu.")
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.from("expenses").insert([
        {
          user_id: user.id,
          expense_date: expenseDate,
          vendor_name: vendorName || null,
          description,
          amount: Number(amount),
          currency_code: "TRY",
          payment_type: "personal_card",
          status: "submitted",
          department_id: profile.department_id || 1,
          category_id: 1,
        },
      ])

      if (error) {
        console.error(error)
        setMessage("Masraf kaydedilemedi.")
        return
      }

      setExpenseDate("")
      setVendorName("")
      setDescription("")
      setAmount("")
      setMessage("Masraf kaydedildi.")
      await loadExpenses(user.id)
    } catch (err) {
      console.error(err)
      setMessage("Masraf kaydı sırasında hata oluştu.")
    } finally {
      setLoading(false)
    }
  }

  if (booting) {
    return <div style={{ padding: 40, fontFamily: "Arial" }}>Yükleniyor...</div>
  }

  if (!user || !profile) {
    return (
      <div style={{ maxWidth: 420, margin: "60px auto", fontFamily: "Arial" }}>
        <h1>MASRAF SİSTEMİ</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Şifre</label>
            <input
              type="password"
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} style={{ padding: "12px 18px" }}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        {message && <div style={{ marginTop: 16 }}>{message}</div>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "Arial" }}>
      <h1>MASRAF SİSTEMİ</h1>

      <div style={{ marginBottom: 20 }}>
        <strong>Hoş geldiniz:</strong> {profile.full_name}
        <br />
        <strong>Rol:</strong> {roleName(profile.role_id)}
      </div>

      <button onClick={handleLogout} disabled={loading} style={{ marginBottom: 24 }}>
        Çıkış Yap
      </button>

      <form onSubmit={handleSave} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 24 }}>
        <h3>Yeni Masraf</h3>

        <div style={{ marginBottom: 12 }}>
          <label>Tarih</label>
          <input
            type="date"
            style={{ width: "100%", padding: 12, marginTop: 6 }}
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Firma</label>
          <input
            style={{ width: "100%", padding: 12, marginTop: 6 }}
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Açıklama</label>
          <textarea
            style={{ width: "100%", padding: 12, marginTop: 6, minHeight: 100 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Tutar</label>
          <input
            type="number"
            style={{ width: "100%", padding: 12, marginTop: 6 }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>

      <div style={{ border: "1px solid #ddd", padding: 16 }}>
        <h3>Masraflarım</h3>

        {expenses.length === 0 ? (
          <div>Kayıt yok.</div>
        ) : (
          expenses.map((item) => (
            <div key={item.id} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
              <div><strong>{item.description}</strong></div>
              <div>{item.expense_date}</div>
              <div>{item.amount} TRY</div>
              <div>{item.status}</div>
            </div>
          ))
        )}
      </div>

      {message && <div style={{ marginTop: 16 }}>{message}</div>}
    </div>
  )
}