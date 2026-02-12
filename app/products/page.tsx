// app/products/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../dashboard/supabaseClient';
import ProductInsertForm from './ProductInsertForm';

// プロフィールの型
type UserRole = 'admin' | 'manager' | 'viewer';

type Profile = {
  id: string;
  name: string | null;
  role: UserRole;
  store_id: string | null;
};

// 商品（メニュー）の型
type Product = {
  id: string;
  name: string;
  price: number;
  cost: number;
};

export default function ProductsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ログイン → profiles → products の順に取得
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      // 1) ログイン確認
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push('/login');
        return;
      }

      const user = session.user;

      // 2) プロフィール取得
      const {
        data: profiles,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('id, name, role, store_id');

      console.log('user.email =', user.email);
      console.log('profiles(all) =', profiles);
      console.log('profileError =', profileError);

      const profileData = (profiles || []).find(
        (p: any) => (p.name || '').trim() === (user.email || '').trim()
      );

      if (!profileData) {
        setError('profiles テーブルにこのユーザーの行がありません');
        setLoading(false);
        return;
      }

      setProfile(profileData as Profile);

      // 3) メニュー取得
      const {
        data: productsData,
        error: productsError,
      } = await supabase
        .from('products')
        .select('id, name, price, cost')
        .order('name', { ascending: true });

      if (productsError) {
        setError('メニュー取得に失敗しました');
        setLoading(false);
        return;
      }

      setProducts(productsData ?? []);
      setLoading(false);
    };

    load();
  }, [router]);

  // --- ローディング ---
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p>読み込み中...</p>
      </main>
    );
  }

  // --- エラー表示 ---
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p>{error}</p>
      </main>
    );
  }

  // --- プロフィールが無い ---
  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p>プロフィールが取得できませんでした</p>
      </main>
    );
  }

  const isAdminOrManager =
    profile.role === 'admin' || profile.role === 'manager';

  // --- メイン画面 ---
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
        <h1 className="text-xl font-bold">メニュー管理（products）</h1>
        <div className="text-sm text-slate-300">
          {profile.name ?? 'No Name'}（{profile.role}）
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {isAdminOrManager && (
          <section className="bg-slate-800 rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-2">新しいメニューを追加</h2>
            <ProductInsertForm />
          </section>
        )}

        <section className="bg-slate-800 rounded-xl p-4 shadow">
          <h2 className="font-semibold mb-2">メニュー一覧</h2>
          {products.length === 0 ? (
            <p className="text-sm text-slate-300">メニューはまだありません。</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-700">
                  <th className="py-1">商品名</th>
                  <th className="py-1">販売価格</th>
                  <th className="py-1">原価</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800">
                    <td className="py-1">{p.name}</td>
                    <td className="py-1">{p.price}</td>
                    <td className="py-1">{p.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
