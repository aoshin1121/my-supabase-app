"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../dashboard/supabaseClient";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("fetch announcements error:", error);
      } else if (data) {
        setItems(data as Announcement[]);
      }
      setLoading(false);
    };

    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
        <h1 className="text-xl font-bold">お知らせ一覧</h1>
        <Link
          href="/dashboard"
          className="text-sm text-sky-300 hover:underline"
        >
          ← ダッシュボードに戻る
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading && <p className="text-sm text-slate-300">読み込み中...</p>}

        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-300">現在お知らせはありません。</p>
        )}

        {items.map((a) => (
          <article
            key={a.id}
            className="bg-slate-800 rounded-xl p-4 space-y-2"
          >
            <div className="text-xs text-slate-400">
              {new Date(a.created_at).toLocaleString()}
            </div>
            <h2 className="text-base font-semibold">{a.title}</h2>
            <p className="text-sm whitespace-pre-line">{a.body}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
