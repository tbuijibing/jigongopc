import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn, formatCents, formatShortDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  BarChart3,
  LineChart,
  MoreHorizontal,
} from "lucide-react";

export type ChartType = "line" | "bar";
export type TimeRange = "7d" | "30d" | "90d" | "1y" | "all";

interface RevenueDataPoint {
  date: string;
  revenue: number;
  purchases: number;
  refunds: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  className?: string;
  title?: string;
  onExport?: (format: "csv" | "json") => void;
}

const TIME_RANGE_OPTIONS = [
  { value: "7d", label: "charts.last7Days" },
  { value: "30d", label: "charts.last30Days" },
  { value: "90d", label: "charts.last90Days" },
  { value: "1y", label: "charts.last1Year" },
  { value: "all", label: "charts.allTime" },
];

export function RevenueChart({
  data,
  className,
  title,
  onExport,
}: RevenueChartProps) {
  const { t } = useTranslation();
  const [chartType, setChartType] = useState<ChartType>("line");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter data based on time range
  const filteredData = useMemo(() => {
    if (timeRange === "all" || data.length === 0) return data;

    const now = new Date();
    const cutoffDate = new Date();

    switch (timeRange) {
      case "7d":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return data.filter((point) => new Date(point.date) >= cutoffDate);
  }, [data, timeRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { total: 0, change: 0, avgDaily: 0 };
    }

    const total = filteredData.reduce((sum, point) => sum + point.revenue, 0);

    // Compare with previous period
    const midPoint = Math.floor(filteredData.length / 2);
    const firstHalf = filteredData.slice(0, midPoint);
    const secondHalf = filteredData.slice(midPoint);

    const firstHalfTotal = firstHalf.reduce((sum, point) => sum + point.revenue, 0);
    const secondHalfTotal = secondHalf.reduce((sum, point) => sum + point.revenue, 0);

    const change = firstHalfTotal > 0
      ? ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100
      : 0;

    const avgDaily = total / filteredData.length;

    return { total, change, avgDaily };
  }, [filteredData]);

  // Chart dimensions and scaling
  const chartHeight = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 50 };
  const innerWidth = 600 - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxRevenue = Math.max(...filteredData.map((d) => d.revenue), 1);
  const minRevenue = Math.min(...filteredData.map((d) => d.revenue), 0);
  const revenueRange = maxRevenue - minRevenue;

  const getX = (index: number) => {
    return padding.left + (index / (filteredData.length - 1 || 1)) * innerWidth;
  };

  const getY = (revenue: number) => {
    return padding.top + innerHeight - ((revenue - minRevenue) / revenueRange) * innerHeight;
  };

  // Generate SVG path for line chart
  const linePath = useMemo(() => {
    if (filteredData.length === 0) return "";
    return filteredData
      .map((point, i) => {
        const x = getX(i);
        const y = getY(point.revenue);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [filteredData]);

  // Generate area path for line chart (with gradient fill)
  const areaPath = useMemo(() => {
    if (filteredData.length === 0) return "";
    const line = linePath;
    const lastX = getX(filteredData.length - 1);
    const firstX = getX(0);
    const bottomY = padding.top + innerHeight;
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [filteredData, linePath]);

  // Bar width calculation
  const barWidth = filteredData.length > 0
    ? Math.max((innerWidth / filteredData.length) * 0.7, 4)
    : 0;
  const barGap = filteredData.length > 0
    ? (innerWidth / filteredData.length) * 0.3
    : 0;

  const handleExport = (format: "csv" | "json") => {
    if (onExport) {
      onExport(format);
      return;
    }

    // Default export behavior
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === "csv") {
      const headers = "Date,Revenue,Purchases,Refunds\n";
      const rows = filteredData
        .map((d) => `${d.date},${d.revenue},${d.purchases},${d.refunds}`)
        .join("\n");
      content = headers + rows;
      filename = `revenue_export_${new Date().toISOString().split("T")[0]}.csv`;
      mimeType = "text/csv";
    } else {
      content = JSON.stringify(filteredData, null, 2);
      filename = `revenue_export_${new Date().toISOString().split("T")[0]}.json`;
      mimeType = "application/json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {title && <CardTitle className="text-lg">{title}</CardTitle>}
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {formatCents(stats.total)}
              </span>
              {stats.change !== 0 && (
                <span
                  className={cn(
                    "text-sm font-medium flex items-center gap-0.5",
                    stats.change > 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {stats.change > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(stats.change).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chart Type Toggle */}
            <div className="flex items-center bg-muted rounded-md p-0.5">
              <button
                onClick={() => setChartType("line")}
                className={cn(
                  "p-1.5 rounded-sm transition-colors",
                  chartType === "line" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                title={t("charts.lineChart", "Line Chart")}
              >
                <LineChart className="h-4 w-4" />
              </button>
              <button
                onClick={() => setChartType("bar")}
                className={cn(
                  "p-1.5 rounded-sm transition-colors",
                  chartType === "bar" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                title={t("charts.barChart", "Bar Chart")}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>

            {/* Time Range Selector */}
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("charts.exportCSV", "Export as CSV")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("charts.exportJSON", "Export as JSON")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {t("charts.avgDaily", "Avg. daily")}: {formatCents(Math.round(stats.avgDaily))}
        </div>
      </CardHeader>

      <CardContent>
        {filteredData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            {t("charts.noData", "No data available")}
          </div>
        ) : (
          <TooltipProvider>
            <div className="relative">
              <svg
                viewBox={`0 0 600 ${chartHeight}`}
                className="w-full h-[200px]"
                preserveAspectRatio="none"
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = padding.top + innerHeight * ratio;
                  return (
                    <line
                      key={ratio}
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + innerWidth}
                      y2={y}
                      stroke="currentColor"
                      className="text-muted-foreground/20"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                  );
                })}

                {/* Y-axis labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const value = minRevenue + revenueRange * (1 - ratio);
                  const y = padding.top + innerHeight * ratio;
                  return (
                    <text
                      key={ratio}
                      x={padding.left - 5}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="text-[10px] fill-muted-foreground"
                    >
                      {formatNumber(value)}
                    </text>
                  );
                })}

                {chartType === "line" ? (
                  <>
                    {/* Gradient area fill */}
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <path
                      d={areaPath}
                      fill="url(#areaGradient)"
                      className="transition-all duration-300"
                    />
                    {/* Line */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300"
                    />
                    {/* Data points */}
                    {filteredData.map((point, i) => (
                      <circle
                        key={i}
                        cx={getX(i)}
                        cy={getY(point.revenue)}
                        r={hoveredIndex === i ? 5 : 3}
                        fill="hsl(var(--primary))"
                        className="transition-all duration-150"
                      />
                    ))}
                  </>
                ) : (
                  /* Bar Chart */
                  filteredData.map((point, i) => {
                    const x = getX(i) - barWidth / 2;
                    const y = getY(point.revenue);
                    const height = padding.top + innerHeight - y;
                    return (
                      <rect
                        key={i}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={height}
                        fill="hsl(var(--primary))"
                        rx={2}
                        className={cn(
                          "transition-all duration-150",
                          hoveredIndex === i ? "opacity-80" : "opacity-60"
                        )}
                      />
                    );
                  })
                )}

                {/* X-axis labels (show first, middle, last) */}
                {filteredData.length > 0 && (
                  <>
                    <text
                      x={getX(0)}
                      y={chartHeight - 5}
                      textAnchor="start"
                      className="text-[10px] fill-muted-foreground"
                    >
                      {formatShortDate(filteredData[0].date)}
                    </text>
                    {filteredData.length > 2 && (
                      <text
                        x={getX(Math.floor(filteredData.length / 2))}
                        y={chartHeight - 5}
                        textAnchor="middle"
                        className="text-[10px] fill-muted-foreground"
                      >
                        {formatShortDate(filteredData[Math.floor(filteredData.length / 2)].date)}
                      </text>
                    )}
                    <text
                      x={getX(filteredData.length - 1)}
                      y={chartHeight - 5}
                      textAnchor="end"
                      className="text-[10px] fill-muted-foreground"
                    >
                      {formatShortDate(filteredData[filteredData.length - 1].date)}
                    </text>
                  </>
                )}
              </svg>

              {/* Tooltip overlay */}
              <div className="absolute inset-0">
                {filteredData.map((point, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute h-full cursor-pointer"
                        style={{
                          left: `${((getX(i) - (chartType === "bar" ? barWidth / 2 : 0)) / 600) * 100}%`,
                          width: `${(chartType === "bar" ? barWidth : 600 / filteredData.length) / 600 * 100}%`,
                        }}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="space-y-1">
                        <div className="font-medium">{formatShortDate(point.date)}</div>
                        <div className="text-primary">{t("charts.revenue", "Revenue")}: {formatCents(point.revenue)}</div>
                        <div className="text-muted-foreground">
                          {t("charts.purchases", "Purchases")}: {point.purchases}
                        </div>
                        {point.refunds > 0 && (
                          <div className="text-red-500">
                            {t("charts.refunds", "Refunds")}: {point.refunds}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
