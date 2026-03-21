"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import * as XLSX from "xlsx"
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

  useEffect(() => {
    let mounted = true

    async function boot() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()

        if (!mounted) return

        setSession(currentSession)

        if (currentSession?.user?.id) {
          await loadProfileAndData(currentSession.user.id)
        }
      } catch (err) {
        console.error("Boot error:", err)
      } finally {
        if (mounted) setAuthReady(true)
      }
    }

    boot()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!mounted) return

      setSession(currentSession)

      if (currentSession?.user?.id) {
        await loadProfileAndData(currentSession.user.id)
      } else {
        setProfile(null)
        setExpenses([])
      }

      setAuthReady(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isMuhasebe || isAdmin) {
      setStatusFilter("pending")
    } else {
      setStatusFilter("all")
    }
  }, [isMuhasebe, isAdmin])

  async function loadProfileAndData(userId: string) {
    const profileData = await fetchProfile(userId)
    await fetchInitialData(profileData)
    if (profileData) {
      await fetchExpenses(userId, profileData)
    }
  }

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, department_id, role_id")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      console.error("Profile error:", error)
      setProfile(null)
      setMessage("Profil alınamadı.")
      return null
    }

    if (!data) {
      setProfile(null)
      setMessage("Profil bulunamadı.")
      return null
    }

    setProfile(data)

    if (data.department_id) {
      setDepartmentId(String(data.department_id))
    }

    return data as Profile
  }

  async function fetchInitialData(currentProfile?: Profile | null) {
    const { data: depData } = await supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("id", { ascending: true })

    const { data: catData } = await supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("id", { ascending: true })

    const deps = depData || []
    const cats = catData || []

    setDepartments(deps)
    setCategories(cats)

    if (currentProfile?.department_id) {
      setDepartmentId(String(currentProfile.department_id))
    } else if (deps.length > 0 && !departmentId) {
      setDepartmentId(String(deps[0].id))
    }

    if (cats.length > 0 && !categoryId) {
      setCategoryId(String(cats[0].id))
    }
  }

  async function fetchExpenses(userIdParam?: string, profileParam?: Profile | null) {
    const activeUserId = userIdParam || session?.user?.id
    const activeProfile = profileParam || profile

    if (!activeUserId || !activeProfile) return

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
      .order("created_at", { ascending: false })
      .limit(500)

    if (!(activeProfile.role_id === 2 || activeProfile.role_id === 3 || activeProfile.role_id === 4)) {
      query = query.eq("user_id", activeUserId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Expense error:", error)
      setMessage("Masraflar alınamadı.")
      return
    }

    setExpenses((data as unknown as Expense[]) || [])
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setMessage("Giriş hatası: " + error.message)
        return
      }

      if (!data.user || !data.session) {
        setMessage("Oturum alınamadı.")
        return
      }

      setSession(data.session)

      const profileData = await fetchProfile(data.user.id)
      if (!profileData) return

      await fetchInitialData(profileData)
      await fetchExpenses(data.user.id, profileData)

      setMessage("Giriş başarılı.")
    } catch (err) {
      console.error("Login catch:", err)
      setMessage("Giriş sırasında hata oluştu.")
    } finally {
      setLoading(false)
      setAuthReady(true)
    }
  }

  async function handleLogout() {
    setLoading(true)
    setMessage("")

    try {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      setExpenses([])
      setDepartmentId("")
      setCategoryId("")
      setExpenseDate("")
      setVendorName("")
      setDescription("")
      setAmount("")
      setCurrencyCode("TRY")
      setPaymentType("personal_card")
      setSelectedFile(null)
      setSearchText("")
      setStatusFilter("all")
      setDateFrom("")
      setDateTo("")
      setMessage("Çıkış yapıldı.")
    } catch (err) {
      console.error("Logout catch:", err)
      setMessage("Çıkış yapılamadı.")
    } finally {
      setLoading(false)
    }
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

    try {
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

      setVendorName("")
      setDescription("")
      setAmount("")
      setCurrencyCode("TRY")
      setPaymentType("personal_card")
      setExpenseDate("")
      setSelectedFile(null)

      const fileInput = document.getElementById("expense-file") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""

      setMessage("Masraf kaydı başarıyla eklendi.")
      await fetchExpenses(session.user.id, profile)
    } finally {
      setLoading(false)
    }
  }

  async function updateExpenseStatus(
    expenseId: number,
    oldStatus: string,
    newStatus: "approved" | "rejected"
  ) {
    if (!session?.user?.id || !canApproveReject) {
      setMessage("Bu işlem için yetkiniz yok.")
      return
    }

    setMessage("")
    setActionLoadingId(expenseId)

    try {
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
        throw new Error("Masraf güncellenemedi.")
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
      await fetchExpenses()
    } catch (err: any) {
      console.error("Status update error:", err)
      setMessage("İşlem sırasında hata oluştu.")
    } finally {
      setActionLoadingId(null)
    }
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

  function exportExcel() {
    if (expenses.length === 0) {
      setMessage("İndirilecek kayıt bulunamadı.")
      return
    }

    const rows = expenses.map((e) => ({
      MasrafNo: e.expense_no,
      Tarih: e.expense_date,
      Departman: e.departments?.[0]?.name || "",
      Kategori: e.categories?.[0]?.name || "",
      Tedarikci: e.vendor_name || "",
      Aciklama: e.description || "",
      Tutar: e.amount,
      ParaBirimi: e.currency_code,
      OdemeTipi: e.payment_type,
      Durum: e.status,
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Masraflar")
    XLSX.writeFile(workbook, "masraf-raporu.xlsx")
  }

  const dashboard = useMemo(() => {
    const totalCount = expenses.length
    const pendingCount = expenses.filter(
      (e) => e.status === "submitted" || e.status === "under_review"
    ).length
    const approvedCount = expenses.filter((e) => e.status === "approved").length
    const rejectedCount = expenses.filter((e) => e.status === "rejected").length

    const totalTry = expenses
      .filter((e) => e.currency_code === "TRY")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)

    const totalUsd = expenses
      .filter((e) => e.currency_code === "USD")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)

    const totalEur = expenses
      .filter((e) => e.currency_code === "EUR")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)

    return {
      totalCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      totalTry,
      totalUsd,
      totalEur,
    }
  }, [expenses])

  function roleName(roleId?: number | null) {
    if (roleId === 1) return "Personel"
    if (roleId === 2) return "Muhasebe"
    if (roleId === 3) return "Yönetici"
    if (roleId === 4) return "Admin"
    return "-"
  }

  if (!authReady) {
    return (
      <div style={pageStyle}>
        <TopHeader />
        <div style={loginCardStyle}>Yükleniyor...</div>
      </div>
    )
  }

  if (!session || !profile) {
    return (
      <div style={pageStyle}>
        <TopHeader />
        <div style={loginCardStyle}>
          <h2 style={sectionTitleStyle}>Giriş Yap</h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="Email girin"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="Şifre girin"
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
      <TopHeader />

      <div style={topBarStyle}>
        <div>
          <div style={welcomeTitleStyle}>
            Hoş geldiniz{profile?.full_name ? `, ${profile.full_name}` : ""}
          </div>
          <div style={welcomeSubStyle}>Rol: {roleName(profile?.role_id)}</div>
        </div>

        <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
          Çıkış Yap
        </button>
      </div>

      {message && (
        <div style={{ ...messageBoxStyle, marginBottom: "18px" }}>
          {message}
        </div>
      )}

      {canSeeAllExpenses && (
        <div style={dashboardGridStyle}>
          <div style={dashboardCardStyle}>
            <div style={dashboardTitleStyle}>Toplam Kayıt</div>
            <div style={dashboardValueStyle}>{dashboard.totalCount}</div>
          </div>

          <div style={dashboardCardStyle}>
            <div style={dashboardTitleStyle}>Bekleyen</div>
            <div style={dashboardValueStyle}>{dashboard.pendingCount}</div>
          </div>

          <div style={dashboardCardStyle}>
            <div style={dashboardTitleStyle}>Onaylanan</div>
            <div style={dashboardValueStyle}>{dashboard.approvedCount}</div>
          </div>

          <div style={dashboardCardStyle}>
            <div style={dashboardTitleStyle}>Reddedilen</div>
            <div style={dashboardValueStyle}>{dashboard.rejectedCount}</div>
          </div>

          <div style={dashboardCardStyle}>
            <div style={dashboardTitleStyle}>TRY Toplam</div>
            <div style={dashboardValueStyle}>{dashboard.totalTry.toLocaleString("tr-TR")}</div>
          </div>

          <div style={dashboardCardStyle}>
            <div style={dashboardTitleStyle}>USD Toplam</div>
            <div style={dashboardValueStyle}>{dashboard.totalUsd.toLocaleString("tr-TR")}</div>
          </div>

          <div style={dashboardCardStyle}>
            <div style={dashboardTitleStyle}>EUR Toplam</div>
            <div style={dashboardValueStyle}>{dashboard.totalEur.toLocaleString("tr-TR")}</div>
          </div>
        </div>
      )}

      <div style={mainGridStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Yeni Masraf</h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Departman</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                style={inputStyle}
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "14px" }}>
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

            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Harcama Tarihi</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Tedarikçi / Firma</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Firma adı girin"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Açıklama</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Masraf açıklaması yazın"
                rows={4}
                style={{ ...inputStyle, resize: "vertical", minHeight: "120px" }}
              />
            </div>

            <div style={twoColGridStyle}>
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

            <div style={{ marginBottom: "14px" }}>
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
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </form>
        </div>

        <div style={cardStyle}>
          <div style={listHeaderStyle}>
            <h2 style={sectionTitleStyle}>
              {isPersonel ? "Masraflarım" : "Masraflar"}
            </h2>

            <button type="button" onClick={exportExcel} style={secondaryButtonStyle}>
              Excel İndir
            </button>
          </div>

          <div style={filterGridStyle}>
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
            <p style={{ color: "#64748b" }}>Kayıt yok.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredExpenses.map((expense) => (
                <div key={expense.id} style={expenseCardStyle}>
                  <div style={expenseTopRowStyle}>
                    <strong style={{ fontSize: "18px" }}>{expense.expense_no}</strong>
                    <span style={{ fontWeight: 700 }}>
                      {expense.amount} {expense.currency_code}
                    </span>
                  </div>

                  <div style={{ marginTop: "8px", color: "#334155" }}>
                    {expense.description}
                  </div>

                  <div style={expenseInfoStyle}>
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
                        style={fileLinkStyle}
                      >
                        Fiş / Fatura Aç
                      </a>
                    </div>
                  )}

                  {canApproveReject &&
                    (expense.status === "submitted" || expense.status === "under_review") && (
                      <div style={actionRowStyle}>
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
  )
}

function TopHeader() {
  return (
    <div style={headerWrapStyle}>
      <div style={headerInnerStyle}>
        <Image
          src="/logo.png"
          alt="Özen İplik"
          width={260}
          height={140}
          style={{
            objectFit: "contain",
            width: "100%",
            height: "auto",
            maxWidth: "260px",
          }}
          priority
        />
        <div style={headerTitleStyle}>MASRAF SİSTEMİ</div>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "16px",
  fontFamily: "Arial, sans-serif",
}

const headerWrapStyle: React.CSSProperties = {
  marginBottom: "22px",
  borderBottom: "4px solid #0f172a",
  paddingBottom: "14px",
}

const headerInnerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: "10px",
}

const headerTitleStyle: React.CSSProperties = {
  fontSize: "clamp(20px, 3vw, 28px)",
  fontWeight: 700,
  letterSpacing: "1px",
  color: "#0f172a",
}

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "18px",
}

const welcomeTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "18px",
  color: "#0f172a",
}

const welcomeSubStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: "4px",
}

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: "24px",
  alignItems: "start",
}

const dashboardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
  marginTop: "8px",
  marginBottom: "24px",
}

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
}

const twoColGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "16px",
  marginBottom: "16px",
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  overflow: "hidden",
}

const loginCardStyle: React.CSSProperties = {
  maxWidth: "440px",
  margin: "50px auto 0 auto",
  background: "#ffffff",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const dashboardCardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "16px",
  padding: "18px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const dashboardTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#64748b",
  marginBottom: "8px",
}

const dashboardValueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 700,
  color: "#0f172a",
}

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: "18px",
  fontSize: "26px",
  color: "#0f172a",
}

const listHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "16px",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "7px",
  fontWeight: 700,
  color: "#0f172a",
  fontSize: "14px",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontSize: "15px",
  minWidth: 0,
  background: "#fff",
  color: "#0f172a",
}

const primaryButtonStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  padding: "14px 18px",
  cursor: "pointer",
  fontWeight: 700,
  width: "100%",
  fontSize: "16px",
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

const logoutButtonStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 700,
}

const greenButtonStyle: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
}

const redButtonStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
}

const messageBoxStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "10px",
  background: "#e2e8f0",
  color: "#0f172a",
  marginTop: "16px",
}

const expenseCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "16px",
  background: "#f8fafc",
}

const expenseTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
}

const expenseInfoStyle: React.CSSProperties = {
  marginTop: "10px",
  fontSize: "14px",
  color: "#64748b",
  lineHeight: 1.7,
}

const fileLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 600,
}

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  marginTop: "14px",
  flexWrap: "wrap",
}
