"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from 'next/navigation';


const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("サインアップOK！確認メールをチェックしてね。");
          } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      setMessage("ログイン成功！");
      router.push("/dashboard");   // ★ここでダッシュボードへ
    }

    } catch (err: any) {
      setMessage(`エラー: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: 40, maxWidth: 480 }}>
      <h1>ログイン / サインアップ</h1>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setMode("signup")}
          style={{
            marginRight: 8,
            padding: "4px 12px",
            background: mode === "signup" ? "#16a34a" : "#333",
            color: "white",
            borderRadius: 4,
          }}
        >
          新規登録
        </button>
        <button
          onClick={() => setMode("signin")}
          style={{
            padding: "4px 12px",
            background: mode === "signin" ? "#16a34a" : "#333",
            color: "white",
            borderRadius: 4,
          }}
        >
          ログイン
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
        </div>

        <button
          type="submit"
          style={{
            width: "100%",
            padding: 10,
            background: "#22c55e",
            color: "white",
            borderRadius: 4,
            fontWeight: "bold",
          }}
        >
          {mode === "signup" ? "サインアップ" : "ログイン"}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 16, color: "white" }}>
          {message}
        </p>
      )}
    </div>
  );
}
