// app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";

import SalesProfitChart from "./SalesProfitChart";
import ProductManager from "./ProductManager";
import SalesEntryPanel from "./SalesEntryPanel";
import PurchaseListPanel from "./PurchaseListPanel";
import { supabase } from "./supabaseClient";

type DailyRecord = {
  date: string; // YYYY-MM-DD
  sales: number;
  profit: number;
};

type ChartViewMode = "daily" | "monthly" | "customRange";
type ActiveMenu = "product" | "sales" | "dashboard" | "purchase";
type Role = "staff" | "admin";

type Store = {
  id: string;
  name: string;
  code: string;
};

// ✅ 管理者返信など「ユーザー個別通知」
type Notification = {
  id: number;
  user_id: string;
  title: string;
  message: string | null;
  created_at: string;
  is_read?: boolean | null;
  // notifications テーブルに is_deleted がある前提（なければ下の .eq("is_deleted", false) を消してください）
  is_deleted?: boolean | null;
};

// 🔧 日本時間ベースで YYYY-MM-DD を作る関数
function toDateStringLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DailyRecord[]>([]);
  const [chartView, setChartView] = useState<ChartViewMode>("daily");
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>("dashboard");
  const [loading, setLoading] = useState<boolean>(true);

  const [role, setRole] = useState<Role | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // 現在表示している店舗の情報（右上表示用）
  const [currentStoreName, setCurrentStoreName] = useState<string | null>(null);
  const [currentStoreCode, setCurrentStoreCode] = useState<string | null>(null);

  // 直近30日の期間（発注リスト用にも使う）
  const [periodFrom, setPeriodFrom] = useState<string | null>(null);
  const [periodTo, setPeriodTo] = useState<string | null>(null);

  // グラフ専用の任意期間
  const [chartFrom, setChartFrom] = useState<string>("");
  const [chartTo, setChartTo] = useState<string>("");

  // ✅ ログイン中の user_id（notifications を絞り込み）
  const [userId, setUserId] = useState<string | null>(null);

  // ✅ お知らせ（管理者返信 = notifications）
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const router = useRouter();

  // 🔐 ログインユーザーの profile から store_id と role を取得（なければ作成）
  useEffect(() => {
    const loadProfileAndStore = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // ✅ notifications 用（user_id）
      setUserId(user.id);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, store_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        console.error("fetch profile error:", profileErr);
        router.push("/login");
        return;
      }

      let profileRow = profile;

      // 新規ユーザーは profiles を作る
      if (!profileRow) {
        const { data: inserted, error: insertErr } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            store_id: null,
            role: "staff",
            display_name: user.email ?? "ゲスト",
          })
          .select("id, store_id, role")
          .single();

        if (insertErr || !inserted) {
          console.error("create profile error:", insertErr);
          router.push("/login");
          return;
        }

        profileRow = inserted;
      }

      const userRole = (profileRow.role ?? "staff") as Role;
      setRole(userRole);

      // 自分の店舗情報を右上表示用 state に入れる
      if (profileRow.store_id) {
        const { data: storeRow, error: ownStoreErr } = await supabase
          .from("stores")
          .select("id, name, code")
          .eq("id", profileRow.store_id)
          .maybeSingle();

        if (!ownStoreErr && storeRow) {
          const s = storeRow as Store;
          setStoreId(s.id);
          setCurrentStoreName(s.name);
          setCurrentStoreCode(s.code);
        } else {
          setStoreId(profileRow.store_id);
        }
      }

      // admin は全店舗取得してセレクト可能にする
      if (userRole === "admin") {
        const { data: storeRows, error: storeErr } = await supabase
          .from("stores")
          .select("id, name, code")
          .order("name", { ascending: true });

        if (storeErr) {
          console.error("fetch stores error:", storeErr);
        } else if (storeRows && storeRows.length > 0) {
          const list = storeRows as Store[];
          setStores(list);

          let initialId = profileRow.store_id ?? list[0].id;
          setStoreId(initialId);

          const initialStore = list.find((s) => s.id === initialId);
          if (initialStore) {
            setCurrentStoreName(initialStore.name);
            setCurrentStoreCode(initialStore.code);
          }
        }
      }

      setLoadingProfile(false);
    };

    loadProfileAndStore();
  }, [router]);

  // ✅ notifications（管理者返信）を取得（最新5件）: user_id で読む
  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, title, message, created_at, is_read, is_deleted")
      .eq("user_id", userId)
      // ✅ 削除された通知はダッシュボードには出さない
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("fetch notifications error:", error);
      return;
    }

    setNotifications((data ?? []) as Notification[]);
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ✅ 未読件数（ダッシュボード「お知らせ」の件数はこれを使う）
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.is_read !== true).length;
  }, [notifications]);

  // ✅ Realtime: notifications INSERT で即反映（このユーザー宛だけ）
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("notifications-realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as { user_id?: string | null };
          if (!row?.user_id || row.user_id !== userId) return;
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  // 📊 sales から直近30日の日別集計
  const fetchSalesSummary = useCallback(async () => {
    if (!storeId) return;

    setLoading(true);

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);

    const fromStr = toDateStringLocal(thirtyDaysAgo);
    const toStr = toDateStringLocal(today);

    setPeriodFrom(fromStr);
    setPeriodTo(toStr);

    type SalesRow = {
      sale_date: string | null;
      amount: number | null;
      profit: number | null;
    };

    const { data, error } = await supabase
      .from("sales")
      .select("sale_date, amount, profit")
      .eq("store_id", storeId)
      .gte("sale_date", fromStr)
      .lte("sale_date", toStr)
      .order("sale_date", { ascending: true });

    if (error || !data) {
      console.error("fetch sales error:", error);
      setData([]);
      setLoading(false);
      return;
    }

    const map: Record<string, DailyRecord> = {};

    (data as SalesRow[]).forEach((row) => {
      if (!row.sale_date) return;
      const dateKey = row.sale_date;

      if (!map[dateKey]) {
        map[dateKey] = { date: dateKey, sales: 0, profit: 0 };
      }

      map[dateKey].sales += Number(row.amount ?? 0);
      map[dateKey].profit += Number(row.profit ?? 0);
    });

    const dailyList = Object.values(map).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    setData(dailyList);
    setLoading(false);

    if (dailyList.length > 0) {
      setChartFrom(dailyList[0].date);
      setChartTo(dailyList[dailyList.length - 1].date);
    }
  }, [storeId]);

  useEffect(() => {
    fetchSalesSummary();
  }, [fetchSalesSummary]);

  // ⭐ Realtime: sales INSERT で再集計（同じ store の分だけ）
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel("sales-realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales" },
        (payload) => {
          const newRow = payload.new as { store_id?: string | null };
          if (!newRow || newRow.store_id !== storeId) return;
          fetchSalesSummary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchSalesSummary]);

  // 📆 月別集計（直近30日分のみ）
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; sales: number; profit: number }> =
      {};

    data.forEach((d) => {
      const monthKey = d.date.slice(0, 7);
      if (!map[monthKey]) {
        map[monthKey] = { month: monthKey, sales: 0, profit: 0 };
      }
      map[monthKey].sales += d.sales;
      map[monthKey].profit += d.profit;
    });

    return Object.values(map);
  }, [data]);

  // 🔍 カード & PDF 用の集計
  const todayStr = toDateStringLocal(new Date());
  const currentMonth = todayStr.slice(0, 7);

  const {
    summaryData,
    summarySales,
    summaryProfit,
    summaryTitlePrefix,
    summarySubLabel,
  } = useMemo(() => {
    let target: DailyRecord[] = [];
    let titlePrefix = "";
    let subLabel = "";

    if (chartView === "daily") {
      target = data.filter((d) => d.date === todayStr);
      titlePrefix = "今日";
      subLabel = "今日の合計";
    } else if (chartView === "monthly") {
      target = data.filter((d) => d.date.slice(0, 7) === currentMonth);
      titlePrefix = "今月";
      subLabel = `今月（${currentMonth}）の合計`;
    } else {
      const from = chartFrom || data[0]?.date;
      const to = chartTo || data[data.length - 1]?.date;
      target = data.filter((d) => {
        if (!from || !to) return true;
        return d.date >= from && d.date <= to;
      });
      titlePrefix = "任意期間";
      subLabel = from && to ? `${from}〜${to} の合計` : "任意期間の合計";
    }

    const salesTotal = target.reduce((sum, d) => sum + d.sales, 0);
    const profitTotal = target.reduce((sum, d) => sum + d.profit, 0);

    return {
      summaryData: target,
      summarySales: salesTotal,
      summaryProfit: profitTotal,
      summaryTitlePrefix: titlePrefix,
      summarySubLabel: subLabel,
    };
  }, [chartView, data, todayStr, currentMonth, chartFrom, chartTo]);

  const salesTitle = `${summaryTitlePrefix}の売上`;
  const profitTitle = `${summaryTitlePrefix}の利益`;

  // 📈 グラフ用データ
  const chartData = useMemo(() => {
    if (chartView === "monthly") return monthlyData;

    let base = data;
    if (
      chartView === "customRange" &&
      chartFrom &&
      chartTo &&
      chartFrom <= chartTo
    ) {
      base = data.filter((d) => d.date >= chartFrom && d.date <= chartTo);
    }
    return base;
  }, [chartView, data, monthlyData, chartFrom, chartTo]);

  const xKey = chartView === "monthly" ? "month" : "date";

  // 📄 PDF日報ダウンロード
  const handleDownloadPdf = async () => {
    const jsPDF = (await import("jspdf")).default as any;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("売上レポート", 10, 15);
    doc.setFontSize(11);
    doc.text(`集計範囲: ${summarySubLabel}`, 10, 25);
    doc.text(`売上合計: ¥${summarySales.toLocaleString()}`, 10, 33);
    doc.text(`利益合計: ¥${summaryProfit.toLocaleString()}`, 10, 41);

    let y = 55;
    doc.setFontSize(10);
    doc.text("日別明細:", 10, y);
    y += 6;

    summaryData.forEach((d) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(
        `${d.date}  売上 ¥${d.sales.toLocaleString()} / 利益 ¥${d.profit.toLocaleString()}`,
        10,
        y
      );
      y += 6;
    });

    doc.save("sales-report.pdf");
  };

  // プロフィール読み込み中
  if (loadingProfile || !role) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        読み込み中...
      </main>
    );
  }

  // staff なのに storeId が決まっていない → エラー
  if (!storeId && role !== "admin") {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-sm text-slate-200">
          店舗情報が見つかりません。管理者に連絡するか、再度ログインし直してください。
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* ヘッダー */}
      <header className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
        <h1 className="text-xl font-bold">ダッシュボード</h1>

        <div className="flex items-center gap-6 text-sm text-slate-300">
          {/* ✅ 通知ベル（props 仕様が不明でも落ちないように any で渡します） */}
          <NotificationBell {...({ unreadCount } as any)} />

          {/* admin だけ店舗セレクト */}
          {role === "admin" && (
            <div className="flex items-center gap-2">
              <span>表示店舗:</span>
              <select
                value={storeId ?? ""}
                onChange={(e) => {
                  const newId = e.target.value;
                  setStoreId(newId);
                  const s = stores.find((st) => st.id === newId);
                  if (s) {
                    setCurrentStoreName(s.name);
                    setCurrentStoreCode(s.code);
                  }
                }}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ログインユーザー情報 + 店舗コード表示 */}
          <div className="text-right">
            <div>ログインユーザー情報</div>
            {currentStoreName && (
              <div className="text-xs text-slate-300">
                店舗名: {currentStoreName}
              </div>
            )}
            {currentStoreCode && (
              <div className="text-xs text-slate-400 break-all">
                店舗コード: {currentStoreCode}
              </div>
            )}
          </div>

          {/* 管理者だけ「管理者ダッシュボードへ」 */}
          {role === "admin" && (
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              管理者ダッシュボードへ
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4">
          {/* 左メニュー */}
          <aside className="space-y-4">
            <button
              onClick={() => setActiveMenu("product")}
              className={`w-full text-left bg-slate-800 rounded-xl p-4 h-24 hover:bg-slate-700 transition text-sm ${
                activeMenu === "product" ? "ring-2 ring-blue-500" : ""
              }`}
            >
              商品登録・削除
            </button>

            <button
              onClick={() => setActiveMenu("sales")}
              className={`w-full text-left bg-slate-800 rounded-xl p-4 h-24 hover:bg-slate-700 transition text-sm ${
                activeMenu === "sales" ? "ring-2 ring-blue-500" : ""
              }`}
            >
              売り上げ登録
            </button>

            <button
              onClick={() => setActiveMenu("dashboard")}
              className={`w-full text-left bg-slate-800 rounded-xl p-4 h-24 hover:bg-slate-700 transition text-sm ${
                activeMenu === "dashboard" ? "ring-2 ring-blue-500" : ""
              }`}
            >
              ダッシュボード表示
            </button>

            <button
              onClick={() => setActiveMenu("purchase")}
              className={`w-full text-left bg-slate-800 rounded-xl p-4 h-24 hover:bg-slate-700 transition text-sm ${
                activeMenu === "purchase" ? "ring-2 ring-blue-500" : ""
              }`}
            >
              発注するものリスト
            </button>

            <Link
              href="/settings"
              className="block bg-slate-800 rounded-xl p-4 h-24 hover:bg-slate-700 transition"
            >
              設定
            </Link>

            <Link
              href="/contact"
              className="block bg-slate-800 rounded-xl p-4 h-24 hover:bg-slate-700 transition"
            >
              問い合わせ
            </Link>
          </aside>

          {/* 右メイン */}
          <section className="space-y-4">
            {activeMenu === "dashboard" && (
              <>
                {/* PDFボタン */}
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleDownloadPdf}
                    className="text-xs px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
                  >
                    PDF日報をダウンロード
                  </button>
                </div>

                {/* 上3つのカード */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold mb-2">{salesTitle}</h2>
                    <p className="text-2xl font-bold mt-2">
                      ¥{summarySales.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      {summarySubLabel}
                    </p>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold mb-2">{profitTitle}</h2>
                    <p className="text-2xl font-bold mt-2">
                      ¥{summaryProfit.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      {summarySubLabel}
                    </p>
                  </div>

                  {/* ✅ お知らせカード（notifications） */}
                  <div className="bg-slate-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold mb-2">お知らせ</h2>
                    {/* ✅ 件数は「未読件数」 */}
                    <p className="text-2xl font-bold mt-2">{unreadCount}件</p>
                    <p className="text-xs text-slate-300 mt-1">
                      {notifications.length > 0
                        ? `最新: ${notifications[0].title}`
                        : "まだお知らせはありません"}
                    </p>

                    <Link
                      href="/notifications"
                      className="inline-block mt-2 text-xs px-3 py-1 rounded bg-blue-600"
                    >
                      一覧を見る
                    </Link>
                  </div>
                </div>

                {/* 売上＆利益グラフ */}
                <div className="bg-slate-800 rounded-xl p-4 h-[420px]">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h2 className="font-semibold">売上 &amp; 利益グラフ</h2>

                      {chartView === "customRange" && (
                        <div className="flex items-center gap-2 text-xs mt-2">
                          <span>グラフの表示期間:</span>
                          <input
                            type="date"
                            value={chartFrom}
                            onChange={(e) => setChartFrom(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
                          />
                          <span>〜</span>
                          <input
                            type="date"
                            value={chartTo}
                            onChange={(e) => setChartTo(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="inline-flex rounded-lg bg-slate-900 p-1 text-sm">
                      <button
                        className={`px-3 py-1 rounded-md ${
                          chartView === "daily"
                            ? "bg-blue-600 text-white"
                            : "text-slate-300"
                        }`}
                        onClick={() => setChartView("daily")}
                      >
                        日別
                      </button>
                      <button
                        className={`px-3 py-1 rounded-md ${
                          chartView === "monthly"
                            ? "bg-blue-600 text-white"
                            : "text-slate-300"
                        }`}
                        onClick={() => setChartView("monthly")}
                      >
                        月別
                      </button>
                      <button
                        className={`px-3 py-1 rounded-md ${
                          chartView === "customRange"
                            ? "bg-blue-600 text-white"
                            : "text-slate-300"
                        }`}
                        onClick={() => setChartView("customRange")}
                      >
                        任意期間
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 h-[340px]">
                    {loading ? (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        読み込み中...
                      </div>
                    ) : (
                      <SalesProfitChart data={chartData} xKey={xKey} />
                    )}
                  </div>
                </div>
              </>
            )}

            {activeMenu === "product" && <ProductManager storeId={storeId} />}
            {activeMenu === "sales" && <SalesEntryPanel storeId={storeId} />}
            {activeMenu === "purchase" && (
              <PurchaseListPanel
                storeId={storeId}
                periodFrom={periodFrom ?? ""}
                periodTo={periodTo ?? ""}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
