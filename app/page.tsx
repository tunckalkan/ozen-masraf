"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import * as XLSX from "xlsx"
import { supabase } from "../lib/supabaseClient"

type Profile = {
  id: string
  full_name: string
  email: string | null
  department_id: number | null
  role_id: number | null
}

type ExpenseFile = {
  expense_id: number
  file_url: string | null
  file_name: string | null
}

type Expense = {
  id: number
  user_id: string
  expense_date: string
  vendor_name: string | null
  description: string
  amount: number
  currency_code: string | null
  category: string | null
  payment_method: string | null
  status: string
  created_at: string
  file_url?: string | null
  file_name?: string | null
}

export default function Page() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [email, setEmail] = useState("test@ozeniplik.com")
  const [password, setPassword] = useState("123456")

  const [expenseDate, setExpenseDate] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [currencyCode, setCurrencyCode] = useState("TRY")
  const [category, setCategory] = useState("Diğer")
  const [paymentMethod, setPaymentMethod] = useState("personal_card")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  const isMuhasebe = profile?.role_id === 2

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (!mounted) return

        if (currentUser) {
          setUser(currentUser)
          const loadedProfile = await loadProfile(currentUser.id)
          if (loadedProfile) {
            await loadExpenses(currentUser.id, loadedProfile)
          }
        }
      } catch (err) {
        console.error("Init error:", err)
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
        const loadedProfile = await loadProfile(currentUser.id)
        if (loadedProfile) {
          await loadExpenses(currentUser.id, loadedProfile)
        }
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

  async function loadProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, department_id, role_id")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      console.error("Profile error:", error)
      setProfile(null)
      setMessage(`Profil hatası: ${error.message}`)
      return null
    }

    if (!data) {
      setProfile(null)
      setMessage("Profil bulunamadı.")
      return null
    }

    setProfile(data)
    return data
  }

  async function loadExpenses(userId: string, currentProfile?: Profile | null) {
    const activeProfile = currentProfile || profile
    if (!activeProfile) return

    let expenseQuery = supabase
      .from("expenses")
      .select("id, user_id, expense_date, vendor_name, description, amount, currency_code, category, payment_method, status, created_at")
      .order("created_at", { ascending: false })

    if (activeProfile.role_id !== 2) {
      expenseQuery = expenseQuery.eq("user_id", userId)
    }

    const { data: expenseRows, error: expenseError } = await expenseQuery

    if (expenseError) {
      console.error("Expenses error:", expenseError)
      setMessage(`Masraflar alınamadı: ${expenseError.message}`)
      return
    }

    const baseExpenses: Expense[] = (expenseRows || []).map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      expense_date: item.expense_date,
      vendor_name: item.vendor_name,
      description: item.description,
      amount: item.amount,
      currency_code: item.currency_code,
      category: item.category,
      payment_method: item.payment_method,
      status: item.status,
      created_at: item.created_at,
      file_url: null,
      file_name: null,
    }))

    if (baseExpenses.length === 0) {
      setExpenses([])
      return
    }

    const ids = baseExpenses.map((x) => x.id)

    const { data: fileRows, error: fileError } = await supabase
      .from("expense_files")
      .select("expense_id, file_url, file_name")
      .in("expense_id", ids)

    if (fileError) {
      console.error("Expense files error:", fileError)
      setExpenses(baseExpenses)
      return
    }

    const fileMap = new Map<number, ExpenseFile>()
    ;(fileRows || []).forEach((f: any) => {
      if (!fileMap.has(f.expense_id)) {
        fileMap.set(f.expense_id, {
          expense_id: f.expense_id,
          file_url: f.file_url,
          file_name: f.file_name,
        })
      }
    })

    const merged = baseExpenses.map((exp) => {
      const f = fileMap.get(exp.id)
      return {
        ...exp,
        file_url: f?.file_url || null,
        file_name: f?.file_name || null,
      }
    })

    setExpenses(merged)
  }

  function roleName(roleId?: number | null) {
    if (roleId === 1) return "Personel"
    if (roleId === 2) return "Muhasebe"
    if (roleId === 3) return "Yönetici"
    if (roleId === 4) return "Admin"
    return "-"
  }

  function paymentMethodName(value?: string | null) {
    if (value === "cash") return "Nakit"
    if (value === "credit_card") return "Kredi Kartı"
    if (value === "bank_transfer") return "Banka Transferi"
    if (value === "company_card") return "Şirket Kartı"
    if (value === "personal_card") return "Kişisel Kart"
    return value || "-"
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
        setMessage(error ? `Giriş hatası: ${error.message}` : "Giriş hatası.")
        return
      }

      setUser(data.user)
      const loadedProfile = await loadProfile(data.user.id)
      if (loadedProfile) {
        await loadExpenses(data.user.id, loadedProfile)
      }

      setMessage("Giriş başarılı.")
    } catch (err: any) {
      console.error("Login error:", err)
      setMessage(`Giriş sırasında hata oluştu: ${err?.message || "bilinmiyor"}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setLoading(true)
    setMessage("")

    try {
      supabase.auth.signOut().catch((err) => {
        console.error("Logout background error:", err)
      })
    } catch (err) {
      console.error("Logout error:", err)
    } finally {
      setUser(null)
      setProfile(null)
      setExpenses([])
      setExpenseDate("")
      setVendorName("")
      setDescription("")
      setAmount("")
      setCurrencyCode("TRY")
      setCategory("Diğer")
      setPaymentMethod("personal_card")
      setSelectedFile(null)
      setDateFrom("")
      setDateTo("")
      setEmail("test@ozeniplik.com")
      setPassword("123456")
      setLoading(false)
      setMessage("Çıkış yapıldı.")
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
      const { data: inserted, error } = await supabase
        .from("expenses")
        .insert([
          {
            user_id: user.id,
            expense_date: expenseDate,
            vendor_name: vendorName || null,
            description,
            amount: Number(amount),
            currency_code: currencyCode,
            category: category,
            payment_method: paymentMethod,
            status: "submitted",
            department_id: profile.department_id || 1,
            category_id: 1,
          },
        ])
        .select("id")
        .single()

      if (error || !inserted) {
        console.error("Insert error:", error)
        setMessage(`Masraf kaydedilemedi: ${error?.message || "hata"}`)
        return
      }

      if (selectedFile) {
        const safeName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, "_")}`
        const filePath = `expenses/${inserted.id}/${safeName}`

        const { error: uploadError } = await supabase.storage
          .from("expense-files")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: selectedFile.type,
          })

        if (uploadError) {
          console.error("Upload error:", uploadError)
          setMessage(`Masraf kaydedildi fakat dosya yüklenemedi: ${uploadError.message}`)
        } else {
          const { data: publicData } = supabase.storage.from("expense-files").getPublicUrl(filePath)

          const { error: fileInsertError } = await supabase.from("expense_files").insert([
            {
              expense_id: inserted.id,
              file_name: selectedFile.name,
              file_path: filePath,
              file_url: publicData.publicUrl,
              uploaded_by: user.id,
            },
          ])

          if (fileInsertError) {
            console.error("Expense file insert error:", fileInsertError)
            setMessage(`Masraf kaydedildi fakat dosya kaydı eklenemedi: ${fileInsertError.message}`)
          }
        }
      }

      setExpenseDate("")
      setVendorName("")
      setDescription("")
      setAmount("")
      setCurrencyCode("TRY")
      setCategory("Diğer")
      setPaymentMethod("personal_card")
      setSelectedFile(null)

      const fileInput = document.getElementById("expense-file") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""

      setMessage("Masraf kaydedildi.")
      await loadExpenses(user.id, profile)
    } catch (err: any) {
      console.error("Save error:", err)
      setMessage(`Masraf kaydı sırasında hata oluştu: ${err?.message || "bilinmiyor"}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(expenseId: number) {
    if (!user || !isMuhasebe) return

    setActionLoadingId(expenseId)
    setMessage("")

    try {
      const { error } = await supabase
        .from("expenses")
        .update({ status: "approved" })
        .eq("id", expenseId)

      if (error) {
        setMessage(`Onay hatası: ${error.message}`)
        return
      }

      setExpenses((prev) =>
        prev.map((item) =>
          item.id === expenseId ? { ...item, status: "approved" } : item
        )
      )

      setMessage("Masraf onaylandı.")
    } catch (err: any) {
      console.error("Approve error:", err)
      setMessage(`Onay sırasında hata oluştu: ${err?.message || "bilinmiyor"}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleReject(expenseId: number) {
    if (!user || !isMuhasebe) return

    setActionLoadingId(expenseId)
    setMessage("")

    try {
      const { error } = await supabase
        .from("expenses")
        .update({ status: "rejected" })
        .eq("id", expenseId)

      if (error) {
        setMessage(`Red hatası: ${error.message}`)
        return
      }

      setExpenses((prev) =>
        prev.map((item) =>
          item.id === expenseId ? { ...item, status: "rejected" } : item
        )
      )

      setMessage("Masraf reddedildi.")
    } catch (err: any) {
      console.error("Reject error:", err)
      setMessage(`Red sırasında hata oluştu: ${err?.message || "bilinmiyor"}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const okFrom = !dateFrom || item.expense_date >= dateFrom
      const okTo = !dateTo || item.expense_date <= dateTo
      return okFrom && okTo
    })
  }, [expenses, dateFrom, dateTo])

  function exportExcel() {
    if (filteredExpenses.length === 0) {
      setMessage("Excel için kayıt bulunamadı.")
      return
    }

    const rows = filteredExpenses.map((item) => ({
      Tarih: item.expense_date,
      Firma: item.vendor_name || "",
      Kategori: item.category || "",
      Açıklama: item.description,
      Tutar: item.amount,
      ParaBirimi: item.currency_code || "TRY",
      ÖdemeYöntemi: paymentMethodName(item.payment_method),
      Durum: item.status,
      EkDosya: item.file_url || "",
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Masraflar")
    XLSX.writeFile(wb, "masraflar.xlsx")
  }

  if (booting) {
    return (
      <div style={pageStyle}>
        <Header />
        <div style={centerBoxStyle}>Yükleniyor...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div style={pageStyle}>
        <Header />

        <div style={loginOuterStyle}>
          <div style={loginBoxStyle}>
            <h2 style={sectionTitleStyle}>Giriş Yap</h2>

            <form onSubmit={handleLogin}>
              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Şifre</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>
            </form>

            {message && (
              <div style={{ ...messageStyle, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <Header />

      <div style={contentWrapStyle}>
        <div style={topBarStyle}>
          <div>
            <div style={welcomeStyle}>Hoş geldiniz, {profile.full_name}</div>
            <div style={roleStyle}>Rol: {roleName(profile.role_id)}</div>
          </div>

          <button onClick={handleLogout} disabled={loading} style={logoutButtonStyle}>
            Çıkış Yap
          </button>
        </div>

        <div style={gridStyle}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Yeni Masraf</h2>

            <form onSubmit={handleSave}>
              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Tarih</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Firma</label>
                <input
                  style={inputStyle}
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Firma adı girin"
                />
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Açıklama</label>
                <textarea
                  style={textareaStyle}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Masraf açıklaması"
                />
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Tutar</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div style={fieldWrapStyle}>
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

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Ödeme Yöntemi</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={inputStyle}
                >
                  <option value="cash">Nakit</option>
                  <option value="credit_card">Kredi Kartı</option>
                  <option value="bank_transfer">Banka Transferi</option>
                  <option value="company_card">Şirket Kartı</option>
                  <option value="personal_card">Kişisel Kart</option>
                </select>
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={inputStyle}
                >
                  <option value="Konaklama">Konaklama</option>
                  <option value="Ulaşım">Ulaşım</option>
                  <option value="Yakıt">Yakıt</option>
                  <option value="Satınalma">Satınalma</option>
                  <option value="Yemek">Yemek</option>
                  <option value="Temsil / Ağırlama">Temsil / Ağırlama</option>
                  <option value="Ofis Gideri">Ofis Gideri</option>
                  <option value="Kargo / Lojistik">Kargo / Lojistik</option>
                  <option value="Bakım / Onarım">Bakım / Onarım</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              <div style={fieldWrapStyle}>
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
            <div style={listTopBarStyle}>
              <h2 style={sectionTitleStyle}>
                {isMuhasebe ? "Tüm Masraflar" : "Masraflarım"}
              </h2>

              <button type="button" onClick={exportExcel} style={excelButtonStyle}>
                Excel Al
              </button>
            </div>

            <div style={filterRowStyle}>
              <div style={filterItemStyle}>
                <label style={labelStyle}>Başlangıç</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={filterItemStyle}>
                <label style={labelStyle}>Bitiş</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div style={emptyStyle}>Kayıt yok.</div>
            ) : (
              filteredExpenses.map((item) => (
                <div key={item.id} style={expenseRowStyle}>
                  <div style={expenseTitleStyle}>{item.description}</div>
                  <div style={expenseMetaStyle}>Tarih: {item.expense_date}</div>
                  <div style={expenseMetaStyle}>Firma: {item.vendor_name || "-"}</div>
                  <div style={expenseMetaStyle}>Kategori: {item.category || "-"}</div>
                  <div style={expenseMetaStyle}>
                    Tutar: {item.amount} {item.currency_code || "TRY"}
                  </div>
                  <div style={expenseMetaStyle}>
                    Ödeme Yöntemi: {paymentMethodName(item.payment_method)}
                  </div>
                  <div style={expenseMetaStyle}>Durum: {item.status}</div>

                  {item.file_url && (
                    <div style={expenseMetaStyle}>
                      <a href={item.file_url} target="_blank" rel="noreferrer" style={fileLinkStyle}>
                        Ek Dosya: {item.file_name || "Görüntüle"}
                      </a>
                    </div>
                  )}

                  {isMuhasebe && item.status === "submitted" && (
                    <div style={actionRowStyle}>
                      <button
                        type="button"
                        onClick={() => handleApprove(item.id)}
                        disabled={actionLoadingId === item.id}
                        style={approveButtonStyle}
                      >
                        {actionLoadingId === item.id ? "İşleniyor..." : "Onayla"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReject(item.id)}
                        disabled={actionLoadingId === item.id}
                        style={rejectButtonStyle}
                      >
                        {actionLoadingId === item.id ? "İşleniyor..." : "Reddet"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {message && (
          <div style={{ ...messageStyle, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div style={headerWrapStyle}>
      <div style={headerInnerStyle}>
        <Image
          src="/logo.png"
          alt="Özen İplik"
          width={260}
          height={120}
          style={{
            width: "100%",
            maxWidth: "260px",
            height: "auto",
            objectFit: "contain",
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
  fontFamily: "Arial, sans-serif",
  padding: "16px",
}

const headerWrapStyle: React.CSSProperties = {
  borderBottom: "4px solid #0f172a",
  paddingBottom: "14px",
  marginBottom: "24px",
}

const headerInnerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
}

const headerTitleStyle: React.CSSProperties = {
  fontSize: "clamp(22px, 3vw, 34px)",
  fontWeight: 700,
  color: "#0f172a",
  letterSpacing: "1px",
}

const contentWrapStyle: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
}

const loginOuterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: "40px",
}

const loginBoxStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  background: "#ffffff",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const centerBoxStyle: React.CSSProperties = {
  maxWidth: "420px",
  margin: "60px auto",
  background: "#ffffff",
  borderRadius: "18px",
  padding: "24px",
  textAlign: "center",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "20px",
}

const welcomeStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: "6px",
}

const roleStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "15px",
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: "20px",
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: "18px",
  fontSize: "28px",
  color: "#0f172a",
}

const fieldWrapStyle: React.CSSProperties = {
  marginBottom: "14px",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 700,
  color: "#0f172a",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontSize: "15px",
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "110px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontSize: "15px",
  resize: "vertical",
}

const primaryButtonStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#ffffff",
  border: "none",
  borderRadius: "12px",
  padding: "13px 18px",
  cursor: "pointer",
  fontWeight: 700,
  width: "100%",
  fontSize: "16px",
}

const logoutButtonStyle: React.CSSProperties = {
  background: "#0f172a",
  color: "#ffffff",
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 700,
}

const excelButtonStyle: React.CSSProperties = {
  background: "#e2e8f0",
  color: "#0f172a",
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
}

const listTopBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "12px",
}

const filterRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
}

const filterItemStyle: React.CSSProperties = {}

const messageStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#e2e8f0",
  color: "#0f172a",
}

const emptyStyle: React.CSSProperties = {
  color: "#64748b",
}

const expenseRowStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "12px 0",
}

const expenseTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: "6px",
}

const expenseMetaStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "14px",
  marginBottom: "3px",
}

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  marginTop: "10px",
  flexWrap: "wrap",
}

const approveButtonStyle: React.CSSProperties = {
  background: "#16a34a",
  color: "#ffffff",
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
}

const rejectButtonStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "#ffffff",
  border: "none",
  borderRadius: "10px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
}

const fileLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 700,
}