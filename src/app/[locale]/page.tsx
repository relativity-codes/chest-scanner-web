"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { parseChestLevel, calculateChestPoints } from "@/lib/chest-points";
import TrendsTabContent from "./TrendsTabContent";
import PlayerMiniTrend from "./PlayerMiniTrend";
import MultiSelectDropdown from "./MultiSelectDropdown";
import {
  Activity,
  Users,
  ShieldAlert,
  Plus,
  Trash2,
  Check,
  Database,
  ArrowRight,
  Wifi,
  WifiOff,
  Flame,
  Search,
  BookOpen,
  Filter,
  Calendar,
  BarChart3,
  Download,
  Target,
  X,
  MessageCircle,
  MessageSquare,
  Gem,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trophy,
  ScanText,
  ChevronDown,
  Lock
} from "lucide-react";

interface Chest {
  id: string;
  chestName: string;
  fromPlayer: string;
  source: string;
  time: string;
  gameDay: string;
  originalTimer: string;
  createdAt: string;
}

function formatUTC10Time(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const utc10Time = date.getTime() + (10 * 60 * 60 * 1000);
  const d = new Date(utc10Time);
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

interface PlayerFix {
  id: string;
  ocrName: string;
  correctedTo: string;
}

interface UnknownPlayer {
  id: string;
  ocrName: string;
  encountered: string;
}

interface ChestTypeStats {
  total: number;
  levels: Record<number, number>;
}

interface PlayerContribution {
  player: string;
  total: number;
  points: number;
  epicCrypt: ChestTypeStats;
  rareCrypt: ChestTypeStats;
  commonCrypt: ChestTypeStats;
  citadel: ChestTypeStats;
  other: ChestTypeStats;
  sources: Record<string, number>;
  todayCount: number;
  weeklyCount: number;
  ratePerDay: number;
  ratePerWeek: number;
}

type ContributionSortField = "points" | "total" | "ratePerDay" | "ratePerWeek" | "todayCount" | "weeklyCount";
type SortDirection = "asc" | "desc";

function SortableTh({
  field,
  activeField,
  direction,
  onSort,
  className,
  children,
}: {
  field: ContributionSortField;
  activeField: ContributionSortField;
  direction: SortDirection;
  onSort: (field: ContributionSortField) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = activeField === field;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center justify-center gap-1 hover:text-gold transition-colors w-full"
      >
        {children}
        {isActive ? (
          direction === "desc" ? <ArrowDown className="w-3 h-3 shrink-0" /> : <ArrowUp className="w-3 h-3 shrink-0" />
        ) : (
          <ArrowUpDown className="w-3 h-3 shrink-0 opacity-40" />
        )}
      </button>
    </th>
  );
}

// Helper to calculate game day in UTC+10
function getUTC10GameDayStr(date: Date): string {
  const utc10Time = date.getTime() + (10 * 60 * 60 * 1000);
  const d = new Date(utc10Time);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `chests_${yyyy}-${mm}-${dd}`;
}

function getUTC10DateOnly(date: Date | string): Date {
  const d = new Date(date);
  const utc10Time = d.getTime() + (10 * 60 * 60 * 1000);
  const utc10Date = new Date(utc10Time);
  return new Date(Date.UTC(utc10Date.getUTCFullYear(), utc10Date.getUTCMonth(), utc10Date.getUTCDate()));
}

function getDaysOnSystem(firstAppearance: Date | string, currentDate: Date): number {
  const firstDateOnly = getUTC10DateOnly(firstAppearance);
  const currentDateOnly = getUTC10DateOnly(currentDate);
  const diffTime = currentDateOnly.getTime() - firstDateOnly.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

function formatUTC10ShortDate(date: Date): string {
  const utc10Time = date.getTime() + (10 * 60 * 60 * 1000);
  const d = new Date(utc10Time);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

interface WeekBucket {
  index: number;
  title: string;
  dateRange: string;
}

function getLast5WeekBuckets(now: Date): WeekBucket[] {
  const endDate = getUTC10DateOnly(now);
  return Array.from({ length: 5 }, (_, i) => {
    const weekEnd = new Date(endDate);
    weekEnd.setUTCDate(weekEnd.getUTCDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const title = i === 0 ? "This Week" : i === 1 ? "Last Week" : `${i} Weeks Ago`;
    return {
      index: i,
      title,
      dateRange: `${formatUTC10ShortDate(weekStart)} – ${formatUTC10ShortDate(weekEnd)}`,
    };
  });
}

function getWeekIndexForChest(chestTime: string | Date, now: Date): number | null {
  const chestDate = getUTC10DateOnly(chestTime);
  const nowDate = getUTC10DateOnly(now);
  const diffDays = Math.floor((nowDate.getTime() - chestDate.getTime()) / 86400000);
  if (diffDays < 0 || diffDays >= 35) return null;
  return Math.floor(diffDays / 7);
}

interface WeeklyPlayerContribution {
  player: string;
  weeks: [number, number, number, number, number];
  weekPoints: [number, number, number, number, number];
  total: number;
  totalPoints: number;
}

type WeeklySortField = "total" | "week0" | "week1" | "week2" | "week3" | "week4";

const ChestIcon = ({ type, className = "w-10 h-10" }: { type: string; className?: string }) => {
  if (type === "legendary") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="24" fill="url(#legendaryGlow)" opacity="0.4" />
        <ellipse cx="32" cy="54" rx="20" ry="6" fill="#000" opacity="0.6" />
        <rect x="12" y="28" width="40" height="24" rx="3" fill="url(#goldGrad)" stroke="#5c4308" strokeWidth="2" />
        <rect x="20" y="28" width="6" height="24" fill="#3a2a05" />
        <rect x="38" y="28" width="6" height="24" fill="#3a2a05" />
        <rect x="22" y="28" width="2" height="24" fill="#ffd700" />
        <rect x="40" y="22" width="2" height="30" fill="#ffd700" />
        <path d="M10 28 C10 14, 54 14, 54 28 Z" fill="url(#goldLidGrad)" stroke="#5c4308" strokeWidth="2" />
        <path d="M18 28 C18 17, 28 17, 28 28 Z" fill="#3a2a05" />
        <path d="M36 28 C36 17, 46 17, 46 28 Z" fill="#3a2a05" />
        <path d="M20 28 C20 18, 26 18, 26 28 Z" fill="#ffd700" opacity="0.8" />
        <path d="M38 28 C38 18, 44 18, 44 28 Z" fill="#ffd700" opacity="0.8" />
        <rect x="27" y="24" width="10" height="10" rx="1.5" fill="#2c2004" stroke="#ffd700" strokeWidth="1.5" />
        <circle cx="32" cy="29" r="1.5" fill="#ffd700" />
        <line x1="32" y1="29.5" x2="32" y2="33" stroke="#ffd700" strokeWidth="1.5" />
        <polygon points="32,8 35,13 32,18 29,13" fill="#ffd700" />
        <circle cx="23" cy="22" r="1.5" fill="#f43f5e" />
        <circle cx="41" cy="22" r="1.5" fill="#f43f5e" />
      </svg>
    );
  }

  if (type === "epic") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="24" fill="url(#epicGlow)" opacity="0.35" />
        <ellipse cx="32" cy="54" rx="20" ry="6" fill="#000" opacity="0.6" />
        <rect x="12" y="28" width="40" height="24" rx="3" fill="url(#purpleGrad)" stroke="#4c1d95" strokeWidth="2" />
        <rect x="20" y="28" width="6" height="24" fill="#2e1065" />
        <rect x="38" y="28" width="6" height="24" fill="#2e1065" />
        <rect x="22" y="28" width="2" height="24" fill="#c084fc" />
        <rect x="40" y="28" width="2" height="24" fill="#c084fc" />
        <path d="M10 28 C10 14, 54 14, 54 28 Z" fill="url(#purpleLidGrad)" stroke="#4c1d95" strokeWidth="2" />
        <path d="M18 28 C18 17, 28 17, 28 28 Z" fill="#2e1065" />
        <path d="M36 28 C36 17, 46 17, 46 28 Z" fill="#2e1065" />
        <polygon points="32,21 37,27 32,33 27,27" fill="#e9d5ff" stroke="#a855f7" strokeWidth="1.5" />
        <circle cx="32" cy="27" r="2" fill="#c084fc" />
      </svg>
    );
  }

  if (type === "rare") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="24" fill="url(#rareGlow)" opacity="0.3" />
        <ellipse cx="32" cy="54" rx="20" ry="6" fill="#000" opacity="0.6" />
        <rect x="12" y="28" width="40" height="24" rx="3" fill="url(#blueGrad)" stroke="#1e3a8a" strokeWidth="2" />
        <rect x="20" y="28" width="6" height="24" fill="#0f172a" />
        <rect x="38" y="28" width="6" height="24" fill="#0f172a" />
        <rect x="22" y="28" width="2" height="24" fill="#60a5fa" />
        <rect x="40" y="28" width="2" height="24" fill="#60a5fa" />
        <path d="M10 28 C10 14, 54 14, 54 28 Z" fill="url(#blueLidGrad)" stroke="#1e3a8a" strokeWidth="2" />
        <path d="M18 28 C18 17, 28 17, 28 28 Z" fill="#0f172a" />
        <path d="M36 28 C36 17, 46 17, 46 28 Z" fill="#0f172a" />
        <rect x="28" y="24" width="8" height="8" rx="1" fill="#0f172a" stroke="#60a5fa" strokeWidth="1" />
        <circle cx="32" cy="28" r="1.5" fill="#60a5fa" />
      </svg>
    );
  }

  if (type === "heroic") {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="24" fill="url(#cyanGlow)" opacity="0.3" />
        <ellipse cx="32" cy="54" rx="20" ry="6" fill="#000" opacity="0.6" />
        <rect x="12" y="28" width="40" height="24" rx="3" fill="url(#cyanGrad)" stroke="#0e7490" strokeWidth="2" />
        <rect x="20" y="28" width="6" height="24" fill="#0f172a" />
        <rect x="38" y="28" width="6" height="24" fill="#0f172a" />
        <path d="M10 28 C10 14, 54 14, 54 28 Z" fill="url(#cyanLidGrad)" stroke="#0e7490" strokeWidth="2" />
        <rect x="29" y="25" width="6" height="6" rx="1" fill="#0f172a" stroke="#22d3ee" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="54" rx="18" ry="5" fill="#000" opacity="0.6" />
      <rect x="14" y="30" width="36" height="22" rx="2" fill="url(#woodGrad)" stroke="#451a03" strokeWidth="2" />
      <rect x="22" y="30" width="4" height="22" fill="#78350f" />
      <rect x="38" y="30" width="4" height="22" fill="#78350f" />
      <path d="M12 30 C12 18, 52 18, 52 30 Z" fill="url(#woodLidGrad)" stroke="#451a03" strokeWidth="2" />
      <rect x="30" y="28" width="4" height="5" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
    </svg>
  );
};

const CircularProgress = ({ percent, color, label, count }: { percent: number; color: string; label: string; count: number }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-3.5 bg-slate-950/45 border border-slate-900 rounded-xl relative">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="stroke-slate-900"
            strokeWidth="4"
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-black text-slate-100 font-sans">{percent}%</span>
        </div>
      </div>
      <span className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wide text-center">{label}</span>
      <span className="text-[9px] text-slate-550 font-mono mt-0.5">{count} drops</span>
    </div>
  );
};

