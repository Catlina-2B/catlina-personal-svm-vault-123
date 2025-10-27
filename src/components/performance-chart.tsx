import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  date: string;
  performance: number;
  tvl: number;
  sharePrice: number;
  formattedDate: string;
}

// 更丰富的模拟数据
const generateMockData = (days: number): ChartData[] => {
  const data: ChartData[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);

    date.setDate(date.getDate() - i);

    // 生成更真实的性能数据
    const basePerformance = -0.1;
    const trend = (days - i) / days; // 整体上升趋势
    const noise = (Math.random() - 0.5) * 0.2; // 随机波动
    const performance = basePerformance + trend * 1.0 + noise;

    // TVL 数据 (总锁定价值)
    const baseTVL = 180000;
    const tvlGrowth = trend * 100000;
    const tvlNoise = (Math.random() - 0.5) * 5000;
    const tvl = baseTVL + tvlGrowth + tvlNoise;

    // Share Price 数据
    const basePrice = 3.8;
    const priceGrowth = trend * 0.6;
    const priceNoise = (Math.random() - 0.5) * 0.1;
    const sharePrice = basePrice + priceGrowth + priceNoise;

    data.push({
      date: date.toISOString().split("T")[0],
      performance: performance * 100, // 转换为百分比
      tvl: tvl,
      sharePrice: sharePrice,
      formattedDate: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    });
  }

  return data;
};

// 不同时间范围的数据
const chartData = {
  "7d": generateMockData(7),
  "30d": generateMockData(30),
  "90d": generateMockData(90),
  All: generateMockData(180),
};

type TimeRange = "7d" | "30d" | "90d" | "All";
type ChartType = "Performance" | "TVL" | "Share Price";

export function PerformanceChart() {
  const [selectedTime, setSelectedTime] = useState<TimeRange>("30d");
  const [selectedChart, setSelectedChart] = useState<ChartType>("Performance");

  const currentData = chartData[selectedTime];

  // 获取当前图表的数据键和格式化函数
  const getChartConfig = () => {
    switch (selectedChart) {
      case "Performance":
        return {
          dataKey: "performance",
          color: "#3B82F6",
          formatter: (value: number) => [`${value.toFixed(2)}%`, "Performance"],
          yAxisFormatter: (value: number) => `${value.toFixed(1)}%`,
        };
      case "TVL":
        return {
          dataKey: "tvl",
          color: "#10B981",
          formatter: (value: number) => [
            `$${(value / 1000).toFixed(0)}K`,
            "TVL",
          ],
          yAxisFormatter: (value: number) => `$${(value / 1000).toFixed(0)}K`,
        };
      case "Share Price":
        return {
          dataKey: "sharePrice",
          color: "#8B5CF6",
          formatter: (value: number) => [`$${value.toFixed(2)}`, "Share Price"],
          yAxisFormatter: (value: number) => `$${value.toFixed(2)}`,
        };
      default:
        return {
          dataKey: "performance",
          color: "#3B82F6",
          formatter: (value: number) => [`${value.toFixed(2)}%`, "Performance"],
          yAxisFormatter: (value: number) => `${value.toFixed(1)}%`,
        };
    }
  };

  const chartConfig = getChartConfig();

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {data.formattedDate}
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {chartConfig.formatter(payload[0].value)[0]}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto">
          {(["Performance", "TVL", "Share Price"] as ChartType[]).map(
            (type) => (
              <button
                key={type}
                className={`text-sm whitespace-nowrap ${
                  selectedChart === type
                    ? "text-gray-900 dark:text-white font-medium"
                    : "text-gray-600 dark:text-gray-400"
                }`}
                onClick={() => setSelectedChart(type)}
              >
                {type}
              </button>
            ),
          )}
        </div>
        <div className="flex gap-1 sm:gap-2">
          {(["7d", "30d", "90d", "All"] as TimeRange[]).map((range) => (
            <button
              key={range}
              className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded transition-colors ${
                selectedTime === range
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => setSelectedTime(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart
            data={currentData}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorGradient" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={chartConfig.color}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={chartConfig.color}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              className="opacity-30"
              stroke="currentColor"
              strokeDasharray="3 3"
            />
            <XAxis
              axisLine={false}
              className="text-gray-500 dark:text-gray-400"
              dataKey="formattedDate"
              interval="preserveStartEnd"
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              className="text-gray-500 dark:text-gray-400"
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickFormatter={chartConfig.yAxisFormatter}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              activeDot={{
                r: 6,
                fill: chartConfig.color,
                strokeWidth: 0,
              }}
              dataKey={chartConfig.dataKey}
              dot={{
                fill: chartConfig.color,
                strokeWidth: 2,
                r: 4,
              }}
              fill="url(#colorGradient)"
              fillOpacity={1}
              stroke={chartConfig.color}
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
