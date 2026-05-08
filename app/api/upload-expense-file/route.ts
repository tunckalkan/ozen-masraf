import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    console.log("UPLOAD API START")

    const formData = await request.formData()

    console.log("FORMDATA OK")

    const file = formData.get("file") as File | null
    const expenseId = formData.get("expenseId") as string | null

    if (!file || !expenseId) {
      return NextResponse.json(
        { error: "Eksik dosya veya expenseId" },
        { status: 400 }
      )
    }

    console.log("FILE:", file.name)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const extension = file.name.split(".").pop() || "jpg"

    const safeName =
      `${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}.${extension}`

    const filePath = `expenses/${expenseId}/${safeName}`

    const bytes = await file.arrayBuffer()

    console.log("BUFFER READY")

    const { error: uploadError } = await supabase.storage
      .from("expense-files")
      .upload(filePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      })

    if (uploadError) {
      console.error(uploadError)

      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    const { data } = supabase.storage
      .from("expense-files")
      .getPublicUrl(filePath)

    console.log("UPLOAD SUCCESS")

    return NextResponse.json({
      success: true,
      filePath,
      publicUrl: data.publicUrl,
    })
  } catch (err: any) {
    console.error("UPLOAD API ERROR:", err)

    return NextResponse.json(
      {
        error: err?.message || "Server upload hatası",
      },
      { status: 500 }
    )
  }
}