"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Users,
  ShieldAlert,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Database,
  ArrowRight,
  Wifi,
  WifiOff,
  Flame,
  Search,
  BookOpen
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

export default function Dashboard() {
  const t = useTranslations('Dashboard');
  const [chests, setChests] = useState<Chest[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
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


  const fetchInitialData = async () => {
    try {
      const [chestsRes, whitelistRes, fixesRes, unknownsRes] = await Promise.all([
        fetch("/api/chests"),
        fetch("/api/whitelist"),
        fetch("/api/player-fixes"),
        fetch("/api/unknown-players"),
      ]);

      const chestsData = await chestsRes.json();
      const whitelistData = await whitelistRes.json();
      const fixesData = await fixesRes.json();
      const unknownsData = await unknownsRes.json();

      setChests(Array.isArray(chestsData) ? chestsData : []);
      setPlayers(Array.isArray(whitelistData.players) ? whitelistData.players : []);
      setFixes(Array.isArray(fixesData) ? fixesData : []);
      setUnknownPlayers(Array.isArray(unknownsData) ? unknownsData : []);
    } catch (e) {
      console.error("Failed to load initial dashboard datasets:", e);
    }
  };


  // Load Initial Data
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Real-Time Player Contributions Aggregation
  const getPlayerContributions = () => {
    const contributions: Record<string, { total: number; legendary: number; epic: number; rare: number; common: number }> = {};

    // Initialize whitelisted players with 0 stats
    players.forEach(p => {
      contributions[p] = { total: 0, legendary: 0, epic: 0, rare: 0, common: 0 };
    });

    // Aggregate drops from scanned chests
    chests.forEach((chest) => {
      const p = chest.fromPlayer || "Unknown";
      if (!contributions[p]) {
        contributions[p] = { total: 0, legendary: 0, epic: 0, rare: 0, common: 0 };
      }
      contributions[p].total += 1;
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

    return Object.entries(contributions)
      .map(([player, stats]) => ({ player, ...stats }))
      .sort((a, b) => b.total - a.total);
  };

  // Play subtle synth ping when a chest scans in real-time
  const playClaimSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  };

  // Setup Server-Sent Events (SSE) Live Feed Subscription
  useEffect(() => {
    let sse: EventSource | null = new EventSource("/api/stream");

    sse.onopen = () => {
      setIsConnected(true);
    };

    sse.onerror = () => {
      setIsConnected(false);
      sse?.close();
      // Retry connection every 5s
      setTimeout(() => {
        setIsConnected(false);
      }, 5000);
    };

    sse.onmessage = (event) => {
      try {
        const newChest: Chest = JSON.parse(event.data);
        setChests((prev) => [newChest, ...prev]);
        playClaimSound();
      } catch (err) {
        console.error("Error parsing Server-Sent Event payload:", err);
      }
    };

    return () => {
      sse?.close();
    };
  }, [soundEnabled]);

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

  // Daily Average Calculator
  const getDailyAverage = () => {
    if (chests.length === 0) return 0;
    const dates = chests.map((c) => new Date(c.time).toDateString());
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
    <main className="min-h-screen bg-[#030307] text-[#f8fafc] font-sans antialiased p-4 md:p-8">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[150px] -z-10 pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* TOP HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 glass-panel-glow p-6 rounded-2xl">
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
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-panel p-5 rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 tracking-wider">TOTAL CHESTS LOGGED</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl md:text-3xl font-black text-slate-100">{totalChests}</span>
            <span className="text-xs text-amber-500 font-semibold">scanned</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
            <Database className="w-3.5 h-3.5 text-amber-500/70" />
            <span>CockroachDB Active</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 tracking-wider">ACTIVE SCANNERS</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl md:text-3xl font-black text-slate-100">{activeScanners}</span>
            <span className="text-xs text-amber-500 font-semibold">players</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
            <Users className="w-3.5 h-3.5 text-amber-500/70" />
            <span>Out of {players.length} whitelisted</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 tracking-wider">DAILY SCAN RATE</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl md:text-3xl font-black text-slate-100">{dailyAverage}</span>
            <span className="text-xs text-amber-500 font-semibold">chests/day</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
            <Activity className="w-3.5 h-3.5 text-amber-500/70" />
            <span>Computed dynamically</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl transition-all hover:border-amber-500/20 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 tracking-wider">MODERATION ALERTS</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl md:text-3xl font-black ${unknownPlayers.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {unknownPlayers.length}
            </span>
            <span className="text-xs font-semibold text-slate-400">pending</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
            <ShieldAlert className={`w-3.5 h-3.5 ${unknownPlayers.length > 0 ? "text-rose-400" : "text-emerald-400"}`} />
            <span>Unknown names flagged</span>
          </div>
        </div>
      </section>

      {/* CORE NAVIGATION TABS */}
      <div className="flex border-b border-slate-800/80 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("live")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all duration-200 ${activeTab === "live"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          Live Scanner Feed
        </button>
        <button
          onClick={() => setActiveTab("contributions")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all duration-200 ${activeTab === "contributions"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          Player Contributions
        </button>
        <button
          onClick={() => setActiveTab("whitelist")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-1.5 ${activeTab === "whitelist"
            ? "border-amber-500 text-gold font-bold"
            : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
        >
          Clan Whitelist
          {unknownPlayers.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
              {unknownPlayers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("corrections")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all duration-200 ${activeTab === "corrections"
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed Grid */}
          <div className="lg:col-span-2 flex flex-col h-[650px] glass-panel rounded-2xl p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
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
                      className={`border p-4 rounded-xl relative transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 ${index === 0 ? "animate-scan-card" : ""
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
                          {new Date(chest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          <span className="text-[10px] text-slate-500 ml-1.5">
                            ({chest.gameDay})
                          </span>
                        </div>
                        {chest.originalTimer && (
                          <div className="text-[10px] text-slate-500 font-mono">
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
          <div className="flex flex-col gap-6">
            {/* Visual SVG Distribution Charts */}
            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-sm font-bold tracking-wider text-slate-300 mb-4 uppercase">CHEST QUALITY SHARE</h2>

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
            <div className="glass-panel rounded-2xl p-5 flex-1 overflow-hidden flex flex-col max-h-[350px]">
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
          <div className="flex flex-col gap-6">
            {/* Highlights Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-xs font-semibold text-slate-400 tracking-wider">🏆 TOP PRODUCER</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-xl md:text-2xl font-black text-gold truncate max-w-[200px]">{topContributor}</span>
                  <span className="text-xs text-amber-500 font-semibold">{topContributorCount} drops</span>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Leads the ELF contribution board</span>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-xs font-semibold text-slate-400 tracking-wider">📊 AVERAGE CONTRIBUTION</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl md:text-3xl font-black text-slate-100">{averageChestsPerPlayer}</span>
                  <span className="text-xs text-amber-500 font-semibold">chests/member</span>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
                  <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                  <span>Calculated across active roster</span>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between hover:border-amber-500/20 transition-all">
                <span className="text-xs font-semibold text-slate-400 tracking-wider">🏹 ACTIVE CONTRIBUTION RATE</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl md:text-3xl font-black text-slate-100">
                    {contributionsList.filter(c => c.total > 0).length}
                  </span>
                  <span className="text-xs text-slate-400">/ {players.length} members active</span>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  <span>Members with at least 1 registered drop</span>
                </div>
              </div>
            </div>

            {/* Leaderboard Grid */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col min-h-[450px]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-200 uppercase tracking-wide">🏆 ELF MEMBER CONTRIBUTIONS LEADERBOARD</h2>
                  <p className="text-xs text-slate-400">Real-time statistics aggregating total monster and crypt chest claims.</p>
                </div>

                {/* Search */}
                <div className="relative">
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

              {/* Table */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 w-16 text-slate-400">Rank</th>
                      <th className="py-3 px-4 text-slate-400">Player Name</th>
                      <th className="py-3 px-4 text-center text-slate-400">Legendary 🥇</th>
                      <th className="py-3 px-4 text-center text-slate-400">Epic 🥈</th>
                      <th className="py-3 px-4 text-center text-slate-400">Rare/Crypt 🥉</th>
                      <th className="py-3 px-4 text-center font-bold text-gold text-slate-400">Total Drops</th>
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
                              {item.player}
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
                            <td className="py-3 px-4 text-center font-mono font-bold text-gold text-sm bg-amber-500/5">
                              {item.total}
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
            </div>
          </div>
        );
      })()}

      {/* 2. TAB: CLAN WHITELIST */}
      {activeTab === "whitelist" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Roster Panel */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-5 flex flex-col h-[550px] overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-200 uppercase tracking-wide">CLAN MEMBER ROSTER ({players.length})</h2>
                <p className="text-xs text-slate-400">Only players in this list will be processed without alerts.</p>
              </div>

              {/* Add and Search inputs */}
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-44"
                  />
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Add player tag..."
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-36"
                  />
                  <button
                    onClick={() => handleAddPlayer(newPlayerName)}
                    className="p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all"
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
                  No clan members matched "{playerSearchQuery}" or roster is empty.
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
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-all"
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
          <div className="glass-panel rounded-2xl p-5 flex flex-col h-[550px] overflow-hidden border-rose-500/15">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Corrections List */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-5 flex flex-col h-[550px] overflow-hidden">
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
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-all flex-shrink-0"
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
          <div className="glass-panel rounded-2xl p-5 flex flex-col h-[320px]">
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
    </main>
  );
}
