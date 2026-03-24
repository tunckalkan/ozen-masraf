import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("ENV eksik: NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const csvPath = path.join(process.cwd(), "personeller.csv");

if (!fs.existsSync(csvPath)) {
  console.error("personeller.csv bulunamadı.");
  process.exit(1);
}

const csvText = fs.readFileSync(csvPath, "utf8");

const records = parse(csvText, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

function toBool(value) {
  return String(value).toLowerCase() === "true";
}

async function main() {
  console.log(`CSV kayıt sayısı: ${records.length}`);

  const csvEmails = new Set();

  for (const row of records) {
    const full_name = row.full_name?.trim();
    const email = row.email?.toLowerCase().trim();
    const password = row.password?.trim();
    const department_id = Number(row.department_id);
    const role_id = Number(row.role_id);
    const is_active = toBool(row.is_active);

    if (!full_name || !email || !password || !department_id || !role_id) {
      console.log(`Atlandı (eksik alan): ${email || full_name || "bilinmiyor"}`);
      continue;
    }

    csvEmails.add(email);

    console.log(`İşleniyor: ${email}`);

    const { data: userListData, error: userListError } =
      await supabase.auth.admin.listUsers();

    if (userListError) {
      console.error(`Auth kullanıcı listesi alınamadı: ${userListError.message}`);
      continue;
    }

    const existingAuthUser = userListData.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    let userId = existingAuthUser?.id;

    if (!userId) {
      const { data: createdUser, error: createError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createError || !createdUser.user) {
        console.error(`Auth oluşturulamadı (${email}): ${createError?.message}`);
        continue;
      }

      userId = createdUser.user.id;
      console.log(`Auth oluşturuldu: ${email}`);
    } else {
      console.log(`Auth zaten var: ${email}`);
    }

    const { data: existingProfile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileCheckError) {
      console.error(`Profile kontrol hatası (${email}): ${profileCheckError.message}`);
      continue;
    }

    if (!existingProfile) {
      const { error: insertProfileError } = await supabase.from("profiles").insert([
        {
          id: userId,
          full_name,
          email,
          department_id,
          role_id,
          is_active,
        },
      ]);

      if (insertProfileError) {
        console.error(`Profile insert hatası (${email}): ${insertProfileError.message}`);
        continue;
      }

      console.log(`Profile oluşturuldu: ${email}`);
    } else {
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({
          full_name,
          email,
          department_id,
          role_id,
          is_active,
        })
        .eq("id", userId);

      if (updateProfileError) {
        console.error(`Profile update hatası (${email}): ${updateProfileError.message}`);
        continue;
      }

      console.log(`Profile güncellendi: ${email}`);
    }
  }

  // CSV'de olmayan kullanıcıları pasife çek
  const { data: allProfiles, error: allProfilesError } = await supabase
    .from("profiles")
    .select("id, email, role_id, is_active");

  if (allProfilesError) {
    console.error(`Tüm profiller alınamadı: ${allProfilesError.message}`);
    process.exit(1);
  }

  for (const profile of allProfiles || []) {
    const email = profile.email?.toLowerCase();

    if (!email) continue;

    // Sadece personel ve muhasebe rollerini pasife çek
    if (![1, 2].includes(profile.role_id)) continue;

    if (!csvEmails.has(email)) {
      const { error: passiveError } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", profile.id);

      if (passiveError) {
        console.error(`Pasife çekilemedi (${email}): ${passiveError.message}`);
        continue;
      }

      console.log(`Pasife çekildi: ${email}`);
    }
  }

  console.log("İşlem tamamlandı.");
}

main().catch((err) => {
  console.error("Genel hata:", err);
  process.exit(1);
});