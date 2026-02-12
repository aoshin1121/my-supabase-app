// app/dashboard/PurchaseListPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

type PurchaseListPanelProps = {
  storeId: string | null;
  periodFrom: string;
  periodTo: string;
};

type SalesRow = {
  product_id: string;
  quantity: number | null;
  sold_at: string;
  products: {
    name: string;
    materials: string | null; // JSON文字列
  } | null;
};

type MaterialUsage = {
  materialName: string;      // 材料名
  unit: string;              // 例: "g", "枚" など（元の入力から推定）
  totalAmount: number;       // 期間トータルの使用量
  examples: string[];        // どの商品で使われているかの例（最大3件, 重複なし）
};

export default function PurchaseListPanel({
  storeId,
  periodFrom,
  periodTo,
}: PurchaseListPanelProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SalesRow[]>([]);

  // 🔢 期間の日数を計算（両端含めて最低1日）
  const daysCount = useMemo(() => {
    try {
      const from = new Date(periodFrom);
      const to = new Date(periodTo);
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffMs = to.getTime() - from.getTime();
      const rawDays = Math.floor(diffMs / msPerDay) + 1;
      return rawDays > 0 ? rawDays : 1;
    } catch {
      return 1;
    }
  }, [periodFrom, periodTo]);

  // sales + products を期間で取得
  useEffect(() => {
    const fetchUsage = async () => {
      if (!storeId) {
        setRows([]);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("sales")
        .select("product_id, quantity, sold_at, products(name, materials)")
        .eq("store_id", storeId)
        .gte("sold_at", periodFrom)
        .lte("sold_at", periodTo);

      if (error || !data) {
        console.error("fetch usage error:", error);
        setRows([]);
        setLoading(false);
        return;
      }

      // data は配列なのでそのままキャスト
      setRows(data as unknown as SalesRow[]);
      setLoading(false);
    };

    fetchUsage();
  }, [storeId, periodFrom, periodTo]);

  // 材料ごとの使用量（期間トータル）を集計
  const materialList = useMemo<MaterialUsage[]>(() => {
    const map = new Map<string, MaterialUsage>();

    rows.forEach((row) => {
      const qty = Number(row.quantity ?? 0);
      if (!row.products) return;

      const { name: productName, materials } = row.products;
      if (!materials) return;

      let parsed: any[] = [];
      try {
        const tmp = JSON.parse(materials);
        if (Array.isArray(tmp)) parsed = tmp;
      } catch {
        return;
      }

      parsed.forEach((mat) => {
        const matName: string = mat.name ?? "";
        const rawQty: string = mat.quantity ?? "";

        if (!matName || !rawQty) return;

        // "50 g" → 50 + "g" に分解
        const numMatch = rawQty.match(/[0-9.]+/);
        const numValue = numMatch ? Number(numMatch[0]) : NaN;
        const unit = rawQty.replace(/[0-9.\s]+/g, "") || "";

        const baseAmount = Number.isFinite(numValue) ? numValue : 1;
        const totalAmount = baseAmount * qty;

        const key = `${matName}__${unit}`;

        if (!map.has(key)) {
          map.set(key, {
            materialName: matName,
            unit,
            totalAmount: 0,
            examples: [],
          });
        }

        const entry = map.get(key)!;
        entry.totalAmount += totalAmount;

        // ★★ 主に使う商品の重複を防ぐ（最大3件まで）
        if (
          productName &&
          !entry.examples.includes(productName) &&
          entry.examples.length < 3
        ) {
          entry.examples.push(productName);
        }
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.materialName.localeCompare(b.materialName)
    );
  }, [rows]);

  return (
    <section className="border rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-bold mb-2">発注するものリスト</h2>
      <p className="text-xs text-slate-300">
        選択した期間の「1日あたり」の材料使用量を集計しています。
        単位は商品登録時の入力から推定しています。
      </p>

      {!storeId && (
        <p className="text-sm text-slate-400">
          店舗情報が未設定のため、発注リストを表示できません。
        </p>
      )}

      {loading ? (
        <p>読み込み中...</p>
      ) : !loading && storeId && materialList.length === 0 ? (
        <p className="text-sm text-slate-400">
          この期間に売れた商品がないため、発注リストは空です。
        </p>
      ) : (
        storeId && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-slate-800">
                <tr>
                  <th className="border px-2 py-1 text-left">材料名</th>
                  <th className="border px-2 py-1 text-right">
                    1日あたりの必要量の目安
                  </th>
                  <th className="border px-2 py-1 text-left">主に使う商品</th>
                </tr>
              </thead>
              <tbody>
                {materialList.map((m, idx) => {
                  // 🔥 ここで「日別」に変換（端数は切り上げ）
                  const perDay = Math.ceil(m.totalAmount / daysCount);

                  return (
                    <tr key={idx}>
                      <td className="border px-2 py-1">{m.materialName}</td>
                      <td className="border px-2 py-1 text-right">
                        {perDay.toLocaleString()}
                        {m.unit}
                      </td>
                      <td className="border px-2 py-1 text-xs text-slate-300">
                        {m.examples.join("、")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
