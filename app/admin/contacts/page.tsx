// app/admin/contacts/page.tsx
"use client";

import { useEffect, useMemo, useState, FormEvent, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../dashboard/supabaseClient";

type Contact = {
  id: number;
  user_id: string | null;
  store_id: string | null;
  email: string | null;
  body: string | null;
  status: string | null;
  created_at: string;
  reply_body: string | null;
  replied_at: string | null;
};

type UserKeyRow = {
  user_id: string;
  email: string | null;
  store_id: string | null;
};

function formatSupabaseError(err: any) {
  if (!err) return "";
  const code = err.code ?? "";
  const message = err.message ?? "";
  const details = err.details ?? "";
  const hint = err.hint ?? "";
  const status = err.status ?? "";
  return `status=${status} code=${code} message=${message} details=${details} hint=${hint}`.trim();
}

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminContactsPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserKeyRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // ------------------------------
  // 0) 管理者ガード（profiles.role）
  // ------------------------------
  useEffect(() => {
    const guard = async () => {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr) {
        console.error("auth.getUser error:", authErr);
      }

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("profile read error:", error);
        router.push("/dashboard");
        return;
      }

      if ((profile?.role ?? "staff") !== "admin") {
        router.push("/dashboard");
      }
    };

    guard();
  }, [router]);

  // ------------------------------
  // 1) 切り替え用ユーザー一覧（contactsから user_id を集約）
  // ------------------------------
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { data, error } = await supabase
      .from("contacts")
      .select("user_id, email, store_id, created_at")
      .not("user_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadUsers error:", error);
      setErrorMsg("ユーザー一覧の取得に失敗しました。\n" + formatSupabaseError(error));
      setUsers([]);
      setLoadingUsers(false);
      return;
    }

    // user_id ごとに最新の email/store_id を採用（created_at desc の順で先勝ち）
    const map = new Map<string, UserKeyRow>();
    (data ?? []).forEach((row: any) => {
      const uid = row.user_id as string | null;
      if (!uid) return;
      if (!map.has(uid)) {
        map.set(uid, {
          user_id: uid,
          email: row.email ?? null,
          store_id: row.store_id ?? null,
        });
      }
    });

    const list = Array.from(map.values());
    setUsers(list);

    // 初回は先頭を自動選択
    setSelectedUserId((prev) => (prev ? prev : list[0]?.user_id ?? ""));

    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ------------------------------
  // 2) 選択ユーザーの問い合わせ一覧
  // ------------------------------
  const loadContacts = useCallback(async (uid: string) => {
    if (!uid) {
      setContacts([]);
      return;
    }

    setLoadingContacts(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { data, error } = await supabase
      .from("contacts")
      .select("id, user_id, store_id, email, body, status, created_at, reply_body, replied_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("loadContacts error:", error);
      setErrorMsg("問い合わせ一覧の取得に失敗しました。\n" + formatSupabaseError(error));
      setContacts([]);
    } else {
      setContacts((data ?? []) as Contact[]);
    }

    setLoadingContacts(false);
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setContacts([]);
      setSelectedContactId(null);
      setReplyText("");
      return;
    }
    loadContacts(selectedUserId);
    setSelectedContactId(null);
    setReplyText("");
  }, [selectedUserId, loadContacts]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  const selectedUser = useMemo(
    () => users.find((u) => u.user_id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  // ------------------------------
  // 3) 返信送信：contacts 更新 + notifications 作成
  // ------------------------------
  const handleReplySubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedContact) return;
    if (!replyText.trim()) return;

    setSendingReply(true);
    setInfoMsg(null);
    setErrorMsg(null);

    const nowIso = new Date().toISOString();
    const replyBody = replyText.trim();

    // (A) contacts 更新
    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        reply_body: replyBody,
        replied_at: nowIso,
        status: "返信済み",
      })
      .eq("id", selectedContact.id);

    if (updateError) {
      console.error("update contact error:", updateError);
      setErrorMsg("問い合わせの更新に失敗しました。\n" + formatSupabaseError(updateError));
      setSendingReply(false);
      return;
    }

    // user_id が無い問い合わせは通知できない（要件：送り主だけに返す → user_id が必須）
    if (!selectedContact.user_id) {
      setErrorMsg("この問い合わせは user_id が無いため通知できません（古いデータの可能性）。");
      setSendingReply(false);
      await loadContacts(selectedUserId);
      return;
    }

    // (B) notifications 作成
    // ★DBの notifications.email が NOT NULL のため、必ず文字列を入れる
    // 優先：問い合わせのemail → ユーザー一覧のemail → ダミー（最終保険）
    const emailForNotif =
      selectedContact.email ?? selectedUser?.email ?? "unknown@example.com";

    const insertPayload = {
      user_id: selectedContact.user_id, // 宛先：問い合わせを送ってきた人のみ（要件）
      contact_id: selectedContact.id, // 返信導線（/contacts/{id}）用
      email: emailForNotif, // NOT NULL 対策
      title: "お問い合わせへの返信",
      message: replyBody,
      is_read: false,
      is_deleted: false,
      // created_at はDBの default(now()) に任せる想定
    };

    const { error: notifError } = await supabase.from("notifications").insert(insertPayload);

    if (notifError) {
      console.error("insert notification error:", notifError);
      setErrorMsg(
        "返信は保存されましたが、お知らせの作成に失敗しました。\n" + formatSupabaseError(notifError)
      );
    } else {
      setInfoMsg("返信を保存し、お知らせを作成しました。");
    }

    setReplyText("");
    setSendingReply(false);
    await loadContacts(selectedUserId);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">問い合わせ管理（管理者用）</h1>

        <Link
          href="/admin/dashboard"
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          ← 管理者ダッシュボードに戻る
        </Link>
      </div>

      {errorMsg && (
        <div className="mb-3 whitespace-pre-wrap rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div className="mb-3 whitespace-pre-wrap rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          {infoMsg}
        </div>
      )}

      {/* ユーザー切り替え */}
      <div className="mb-4 rounded-lg bg-slate-800 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm">アカウント切り替え：</span>

        {loadingUsers ? (
          <span className="text-sm text-slate-300">読み込み中...</span>
        ) : users.length === 0 ? (
          <span className="text-sm text-slate-300">まだ問い合わせがありません。</span>
        ) : (
          <select
            className="rounded-md bg-slate-900 border border-slate-600 px-3 py-1 text-sm"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {(u.email ?? "emailなし") + " / " + u.user_id.slice(0, 8) + "..."}
              </option>
            ))}
          </select>
        )}

        {selectedUser && (
          <span className="text-xs text-slate-300">
            store_id: {selectedUser.store_id ?? "-"}
          </span>
        )}

        <button
          type="button"
          onClick={loadUsers}
          className="ml-auto rounded-md bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
        >
          ユーザー一覧を更新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左：問い合わせ一覧 */}
        <div className="bg-slate-800 rounded-xl p-3">
          <h2 className="text-sm font-semibold mb-2">問い合わせ一覧</h2>

          {loadingContacts ? (
            <p className="text-sm text-slate-300">読み込み中...</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-slate-300">このユーザーの問い合わせはありません。</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedContactId(c.id)}
                  className={`w-full text-left rounded-md border px-3 py-2 text-sm ${
                    selectedContactId === c.id
                      ? "bg-blue-900/60 border-blue-500"
                      : "bg-slate-900 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] text-slate-300">{formatDateTime(c.created_at)}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.status === "返信済み"
                          ? "bg-emerald-200 text-emerald-800"
                          : "bg-amber-200 text-amber-800"
                      }`}
                    >
                      {c.status ?? "受付中"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-100 line-clamp-2">{c.body}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右：詳細 + 返信フォーム */}
        <div className="bg-slate-800 rounded-xl p-3 space-y-3">
          <h2 className="text-sm font-semibold mb-2">詳細・返信</h2>

          {!selectedContact ? (
            <p className="text-sm text-slate-300">左の一覧から選択してください。</p>
          ) : (
            <>
              <div className="rounded-md bg-slate-900 border border-slate-700 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  <span>{selectedContact.email ?? "(emailなし)"}</span>
                  <span>{formatDateTime(selectedContact.created_at)}</span>
                </div>

                <div className="text-[11px] text-slate-400">
                  user_id: {selectedContact.user_id ?? "(なし)"} / store_id: {selectedContact.store_id ?? "(なし)"}
                </div>

                <div className="text-slate-100 whitespace-pre-wrap break-words">
                  {selectedContact.body}
                </div>

                {selectedContact.reply_body && (
                  <div className="mt-3 rounded-md bg-slate-800 border border-slate-600 p-2 text-xs">
                    <div className="flex items-center justify-between mb-1 text-[10px] text-slate-300">
                      <span>管理者からの返信</span>
                      <span>{formatDateTime(selectedContact.replied_at)}</span>
                    </div>
                    <div className="whitespace-pre-wrap break-words text-slate-100">
                      {selectedContact.reply_body}
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleReplySubmit} className="space-y-2">
                <label className="block text-xs text-slate-300">この問い合わせへの返信内容</label>
                <textarea
                  className="w-full h-32 rounded-md bg-slate-900 border border-slate-600 px-3 py-2 text-sm"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="ユーザーに送る返信内容を入力してください"
                />

                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  className="px-4 py-2 rounded-md bg-blue-500 text-sm font-semibold disabled:opacity-50"
                >
                  {sendingReply ? "送信中..." : "この問い合わせに返信＆お知らせ送信"}
                </button>

                <p className="text-[11px] text-slate-400">
                  ※お知らせは「この問い合わせの user_id（送信者本人）」にのみ送られます。
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

