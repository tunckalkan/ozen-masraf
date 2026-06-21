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
  manager_id?: string | null
  is_active?: boolean | null
}

type ExpenseFile = {
  expense_id: number
  file_url: string | null
  file_name: string | null
}

type Expense = {
  id: number
  user_id: string
  full_name?: string | null
  manager_name?: string | null
  manager_id?: string | null
  department_name?: string | null
  expense_date: string
  vendor_name: string | null
  description: string
  amount: number
  currency_code: string | null
  category: string | null
  payment_method: string | null
  last4_digits: string | null
  status: string
  created_at: string
  manager_approved_by?: string | null
  manager_approved_at?: string | null
  rejected_by?: string | null
  rejected_at?: string | null
  rejection_note?: string | null
  file_url?: string | null
  file_name?: string | null
}

type ManagedUser = {
  id: string
  full_name: string
  email: string | null
  role_id: number | null
  manager_id: string | null
  department_id: number | null
  is_active: boolean | null
}

type Department = {
  id: number
  name: string
}

type Category = {
  id: number
  name: string
}

function isImageFile(file: File): boolean {
  const type = (file.type || "").toLowerCase()
  const name = (file.name || "").toLowerCase()

  return (
    type.startsWith("image/") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".bmp")
  )
}

async function compressImage(file: File): Promise<File> {
  if (!isImageFile(file)) return file

  return new Promise((resolve) => {
    const reader = new FileReader()
    const img = new window.Image()
    let finished = false

    function finish(result: File) {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = window.setTimeout(() => {
      finish(file)
    }, 10000)

    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result !== "string") {
        finish(file)
        return
      }
      img.src = result
    }

    img.onload = () => {
      try {
        const maxWidth = 1200
        const maxHeight = 1200

        let width = img.width
        let height = img.height

        if (!width || !height) {
          finish(file)
          return
        }

        const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
        width = Math.max(1, Math.round(width * ratio))
        height = Math.max(1, Math.round(height * ratio))

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d", { alpha: false })
        if (!ctx) {
          finish(file)
          return
        }

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              finish(file)
              return
            }
            const jpgFile = new File([blob], `fis_${Date.now()}.jpg`, {
              type: "image/jpeg",
            })
            finish(jpgFile)
          },
          "image/jpeg",
          0.72
        )
      } catch (err) {
        console.error("Resim küçültme hatası:", err)
        finish(file)
      }
    }

    img.onerror = () => finish(file)
    reader.onerror = () => finish(file)
    reader.readAsDataURL(file)
  })
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Dosya yükleme zaman aşımı"))
    }, ms)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

