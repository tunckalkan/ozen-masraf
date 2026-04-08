import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const adminClient = createClient(supabaseUrl, serviceRoleKey)

async function getRequesterProfile(req: NextRequest) {
  try {
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
  } catch (err: any) {
    return { error: err?.message || "Yetki kontrolünde hata oluştu." }
  }
}

export async function GET(req: NextRequest) {
  try {
    const authCheck = await getRequesterProfile(req)

    if ("error" in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 })
    }

    const { data: users, error: usersError } = await adminClient
      .from("profiles")
      .select("id, full_name, email, role_id, manager_id, department_id, is_active")
      .order("is_active", { ascending: false })
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

    return NextResponse.json(
      {
        users: users || [],
        departments: departments || [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Kullanıcılar alınırken hata oluştu." },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
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

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "Ad soyad ve email zorunlu." },
        { status: 400 }
      )
    }

    if (![1, 2, 3].includes(Number(role_id))) {
      return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()

    let userId: string | null = null
    let authCreatedNow = false

    const { data: existingProfiles, error: existingProfilesError } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("email", normalizedEmail)

    if (existingProfilesError) {
      return NextResponse.json({ error: existingProfilesError.message }, { status: 400 })
    }

    if (existingProfiles && existingProfiles.length > 0) {
      userId = existingProfiles[0].id
    }

    if (!userId) {
      if (!password) {
        return NextResponse.json(
          { error: "Yeni kullanıcı için geçici şifre zorunlu." },
          { status: 400 }
        )
      }

      const { data: createdUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
        })

      if (!createError && createdUser.user) {
        userId = createdUser.user.id
        authCreatedNow = true
      } else {
        const alreadyRegistered =
          createError?.message?.toLowerCase().includes("already been registered") ||
          createError?.message?.toLowerCase().includes("already registered")

        if (alreadyRegistered) {
          const { data: authList, error: listError } =
            await adminClient.auth.admin.listUsers()

          if (listError) {
            return NextResponse.json({ error: listError.message }, { status: 400 })
          }

          const existingAuthUser = authList.users.find(
            (u) => (u.email || "").toLowerCase() === normalizedEmail
          )

          if (!existingAuthUser) {
            return NextResponse.json(
              { error: "Kullanıcı auth içinde var görünüyor ama bulunamadı." },
              { status: 400 }
            )
          }

          userId = existingAuthUser.id
        } else {
          return NextResponse.json(
            { error: createError?.message || "Kullanıcı oluşturulamadı." },
            { status: 400 }
          )
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Kullanıcı id alınamadı." }, { status: 400 })
    }

    const { data: existingProfileById, error: existingProfileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle()

    if (existingProfileError) {
      return NextResponse.json({ error: existingProfileError.message }, { status: 400 })
    }

    if (existingProfileById) {
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({
          full_name,
          email: normalizedEmail,
          role_id: Number(role_id),
          manager_id: manager_id || null,
          department_id: department_id ? Number(department_id) : null,
          is_active: is_active ?? true,
        })
        .eq("id", userId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        mode: "updated_existing_user",
        message: "Mevcut kullanıcı güncellendi.",
      })
    }

    const { error: profileInsertError } = await adminClient.from("profiles").insert([
      {
        id: userId,
        full_name,
        email: normalizedEmail,
        role_id: Number(role_id),
        manager_id: manager_id || null,
        department_id: department_id ? Number(department_id) : null,
        is_active: is_active ?? true,
      },
    ])

    if (profileInsertError) {
      if (authCreatedNow) {
        await adminClient.auth.admin.deleteUser(userId)
      }

      return NextResponse.json({ error: profileInsertError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      mode: "created_new_user",
      message: "Yeni kullanıcı oluşturuldu.",
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Kullanıcı oluşturma sırasında hata oluştu." },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
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

    return NextResponse.json({
      success: true,
      message: "Kullanıcı güncellendi.",
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Kullanıcı güncelleme sırasında hata oluştu." },
      { status: 500 }
    )
  }
}