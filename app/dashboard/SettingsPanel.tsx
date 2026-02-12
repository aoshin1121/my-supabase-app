// app/dashboard/SettingsPanel.tsx
'use client';

export default function SettingsPanel() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">設定</h2>

      <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-200">
        <p>ここにユーザー設定や店舗設定などのフォームを追加していきます。</p>
        <p className="mt-2 text-xs text-slate-400">
          ※ 今はダミー画面です。あとで項目を一緒に作ろう。
        </p>
      </div>
    </div>
  );
}
