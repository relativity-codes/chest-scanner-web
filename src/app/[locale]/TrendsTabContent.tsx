"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Download,
  Calendar,
  Flame,
  Gem,
  Activity,
  ArrowUpDown,
  RefreshCw,
  Info
} from "lucide-react";
import MultiSelectDropdown from "./MultiSelectDropdown";

interface DailyStat {
  date: string;
  drops: number;
  wealth: number;
}

interface ProcessedStat extends DailyStat {
  cumDrops: number;
  cumWealth: number;
}

function formatLabelDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(Date.UTC(y, m, d));
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayOfWeek = weekdayNames[dateObj.getUTCDay()];
  return `${dayOfWeek}, ${monthNames[m]} ${d}`;
}

function formatFullDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const dateObj = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  return dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
}

function groupDailyStatsByWeek(dailyStats: DailyStat[]): DailyStat[] {
  if (dailyStats.length === 0) return [];
  
  // Group days by the Monday of their calendar week
  const weeklyGroups: Record<string, { drops: number; wealth: number }> = {};
  
  dailyStats.forEach((item) => {
    const dateObj = new Date(item.date + "T00:00:00");
    const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday, 1 is Monday...
    
    // Find the Monday of this week
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(dateObj);
    monday.setUTCDate(monday.getUTCDate() - offset);
    
    const weekStr = monday.toISOString().split("T")[0]; // YYYY-MM-DD representing the Monday
    
    if (!weeklyGroups[weekStr]) {
      weeklyGroups[weekStr] = { drops: 0, wealth: 0 };
    }
    weeklyGroups[weekStr].drops += item.drops;
    weeklyGroups[weekStr].wealth += item.wealth;
  });
  
  // Sort the weeks chronologically
  return Object.entries(weeklyGroups)
    .map(([date, stats]) => ({
      date, // Monday's date string
      drops: stats.drops,
      wealth: stats.wealth
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface TrendsTabProps {
  players?: string[];
}

export default function TrendsTabContent({ players = [] }: TrendsTabProps) {
  const t = useTranslations('Trends');
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [groupBy, setGroupBy] = useState<"day" | "week">("day");
  const [timeframe, setTimeframe] = useState<string>("all");
  const [graphType, setGraphType] = useState<"daily" | "cumulative">("daily");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]); // empty means all
  
  // Interactive hover state
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      let url = "/api/stats/daily";
      if (selectedPlayers.length > 0) {
        const query = selectedPlayers.map(p => `player=${encodeURIComponent(p)}`).join('&');
        url += `?${query}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch daily statistics");
      const data = await res.json();
      setDailyStats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlayers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset timeframe when grouping toggles to prevent slice mismatch
  useEffect(() => {
    setTimeframe("all");
  }, [groupBy]);

  // Group stats based on selected view (Daily vs Weekly)
  const aggregatedStats = useMemo(() => {
    if (groupBy === "day") return dailyStats;
    return groupDailyStatsByWeek(dailyStats);
  }, [dailyStats, groupBy]);

  // Compute cumulative values and filter based on timeframe
  const processedStats = useMemo<ProcessedStat[]>(() => {
    let cumDrops = 0;
    let cumWealth = 0;

    // Calculate running cumulative totals on aggregated statistics first
    const withCumulative = aggregatedStats.map((item) => {
      cumDrops += item.drops;
      cumWealth += item.wealth;
      return {
        ...item,
        cumDrops,
        cumWealth
      };
    });

    if (timeframe === "all") return withCumulative;

    let sliceCount = 30; // default for day (30d)
    if (groupBy === "day") {
      if (timeframe === "14d") sliceCount = 14;
      else if (timeframe === "7d") sliceCount = 7;
    } else {
      // week grouping slices
      if (timeframe === "12w") sliceCount = 12;
      else if (timeframe === "6w") sliceCount = 6;
      else if (timeframe === "4w") sliceCount = 4;
    }

    return withCumulative.slice(-sliceCount);
  }, [aggregatedStats, timeframe, groupBy]);

  // General Statistics based on processed timeframe
  const statsSummary = useMemo(() => {
    if (processedStats.length === 0) {
      return {
        totalDrops: 0,
        totalWealth: 0,
        avgDrops: 0,
        avgWealth: 0,
        peakDrops: 0,
        peakDropsDate: "N/A",
        peakWealth: 0,
        peakWealthDate: "N/A"
      };
    }

    const totalDrops = processedStats.reduce((sum, d) => sum + d.drops, 0);
    const totalWealth = processedStats.reduce((sum, d) => sum + d.wealth, 0);
    const avgDrops = totalDrops / processedStats.length;
    const avgWealth = totalWealth / processedStats.length;

    let peakDrops = 0;
    let peakDropsDate = "N/A";
    let peakWealth = 0;
    let peakWealthDate = "N/A";

    processedStats.forEach((d) => {
      if (d.drops > peakDrops) {
        peakDrops = d.drops;
        peakDropsDate = d.date;
      }
      if (d.wealth > peakWealth) {
        peakWealth = d.wealth;
        peakWealthDate = d.date;
      }
    });

    return {
      totalDrops,
      totalWealth,
      avgDrops,
      avgWealth,
      peakDrops,
      peakDropsDate,
      peakWealth,
      peakWealthDate
    };
  }, [processedStats]);

  // SVG Chart Geometry Constants
  const svgWidth = 800;
  const svgHeight = 360;
  const margin = { top: 25, right: 65, bottom: 40, left: 65 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  // Scales
  const getX = (index: number) => {
    if (processedStats.length <= 1) return margin.left + chartWidth / 2;
    return margin.left + (index / (processedStats.length - 1)) * chartWidth;
  };

  const getDropsValue = (d: ProcessedStat) => (graphType === "daily" ? d.drops : d.cumDrops);
  const getWealthValue = (d: ProcessedStat) => (graphType === "daily" ? d.wealth : d.cumWealth);

  const maxDrops = useMemo(() => {
    const vals = processedStats.map(getDropsValue);
    return Math.max(...vals, 5);
  }, [processedStats, graphType]);

  const maxWealth = useMemo(() => {
    const vals = processedStats.map(getWealthValue);
    return Math.max(...vals, 500);
  }, [processedStats, graphType]);

  const getYDrops = (val: number) => {
    return margin.top + chartHeight - (val / maxDrops) * chartHeight;
  };

  const getYWealth = (val: number) => {
    return margin.top + chartHeight - (val / maxWealth) * chartHeight;
  };

  // Generate SVG Path definitions
  const dropsPath = useMemo(() => {
    if (processedStats.length === 0) return "";
    return processedStats
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getYDrops(getDropsValue(d))}`)
      .join(" ");
  }, [processedStats, maxDrops, graphType]);

  const wealthPath = useMemo(() => {
    if (processedStats.length === 0) return "";
    return processedStats
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getYWealth(getWealthValue(d))}`)
      .join(" ");
  }, [processedStats, maxWealth, graphType]);

  const dropsAreaPath = useMemo(() => {
    if (processedStats.length === 0 || !dropsPath) return "";
    return `${dropsPath} L ${getX(processedStats.length - 1)} ${margin.top + chartHeight} L ${getX(0)} ${margin.top + chartHeight} Z`;
  }, [processedStats, dropsPath]);

  const wealthAreaPath = useMemo(() => {
    if (processedStats.length === 0 || !wealthPath) return "";
    return `${wealthPath} L ${getX(processedStats.length - 1)} ${margin.top + chartHeight} L ${getX(0)} ${margin.top + chartHeight} Z`;
  }, [processedStats, wealthPath]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (processedStats.length === 0) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Map mouse X to closest data point
    const svgX = (x / rect.width) * svgWidth;
    setMouseY(y);

    if (svgX >= margin.left && svgX <= margin.left + chartWidth) {
      const fraction = (svgX - margin.left) / chartWidth;
      const index = Math.round(fraction * (processedStats.length - 1));
      if (index >= 0 && index < processedStats.length) {
        setHoverIndex(index);
      }
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Export Daily Stats as CSV
  const handleExportCSV = () => {
    const headers = ["Date", "Drops Count", "Wealth Points", "Cumulative Drops", "Cumulative Wealth"];
    const rows = processedStats.map((item) => [
      item.date,
      item.drops,
      item.wealth,
      item.cumDrops,
      item.cumWealth
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `elf_clan_chest_trends_${timeframe}_${graphType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Label ticks
  const labelInterval = Math.max(1, Math.ceil(processedStats.length / 8));
  const yGridLines = [0, 0.25, 0.5, 0.75, 1];

  if (isLoading) {
    return (
      <div className="glass-panel rounded-xl sm:rounded-2xl p-8 flex flex-col items-center justify-center min-h-[350px]">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
        <span className="text-xs text-slate-400 font-semibold tracking-wide">{t('aggregating')}</span>
      </div>
    );
  }

  if (isError || dailyStats.length === 0) {
    return (
      <div className="glass-panel rounded-xl sm:rounded-2xl p-8 flex flex-col items-center justify-center min-h-[350px] text-center">
        <Info className="w-8 h-8 text-rose-400 mb-3" />
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">{t('failedToLoad')}</h3>
        <p className="text-xs text-slate-450 mt-1 max-w-sm">
          {dailyStats.length === 0 ? t('noScanHistory') : t('serverError')}
        </p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-xs font-bold rounded-xl text-amber-500 transition-all flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('retryLoad')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" ref={containerRef}>
      
      {/* 1. STATS SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Scanned */}
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            {graphType === "daily" ? t('periodTotalDrops') : t('allTimeTotalDrops')}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-lg sm:text-2xl font-black text-amber-500 font-mono">
              {statsSummary.totalDrops.toLocaleString()}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400">{t('dropsUnit')}</span>
          </div>
          <p className="text-[9px] text-slate-500 mt-1">{t('sumOfScans')}</p>
        </div>

        {/* Total Wealth */}
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            {graphType === "daily" ? t('periodTotalWealth') : t('allTimeTotalWealth')}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-lg sm:text-2xl font-black text-purple-400 font-mono">
              {statsSummary.totalWealth.toLocaleString()}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400">{t('pointsUnit')}</span>
          </div>
          <p className="text-[9px] text-slate-500 mt-1">{t('wealthInRange')}</p>
        </div>

        {/* Peak Daily Drops */}
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 tracking-wider uppercase">{t('peakDailyDrops')}</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-lg sm:text-2xl font-black text-amber-500 font-mono">
              {statsSummary.peakDrops}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400">{t('scansUnit')}</span>
          </div>
          <p className="text-[9px] text-slate-500 mt-1">
            {t('achievedOn')} <span className="text-slate-350">{statsSummary.peakDropsDate !== "N/A" ? formatLabelDate(statsSummary.peakDropsDate) : "N/A"}</span>
          </p>
        </div>

        {/* Daily/Weekly Average Drops */}
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            {groupBy === "day" ? t('dailyAvgScans') : t('weeklyAvgScans')}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-lg sm:text-2xl font-black text-slate-200 font-mono">
              {statsSummary.avgDrops.toFixed(1)}
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400">
              {groupBy === "day" ? t('chestsPerDay') : t('chestsPerWeek')}
            </span>
          </div>
          <p className="text-[9px] text-slate-500 mt-1">
            {groupBy === "day" ? t('avgWealthDay') : t('avgWealthWeek')}
            <span className="text-purple-400 font-semibold">{Math.round(statsSummary.avgWealth).toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* 2. MAIN CHART PANEL */}
      <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col relative overflow-hidden">
        
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-500" />
              <span>{t('chartTitle')}</span>
            </h2>
            <p className="text-xs text-slate-450 mt-0.5">
              {t('chartSubtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Player Selector Dropdown */}
            {players.length > 0 && (
              <div className="w-[200px]">
                <MultiSelectDropdown
                  options={players.map(p => ({ label: p, value: p }))}
                  selected={selectedPlayers}
                  onChange={setSelectedPlayers}
                  placeholder="Players"
                />
              </div>
            )}

            {/* Group By: Daily vs. Weekly */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900 text-[10px] font-bold">
              <button
                onClick={() => setGroupBy("day")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  groupBy === "day"
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t('daily')}
              </button>
              <button
                onClick={() => setGroupBy("week")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  groupBy === "week"
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t('weekly')}
              </button>
            </div>

            {/* Toggle Daily/Cumulative */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900 text-[10px] font-bold">
              <button
                onClick={() => setGraphType("daily")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  graphType === "daily"
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {groupBy === "day" ? t('dailyStats') : t('weeklyStats')}
              </button>
              <button
                onClick={() => setGraphType("cumulative")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  graphType === "cumulative"
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t('cumulativeProgress')}
              </button>
            </div>

            {/* Timeframe Selectors */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900 text-[10px] font-bold">
              {groupBy === "day" ? (
                <>
                  {(["all", "30d", "14d", "7d"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2.5 py-1.5 rounded-lg transition-all uppercase ${
                        timeframe === tf
                          ? "bg-slate-800 text-slate-100"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {tf === "all" ? t('allTime') : tf}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {(["all", "12w", "6w", "4w"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2.5 py-1.5 rounded-lg transition-all uppercase ${
                        timeframe === tf
                          ? "bg-slate-800 text-slate-100"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {tf === "all" ? t('allTime') : tf}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Manual Refresh */}
            <button
              onClick={fetchStats}
              title="Refresh trends statistics"
              className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* SVG Wrapper */}
        <div className="relative w-full overflow-x-auto scrollbar-none">
          <div className="min-w-[700px] relative">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              width="100%"
              height="100%"
              className="overflow-visible select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Gold Drops Area Gradient */}
                <linearGradient id="dropsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dfb239" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#dfb239" stopOpacity="0.0" />
                </linearGradient>
                {/* Purple Wealth Area Gradient */}
                <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>
                
                {/* Drops Shadow Filter */}
                <filter id="dropsShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#dfb239" floodOpacity="0.15" />
                </filter>
                {/* Wealth Shadow Filter */}
                <filter id="wealthShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#a855f7" floodOpacity="0.15" />
                </filter>
              </defs>

              {/* Y Axis Grid lines and labels */}
              {yGridLines.map((ratio, i) => {
                const yPos = margin.top + chartHeight - ratio * chartHeight;
                const dropsVal = Math.round(ratio * maxDrops);
                const wealthVal = Math.round(ratio * maxWealth);

                return (
                  <g key={i}>
                    {/* Grid line */}
                    <line
                      x1={margin.left}
                      y1={yPos}
                      x2={margin.left + chartWidth}
                      y2={yPos}
                      stroke="rgba(255, 255, 255, 0.04)"
                      strokeWidth="1"
                    />
                    {/* Left label (Drops) */}
                    <text
                      x={margin.left - 12}
                      y={yPos + 3}
                      fill="#dfb239"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="var(--font-outfit)"
                      textAnchor="end"
                      opacity="0.9"
                    >
                      {dropsVal.toLocaleString()}
                    </text>
                    {/* Right label (Wealth) */}
                    <text
                      x={margin.left + chartWidth + 12}
                      y={yPos + 3}
                      fill="#a855f7"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="var(--font-outfit)"
                      textAnchor="start"
                      opacity="0.9"
                    >
                      {wealthVal.toLocaleString()}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Grid lines and Labels */}
              {processedStats.map((d, i) => {
                if (i % labelInterval !== 0 && i !== processedStats.length - 1) return null;
                const xPos = getX(i);

                return (
                  <g key={i}>
                    {/* Vertical Grid Line */}
                    <line
                      x1={xPos}
                      y1={margin.top}
                      x2={xPos}
                      y2={margin.top + chartHeight}
                      stroke="rgba(255, 255, 255, 0.03)"
                      strokeWidth="1"
                    />
                    {/* Label */}
                    <text
                      x={xPos}
                      y={margin.top + chartHeight + 18}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="var(--font-outfit)"
                      textAnchor="middle"
                    >
                      {formatLabelDate(d.date)}
                    </text>
                  </g>
                );
              })}

              {/* Area Under Curves */}
              {processedStats.length > 0 && (
                <>
                  <path d={dropsAreaPath} fill="url(#dropsGrad)" />
                  <path d={wealthAreaPath} fill="url(#wealthGrad)" />
                </>
              )}

              {/* Trend Lines */}
              {processedStats.length > 0 && (
                <>
                  <path
                    d={dropsPath}
                    fill="none"
                    stroke="#dfb239"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#dropsShadow)"
                  />
                  <path
                    d={wealthPath}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#wealthShadow)"
                  />
                </>
              )}

              {/* Interactive Hover Ruler & Highlighting Dots */}
              {hoverIndex !== null && processedStats[hoverIndex] && (
                <g>
                  {/* Ruler */}
                  <line
                    x1={getX(hoverIndex)}
                    y1={margin.top}
                    x2={getX(hoverIndex)}
                    y2={margin.top + chartHeight}
                    stroke="rgba(223, 178, 57, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  
                  {/* Drops Dot */}
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getYDrops(getDropsValue(processedStats[hoverIndex]))}
                    r="5"
                    fill="#dfb239"
                    stroke="#05060b"
                    strokeWidth="1.5"
                    filter="url(#dropsShadow)"
                  />

                  {/* Wealth Dot */}
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getYWealth(getWealthValue(processedStats[hoverIndex]))}
                    r="5"
                    fill="#a855f7"
                    stroke="#05060b"
                    strokeWidth="1.5"
                    filter="url(#wealthShadow)"
                  />
                </g>
              )}
            </svg>

            {/* Custom Tooltip Card */}
            {hoverIndex !== null && processedStats[hoverIndex] && (() => {
              const d = processedStats[hoverIndex];
              const isRightHalf = hoverIndex > processedStats.length / 2;
              
              return (
                <div
                  className="absolute pointer-events-none bg-[#0a0c16]/95 border border-slate-800 p-3 rounded-xl shadow-2xl backdrop-blur-md transition-transform duration-100 ease-out z-20 w-48 font-sans text-xs"
                  style={{
                    left: `${getX(hoverIndex)}px`,
                    top: `${mouseY - 40}px`,
                    transform: isRightHalf ? "translate(-108%, -50%)" : "translate(8%, -50%)"
                  }}
                >
                  <p className="font-bold text-slate-100 pb-1.5 border-b border-slate-800/80 mb-2">
                    {groupBy === "day" ? formatLabelDate(d.date) : `${t('weekOf')} ${formatLabelDate(d.date)}`}
                  </p>
                  
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {groupBy === "day" ? t('dailyDropsTooltip') : t('weeklyDropsTooltip')}
                      </span>
                      <span className="font-mono font-bold text-amber-400">{d.drops}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {groupBy === "day" ? t('dailyWealthTooltip') : t('weeklyWealthTooltip')}
                      </span>
                      <span className="font-mono font-bold text-purple-400">{d.wealth.toLocaleString()}</span>
                    </div>

                    {graphType === "cumulative" && (
                      <div className="pt-1.5 border-t border-slate-800/50 flex flex-col gap-1 mt-1 text-[9.5px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">{t('totalDropsTooltip')}</span>
                          <span className="font-mono font-bold text-amber-500/80">{d.cumDrops}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">{t('totalWealthTooltip')}</span>
                          <span className="font-mono font-bold text-purple-500/80">{d.cumWealth.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-[11px] font-medium border-t border-slate-900/60 pt-3">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-1.5 bg-amber-500 rounded-full" />
            <span className="text-slate-300">
              {groupBy === "day" ? t('legendDailyDrops') : t('legendWeeklyDrops')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-1.5 bg-purple-500 rounded-full" />
            <span className="text-slate-300">
              {groupBy === "day" ? t('legendDailyWealth') : t('legendWeeklyWealth')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. DETAILED LOGS BREAKDOWN */}
      <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col h-[400px] overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              {groupBy === "day"
                ? t('logTitleDay', { count: processedStats.length })
                : t('logTitleWeek', { count: processedStats.length })}
            </h3>
            <p className="text-[10px] text-slate-500">
              {groupBy === "day" ? t('logSubtitleDate') : t('logSubtitleWeek')}
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-slate-100 transition-all text-xs"
          >
            <Download className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('exportRangeCsv')}</span>
          </button>
        </div>

        {/* Spreadsheet Table */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="min-w-full inline-block align-middle">
            <div className="border border-slate-900 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-slate-900 text-xs font-sans">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      {groupBy === "day" ? t('dateCol') : t('weekStartCol')}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {groupBy === "day" ? t('dailyDropsCol') : t('weeklyDropsCol')}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {groupBy === "day" ? t('dailyWealthCol') : t('weeklyWealthCol')}
                    </th>
                    <th className="px-4 py-3 text-right">{t('cumDropsCol')}</th>
                    <th className="px-4 py-3 text-right">{t('cumWealthCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 bg-slate-950/20">
                  {[...processedStats].reverse().map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-350">{formatFullDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-500 font-semibold">{row.drops}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-purple-400 font-semibold">{row.wealth.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-600/85">{row.cumDrops.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-purple-500/85">{row.cumWealth.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
