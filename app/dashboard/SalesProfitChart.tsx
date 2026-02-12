// app/dashboard/SalesProfitChart.tsx
"use client";

import {
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Line,
} from "recharts";
import { useRef, useState, useEffect } from "react";

type ChartRow = {
  date?: string;
  month?: string;
  sales: number;
  profit: number;
};

type Props = {
  data: ChartRow[];
  xKey: string; // "date" | "month"
};

/* --- ResizeObserver で width/height を確実に取得 --- */
function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

export default function SalesProfitChart({ data, xKey }: Props) {
  const { ref, size } = useContainerSize();

  const hasSize = size.width > 0 && size.height > 0;
  const hasData = data && data.length > 0;

  return (
    <section className="border rounded-lg p-4 h-full bg-slate-900 text-white">
      <h2 className="text-lg font-bold mb-4">売上・利益の推移</h2>

      {/* 高さは固定、幅は親に合わせて自動 */}
      <div ref={ref} className="w-full h-80">
        {/* データなし */}
        {!hasData && (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
            データがありません
          </div>
        )}

        {/* サイズが確定してから描画（警告ゼロ） */}
        {hasData && hasSize && (
          <LineChart
            width={size.width}
            height={size.height}
            data={data}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={xKey} stroke="#fff" />
            <YAxis
              stroke="#fff"
              tickFormatter={(v) => `¥${v.toLocaleString()}`}
            />

            <Tooltip
              formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />

            <Line
              type="monotone"
              dataKey="sales"
              name="売上"
              stroke="#60a5fa"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />

            <Line
              type="monotone"
              dataKey="profit"
              name="利益"
              stroke="#f97316"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        )}
      </div>
    </section>
  );
}
