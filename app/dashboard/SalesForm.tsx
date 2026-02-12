// app/dashboard/SalesForm.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from './supabaseClient';

type Product = {
  id: string;
  name: string;
  price: number;
  cost: number;
};

// 👇 親コンポーネント（Dashboard）から店舗IDをもらう
type Props = {
  storeId: string | null;
};

export default function SalesForm({ storeId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // 商品一覧取得
  useEffect(() => {
    const fetchProducts = async () => {
      setStatus(null);

      if (!storeId) {
        setProducts([]);
        setProductId('');
        setStatus('店舗情報が設定されていません。');
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, cost')
        .eq('store_id', storeId) // ★ ここで店舗ごとに絞る
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.error('fetch products error:', error);
        setProducts([]);
        setProductId('');
        setStatus('商品一覧の取得に失敗しました。');
        return;
      }

      setProducts(data as Product[]);
      if (data.length > 0) setProductId(data[0].id);
      else setProductId('');
    };

    fetchProducts();
  }, [storeId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!storeId) {
      setStatus('店舗情報が設定されていません。');
      return;
    }

    if (!productId) {
      setStatus('商品を選択してください。');
      return;
    }

    const q = Number(quantity);
    if (Number.isNaN(q) || q <= 0) {
      setStatus('個数は 1 以上の数値で入力してください。');
      return;
    }

    const product = products.find((p) => p.id === productId);
    if (!product) {
      setStatus('商品が見つかりません。');
      return;
    }

    const amount = product.price * q; // 売上
    const profit = (product.price - product.cost) * q; // 利益
    const note = `${product.name} × ${q}`;

    setSaving(true);

    const { error } = await supabase.from('sales').insert([
      {
        store_id: storeId, // ★ 固定の STORE_ID はやめて、引数の storeId を使う
        product_id: product.id,
        quantity: q,
        amount,
        profit,
        note,
        // sold_at, created_at は DB 側の default now() に任せる
      },
    ]);

    setSaving(false);

    if (error) {
      console.error('insert sales error:', error);
      setStatus('売上の登録に失敗しました');
      return;
    }

    // 入力リセット
    setQuantity('1');
    setStatus('今日の売上を登録しました');
  };

  return (
    <section className="border rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-bold">今日売れた商品を登録</h2>

      {status && (
        <p className="text-xs text-emerald-600 whitespace-pre-line">
          {status}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">商品</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">選択してください</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.price.toLocaleString()}円）
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">個数</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            min={1}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          {saving ? '登録中...' : '売上を登録する'}
        </button>
      </form>
    </section>
  );
}
