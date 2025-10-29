
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SentimentSummary } from '../types';

interface SentimentChartProps {
  data: SentimentSummary;
}

const COLORS = {
  Positive: '#22c55e', // green-500
  Negative: '#ef4444', // red-500
  Neutral: '#6b7280',  // gray-500
};

type SentimentKey = keyof typeof COLORS;

const SentimentChart: React.FC<SentimentChartProps> = ({ data }) => {
  const chartData = [
    { name: 'Positive', value: data.positive_percent },
    { name: 'Negative', value: data.negative_percent },
    { name: 'Neutral', value: data.neutral_percent },
  ].filter(item => item.value > 0);

  return (
    <div className="w-full h-64 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as SentimentKey]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              borderColor: '#374151',
              borderRadius: '0.5rem',
            }}
            formatter={(value) => `${value}%`}
          />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SentimentChart;
