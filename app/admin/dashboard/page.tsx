// app/admin/dashboard/page.tsx
"use client";

import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white px-6 py-6">
      <h1 className="text-2xl font-bold mb-6">管理者ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/contacts"
          className="block rounded-xl bg-slate-800 p-5 hover:bg-slate-700"
        >
          <div className="text-lg font-semibold">問い合わせ管理</div>
          <div className="text-sm text-slate-300 mt-1">
            各店舗/各アカウントの問い合わせ確認・返信
          </div>
        </Link>

        <Link
          href="/dashboard"
          className="block rounded-xl bg-slate-800 p-5 hover:bg-slate-700"
        >
          <div className="text-lg font-semibold">ユーザーダッシュボードへ</div>
          <div className="text-sm text-slate-300 mt-1">
            通常の店舗ダッシュボードに戻る
          </div>
        </Link>
      </div>
    </main>
  );
}
