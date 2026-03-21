"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Hata: " + error.message);
      return;
    }

    setMessage("Giriş başarılı.");

    // 🔥 EN KRİTİK SATIR
    router.push("/dashboard"); // veya "/" da olabilir
  };

  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>
      <h2>MASRAF SİSTEMİ</h2>

      <div style={{ marginTop: 20 }}>
        <div>Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div style={{ marginTop: 10 }}>Şifre</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div style={{ marginTop: 20 }}>
          <button onClick={handleLogin}>Giriş Yap</button>
        </div>

        <div style={{ marginTop: 20 }}>{message}</div>
      </div>
    </div>
  );
}
