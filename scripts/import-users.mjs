import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("ENV eksik!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// CSV dosya yolu
const filePath = path.join(process.cwd(), "personeller.csv");

// CSV oku
const fileContent = fs.readFileSync(filePath, "utf-8");

// parse
const records = parse(fileContent, {
  columns: true,
  skip_empty_lines: true,
});

console.log("CSV kayıt sayısı:", records.length);

// kullanıcı ekleme
for (const row of records) {
  const {
    full_name,
    email,
    password,
    department_id,
    role_id,
    is_active,
  } = row;

  if (!email || !password || !full_name) {
    console.log("Atlandı (eksik alan):", row);
    continue;
  }

  try {
    // auth user oluştur
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      console.log("Auth hata:", error.message);
      continue;
    }

    const userId = data.user.id;

    // profiles tablosuna ekle
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: userId,
        full_name,
        department_id: Number(department_id),
        role_id: Number(role_id),
        is_active: is_active === "true",
      },
    ]);

    if (profileError) {
      console.log("Profile hata:", profileError.message);
    } else {
      console.log("Eklendi:", email);
    }
  } catch (err) {
    console.log("Genel hata:", err.message);
  }
}
