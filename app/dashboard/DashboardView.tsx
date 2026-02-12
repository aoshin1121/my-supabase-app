// app/dashboard/DashboardView.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

type SaleRow = {
  amount: number | string | null;
  profit: number | string | null;
  sold_at: string;
};

export default function DashboardView() {
  const [todaySales, setTodaySales] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [loading, setLoading] = useState(false);

  // 今日の売上・利益を集計
  const fetchDashboard = useCallback(async () => {
    setLoading(true);

    try {
      // 今日（ローカル）の 00:00〜23:59
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const startIso = start.toISOString();
      const endIso = end.toISOString();

      const { data, error } = await supabase
        .from("sales")
        .select("amount, profit, sold_at")
        .gte("sold_at", startIso)
        .lte("sold_at", endIso);

      if (error || !data) {
        console.error("fetchDashboard sales error:", error);
        setTodaySales(0);
        setTodayProfit(0);
        setLoading(false);
        return;
      }

      let salesTotal = 0;
      let profitTotal = 0;

      (data as SaleRow[]).forEach((row) => {
        salesTotal += Number(row.amount ?? 0);
        profitTotal += Number(row.profit ?? 0);
      });

      setTodaySales(salesTotal);
      setTodayProfit(profitTotal);
    } catch (e) {
      console.error("fetchDashboard unexpected error:", e);
      setTodaySales(0);
      setTodayProfit(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // ① 初回表示時に読み込み
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ② sales テーブルに INSERT があったらリアルタイムで再読み込み
  useEffect(() => {
    const channel = supabase
      .channel("sales-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sales",
        },
        (payload) => {
          console.log("🔔 sales inserted (realtime):", payload);
          fetchDashboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboard]);

  return (
    <section className="border rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold mb-2">ダッシュボード表示（リアルタイム）</h2>

      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <div className="space-y-2 text-sm md:text-base">
          <p>今日の売上：¥{todaySales.toLocaleString()}</p>
          <p>今日の利益：¥{todayProfit.toLocaleString()}</p>
        </div>
      )}

      {/* 保険で手動更新ボタンも残す */}
      <button
        onClick={fetchDashboard}
        className="mt-4 px-4 py-2 border rounded text-sm"
      >
        手動で更新
      </button>
    </section>
  );
}
