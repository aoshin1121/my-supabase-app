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

type DailyRecord = {
  date: string;
  sales: number;
  profit: number;
};

export default function SalesProfitChart({ data }: { data: DailyRecord[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="profit"
          name="利益"
          stroke="#f97316"
          strokeWidth={3}
        />
        <Line
          type="monotone"
          dataKey="sales"
          name="売上"
          stroke="#3b82f6"
          strokeWidth={3}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
