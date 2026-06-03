"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
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
  Download,
  Target,
  X,
  MessageCircle,
  MessageSquare,
  Gem
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

function parseChestLevel(chestName: string, source: string): number {
  const cn = chestName.toLowerCase();
  const src = (source || "").toLowerCase();
  const fullText = `${cn} ${src}`;

  let level = 0;
  const levelRegex = /(?:level|lvl|lvl\.|level\.)\s*(\d+)/i;
  const match = fullText.match(levelRegex);
  if (match) {
    level = parseInt(match[1], 10);
  } else {
    const numMatch = fullText.match(/\b(5|10|15|20|25|30|35)\b/);
    if (numMatch) {
      level = parseInt(numMatch[1], 10);
    }
  }
  return level;
}

function calculateChestPoints(chestName: string, source: string): number {
  const cn = chestName.toLowerCase();
  const src = (source || "").toLowerCase();
  const fullText = `${cn} ${src}`;

  const level = parseChestLevel(chestName, source);

  // 2. Identify Category
  const isLegendary = cn.includes("legendary") || cn.includes("gold");
  const isCitadel = fullText.includes("citadel");
  const isEpic = fullText.includes("epic") || fullText.includes("dragon");
  const isRare = fullText.includes("rare") || cn.includes("minotaur") || cn.includes("wyvern");

  if (isLegendary) {
    return 1500;
  }

  if (isEpic) {
    if (level <= 15) return 75;
    if (level <= 20) return 598;
    if (level <= 25) return 1000;
    if (level <= 30) return 1184;
    return 1484; // level 35
  }

  if (isRare) {
    if (level <= 10) return 66;
    if (level <= 15) return 130;
    if (level <= 20) return 319;
    if (level <= 25) return 800;
    return 1200; // level 30
  }

  if (isCitadel) {
    if (level <= 10) return 18;
    if (level <= 15) return 30;
    if (level <= 20) return 50;
    if (level <= 25) return 120;
    return 200; // level 30
  }

  // Fallback to Common Crypt
  if (level <= 5) return 13;
  if (level <= 10) return 35;
  if (level <= 15) return 75;
  if (level <= 20) return 167;
  return 550; // level 25
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
  const t = useTranslations('Dashboard');
  const clanName = process.env.NEXT_PUBLIC_CLAN_NAME ?? 'ELF';
  const [rawChests, setRawChests] = useState<Chest[]>([]);
  const [players, setPlayers] = useState<string[]>([]);

  // Premium Analytics & Filtering States
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [dailyTarget, setDailyTarget] = useState<number>(20);
  const [weeklyTarget, setWeeklyTarget] = useState<number>(150);

  const isDaily = filterDateRange === "today";
  const activeTarget = isDaily ? dailyTarget : weeklyTarget;
  const setActiveTarget = isDaily ? setDailyTarget : setWeeklyTarget;
  const targetLabel = isDaily ? "Daily Target" : "Weekly Target";

  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<string | null>(null);


  // Compute active filtered chests
  const chests = useMemo(() => {
    return rawChests.filter(chest => {
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
  }, [rawChests, filterSource, filterDateRange]);
  const [fixes, setFixes] = useState<PlayerFix[]>([]);
  const [unknownPlayers, setUnknownPlayers] = useState<UnknownPlayer[]>([]);

  const [activeTab, setActiveTab] = useState<"live" | "contributions" | "whitelist" | "corrections">("live");
  const [isConnected, setIsConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Roster inputs
  const [newPlayerName, setNewPlayerName] = useState("");
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  // Correction inputs
  const [ocrErrorInput, setOcrErrorInput] = useState("");
  const [ocrCorrectToInput, setOcrCorrectToInput] = useState("");

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

  // Fetch chests whenever filterDateRange changes
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

    // Populate todayCount and weeklyCount based on rawChests (overall scanning stats)
    rawChests.forEach((chest) => {
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

    return Object.entries(contributions)
      .map(([player, stats]) => ({ player, ...stats }))
      .sort((a, b) => b.points - a.points || b.total - a.total);
  }, [chests, rawChests, players, dailyTarget, weeklyTarget]);

  const handleExportCSV = (contributionsList: PlayerContribution[]) => {
    const headers = [
      "Rank", "Player Name", "Epic Crypt", "Rare Crypt", "Common Crypt", "Citadel", "Other",
      "Total Drops", "Clan Wealth", "Daily Target (20) Status", "Weekly Target (150) Status"
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
    try {
      const res = await fetch("/api/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setPlayers((prev) => [...prev, trimmed].sort());
        setNewPlayerName("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePlayer = async (name: string) => {
    try {
      const res = await fetch(`/api/whitelist?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlayers((prev) => prev.filter((p) => p !== name));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Moderation: Approve Unknown Player & remove from unknown log
  const handleApproveUnknownPlayer = async (ocrName: string) => {
    try {
      // 1. Add to Whitelist
      const addRes = await fetch("/api/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ocrName }),
      });

      if (addRes.ok) {
        setPlayers((prev) => [...prev, ocrName].sort());

        // 2. Delete from Unknown logs
        await fetch(`/api/unknown-players?ocrName=${encodeURIComponent(ocrName)}`, {
          method: "DELETE",
        });

        setUnknownPlayers((prev) => prev.filter((u) => u.ocrName !== ocrName));
      }
    } catch (e) {
      console.error("Moderation whitelisting failed:", e);
    }
  };

  // Moderation: Assign Spelling Correction to Unknown Player and clear log
  const handleAssignCorrection = async (ocrName: string, correctTo: string) => {
    const trimmedTo = correctTo.trim();
    if (!trimmedTo) return;
    try {
      // 1. Write PlayerFix mapping
      const fixRes = await fetch("/api/player-fixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrName, correctedTo: trimmedTo }),
      });

      if (fixRes.ok) {
        const newFix: PlayerFix = await fixRes.json();
        setFixes((prev) => [...prev.filter((f) => f.ocrName !== ocrName), newFix]);

        // 2. Delete from Unknown logs
        await fetch(`/api/unknown-players?ocrName=${encodeURIComponent(ocrName)}`, {
          method: "DELETE",
        });

        setUnknownPlayers((prev) => prev.filter((u) => u.ocrName !== ocrName));
      }
    } catch (e) {
      console.error("Spelling mapping failed:", e);
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

  // Today's total chests (based on rawChests so it always reflects "today" regardless of the active date filter)
  const todayTotal = useMemo(() => {
    const todayGameDayStr = getUTC10GameDayStr(new Date());
    return rawChests.filter((c) => c.gameDay === todayGameDayStr).length;
  }, [rawChests]);

  // Total Clan Wealth points across all chests in rawChests
  const totalWealth = useMemo(() => {
    return rawChests.reduce((sum, chest) => sum + calculateChestPoints(chest.chestName, chest.source), 0);
  }, [rawChests]);

  // Today's Clan Wealth points across chests scanned today
  const todayWealth = useMemo(() => {
    const todayGameDayStr = getUTC10GameDayStr(new Date());
    return rawChests
      .filter((c) => c.gameDay === todayGameDayStr)
      .reduce((sum, chest) => sum + calculateChestPoints(chest.chestName, chest.source), 0);
  }, [rawChests]);

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
          <a
            href="https://chat.whatsapp.com/D7E8YCtYPOjB2j1vN4ZVDN"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-md shadow-emerald-500/5 transition-all text-xs"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Group</span>
          </a>

          {/* Discord Invite link */}
          <a
            href="https://discord.gg/7994zN5X"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 shadow-md shadow-indigo-500/5 transition-all text-xs"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discord</span>
          </a>

          {/* Audio toggle button */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${soundEnabled
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-md shadow-amber-500/5 hover:bg-amber-500/20"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-800"
              }`}
          >
            Sound: {soundEnabled ? "ON" : "OFF"}
          </button>

          {/* Connection badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isConnected
            ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-400"
            : "bg-rose-500/10 border-rose-500/35 text-rose-400"
            }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 animate-pulse" />
                <span className="font-semibold tracking-wide text-xs">RADAR LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="font-semibold tracking-wide text-xs">OFFLINE (RETRYING)</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* CORE STATISTICS CARDS */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4 mb-6 md:mb-8">
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">TOTAL CHESTS LOGGED</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-slate-100">{totalChests}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">scanned</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Database className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>CockroachDB Active</span>
          </div>
        </div>

        {/* CLAN WEALTH CARD */}
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">TOTAL CLAN WEALTH</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-amber-400">{totalWealth.toLocaleString()}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">points</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Gem className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>Accumulated wealth 💎</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">ACTIVE SCANNERS</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-slate-100">{activeScanners}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">players</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>Out of {players.length} active</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">DAILY SCAN RATE</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-slate-100">{dailyAverage}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">chests/day</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>Computed dynamically</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">MODERATION ALERTS</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className={`text-lg sm:text-2xl md:text-3xl font-black ${unknownPlayers.length > 0 ? "text-rose-500" : "text-emerald-400"}`} style={{ color: unknownPlayers.length > 0 ? "rgb(248, 113, 113)" : "rgb(52, 211, 153)" }}>
              {unknownPlayers.length}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400">pending</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <ShieldAlert className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${unknownPlayers.length > 0 ? "text-rose-500" : "text-emerald-400"}`} />
            <span>Unknown names flagged</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">TODAY&apos;S CHESTS</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-amber-400">{todayTotal}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">total</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>UTC+10 game day</span>
          </div>
        </div>

        {/* TODAY'S WEALTH CARD */}
        <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider">TODAY&apos;S WEALTH</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl md:text-3xl font-black text-amber-400">{todayWealth.toLocaleString()}</span>
            <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">points</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500/70" />
            <span>Today&apos;s active wealth 🔥</span>
          </div>
        </div>
      </section>

      {/* CORE NAVIGATION TABS */}
      <div className="flex border-b border-slate-800/80 mb-5 gap-1 overflow-x-auto scrollbar-none snap-x -mx-4 px-4 md:mx-0 md:px-0 whitespace-nowrap">
        <button
          onClick={() => setActiveTab("live")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start ${activeTab === "live"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          Live Scanner Feed
        </button>
        <button
          onClick={() => setActiveTab("contributions")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start ${activeTab === "contributions"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          Player Contributions
        </button>
        <button
          onClick={() => setActiveTab("whitelist")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start flex items-center gap-1.5 ${activeTab === "whitelist"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          Clan Whitelist
          {unknownPlayers.length > 0 && (
            <span className="bg-rose-500 text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse flex-shrink-0">
              {unknownPlayers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("corrections")}
          className={`pb-2.5 sm:pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-200 flex-shrink-0 snap-start ${activeTab === "corrections"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          OCR Name Corrections
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
                <span className="text-sm font-bold tracking-wide text-slate-200">REAL-TIME INGESTION CARDS</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">Showing latest scans</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
              {chests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Database className="w-12 h-12 stroke-[1.5] text-slate-600/70" />
                  <p className="text-sm font-medium">No chest scans recorded yet.</p>
                  <p className="text-xs text-slate-600">Start the Android mobile scanner overlay to log game drops.</p>
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
                              <span>Claimed by:</span>
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
              <h2 className="text-sm font-bold tracking-wider text-slate-300 mb-3.5 sm:mb-4 uppercase font-cinzel text-gold">CHEST QUALITY SHARE</h2>

              {chests.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                  Waiting for database records to map analytics...
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
              <h2 className="text-sm font-bold tracking-wider text-slate-300 mb-3 uppercase">TOP ACTIVE SCANNERS</h2>
              <div className="overflow-y-auto pr-1 flex flex-col gap-2.5 text-xs">
                {chests.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    No scanner ranking metrics available.
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
                        <span className="font-mono font-bold text-amber-500">{count} drops</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB: PLAYER CONTRIBUTIONS LEADERBOARD */}
      {activeTab === "contributions" && (() => {
        // contributionsList is already memoized above
        const topContributor = contributionsList[0]?.player || "None";
        const topContributorPoints = contributionsList[0]?.points || 0;
        const totalScanChests = chests.length;
        const averageChestsPerPlayer = players.length > 0 ? (totalScanChests / players.length).toFixed(1) : "0.0";

        return (
          <div className="flex flex-col gap-5 lg:gap-6">
            {/* Highlights Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">🏆 TOP PRODUCER</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-lg md:text-2xl font-black text-gold truncate max-w-[140px] sm:max-w-[200px]">{topContributor}</span>
                  <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{topContributorPoints.toLocaleString()} wealth</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>Leads the {clanName} contribution board</span>
                </div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">📊 AVERAGE CONTRIBUTION</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-2xl md:text-3xl font-black text-slate-100">{averageChestsPerPlayer}</span>
                  <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">chests/member</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>Calculated across active roster</span>
                </div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 tracking-wider uppercase">🏹 ACTIVE CONTRIBUTION RATE</span>
                <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                  <span className="text-base sm:text-2xl md:text-3xl font-black text-slate-100">
                    {contributionsList.filter(c => c.total > 0).length}
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-400">/ {players.length} active</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>At least 1 registered drop</span>
                </div>
              </div>
            </div>

            {/* Leaderboard Grid */}
            <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col min-h-[450px]">
              <div className="flex flex-col gap-1.5 mb-3.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-200 uppercase tracking-wide">🏆 {clanName} MEMBER CONTRIBUTIONS LEADERBOARD</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">Real-time statistics aggregating total monster and crypt chest claims.</p>
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
                    <span className="text-slate-400 font-semibold">Date Range:</span>
                    <select
                      value={filterDateRange}
                      onChange={(e) => setFilterDateRange(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-350 focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today (UTC+10)</option>
                      <option value="week">Past 7 Days</option>
                      <option value="month">Past 30 Days</option>
                    </select>
                  </div>

                  {/* Daily target input */}
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-400 font-semibold">Daily Target:</span>
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
                    <span className="text-slate-400 font-semibold">Weekly Target:</span>
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
                  <button
                    onClick={() => handleExportCSV(contributionsList)}
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
                      <th className="py-3 px-4 w-16 text-slate-450">Rank</th>
                      <th className="py-3 px-4 text-slate-455">Player Name</th>
                      <th className="py-3 px-4 text-center text-slate-455">Epic Crypt 🐉</th>
                      <th className="py-3 px-4 text-center text-slate-455">Rare Crypt 💀</th>
                      <th className="py-3 px-4 text-center text-slate-455">Common Crypt 📦</th>
                      <th className="py-3 px-4 text-center text-slate-455">Citadel 🏰</th>
                      <th className="py-3 px-4 text-center text-slate-455">Other 🌀</th>
                      <th className="py-3 px-4 text-center font-bold text-amber-500 text-slate-455">Clan Wealth 💎</th>
                      <th className="py-3 px-4 text-center font-bold text-gold text-slate-455">Total Drops</th>
                      <th className="py-3 px-4 text-center text-slate-455 w-32">Daily Target ({dailyTarget})</th>
                      <th className="py-3 px-4 text-center text-slate-455 w-32">Weekly Target ({weeklyTarget})</th>
                      <th className="py-3 px-4 w-40 text-slate-455">Status Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributionsList
                      .filter(item => item.player.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                      .map((item, idx) => {
                        let statusText = "Recruit";
                        let statusColor = "text-slate-500 bg-slate-500/5 border-slate-500/10";
                        if (item.total >= 30) {
                          statusText = "Elite Raider";
                          statusColor = "text-amber-400 bg-amber-400/5 border-amber-400/10 shadow-sm shadow-amber-400/5";
                        } else if (item.total >= 15) {
                          statusText = "Heavy Raider";
                          statusColor = "text-purple-400 bg-purple-400/5 border-purple-400/10";
                        } else if (item.total >= 5) {
                          statusText = "Active Member";
                          statusColor = "text-emerald-400 bg-emerald-400/5 border-emerald-400/10";
                        } else if (item.total > 0) {
                          statusText = "Contributor";
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
                                      <span className="font-bold text-[9px] text-purple-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">Epic Levels</span>
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
                                      <span className="font-bold text-[9px] text-sky-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">Rare Levels</span>
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
                                      <span className="font-bold text-[9px] text-emerald-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">Common Levels</span>
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
                                      <span className="font-bold text-[9px] text-cyan-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">Citadel Levels</span>
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
                                      <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wide border-b border-slate-900 pb-0.5 mb-1">Other Levels</span>
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
                                  Met ✅
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
                {contributionsList
                  .filter(item => item.player.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                  .map((item, idx) => {
                    let rankBadge = "";
                    if (idx === 0) rankBadge = "🥇";
                    else if (idx === 1) rankBadge = "🥈";
                    else if (idx === 2) rankBadge = "🥉";

                    let statusText = "Recruit";
                    let statusColor = "text-slate-500 bg-slate-500/5 border-slate-500/10";
                    if (item.total >= 30) {
                      statusText = "Elite Raider";
                      statusColor = "text-amber-400 bg-amber-400/5 border-amber-400/10 shadow-sm shadow-amber-400/5";
                    } else if (item.total >= 15) {
                      statusText = "Heavy Raider";
                      statusColor = "text-purple-400 bg-purple-400/5 border-purple-400/10";
                    } else if (item.total >= 5) {
                      statusText = "Active Member";
                      statusColor = "text-emerald-400 bg-emerald-400/5 border-emerald-400/10";
                    } else if (item.total > 0) {
                      statusText = "Contributor";
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
                        <div className="grid grid-cols-4 gap-y-2 gap-x-1 sm:gap-2 text-center text-[9px] sm:text-[10px] bg-slate-900/30 p-2 rounded-lg sm:rounded-xl border border-slate-900/50">
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Epic 🐉</span>
                            <span className="font-mono font-bold text-purple-400">{item.epicCrypt.total}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Rare 💀</span>
                            <span className="font-mono font-bold text-sky-400">{item.rareCrypt.total}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Com 📦</span>
                            <span className="font-mono font-bold text-emerald-400">{item.commonCrypt.total}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Citadel 🏰</span>
                            <span className="font-mono font-bold text-cyan-400">{item.citadel.total}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Other 🌀</span>
                            <span className="font-mono font-bold text-slate-500">{item.other.total}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Total 🏆</span>
                            <span className="font-mono font-bold text-gold text-xs">{item.total}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Wealth 💎</span>
                            <span className="font-mono font-bold text-amber-500 text-xs">{item.points.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Progress Bars (Compact Side-by-Side) */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900/40 text-[9px] sm:text-[10px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-medium">Daily ({dailyTarget})</span>
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
                              <span className="text-slate-400 font-medium">Weekly ({weeklyTarget})</span>
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

      {/* 2. TAB: CLAN WHITELIST */}
      {activeTab === "whitelist" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Main Roster Panel */}
          <div className="lg:col-span-2 glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col h-[450px] sm:h-[550px] overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-200 uppercase tracking-wide">CLAN MEMBER ROSTER ({players.length})</h2>
                <p className="text-xs text-slate-400">Only players in this list will be processed without alerts.</p>
              </div>

              {/* Add and Search inputs */}
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-amber-500/50 w-full sm:w-44"
                  />
                </div>

                <div className="flex gap-1.5 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Add player tag..."
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
                  No clan members matched &quot;{playerSearchQuery}&quot; or roster is empty.
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
                        title="Remove from roster"
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
          <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col h-[400px] sm:h-[550px] overflow-hidden border-rose-500/15">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">MODERATION QUEUE</h2>
            </div>
            <p className="text-[11px] text-slate-400 mb-4 leading-normal">
              Encounters reported by the Android OCR scanner that do not match the roster. Review and approve or correct.
            </p>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5">
              {unknownPlayers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 text-center">
                  <Check className="w-10 h-10 stroke-[2] text-emerald-500/80 bg-emerald-500/5 p-2 rounded-full border border-emerald-500/10" />
                  <p className="text-xs font-semibold text-slate-350">Queue is completely clear!</p>
                  <p className="text-[10px] text-slate-600 max-w-[200px]">OCR reads are currently mapping cleanly to the whitelisted roster.</p>
                </div>
              ) : (
                unknownPlayers.map((unPlayer) => (
                  <div key={unPlayer.id} className="p-3.5 bg-rose-500/[0.02] border border-rose-500/10 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-rose-350 tracking-tight font-mono truncate max-w-[150px]" title={unPlayer.ocrName}>
                          {unPlayer.ocrName}
                        </span>
                        <span className="text-[9px] text-slate-500 mt-0.5">
                          Encountered: {new Date(unPlayer.encountered).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <button
                        onClick={() => handleApproveUnknownPlayer(unPlayer.ocrName)}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold transition-all"
                        title="Add this player directly to clan whitelist"
                      >
                        <Users className="w-3 h-3" />
                        <span>APPROVE</span>
                      </button>
                    </div>

                    {/* Quick spelling correction mapper */}
                    <div className="pt-2 border-t border-slate-900 flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400">ASSIGN SPELLING CORRECTION:</span>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Correct name tag..."
                          id={`correct-${unPlayer.id}`}
                          className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-100 focus:outline-none w-28"
                        />
                        <button
                          onClick={() => {
                            const inputEl = document.getElementById(`correct-${unPlayer.id}`) as HTMLInputElement;
                            if (inputEl) handleAssignCorrection(unPlayer.ocrName, inputEl.value);
                          }}
                          className="px-2 py-1 bg-slate-900 border border-slate-750 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 text-slate-400 rounded-lg text-[10px] font-bold transition-all"
                        >
                          MAP
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB: OCR CORRECTIONS */}
      {activeTab === "corrections" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Main Corrections List */}
          <div className="lg:col-span-2 glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col h-[450px] sm:h-[550px] overflow-hidden">
            <h2 className="text-base font-bold text-slate-200 uppercase tracking-wide mb-1">OCR CORRECTIONS DICTIONARY ({fixes.length})</h2>
            <p className="text-xs text-slate-400 mb-5 leading-normal">
              Corrects common character-swapping and OCR noise. Scanned variants in the left column will automatically resolve to the whitelisted tag on the right.
            </p>

            <div className="flex-1 overflow-y-auto pr-1">
              {fixes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No OCR spelling corrections mapped.
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
                        title="Delete correction mapping"
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
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide">ADD CORRECTION</h2>
            </div>

            <div className="flex flex-col gap-4 text-xs mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400">OCR MISPELLING / ERROR:</label>
                <input
                  type="text"
                  placeholder="e.g. Relativty"
                  value={ocrErrorInput}
                  onChange={(e) => setOcrErrorInput(e.target.value)}
                  className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-550 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400">CORRECT TAG TO MAP TO:</label>
                <input
                  type="text"
                  placeholder="e.g. Relativity"
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
                <span>SAVE MAPPING</span>
              </button>
            </div>
          </div>
        </div>
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
          weeklyCount: 0
        };
        const playerChests = chests.filter(c => c.fromPlayer === selectedPlayerDetail).slice(0, 10);
        
        // Group scans by source for the mini-chart
        const sourceCounts: Record<string, number> = {};
        chests.filter(c => c.fromPlayer === selectedPlayerDetail).forEach(c => {
          sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1;
        });

        // status badge
        let statusText = "Recruit";
        let statusColor = "text-slate-500 bg-slate-500/5 border-slate-500/10";
        if (playerStats.total >= 30) {
          statusText = "Elite Raider";
          statusColor = "text-amber-400 bg-amber-400/5 border-amber-400/10 shadow-sm shadow-amber-400/5";
        } else if (playerStats.total >= 15) {
          statusText = "Heavy Raider";
          statusColor = "text-purple-400 bg-purple-400/5 border-purple-400/10";
        } else if (playerStats.total >= 5) {
          statusText = "Active Member";
          statusColor = "text-emerald-400 bg-emerald-400/5 border-emerald-400/10";
        } else if (playerStats.total > 0) {
          statusText = "Contributor";
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
                  <p className="text-xs text-slate-400">{clanName} Clan Member Stats</p>
                </div>
              </div>

              {/* Rarity breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5 sm:mb-6 text-center">
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">Clan Wealth</span>
                  <p className="text-base sm:text-lg font-black text-amber-500 mt-0.5 sm:mt-1">{playerStats.points.toLocaleString()} 💎</p>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">Total Scanned</span>
                  <p className="text-base sm:text-lg font-black text-slate-100 mt-0.5 sm:mt-1">{playerStats.total}</p>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">Daily Target</span>
                  <p className="text-xs sm:text-sm font-black text-gold mt-0.5 sm:mt-1">
                    {playerStats.todayCount} / {dailyTarget}
                    <span className="text-[9px] sm:text-[10px] text-slate-450 block mt-0.5">({Math.min(100, Math.round((playerStats.todayCount / dailyTarget) * 100))}%)</span>
                  </p>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">Weekly Target</span>
                  <p className="text-xs sm:text-sm font-black text-gold mt-0.5 sm:mt-1">
                    {playerStats.weeklyCount} / {weeklyTarget}
                    <span className="text-[9px] sm:text-[10px] text-slate-450 block mt-0.5">({Math.min(100, Math.round((playerStats.weeklyCount / weeklyTarget) * 100))}%)</span>
                  </p>
                </div>
              </div>

              {/* Quality Distribution */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-350 uppercase mb-3">Chest Quality Share</h3>
                {playerStats.total === 0 ? (
                  <p className="text-xs text-slate-500">No scanned chests recorded for this player.</p>
                ) : (
                  <div className="flex flex-col gap-3 text-xs">
                    {/* Epic Crypt */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-purple-400">Epic Crypt</span>
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
                        <span className="font-bold text-blue-400">Rare Crypt</span>
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
                        <span className="font-bold text-green-400">Common Crypt</span>
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
                        <span className="font-bold text-cyan-400">Citadel</span>
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
                        <span className="font-bold text-slate-400">Other</span>
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
                <h3 className="text-xs font-bold text-slate-350 uppercase mb-3">Sources Contributed</h3>
                {Object.keys(sourceCounts).length === 0 ? (
                  <p className="text-xs text-slate-500">No source data available.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(sourceCounts).map(([source, count]) => (
                      <span key={source} className="bg-slate-950 border border-slate-900 px-2.5 py-1 rounded-lg text-xs text-slate-300">
                        {source}: <strong className="text-gold">{count}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Drops */}
              <div>
                <h3 className="text-xs font-bold text-slate-350 uppercase mb-3">Recent Scan Activity (Last 10)</h3>
                {playerChests.length === 0 ? (
                  <p className="text-xs text-slate-500">No recent activity.</p>
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
            </div>
          </div>
        );
      })()}
    </main>
  );
}
