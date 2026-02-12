// app/dashboard/ContactPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";

type Contact = {
  id: number;
  user_id: string;
  email: string | null;
  body: string | null;
  status: string | null;
  created_at: string;
  reply_body?: string | null;
  replied_at?: string | null;
};

export default function ContactPanel() {
  const router = useRouter();

  // ログイン情報
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  // フォーム
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 履歴
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

  // ------------------------------
  // 履歴取得（user_id の分だけ）
  // ------------------------------
  const fetchContactsByUserId = async (uid: string) => {
    if (!uid) return;

    setLoadingContacts(true);
    setListError(null);

    const { data, error } = await supabase
      .from("contacts")
      .select("id, user_id, email, body, status, created_at, reply_body, replied_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetch contacts error:", error);
      setListError(error.message);
      setContacts([]);
    } else {
      setContacts((data ?? []) as Contact[]);
    }

    setLoadingContacts(false);
  };

  // ------------------------------
  // 初回：ログインユーザー取得（email固定）
  // ------------------------------
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("auth.getUser error:", error);
      }

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");

      await fetchContactsByUserId(user.id);
    };

    loadUser();
  }, [router]);

  // ------------------------------
  // Realtime: contacts にINSERTが来たら、自分の分だけ反映
  // （管理者がDB側で追記しても、履歴をすぐ更新できる）
  // ------------------------------
  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel("contacts-realtime-user")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contacts" },
        (payload) => {
          const row = payload.new as { user_id?: string | null };
          if (!row?.user_id) return;
          if (row.user_id !== userId) return;
          fetchContactsByUserId(userId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "contacts" },
        (payload) => {
          const row = payload.new as { user_id?: string | null };
          if (!row?.user_id) return;
          if (row.user_id !== userId) return;
          fetchContactsByUserId(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  // ------------------------------
  // 問い合わせ送信（user_id も保存）
  // ------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      setStatus("error");
      setErrorMsg("ログイン情報が取得できません。ログインし直してください。");
      return;
    }

    const trimmed = body.trim();
    if (!trimmed) {
      setStatus("error");
      setErrorMsg("お問い合わせ内容を入力してください。");
      return;
    }

    setStatus("sending");
    setErrorMsg(null);

    const { error } = await supabase.from("contacts").insert({
      user_id: userId,
      email: email || null,
      body: trimmed,
      status: "open",
    });

    if (error) {
      console.error("contact insert error:", error);
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    setStatus("success");
    setBody("");

    // 送信後に履歴更新
    await fetchContactsByUserId(userId);
  };

  const hasReply = useMemo(
    () => contacts.some((c) => !!c.reply_body),
    [contacts]
  );

  return (
    <div className="space-y-8">
      {/* フォーム */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">お問い合わせ</h2>
          {hasReply && (
            <span className="text-[11px] rounded-full bg-emerald-200 text-emerald-800 px-2 py-0.5">
              返信あり
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">
              メールアドレス（ログイン中のアカウント）
            </label>
            <input
              type="email"
              className="w-full rounded-md bg-slate-900 border border-slate-600 px-3 py-2 text-sm opacity-90"
              value={email}
              readOnly
            />
            <p className="text-[11px] text-slate-400 mt-1">
              ※メールは自動取得されます（編集できません）
            </p>
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
            disabled={status === "sending" || !userId}
          >
            {status === "sending" ? "送信中..." : "送信する"}
          </button>
        </form>
      </div>

      {/* 履歴 */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
        <h2 className="text-lg font-semibold mb-3">過去のお問い合わせ</h2>

        {!userId ? (
          <p className="text-sm text-slate-400">ログイン情報を取得中...</p>
        ) : loadingContacts ? (
          <p className="text-sm text-slate-400">履歴を読み込み中...</p>
        ) : listError ? (
          <p className="text-sm text-red-400">{listError}</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-slate-400">まだ問い合わせ履歴はありません。</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="rounded-md bg-slate-900 border border-slate-700 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-slate-300 text-xs">
                    {formatDate(c.created_at)}
                  </div>
                  <span
                    className={`text-[10px] rounded-full px-2 py-0.5 ${
                      c.status === "返信済み" || c.status === "replied"
                        ? "bg-emerald-200 text-emerald-800"
                        : "bg-amber-200 text-amber-800"
                    }`}
                  >
                    {c.status ?? "open"}
                  </span>
                </div>

                <div className="text-slate-100 whitespace-pre-wrap break-words">
                  {c.body}
                </div>

                {/* 管理者返信（contacts に保存されてる場合） */}
                {c.reply_body && (
                  <div className="mt-3 rounded-md bg-slate-800 border border-slate-600 p-2 text-xs">
                    <div className="flex items-center justify-between mb-1 text-[10px] text-slate-300">
                      <span>管理者からの返信</span>
                      <span>{c.replied_at ? formatDate(c.replied_at) : ""}</span>
                    </div>
                    <div className="whitespace-pre-wrap break-words text-slate-100">
                      {c.reply_body}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
