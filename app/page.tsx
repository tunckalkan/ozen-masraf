"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import * as XLSX from "xlsx"
import { supabase } from "../lib/supabaseClient"

type Department = { id: number; name: string }
type Category = { id: number; name: string }
type ExpenseFile = { file_url: string | null; file_name: string }

type Expense = {
  id: number
  expense_no: string
  expense_date: string
  vendor_name: string | null
  description: string
  amount: number
  currency_code: string
  payment_type: string
  status: string
  created_at: string
  user_id: string
  departments: { name: string }[] | null
  categories: { name: string }[] | null
  expense_files: ExpenseFile[] | null
}

type Profile = {
  id: string
  full_name: string
  email: string | null
  department_id: number | null
  role_id: number | null
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [email, setEmail] = useState("test@ozeniplik.com")
  const [password, setPassword] = useState("123456")

  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  const [departmentId, setDepartmentId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [expenseDate, setExpenseDate] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [currencyCode, setCurrencyCode] = useState("TRY")
  const [paymentType, setPaymentType] = useState("personal_card")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  const isPersonel = profile?.role_id === 1
  const isMuhasebe = profile?.role_id === 2
  const isYonetici = profile?.role_id === 3
  const isAdmin = profile?.role_id === 4

  const canApproveReject = isMuhasebe || isAdmin
  const canSeeAllExpenses = isMuhasebe || isYonetici || isAdmin

  // -------- AUTH INIT (STABİL) --------
  useEffect(() => {
    let active = true

    const init = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        if (!active) return

        setSession(currentSession)

        if (currentSession?.user?.id) {
          await loadAll(currentSession.user.id)
        }
      } catch (e) {
        console.error("init error:", e)
      } finally {
        if (active) setAuthReady(true)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!active) return

      setSession(currentSession)

      if (currentSession?.user?.id) {
        await loadAll(currentSession.user.id)
      } else {
        setProfile(null)
        setExpenses([])
      }

      setAuthReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadAll(userId: string) {
    const p = await fetchProfile(userId)
    await fetchInitialData(p)
    if (p) await fetchExpenses(userId, p)
  }

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, department_id, role_id")
      .eq("id", userId)
      .maybeSingle()

    if (error || !data) {
      setProfile(null)
      setMessage("Profil bulunamadı.")
      return null
    }

    setProfile(data)
    if (data.department_id) setDepartmentId(String(data.department_id))
    return data as Profile
  }

  async function fetchInitialData(currentProfile?: Profile | null) {
    const { data: d } = await supabase.from("departments").select("id, name").eq("is_active", true)
    const { data: c } = await supabase.from("categories").select("id, name").eq("is_active", true)

    setDepartments(d || [])
    setCategories(c || [])

    if (currentProfile?.department_id) {
      setDepartmentId(String(currentProfile.department_id))
    } else if (d?.length) {
      setDepartmentId(String(d[0].id))
    }

    if (c?.length) setCategoryId(String(c[0].id))
  }

  async function fetchExpenses(userId?: string, prof?: Profile | null) {
    const uid = userId || session?.user?.id
    const p = prof || profile
    if (!uid || !p) return

    let q = supabase
      .from("expenses")
      .select(`
        id, expense_no, expense_date, vendor_name, description, amount,
        currency_code, payment_type, status, created_at, user_id,
        departments(name), categories(name),
        expense_files(file_url, file_name)
      `)
      .order("created_at", { ascending: false })

    if (!(p.role_id === 2 || p.role_id === 3 || p.role_id === 4)) {
      q = q.eq("user_id", uid)
    }

    const { data } = await q
    setExpenses((data as any) || [])
  }

  // -------- LOGIN --------
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error || !data.user) {
      setMessage("Giriş hatası")
      setLoading(false)
      return
    }

    setSession(data.session)
    await loadAll(data.user.id)

    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setExpenses([])
  }

  // -------- SAVE --------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const { data } = await supabase.auth.getUser()
    if (!data.user || !profile) {
      setMessage("Önce giriş yapmalısınız.")
      return
    }

    const { error } = await supabase.from("expenses").insert([
      {
        user_id: data.user.id,
        department_id: Number(departmentId),
        category_id: Number(categoryId),
        expense_date: expenseDate,
        vendor_name: vendorName,
        description,
        amount: Number(amount),
        currency_code: currencyCode,
        payment_type: paymentType,
        status: "submitted",
      },
    ])

    if (error) {
      setMessage("Hata oluştu")
      return
    }

    setMessage("Kaydedildi")
    setVendorName("")
    setDescription("")
    setAmount("")

    await fetchExpenses()
  }

  // -------- FILTER --------
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false
      if (dateFrom && e.expense_date < dateFrom) return false
      if (dateTo && e.expense_date > dateTo) return false
      if (searchText && !e.description.toLowerCase().includes(searchText.toLowerCase())) return false
      return true
    })
  }, [expenses, searchText, statusFilter, dateFrom, dateTo])

  function roleName(id?: number | null) {
    if (id === 1) return "Personel"
    if (id === 2) return "Muhasebe"
    if (id === 3) return "Yönetici"
    if (id === 4) return "Admin"
    return "-"
  }

  // -------- RENDER --------
  if (!authReady) return <div style={{ padding: 40 }}>Yükleniyor...</div>

  if (!session || !profile) {
    return (
      <div style={{ maxWidth: 400, margin: "100px auto" }}>
        <h2>Giriş Yap</h2>
        <form onSubmit={handleLogin}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button>{loading ? "..." : "Giriş"}</button>
        </form>
        {message}
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Masraf Sistemi</h2>
      <div>Rol: {roleName(profile.role_id)}</div>
      <button onClick={handleLogout}>Çıkış</button>

      <hr />

      <h3>Masraf Gir</h3>
      <form onSubmit={handleSubmit}>
        <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Firma" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Tutar" />
        <button>Kaydet</button>
      </form>

      <h3>Liste</h3>
      {filteredExpenses.map((e) => (
        <div key={e.id}>
          {e.description} - {e.amount}
        </div>
      ))}
    </div>
  )
}