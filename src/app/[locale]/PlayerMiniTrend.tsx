"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCw, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface DailyStat {
  date: string;
  drops: number;
  wealth: number;
}

interface PlayerMiniTrendProps {
  player: string;
}

function formatLabelDate(dateStr: string, locale: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(Date.UTC(y, m, d));
  try {
    return dateObj.toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  } catch (err) {
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayOfWeek = weekdayNames[dateObj.getUTCDay()];
    return `${dayOfWeek}, ${monthNames[m]} ${d}`;
  }
}

export default function PlayerMiniTrend({ player }: PlayerMiniTrendProps) {
  const locale = useLocale();
  const t = useTranslations("Trends");
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchPlayerStats() {
      setIsLoading(true);
      setIsError(false);
      try {
        const res = await fetch(`/api/stats/daily?player=${encodeURIComponent(player)}`);
        if (!res.ok) throw new Error("Failed to fetch player stats");
        const data = await res.json();
        if (active) {
          setStats(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setIsError(true);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }
    fetchPlayerStats();
    return () => {
      active = false;
    };
  }, [player]);

  // Use a rolling 30-day view or all time if shorter
  const chartData = useMemo(() => {
    if (stats.length === 0) return [];
    return stats.slice(-30); // show last 30 days of activity
  }, [stats]);

  // SVG dimensions
  const width = 460;
  const height = 110;
  const margin = { top: 15, right: 35, bottom: 20, left: 35 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const getX = (index: number) => {
    if (chartData.length <= 1) return margin.left + chartWidth / 2;
    return margin.left + (index / (chartData.length - 1)) * chartWidth;
  };

  const maxDrops = useMemo(() => {
    const vals = chartData.map((d) => d.drops);
    return Math.max(...vals, 4);
  }, [chartData]);

  const maxWealth = useMemo(() => {
    const vals = chartData.map((d) => d.wealth);
    return Math.max(...vals, 150);
  }, [chartData]);

  const getYDrops = (val: number) => {
    return margin.top + chartHeight - (val / maxDrops) * chartHeight;
  };

  const getYWealth = (val: number) => {
    return margin.top + chartHeight - (val / maxWealth) * chartHeight;
  };

  const dropsPath = useMemo(() => {
    if (chartData.length === 0) return "";
    return chartData
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getYDrops(d.drops)}`)
      .join(" ");
  }, [chartData, maxDrops]);

  const wealthPath = useMemo(() => {
    if (chartData.length === 0) return "";
    return chartData
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getYWealth(d.wealth)}`)
      .join(" ");
  }, [chartData, maxWealth]);

  const dropsAreaPath = useMemo(() => {
    if (chartData.length === 0 || !dropsPath) return "";
    return `${dropsPath} L ${getX(chartData.length - 1)} ${margin.top + chartHeight} L ${getX(0)} ${margin.top + chartHeight} Z`;
  }, [chartData, dropsPath]);

  const wealthAreaPath = useMemo(() => {
    if (chartData.length === 0 || !wealthPath) return "";
    return `${wealthPath} L ${getX(chartData.length - 1)} ${margin.top + chartHeight} L ${getX(0)} ${margin.top + chartHeight} Z`;
  }, [chartData, wealthPath]);

  if (isLoading) {
    return (
      <div className="bg-slate-950/20 border border-slate-900 rounded-xl p-6 flex flex-col items-center justify-center min-h-[110px]">
        <RefreshCw className="w-5 h-5 text-amber-500 animate-spin mb-1.5" />
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{t('loadingTrendData')}</span>
      </div>
    );
  }

  if (isError || chartData.length === 0) {
    return (
      <div className="bg-slate-950/20 border border-slate-900 rounded-xl p-4 flex flex-col items-center justify-center min-h-[110px] text-center text-xs text-slate-500">
        <Info className="w-4 h-4 text-slate-600 mb-1" />
        <span>{t('noTrendHistory')}</span>
      </div>
    );
  }

  const firstDateLabel = formatLabelDate(chartData[0].date, locale);
  const lastDateLabel = formatLabelDate(chartData[chartData.length - 1].date, locale);

  return (
    <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[8px] font-bold text-slate-400 tracking-wide uppercase">
          {t('activityTrend', { count: chartData.length })}
        </span>
        <div className="flex items-center gap-2.5 text-[8.5px]">
          <span className="flex items-center gap-1 text-amber-500 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {t('dropsPeak', { peak: maxDrops })}
          </span>
          <span className="flex items-center gap-1 text-purple-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            {t('wealthPeak', { peak: maxWealth })}
          </span>
        </div>
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="overflow-visible">
          <defs>
            <linearGradient id="miniDropsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dfb239" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#dfb239" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="miniWealthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Bounds */}
          <line x1={margin.left} y1={margin.top} x2={margin.left + chartWidth} y2={margin.top} stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
          <line x1={margin.left} y1={margin.top + chartHeight} x2={margin.left + chartWidth} y2={margin.top + chartHeight} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />

          {/* Area under curves */}
          <path d={dropsAreaPath} fill="url(#miniDropsGrad)" />
          <path d={wealthAreaPath} fill="url(#miniWealthGrad)" />

          {/* Lines */}
          <path d={dropsPath} fill="none" stroke="#dfb239" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={wealthPath} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* X axis endpoints */}
          <text x={margin.left} y={margin.top + chartHeight + 14} fill="#64748b" fontSize="8" fontFamily="var(--font-outfit)" textAnchor="start">
            {firstDateLabel}
          </text>
          <text x={margin.left + chartWidth} y={margin.top + chartHeight + 14} fill="#64748b" fontSize="8" fontFamily="var(--font-outfit)" textAnchor="end">
            {lastDateLabel}
          </text>

          {/* Y Axis Min/Max indicators */}
          {/* Drops (Left axis) */}
          <text x={margin.left - 6} y={margin.top + 3} fill="#dfb239" fontSize="7" fontFamily="var(--font-outfit)" textAnchor="end" fontWeight="bold">
            {maxDrops}
          </text>
          <text x={margin.left - 6} y={margin.top + chartHeight} fill="#dfb239" fontSize="7" fontFamily="var(--font-outfit)" textAnchor="end">
            0
          </text>

          {/* Wealth (Right axis) */}
          <text x={margin.left + chartWidth + 6} y={margin.top + 3} fill="#a855f7" fontSize="7" fontFamily="var(--font-outfit)" textAnchor="start" fontWeight="bold">
            {maxWealth}
          </text>
          <text x={margin.left + chartWidth + 6} y={margin.top + chartHeight} fill="#a855f7" fontSize="7" fontFamily="var(--font-outfit)" textAnchor="start">
            0
          </text>
        </svg>
      </div>
    </div>
  );
}
