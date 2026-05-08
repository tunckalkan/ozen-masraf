import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cleanFileName(name: string) {
  return (name || "fis")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
}

export async function POST(request: Request) {
  try {
    console.log("UPLOAD API START")

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase environment eksik")
      return NextResponse.json(
        { error: "Server ortam değişkenleri eksik." },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    console.log("UPLOAD API FORMDATA OK")

    const file = formData.get("file") as File | null
    const expenseId = formData.get("expenseId") as string | null
    const userId = formData.get("userId") as string | null

    if (!file || !expenseId || !userId) {
      return NextResponse.json(
        { error: "Eksik veri: file, expenseId veya userId yok." },
        { status: 400 }
      )
    }

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Dosya çok büyük. Maksimum 12 MB." },
        { status: 400 }
      )
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ]

    if (file.type && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Desteklenmeyen dosya tipi: ${file.type}. JPG, PNG veya PDF yükleyin.` },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const originalName = cleanFileName(file.name)
    const extension = originalName.split(".").pop()?.toLowerCase() || "jpg"

    const safeName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}.${extension}`

    const filePath = `expenses/${expenseId}/${safeName}`

    const bytes = await file.arrayBuffer()
    console.log("UPLOAD API ARRAYBUFFER OK", file.name, file.type, file.size)

    const { error: uploadError } = await supabaseAdmin.storage
      .from("expense-files")
      .upload(filePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      })

    if (uploadError) {
      console.error("SUPABASE STORAGE UPLOAD ERROR:", uploadError.message)
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("expense-files")
      .getPublicUrl(filePath)

    const { error: dbError } = await supabaseAdmin
      .from("expense_files")
      .insert([
        {
          expense_id: Number(expenseId),
          file_name: file.name || safeName,
          file_path: filePath,
          file_url: publicData.publicUrl,
          uploaded_by: userId,
        },
      ])

    if (dbError) {
      console.error("EXPENSE_FILES INSERT ERROR:", dbError.message)
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      )
    }

    console.log("UPLOAD API SUCCESS", filePath)

    return NextResponse.json({
      success: true,
      file_path: filePath,
      file_url: publicData.publicUrl,
    })
  } catch (err: any) {
    console.error("UPLOAD API GENERAL ERROR:", err)

    return NextResponse.json(
      { error: err?.message || "Server upload hatası." },
      { status: 500 }
    )
  }
}
