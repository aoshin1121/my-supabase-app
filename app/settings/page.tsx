// app/settings/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "../dashboard/supabaseClient";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [message, setMessage] = useState("");

  // Store
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("ログイン情報がありません。");
        setLoading(false);
        return;
      }

      // profiles 読み込み（store_id も一緒に取る）
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("display_name, icon_url, store_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr || !prof) {
        console.error("load profile error:", profErr);
        setMessage("プロフィール情報の取得に失敗しました。");
        setLoading(false);
        return;
      }

      setDisplayName(prof.display_name ?? "");
      setIconUrl(prof.icon_url ?? "");
      const currentStoreId = (prof.store_id as string | null) ?? null;
      setStoreId(currentStoreId);

      // store 情報を profiles.store_id から取得
      if (currentStoreId) {
        const { data: storeRow, error: storeErr } = await supabase
          .from("stores")
          .select("id, name")
          .eq("id", currentStoreId)
          .maybeSingle();

        if (storeErr) {
          console.error("load store error:", storeErr);
          setMessage("店舗情報の取得に失敗しました。");
        } else if (storeRow) {
          setStoreName(storeRow.name ?? "");
        }
      } else {
        setMessage("店舗情報が設定されていません。");
      }

      setLoading(false);
    };

    load();
  }, []);

  // プロフィール保存
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("ログイン情報がありません。");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        icon_url: iconUrl,
      })
      .eq("id", user.id);

    if (error) {
      console.error("save profile error:", error);
      alert("プロフィールの保存に失敗しました");
      return;
    }

    alert("プロフィールを保存しました！");
  };

  // 店舗名保存
  const handleSaveStoreName = async () => {
    if (!storeId) {
      alert("店舗情報がありません。");
      return;
    }

    const { error } = await supabase
      .from("stores")
      .update({ name: storeName })
      .eq("id", storeId);

    if (error) {
      console.error("save store error:", error);
      alert("店舗名の保存に失敗しました");
      return;
    }

    alert("店舗名を保存しました！");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* ヘッダー：タイトルだけ */}
      <header className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-bold">設定</h1>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* メッセージ */}
        {message && <p className="text-sm text-red-400 mb-2">{message}</p>}

        {/* プロフィール設定 */}
        <section className="bg-slate-800 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-bold">プロフィール設定</h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">表示名</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border rounded px-3 py-2 bg-white text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                アイコン画像URL（任意）
              </label>
              <input
                type="text"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                className="w-full border rounded px-3 py-2 bg-white text-black"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
            >
              プロフィールを保存
            </button>
          </form>
        </section>

        {/* 店舗設定 */}
        <section className="bg-slate-800 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-bold">店舗設定</h2>

          <div>
            <label className="block text-sm font-medium mb-1">店舗名</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full border rounded px-3 py-2 bg-white text-black"
            />
          </div>

          {/* 店舗名を保存ボタン */}
          <button
            onClick={handleSaveStoreName}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
          >
            店舗名を保存
          </button>

          {/* ★ ここにダッシュボードへ戻るボタン（緑） */}
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-block px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
            >
              ダッシュボードへ戻る
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
