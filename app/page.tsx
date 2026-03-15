"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabaseClient"

type Department = {
  id: number
  name: string
}

type Category = {
  id: number
  name: string
}

type ExpenseFile = {
  file_url: string | null
  file_name: string
}

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
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [email, setEmail] = useState("test@ozeniplik.com")
  const [password, setPassword] = useState("12345678Aa!")

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

  const canApproveReject = isMuhasebe

  useEffect(() => {
    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession)

      if (currentSession?.user?.id) {
        await fetchProfile(currentSession.user.id)
      } else {
        setProfile(null)
        setExpenses([])
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      fetchInitialData()
    }
  }, [session])

  useEffect(() => {
    if (session?.user?.id && profile) {
      fetchExpenses()
    }
  }, [session, profile])

  useEffect(() => {
    if (isMuhasebe) {
      setStatusFilter("pending")
    } else {
      setStatusFilter("all")
    }
  }, [isMuhasebe])

  async function checkSession() {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    setSession(currentSession)

    if (currentSession?.user?.id) {
      await fetchProfile(currentSession.user.id)
    }
  }

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, department_id, role_id")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("Profil çekme hatası:", error)
      return
    }

    setProfile(data)

    if (data?.department_id) {
      setDepartmentId(String(data.department_id))
    }
  }

  async function fetchInitialData() {
    const { data: departmentData } = await supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("id", { ascending: true })

    const { data: categoryData } = await supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("id", { ascending: true })

    setDepartments(departmentData || [])
    setCategories(categoryData || [])

    if (!departmentId && departmentData && departmentData.length > 0) {
      setDepartmentId(String(departmentData[0].id))
    }

    if (categoryData && categoryData.length > 0) {
      setCategoryId(String(categoryData[0].id))
    }
  }

  async function fetchExpenses() {
    if (!session?.user?.id || !profile) return

    let query = supabase
      .from("expenses")
      .select(`
        id,
        expense_no,
        expense_date,
        vendor_name,
        description,
        amount,
        currency_code,
        payment_type,
        status,
        created_at,
        user_id,
        departments(name),
        categories(name),
        expense_files(file_url, file_name)
      `)
      .order("id", { ascending: false })
      .limit(100)

    if (isPersonel) {
      query = query.eq("user_id", session.user.id)
    }

    if (isMuhasebe) {
      query = query.in("status", ["submitted", "under_review"])
    }

    const { data, error } = await query

    if (error) {
      console.error("Masraf listeleme hatası:", error)
      return
    }

    setExpenses((data as unknown as Expense[]) || [])
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setMessage("Giriş hatası: " + error.message)
      return
    }

    setMessage("Giriş başarılı.")
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setMessage("Çıkış yapıldı.")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")

    if (!session?.user?.id || !profile) {
      setMessage("Önce giriş yapmalısınız.")
      return
    }

    if (!departmentId || !categoryId || !expenseDate || !description || !amount) {
      setMessage("Lütfen zorunlu alanları doldurun.")
      return
    }

    setLoading(true)

    const { data: insertedExpense, error: expenseError } = await supabase
      .from("expenses")
      .insert([
        {
          user_id: session.user.id,
          department_id: Number(departmentId),
          category_id: Number(categoryId),
          expense_date: expenseDate,
          vendor_name: vendorName || null,
          description,
          amount: Number(amount),
          currency_code: currencyCode,
          payment_type: paymentType,
          status: "submitted",
        },
      ])
      .select()
      .single()

    if (expenseError || !insertedExpense) {
      setLoading(false)
      setMessage("Masraf kaydı sırasında hata oluştu.")
      return
    }

    if (selectedFile) {
      const safeFileName = selectedFile.name.replace(/\s+/g, "_")
      const filePath = `expenses/${insertedExpense.id}/${Date.now()}_${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from("expense-files")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedFile.type,
        })

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from("expense-files")
          .getPublicUrl(filePath)

        await supabase.from("expense_files").insert([
          {
            expense_id: insertedExpense.id,
            file_name: selectedFile.name,
            file_path: filePath,
            file_url: publicUrlData.publicUrl,
            uploaded_by: session.user.id,
          },
        ])
      }
    }

    await supabase.from("expense_status_logs").insert([
      {
        expense_id: insertedExpense.id,
        action_by: session.user.id,
        old_status: null,
        new_status: "submitted",
        note: "Masraf kaydı oluşturuldu",
      },
    ])

    setLoading(false)
    setMessage("Masraf kaydı başarıyla eklendi.")

    setVendorName("")
    setDescription("")
    setAmount("")
    setCurrencyCode("TRY")
    setPaymentType("personal_card")
    setExpenseDate("")
    setSelectedFile(null)

    const fileInput = document.getElementById("expense-file") as HTMLInputElement | null
    if (fileInput) fileInput.value = ""

    fetchExpenses()
  }

  async function updateExpenseStatus(
    expenseId: number,
    oldStatus: string,
    newStatus: "approved" | "rejected"
  ) {
    if (!session?.user?.id || !canApproveReject) return

    setMessage("")
    setActionLoadingId(expenseId)

    const updatePayload: any = {
      status: newStatus,
      approved_by: session.user.id,
      approved_at: newStatus === "approved" ? new Date().toISOString() : null,
    }

    if (newStatus === "rejected") {
      updatePayload.rejection_reason = "Muhasebe tarafından reddedildi"
    }

    const { error: updateError } = await supabase
      .from("expenses")
      .update(updatePayload)
      .eq("id", expenseId)

    if (updateError) {
      setMessage("Durum güncellenemedi: " + updateError.message)
      setActionLoadingId(null)
      return
    }

    await supabase.from("expense_status_logs").insert([
      {
        expense_id: expenseId,
        action_by: session.user.id,
        old_status: oldStatus,
        new_status: newStatus,
        note: newStatus === "approved" ? "Kayıt onaylandı" : "Kayıt reddedildi",
      },
    ])

    setMessage(newStatus === "approved" ? "Masraf onaylandı." : "Masraf reddedildi.")
    setActionLoadingId(null)
    fetchExpenses()
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const search = searchText.trim().toLowerCase()

      const matchesSearch =
        !search ||
        expense.expense_no?.toLowerCase().includes(search) ||
        expense.description?.toLowerCase().includes(search) ||
        expense.vendor_name?.toLowerCase().includes(search) ||
        expense.departments?.[0]?.name?.toLowerCase().includes(search) ||
        expense.categories?.[0]?.name?.toLowerCase().includes(search)

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "pending"
          ? expense.status === "submitted" || expense.status === "under_review"
          : expense.status === statusFilter

      const matchesDateFrom = !dateFrom || expense.expense_date >= dateFrom
      const matchesDateTo = !dateTo || expense.expense_date <= dateTo

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
    })
  }, [expenses, searchText, statusFilter, dateFrom, dateTo])

  function exportCsv() {
    if (filteredExpenses.length === 0) {
      setMessage("İndirilecek kayıt bulunamadı.")
      return
    }

    const rows = [
      [
        "Masraf No",
        "Tarih",
        "Departman",
        "Kategori",
        "Tedarikçi",
        "Açıklama",
        "Tutar",
        "Para Birimi",
        "Ödeme Tipi",
        "Durum",
      ],
      ...filteredExpenses.map((expense) => [
        expense.expense_no || "",
        expense.expense_date || "",
        expense.departments?.[0]?.name || "",
        expense.categories?.[0]?.name || "",
        expense.vendor_name || "",
        expense.description || "",
        String(expense.amount ?? ""),
        expense.currency_code || "",
        expense.payment_type || "",
        expense.status || "",
      ]),
    ]

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "masraf-raporu.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  function roleName(roleId?: number | null) {
    if (roleId === 1) return "Personel"
    if (roleId === 2) return "Muhasebe"
    if (roleId === 3) return "Yönetici"
    return "-"
  }

  if (!session) {
    return (
      <div style={pageStyle}>
        <div style={loginCardStyle}>
          <h1 style={{ marginTop: 0 }}>Özen İplik Masraf Sistemi</h1>
          <p style={{ color: "#475569", marginBottom: "24px" }}>
            Giriş yaparak devam edin
          </p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button type="submit" disabled={loading} style={primaryButtonStyle}>
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          {message && <div style={messageBoxStyle}>{message}</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ marginTop: 0, marginBottom: "8px" }}>Özen İplik Masraf Sistemi</h1>
            <p style={{ color: "#475569", margin: 0 }}>
              Hoş geldiniz{profile?.full_name ? `, ${profile.full_name}` : ""}.
            </p>
            <p style={{ color: "#64748b", marginTop: "6px", marginBottom: 0 }}>
              Rol: {roleName(profile?.role_id)}
            </p>
          </div>

          <button onClick={handleLogout} style={secondaryButtonStyle}>
            Çıkış Yap
          </button>
        </div>

        {message && (
          <div style={{ ...messageBoxStyle, marginTop: "20px", marginBottom: "20px" }}>
            {message}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: "24px",
            alignItems: "start",
            marginTop: "24px",
          }}
        >
          <div style={cardStyle}>
            <h2>Yeni Masraf Ekle</h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Departman</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  style={inputStyle}
                  disabled={isPersonel && !!profile?.department_id}
                >
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Kategori</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  style={inputStyle}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Harcama Tarihi</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Tedarikçi / Firma</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Örn: Shell, Otel, Restoran"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Açıklama</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Masraf açıklaması"
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label style={labelStyle}>Tutar</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Para Birimi</label>
                  <select
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Ödeme Tipi</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="cash">Nakit</option>
                  <option value="company_card">Şirket Kartı</option>
                  <option value="personal_card">Kişisel Kart</option>
                  <option value="bank_transfer">Havale / EFT</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Fiş / Fatura</label>
                <input
                  id="expense-file"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={inputStyle}
                />
              </div>

              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? "Kaydediliyor..." : "Masrafı Kaydet"}
              </button>
            </form>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: "16px",
              }}
            >
              <h2 style={{ margin: 0 }}>
                {isPersonel
                  ? "Masraflarım"
                  : isMuhasebe
                  ? "Bekleyen Masraf Kayıtları"
                  : "Tüm Masraf Kayıtları"}
              </h2>

              <button onClick={exportCsv} style={secondaryButtonStyle}>
                CSV İndir
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <input
                type="text"
                placeholder="Masraf no, açıklama, firma ara"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={inputStyle}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={inputStyle}
              >
                <option value="all">Tüm durumlar</option>
                <option value="pending">Bekleyenler</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={inputStyle}
              />

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={inputStyle}
              />
            </div>

            {filteredExpenses.length === 0 ? (
              <p>Kayıt yok.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "14px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <strong>{expense.expense_no}</strong>
                      <span>
                        {expense.amount} {expense.currency_code}
                      </span>
                    </div>

                    <div style={{ marginTop: "8px", color: "#334155" }}>
                      {expense.description}
                    </div>

                    <div style={{ marginTop: "8px", fontSize: "14px", color: "#64748b" }}>
                      <div>Tarih: {expense.expense_date}</div>
                      <div>Departman: {expense.departments?.[0]?.name || "-"}</div>
                      <div>Kategori: {expense.categories?.[0]?.name || "-"}</div>
                      <div>Tedarikçi: {expense.vendor_name || "-"}</div>
                      <div>Ödeme Tipi: {expense.payment_type}</div>
                      <div>Durum: {expense.status}</div>
                    </div>

                    {expense.expense_files?.[0]?.file_url && (
                      <div style={{ marginTop: "10px" }}>
                        <a
                          href={expense.expense_files[0].file_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "#2563eb",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          Fiş / Fatura Aç
                        </a>
                      </div>
                    )}

                    {canApproveReject && (
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                        <button
                          type="button"
                          disabled={actionLoadingId === expense.id}
                          onClick={() =>
                            updateExpenseStatus(expense.id, expense.status, "approved")
                          }
                          style={greenButtonStyle}
                        >
                          {actionLoadingId === expense.id ? "İşleniyor..." : "Onayla"}
                        </button>

                        <button
                          type="button"
                          disabled={actionLoadingId === expense.id}
                          onClick={() =>
                            updateExpenseStatus(expense.id, expense.status, "rejected")
                          }
                          style={redButtonStyle}
                        >
                          {actionLoadingId === expense.id ? "İşleniyor..." : "Reddet"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px",
  fontFamily: "Arial, sans-serif",
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const loginCardStyle: React.CSSProperties = {
  maxWidth: "420px",
  margin: "60px auto",
  background: "#ffffff",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontSize: "14px",
}

const primaryButtonStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 700,
  width: "100%",
}

const secondaryButtonStyle: React.CSSProperties = {
  background: "#e2e8f0",
  color: "#0f172a",
  border: "none",
  borderRadius: "10px",
  padding: "10px 16px",
  cursor: "pointer",
  fontWeight: 600,
}

const greenButtonStyle: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
}

const redButtonStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
}

const messageBoxStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "12px",
  borderRadius: "10px",
  background: "#e2e8f0",
  color: "#0f172a",
}