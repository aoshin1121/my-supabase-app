// app/dashboard/sales/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import SalesForm from "../SalesForm";

export default function SalesPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);

      // ① ログインユーザー取得
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setMessage("ログインしてください。");
        setLoading(false);
        return;
      }

      // ② profiles から store_id を取得
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("load profile error:", profileError);
        setMessage("店舗情報の取得に失敗しました。");
        setLoading(false);
        return;
      }

      if (!profile.store_id) {
        setMessage("店舗が設定されていません。設定画面から店舗を登録してください。");
        setLoading(false);
        return;
      }

      setStoreId(profile.store_id);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {message && (
        <p className="text-sm text-red-400 whitespace-pre-line">
          {message}
        </p>
      )}

      {/* ③ storeId を渡して SalesForm を使う */}
      <SalesForm storeId={storeId} />
    </div>
  );
}
