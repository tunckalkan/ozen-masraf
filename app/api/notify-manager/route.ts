import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { expenseId } = body as { expenseId?: number }

    if (!expenseId) {
      return NextResponse.json({ error: "expenseId zorunlu." }, { status: 400 })
    }

    const { data: expense, error: expenseError } = await supabaseAdmin
      .from("expenses")
      .select(`
        id,
        user_id,
        expense_date,
        vendor_name,
        description,
        amount,
        currency_code,
        category,
        payment_method,
        status
      `)
      .eq("id", expenseId)
      .single()

    if (expenseError || !expense) {
      return NextResponse.json(
        { error: expenseError?.message || "Masraf bulunamadı." },
        { status: 404 }
      )
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, manager_id")
      .eq("id", expense.user_id)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: employeeError?.message || "Personel profili bulunamadı." },
        { status: 404 }
      )
    }

    if (!employee.manager_id) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Bu kullanıcıya bağlı yönetici yok.",
      })
    }

    const { data: manager, error: managerError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", employee.manager_id)
      .single()

    if (managerError || !manager) {
      return NextResponse.json(
        { error: managerError?.message || "Yönetici profili bulunamadı." },
        { status: 404 }
      )
    }

    if (!manager.email) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Yöneticinin email adresi tanımlı değil.",
      })
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://masraf.ozeniplik.com.tr"
    const from = process.env.EMAIL_FROM

    if (!from) {
      return NextResponse.json(
        { error: "EMAIL_FROM env eksik." },
        { status: 500 }
      )
    }

    const subject = `Yeni masraf girişi - ${employee.full_name || "Personel"}`

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Yeni masraf girişi</h2>
        <p>Bağlı personeliniz yeni bir masraf girişi yaptı.</p>

        <table cellpadding="6" cellspacing="0" border="0">
          <tr><td><strong>Personel:</strong></td><td>${employee.full_name || "-"}</td></tr>
          <tr><td><strong>Tarih:</strong></td><td>${expense.expense_date || "-"}</td></tr>
          <tr><td><strong>Firma:</strong></td><td>${expense.vendor_name || "-"}</td></tr>
          <tr><td><strong>Açıklama:</strong></td><td>${expense.description || "-"}</td></tr>
          <tr><td><strong>Kategori:</strong></td><td>${expense.category || "-"}</td></tr>
          <tr><td><strong>Tutar:</strong></td><td>${expense.amount ?? 0} ${expense.currency_code || "TRY"}</td></tr>
          <tr><td><strong>Ödeme Yöntemi:</strong></td><td>${expense.payment_method || "-"}</td></tr>
          <tr><td><strong>Durum:</strong></td><td>${expense.status || "-"}</td></tr>
        </table>

        <p style="margin-top: 18px;">
          Sisteme girerek onay işlemini gerçekleştirebilirsiniz:
        </p>

        <p>
          <a href="${appUrl}" target="_blank" rel="noreferrer">${appUrl}</a>
        </p>
      </div>
    `

    const { data, error } = await resend.emails.send({
      from,
      to: [manager.email],
      subject,
      html,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      emailId: data?.id || null,
      managerEmail: manager.email,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Mail gönderim hatası." },
      { status: 500 }
    )
  }
}
