// app/notifications/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../dashboard/supabaseClient";

type Notification = {
  id: number;
  user_id: string;
  title: string;
  message: string | null;
  created_at: string;
  is_read: boolean | null;
  is_deleted: boolean | null;
  contact_id: number | null;
};

function formatDateTimeJa(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dumpSupabaseError(error: any) {
  return {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    status: error?.status,
    name: error?.name,
  };
}

export default function NotificationsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const [items, setItems] = useState<Notification[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingList, setLoadingList] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // ------------------------------
  // 1) ログインユーザー取得
  // ------------------------------
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoadingUser(true);
      setErrorMsg(null);

      const { data, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error) {
        console.error("auth.getUser error:", dumpSupabaseError(error));
        setErrorMsg("ログイン情報の取得に失敗しました。");
        setLoadingUser(false);
        return;
      }

      const user = data.user;
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      setLoadingUser(false);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // ------------------------------
  // 2) お知らせ取得（削除されてないもの全て）
  // ★既読で消さない：is_read は表示にだけ使う
  // ------------------------------
  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    setLoadingList(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, user_id, title, message, created_at, is_read, is_deleted, contact_id"
      )
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load notifications error:", dumpSupabaseError(error));
      setErrorMsg(
        "お知らせの取得に失敗しました。（RLS/カラム/テーブル名を確認）\n" +
          (error.message ?? "")
      );
      setItems([]);
      setLoadingList(false);
      return;
    }

    setItems((data ?? []) as Notification[]);
    setLoadingList(false);
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ------------------------------
  // 3) Realtime：自分宛の INSERT だけ反応
  // ------------------------------
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  // ------------------------------
  // 4) 未読件数（表示は全件、カウントは未読だけ）
  // ------------------------------
  const unreadCount = useMemo(
    () => items.filter((x) => x.is_read !== true).length,
    [items]
  );

  // ------------------------------
  // 5) アクション：既読 / 未読 / 削除 / 全既読
  // ------------------------------
  const markOneRead = useCallback(
    async (id: number) => {
      if (!userId) return;

      setInfoMsg(null);
      setErrorMsg(null);

      // 体感：即バッジだけ変える（消さない）
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, is_read: true } : x))
      );

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        console.error("markOneRead error:", dumpSupabaseError(error));
        setErrorMsg("既読処理に失敗しました: " + (error.message ?? ""));
        loadNotifications();
      }
    },
    [userId, loadNotifications]
  );

  const markOneUnread = useCallback(
    async (id: number) => {
      if (!userId) return;

      setInfoMsg(null);
      setErrorMsg(null);

      // 体感：即バッジだけ変える
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, is_read: false } : x))
      );

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: false })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        console.error("markOneUnread error:", dumpSupabaseError(error));
        setErrorMsg("未読に戻す処理に失敗しました: " + (error.message ?? ""));
        loadNotifications();
      }
    },
    [userId, loadNotifications]
  );

  const deleteOne = useCallback(
    async (id: number) => {
      if (!userId) return;

      setInfoMsg(null);
      setErrorMsg(null);

      // ✅ 削除したら消す（要件どおり）
      setItems((prev) => prev.filter((x) => x.id !== id));

      const { error } = await supabase
        .from("notifications")
        .update({ is_deleted: true })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        console.error("deleteOne error:", dumpSupabaseError(error));
        setErrorMsg("削除に失敗しました: " + (error.message ?? ""));
        loadNotifications();
      }
    },
    [userId, loadNotifications]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    setInfoMsg(null);
    setErrorMsg(null);

    // 体感：即バッジだけ更新（消さない）
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_deleted", false);

    if (error) {
      console.error("markAllRead error:", dumpSupabaseError(error));
      setErrorMsg("既読処理に失敗しました: " + (error.message ?? ""));
      loadNotifications();
      return;
    }

    setInfoMsg("すべて既読にしました。");
  }, [userId, loadNotifications]);

  // ------------------------------
  // UI
  // ------------------------------
  if (loadingUser) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">お知らせ</h1>
         <div className="text-xs text-slate-300 mt-1">
  お知らせ {unreadCount} 件
</div>

        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            disabled={items.length === 0 || unreadCount === 0}
            className="inline-flex items-center rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            すべて既読
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            ← ダッシュボードに戻る
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div className="mb-3 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          {infoMsg}
        </div>
      )}

      {loadingList ? (
        <p className="text-sm text-slate-300">読み込み中...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-sm text-slate-200 font-semibold">お知らせは0件です。</p>
        </div>
      ) : (
        <>
          <div className="hidden md:grid grid-cols-12 gap-2 px-3 pb-2 text-[11px] text-slate-400">
            <div className="col-span-5">内容</div>
            <div className="col-span-3">日時</div>
            <div className="col-span-4 text-right">操作（既読/未読/削除/返信）</div>
          </div>

          <div className="space-y-3">
            {items.map((n) => {
              const isUnread = n.is_read !== true;

              return (
                <div
                  key={n.id}
                  className={`w-full rounded-xl border p-4 ${
                    isUnread
                      ? "border-blue-500 bg-slate-800"
                      : "border-slate-700 bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold break-words">
                        {n.title}
                        {isUnread ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold">
                            未読
                          </span>
                        ) : (
                          <span className="ml-2 inline-flex items-center rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-semibold">
                            既読
                          </span>
                        )}
                      </div>

                      {n.message && (
                        <div className="mt-2 text-sm text-slate-100 whitespace-pre-wrap break-words">
                          {n.message}
                        </div>
                      )}

                      <div className="mt-2 text-xs text-slate-300">
                        {formatDateTimeJa(n.created_at)}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 items-end">
                      <button
                        onClick={() => markOneRead(n.id)}
                        className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-700"
                      >
                        既読
                      </button>

                      <button
                        onClick={() => markOneUnread(n.id)}
                        className="rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-600"
                      >
                        未読
                      </button>

                      <button
                        onClick={() => deleteOne(n.id)}
                        className="rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold hover:bg-rose-700"
                      >
                        削除
                      </button>

                      {n.contact_id ? (
                        <Link
                          href={`/contacts/${n.contact_id}`}
                          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold hover:bg-indigo-700"
                        >
                          返信
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-500 border border-slate-700 cursor-not-allowed"
                        >
                          返信
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
