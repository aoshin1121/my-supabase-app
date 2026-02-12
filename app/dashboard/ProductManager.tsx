// app/dashboard/ProductManager.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { supabase } from "./supabaseClient";

type MaterialInput = {
  name: string;
  quantity: string;
};

type Role = "admin" | "staff";

type Product = {
  id: string;
  name: string;
  price: number | null;
  cost: number | null;
  materials: string; // JSON文字列
  user_id?: string | null;
  store_id?: string | null;
};

// ダッシュボード右上から渡ってくる店舗ID
type Props = {
  storeId: string | null;
};

export default function ProductManager({ storeId }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [materials, setMaterials] = useState<MaterialInput[]>([
    { name: "", quantity: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 追加：role（staff か admin かだけ使う）
  const [role, setRole] = useState<Role | null>(null);

  // 実際に商品を読み書きする店舗ID
  // → 右上の「表示店舗」で選んだ storeId をそのまま使う
  const effectiveStoreId = storeId;

  // ----------------- ログインユーザー & プロフィール情報取得 -----------------
  useEffect(() => {
    const load = async () => {
      setAuthLoading(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        console.error("getUser error:", authError);
        setAuthLoading(false);
        return;
      }
      if (!authData.user) {
        // 未ログイン
        setAuthLoading(false);
        return;
      }

      setUserId(authData.user.id);

      // profiles から role だけ取得（store_id は親コンポーネントが管理）
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        console.error("load profile error:", profileError);
        setAuthLoading(false);
        return;
      }

      setRole(profile.role as Role);

      setAuthLoading(false);
    };

    load();
  }, []);

  // ----------------- 指定店舗の商品一覧取得 -----------------
  const fetchProducts = async (sid: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, cost, materials, user_id, store_id")
      .eq("store_id", sid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchProducts error:", error);
      setProducts([]);
    } else {
      setProducts((data ?? []) as Product[]);
    }

    setLoading(false);
  };

  // effectiveStoreId が決まったら、その店舗の商品を読み込む
  useEffect(() => {
    if (!effectiveStoreId) {
      setProducts([]);
      return;
    }
    fetchProducts(effectiveStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStoreId]);

  // ----------------- フォームリセット -----------------
  const resetForm = () => {
    setName("");
    setPrice("");
    setCost("");
    setMaterials([{ name: "", quantity: "" }]);
    setEditingId(null);
  };

  // ----------------- 材料1行を変更 -----------------
  const handleMaterialChange = (
    index: number,
    field: keyof MaterialInput,
    value: string
  ) => {
    setMaterials((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddMaterialRow = () => {
    setMaterials((prev) => [...prev, { name: "", quantity: "" }]);
  };

  const handleRemoveMaterialRow = (index: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  // ----------------- 商品登録・更新 -----------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!userId) {
      alert("ログイン情報が取得できませんでした。再ログインしてください。");
      return;
    }

    if (!effectiveStoreId) {
      alert("店舗情報が取得できませんでした。店舗を選択してください。");
      return;
    }

    if (!name.trim()) {
      alert("商品名を入力してください");
      return;
    }

    const validMaterials = materials.filter((m) => m.name.trim() !== "");
    if (validMaterials.length === 0) {
      alert("この商品で使う材料を1つ以上入力してください");
      return;
    }

    const priceValue = Number(price);
    const costValue = Number(cost);

    if (Number.isNaN(priceValue) || Number.isNaN(costValue)) {
      alert("価格・原価は数値で入力してください");
      return;
    }

    const materialsJson = JSON.stringify(validMaterials);

    setSaving(true);

    if (editingId) {
      // 更新
      const { error } = await supabase
        .from("products")
        .update({
          name,
          price: priceValue,
          cost: costValue,
          materials: materialsJson,
          user_id: userId, // 作成/更新者として保持
          store_id: effectiveStoreId,
        })
        .eq("id", editingId); // RLSで権限管理

      if (error) {
        console.error("update product error:", error);
        alert("商品の更新に失敗しました");
      }
    } else {
      // 新規
      const { error } = await supabase.from("products").insert([
        {
          name,
          price: priceValue,
          cost: costValue,
          materials: materialsJson,
          user_id: userId,
          store_id: effectiveStoreId, // ★ 店舗ひも付け
        },
      ]);

      if (error) {
        console.error("insert product error:", error);
        alert("商品の登録に失敗しました");
      }
    }

    setSaving(false);
    resetForm();
    await fetchProducts(effectiveStoreId);
  };

  // ----------------- 商品削除 -----------------
  const handleDelete = async (id: string) => {
    const ok = window.confirm("この商品を削除しますか？");
    if (!ok) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id); // RLSで権限管理（admin は全店舗OKなど）

    if (error) {
      console.error("delete product error:", error);
      alert("商品の削除に失敗しました");
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // ----------------- 編集ボタン押下 -----------------
  const handleEditClick = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setPrice(product.price != null ? String(product.price) : "");
    setCost(product.cost != null ? String(product.cost) : "");

    try {
      const parsed = JSON.parse(product.materials);
      if (Array.isArray(parsed)) {
        setMaterials(
          parsed.map((m: any) => ({
            name: m.name ?? "",
            quantity: m.quantity ?? "",
          }))
        );
      } else {
        setMaterials([{ name: product.materials ?? "", quantity: "" }]);
      }
    } catch {
      setMaterials([{ name: product.materials ?? "", quantity: "" }]);
    }
  };

  // ----------------- 一覧用：材料の表示文字列 -----------------
  const renderMaterials = (materialsStr: string) => {
    try {
      const parsed = JSON.parse(materialsStr);
      if (!Array.isArray(parsed)) return materialsStr;

      return parsed
        .map((m: any) =>
          m.quantity ? `${m.name}（${m.quantity}）` : String(m.name)
        )
        .join("\n");
    } catch {
      return materialsStr;
    }
  };

  // ----------------- ローディング / 未ログイン -----------------
  if (authLoading) {
    return <p>ログイン情報を取得中...</p>;
  }

  if (!userId) {
    return <p>ログインしてからお試しください。</p>;
  }

  // ----------------- 画面本体 -----------------
  return (
    <div className="space-y-8">
      {/* 商品登録 / 編集フォーム */}
      <section className="border rounded-lg p-4">
        <h2 className="text-lg font-bold mb-4">
          {editingId ? "商品を編集" : "商品を登録"}
        </h2>

        {role === "staff" && !effectiveStoreId && (
          <p className="mb-2 text-sm text-red-500">
            店舗情報が設定されていないため、商品を登録できません。
          </p>
        )}

        {role === "admin" && !effectiveStoreId && (
          <p className="mb-2 text-sm text-red-500">
            編集する店舗が選択されていません。右上の「表示店舗」を選択してください。
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 商品名（全角推奨） */}
          <div>
            <label className="block text-sm font-medium mb-1">
              商品名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="例：唐揚げ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-white text-black ime-zenkaku"
              required
            />
          </div>

          {/* 価格・原価 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                価格（売値）
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="例：600"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black ime-hankaku"
                />
                <span className="text-sm text-slate-300">円</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                原価
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="例：300"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black ime-hankaku"
                />
                <span className="text-sm text-slate-300">円</span>
              </div>
            </div>
          </div>

          {/* 材料入力（全角推奨） */}
          <div>
            <label className="block text-sm font-medium mb-1">
              この商品で使う材料{" "}
              <span className="text-red-500">*</span>
            </label>

            <div className="space-y-2">
              {materials.map((m, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row gap-2 items-start"
                >
                  <input
                    type="text"
                    placeholder="材料名（例：鶏もも肉）"
                    value={m.name}
                    onChange={(e) =>
                      handleMaterialChange(
                        index,
                        "name",
                        e.target.value
                      )
                    }
                    className="flex-1 border rounded px-3 py-2 text-sm bg-white text-black ime-zenkaku"
                  />
                  <input
                    type="text"
                    placeholder="量（例：100g）"
                    value={m.quantity}
                    onChange={(e) =>
                      handleMaterialChange(
                        index,
                        "quantity",
                        e.target.value
                      )
                    }
                    className="w-40 border rounded px-3 py-2 text-sm bg-white text-black"
                  />
                  {materials.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveMaterialRow(index)
                      }
                      className="text-xs px-2 py-1 border rounded"
                    >
                      行削除
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddMaterialRow}
              className="mt-2 text-xs px-3 py-1 border rounded"
            >
              行の追加
            </button>
          </div>

          {/* ボタン */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !effectiveStoreId}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              {saving
                ? "保存中..."
                : editingId
                ? "商品を更新する"
                : "商品を登録する"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded border text-sm"
              >
                新規登録モードに戻る
              </button>
            )}
          </div>
        </form>
      </section>

      {/* 商品一覧 */}
      <section className="border rounded-lg p-4">
        <h2 className="text-lg font-bold mb-4">
          登録済みの商品一覧
        </h2>

        {loading ? (
          <p>読み込み中...</p>
        ) : !effectiveStoreId ? (
          <p className="text-sm text-slate-400">
            店舗が選択されていません。
          </p>
        ) : products.length === 0 ? (
          <p className="text-sm text-slate-400">
            この店舗にはまだ商品が登録されていません。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-slate-800">
                <tr>
                  <th className="border px-2 py-1 text-left">
                    商品名
                  </th>
                  <th className="border px-2 py-1 text-right">
                    価格
                  </th>
                  <th className="border px-2 py-1 text-right">
                    原価
                  </th>
                  <th className="border px-2 py-1 text-left">
                    材料
                  </th>
                  <th className="border px-2 py-1 text-center">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="border px-2 py-1">
                      {p.name}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {p.price != null
                        ? `¥${p.price.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {p.cost != null
                        ? `¥${p.cost.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="border px-2 py-1 whitespace-pre-wrap">
                      {renderMaterials(p.materials)}
                    </td>
                    <td className="border px-2 py-1 text-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(p)}
                        className="px-2 py-1 text-xs border rounded"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="px-2 py-1 text-xs border rounded text-red-500"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
