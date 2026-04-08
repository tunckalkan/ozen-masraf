import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const adminClient = createClient(supabaseUrl, serviceRoleKey)

async function getRequesterProfile(req: NextRequest) {
  const authHeader = req.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Yetkisiz istek." }
  }

  const token = authHeader.replace("Bearer ", "")

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return { error: "Kullanıcı doğrulanamadı." }
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role_id")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { error: "Profil bulunamadı." }
  }

  if (profile.role_id !== 2) {
    return { error: "Bu işlem için yetkiniz yok." }
  }

  return { user, profile }
}

export async function GET(req: NextRequest) {
  const authCheck = await getRequesterProfile(req)
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 })
  }

  const { data: users, error: usersError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role_id, manager_id, department_id, is_active")
    .order("full_name", { ascending: true })

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 })
  }

  const { data: departments, error: departmentsError } = await adminClient
    .from("departments")
    .select("id, name")
    .order("name", { ascending: true })

  if (departmentsError) {
    return NextResponse.json({ error: departmentsError.message }, { status: 400 })
  }

  return NextResponse.json({
    users: users || [],
    departments: departments || [],
  })
}

export async function POST(req: NextRequest) {
  const authCheck = await getRequesterProfile(req)
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 })
  }

  const body = await req.json()

  const {
    full_name,
    email,
    password,
    role_id,
    manager_id,
    department_id,
    is_active,
  } = body

  if (!full_name || !email || !password) {
    return NextResponse.json(
      { error: "Ad soyad, email ve şifre zorunlu." },
      { status: 400 }
    )
  }

  if (![1, 2, 3].includes(Number(role_id))) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 })
  }

  const { data: createdUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

  if (createError || !createdUser.user) {
    return NextResponse.json(
      { error: createError?.message || "Kullanıcı oluşturulamadı." },
      { status: 400 }
    )
  }

  const userId = createdUser.user.id

  const { error: profileInsertError } = await adminClient.from("profiles").insert([
    {
      id: userId,
      full_name,
      email,
      role_id: Number(role_id),
      manager_id: manager_id || null,
      department_id: department_id ? Number(department_id) : null,
      is_active: is_active ?? true,
    },
  ])

  if (profileInsertError) {
    await adminClient.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: profileInsertError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const authCheck = await getRequesterProfile(req)
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 })
  }

  const body = await req.json()
  const { id, full_name, role_id, manager_id, department_id, is_active } = body

  if (!id) {
    return NextResponse.json({ error: "Kullanıcı id gerekli." }, { status: 400 })
  }

  const updatePayload: Record<string, any> = {}

  if (typeof full_name === "string") updatePayload.full_name = full_name
  if (role_id !== undefined) updatePayload.role_id = Number(role_id)
  if (manager_id !== undefined) updatePayload.manager_id = manager_id || null
  if (department_id !== undefined) {
    updatePayload.department_id = department_id ? Number(department_id) : null
  }
  if (is_active !== undefined) updatePayload.is_active = Boolean(is_active)

  const { error } = await adminClient
    .from("profiles")
    .update(updatePayload)
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}