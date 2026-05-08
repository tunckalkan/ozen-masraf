import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
  try {
    console.log("UPLOAD API START")

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("UPLOAD ENV MISSING")
      return NextResponse.json(
        { error: "Supabase server anahtarları eksik." },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    console.log("FORMDATA OK")

    const file = formData.get("file") as File | null
    const expenseIdRaw = formData.get("expenseId") as string | null
    const userId = formData.get("userId") as string | null

    if (!file || !expenseIdRaw || !userId) {
      console.error("UPLOAD MISSING DATA")
      return NextResponse.json(
        { error: "Eksik dosya, expenseId veya userId." },
        { status: 400 }
      )
    }

    const expenseId = Number(expenseIdRaw)

    if (!Number.isFinite(expenseId)) {
      return NextResponse.json(
        { error: "Geçersiz expenseId." },
        { status: 400 }
      )
    }

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Dosya 12 MB sınırını aşıyor." },
        { status: 400 }
      )
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "application/pdf",
    ])

    if (file.type && !allowedTypes.has(file.type)) {
      return NextResponse.json(
        { error: `Desteklenmeyen dosya tipi: ${file.type}` },
        { status: 400 }
      )
    }

    console.log("FILE OK", file.name, file.type, file.size)

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const originalName = file.name || "fis"
    const extension =
      originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"

    const safeName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}.${extension}`

    const filePath = `expenses/${expenseId}/${safeName}`

    const bytes = await file.arrayBuffer()
    console.log("ARRAY BUFFER OK", bytes.byteLength)

    const { error: uploadError } = await supabase.storage
      .from("expense-files")
      .upload(filePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      })

    if (uploadError) {
      console.error("STORAGE UPLOAD ERROR", uploadError)
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    console.log("STORAGE UPLOAD OK", filePath)

    const { data: publicData } = supabase.storage
      .from("expense-files")
      .getPublicUrl(filePath)

    const { error: dbError } = await supabase.from("expense_files").insert([
      {
        expense_id: expenseId,
        file_name: originalName,
        file_path: filePath,
        file_url: publicData.publicUrl,
        uploaded_by: userId,
      },
    ])

    if (dbError) {
      console.error("EXPENSE FILE DB ERROR", dbError)
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      )
    }

    console.log("UPLOAD API SUCCESS", publicData.publicUrl)

    return NextResponse.json({
      success: true,
      file_path: filePath,
      file_url: publicData.publicUrl,
    })
  } catch (err: any) {
    console.error("UPLOAD API ERROR", err)

    return NextResponse.json(
      { error: err?.message || "Server upload hatası." },
      { status: 500 }
    )
  }
}
