// app/dashboard/SalesEntryPanel.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { supabase } from "./supabaseClient";

type Props = {
  storeId: string | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  cost: number;
};

// 日本時間で YYYY-MM-DD を作る
function toDateStringLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SalesEntryPanel({ storeId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // 任意売上日
  const [saleDate, setSaleDate] = useState<string>(
    toDateStringLocal(new Date())
  );

  // ログインユーザーIDを保持
  const [userId, setUserId] = useState<string | null>(null);

  // ★ 店舗ごとの商品一覧を読み込む
  useEffect(() => {
    const loadProducts = async () => {
      setStatus(null);

      // ユーザー取得
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("getUser error:", userError);
        setProducts([]);
        setUserId(null);
        return;
      }

      setUserId(user.id);

      // 店舗がまだ決まってない場合
      if (!storeId) {
        setProducts([]);
        setSelectedProductId("");
        setStatus("店舗情報が設定されていません。");
        return;
      }

      // ★ ここがポイント：store_id で絞る
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, cost")
        .eq("store_id", storeId)
        .order("name", { ascending: true });

      if (error || !data) {
        console.error("fetch products error:", error);
        setProducts([]);
        setSelectedProductId("");
        setStatus("商品一覧の取得に失敗しました。");
        return;
      }

      setProducts(data as Product[]);
      if (data.length > 0) setSelectedProductId(data[0].id);
      else setSelectedProductId("");
    };

    // storeId が変わるたびに読み込み
    loadProducts();
  }, [storeId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!storeId) {
      setStatus("店舗情報が設定されていません。");
      return;
    }

    if (!selectedProductId) {
      setStatus("商品を選択してください。");
      return;
    }

    if (!userId) {
      setStatus("ログイン情報を取得できませんでした。再ログインしてください。");
      return;
    }

    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0 || q > 1000000) {
      setStatus("個数は 1〜1000000 で入力してください。");
      return;
    }

    if (!saleDate) {
      setStatus("売上日を入力してください。");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) {
      setStatus("商品情報が見つかりません。");
      return;
    }

    const amount = product.price * q;
    const profit = (product.price - product.cost) * q;
    const noteValue = note.trim() || `${product.name} × ${q}個`;

    setSaving(true);

    const { error } = await supabase.from("sales").insert({
      user_id: userId,       // RLS 用
      store_id: storeId,
      product_id: product.id,
      quantity: q,
      note: noteValue,
      amount,
      profit,
      sale_date: saleDate,   // 任意売上日
    });

    setSaving(false);

    if (error) {
      console.error("insert sales error:", error);
      setStatus("売上登録に失敗しました。（権限設定の可能性あり）");
      return;
    }

    setQuantity("1");
    setNote("");
    setStatus("売上を登録しました。");
  };

  const inputClass =
    "w-full rounded px-3 py-2 text-sm bg-white text-black border border-slate-300";

  return (
    <section className="border rounded-lg p-4 space-y-4 bg-slate-800">
      <h2 className="text-lg font-bold">売り上げ登録</h2>

      {status && (
        <p className="text-xs text-emerald-300 whitespace-pre-line">{status}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* 商品選択 */}
        <div>
          <label className="block text-xs mb-1">商品</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className={inputClass}
          >
            {products.length === 0 && (
              <option value="">商品が登録されていません</option>
            )}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（¥{p.price.toLocaleString()}）
              </option>
            ))}
          </select>
        </div>

        {/* 個数 */}
        <div>
          <label className="block text-xs mb-1">個数</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min={1}
            className={inputClass}
          />
        </div>

        {/* 売上日 */}
        <div>
          <label className="block text-xs mb-1">売上日</label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* メモ */}
        <div>
          <label className="block text-xs mb-1">メモ（任意）</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
            placeholder="例）テイクアウト多め"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
        >
          {saving ? "登録中..." : "売上を登録する"}
        </button>
      </form>
    </section>
  );
}
