import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const file = formData.get("file") as File | null
    const expenseId = formData.get("expenseId") as string | null
    const userId = formData.get("userId") as string | null

    if (!file || !expenseId || !userId) {
      return NextResponse.json(
        { error: "Eksik veri" },
        { status: 400 }
      )
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg"

    const safeName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}.${extension}`

    const filePath = `expenses/${expenseId}/${safeName}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: uploadError } = await supabase.storage
      .from("expense-files")
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    const { data: publicData } = supabase.storage
      .from("expense-files")
      .getPublicUrl(filePath)

    const { error: dbError } = await supabase
      .from("expense_files")
      .insert([
        {
          expense_id: Number(expenseId),
          file_name: file.name,
          file_path: filePath,
          file_url: publicData.publicUrl,
          uploaded_by: userId,
        },
      ])

    if (dbError) {
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      file_url: publicData.publicUrl,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Upload hatası" },
      { status: 500 }
    )
  }
}