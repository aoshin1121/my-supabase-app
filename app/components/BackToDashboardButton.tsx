'use client';

import { useRouter } from 'next/navigation';

export default function BackToDashboardButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/dashboard')}
      className="mt-6 px-4 py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 transition"
    >
      ダッシュボードへ戻る
    </button>
  );
}
