// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../dashboard/supabaseClient";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [storeName, setStoreName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resetMessages = () => setMessage(null);

  // 🔑 ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email || !password) {
      setMessage("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(
        "ログインに失敗しました。メールまたはパスワードを確認してください。"
      );
      console.error("login error:", error);
      return;
    }

    router.push("/dashboard");
  };

  // 🆕 新規登録（ユーザー＋店舗＋プロフィール）
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email || !password || !storeName || !displayName) {
      setMessage("必要項目をすべて入力してください。");
      return;
    }

    setLoading(true);

    // 1. ユーザー作成
    const {
      data: signUpData,
      error: signUpError,
    } = await supabase.auth.signUp({ email, password });

    if (signUpError || !signUpData.user) {
      console.error("signup error:", signUpError);
      if (
        signUpError &&
        typeof signUpError.message === "string" &&
        signUpError.message.includes("User already registered")
      ) {
        setMessage("このメールアドレスはすでに登録されています。ログインしてください。");
      } else {
        setMessage("新規登録に失敗しました。");
      }
      setLoading(false);
      return;
    }

    const user = signUpData.user;

    // 👑 role を決定：このメールアドレスだけ admin、それ以外は staff
    const role: "admin" | "staff" =
      email === "aoshin1121@outlook.jp" ? "admin" : "staff";

    // 2. 店舗作成（新規登録画面で入力した店舗名をそのまま使う）
    const storeCode =
      "store_" +
      Math.random().toString(36).slice(2, 8) +
      "_" +
      Date.now().toString(36);

    const { data: storeRow, error: storeErr } = await supabase
      .from("stores")
      .insert({ code: storeCode, name: storeName })
      .select("id")
      .single();

    if (storeErr || !storeRow) {
      console.error("create store error:", storeErr);
      setMessage("店舗作成に失敗しました。");
      setLoading(false);
      return;
    }

    const storeId = storeRow.id as string;

    // 3. プロフィール作成（既にあっても OK なように upsert）
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          store_id: storeId,
          role, // admin or staff
          display_name: displayName,
          avatar_url: avatarUrl || null,
        },
        {
          onConflict: "id", // id が同じなら更新扱い
        }
      );

    if (profileErr) {
      console.error("create profile error:", profileErr);
      setMessage("プロフィール作成に失敗しました。");
      setLoading(false);
      return;
    }

    setMessage("登録完了！ダッシュボードへ移動します…");
    setLoading(false);

    setTimeout(() => {
      router.push("/dashboard");
    }, 700);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white px-4">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">
          ログイン / 新規登録
        </h1>

        {/* モード切り替え */}
        <div className="flex mb-6 border-b border-slate-700 text-sm">
          <button
            className={`flex-1 py-2 font-semibold ${
              mode === "login"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-400"
            }`}
            onClick={() => {
              setMode("login");
              resetMessages();
            }}
          >
            ログイン
          </button>
          <button
            className={`flex-1 py-2 font-semibold ${
              mode === "signup"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-400"
            }`}
            onClick={() => {
              setMode("signup");
              resetMessages();
            }}
          >
            新規登録
          </button>
        </div>

        {message && (
          <p className="mb-4 text-xs text-amber-300 whitespace-pre-line">
            {message}
          </p>
        )}

        {/* ログイン画面 */}
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs mb-1">メールアドレス</label>
              <input
                type="email"
                className="w-full rounded px-3 py-2 bg-slate-900 border border-slate-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs mb-1">パスワード</label>
              <input
                type="password"
                className="w-full rounded px-3 py-2 bg-slate-900 border border-slate-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? "処理中..." : "ログイン"}
            </button>
          </form>
        ) : (
          // 新規登録画面
          <form onSubmit={handleSignup} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs mb-1">メールアドレス</label>
              <input
                type="email"
                className="w-full rounded px-3 py-2 bg-slate-900 border border-slate-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs mb-1">パスワード</label>
              <input
                type="password"
                className="w-full rounded px-3 py-2 bg-slate-900 border border-slate-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs mb-1">店舗名</label>
              <input
                className="w-full rounded px-3 py-2 bg-slate-900 border border-slate-600"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs mb-1">表示名（あなたの名前）</label>
              <input
                className="w-full rounded px-3 py-2 bg-slate-900 border border-slate-600"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs mb-1">アイコンURL（任意）</label>
              <input
                className="w-full rounded px-3 py-2 bg-slate-900 border border-slate-600"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? "登録中..." : "新規登録"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
