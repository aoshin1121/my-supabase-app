// app/dashboard/SalesProfitChart.tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type Point = {
  [key: string]: any;
  sales: number;
  profit: number;
};

export default function SalesProfitChart({
  data,
  xKey,
}: {
  data: Point[];
  xKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        {/* 利益ライン（オレンジ） */}
        <Line
          type="monotone"
          dataKey="profit"
          name="利益"
          stroke="#f97316"
          strokeWidth={3}
          dot={{ r: 4 }}
        />
        {/* 売上ライン（青） */}
        <Line
          type="monotone"
          dataKey="sales"
          name="売上"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
