'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '../dashboard/supabaseClient'

export default function ProductInsertForm() {
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const costNumber = Number(cost)
    if (Number.isNaN(costNumber)) {
      setMessage('cost は数字で入力してね')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('products').insert([
      {
        sku,
        name,
        cost: costNumber,
      },
    ])

    setLoading(false)

    if (error) {
      console.error(error)
      setMessage(`エラー: ${error.message}`)
      return
    }

    setMessage('登録しました！')
    setSku('')
    setName('')
    setCost('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">SKU</label>
        <input
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="w-full border rounded px-2 py-1"
          placeholder="例: MENU-001"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">メニュー名 (name)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-2 py-1"
          placeholder="例: 唐揚げ定食"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">原価 (cost)</label>
        <input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="w-full border rounded px-2 py-1"
          placeholder="例: 350"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
      >
        {loading ? '登録中…' : 'この内容で登録'}
      </button>

      {message && <p className="text-sm mt-2">{message}</p>}
    </form>
  )
}
