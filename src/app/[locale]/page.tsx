"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  MessageSquare
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

interface PlayerContribution {
  player: string;
  total: number;
  legendary: number;
  epic: number;
  rare: number;
  common: number;
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

export default function Dashboard() {
  const t = useTranslations('Dashboard');
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
  const getFilteredChests = () => {
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
  };

  const chests = getFilteredChests();
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
  const getPlayerContributions = () => {
    const contributions: Record<string, {
      total: number;
      legendary: number;
      epic: number;
      rare: number;
      common: number;
      sources: Record<string, number>;
      todayCount: number;
      weeklyCount: number;
    }> = {};

    const now = new Date();
    const todayGameDayStr = getUTC10GameDayStr(now);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Initialize whitelisted players with 0 stats
    players.forEach(p => {
      contributions[p] = { total: 0, legendary: 0, epic: 0, rare: 0, common: 0, sources: {}, todayCount: 0, weeklyCount: 0 };
    });

    // Aggregate drops from scanned chests
    chests.forEach((chest) => {
      const p = chest.fromPlayer || "Unknown";
      if (!contributions[p]) {
        contributions[p] = { total: 0, legendary: 0, epic: 0, rare: 0, common: 0, sources: {}, todayCount: 0, weeklyCount: 0 };
      }
      contributions[p].total += 1;

      const src = chest.source || "Other";
      contributions[p].sources[src] = (contributions[p].sources[src] || 0) + 1;

      const name = chest.chestName.toLowerCase();
      if (name.includes("legendary") || name.includes("gold")) {
        contributions[p].legendary += 1;
      } else if (name.includes("epic")) {
        contributions[p].epic += 1;
      } else if (name.includes("rare") || name.includes("crypt")) {
        contributions[p].rare += 1;
      } else {
        contributions[p].common += 1;
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
      .sort((a, b) => b.total - a.total);
  };

  const handleExportCSV = (contributionsList: PlayerContribution[]) => {
    const headers = ["Rank", "Player Name", "Legendary (Gold)", "Epic (Dragon)", "Rare (Crypt)", "Common", "Source Breakdown", "Total Drops", "Daily Target (20) Status", "Weekly Target (150) Status"];
    const rows = contributionsList.map((item, idx) => {
      const dailyStatus = item.todayCount >= dailyTarget ? "Target Met" : `${item.todayCount}/${dailyTarget}`;
      const weeklyStatus = item.weeklyCount >= weeklyTarget ? "Target Met" : `${item.weeklyCount}/${weeklyTarget}`;
      const sourceStr = Object.entries(item.sources || {})
        .map(([src, count]) => `${src}: ${count}`)
        .join(" | ");
      return [
        idx + 1,
        `"${item.player.replace(/"/g, '""')}"`,
        item.legendary,
        item.epic,
        item.rare,
        item.common,
        `"${sourceStr.replace(/"/g, '""')}"`,
        item.total,
        `"${dailyStatus}"`,
        `"${weeklyStatus}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `elf_clan_chest_contributions_${filterDateRange}_${filterSource}.csv`);
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
      return { bg: "rgba(223, 178, 57, 0.1)", border: "rgba(223, 178, 57, 0.35)", text: "#dfb239", textGlow: "text-gold-bright" };
    }
    if (n.includes("epic") || n.includes("dragon")) {
      return { bg: "rgba(147, 51, 234, 0.08)", border: "rgba(147, 51, 234, 0.35)", text: "#c084fc", textGlow: "text-purple-400" };
    }
    if (n.includes("rare") || n.includes("crypt") || n.includes("captain")) {
      return { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.35)", text: "#60a5fa", textGlow: "text-blue-400" };
    }
    if (n.includes("heroic") || n.includes("clan")) {
      return { bg: "rgba(6, 182, 212, 0.08)", border: "rgba(6, 182, 212, 0.35)", text: "#22d3ee", textGlow: "text-cyan-400" };
    }
    return { bg: "rgba(34, 197, 94, 0.05)", border: "rgba(34, 197, 94, 0.2)", text: "#4ade80", textGlow: "text-green-400" };
  };

  // STATISTICS CALCULATIONS
  const totalChests = chests.length;

  // Calculate active scanners (distinct players in scanned list)
  const activeScanners = Array.from(new Set(chests.map((c) => c.fromPlayer))).length;

  const getDailyAverage = () => {
    if (chests.length === 0) return 0;
    const dates = chests.map((c) => c.gameDay);
    const uniqueDays = Array.from(new Set(dates)).length || 1;
    return Math.round(chests.length / uniqueDays);
  };
  const dailyAverage = getDailyAverage();

  // Whitelist filtering
  const filteredPlayers = players.filter((p) =>
    p.toLowerCase().includes(playerSearchQuery.toLowerCase())
  );

  // Custom Chart: Chest Rarity Share
  const getRarityStats = () => {
    let legendary = 0, epic = 0, rare = 0, heroic = 0, common = 0;
    chests.forEach((c) => {
      const colorStyle = getChestColor(c.chestName);
      if (colorStyle.text === "#dfb239") legendary++;
      else if (colorStyle.text === "#c084fc") epic++;
      else if (colorStyle.text === "#60a5fa") rare++;
      else if (colorStyle.text === "#22d3ee") heroic++;
      else common++;
    });
    return { legendary, epic, rare, heroic, common };
  };
  const rarityStats = getRarityStats();

  return (
    <main className="min-h-screen bg-[#030307] text-[#f8fafc] font-sans antialiased p-2.5 sm:p-4 md:p-8">
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gold">{t('title')}</h1>
            <p className="text-xs text-slate-400 font-medium">{t('subtitle')}</p>
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
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 md:mb-8">
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
            <span className={`text-lg sm:text-2xl md:text-3xl font-black ${unknownPlayers.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {unknownPlayers.length}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400">pending</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
            <ShieldAlert className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${unknownPlayers.length > 0 ? "text-rose-450" : "text-emerald-400"}`} />
            <span>Unknown names flagged</span>
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
                chests.map((chest, index) => {
                  const style = getChestColor(chest.chestName);
                  return (
                    <div
                      key={chest.id}
                      style={{
                        backgroundColor: style.bg,
                        borderColor: style.border
                      }}
                      className={`border p-3 sm:p-4 rounded-xl relative transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 ${index === 0 ? "animate-scan-card" : ""
                        }`}
                    >
                      {/* Left Block */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-base font-bold tracking-tight ${style.textGlow}`}>
                            {chest.chestName}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800 text-slate-400">
                            {chest.source}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                          <span>Claimed by:</span>
                          <span className="font-semibold text-slate-300">{chest.fromPlayer}</span>
                        </div>
                      </div>

                      {/* Right Block */}
                      <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 text-right">
                        <div className="text-xs text-slate-300 font-medium">
                          {formatUTC10Time(chest.time)}
                          <span className="text-[10px] text-slate-550 ml-1.5">
                            ({chest.gameDay})
                          </span>
                        </div>
                        {chest.originalTimer && (
                          <div className="text-[10px] text-slate-550 font-mono">
                            OCR Timer: {chest.originalTimer}
                          </div>
                        )}
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
              <h2 className="text-sm font-bold tracking-wider text-slate-300 mb-3.5 sm:mb-4 uppercase">CHEST QUALITY SHARE</h2>

              {chests.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                  Waiting for database records to map analytics...
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 text-xs">
                  {/* Legendary Progress */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-gold">LEGENDARY / GOLD</span>
                      <span className="font-mono text-slate-300">
                        {rarityStats.legendary} ({Math.round((rarityStats.legendary / chests.length) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(rarityStats.legendary / chests.length) * 100}%` }}
                        className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Epic Progress */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-purple-400">EPIC / DRAGON</span>
                      <span className="font-mono text-slate-300">
                        {rarityStats.epic} ({Math.round((rarityStats.epic / chests.length) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(rarityStats.epic / chests.length) * 100}%` }}
                        className="bg-gradient-to-r from-purple-500 to-purple-400 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Rare Progress */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-blue-400">RARE / CRYPT</span>
                      <span className="font-mono text-slate-300">
                        {rarityStats.rare} ({Math.round((rarityStats.rare / chests.length) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(rarityStats.rare / chests.length) * 100}%` }}
                        className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Heroic Progress */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-cyan-400">HEROIC / CLAN</span>
                      <span className="font-mono text-slate-300">
                        {rarityStats.heroic} ({Math.round((rarityStats.heroic / chests.length) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(rarityStats.heroic / chests.length) * 100}%` }}
                        className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Common Progress */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-green-400">COMMON</span>
                      <span className="font-mono text-slate-300">
                        {rarityStats.common} ({Math.round((rarityStats.common / chests.length) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(rarityStats.common / chests.length) * 100}%` }}
                        className="bg-gradient-to-r from-green-500 to-green-400 h-full rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Top Contributor list */}
            <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex-1 overflow-hidden flex flex-col max-h-[350px]">
              <h2 className="text-sm font-bold tracking-wider text-slate-300 mb-3 uppercase">TOP ACTIVE SCANNERS</h2>
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 text-xs">
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
        const contributionsList = getPlayerContributions();
        const topContributor = contributionsList[0]?.player || "None";
        const topContributorCount = contributionsList[0]?.total || 0;
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
                  <span className="text-[10px] sm:text-xs text-amber-500 font-semibold">{topContributorCount} drops</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-slate-400">
                  <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                  <span>Leads the ELF contribution board</span>
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
                <h2 className="text-sm sm:text-base font-bold text-slate-200 uppercase tracking-wide">🏆 ELF MEMBER CONTRIBUTIONS LEADERBOARD</h2>
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
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-16 text-slate-400">Rank</th>
                      <th className="py-3 px-4 text-slate-400">Player Name</th>
                      <th className="py-3 px-4 text-center text-slate-400">Legendary 🥇</th>
                      <th className="py-3 px-4 text-center text-slate-400">Epic 🥈</th>
                      <th className="py-3 px-4 text-center text-slate-400">Rare/Crypt 🥉</th>
                      <th className="py-3 px-4 text-center text-slate-400">Source Breakdown</th>
                      <th className="py-3 px-4 text-center font-bold text-gold text-slate-400">Total Drops</th>
                      <th className="py-3 px-4 text-center text-slate-400 w-32">Daily Target ({dailyTarget})</th>
                      <th className="py-3 px-4 text-center text-slate-400 w-32">Weekly Target ({weeklyTarget})</th>
                      <th className="py-3 px-4 w-40 text-slate-400">Status Level</th>
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
                            <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">
                              {item.legendary > 0 ? `${item.legendary}×` : "-"}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-purple-400">
                              {item.epic > 0 ? `${item.epic}×` : "-"}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-sky-400">
                              {item.rare > 0 ? `${item.rare}×` : "-"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-wrap justify-center gap-1.5 max-w-[200px] mx-auto">
                                {Object.entries(item.sources || {}).map(([src, count]) => {
                                  if (count === 0) return null;
                                  let badgeStyle = "bg-slate-900 border-slate-800 text-slate-400";
                                  if (src === "Monster") badgeStyle = "bg-rose-500/10 border-rose-500/20 text-rose-450";
                                  else if (src === "Crypt") badgeStyle = "bg-sky-500/10 border-sky-500/20 text-sky-400";
                                  else if (src === "PvP") badgeStyle = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                                  else if (src === "Clan") badgeStyle = "bg-emerald-500/10 border-emerald-500/20 text-emerald-450";
                                  return (
                                    <span key={src} className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badgeStyle}`}>
                                      {src}: {count}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-gold text-sm bg-amber-500/5">
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
                        <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[9px] sm:text-[10px] bg-slate-900/30 p-2 rounded-lg sm:rounded-xl border border-slate-900/50">
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Leg 🥇</span>
                            <span className="font-mono font-bold text-amber-400">{item.legendary}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Epic 🥈</span>
                            <span className="font-mono font-bold text-purple-400">{item.epic}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Rare 🥉</span>
                            <span className="font-mono font-bold text-sky-400">{item.rare}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5 text-[8.5px] sm:text-[9px] uppercase tracking-tighter">Total 🏆</span>
                            <span className="font-mono font-bold text-gold text-xs">{item.total}</span>
                          </div>
                        </div>

                        {/* Source breakdown */}
                        {Object.keys(item.sources).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(item.sources).map(([src, count]) => {
                              if (count === 0) return null;
                              let badgeStyle = "bg-slate-900 border-slate-800 text-slate-400";
                              if (src === "Monster") badgeStyle = "bg-rose-500/10 border-rose-500/20 text-rose-450";
                              else if (src === "Crypt") badgeStyle = "bg-sky-500/10 border-sky-500/20 text-sky-400";
                              else if (src === "PvP") badgeStyle = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                              else if (src === "Clan") badgeStyle = "bg-emerald-500/10 border-emerald-500/20 text-emerald-450";
                              return (
                                <span key={src} className={`px-1.5 py-0.5 rounded border text-[8.5px] font-bold ${badgeStyle}`}>
                                  {src}: {count}
                                </span>
                              );
                            })}
                          </div>
                        )}

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
        const contributionsList = getPlayerContributions();
        const playerStats = contributionsList.find(c => c.player === selectedPlayerDetail) || {
          player: selectedPlayerDetail, total: 0, legendary: 0, epic: 0, rare: 0, common: 0, sources: {}, todayCount: 0, weeklyCount: 0
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
                  <p className="text-xs text-slate-400">ELF Clan Member Stats</p>
                </div>
              </div>

              {/* Rarity breakdown */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-6 text-center">
                <div className="bg-slate-950/50 border border-slate-900 rounded-lg sm:rounded-xl p-2 sm:p-3 flex flex-col justify-center">
                  <span className="text-[8.5px] sm:text-[9px] text-slate-550 font-bold uppercase block">Total Scanned</span>
                  <p className="text-base sm:text-xl font-black text-slate-100 mt-0.5 sm:mt-1">{playerStats.total}</p>
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
                  <div className="flex flex-col gap-2 text-xs">
                    {/* Legendary */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-gold">Legendary/Gold</span>
                        <span className="text-slate-400">{playerStats.legendary} ({Math.round((playerStats.legendary / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div style={{ width: `${(playerStats.legendary / playerStats.total) * 100}%` }} className="bg-amber-400 h-full rounded-full" />
                      </div>
                    </div>
                    {/* Epic */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-purple-400">Epic</span>
                        <span className="text-slate-400">{playerStats.epic} ({Math.round((playerStats.epic / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div style={{ width: `${(playerStats.epic / playerStats.total) * 100}%` }} className="bg-purple-500 h-full rounded-full" />
                      </div>
                    </div>
                    {/* Rare */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-blue-400">Rare/Crypt</span>
                        <span className="text-slate-400">{playerStats.rare} ({Math.round((playerStats.rare / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div style={{ width: `${(playerStats.rare / playerStats.total) * 100}%` }} className="bg-blue-500 h-full rounded-full" />
                      </div>
                    </div>
                    {/* Common */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-bold text-green-400">Common</span>
                        <span className="text-slate-400">{playerStats.common} ({Math.round((playerStats.common / playerStats.total) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div style={{ width: `${(playerStats.common / playerStats.total) * 100}%` }} className="bg-green-500 h-full rounded-full" />
                      </div>
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
