// app/dashboard/RegisterSales.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type Product = {
  id: string;
  name: string;
  price: number;
  cost: number;
};

export default function RegisterSales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 商品一覧取得
  const fetchProducts = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, cost")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchProducts error:", error);
      setProducts([]);
    } else {
      setProducts((data as Product[]) ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 売上登録
  const handleRegister = async () => {
    if (!selectedId) {
      alert("商品を選択してください");
      return;
    }

    const product = products.find((p) => p.id === selectedId);
    if (!product) {
      alert("商品情報の取得に失敗しました");
      return;
    }

    setSaving(true);

    const quantity = 1; // とりあえず1個売れたとする（あとで個数入力を足してもOK）
    const amount = product.price * quantity;
    const profit = (product.price - product.cost) * quantity;

    const now = new Date().toISOString();

    const { error } = await supabase.from("sales").insert([
      {
        product_id: selectedId,
        quantity,
        amount,
        profit,
        sold_at: now,
        note: note || "",
      },
    ]);

    if (error) {
      console.error("insert sales error:", error);
      alert("売上登録に失敗しました");
      setSaving(false);
      return;
    }

    alert("売上を登録しました");
    setSelectedId("");
    setNote("");
    setSaving(false);
  };

  return (
    <section className="border rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold">今日売れた商品を登録</h2>

      {/* 商品プルダウン */}
      <div className="space-y-1">
        <label className="text-sm font-medium">商品</label>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-white text-black"
        >
          <option value="">選択してください</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（¥{p.price} / 原価 ¥{p.cost}）
            </option>
          ))}
        </select>

        {loading && <p className="text-sm text-slate-400">読み込み中...</p>}
      </div>

      {/* 備考 */}
      <div>
        <label className="text-sm font-medium">備考</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例）テイクアウト多め"
          className="w-full border rounded px-3 py-2 bg-white text-black"
        />
      </div>

      <button
        onClick={handleRegister}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {saving ? "登録中..." : "売上を登録する"}
      </button>
    </section>
  );
}