export default function Dashboard() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('Dashboard');
  const clanName = process.env.NEXT_PUBLIC_CLAN_NAME ?? 'ELF';
  const [rawChests, setRawChests] = useState<Chest[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [firstAppearances, setFirstAppearances] = useState<Record<string, string>>({});
  const [totalAllTimeScans, setTotalAllTimeScans] = useState<Record<string, number>>({});
  const [loadedChestIds, setLoadedChestIds] = useState<Set<string>>(new Set());

  // Premium Analytics & Filtering States
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [dailyTarget, setDailyTarget] = useState<number>(40);
  const [weeklyTarget, setWeeklyTarget] = useState<number>(280);
  const [contributionSortField, setContributionSortField] = useState<ContributionSortField>("points");
  const [contributionSortDirection, setContributionSortDirection] = useState<SortDirection>("desc");

  const isDaily = filterDateRange === "today";
  const activeTarget = isDaily ? dailyTarget : weeklyTarget;
  const setActiveTarget = isDaily ? setDailyTarget : setWeeklyTarget;
  const targetLabel = isDaily ? t('dailyTargetDynamic') : t('weeklyTargetDynamic');

  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteSecretKeyInput, setDeleteSecretKeyInput] = useState("");
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [fixes, setFixes] = useState<PlayerFix[]>([]);
  const [unknownPlayers, setUnknownPlayers] = useState<UnknownPlayer[]>([]);

  const [activeTab, setActiveTab] = useState<"live" | "contributions" | "weekly" | "whitelist" | "corrections" | "trends" | "search">("live");
  const [chestSearchQuery, setChestSearchQuery] = useState<string[]>([]);
  const [chestSearchPlayerQuery, setChestSearchPlayerQuery] = useState<string[]>([]);
  const [chestSearchDateQuery, setChestSearchDateQuery] = useState<string[]>([]);
  const [chestSearchSourceQuery, setChestSearchSourceQuery] = useState<string[]>([]);
  const [weeklySortField, setWeeklySortField] = useState<WeeklySortField>("total");
  const [weeklySortDirection, setWeeklySortDirection] = useState<SortDirection>("desc");
  const [isConnected, setIsConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Roster inputs
  const [newPlayerName, setNewPlayerName] = useState("");
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  // Correction inputs
  const [ocrErrorInput, setOcrErrorInput] = useState("");
  const [ocrCorrectToInput, setOcrCorrectToInput] = useState("");

  // Bulk selection states
  const [selectedUnknowns, setSelectedUnknowns] = useState<string[]>([]);
  const [bulkCorrectionTarget, setBulkCorrectionTarget] = useState("");
  const [unknownsDropdownOpen, setUnknownsDropdownOpen] = useState(false);
  const [unknownsSearchQuery, setUnknownsSearchQuery] = useState("");

  const sortedWhitelistNames = useMemo(() => {
    return [...players].sort((a, b) => a.localeCompare(b));
  }, [players]);

  const filteredUnknowns = useMemo(() => {
    const query = unknownsSearchQuery.toLowerCase();
    const sorted = [...unknownPlayers].sort((a, b) => a.ocrName.localeCompare(b.ocrName));
    return sorted.filter((u) => u.ocrName.toLowerCase().includes(query));
  }, [unknownPlayers, unknownsSearchQuery]);

  const unknownsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (unknownsDropdownRef.current && !unknownsDropdownRef.current.contains(event.target as Node)) {
        setUnknownsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Dynamically map rawChests based on spelling fixes
  const mappedRawChests = useMemo(() => {
    const fixesMap = new Map<string, string>();
    fixes.forEach((f) => {
      fixesMap.set(f.ocrName, f.correctedTo);
    });

    return rawChests.map((chest) => {
      const rawP = chest.fromPlayer || "Unknown";
      const correctedP = fixesMap.get(rawP) || rawP;
      if (correctedP === rawP) return chest;
      return {
        ...chest,
        fromPlayer: correctedP,
      };
    });
  }, [rawChests, fixes]);

  // Compute active filtered chests
  const chests = useMemo(() => {
    return mappedRawChests.filter(chest => {
      if (filterSource !== "all" && chest.source !== filterSource) {
        return false;
      }
      if (filterDateRange !== "all") {
        const chestDate = new Date(chest.time);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - chestDate.getTime());
        if (filterDateRange === "today") {
          const todayGameDayStr = getUTC10GameDayStr(now);
          if (chest.gameDay !== todayGameDayStr) return false;
        } else if (filterDateRange === "week") {
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 7) return false;
        } else if (filterDateRange === "month") {
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 30) return false;
        }
      }
      return true;
    });
  }, [mappedRawChests, filterSource, filterDateRange]);

  const audioContextRef = useRef<AudioContext | null>(null);


  const fetchChests = useCallback(async (dateRange: string) => {
    try {
      let url = "/api/chests";
      if (dateRange === "today") {
        const todayGameDayStr = getUTC10GameDayStr(new Date());
        url = `/api/chests?gameDay=${encodeURIComponent(todayGameDayStr)}`;
      }
      const res = await fetch(url);
      const chestsData = await res.json();
      setRawChests(Array.isArray(chestsData) ? chestsData : []);
      if (Array.isArray(chestsData)) {
        setLoadedChestIds(new Set(chestsData.map((c) => c.id)));
      }
    } catch (e) {
      console.error("Failed to load chests:", e);
    }
  }, []);

  const fetchInitialMetadata = async () => {
    try {
      const [whitelistRes, fixesRes, unknownsRes] = await Promise.all([
        fetch("/api/whitelist"),
        fetch("/api/player-fixes"),
        fetch("/api/unknown-players"),
      ]);

      const whitelistData = await whitelistRes.json();
      const fixesData = await fixesRes.json();
      const unknownsData = await unknownsRes.json();

      setPlayers(Array.isArray(whitelistData.players) ? whitelistData.players : []);
      setFirstAppearances(whitelistData.firstAppearances || {});
      setTotalAllTimeScans(whitelistData.totalAllTimeScans || {});
      setFixes(Array.isArray(fixesData) ? fixesData : []);
      setUnknownPlayers(Array.isArray(unknownsData) ? unknownsData : []);
    } catch (e) {
      console.error("Failed to load initial metadata:", e);
    }
  };


  // Load Initial Metadata on mount
  useEffect(() => {
    fetchInitialMetadata();
  }, []);

  // Fetch chests whenever filterDateRange changes (API returns last 5 weeks max)
  useEffect(() => {
    fetchChests(filterDateRange);
  }, [filterDateRange, fetchChests]);

  // Real-Time Player Contributions Aggregation
  const contributionsList = useMemo(() => {
    const createEmptyStats = (): ChestTypeStats => ({ total: 0, levels: {} });

    const contributions: Record<string, {
      total: number;
      points: number;
      epicCrypt: ChestTypeStats;
      rareCrypt: ChestTypeStats;
      commonCrypt: ChestTypeStats;
      citadel: ChestTypeStats;
      other: ChestTypeStats;
      sources: Record<string, number>;
      todayCount: number;
      weeklyCount: number;
    }> = {};

    const now = new Date();
    const todayGameDayStr = getUTC10GameDayStr(now);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const initPlayerStats = () => ({
      total: 0,
      points: 0,
      epicCrypt: createEmptyStats(),
      rareCrypt: createEmptyStats(),
      commonCrypt: createEmptyStats(),
      citadel: createEmptyStats(),
      other: createEmptyStats(),
      sources: {},
      todayCount: 0,
      weeklyCount: 0
    });

    // Initialize whitelisted players with 0 stats
    players.forEach(p => {
      contributions[p] = initPlayerStats();
    });

    // Aggregate drops from scanned chests
    chests.forEach((chest) => {
      const p = chest.fromPlayer || "Unknown";
      if (!contributions[p]) {
        contributions[p] = initPlayerStats();
      }
      contributions[p].total += 1;

      // Calculate score points (Clan Wealth)
      const pts = calculateChestPoints(chest.chestName, chest.source);
      contributions[p].points += pts;

      const src = chest.source || "Other";
      contributions[p].sources[src] = (contributions[p].sources[src] || 0) + 1;

      const cn = chest.chestName.toLowerCase();
      const fullText = `${cn} ${(chest.source || "").toLowerCase()}`;

      const isCitadel = fullText.includes("citadel");
      const isEpic = fullText.includes("epic") || fullText.includes("dragon");
      const isRare = fullText.includes("rare") || cn.includes("minotaur") || cn.includes("wyvern");
      const isCommon = fullText.includes("common") ||
        cn.includes("troll") ||
        cn.includes("sphinx") ||
        cn.includes("gorgon") ||
        (fullText.includes("crypt") && !isEpic && !isRare);

      const level = parseChestLevel(chest.chestName, chest.source);

      if (isEpic) {
        contributions[p].epicCrypt.total += 1;
        contributions[p].epicCrypt.levels[level] = (contributions[p].epicCrypt.levels[level] || 0) + 1;
      } else if (isRare) {
        contributions[p].rareCrypt.total += 1;
        contributions[p].rareCrypt.levels[level] = (contributions[p].rareCrypt.levels[level] || 0) + 1;
      } else if (isCitadel) {
        contributions[p].citadel.total += 1;
        contributions[p].citadel.levels[level] = (contributions[p].citadel.levels[level] || 0) + 1;
      } else if (isCommon) {
        contributions[p].commonCrypt.total += 1;
        contributions[p].commonCrypt.levels[level] = (contributions[p].commonCrypt.levels[level] || 0) + 1;
      } else {
        contributions[p].other.total += 1;
        contributions[p].other.levels[level] = (contributions[p].other.levels[level] || 0) + 1;
      }
    });

    // Populate todayCount and weeklyCount based on mappedRawChests (overall scanning stats)
    mappedRawChests.forEach((chest) => {
      const p = chest.fromPlayer || "Unknown";
      if (!contributions[p]) return;

      const chestDate = new Date(chest.time);
      if (chest.gameDay === todayGameDayStr) {
        contributions[p].todayCount += 1;
      }
      if (chestDate >= oneWeekAgo) {
        contributions[p].weeklyCount += 1;
      }
    });

    // We want to count how many new chests have been scanned by each player in real-time
    const realTimeNewScans: Record<string, number> = {};
    mappedRawChests.forEach((chest) => {
      if (!loadedChestIds.has(chest.id)) {
        const p = chest.fromPlayer || "Unknown";
        realTimeNewScans[p] = (realTimeNewScans[p] || 0) + 1;
      }
    });

    return Object.entries(contributions)
      .map(([player, stats]) => {
        const firstAppearance = firstAppearances[player] || new Date().toISOString();
        const allTimeScans = (totalAllTimeScans[player] || 0) + (realTimeNewScans[player] || 0);
        const daysOnSystem = getDaysOnSystem(firstAppearance, now);

        const ratePerDay = allTimeScans / daysOnSystem;
        const ratePerWeek = ratePerDay * 7;

        return {
          player,
          ...stats,
          ratePerDay,
          ratePerWeek
        };
      });
  }, [chests, mappedRawChests, players, firstAppearances, totalAllTimeScans, loadedChestIds]);

  const handleContributionSort = useCallback((field: ContributionSortField) => {
    if (contributionSortField === field) {
      setContributionSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setContributionSortField(field);
      setContributionSortDirection("desc");
    }
  }, [contributionSortField]);

  const sortedContributionsList = useMemo(() => {
    const query = playerSearchQuery.toLowerCase();
    const getSortValue = (item: PlayerContribution): number => {
      switch (contributionSortField) {
        case "points": return item.points;
        case "total": return item.total;
        case "ratePerDay": return item.ratePerDay;
        case "ratePerWeek": return item.ratePerWeek;
        case "todayCount": return item.todayCount;
        case "weeklyCount": return item.weeklyCount;
      }
    };

    return [...contributionsList]
      .filter((item) => item.player.toLowerCase().includes(query))
      .sort((a, b) => {
        const diff = contributionSortDirection === "desc"
          ? getSortValue(b) - getSortValue(a)
          : getSortValue(a) - getSortValue(b);
        if (diff !== 0) return diff;
        return b.points - a.points || b.total - a.total || a.player.localeCompare(b.player);
      });
  }, [contributionsList, playerSearchQuery, contributionSortField, contributionSortDirection]);

  const weekBuckets = useMemo(() => getLast5WeekBuckets(new Date()), []);

  const weeklyContributionsList = useMemo(() => {
    const now = new Date();
    const initWeeklyStats = () => ({
      weeks: [0, 0, 0, 0, 0] as [number, number, number, number, number],
      weekPoints: [0, 0, 0, 0, 0] as [number, number, number, number, number],
    });
    const data: Record<string, ReturnType<typeof initWeeklyStats>> = {};

    players.forEach((p) => {
      data[p] = initWeeklyStats();
    });

    mappedRawChests
      .filter((chest) => filterSource === "all" || chest.source === filterSource)
      .forEach((chest) => {
        const weekIdx = getWeekIndexForChest(chest.time, now);
        if (weekIdx === null) return;
        const p = chest.fromPlayer || "Unknown";
        if (!data[p]) data[p] = initWeeklyStats();
        data[p].weeks[weekIdx] += 1;
        data[p].weekPoints[weekIdx] += calculateChestPoints(chest.chestName, chest.source);
      });

    return Object.entries(data).map(([player, stats]) => ({
      player,
      weeks: stats.weeks,
      weekPoints: stats.weekPoints,
      total: stats.weeks.reduce((sum, n) => sum + n, 0),
      totalPoints: stats.weekPoints.reduce((sum, n) => sum + n, 0),
    }));
  }, [mappedRawChests, players, filterSource]);

  const handleWeeklySort = useCallback((field: WeeklySortField) => {
    if (weeklySortField === field) {
      setWeeklySortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setWeeklySortField(field);
      setWeeklySortDirection("desc");
    }
  }, [weeklySortField]);

  const getWeeklySortValue = (item: WeeklyPlayerContribution, field: WeeklySortField): number => {
    if (field === "total") return item.total;
    const weekIndex = Number(field.replace("week", ""));
    return item.weeks[weekIndex];
  };

  const sortedWeeklyContributionsList = useMemo(() => {
    const query = playerSearchQuery.toLowerCase();
    return [...weeklyContributionsList]
      .filter((item) => item.player.toLowerCase().includes(query))
      .sort((a, b) => {
        const diff = weeklySortDirection === "desc"
          ? getWeeklySortValue(b, weeklySortField) - getWeeklySortValue(a, weeklySortField)
          : getWeeklySortValue(a, weeklySortField) - getWeeklySortValue(b, weeklySortField);
        if (diff !== 0) return diff;
        return b.total - a.total || a.player.localeCompare(b.player);
      });
  }, [weeklyContributionsList, playerSearchQuery, weeklySortField, weeklySortDirection]);

  const handleExportWeeklyCSV = (list: WeeklyPlayerContribution[]) => {
    const headers = [
      "Rank",
      "Player Name",
      ...weekBuckets.map((w) => `${w.title} (${w.dateRange}) Drops`),
      ...weekBuckets.map((w) => `${w.title} (${w.dateRange}) Wealth`),
      "5-Week Total Drops",
      "5-Week Total Wealth",
    ];
    const rows = list.map((item, idx) => [
      idx + 1,
      `"${item.player.replace(/"/g, '""')}"`,
      ...item.weeks,
      ...item.weekPoints,
      item.total,
      item.totalPoints,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${clanName.toLowerCase()}_weekly_contributions_last_5_weeks.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = (contributionsList: PlayerContribution[]) => {
    const headers = [
      "Rank", "Player Name", "Epic Crypt", "Rare Crypt", "Common Crypt", "Citadel", "Other",
      "Total Drops", "Clan Wealth", "Rate/Day", "Rate/Week", `Daily Target (${dailyTarget}) Status`, `Weekly Target (${weeklyTarget}) Status`
    ];
    const rows = contributionsList.map((item, idx) => {
      const dailyStatus = item.todayCount >= dailyTarget ? "Target Met" : `${item.todayCount}/${dailyTarget}`;
      const weeklyStatus = item.weeklyCount >= weeklyTarget ? "Target Met" : `${item.weeklyCount}/${weeklyTarget}`;
      return [
        idx + 1,
        `"${item.player.replace(/"/g, '""')}"`,
        item.epicCrypt.total,
        item.rareCrypt.total,
        item.commonCrypt.total,
        item.citadel.total,
        item.other.total,
        item.total,
        item.points,
        item.ratePerDay.toFixed(2),
        item.ratePerWeek.toFixed(2),
        `"${dailyStatus}"`,
        `"${weeklyStatus}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${clanName.toLowerCase()}_clan_chest_contributions_${filterDateRange}_${filterSource}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Play subtle synth ping when a chest scans in real-time
  const playClaimSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // high pure A note
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // smooth sweep

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.warn("Audio Context blocked:", error);
    }
  }, []);

  // Setup Server-Sent Events (SSE) Live Feed Subscription
  useEffect(() => {
    const sse = new EventSource("/api/stream");

    sse.onopen = () => {
      setIsConnected(true);
    };

    sse.onerror = () => {
      setIsConnected(false);
      sse.close();
      // Retry connection every 5s
      setTimeout(() => {
        setIsConnected(false);
      }, 5000);
    };

    sse.onmessage = (event) => {
      try {
        const newChest: Chest = JSON.parse(event.data);
        setRawChests((prev) => [newChest, ...prev]);
        playClaimSound();
      } catch (err) {
        console.error("Error parsing Server-Sent Event payload:", err);
      }
    };

    return () => {
      sse.close();
    };
  }, [playClaimSound]);

  // WHITELIST OPERATIONS
  const handleAddPlayer = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let key = deleteSecretKeyInput;
    if (!key) {
      const enteredKey = prompt("Enter administration passcode to whitelist player:");
      if (enteredKey === null) return;
      key = enteredKey;
      setDeleteSecretKeyInput(enteredKey);
    }
    try {
      const res = await fetch("/api/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, secretKey: key }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers((prev) => [...prev, trimmed].sort());
        setNewPlayerName("");
        setFirstAppearances((prev) => {
          if (prev[trimmed]) return prev;
          return { ...prev, [trimmed]: data.createdAt || new Date().toISOString() };
        });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to whitelist player. Please verify the admin secret key.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePlayer = async (name: string) => {
    let key = deleteSecretKeyInput;
    if (!key) {
      const enteredKey = prompt(`Enter administration passcode to delete "${name}" from whitelist:`);
      if (enteredKey === null) return;
      key = enteredKey;
      setDeleteSecretKeyInput(enteredKey);
    }
    try {
      const res = await fetch(`/api/whitelist?name=${encodeURIComponent(name)}&secretKey=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlayers((prev) => prev.filter((p) => p !== name));
        setUnknownPlayers((prev) => {
          if (prev.some((u) => u.ocrName === name)) return prev;
          return [
            ...prev,
            {
              id: `temp-${name}`,
              ocrName: name,
              encountered: new Date().toISOString(),
            },
          ];
        });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove player from whitelist. Please verify the admin secret key.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Moderation: Approve Unknown Player & remove from unknown log
  const handleApproveUnknownPlayer = async (ocrName: string) => {
    let key = deleteSecretKeyInput;
    if (!key) {
      const enteredKey = prompt(`Enter administration passcode to approve and whitelist "${ocrName}":`);
      if (enteredKey === null) return;
      key = enteredKey;
      setDeleteSecretKeyInput(enteredKey);
    }
    try {
      // 1. Add to Whitelist
      const addRes = await fetch("/api/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ocrName, secretKey: key }),
      });

      if (addRes.ok) {
        const data = await addRes.json();
        setPlayers((prev) => [...prev, ocrName].sort());
        setFirstAppearances((prev) => {
          if (prev[ocrName]) return prev;
          return { ...prev, [ocrName]: data.createdAt || new Date().toISOString() };
        });

        // 2. Delete from Unknown logs
        await fetch(`/api/unknown-players?ocrName=${encodeURIComponent(ocrName)}`, {
          method: "DELETE",
        });

        setUnknownPlayers((prev) => prev.filter((u) => u.ocrName !== ocrName));
        setSelectedUnknowns((prev) => prev.filter((name) => name !== ocrName));
      } else {
        const data = await addRes.json();
        alert(data.error || "Failed to approve player. Please verify the admin secret key.");
      }
    } catch (e) {
      console.error("Moderation whitelisting failed:", e);
    }
  };

  // Moderation: Assign Spelling Correction to Unknown Player and clear log
  const handleAssignCorrection = async (ocrName: string, correctTo: string) => {
    const trimmedTo = correctTo.trim();
    if (!trimmedTo) return;
    let key = deleteSecretKeyInput;
    if (!key) {
      const enteredKey = prompt(`Enter administration passcode to map "${ocrName}" → "${trimmedTo}":`);
      if (enteredKey === null) return;
      key = enteredKey;
      setDeleteSecretKeyInput(enteredKey);
    }
    try {
      // 1. Write PlayerFix mapping
      const fixRes = await fetch("/api/player-fixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrName, correctedTo: trimmedTo, secretKey: key }),
      });

      if (fixRes.ok) {
        const newFix: PlayerFix = await fixRes.json();
        setFixes((prev) => [...prev.filter((f) => f.ocrName !== ocrName), newFix]);

        // 2. Delete from Unknown logs
        await fetch(`/api/unknown-players?ocrName=${encodeURIComponent(ocrName)}`, {
          method: "DELETE",
        });

        setUnknownPlayers((prev) => prev.filter((u) => u.ocrName !== ocrName));
        setSelectedUnknowns((prev) => prev.filter((name) => name !== ocrName));
      } else {
        const data = await fixRes.json();
        alert(data.error || "Spelling mapping failed. Please verify the admin secret key.");
      }
    } catch (e) {
      console.error("Spelling mapping failed:", e);
    }
  };

  // Bulk Approve selected unknown players
  const handleBulkApprove = async () => {
    const count = selectedUnknowns.length;
    if (count === 0) return;
    let key = deleteSecretKeyInput;
    if (!key) {
      const enteredKey = prompt(`Enter administration passcode to approve and whitelist ${count} players:`);
      if (enteredKey === null) return;
      key = enteredKey;
      setDeleteSecretKeyInput(enteredKey);
    }
    try {
      // 1. Add to Whitelist in bulk
      const addRes = await fetch("/api/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: selectedUnknowns, secretKey: key }),
      });

      if (addRes.ok) {
        // 2. Delete from Unknown logs in bulk
        const namesQuery = selectedUnknowns.map((name) => encodeURIComponent(name)).join(",");
        await fetch(`/api/unknown-players?ocrNames=${namesQuery}`, {
          method: "DELETE",
        });

        setPlayers((prev) => [...prev, ...selectedUnknowns].sort());
        setFirstAppearances((prev) => {
          const updated = { ...prev };
          const nowStr = new Date().toISOString();
          selectedUnknowns.forEach((name) => {
            if (!updated[name]) {
              updated[name] = nowStr;
            }
          });
          return updated;
        });
        setUnknownPlayers((prev) => prev.filter((u) => !selectedUnknowns.includes(u.ocrName)));
        setSelectedUnknowns([]);
      } else {
        const data = await addRes.json();
        alert(data.error || "Approval failed. Please verify the admin secret key.");
      }
    } catch (e) {
      console.error("Bulk moderation whitelisting failed:", e);
    }
  };

  // Bulk Assign Spelling Correction
  const handleBulkAssign = async () => {
    const count = selectedUnknowns.length;
    if (count === 0 || !bulkCorrectionTarget) return;
    let key = deleteSecretKeyInput;
    if (!key) {
      const enteredKey = prompt(`Enter administration passcode to map ${count} player(s) to "${bulkCorrectionTarget.trim()}":`);
      if (enteredKey === null) return;
      key = enteredKey;
      setDeleteSecretKeyInput(enteredKey);
    }
    try {
      const target = bulkCorrectionTarget.trim();

      // 1. Write PlayerFix mappings in bulk
      const fixRes = await fetch("/api/player-fixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrNames: selectedUnknowns, correctedTo: target, secretKey: key }),
      });

      if (fixRes.ok) {
        // 2. Delete from Unknown logs in bulk
        const namesQuery = selectedUnknowns.map((name) => encodeURIComponent(name)).join(",");
        await fetch(`/api/unknown-players?ocrNames=${namesQuery}`, {
          method: "DELETE",
        });

        // Update local React states
        setFixes((prev) => {
          const timestamp = new Date().toISOString();
          const newMappings = selectedUnknowns.map((name) => ({
            id: `temp-${name}`,
            ocrName: name,
            correctedTo: target,
            createdAt: timestamp,
          }));

          let current = [...prev];
          newMappings.forEach((newFix) => {
            current = [...current.filter((f) => f.ocrName !== newFix.ocrName), newFix];
          });
          return current.sort((a, b) => a.ocrName.localeCompare(b.ocrName));
        });

        setUnknownPlayers((prev) => prev.filter((u) => !selectedUnknowns.includes(u.ocrName)));
        setSelectedUnknowns([]);
        setBulkCorrectionTarget("");
      } else {
        const data = await fixRes.json();
        alert(data.error || "Spelling mapping failed. Please verify the admin secret key.");
      }
    } catch (e) {
      console.error("Bulk spelling mapping failed:", e);
    }
  };

  // NAME CORRECTION OPERATIONS
  const handleAddFix = async () => {
    const errorName = ocrErrorInput.trim();
    const correctTo = ocrCorrectToInput.trim();
    if (!errorName || !correctTo) return;
    try {
      const res = await fetch("/api/player-fixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrName: errorName, correctedTo: correctTo }),
      });
      if (res.ok) {
        const newFix = await res.json();
        setFixes((prev) => [...prev.filter((f) => f.ocrName !== errorName), newFix].sort((a, b) => a.ocrName.localeCompare(b.ocrName)));
        setOcrErrorInput("");
        setOcrCorrectToInput("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFix = async (ocrName: string) => {
    try {
      const res = await fetch(`/api/player-fixes?ocrName=${encodeURIComponent(ocrName)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFixes((prev) => prev.filter((f) => f.ocrName !== ocrName));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmDeleteContributions = async (player: string) => {
    setIsDeleting(true);
    setDeleteErrorMessage("");
    try {
      const res = await fetch(`/api/chests?player=${encodeURIComponent(player)}&secretKey=${encodeURIComponent(deleteSecretKeyInput)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Refresh chests & metadata
        await fetchChests(filterDateRange);
        await fetchInitialMetadata();

        // Reset state & close modals
        setShowDeleteConfirm(null);
        setSelectedPlayerDetail(null);
        setDeleteSecretKeyInput("");
      } else {
        const data = await res.json();
        setDeleteErrorMessage(data.error || "Failed to delete contributions.");
      }
    } catch (err) {
      console.error(err);
      setDeleteErrorMessage("Network error: failed to delete contributions.");
    } finally {
      setIsDeleting(false);
    }
  };

  // CHEST COLOR AND STYLE MAPPING
  const getChestColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("legendary") || n.includes("golden") || n.includes("gold")) {
      return { type: "legendary", bg: "rgba(223, 178, 57, 0.06)", border: "rgba(223, 178, 57, 0.3)", text: "#dfb239", textGlow: "text-gold-bright" };
    }
    if (n.includes("epic") || n.includes("dragon")) {
      return { type: "epic", bg: "rgba(147, 51, 234, 0.05)", border: "rgba(147, 51, 234, 0.25)", text: "#c084fc", textGlow: "text-purple-400" };
    }
    if (n.includes("rare") || n.includes("crypt") || n.includes("captain")) {
      return { type: "rare", bg: "rgba(59, 130, 246, 0.05)", border: "rgba(59, 130, 246, 0.25)", text: "#60a5fa", textGlow: "text-blue-400" };
    }
    if (n.includes("heroic") || n.includes("clan")) {
      return { type: "heroic", bg: "rgba(6, 182, 212, 0.05)", border: "rgba(6, 182, 212, 0.25)", text: "#22d3ee", textGlow: "text-cyan-400" };
    }
    return { type: "common", bg: "rgba(34, 197, 94, 0.04)", border: "rgba(34, 197, 94, 0.15)", text: "#4ade80", textGlow: "text-green-400" };
  };

  // STATISTICS CALCULATIONS
  const totalChests = chests.length;

  // Calculate active scanners (distinct players in scanned list)
  const activeScanners = useMemo(() => {
    return Array.from(new Set(chests.map((c) => c.fromPlayer))).length;
  }, [chests]);

  const dailyAverage = useMemo(() => {
    if (chests.length === 0) return 0;
    const dates = chests.map((c) => c.gameDay);
    const uniqueDays = Array.from(new Set(dates)).length || 1;
    return Math.round(chests.length / uniqueDays);
  }, [chests]);

  // Today's total chests (based on mappedRawChests so it always reflects "today" regardless of the active date filter)
  const todayTotal = useMemo(() => {
    const todayGameDayStr = getUTC10GameDayStr(new Date());
    return mappedRawChests.filter((c) => c.gameDay === todayGameDayStr).length;
  }, [mappedRawChests]);

  // Total Clan Wealth points across all chests in mappedRawChests
  const totalWealth = useMemo(() => {
    return mappedRawChests.reduce((sum, chest) => sum + calculateChestPoints(chest.chestName, chest.source), 0);
  }, [mappedRawChests]);

  // Today's Clan Wealth points across chests scanned today
  const todayWealth = useMemo(() => {
    const todayGameDayStr = getUTC10GameDayStr(new Date());
    return mappedRawChests
      .filter((c) => c.gameDay === todayGameDayStr)
      .reduce((sum, chest) => sum + calculateChestPoints(chest.chestName, chest.source), 0);
  }, [mappedRawChests]);

  // Whitelist filtering
  const filteredPlayers = players.filter((p) =>
    p.toLowerCase().includes(playerSearchQuery.toLowerCase())
  );

  // Custom Chart: Chest Rarity Share
  const rarityStats = useMemo(() => {
    let legendary = 0, epic = 0, rare = 0, heroic = 0, common = 0;
    chests.forEach((c) => {
      const colorStyle = getChestColor(c.chestName);
      if (colorStyle.type === "legendary") legendary++;
      else if (colorStyle.type === "epic") epic++;
      else if (colorStyle.type === "rare") rare++;
      else if (colorStyle.type === "heroic") heroic++;
      else common++;
    });
    return { legendary, epic, rare, heroic, common };
  }, [chests]);

  return (
    <main className="min-h-screen bg-[#05060b] text-[#f2f5fa] font-sans antialiased p-2.5 sm:p-4 md:p-8 relative">
      {/* Shared SVG Gradients Defs for Performance */}
      <svg style={{ display: 'none' }}>
        <defs>
          <radialGradient id="legendaryGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="50%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id="goldLidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="40%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <radialGradient id="epicGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d28d9" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          <linearGradient id="purpleLidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <radialGradient id="rareGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="blueLidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <radialGradient id="cyanGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0891b2" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
          <linearGradient id="cyanLidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#92400e" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id="woodLidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>
      </svg>
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[150px] -z-10 pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* TOP HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 glass-panel-glow p-4 sm:p-6 rounded-xl sm:rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-2.5 rounded-xl shadow-lg shadow-amber-500/10">
            <Flame className="w-6 h-6 text-[#030307] stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gold font-cinzel uppercase tracking-wider">{t('title', { clanName })}</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide">{t('subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* WhatsApp Invite link */}
          {/* <a
            href="https://chat.whatsapp.com/D7E8YCtYPOjB2j1vN4ZVDN"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-md shadow-emerald-500/5 transition-all text-xs"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Group</span>
          </a> */}

          {/* Discord Invite link */}
          {/* <a
            href="https://discord.gg/7994zN5X"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 shadow-md shadow-indigo-500/5 transition-all text-xs"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discord</span>
          </a> */}

          {/* Audio toggle button */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${soundEnabled
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-md shadow-amber-500/5 hover:bg-amber-500/20"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-800"
              }`}
          >
            {t('sound', { status: soundEnabled ? t('soundOn') : t('soundOff') })}
          </button>

          {/* Connection badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isConnected
            ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-400"
            : "bg-rose-500/10 border-rose-500/35 text-rose-400"
            }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 animate-pulse" />
                <span className="font-semibold tracking-wide text-xs">{t('radarLive')}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="font-semibold tracking-wide text-xs">{t('offline')}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* CORE STATISTICS CARDS */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4 mb-6 md:mb-8">
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">{t('totalChestsLogged')}</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-slate-100">{totalChests}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{t('scanned')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Database className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>{t('cockroachActive')}</span>
          </div>
        </div>

        {/* CLAN WEALTH CARD */}
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">{t('totalClanWealth')}</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-amber-400">{totalWealth.toLocaleString()}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{t('points')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Gem className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>{t('accumulatedWealth')}</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">{t('activeScanners')}</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-slate-100">{activeScanners}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{t('players')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>{t('outOf', { count: players.length })}</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">{t('dailyScanRate')}</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-slate-100">{dailyAverage}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{t('chestsPerDay')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>{t('computedDynamically')}</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">{t('moderationAlerts')}</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className={`text-lg sm:text-2xl md:text-3xl font-black ${unknownPlayers.length > 0 ? "text-rose-500" : "text-emerald-400"}`} style={{ color: unknownPlayers.length > 0 ? "rgb(248, 113, 113)" : "rgb(52, 211, 153)" }}>
              {unknownPlayers.length}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400">{t('pending')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <ShieldAlert className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${unknownPlayers.length > 0 ? "text-rose-500" : "text-emerald-400"}`} />
            <span>{t('unknownNamesFlagged')}</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">{t('todaysChests')}</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-amber-400">{todayTotal}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{t('total')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>{t('utcGameDay')}</span>
          </div>
        </div>

        {/* TODAY'S WEALTH CARD */}
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">{t('todaysWealth')}</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-amber-400">{todayWealth.toLocaleString()}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{t('points')}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>{t('todaysActiveWealth')}</span>
          </div>
        </div>
      </section>

      {/* CORE NAVIGATION TABS */}
      <div className="flex border-b border-slate-800/80 mb-5 gap-1 overflow-x-auto scrollbar-none snap-x -mx-4 px-4 md:mx-0 md:px-0 whitespace-nowrap">
        <button
          onClick={() => setActiveTab("live")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start flex items-center gap-1.5 ${activeTab === "live"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <Activity className="w-3.5 h-3.5" />
          {t('tabLive')}
        </button>
        <button
          onClick={() => setActiveTab("contributions")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start flex items-center gap-1.5 ${activeTab === "contributions"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          {t('tabContributions')}
        </button>
        <button
          onClick={() => setActiveTab("weekly")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start flex items-center gap-1.5 ${activeTab === "weekly"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {t('tabWeekly')}
        </button>
        <button
          onClick={() => setActiveTab("whitelist")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start flex items-center gap-1.5 ${activeTab === "whitelist"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <Users className="w-3.5 h-3.5" />
          {t('tabWhitelist')}
          {unknownPlayers.length > 0 && (
            <span className="bg-rose-500 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse flex-shrink-0">
              {unknownPlayers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("corrections")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start flex items-center gap-1.5 ${activeTab === "corrections"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <ScanText className="w-3.5 h-3.5" />
          {t('tabCorrections')}
        </button>
        <button
          onClick={() => setActiveTab("trends")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start flex items-center gap-1.5 ${activeTab === "trends"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
          {t('tabTrends')}
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start flex items-center gap-1.5 ${activeTab === "search"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          <Search className="w-3.5 h-3.5 text-amber-500" />
          Search
        </button>
      </div>

      {/* SECTION CONTENTS */}

      {/* 1. TAB: LIVE SCANNER FEED */}
      {activeTab === "live" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Main Feed Grid */}
          <div className="lg:col-span-2 flex flex-col h-[500px] sm:h-[650px] glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3.5 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                <span className="text-sm font-bold tracking-wide text-slate-200">{t('realTimeIngestion')}</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">{t('showingLatestScans')}</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
              {chests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Database className="w-12 h-12 stroke-[1.5] text-slate-600/70" />
                  <p className="text-sm font-medium">{t('noChestsYet')}</p>
                  <p className="text-xs text-slate-600">{t('startScanner')}</p>
                </div>
              ) : (
                chests.slice(0, 100).map((chest, index) => {
                  const style = getChestColor(chest.chestName);
                  let borderGlow = "border-slate-800/40";
                  if (style.type === "legendary") borderGlow = "gold-glow-border";
                  else if (style.type === "epic") borderGlow = "purple-glow-border";
                  else if (style.type === "rare") borderGlow = "blue-glow-border";
                  return (
                    <div
                      key={chest.id}
                      style={{
                        backgroundColor: style.bg,
                      }}
                      className={`border ${borderGlow} p-3.5 sm:p-4 rounded-xl relative transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-between gap-4 ${index === 0 ? "animate-scan-card" : ""
                        }`}
                    >
                      {/* Left Block: Icon + Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0">
                          <ChestIcon type={style.type} className="w-11 h-11" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm sm:text-base font-bold tracking-tight font-cinzel ${style.textGlow} truncate`}>
                              {chest.chestName}
                            </span>
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.25 rounded bg-slate-950/60 border border-slate-850 text-slate-400">
                              {chest.source}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[11px] text-slate-400 mt-1">
                            <div>
                              <span>{t('claimedBy')}</span>
                              <span className="font-bold text-slate-200 ml-1">{chest.fromPlayer}</span>
                            </div>
                            <span className="hidden sm:inline text-slate-700">•</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Block */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-1 text-right text-[11px]">
                        <div className="text-slate-350 font-mono font-medium">
                          {formatUTC10Time(chest.time)}
                        </div>
                        <div className="text-[10px] text-slate-550 font-mono">
                          {chest.gameDay}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Metrics Panel */}
          <div className="flex flex-col gap-5 lg:gap-6">
            {/* Visual SVG Distribution Charts */}
            <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5">
              <h2 className="text-sm font-bold tracking-wider text-slate-300 mb-3.5 sm:mb-4 uppercase font-cinzel text-gold">{t('chestQualityShare')}</h2>

              {chests.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                  {t('waitingForRecords')}
                </div>
              ) : (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3.5">
                  <CircularProgress
                    percent={Math.round((rarityStats.legendary / chests.length) * 100) || 0}
                    color="#dfb239"
                    label="Legendary"
                    count={rarityStats.legendary}
                  />
                  <CircularProgress
                    percent={Math.round((rarityStats.epic / chests.length) * 100) || 0}
                    color="#c084fc"
                    label="Epic"
                    count={rarityStats.epic}
                  />
                  <CircularProgress
                    percent={Math.round((rarityStats.rare / chests.length) * 100) || 0}
                    color="#60a5fa"
                    label="Rare"
                    count={rarityStats.rare}
                  />
                  <CircularProgress
                    percent={Math.round((rarityStats.heroic / chests.length) * 100) || 0}
                    color="#22d3ee"
                    label="Heroic"
                    count={rarityStats.heroic}
                  />
                  <CircularProgress
                    percent={Math.round((rarityStats.common / chests.length) * 100) || 0}
                    color="#4ade80"
                    label="Common"
                    count={rarityStats.common}
                  />
                </div>
              )}
            </div>

            {/* Top Contributor list */}
            <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 overflow-hidden flex flex-col">
              <h2 className="text-sm font-bold tracking-wider text-slate-300 mb-3 uppercase">{t('topActiveScanners')}</h2>
              <div className="overflow-y-auto pr-1 flex flex-col gap-2.5 text-xs">
                {chests.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    {t('noScannerMetrics')}
                  </div>
                ) : (
                  Object.entries(
                    chests.reduce((acc: Record<string, number>, c) => {
                      acc[c.fromPlayer] = (acc[c.fromPlayer] || 0) + 1;
                      return acc;
                    }, {})
                  )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([name, count], rank) => (
                      <div key={name} className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold font-mono text-[10px] ${rank === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            rank === 1 ? "bg-slate-400/20 text-slate-300 border border-slate-400/30" :
                              rank === 2 ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
                                "bg-slate-950 text-slate-400 border border-slate-850"
                            }`}>
                            {rank + 1}
                          </span>
                          <span className="font-semibold text-slate-200">{name}</span>
                        </div>
                        <span className="font-mono font-bold text-amber-500">{count} {t('dropsUnit')}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TAB: CHEST SEARCH */}
      {activeTab === "search" && (() => {
        const filteredChests = chests.filter(c => {
          const matchChest = chestSearchQuery.length === 0 || chestSearchQuery.includes(c.chestName);
          const matchPlayer = chestSearchPlayerQuery.length === 0 || chestSearchPlayerQuery.includes(c.fromPlayer);
          const matchDate = chestSearchDateQuery.length === 0 || chestSearchDateQuery.includes(c.gameDay);
          const matchSource = chestSearchSourceQuery.length === 0 || (c.source && chestSearchSourceQuery.includes(c.source));
          return matchChest && matchPlayer && matchDate && matchSource;
        });

        // Group by player to see top contributors for this chest
        const playerCounts = filteredChests.reduce((acc: Record<string, number>, c) => {
          acc[c.fromPlayer] = (acc[c.fromPlayer] || 0) + 1;
          return acc;
        }, {});

        const topPlayers = Object.entries(playerCounts)
          .sort((a, b) => b[1] - a[1]);

        const hasActiveSearch =
          chestSearchQuery.length > 0 ||
          chestSearchPlayerQuery.length > 0 ||
          chestSearchDateQuery.length > 0 ||
          chestSearchSourceQuery.length > 0;

        const contributorsInResults = new Set(Object.keys(playerCounts));
        const missingWhitelistPlayers = sortedWhitelistNames.filter(
          (name) => !contributorsInResults.has(name)
        );

        // Unique options for selects
        const uniqueChests = Array.from(new Set(chests.map(c => c.chestName))).sort();
        const uniquePlayers = Array.from(new Set(chests.map(c => c.fromPlayer))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const uniqueDates = Array.from(new Set(chests.map(c => c.gameDay))).sort((a, b) => b.localeCompare(a)); // Sort descending
        const uniqueSources = Array.from(new Set(chests.map(c => c.source).filter(Boolean) as string[])).sort();

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
            {/* Main Feed Grid */}
            <div className="lg:col-span-2 flex flex-col h-[500px] sm:h-[650px] glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 overflow-hidden">
              <div className="flex flex-col mb-4 gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold tracking-wide text-slate-200">Search Chests</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Find specific chest drops</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <MultiSelectDropdown
                    options={uniqueChests.map(name => ({ label: name, value: name }))}
                    selected={chestSearchQuery}
                    onChange={setChestSearchQuery}
                    placeholder="Chests"
                  />
                  <MultiSelectDropdown
                    options={uniquePlayers.map(player => ({ label: player, value: player }))}
                    selected={chestSearchPlayerQuery}
                    onChange={setChestSearchPlayerQuery}
                    placeholder="Players"
                  />
                  <MultiSelectDropdown
                    options={uniqueDates.map(date => ({ label: date.replace("chests_", ""), value: date }))}
                    selected={chestSearchDateQuery}
                    onChange={setChestSearchDateQuery}
                    placeholder="Dates"
                  />
                  <MultiSelectDropdown
                    options={uniqueSources.map(source => ({ label: source, value: source }))}
                    selected={chestSearchSourceQuery}
                    onChange={setChestSearchSourceQuery}
                    placeholder="Sources"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
                {chestSearchQuery.length === 0 && chestSearchPlayerQuery.length === 0 && chestSearchDateQuery.length === 0 && chestSearchSourceQuery.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Search className="w-12 h-12 stroke-[1.5] text-slate-600/70" />
                    <p className="text-sm font-medium">Select a chest, player, date, or source to view drops</p>
                  </div>
                ) : filteredChests.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Database className="w-12 h-12 stroke-[1.5] text-slate-600/70" />
                    <p className="text-sm font-medium">No chests found matching your search</p>
                  </div>
                ) : (
                  filteredChests.slice(0, 100).map((chest, index) => {
                    const style = getChestColor(chest.chestName);
                    let borderGlow = "border-slate-800/40";
                    if (style.type === "legendary") borderGlow = "gold-glow-border";
                    else if (style.type === "epic") borderGlow = "purple-glow-border";
                    else if (style.type === "rare") borderGlow = "blue-glow-border";
                    return (
                      <div
                        key={chest.id}
                        style={{
                          backgroundColor: style.bg,
                        }}
                        className={`border ${borderGlow} p-3.5 sm:p-4 rounded-xl relative transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-between gap-4`}
                      >
                        {/* Left Block: Icon + Details */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0">
                            <ChestIcon type={style.type} className="w-11 h-11" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm sm:text-base font-bold tracking-tight font-cinzel ${style.textGlow} truncate`}>
                                {chest.chestName}
                              </span>
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.25 rounded bg-slate-950/60 border border-slate-850 text-slate-400">
                                {chest.source}
                              </span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[11px] text-slate-400 mt-1">
                              <div>
                                <span>{t('claimedBy')}</span>
                                <span className="font-bold text-slate-200 ml-1">{chest.fromPlayer}</span>
                              </div>
                              <span className="hidden sm:inline text-slate-700">•</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Block */}
                        <div className="flex-shrink-0 flex flex-col items-end gap-1 text-right text-[11px]">
                          <div className="text-slate-350 font-mono font-medium">
                            {formatUTC10Time(chest.time)}
                          </div>
                          <div className="text-[10px] text-slate-550 font-mono">
                            {chest.gameDay}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Metrics Panel */}
            <div className="flex flex-col gap-5 lg:gap-6 h-[500px] sm:h-[650px]">
              <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex gap-4 shrink-0 divide-x divide-slate-800">
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">TOTAL FOUND</span>
                  <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                    <span className="text-lg sm:text-2xl md:text-3xl font-black text-slate-100">{filteredChests.length}</span>
                    <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">chests</span>
                  </div>
                </div>
                <div className="flex flex-col flex-1 pl-4">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">CONTRIBUTORS</span>
                  <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                    <span className="text-lg sm:text-2xl md:text-3xl font-black text-slate-100">{topPlayers.length}</span>
                    <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">players</span>
                  </div>
                </div>
              </div>

              {/* Top Contributor list */}
              <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 overflow-hidden flex flex-col flex-1 min-h-0">
                <h2 className="text-sm font-bold tracking-wider text-slate-300 mb-3 uppercase">Top Contributors</h2>
                <div className="overflow-y-auto pr-1 flex flex-col gap-2.5 text-xs flex-1 min-h-0">
                  {topPlayers.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 py-10">
                      No data available
                    </div>
                  ) : (
                    topPlayers.map(([name, count], rank) => (
                      <div key={name} className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold font-mono text-[10px] ${rank === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            rank === 1 ? "bg-slate-400/20 text-slate-300 border border-slate-400/30" :
                              rank === 2 ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
                                "bg-slate-950 text-slate-400 border border-slate-850"
                            }`}>
                            {rank + 1}
                          </span>
                          <span className="font-semibold text-slate-200">{name}</span>
                        </div>
                        <span className="font-mono font-bold text-amber-500">{count} drops</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Whitelisted players absent from search results */}
              {hasActiveSearch && (
                <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 overflow-hidden flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold tracking-wider text-slate-300 uppercase">Missing from Results</h2>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      {missingWhitelistPlayers.length} whitelisted
                    </span>
                  </div>
                  <div className="overflow-y-auto pr-1 flex flex-col gap-2 text-xs flex-1 min-h-0">
                    {missingWhitelistPlayers.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-500 py-6 text-center">
                        All whitelisted members appear in these results
                      </div>
                    ) : (
                      missingWhitelistPlayers.map((name) => (
                        <div key={name} className="flex items-center gap-2.5 border-b border-slate-800/40 pb-2">
                          <span className="w-5 h-5 rounded-md flex items-center justify-center bg-slate-950 text-slate-500 border border-slate-850">
                            <Users className="w-3 h-3" />
                          </span>
                          <span className="font-semibold text-slate-400">{name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 4. TAB: PLAYER CONTRIBUTIONS LEADERBOARD */}
      {activeTab === "contributions" && (() => {
        const topByPoints = [...contributionsList].sort((a, b) => b.points - a.points || b.total - a.total)[0];
        const topContributor = topByPoints?.player || "None";
        const topContributorPoints = topByPoints?.points || 0;
        const totalScanChests = chests.length;
        const averageChestsPerPlayer = players.length > 0 ? (totalScanChests / players.length).toFixed(1) : "0.0";

        return (
          <div className="flex flex-col gap-5 lg:gap-6">
            {/* Highlights Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">{t('topProducer')}</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-lg md:text-2xl font-black text-gold truncate max-w-[140px] sm:max-w-[200px]">{topContributor}</span>
                  <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{topContributorPoints.toLocaleString()} {t('wealthUnit', { points: '' }).replace(' ', '')}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>{t('leadsBoard', { clanName })}</span>
                </div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">{t('avgContribution')}</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-2xl md:text-3xl font-black text-slate-100">{averageChestsPerPlayer}</span>
                  <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{t('chestsPerMember')}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>{t('calculatedAcrossRoster')}</span>
                </div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">{t('activeContributionRate')}</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-2xl md:text-3xl font-black text-slate-100">
                    {contributionsList.filter(c => c.total > 0).length}
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-400">/ {players.length} {t('activeOf', { count: '' }).replace('/ ', '').replace('  ', '').trim()}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>{t('atLeastOneDrop')}</span>
                </div>
              </div>
            </div>

            {/* Leaderboard Grid */}
            <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col min-h-[450px]">
              <div className="flex flex-col gap-1.5 mb-3.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-200 uppercase tracking-wide">{t('leaderboardTitle', { clanName })}</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">{t('leaderboardSubtitle')}</p>
              </div>

              <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-between mb-4 sm:mb-5 bg-slate-950/40 p-3 sm:p-4 border border-slate-900 rounded-xl sm:rounded-2xl">
                {/* Left side filters */}
                <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center text-[11px] sm:text-xs">
                  {/* Source filter */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-400 font-semibold">Source:</span>
                    <select
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-350 focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="all">All Sources</option>
                      <option value="Crypt">Crypts</option>
                      <option value="Monster">Monsters</option>
                      <option value="PvP">PvP</option>
                      <option value="Arena">Arena</option>
                      <option value="Tower">Tower</option>
                      <option value="Clan">Clan</option>
                      <option value="Chest">Chest</option>
                    </select>
                  </div>

                  {/* Date range filter */}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-400 font-semibold">{t('dateRangeLabel')}</span>
                    <select
                      value={filterDateRange}
                      onChange={(e) => setFilterDateRange(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-350 focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="all">{t('last5Weeks')}</option>
                      <option value="today">{t('todayUtc')}</option>
                      <option value="week">{t('past7Days')}</option>
                      <option value="month">{t('past30Days')}</option>
                    </select>
                  </div>

                  {/* Daily target input */}
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-400 font-semibold">{t('dailyTargetLabel')}</span>
                    <input
                      type="number"
                      value={dailyTarget || ""}
                      onChange={(e) => setDailyTarget(Math.max(1, parseInt(e.target.value) || 1))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-350 focus:outline-none focus:border-amber-500/50 w-12 text-center font-bold"
                    />
                  </div>

                  {/* Weekly target input */}
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-400 font-semibold">{t('weeklyTargetLabel')}</span>
                    <input
                      type="number"
                      value={weeklyTarget || ""}
                      onChange={(e) => setWeeklyTarget(Math.max(1, parseInt(e.target.value) || 1))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-350 focus:outline-none focus:border-amber-500/50 w-16 text-center font-bold"
                    />
                  </div>
                </div>

                {/* Right side search + download */}
                <div className="flex gap-2 items-center w-full md:w-auto mt-2.5 md:mt-0">
                  <div className="flex items-center gap-1.5 md:hidden w-full">
                    <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <select
                      value={`${contributionSortField}-${contributionSortDirection}`}
                      onChange={(e) => {
                        const [field, direction] = e.target.value.split("-") as [ContributionSortField, SortDirection];
                        setContributionSortField(field);
                        setContributionSortDirection(direction);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-350 focus:outline-none focus:border-amber-500/50 text-xs w-full"
                    >
                      <option value="points-desc">Clan Wealth (High → Low)</option>
                      <option value="points-asc">Clan Wealth (Low → High)</option>
                      <option value="total-desc">Total Drops (High → Low)</option>
                      <option value="total-asc">Total Drops (Low → High)</option>
                      <option value="ratePerDay-desc">Rate/Day (High → Low)</option>
                      <option value="ratePerDay-asc">Rate/Day (Low → High)</option>
                      <option value="ratePerWeek-desc">Rate/Week (High → Low)</option>
                      <option value="ratePerWeek-asc">Rate/Week (Low → High)</option>
                      <option value="todayCount-desc">Daily Target (High → Low)</option>
                      <option value="todayCount-asc">Daily Target (Low → High)</option>
                      <option value="weeklyCount-desc">Weekly Target (High → Low)</option>
                      <option value="weeklyCount-asc">Weekly Target (Low → High)</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleExportCSV(sortedContributionsList)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 hover:border-emerald-500/50 text-emerald-400 font-bold rounded-xl text-xs transition-all w-full md:w-auto justify-center"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>

                  <div className="relative w-full md:w-auto">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search player..."
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-full md:w-56"
                    />
                  </div>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider font-cinzel">
                      <th className="py-3 px-4 w-16 text-slate-450">{t('rankCol')}</th>
                      <th className="py-3 px-4 text-slate-455">{t('playerNameCol')}</th>
                      <th className="py-3 px-4 text-center text-slate-455">{t('epicCryptCol')}</th>
                      <th className="py-3 px-4 text-center text-slate-455">{t('rareCryptCol')}</th>
                      <th className="py-3 px-4 text-center text-slate-455">{t('commonCryptCol')}</th>
                      <th className="py-3 px-4 text-center text-slate-455">{t('citadelCol')}</th>
                      <th className="py-3 px-4 text-center text-slate-455">{t('otherCol')}</th>
                      <SortableTh field="points" activeField={contributionSortField} direction={contributionSortDirection} onSort={handleContributionSort} className="py-3 px-4 text-center font-bold text-amber-500 text-slate-455">
                        {t('clanWealthCol')}
                      </SortableTh>
                      <SortableTh field="total" activeField={contributionSortField} direction={contributionSortDirection} onSort={handleContributionSort} className="py-3 px-4 text-center font-bold text-gold text-slate-455">
                        {t('totalDropsCol')}
                      </SortableTh>
                      <SortableTh field="ratePerDay" activeField={contributionSortField} direction={contributionSortDirection} onSort={handleContributionSort} className="py-3 px-4 text-center text-slate-455">
                        {t('ratePerDayCol')}
                      </SortableTh>
                      <SortableTh field="ratePerWeek" activeField={contributionSortField} direction={contributionSortDirection} onSort={handleContributionSort} className="py-3 px-4 text-center text-slate-455">
                        {t('ratePerWeekCol')}
                      </SortableTh>
                      <SortableTh field="todayCount" activeField={contributionSortField} direction={contributionSortDirection} onSort={handleContributionSort} className="py-3 px-4 text-center text-slate-455 w-32">
                        {t('dailyTargetCol', { target: dailyTarget })}
                      </SortableTh>
                      <SortableTh field="weeklyCount" activeField={contributionSortField} direction={contributionSortDirection} onSort={handleContributionSort} className="py-3 px-4 text-center text-slate-455 w-32">
                        {t('weeklyTargetCol', { target: weeklyTarget })}
                      </SortableTh>
                      <th className="py-3 px-4 w-40 text-slate-455">{t('statusLevelCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedContributionsList.map((item, idx) => {
                      let statusText = t('statusRecruit');
                      let statusColor = "text-slate-500 bg-slate-500/5 border-slate-500/10";
                      if (item.total >= 30) {
                        statusText = t('statusEliteRaider');
                        statusColor = "text-amber-400 bg-amber-400/5 border-amber-400/10 shadow-sm shadow-amber-400/5";
                      } else if (item.total >= 15) {
                        statusText = t('statusHeavyRaider');
                        statusColor = "text-purple-400 bg-purple-400/5 border-purple-400/10";
                      } else if (item.total >= 5) {
                        statusText = t('statusActiveMember');
                        statusColor = "text-emerald-400 bg-emerald-400/5 border-emerald-400/10";
                      } else if (item.total > 0) {
                        statusText = t('statusContributor');
                        statusColor = "text-sky-400 bg-sky-400/5 border-sky-400/10";
                      }

                      return (
                        <tr
                          key={item.player}
                          className="border-b border-slate-800/40 hover:bg-slate-900/20 transition-all"
                        >
                          <td className="py-3 px-4">
                            {idx === 0 ? (
                              <span className="text-lg">🥇</span>
                            ) : idx === 1 ? (
                              <span className="text-lg">🥈</span>
                            ) : idx === 2 ? (
                              <span className="text-lg">🥉</span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center font-bold text-slate-400 font-mono text-[9px]">
                                #{idx + 1}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-200">
                            <button
                              onClick={() => setSelectedPlayerDetail(item.player)}
                              className="hover:text-gold hover:underline transition-all text-left font-bold"
                            >
                              {item.player}
                            </button>
                          </td>
                          <td className="relative group py-3 px-4 text-center font-mono font-bold text-purple-400">
                            {item.epicCrypt.total > 0 ? (
                              <>
                                <span className="cursor-help border-b border-purple-500/25 hover:border-purple-400 transition-all">
                                  {item.epicCrypt.total}×
                                </span>
                                <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#0a0c16]/95 border border-slate-800 text-[10px] text-slate-200 px-2.5 py-1.5 rounded-xl shadow-xl backdrop-blur-md pointer-events-none">
                                  <div className="flex flex-col gap-0.5 font-sans font-normal text-left min-w-[70px]">
                                    <span className="font-bold text-[9px] text-purple-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">{t('epicLevels')}</span>
                                    {Object.entries(item.epicCrypt.levels)
                                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                                      .map(([lvl, count]) => (
                                        <span key={lvl} className="font-mono">Lvl {lvl}: <strong className="text-purple-300">{count}</strong></span>
                                      ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-700">-</span>
                            )}
                          </td>
                          <td className="relative group py-3 px-4 text-center font-mono font-bold text-sky-400">
                            {item.rareCrypt.total > 0 ? (
                              <>
                                <span className="cursor-help border-b border-sky-500/25 hover:border-sky-400 transition-all">
                                  {item.rareCrypt.total}×
                                </span>
                                <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#0a0c16]/95 border border-slate-800 text-[10px] text-slate-200 px-2.5 py-1.5 rounded-xl shadow-xl backdrop-blur-md pointer-events-none">
                                  <div className="flex flex-col gap-0.5 font-sans font-normal text-left min-w-[70px]">
                                    <span className="font-bold text-[9px] text-sky-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">{t('rareLevels')}</span>
                                    {Object.entries(item.rareCrypt.levels)
                                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                                      .map(([lvl, count]) => (
                                        <span key={lvl} className="font-mono">Lvl {lvl}: <strong className="text-sky-300">{count}</strong></span>
                                      ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-700">-</span>
                            )}
                          </td>
                          <td className="relative group py-3 px-4 text-center font-mono font-bold text-emerald-400">
                            {item.commonCrypt.total > 0 ? (
                              <>
                                <span className="cursor-help border-b border-emerald-500/25 hover:border-emerald-400 transition-all">
                                  {item.commonCrypt.total}×
                                </span>
                                <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#0a0c16]/95 border border-slate-800 text-[10px] text-slate-200 px-2.5 py-1.5 rounded-xl shadow-xl backdrop-blur-md pointer-events-none">
                                  <div className="flex flex-col gap-0.5 font-sans font-normal text-left min-w-[70px]">
                                    <span className="font-bold text-[9px] text-emerald-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">{t('commonLevels')}</span>
                                    {Object.entries(item.commonCrypt.levels)
                                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                                      .map(([lvl, count]) => (
                                        <span key={lvl} className="font-mono">Lvl {lvl}: <strong className="text-emerald-300">{count}</strong></span>
                                      ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-700">-</span>
                            )}
                          </td>
                          <td className="relative group py-3 px-4 text-center font-mono font-bold text-cyan-400">
                            {item.citadel.total > 0 ? (
                              <>
                                <span className="cursor-help border-b border-cyan-500/25 hover:border-cyan-400 transition-all">
                                  {item.citadel.total}×
                                </span>
                                <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#0a0c16]/95 border border-slate-800 text-[10px] text-slate-200 px-2.5 py-1.5 rounded-xl shadow-xl backdrop-blur-md pointer-events-none">
                                  <div className="flex flex-col gap-0.5 font-sans font-normal text-left min-w-[70px]">
                                    <span className="font-bold text-[9px] text-cyan-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">{t('citadelLevels')}</span>
                                    {Object.entries(item.citadel.levels)
                                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                                      .map(([lvl, count]) => (
                                        <span key={lvl} className="font-mono">Lvl {lvl}: <strong className="text-cyan-300">{count}</strong></span>
                                      ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-700">-</span>
                            )}
                          </td>
                          <td className="relative group py-3 px-4 text-center font-mono font-bold text-slate-400">
                            {item.other.total > 0 ? (
                              <>
                                <span className="cursor-help border-b border-slate-500/25 hover:border-slate-400 transition-all">
                                  {item.other.total}×
                                </span>
                                <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#0a0c16]/95 border border-slate-800 text-[10px] text-slate-200 px-2.5 py-1.5 rounded-xl shadow-xl backdrop-blur-md pointer-events-none">
                                  <div className="flex flex-col gap-0.5 font-sans font-normal text-left min-w-[70px]">
                                    <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">{t('otherLevels')}</span>
                                    {Object.entries(item.other.levels)
                                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                                      .map(([lvl, count]) => (
                                        <span key={lvl} className="font-mono">Lvl {lvl}: <strong className="text-slate-350">{count}</strong></span>
                                      ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-700">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-amber-500 text-sm bg-amber-500/5 font-black">
                            {item.points.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-gold text-sm">
                            {item.total}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-300 text-sm">
                            {item.ratePerDay.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-300 text-sm">
                            {item.ratePerWeek.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.todayCount >= dailyTarget ? (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                Met ✅
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {item.todayCount} / {dailyTarget}
                                </span>
                                <div className="w-16 bg-slate-950 h-1 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${Math.min(100, Math.round((item.todayCount / dailyTarget) * 100))}%` }}
                                    className="bg-amber-500 h-full rounded-full"
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.weeklyCount >= weeklyTarget ? (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                {t('metTarget')}
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {item.weeklyCount} / {weeklyTarget}
                                </span>
                                <div className="w-16 bg-slate-950 h-1 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${Math.min(100, Math.round((item.weeklyCount / weeklyTarget) * 100))}%` }}
                                    className="bg-amber-500 h-full rounded-full"
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${statusColor}`}>
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {sortedContributionsList.map((item, idx) => {
                  let rankBadge = "";
                  if (idx === 0) rankBadge = "🥇";
                  else if (idx === 1) rankBadge = "🥈";
                  else if (idx === 2) rankBadge = "🥉";

                  let statusText = t('statusRecruit');
                  let statusColor = "text-slate-500 bg-slate-500/5 border-slate-500/10";
                  if (item.total >= 30) {
                    statusText = t('statusEliteRaider');
                    statusColor = "text-amber-400 bg-amber-400/5 border-amber-400/10 shadow-sm shadow-amber-400/5";
                  } else if (item.total >= 15) {
                    statusText = t('statusHeavyRaider');
                    statusColor = "text-purple-400 bg-purple-400/5 border-purple-400/10";
                  } else if (item.total >= 5) {
                    statusText = t('statusActiveMember');
                    statusColor = "text-emerald-400 bg-emerald-400/5 border-emerald-400/10";
                  } else if (item.total > 0) {
                    statusText = t('statusContributor');
                    statusColor = "text-sky-400 bg-sky-400/5 border-sky-400/10";
                  }

                  return (
                    <div key={item.player} className="p-3 sm:p-4 bg-slate-950/45 border border-slate-900 rounded-xl sm:rounded-2xl space-y-2.5 sm:space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-400 font-bold w-5 text-xs sm:text-sm">
                            {rankBadge || `#${idx + 1}`}
                          </span>
                          <button
                            onClick={() => setSelectedPlayerDetail(item.player)}
                            className="font-bold text-slate-200 hover:text-gold hover:underline text-xs sm:text-sm text-left"
                          >
                            {item.player}
                          </button>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-bold ${statusColor}`}>
                          {statusText}
                        </span>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-y-2 gap-x-1 sm:gap-2 text-center text-[9px] sm:text-[10px] bg-slate-900/30 p-2 rounded-lg sm:rounded-xl border border-slate-900/50">
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('epicMobile')}</span>
                          <span className="font-mono font-bold text-purple-400">{item.epicCrypt.total}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('rareMobile')}</span>
                          <span className="font-mono font-bold text-sky-400">{item.rareCrypt.total}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('commonMobile')}</span>
                          <span className="font-mono font-bold text-emerald-400">{item.commonCrypt.total}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('citadelMobile')}</span>
                          <span className="font-mono font-bold text-cyan-400">{item.citadel.total}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('otherMobile')}</span>
                          <span className="font-mono font-bold text-slate-500">{item.other.total}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('totalMobile')}</span>
                          <span className="font-mono font-bold text-gold text-xs">{item.total}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('wealthMobile')}</span>
                          <span className="font-mono font-bold text-amber-500 text-xs">{item.points.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('ratePerDayMobile')}</span>
                          <span className="font-mono font-bold text-slate-300 text-xs">{item.ratePerDay.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">{t('ratePerWeekMobile')}</span>
                          <span className="font-mono font-bold text-slate-300 text-xs">{item.ratePerWeek.toFixed(1)}</span>
                        </div>
                      </div>

                      {/* Progress Bars (Compact Side-by-Side) */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900/40 text-[9px] sm:text-[10px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">{t('dailyLabel', { target: dailyTarget })}</span>
                            {item.todayCount >= dailyTarget ? (
                              <span className="font-bold text-emerald-400">Met ✅</span>
                            ) : (
                              <span className="text-slate-350 font-semibold">{item.todayCount}/{dailyTarget}</span>
                            )}
                          </div>
                          <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, Math.round((item.todayCount / dailyTarget) * 100))}%` }}
                              className="bg-amber-500 h-full rounded-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">{t('weeklyLabel', { target: weeklyTarget })}</span>
                            {item.weeklyCount >= weeklyTarget ? (
                              <span className="font-bold text-emerald-400">Met ✅</span>
                            ) : (
                              <span className="text-slate-350 font-semibold">{item.weeklyCount}/{weeklyTarget}</span>
                            )}
                          </div>
                          <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, Math.round((item.weeklyCount / weeklyTarget) * 100))}%` }}
                              className="bg-amber-500 h-full rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: WEEKLY CONTRIBUTIONS (LAST 5 WEEKS) */}
      {activeTab === "weekly" && (() => {
        const topThisWeek = [...weeklyContributionsList].sort((a, b) => b.weeks[0] - a.weeks[0])[0];
        const clanWeeklyTotal = weeklyContributionsList.reduce((sum, p) => sum + p.total, 0);
        const metTargetThisWeek = weeklyContributionsList.filter((p) => p.weeks[0] >= weeklyTarget).length;

        const weeklySortableTh = (field: WeeklySortField, className: string, children: React.ReactNode) => {
          const isActive = weeklySortField === field;
          return (
            <th className={className}>
              <button
                type="button"
                onClick={() => handleWeeklySort(field)}
                className="inline-flex items-center justify-center gap-1 hover:text-gold transition-colors w-full"
              >
                {children}
                {isActive ? (
                  weeklySortDirection === "desc" ? <ArrowDown className="w-3 h-3 shrink-0" /> : <ArrowUp className="w-3 h-3 shrink-0" />
                ) : (
                  <ArrowUpDown className="w-3 h-3 shrink-0 opacity-40" />
                )}
              </button>
            </th>
          );
        };

        return (
          <div className="flex flex-col gap-5 lg:gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">{t('topThisWeek')}</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-lg md:text-2xl font-black text-gold truncate max-w-[140px] sm:max-w-[200px]">
                    {topThisWeek?.player || "None"}
                  </span>
                  <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{topThisWeek?.weeks[0] || 0} {t('dropsUnit')}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>{weekBuckets[0]?.dateRange}</span>
                </div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">📊 5-WEEK CLAN TOTAL</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-2xl md:text-3xl font-black text-slate-100">{clanWeeklyTotal.toLocaleString()}</span>
                  <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{t('dropsUnit')}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>{t('calculatedAcrossRoster')}</span>
                </div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">{t('weeklyTargetMetCard')}</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-2xl md:text-3xl font-black text-slate-100">{metTargetThisWeek}</span>
                  <span className="text-[10px] sm:text-xs text-slate-400">/ {players.length} ({weeklyTarget}/wk)</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>{t('metThisWeek')}</span>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col min-h-[450px]">
              <div className="flex flex-col gap-1.5 mb-3.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-200 uppercase tracking-wide">{t('weeklyLeaderboard', { clanName })}</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">{t('weeklySubtitle')}</p>
              </div>

              <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-between mb-4 sm:mb-5 bg-slate-950/40 p-3 sm:p-4 border border-slate-900 rounded-xl sm:rounded-2xl">
                <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center text-[11px] sm:text-xs">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-400 font-semibold">{t('sourceLabel')}</span>
                    <select
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-350 focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="all">{t('allSources')}</option>
                      <option value="Crypt">{t('crypts')}</option>
                      <option value="Monster">{t('monsters')}</option>
                      <option value="PvP">PvP</option>
                      <option value="Arena">Arena</option>
                      <option value="Tower">Tower</option>
                      <option value="Clan">Clan</option>
                      <option value="Chest">Chest</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 items-center w-full md:w-auto">
                  <button
                    onClick={() => handleExportWeeklyCSV(sortedWeeklyContributionsList)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 hover:border-emerald-500/50 text-emerald-400 font-bold rounded-xl text-xs transition-all w-full md:w-auto justify-center"
                  >
                    <Download className="w-4 h-4" />
                    {t('exportWeeklyCsv')}
                  </button>

                  <div className="relative w-full md:w-auto">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={t('searchPlayer')}
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-full md:w-56"
                    />
                  </div>
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider font-cinzel">
                      <th className="py-3 px-4 w-16 text-slate-450">{t('rankCol')}</th>
                      <th className="py-3 px-4 text-slate-455">{t('playerNameCol')}</th>
                      {weekBuckets.map((week) =>
                        weeklySortableTh(
                          `week${week.index}` as WeeklySortField,
                          "py-3 px-3 text-center text-slate-455 min-w-[100px]",
                          <span className="flex flex-col items-center leading-tight">
                            <span>{week.title}</span>
                            <span className="text-[9px] font-normal text-slate-550 normal-case tracking-normal">{week.dateRange}</span>
                          </span>
                        )
                      )}
                      {weeklySortableTh("total", "py-3 px-4 text-center font-bold text-gold text-slate-455", t('total5W'))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWeeklyContributionsList.map((item, idx) => (
                      <tr key={item.player} className="border-b border-slate-800/40 hover:bg-slate-900/20 transition-all">
                        <td className="py-3 px-4">
                          {idx === 0 ? (
                            <span className="text-lg">🥇</span>
                          ) : idx === 1 ? (
                            <span className="text-lg">🥈</span>
                          ) : idx === 2 ? (
                            <span className="text-lg">🥉</span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center font-bold text-slate-400 font-mono text-[9px]">
                              #{idx + 1}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-200">
                          <button
                            onClick={() => setSelectedPlayerDetail(item.player)}
                            className="hover:text-gold hover:underline transition-all text-left font-bold"
                          >
                            {item.player}
                          </button>
                        </td>
                        {item.weeks.map((count, weekIdx) => (
                          <td key={weekIdx} className="py-3 px-3 text-center">
                            {count > 0 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`font-mono font-bold text-sm ${weekIdx === 0 ? "text-gold" : "text-slate-300"}`}>
                                  {count}
                                </span>
                                {weekIdx === 0 && count >= weeklyTarget && (
                                  <span className="text-[8px] font-bold text-emerald-400">✓ Met</span>
                                )}
                                {weekIdx === 0 && count > 0 && count < weeklyTarget && (
                                  <span className="text-[8px] text-slate-550">{count}/{weeklyTarget}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-700 font-mono">-</span>
                            )}
                          </td>
                        ))}
                        <td className="py-3 px-4 text-center font-mono font-bold text-gold text-sm bg-amber-500/5">
                          {item.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="block md:hidden flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {sortedWeeklyContributionsList.map((item, idx) => {
                  let rankBadge = "";
                  if (idx === 0) rankBadge = "🥇";
                  else if (idx === 1) rankBadge = "🥈";
                  else if (idx === 2) rankBadge = "🥉";

                  return (
                    <div key={item.player} className="p-3 sm:p-4 bg-slate-950/45 border border-slate-900 rounded-xl sm:rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-400 font-bold w-5 text-xs sm:text-sm">
                            {rankBadge || `#${idx + 1}`}
                          </span>
                          <button
                            onClick={() => setSelectedPlayerDetail(item.player)}
                            className="font-bold text-slate-200 hover:text-gold hover:underline text-xs sm:text-sm text-left"
                          >
                            {item.player}
                          </button>
                        </div>
                        <span className="font-mono font-bold text-gold text-xs">{item.total} {t('dropsUnit')}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9px] sm:text-[10px]">
                        {weekBuckets.map((week, weekIdx) => (
                          <div key={week.index} className="bg-slate-900/30 p-2 rounded-lg border border-slate-900/50">
                            <span className="text-slate-500 block mb-0.5 uppercase tracking-tighter text-[8.5px]">{week.title}</span>
                            <span className="text-[8px] text-slate-600 block mb-1">{week.dateRange}</span>
                            <span className={`font-mono font-bold text-sm ${weekIdx === 0 ? "text-gold" : "text-slate-300"}`}>
                              {item.weeks[weekIdx] || 0}
                            </span>
                            {weekIdx === 0 && item.weeks[0] >= weeklyTarget && (
                              <span className="text-[8px] font-bold text-emerald-400 block mt-0.5">Target met ✓</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. TAB: CLAN WHITELIST */}
      {activeTab === "whitelist" && (
        <div className="space-y-4">
          {/* Admin Passcode Banner */}
          <div className="glass-panel p-4 border-amber-500/20 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-amber-500/[0.02]">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                <Lock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">{t('rosterAdminPasscode')}</h3>
                <p className="text-[10px] text-slate-400">{t('rosterAdminDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder={t('enterAdminPasscode')}
                value={deleteSecretKeyInput}
                onChange={(e) => setDeleteSecretKeyInput(e.target.value)}
                className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-amber-500/50 w-full sm:w-48"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
            {/* Main Roster Panel */}
            <div className="lg:col-span-2 glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col h-[450px] sm:h-[550px] overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-200 uppercase tracking-wide">{t('clanMemberRoster', { count: players.length })}</h2>
                  <p className="text-xs text-slate-400">{t('rosterDesc')}</p>
                </div>

                {/* Add and Search inputs */}
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder={t('searchRoster')}
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-amber-500/50 w-full sm:w-44"
                    />
                  </div>

                  <div className="flex gap-1.5 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder={t('addPlayerTag')}
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-amber-500/50 w-full sm:w-36"
                    />
                    <button
                      onClick={() => handleAddPlayer(newPlayerName)}
                      className="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all flex-shrink-0"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* List block */}
              <div className="flex-1 overflow-y-auto pr-1">
                {filteredPlayers.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                    {t('noMembersMatched', { query: playerSearchQuery })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {filteredPlayers.map((player) => (
                      <div
                        key={player}
                        className="flex items-center justify-between p-3 bg-slate-950/65 border border-slate-900 rounded-xl hover:border-slate-800 hover:bg-slate-950/90 transition-all group"
                      >
                        <span className="font-semibold text-slate-200 truncate">{player}</span>
                        <button
                          onClick={() => handleDeletePlayer(player)}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-all"
                          title={t('reverseApproval')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Moderation Queue Panel */}
            <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col h-[450px] sm:h-[550px] overflow-hidden border-rose-500/15">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">{t('moderationQueue')}</h2>
              </div>
              <p className="text-[11px] text-slate-400 mb-4 leading-normal">
                {t('moderationQueueDesc')}
              </p>

              <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                {/* Step 1: Select Misspelled Names from Dropdown */}
                <div className="flex flex-col gap-1.5 relative shrink-0" ref={unknownsDropdownRef}>
                  <label className="text-[10px] font-black text-rose-400 uppercase tracking-wider">
                    {t('step1Label', { count: unknownPlayers.length })}:
                  </label>

                  <button
                    type="button"
                    onClick={() => setUnknownsDropdownOpen(!unknownsDropdownOpen)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-left text-slate-200 placeholder-slate-550 focus:outline-none focus:border-rose-500/50 flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedUnknowns.length === 0
                        ? t('chooseMisspelled')
                        : t('namesSelected', { count: selectedUnknowns.length })}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>

                  {unknownsDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-50 flex flex-col max-h-60 overflow-hidden">
                      <div className="p-2 border-b border-slate-900 shrink-0">
                        <input
                          type="text"
                          placeholder={t('searchQueue')}
                          value={unknownsSearchQuery}
                          onChange={(e) => setUnknownsSearchQuery(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-rose-500/50"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                        {filteredUnknowns.length === 0 ? (
                          <div className="p-2 text-center text-xs text-slate-500">
                            {t('noMatchingNames')}
                          </div>
                        ) : (
                          filteredUnknowns.map((u) => {
                            const isSelected = selectedUnknowns.includes(u.ocrName);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedUnknowns(selectedUnknowns.filter((name) => name !== u.ocrName));
                                  } else {
                                    setSelectedUnknowns([...selectedUnknowns, u.ocrName]);
                                  }
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-900 rounded-lg text-xs text-left text-slate-305 transition-all hover:text-white"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-950 cursor-pointer"
                                />
                                <span className="truncate font-mono">{u.ocrName}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Tag Chips */}
                {selectedUnknowns.length > 0 && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400">{t('selectedNamesLabel')}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedUnknowns([])}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline"
                      >
                        {t('clearAll')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/40 border border-slate-900/60 rounded-xl max-h-24 overflow-y-auto">
                      {selectedUnknowns.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-[10.5px] font-mono font-bold"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => setSelectedUnknowns(selectedUnknowns.filter((n) => n !== name))}
                            className="hover:text-rose-100 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2: Select Correct Player Roster Target */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <label className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                    {t('step2Label')}
                  </label>
                  <select
                    value={bulkCorrectionTarget}
                    onChange={(e) => setBulkCorrectionTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">{t('chooseCorrectMember')}</option>
                    {sortedWhitelistNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Action Buttons */}
                <div className="pt-2 border-t border-slate-900 flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleBulkAssign}
                    disabled={selectedUnknowns.length === 0 || !bulkCorrectionTarget}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="w-4 h-4" />
                    {t('mapSelected', { count: selectedUnknowns.length, target: bulkCorrectionTarget || "..." })}
                  </button>

                  <div className="flex items-center justify-between text-[10px] text-slate-550 my-1">
                    <span className="h-px bg-slate-900 flex-1"></span>
                    <span className="px-2 font-bold uppercase tracking-wider text-slate-500">{t('orDivider')}</span>
                    <span className="h-px bg-slate-900 flex-1"></span>
                  </div>

                  <button
                    type="button"
                    onClick={handleBulkApprove}
                    disabled={selectedUnknowns.length === 0}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all flex-shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <Users className="w-4 h-4" />
                    {t('approveAddBtn')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB: OCR CORRECTIONS */}
      {activeTab === "corrections" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Main Corrections List */}
          <div className="lg:col-span-2 glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col h-[450px] sm:h-[550px] overflow-hidden">
            <h2 className="text-base font-bold text-slate-200 uppercase tracking-wide mb-1">{t('ocrDictionary', { count: fixes.length })}</h2>
            <p className="text-xs text-slate-400 mb-5 leading-normal">
              {t('ocrDictionaryDesc')}
            </p>

            <div className="flex-1 overflow-y-auto pr-1">
              {fixes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  {t('noOcrCorrections')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  {fixes.map((fix) => (
                    <div
                      key={fix.id}
                      className="flex items-center justify-between p-3 bg-slate-950/65 border border-slate-900 rounded-xl hover:border-slate-800 hover:bg-slate-950/90 transition-all group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-slate-400 select-all truncate max-w-[90px]">{fix.ocrName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-500/50 flex-shrink-0" />
                        <span className="font-bold text-slate-250 truncate">{fix.correctedTo}</span>
                      </div>

                      <button
                        onClick={() => handleDeleteFix(fix.ocrName)}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-all flex-shrink-0"
                        title={t('deleteCorrectionTitle')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Add Corrections Form */}
          <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col h-[320px]">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">{t('addCorrection')}</h2>
            </div>

            <div className="flex flex-col gap-4 text-xs mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400">{t('ocrMisspellingLabel')}</label>
                <input
                  type="text"
                  placeholder={t('ocrMisspellingPlaceholder')}
                  value={ocrErrorInput}
                  onChange={(e) => setOcrErrorInput(e.target.value)}
                  className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-550 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400">{t('ocrCorrectTagLabel')}</label>
                <input
                  type="text"
                  placeholder={t('ocrCorrectTagPlaceholder')}
                  value={ocrCorrectToInput}
                  onChange={(e) => setOcrCorrectToInput(e.target.value)}
                  className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-550 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <button
                onClick={handleAddFix}
                className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold transition-all shadow-md shadow-amber-500/10 uppercase tracking-wide flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{t('saveMapping')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "trends" && (
        <TrendsTabContent players={players} />
      )}
      {/* 5. PLAYER DETAILS MODAL */}
      {selectedPlayerDetail && (() => {
        // contributionsList is already memoized above
        const playerStats = contributionsList.find(c => c.player === selectedPlayerDetail) || {
          player: selectedPlayerDetail,
          total: 0,
          points: 0,
          epicCrypt: { total: 0, levels: {} },
          rareCrypt: { total: 0, levels: {} },
          commonCrypt: { total: 0, levels: {} },
          citadel: { total: 0, levels: {} },
          other: { total: 0, levels: {} },
          sources: {},
          todayCount: 0,
          weeklyCount: 0,
          ratePerDay: 0,
          ratePerWeek: 0
        };
        const playerChests = chests.filter(c => c.fromPlayer === selectedPlayerDetail).slice(0, 10);

        // Group scans by source for the mini-chart
        const sourceCounts: Record<string, number> = {};
        chests.filter(c => c.fromPlayer === selectedPlayerDetail).forEach(c => {
          sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1;
        });

        // status badge
        let statusText = t('statusRecruit');
        let statusColor = "text-slate-500 bg-slate-500/5 border-slate-500/10";
        if (playerStats.total >= 30) {
          statusText = t('statusEliteRaider');
          statusColor = "text-amber-400 bg-amber-400/5 border-amber-400/10 shadow-sm shadow-amber-400/5";
        } else if (playerStats.total >= 15) {
          statusText = t('statusHeavyRaider');
          statusColor = "text-purple-400 bg-purple-400/5 border-purple-400/10";
        } else if (playerStats.total >= 5) {
          statusText = t('statusActiveMember');
          statusColor = "text-emerald-400 bg-emerald-400/5 border-emerald-400/10";
        } else if (playerStats.total > 0) {
          statusText = t('statusContributor');
          statusColor = "text-sky-400 bg-sky-400/5 border-sky-400/10";
        }

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
            <div className="glass-panel max-w-lg w-full rounded-xl sm:rounded-2xl p-4 sm:p-6 relative border-amber-500/20 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedPlayerDetail(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-2.5 rounded-xl">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#030307]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-100">{selectedPlayerDetail}</h2>
                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${statusColor}`}>
                      {statusText}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{t('clanMemberStats', { clanName })}</p>
                </div>
              </div>

              {/* Rarity breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5 sm:mb-6 text-center">
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">{t('clanWealthLabel')}</span>
                  <p className="text-base sm:text-lg font-black text-amber-500 mt-0.5 sm:mt-1">{playerStats.points.toLocaleString()} 💎</p>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">{t('totalScanned')}</span>
                  <p className="text-base sm:text-lg font-black text-slate-100 mt-0.5 sm:mt-1">{playerStats.total}</p>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">{t('dailyTargetStat')}</span>
                  <p className="text-xs sm:text-sm font-black text-gold mt-0.5 sm:mt-1">
                    {playerStats.todayCount} / {dailyTarget}
                    <span className="text-[9px] sm:text-[10px] text-slate-450 block mt-0.5">({Math.min(100, Math.round((playerStats.todayCount / dailyTarget) * 100))}%)</span>
                  </p>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">{t('weeklyTargetStat')}</span>
                  <p className="text-xs sm:text-sm font-black text-gold mt-0.5 sm:mt-1">
                    {playerStats.weeklyCount} / {weeklyTarget}
                    <span className="text-[9px] sm:text-[10px] text-slate-450 block mt-0.5">({Math.min(100, Math.round((playerStats.weeklyCount / weeklyTarget) * 100))}%)</span>
                  </p>
                </div>
              </div>

              {/* System Activity & Rates */}
              <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 text-xs bg-slate-950/30 p-3 rounded-lg border border-slate-900/50">
                <div className="space-y-1 text-left">
                  <span className="text-slate-500 font-bold uppercase block text-[8.5px] sm:text-[9px]">{t('firstAppearance')}</span>
                  <p className="text-slate-200 font-mono font-bold">
                    {firstAppearances[selectedPlayerDetail] ? new Date(firstAppearances[selectedPlayerDetail]).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : t('naValue')}
                  </p>
                </div>
                <div className="space-y-1 text-left">
                  <span className="text-slate-500 font-bold uppercase block text-[8.5px] sm:text-[9px]">{t('activeDuration')}</span>
                  <p className="text-slate-200 font-bold">
                    {firstAppearances[selectedPlayerDetail] ? t('daysActive', { days: getDaysOnSystem(firstAppearances[selectedPlayerDetail], new Date()) }) : t('naValue')}
                  </p>
                </div>
                <div className="space-y-1 text-left">
                  <span className="text-slate-500 font-bold uppercase block text-[8.5px] sm:text-[9px]">{t('avgRateDay')}</span>
                  <p className="text-amber-500 font-mono font-black text-sm">
                    {playerStats.ratePerDay ? t('rateDay', { rate: playerStats.ratePerDay.toFixed(2) }) : t('rateDay', { rate: '0.00' })}
                  </p>
                </div>
                <div className="space-y-1 text-left">
                  <span className="text-slate-500 font-bold uppercase block text-[8.5px] sm:text-[9px]">{t('avgRateWeek')}</span>
                  <p className="text-amber-500 font-mono font-black text-sm">
                    {playerStats.ratePerWeek ? t('rateWeek', { rate: playerStats.ratePerWeek.toFixed(2) }) : t('rateWeek', { rate: '0.00' })}
                  </p>
                </div>
              </div>

              {/* Mini Trend Graph */}
              <div className="mb-5 sm:mb-6">
                <PlayerMiniTrend player={selectedPlayerDetail} />
              </div>

              {/* Quality Distribution */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-350 uppercase mb-3">{t('chestQualityShareModal')}</h3>
                {playerStats.total === 0 ? (
                  <p className="text-xs text-slate-500">{t('noScansForPlayer')}</p>
                ) : (
                  <div className="flex flex-col gap-3 text-xs">
                    {/* Epic Crypt */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-purple-400">{t('epicCrypt')}</span>
                        <span className="text-slate-400">{playerStats.epicCrypt.total} ({Math.round((playerStats.epicCrypt.total / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-1">
                        <div style={{ width: `${(playerStats.epicCrypt.total / playerStats.total) * 100}%` }} className="bg-purple-500 h-full rounded-full" />
                      </div>
                      {Object.keys(playerStats.epicCrypt.levels).length > 0 && (
                        <div className="text-[9px] text-slate-500 flex flex-wrap gap-1 mt-0.5">
                          {Object.entries(playerStats.epicCrypt.levels)
                            .sort((a, b) => Number(a[0]) - Number(b[0]))
                            .map(([lvl, count]) => (
                              <span key={lvl} className="bg-slate-950 border border-slate-900/60 px-1.5 py-0.5 rounded font-mono">
                                Lvl {lvl}: {count}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    {/* Rare Crypt */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-blue-400">{t('rareCrypt')}</span>
                        <span className="text-slate-400">{playerStats.rareCrypt.total} ({Math.round((playerStats.rareCrypt.total / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-1">
                        <div style={{ width: `${(playerStats.rareCrypt.total / playerStats.total) * 100}%` }} className="bg-blue-500 h-full rounded-full" />
                      </div>
                      {Object.keys(playerStats.rareCrypt.levels).length > 0 && (
                        <div className="text-[9px] text-slate-550 flex flex-wrap gap-1 mt-0.5">
                          {Object.entries(playerStats.rareCrypt.levels)
                            .sort((a, b) => Number(a[0]) - Number(b[0]))
                            .map(([lvl, count]) => (
                              <span key={lvl} className="bg-slate-950 border border-slate-900/60 px-1.5 py-0.5 rounded font-mono">
                                Lvl {lvl}: {count}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    {/* Common Crypt */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-green-400">{t('commonCrypt')}</span>
                        <span className="text-slate-400">{playerStats.commonCrypt.total} ({Math.round((playerStats.commonCrypt.total / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-1">
                        <div style={{ width: `${(playerStats.commonCrypt.total / playerStats.total) * 100}%` }} className="bg-green-500 h-full rounded-full" />
                      </div>
                      {Object.keys(playerStats.commonCrypt.levels).length > 0 && (
                        <div className="text-[9px] text-slate-550 flex flex-wrap gap-1 mt-0.5">
                          {Object.entries(playerStats.commonCrypt.levels)
                            .sort((a, b) => Number(a[0]) - Number(b[0]))
                            .map(([lvl, count]) => (
                              <span key={lvl} className="bg-slate-950 border border-slate-900/60 px-1.5 py-0.5 rounded font-mono">
                                Lvl {lvl}: {count}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    {/* Citadel */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-cyan-400">{t('citadel')}</span>
                        <span className="text-slate-400">{playerStats.citadel.total} ({Math.round((playerStats.citadel.total / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-1">
                        <div style={{ width: `${(playerStats.citadel.total / playerStats.total) * 100}%` }} className="bg-cyan-500 h-full rounded-full" />
                      </div>
                      {Object.keys(playerStats.citadel.levels).length > 0 && (
                        <div className="text-[9px] text-slate-550 flex flex-wrap gap-1 mt-0.5">
                          {Object.entries(playerStats.citadel.levels)
                            .sort((a, b) => Number(a[0]) - Number(b[0]))
                            .map(([lvl, count]) => (
                              <span key={lvl} className="bg-slate-950 border border-slate-900/60 px-1.5 py-0.5 rounded font-mono">
                                Lvl {lvl}: {count}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    {/* Other */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-slate-400">{t('other')}</span>
                        <span className="text-slate-400">{playerStats.other.total} ({Math.round((playerStats.other.total / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-1">
                        <div style={{ width: `${(playerStats.other.total / playerStats.total) * 100}%` }} className="bg-slate-500 h-full rounded-full" />
                      </div>
                      {Object.keys(playerStats.other.levels).length > 0 && (
                        <div className="text-[9px] text-slate-550 flex flex-wrap gap-1 mt-0.5">
                          {Object.entries(playerStats.other.levels)
                            .sort((a, b) => Number(a[0]) - Number(b[0]))
                            .map(([lvl, count]) => (
                              <span key={lvl} className="bg-slate-950 border border-slate-900/60 px-1.5 py-0.5 rounded font-mono">
                                Lvl {lvl}: {count}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Source Distribution */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-350 uppercase mb-3">{t('sourcesContributed')}</h3>
                {Object.keys(sourceCounts).length === 0 ? (
                  <p className="text-xs text-slate-500">{t('noSourceData')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(sourceCounts).map(([source, count]) => (
                      <span key={source} className="bg-slate-950 border border-slate-900 px-2.5 py-1 rounded-lg text-xs text-slate-300">
                        {t('sourceItem', { source })}: <strong className="text-gold">{count}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Drops */}
              <div>
                <h3 className="text-xs font-bold text-slate-350 uppercase mb-3">{t('recentScanActivity')}</h3>
                {playerChests.length === 0 ? (
                  <p className="text-xs text-slate-500">{t('noRecentActivity')}</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {playerChests.map(chest => (
                      <div key={chest.id} className="p-2.5 bg-slate-950/70 border border-slate-900 rounded-lg flex justify-between items-center text-[11px]">
                        <div>
                          <p className="font-bold text-slate-200">{chest.chestName}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Source: {chest.source}</p>
                        </div>
                        <span className="text-slate-400 font-mono">{formatUTC10Time(chest.time)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete Contributions Area */}
              <div className="border-t border-slate-900/60 pt-4 mt-6 flex justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(selectedPlayerDetail)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/35 hover:border-red-500/50 text-red-400 font-bold rounded-xl text-xs transition-all cursor-pointer animate-pulse-slow"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('deleteContributions')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[60] animate-fade-in">
          <div className="glass-panel max-w-md w-full rounded-xl sm:rounded-2xl p-4 sm:p-6 border-red-500/20 shadow-lg shadow-red-500/5 relative">
            <button
              onClick={() => {
                setShowDeleteConfirm(null);
                setDeleteSecretKeyInput("");
                setDeleteErrorMessage("");
              }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              disabled={isDeleting}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 text-red-500">
              <div className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-md sm:text-lg font-bold text-slate-100">{t('deleteContributionsTitle')}</h2>
                <p className="text-xs text-red-400 font-medium">{t('criticalActionRequired')}</p>
              </div>
            </div>

            <div className="bg-red-950/20 border border-red-900/30 p-3 rounded-lg text-xs text-red-200/90 leading-relaxed mb-4">
              {t('deleteWarning', { player: showDeleteConfirm })}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t('secretAdminKey')}
                </label>
                <input
                  type="password"
                  placeholder={t('enterDeleteKey')}
                  value={deleteSecretKeyInput}
                  onChange={(e) => {
                    setDeleteSecretKeyInput(e.target.value);
                    if (deleteErrorMessage) setDeleteErrorMessage("");
                  }}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-red-500/50"
                  disabled={isDeleting}
                />
              </div>

              {deleteErrorMessage && (
                <p className="text-[11px] text-red-400 font-semibold flex items-center gap-1.5 bg-red-950/20 border border-red-900/40 p-2 rounded-lg">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{deleteErrorMessage}</span>
                </p>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(null);
                    setDeleteSecretKeyInput("");
                    setDeleteErrorMessage("");
                  }}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  disabled={isDeleting}
                >
                  {t('cancelDelete')}
                </button>
                <button
                  onClick={() => handleConfirmDeleteContributions(showDeleteConfirm)}
                  className="flex-1 py-2 bg-red-600/90 hover:bg-red-600 border border-red-500/30 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  disabled={isDeleting || !deleteSecretKeyInput.trim()}
                >
                  {isDeleting ? (
                    <span>{t('deleting')}</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('confirmDelete')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
