// app/contact/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../dashboard/supabaseClient";

type Contact = {
  id: number;
  email: string;
  body: string;
  created_at: string;
};

export default function ContactPage() {
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const fetchContacts = async (emailValue: string) => {
    if (!emailValue) return;

    setLoadingContacts(true);
    setListError(null);

    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("email", emailValue)
      .order("created_at", { ascending: false });

    if (error) {
      setListError(error.message);
      setContacts([]);
    } else {
      setContacts((data || []) as Contact[]);
    }

    setLoadingContacts(false);
  };

  const handleEmailBlur = () => {
    if (email) {
      fetchContacts(email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);

    const { error } = await supabase.from("contacts").insert({
      email,
      body,
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    setStatus("success");
    setBody("");
    await fetchContacts(email);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">問い合わせ</h1>

        {/* ---------------- フォーム ---------------- */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg bg-slate-800 px-4 py-5"
        >
          <div>
            <label className="block text-sm mb-1">
              メールアドレス（ログイン中のアカウント）
            </label>
            <input
              type="email"
              className="w-full rounded-md bg-slate-900 border border-slate-600 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">お問い合わせ内容</label>
            <textarea
              className="w-full h-40 rounded-md bg-slate-900 border border-slate-600 px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="困っていること・質問などを書いてください"
              required
            />
          </div>

          {status === "error" && (
            <p className="text-xs text-red-400">
              送信に失敗しました。
              <br />
              {errorMsg}
            </p>
          )}
          {status === "success" && (
            <p className="text-xs text-emerald-400">
              送信しました。ありがとうございます！
            </p>
          )}

          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-blue-500 text-sm font-semibold disabled:opacity-50"
            disabled={status === "sending"}
          >
            {status === "sending" ? "送信中..." : "送信する"}
          </button>
        </form>

        {/* ★★★ ここに移動：ダッシュボードに戻る ★★★ */}
        <Link
          href="/dashboard"
          className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold"
        >
          ダッシュボードへ戻る
        </Link>

        {/* ---------------- 履歴 ---------------- */}
        <div className="space-y-2 mt-4">
          <h2 className="text-lg font-semibold">過去のお問い合わせ</h2>

          {!email ? (
            <p className="text-sm text-slate-400">
              メールアドレスを入力すると、このメールで送った問い合わせ履歴が表示されます。
            </p>
          ) : loadingContacts ? (
            <p className="text-sm text-slate-400">履歴を読み込み中...</p>
          ) : listError ? (
            <p className="text-sm text-red-400">{listError}</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-slate-400">
              このメールアドレスでの問い合わせ履歴はまだありません。
            </p>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="rounded-md bg-slate-800 border border-slate-700 p-3 text-sm"
                >
                  <div className="text-slate-300 text-xs mb-1">
                    {formatDate(c.created_at)}
                  </div>
                  <div className="text-slate-100 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {c.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
