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

  const [session,setSession] = useState<any>(null)
  const [profile,setProfile] = useState<Profile|null>(null)

  const [email,setEmail] = useState("test@ozeniplik.com")
  const [password,setPassword] = useState("12345678Aa!")

  const [departments,setDepartments] = useState<Department[]>([])
  const [categories,setCategories] = useState<Category[]>([])
  const [expenses,setExpenses] = useState<Expense[]>([])

  const [departmentId,setDepartmentId] = useState("")
  const [categoryId,setCategoryId] = useState("")
  const [expenseDate,setExpenseDate] = useState("")
  const [vendorName,setVendorName] = useState("")
  const [description,setDescription] = useState("")
  const [amount,setAmount] = useState("")
  const [currencyCode,setCurrencyCode] = useState("TRY")
  const [paymentType,setPaymentType] = useState("personal_card")

  const [selectedFile,setSelectedFile] = useState<File|null>(null)

  const [loading,setLoading] = useState(false)
  const [message,setMessage] = useState("")

  const isMuhasebe = profile?.role_id === 2

  useEffect(()=>{
    checkSession()

    const { data:{ subscription } } =
    supabase.auth.onAuthStateChange(async (_event,currentSession)=>{
      setSession(currentSession)

      if(currentSession?.user?.id){
        await fetchProfile(currentSession.user.id)
      }
    })

    return ()=>subscription.unsubscribe()

  },[])

  useEffect(()=>{
    if(session?.user?.id){
      fetchInitialData()
      fetchExpenses()
    }
  },[session])

  async function checkSession(){

    const { data:{ session } } =
    await supabase.auth.getSession()

    setSession(session)

    if(session?.user?.id){
      await fetchProfile(session.user.id)
    }

  }

  async function fetchProfile(userId:string){

    const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id",userId)
    .single()

    setProfile(data)

    if(data?.department_id){
      setDepartmentId(String(data.department_id))
    }

  }

  async function fetchInitialData(){

    const { data:dep } =
    await supabase.from("departments").select("*")

    const { data:cat } =
    await supabase.from("categories").select("*")

    setDepartments(dep || [])
    setCategories(cat || [])

  }

  async function fetchExpenses(){

    const { data } =
    await supabase
    .from("expenses")
    .select(`
      *,
      departments(name),
      categories(name),
      expense_files(file_url,file_name)
    `)
    .order("id",{ascending:false})

    setExpenses((data as unknown as Expense[]) || [])

  }

  async function handleLogin(e:React.FormEvent){

    e.preventDefault()

    setLoading(true)

    const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    })

    setLoading(false)

    if(error){
      setMessage(error.message)
    }else{
      setMessage("Giriş başarılı.")
    }

  }

  async function handleLogout(){
    await supabase.auth.signOut()
  }

  async function handleSubmit(e:React.FormEvent){

    e.preventDefault()

    const { data } =
    await supabase
    .from("expenses")
    .insert([{
      user_id:session.user.id,
      department_id:Number(departmentId),
      category_id:Number(categoryId),
      expense_date:expenseDate,
      vendor_name:vendorName,
      description,
      amount:Number(amount),
      currency_code:currencyCode,
      payment_type:paymentType,
      status:"submitted"
    }])
    .select()
    .single()

    if(selectedFile && data){

      const filePath =
      `expenses/${data.id}/${Date.now()}_${selectedFile.name}`

      await supabase.storage
      .from("expense-files")
      .upload(filePath,selectedFile)

    }

    setMessage("Masraf kaydedildi.")

    fetchExpenses()

  }

  function exportExcel(){

    const rows =
    expenses.map(e=>({
      MasrafNo:e.expense_no,
      Tarih:e.expense_date,
      Departman:e.departments?.[0]?.name || "",
      Kategori:e.categories?.[0]?.name || "",
      Tutar:e.amount,
      ParaBirimi:e.currency_code,
      Açıklama:e.description
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb,ws,"Masraflar")

    XLSX.writeFile(wb,"masraf-raporu.xlsx")

  }

  if(!session){

    return(
      <div style={pageStyle}>

        <Header/>

        <div style={loginCard}>

          <form onSubmit={handleLogin}>

            <input
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="email"
            style={input}
            />

            <input
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="şifre"
            style={input}
            />

            <button style={button}>
              Giriş Yap
            </button>

          </form>

          {message}

        </div>

      </div>
    )

  }

  return(

    <div style={pageStyle}>

      <Header/>

      <button onClick={handleLogout}>
        Çıkış Yap
      </button>

      <div style={grid}>

        <div style={card}>

          <h3>Yeni Masraf</h3>

          <form onSubmit={handleSubmit}>

            <select
            value={departmentId}
            onChange={e=>setDepartmentId(e.target.value)}
            style={input}
            >
              {departments.map(d=>(
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
            value={categoryId}
            onChange={e=>setCategoryId(e.target.value)}
            style={input}
            >
              {categories.map(c=>(
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
            type="date"
            value={expenseDate}
            onChange={e=>setExpenseDate(e.target.value)}
            style={input}
            />

            <input
            value={vendorName}
            onChange={e=>setVendorName(e.target.value)}
            placeholder="firma"
            style={input}
            />

            <textarea
            value={description}
            onChange={e=>setDescription(e.target.value)}
            placeholder="açıklama"
            style={input}
            />

            <input
            type="number"
            value={amount}
            onChange={e=>setAmount(e.target.value)}
            placeholder="tutar"
            style={input}
            />

            <input
            type="file"
            onChange={e=>setSelectedFile(e.target.files?.[0]||null)}
            style={input}
            />

            <button style={button}>
              Kaydet
            </button>

          </form>

        </div>

        <div style={card}>

          <h3>Masraflar</h3>

          <button onClick={exportExcel}>
            Excel indir
          </button>

          {expenses.map(e=>(
            <div key={e.id} style={expenseCard}>

              <b>{e.expense_no}</b>

              <div>{e.description}</div>

              <div>
                {e.amount} {e.currency_code}
              </div>

            </div>
          ))}

        </div>

      </div>

    </div>

  )

}

function Header(){

  return(

    <div style={header}>

      <Image
      src="/logo.png"
      alt="Özen İplik"
      width={120}
      height={60}
      />

      <div style={title}>
        MASRAF SİSTEMİ
      </div>

    </div>

  )

}

const pageStyle:React.CSSProperties={
  padding:"20px",
  fontFamily:"Arial"
}

const header:React.CSSProperties={
  display:"flex",
  alignItems:"center",
  gap:"15px",
  borderBottom:"3px solid #0f172a",
  paddingBottom:"10px",
  marginBottom:"20px"
}

const title:React.CSSProperties={
  fontSize:"28px",
  fontWeight:800
}

const grid:React.CSSProperties={
  display:"grid",
  gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",
  gap:"20px"
}

const card:React.CSSProperties={
  background:"#fff",
  padding:"20px",
  borderRadius:"10px",
  boxShadow:"0 5px 20px rgba(0,0,0,0.1)"
}

const loginCard:React.CSSProperties={
  maxWidth:"400px",
  margin:"auto"
}

const input:React.CSSProperties={
  width:"100%",
  padding:"10px",
  marginBottom:"10px"
}

const button:React.CSSProperties={
  padding:"10px",
  background:"#0f172a",
  color:"#fff",
  border:"none",
  cursor:"pointer"
}

const expenseCard:React.CSSProperties={
  border:"1px solid #ddd",
  padding:"10px",
  marginTop:"10px"
}