export default function Page() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  function clearSupabaseStorage() {
  Object.keys(window.localStorage).forEach((key) => {
    if (key.includes("supabase") || key.includes("sb-")) {
      window.localStorage.removeItem(key)
    }
  })

  Object.keys(window.sessionStorage).forEach((key) => {
    if (key.includes("supabase") || key.includes("sb-")) {
      window.sessionStorage.removeItem(key)
    }
  })
}

  const [email, setEmail] = useState("test@ozeniplik.com")
  const [password, setPassword] = useState("123456")

  const [expenseDate, setExpenseDate] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [currencyCode, setCurrencyCode] = useState("TRY")
  const [category, setCategory] = useState("Diğer")
  const [paymentMethod, setPaymentMethod] = useState("personal_card")
  const [last4Digits, setLast4Digits] = useState("")

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [message, setMessage] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [fileUploadingId, setFileUploadingId] = useState<number | null>(null)

  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userActionMessage, setUserActionMessage] = useState("")

  const [newFullName, setNewFullName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserRoleId, setNewUserRoleId] = useState("1")
  const [newManagerId, setNewManagerId] = useState("")
  const [newDepartmentId, setNewDepartmentId] = useState("")
  const [newIsActive, setNewIsActive] = useState(true)

  const isMuhasebe = profile?.role_id === 2
  const isYonetici = profile?.role_id === 3
  const isHiddenAdmin = profile?.role_id === 4

  const canManageUsers = isMuhasebe || isHiddenAdmin
  const canSeeAllExpenses = isHiddenAdmin

  const needsLast4 =
    paymentMethod === "company_card" || paymentMethod === "personal_card"

  useEffect(() => {
    let mounted = true
    let initialized = false

    async function init() {
      if (initialized) return
      initialized = true

      try {
        await loadCategories()

        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (!mounted) return

        if (currentUser) {
          setUser(currentUser)

          const loadedProfile = await loadProfile(currentUser.id)
          if (!mounted) return

          if (loadedProfile) {
            await loadExpenses(currentUser.id, loadedProfile)

            if (loadedProfile.role_id === 2 || loadedProfile.role_id === 4) {
              await loadManagedUsers()
            }
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
      // İlk yükleme (init) tamamlanmadan auth event'lerini işleme alma.
      // Bu, Android'de uygulama arka plandan döndüğünde aynı verinin
      // iki kez sırayla çekilip ekranın "asılı" görünmesini engeller.
      if (!initialized) return

      const currentUser = session?.user ?? null

      if (!mounted) return

      await loadCategories()

      if (currentUser) {
        setUser(currentUser)

        const loadedProfile = await loadProfile(currentUser.id)
        if (!mounted) return

        if (loadedProfile) {
          await loadExpenses(currentUser.id, loadedProfile)

          if (loadedProfile.role_id === 2 || loadedProfile.role_id === 4) {
            await loadManagedUsers()
          }
        }
      } else {
        setUser(null)
        setProfile(null)
        setExpenses([])
        setManagedUsers([])
        setDepartments([])
      }

      if (mounted) setBooting(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true })

    if (!error) {
      setCategories(data || [])

      if ((!category || category === "Diğer") && data && data.length > 0) {
        setCategory(data[0].name)
      }
    } else {
      console.error("Kategori alınamadı:", error.message)
    }
  }

  async function loadProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, department_id, role_id, manager_id, is_active")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
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
      .select(
        "id, user_id, expense_date, vendor_name, description, amount, currency_code, category, payment_method, last4_digits, status, created_at, manager_approved_by, manager_approved_at, rejected_by, rejected_at, rejection_note"
      )
      .order("created_at", { ascending: false })

    if (activeProfile.role_id === 1) {
      expenseQuery = expenseQuery.eq("user_id", userId)
    } else if (activeProfile.role_id === 2) {
      expenseQuery = expenseQuery.eq("status", "approved")
    } else if (activeProfile.role_id === 3) {
      // Yönetici tüm masrafları görebilir.
      // Onay butonu sadece kendine bağlı personelde gösterilecek.
    } else if (activeProfile.role_id === 4) {
      // Admin her şeyi görür.
    }

    const { data: expenseRows, error: expenseError } = await expenseQuery

    if (expenseError) {
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
      last4_digits: item.last4_digits,
      status: item.status,
      created_at: item.created_at,
      manager_approved_by: item.manager_approved_by,
      manager_approved_at: item.manager_approved_at,
      rejected_by: item.rejected_by,
      rejected_at: item.rejected_at,
      rejection_note: item.rejection_note,
      file_url: null,
      file_name: null,
    }))

    if (baseExpenses.length === 0) {
      setExpenses([])
      return
    }

    const ids = baseExpenses.map((x) => x.id)
    const userIds = Array.from(new Set(baseExpenses.map((x) => x.user_id).filter(Boolean)))

    const { data: fileRows } = await supabase
      .from("expense_files")
      .select("expense_id, file_url, file_name")
      .in("expense_id", ids)

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, manager_id, department_id")
      .in("id", userIds)

    const managerIds = Array.from(
      new Set((profileRows || []).map((p: any) => p.manager_id).filter(Boolean))
    )

    let managerRows: any[] = []
    if (managerIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", managerIds)
      managerRows = data || []
    }

    const { data: departmentRows } = await supabase
      .from("departments")
      .select("id, name")

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

    const profileMap = new Map<
      string,
      {
        full_name: string
        manager_id: string | null
        department_id: number | null
      }
    >()
    ;(profileRows || []).forEach((p: any) => {
      profileMap.set(p.id, {
        full_name: p.full_name,
        manager_id: p.manager_id,
        department_id: p.department_id,
      })
    })

    const managerMap = new Map<string, string>()
    ;(managerRows || []).forEach((m: any) => {
      managerMap.set(m.id, m.full_name)
    })

    const departmentMap = new Map<number, string>()
    ;(departmentRows || []).forEach((d: any) => {
      departmentMap.set(d.id, d.name)
    })

    const merged = baseExpenses.map((exp) => {
      const f = fileMap.get(exp.id)
      const p = profileMap.get(exp.user_id)
      const managerName = p?.manager_id ? managerMap.get(p.manager_id) || null : null
      const departmentName =
        p?.department_id ? departmentMap.get(p.department_id) || null : null

      return {
        ...exp,
        full_name: p?.full_name || null,
        manager_name: managerName,
        manager_id: p?.manager_id || null,
        department_name: departmentName,
        file_url: f?.file_url || null,
        file_name: f?.file_name || null,
      }
    })

    setExpenses(merged)
  }

  async function loadManagedUsers() {
    if (!user) return

    setUsersLoading(true)
    setUserActionMessage("")

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
          "Cache-Control": "no-store",
        },
      })

      const text = await res.text()
      const json = text ? JSON.parse(text) : {}

      if (!res.ok) {
        setUserActionMessage(json.error || "Kullanıcılar alınamadı.")
        setManagedUsers([])
        setDepartments([])
        return
      }

      const filteredUsers = (json.users || []).filter((u: any) => u.role_id !== 4)
      setManagedUsers(filteredUsers)
      setDepartments(json.departments || [])
    } catch (err: any) {
      setUserActionMessage(err?.message || "Kullanıcılar alınamadı.")
      setManagedUsers([])
      setDepartments([])
    } finally {
      setUsersLoading(false)
    }
  }

  function roleName(roleId?: number | null) {
    if (roleId === 1) return "Personel"
    if (roleId === 2) return "Muhasebe"
    if (roleId === 3) return "Yönetici"
    if (roleId === 4) return "Yönetici"
    return "-"
  }

  function paymentMethodName(value?: string | null) {
    if (value === "cash") return "Nakit"
    if (value === "bank_transfer") return "Banka Transferi"
    if (value === "company_card") return "Şirket Kartı"
    if (value === "personal_card") return "Kişisel Kart"
    return value || "-"
  }

  function statusName(value?: string | null) {
    if (value === "submitted") return "Yönetici Onayı Bekliyor"
    if (value === "approved") return "Onaylandı"
    if (value === "rejected") return "Reddedildi"
    return value || "-"
  }

  function departmentName(departmentId?: number | null) {
    if (!departmentId) return "-"
    return departments.find((d) => d.id === departmentId)?.name || "-"
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
        if (loadedProfile.role_id === 2 || loadedProfile.role_id === 4) {
          await loadManagedUsers()
        }
      }

      setMessage("Giriş başarılı.")
    } catch (err: any) {
      setMessage(`Giriş sırasında hata oluştu: ${err?.message || "bilinmiyor"}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    try {
      setLoading(false)
      setActionLoadingId(null)

      await supabase.auth.signOut()
      clearSupabaseStorage()
    } catch (err) {
      console.error("Çıkış temizleme hatası:", err)
    }

    window.location.href = "/?logout=1"
  }

  async function uploadExpenseFileViaApi(expenseId: number, file: File): Promise<boolean> {
    if (!user) return false

    if (file.size > 12 * 1024 * 1024) {
      setMessage("Dosya çok büyük. Lütfen 12 MB altında JPG, PNG veya PDF yükleyin.")
      return false
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "application/pdf"])
    if (file.type && !allowedTypes.has(file.type)) {
      setMessage(`Desteklenmeyen dosya tipi: ${file.type}. Sadece JPG, PNG veya PDF yükleyin.`)
      return false
    }

    setFileUploadingId(expenseId)
    setMessage("Dosya yükleniyor...")

    return new Promise((resolve) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("expenseId", String(expenseId))
      formData.append("userId", user.id)

      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/upload-expense-file")
      xhr.timeout = 60000

      xhr.onload = async () => {
        try {
          const json = xhr.responseText ? JSON.parse(xhr.responseText) : {}

          if (xhr.status >= 200 && xhr.status < 300) {
            setMessage("Dosya başarıyla yüklendi.")
            await loadExpenses(user.id, profile)
            resolve(true)
          } else {
            const errorText = json?.error || `HTTP ${xhr.status}`
            setMessage(`Dosya yüklenemedi: ${errorText}`)
            resolve(false)
          }
        } catch (err: any) {
          setMessage(`Dosya yükleme cevabı okunamadı: ${err?.message || "bilinmiyor"}`)
          resolve(false)
        } finally {
          setFileUploadingId(null)
        }
      }

      xhr.onerror = () => {
        setMessage("Dosya yüklenemedi: bağlantı hatası.")
        setFileUploadingId(null)
        resolve(false)
      }

      xhr.ontimeout = () => {
        setMessage("Dosya yüklenemedi: 60 saniye zaman aşımı.")
        setFileUploadingId(null)
        resolve(false)
      }

      xhr.send(formData)
    })
  }

  async function handleSave() {
    setMessage("")

    if (!user || !profile) {
      setMessage("Önce giriş yapmalısınız.")
      return
    }

    if (!expenseDate || !description || !amount) {
      setMessage("Tarih, açıklama ve tutar zorunlu.")
      return
    }

    if (needsLast4 && last4Digits.length !== 4) {
      setMessage("Kartın son 4 hanesini giriniz.")
      return
    }

    setLoading(true)

    try {
      const autoApproved = isYonetici || isHiddenAdmin

      const insertPayload = {
        user_id: user.id,
        expense_date: expenseDate,
        vendor_name: vendorName || null,
        description,
        amount: Number(amount),
        currency_code: currencyCode,
        category,
        payment_method: paymentMethod,
        payment_type: paymentMethod,
        last4_digits: needsLast4 ? last4Digits : null,
        status: autoApproved ? "approved" : "submitted",
        manager_approved_by: autoApproved ? user.id : null,
        manager_approved_at: autoApproved ? new Date().toISOString() : null,
        rejected_by: null,
        rejected_at: null,
        rejection_note: null,
        department_id: profile.department_id || 1,
        category_id: 1,
      }

      const { data: inserted, error } = await supabase
        .from("expenses")
        .insert([insertPayload as any])
        .select("id, status, manager_approved_by, manager_approved_at")
        .single()

      if (error || !inserted) {
        setMessage(`Masraf kaydedilemedi: ${error?.message || "hata"}`)
        return
      }

      setExpenseDate("")
      setVendorName("")
      setDescription("")
      setAmount("")
      setCurrencyCode("TRY")
      setCategory(categories.length > 0 ? categories[0].name : "Diğer")
      setPaymentMethod("personal_card")
      setLast4Digits("")

      setMessage(
        autoApproved
          ? "Masraf onaylı olarak kaydedildi. Şimdi listeden fiş yükleyebilirsiniz."
          : "Masraf kaydedildi. Şimdi listeden fiş yükleyebilirsiniz."
      )

      await loadExpenses(user.id, profile)
    } catch (err: any) {
      setMessage(`Masraf kaydı sırasında hata oluştu: ${err?.message || "bilinmiyor"}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleManagerApprove(expenseId: number) {
    if (!user) return

    setActionLoadingId(expenseId)
    setMessage("")

    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from("expenses")
        .update({
          status: "approved",
          manager_approved_by: user.id,
          manager_approved_at: nowIso,
          rejected_by: null,
          rejected_at: null,
          rejection_note: null,
        })
        .eq("id", expenseId)

      if (error) {
        setMessage(`Onay hatası: ${error.message}`)
        return
      }

      await loadExpenses(user.id, profile)
      setMessage("Masraf onaylandı.")
    } catch (err: any) {
      setMessage(`Onay sırasında hata oluştu: ${err?.message || "bilinmiyor"}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleManagerReject(expenseId: number) {
    if (!user) return

    setActionLoadingId(expenseId)
    setMessage("")

    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from("expenses")
        .update({
          status: "rejected",
          rejected_by: user.id,
          rejected_at: nowIso,
        })
        .eq("id", expenseId)

      if (error) {
        setMessage(`Red hatası: ${error.message}`)
        return
      }

      await loadExpenses(user.id, profile)
      setMessage("Masraf reddedildi.")
    } catch (err: any) {
      setMessage(`Red sırasında hata oluştu: ${err?.message || "bilinmiyor"}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setUserActionMessage("")

    if (!canManageUsers) {
      setUserActionMessage("Bu işlem için yetkiniz yok.")
      return
    }

    if (!newFullName || !newUserEmail || !newUserPassword) {
      setUserActionMessage("Ad soyad, email ve şifre zorunlu.")
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const roleIdNum = Number(newUserRoleId)
      const payload = {
        full_name: newFullName,
        email: newUserEmail.trim(),
        password: newUserPassword,
        role_id: roleIdNum,
        manager_id: roleIdNum === 1 ? newManagerId || null : null,
        department_id: newDepartmentId ? Number(newDepartmentId) : null,
        is_active: newIsActive,
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify(payload),
      })

      const text = await res.text()
      const json = text ? JSON.parse(text) : {}

      if (!res.ok) {
        setUserActionMessage(json.error || "Kullanıcı oluşturulamadı.")
        return
      }

      setNewFullName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setNewUserRoleId("1")
      setNewManagerId("")
      setNewDepartmentId("")
      setNewIsActive(true)

      setUserActionMessage(json.message || "Kullanıcı oluşturuldu.")
      await loadManagedUsers()
    } catch (err: any) {
      setUserActionMessage(err?.message || "Kullanıcı oluşturulamadı.")
    }
  }

  async function handleToggleActive(target: ManagedUser) {
    setUserActionMessage("")

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          id: target.id,
          is_active: !target.is_active,
        }),
      })

      const text = await res.text()
      const json = text ? JSON.parse(text) : {}

      if (!res.ok) {
        setUserActionMessage(json.error || "Güncelleme yapılamadı.")
        return
      }

      setUserActionMessage(json.message || "Kullanıcı durumu güncellendi.")
      await loadManagedUsers()
    } catch (err: any) {
      setUserActionMessage(err?.message || "Güncelleme yapılamadı.")
    }
  }

  async function handleUpdateUser(
    target: ManagedUser,
    managerId: string,
    roleId: number,
    departmentId: string,
    newPassword?: string
  ) {
    setUserActionMessage("")

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          id: target.id,
          role_id: roleId,
          manager_id: roleId === 1 ? managerId || null : null,
          department_id: departmentId ? Number(departmentId) : null,
          password: newPassword && newPassword.trim() !== "" ? newPassword : undefined,
        }),
      })

      const text = await res.text()
      const json = text ? JSON.parse(text) : {}

      if (!res.ok) {
        setUserActionMessage(json.error || "Kullanıcı güncellenemedi.")
        return
      }

      setUserActionMessage(json.message || "Kullanıcı güncellendi.")
      await loadManagedUsers()
    } catch (err: any) {
      setUserActionMessage(err?.message || "Kullanıcı güncellenemedi.")
    }
  }

  const currentMonthExpenses = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()

    return expenses.filter((item) => {
      const d = new Date(item.expense_date)
      return d.getFullYear() === y && d.getMonth() === m
    })
  }, [expenses])

  const excelExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const okFrom = !dateFrom || item.expense_date >= dateFrom
      const okTo = !dateTo || item.expense_date <= dateTo
      return okFrom && okTo
    })
  }, [expenses, dateFrom, dateTo])

  const managers = useMemo(() => {
    return managedUsers.filter((u) => (u.role_id === 3 || u.role_id === 4) && u.is_active)
  }, [managedUsers])

  function exportExcel() {
    if (excelExpenses.length === 0) {
      setMessage("Excel için kayıt bulunamadı.")
      return
    }

    const rows = excelExpenses.map((item) => ({
      Personel: item.full_name || "-",
      Yonetici: item.manager_name || "-",
      Departman: item.department_name || "-",
      Tarih: item.expense_date || "-",
      Firma: item.vendor_name || "-",
      Kategori: item.category || "-",
      Aciklama: item.description || "-",
      Tutar: item.amount ?? 0,
      ParaBirimi: item.currency_code || "TRY",
      OdemeYontemi: paymentMethodName(item.payment_method),
      KartSon4: item.last4_digits || "-",
      Durum: statusName(item.status),
      EkDosya: item.file_url || "-",
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1")

    for (let row = 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 12 })
      const cell = ws[cellAddress]

      if (cell && cell.v && cell.v !== "-") {
        cell.l = { Target: String(cell.v) }
      }
    }

    ws["!cols"] = [
      { wch: 22 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 10 },
      { wch: 22 },
      { wch: 60 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Masraflar")
    XLSX.writeFile(wb, "masraflar.xlsx")
  }

  function listTitle() {
    if (canSeeAllExpenses) return "Bu Ay Tüm Masraflar"
    if (isMuhasebe) return "Bu Ay Muhasebeye Düşen Masraflar"
    if (isYonetici) return "Bu Ay Yönetici Ekranı"
    return "Bu Ay Masraflarım"
  }

  if (booting) {
    return (
      <div style={pageStyle}>
        <Header />
        <div style={centerBoxStyle}>
          <div style={spinnerStyle} />
          <div style={{ marginTop: "14px" }}>Yükleniyor...</div>
        </div>
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

            {message && <div style={messageStyle}>{message}</div>}
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

          <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
            Çıkış Yap
          </button>
        </div>

        <div style={gridStyle}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Yeni Masraf</h2>

            <div>
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
                  onChange={(e) => {
                    setPaymentMethod(e.target.value)
                    if (
                      e.target.value !== "company_card" &&
                      e.target.value !== "personal_card"
                    ) {
                      setLast4Digits("")
                    }
                  }}
                  style={inputStyle}
                >
                  <option value="cash">Nakit</option>
                  <option value="bank_transfer">Banka Transferi</option>
                  <option value="company_card">Şirket Kartı</option>
                  <option value="personal_card">Kişisel Kart</option>
                </select>
              </div>

              {(paymentMethod === "company_card" || paymentMethod === "personal_card") && (
                <div style={fieldWrapStyle}>
                  <label style={labelStyle}>Kartın Son 4 Hanesi</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={last4Digits}
                    onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, ""))}
                    placeholder="1234"
                    style={inputStyle}
                  />
                </div>
              )}

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={inputStyle}
                >
                  {categories.length === 0 ? (
                    <option value="Diğer">Diğer</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div style={messageStyle}>
                Önce masrafı kaydedin. Fiş / fatura yükleme işlemini aşağıdaki masraf kaydının
                içinden ayrıca yapın.
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleSave}
                style={primaryButtonStyle}
              >
                {loading ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={listTopBarStyle}>
              <h2 style={sectionTitleStyle}>{listTitle()}</h2>

              <button type="button" onClick={exportExcel} style={excelButtonStyle}>
                Excel Al
              </button>
            </div>

            <div style={filterRowStyle}>
              <div style={filterItemStyle}>
                <label style={labelStyle}>Excel Başlangıç</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={filterItemStyle}>
                <label style={labelStyle}>Excel Bitiş</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {currentMonthExpenses.length === 0 ? (
              <div style={emptyStyle}>Bu ay kayıt yok.</div>
            ) : (
              currentMonthExpenses.map((item) => {
                const canApproveThisExpense =
                  item.status === "submitted" &&
                  item.user_id !== user.id &&
                  (isHiddenAdmin || (isYonetici && item.manager_id === user.id))

                return (
                  <div key={item.id} style={expenseRowStyle}>
                    {(isYonetici || isMuhasebe || isHiddenAdmin) && (
                      <>
                        <div style={expenseMetaStyle}>Personel: {item.full_name || "-"}</div>
                        <div style={expenseMetaStyle}>Yönetici: {item.manager_name || "-"}</div>
                        <div style={expenseMetaStyle}>Departman: {item.department_name || "-"}</div>
                      </>
                    )}

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

                    {item.last4_digits && (
                      <div style={expenseMetaStyle}>Kart Son 4: {item.last4_digits}</div>
                    )}

                    <div style={expenseMetaStyle}>Durum: {statusName(item.status)}</div>

                    {item.file_url ? (
                      <div style={expenseMetaStyle}>
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noreferrer"
                          style={fileLinkStyle}
                        >
                          Ek Dosya: {item.file_name || "Görüntüle"}
                        </a>
                      </div>
                    ) : (
                      <div style={{ ...fieldWrapStyle, marginTop: "10px" }}>
                        <label style={labelStyle}>Fiş / Fatura Yükle</label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          disabled={fileUploadingId === item.id}
                          onChange={async (e) => {
                            const file = e.target.files?.[0] || null
                            if (!file) return
                            await uploadExpenseFileViaApi(item.id, file)
                            e.currentTarget.value = ""
                          }}
                          style={inputStyle}
                        />
                        {fileUploadingId === item.id && (
                          <div style={expenseMetaStyle}>Dosya yükleniyor...</div>
                        )}
                      </div>
                    )}

                    {canApproveThisExpense && (
                      <div style={actionRowStyle}>
                        <button
                          type="button"
                          onClick={() => handleManagerApprove(item.id)}
                          disabled={actionLoadingId === item.id}
                          style={approveButtonStyle}
                        >
                          {actionLoadingId === item.id ? "İşleniyor..." : "Onayla"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleManagerReject(item.id)}
                          disabled={actionLoadingId === item.id}
                          style={rejectButtonStyle}
                        >
                          {actionLoadingId === item.id ? "İşleniyor..." : "Reddet"}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {canManageUsers && (
          <div style={{ ...cardStyle, marginTop: "20px" }}>
            <h2 style={sectionTitleStyle}>Kullanıcı Tanımlama</h2>

            <form onSubmit={handleCreateUser}>
              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Ad Soyad</label>
                <input
                  style={inputStyle}
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Geçici Şifre</label>
                <input
                  style={inputStyle}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Rol</label>
                <select
                  style={inputStyle}
                  value={newUserRoleId}
                  onChange={(e) => {
                    setNewUserRoleId(e.target.value)
                    if (e.target.value !== "1") {
                      setNewManagerId("")
                    }
                  }}
                >
                  <option value="1">Personel</option>
                  <option value="2">Muhasebe</option>
                  <option value="3">Yönetici</option>
                </select>
              </div>

              {newUserRoleId === "1" && (
                <div style={fieldWrapStyle}>
                  <label style={labelStyle}>Bağlı Yönetici</label>
                  <select
                    style={inputStyle}
                    value={newManagerId}
                    onChange={(e) => setNewManagerId(e.target.value)}
                  >
                    <option value="">Seçiniz</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Departman</label>
                <select
                  style={inputStyle}
                  value={newDepartmentId}
                  onChange={(e) => setNewDepartmentId(e.target.value)}
                >
                  <option value="">Seçiniz</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={fieldWrapStyle}>
                <label style={labelStyle}>Durum</label>
                <select
                  style={inputStyle}
                  value={newIsActive ? "1" : "0"}
                  onChange={(e) => setNewIsActive(e.target.value === "1")}
                >
                  <option value="1">Aktif</option>
                  <option value="0">Pasif</option>
                </select>
              </div>

              <button type="submit" style={primaryButtonStyle}>
                Kullanıcı Oluştur
              </button>
            </form>

            {userActionMessage && <div style={messageStyle}>{userActionMessage}</div>}

            <div style={{ marginTop: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "12px",
                }}
              >
                <h3 style={{ margin: 0, color: "#0f172a" }}>Kayıtlı Kullanıcılar</h3>

                <button
                  type="button"
                  style={excelButtonStyle}
                  onClick={loadManagedUsers}
                >
                  Listeyi Yenile
                </button>
              </div>

              {usersLoading ? (
                <div style={emptyStyle}>Yükleniyor...</div>
              ) : managedUsers.length === 0 ? (
                <div style={emptyStyle}>Kullanıcı yok.</div>
              ) : (
                [...managedUsers]
                  .sort((a, b) => {
                    const aActive = a.is_active ? 1 : 0
                    const bActive = b.is_active ? 1 : 0
                    if (aActive !== bActive) return bActive - aActive
                    return (a.full_name || "").localeCompare(b.full_name || "", "tr")
                  })
                  .map((u) => (
                    <ManagedUserCard
                      key={u.id}
                      user={u}
                      managers={managers}
                      departments={departments}
                      onToggleActive={handleToggleActive}
                      onUpdateUser={handleUpdateUser}
                      roleName={roleName}
                      departmentName={departmentName}
                    />
                  ))
              )}
            </div>
          </div>
        )}

        {message && <div style={messageStyle}>{message}</div>}
      </div>
    </div>
  )
}

function ManagedUserCard({
  user,
  managers,
  departments,
  onToggleActive,
  onUpdateUser,
  roleName,
  departmentName,
}: {
  user: ManagedUser
  managers: ManagedUser[]
  departments: Department[]
  onToggleActive: (u: ManagedUser) => void
  onUpdateUser: (
    u: ManagedUser,
    managerId: string,
    roleId: number,
    departmentId: string,
    newPassword?: string
  ) => void
  roleName: (roleId?: number | null) => string
  departmentName: (departmentId?: number | null) => string
}) {
  const [localRoleId, setLocalRoleId] = useState(String(user.role_id || 1))
  const [localManagerId, setLocalManagerId] = useState(user.manager_id || "")
  const [localDepartmentId, setLocalDepartmentId] = useState(
    user.department_id ? String(user.department_id) : ""
  )
  const [localPassword, setLocalPassword] = useState("")

  return (
    <div style={expenseRowStyle}>
      <div style={expenseTitleStyle}>{user.full_name}</div>
      <div style={expenseMetaStyle}>Email: {user.email || "-"}</div>
      <div style={expenseMetaStyle}>Rol: {roleName(user.role_id)}</div>
      <div style={expenseMetaStyle}>
        Yönetici: {managers.find((m) => m.id === user.manager_id)?.full_name || "-"}
      </div>
      <div style={expenseMetaStyle}>Departman: {departmentName(user.department_id)}</div>
      <div style={expenseMetaStyle}>Durum: {user.is_active ? "Aktif" : "Pasif"}</div>

      <div style={actionRowStyle}>
        <select
          style={{ ...inputStyle, maxWidth: "180px" }}
          value={localRoleId}
          onChange={(e) => {
            setLocalRoleId(e.target.value)
            if (e.target.value !== "1") {
              setLocalManagerId("")
            }
          }}
        >
          <option value="1">Personel</option>
          <option value="2">Muhasebe</option>
          <option value="3">Yönetici</option>
        </select>

        {localRoleId === "1" && (
          <select
            style={{ ...inputStyle, maxWidth: "220px" }}
            value={localManagerId}
            onChange={(e) => setLocalManagerId(e.target.value)}
          >
            <option value="">Yönetici Seç</option>
            {managers
              .filter((m) => m.id !== user.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
          </select>
        )}

        <select
          style={{ ...inputStyle, maxWidth: "180px" }}
          value={localDepartmentId}
          onChange={(e) => setLocalDepartmentId(e.target.value)}
        >
          <option value="">Departman Seç</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          style={excelButtonStyle}
          onClick={() =>
            onUpdateUser(user, localManagerId, Number(localRoleId), localDepartmentId)
          }
        >
          Kaydet
        </button>

        <button
          type="button"
          style={user.is_active ? rejectButtonStyle : approveButtonStyle}
          onClick={() => onToggleActive(user)}
        >
          {user.is_active ? "Pasif Yap" : "Aktif Yap"}
        </button>
      </div>

      <div style={{ ...actionRowStyle, marginTop: "12px" }}>
        <input
          type="text"
          placeholder="Yeni şifre"
          value={localPassword}
          onChange={(e) => setLocalPassword(e.target.value)}
          style={{ ...inputStyle, maxWidth: "240px" }}
        />

        <button
          type="button"
          style={approveButtonStyle}
          onClick={() => {
            if (!localPassword.trim()) return
            onUpdateUser(
              user,
              localManagerId,
              Number(localRoleId),
              localDepartmentId,
              localPassword
            )
            setLocalPassword("")
          }}
        >
          Şifreyi Güncelle
        </button>
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

const spinnerStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  margin: "0 auto",
  borderRadius: "50%",
  border: "4px solid #e2e8f0",
  borderTopColor: "#0f172a",
  animation: "spin 0.8s linear infinite",
}

const btnSpinnerStyle: React.CSSProperties = {
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.4)",
  borderTopColor: "#ffffff",
  animation: "spin 0.8s linear infinite",
  display: "inline-block",
}

const btnContentStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
}

const uploadHintStyle: React.CSSProperties = {
  marginTop: "10px",
  fontSize: "13px",
  color: "#64748b",
  textAlign: "center",
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