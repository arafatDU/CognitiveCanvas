'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { memoriesApi, parseMemoletText, splitIntoPairs, type MemoletDTO, getNextDisplayId } from '@/lib/api';
import { cn } from '@/lib/utils';
import { X, Search, CheckCircle, Database, ChevronRight, FileText, AlertTriangle, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Inline DocViewer (right panel inside overlay) ──────────────────────────

function MemoryDocViewer({
  memolet,
  onClose,
  onDelete,
  deleting,
}: {
  memolet: MemoletDTO;
  onClose: () => void;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}) {
  const parsed = parseMemoletText(memolet.text);
  const pairs = splitIntoPairs(memolet.text);
  const tabs = pairs.length > 0 ? pairs : [{ label: 'Pair 1', ...parsed, raw: memolet.text, isStructured: parsed.isStructured }];
  const isMultiPair = pairs.length > 1;

  const [activeTab, setActiveTab] = useState(0);

  // Reset tab when viewing a different memory
  useEffect(() => {
    setActiveTab(0);
  }, [memolet.id]);

  const tab = tabs[activeTab] ?? tabs[0];

  return (
    <div className="w-[360px] flex-shrink-0 flex flex-col h-full bg-white dark:bg-[#0f172a] border-l border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in slide-in-from-right duration-200 transition-colors">
      {/* Panel header */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-[#161f30] border-b border-gray-200 dark:border-slate-800 px-4 py-3">
        <div className="font-semibold text-sm text-gray-700 dark:text-slate-200 flex items-center gap-2">
          <FileText size={14} className="text-blue-500" />
          Document View
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
          title="Close Doc Viewer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Episode Overview for Multi-Pair Memolets */}
      {isMultiPair && parsed.summary && (
        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/60 px-4 py-2.5 text-xs flex-shrink-0">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-200 mb-0.5">
            <span>📚</span>
            <span>Session Episode Overview:</span>
          </div>
          <p className="text-indigo-900 dark:text-indigo-300 text-[11px] leading-relaxed line-clamp-3">
            {parsed.summary}
          </p>
        </div>
      )}

      {/* Tabs (one per pair) */}
      <div className="flex bg-[#f3f4f6] dark:bg-[#161f30]/80 border-b border-gray-200 dark:border-slate-800 text-xs font-medium px-2 overflow-x-auto flex-shrink-0">
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={cn(
              'py-2.5 px-4 whitespace-nowrap transition cursor-pointer',
              activeTab === i
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 bg-white dark:bg-[#0f172a]'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            )}
          >
            {t.label}
            {tabs.length > 1 && (
              <span className="ml-1 text-[9px] text-gray-400 dark:text-slate-500">
                {i + 1}/{tabs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 bg-[#fdfdfd] dark:bg-[#090d16] space-y-5 transition-colors">
        {memolet.is_deprecated && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 mb-1">
              <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>Outdated Advice Detected</span>
            </div>
            {memolet.deprecation_reason && (
              <p className="text-amber-800 dark:text-amber-200 text-[11px] leading-tight mb-1 font-medium">{memolet.deprecation_reason}</p>
            )}
            {memolet.suggested_update && (
              <p className="text-gray-700 dark:text-slate-200 text-[11px] leading-tight">
                <span className="font-semibold text-amber-900 dark:text-amber-300">Modern: </span>{memolet.suggested_update}
              </p>
            )}
          </div>
        )}
        {tab.isStructured ? (
          <>
            {tab.summary && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-400 dark:border-blue-500 p-4 rounded-r-lg shadow-sm">
                <h4 className="text-[10px] font-bold text-blue-800 dark:text-blue-300 mb-1 uppercase tracking-wider">
                  Summary
                </h4>
                <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">{tab.summary}</p>
              </div>
            )}
            {tab.user && (
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wider">
                  User
                </h4>
                <div className="bg-gray-100/80 dark:bg-[#1e293b] p-4 rounded-xl text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">
                  {tab.user}
                </div>
              </div>
            )}
            {tab.ai && (
              <div>
                <h4 className="text-[10px] font-bold text-blue-500 dark:text-blue-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  AI Response
                </h4>
                <div className="border border-gray-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-4 rounded-xl shadow-sm text-sm text-gray-800 dark:text-slate-200 whitespace-normal leading-relaxed prose prose-sm prose-blue dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {tab.ai}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {tab.raw || memolet.text}
          </div>
        )}
      </div>

      {onDelete && (
        <div className="p-3 bg-gray-50 dark:bg-[#161f30] border-t border-gray-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
            {memolet.id.substring(0, 8)}...
          </span>
          <button
            type="button"
            onClick={() => onDelete(memolet.id)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white bg-red-50 dark:bg-red-950/40 hover:bg-red-600 dark:hover:bg-red-600 border border-red-200 dark:border-red-800 hover:border-red-600 rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={12} className={deleting ? 'animate-spin' : ''} />
            <span>{deleting ? 'Deleting...' : 'Delete Memory'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Overlay ────────────────────────────────────────────────────────────

export default function GetMemoryOverlay() {
  const { leftSidebarOpen, setLeftSidebarOpen, setNodes, nodes, memoriesNeedsSync, setMemoriesNeedsSync, removeMemolet } = useMemoletStore();

  const [allMemories, setAllMemories] = useState<MemoletDTO[]>([]);
  const [displayMemories, setDisplayMemories] = useState<MemoletDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [bins, setBins] = useState(12);
  const [clusters, setClusters] = useState(5);
  const [selectedMemory, setSelectedMemory] = useState<MemoletDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteMemory = useCallback(
    async (id: string) => {
      const confirmed = window.confirm(
        'Are you sure you want to permanently delete this memory? It will be removed from the database and GraphRAG knowledge graph.'
      );
      if (!confirmed) return;

      setDeletingId(id);
      try {
        await memoriesApi.delete(id);
        setAllMemories((prev) => prev.filter((m) => m.id !== id));
        setDisplayMemories((prev) => prev.filter((m) => m.id !== id));
        if (selectedMemory?.id === id) {
          setSelectedMemory(null);
        }
        removeMemolet(id);
        setMemoriesNeedsSync(true);
      } catch (err) {
        console.error('Failed to delete memory:', err);
        alert('Failed to delete memory. Please check server logs.');
      } finally {
        setDeletingId(null);
      }
    },
    [selectedMemory, removeMemolet, setMemoriesNeedsSync]
  );

  // Load all memories when overlay opens
  useEffect(() => {
    if (!leftSidebarOpen) return;
    setLoading(true);
    memoriesApi.getAll()
      .then((data) => {
        setAllMemories(data);
        setDisplayMemories(data);
        setMemoriesNeedsSync(false);
      })
      .catch((err) => console.error('Failed to load memolets:', err))
      .finally(() => setLoading(false));
  }, [leftSidebarOpen, memoriesNeedsSync, setMemoriesNeedsSync]);

  // Instant client-side filter + Debounced GraphRAG search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setDisplayMemories(allMemories);
      setSearching(false);
      return;
    }

    // Step 1: Immediate local filter (<1ms) so the UI responds instantly without any lag
    const qLower = trimmed.toLowerCase();
    const tokens = qLower.split(/\s+/).filter((t) => t.length >= 2);
    const localFiltered = allMemories.filter((m) => {
      const text = (m.text || '').toLowerCase();
      const kws = (m.keywords || []).map((k) => k.toLowerCase());
      if (text.includes(qLower) || kws.some((k) => k.includes(qLower))) return true;
      if (tokens.length > 0 && tokens.some((t) => kws.some((k) => k.includes(t)) || text.includes(t))) {
        return true;
      }
      return false;
    });
    localFiltered.sort((a, b) => {
      const aText = (a.text || '').toLowerCase();
      const bText = (b.text || '').toLowerCase();
      const aExact = aText.includes(qLower) ? 1 : 0;
      const bExact = bText.includes(qLower) ? 1 : 0;
      return bExact - aExact;
    });
    setDisplayMemories(localFiltered);

    // Step 2: Background GraphRAG search with AbortController to enrich and confirm rankings
    const controller = new AbortController();
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await memoriesApi.search(trimmed, controller.signal);
        if (results && results.length > 0) {
          setDisplayMemories(results);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      controller.abort();
    };
  }, [searchQuery, allMemories]);

  // Must be defined BEFORE any conditional return to satisfy React rules of hooks
  const handleAddToSandbox = useCallback(
    (memolet: MemoletDTO) => {
      const isAlreadyInCanvas = nodes.some((n) => n.id === memolet.id);
      if (!isAlreadyInCanvas) {
        const parsed = parseMemoletText(memolet.text);
        const displayId = getNextDisplayId(nodes);
        const newNode = {
          id: memolet.id,
          type: 'memolet' as const,
          position: {
            x: Math.floor((Math.random() * 500 + 100) / 160) * 160,
            y: Math.floor((Math.random() * 400 + 100) / 160) * 160,
          },
          data: {
            text: memolet.text || '',
            keywords: memolet.keywords || [],
            color: memolet.color || '#e0f2fe',
            weight: memolet.weight || 1,
            summary: parsed.summary,
            displayId: displayId,
            isTimeSensitive: memolet.is_time_sensitive,
            deprecationRisk: memolet.deprecation_risk,
            temporalAnchor: memolet.temporal_anchor,
            validityHorizonDays: memolet.validity_horizon_days,
            isDeprecated: memolet.is_deprecated,
            deprecationReason: memolet.deprecation_reason,
            suggestedUpdate: memolet.suggested_update,
          },
          style: { width: 160, height: 160 },
        };
        setNodes([...nodes, newNode as any]);
      }
    },
    [nodes, setNodes]
  );

  if (!leftSidebarOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/30 dark:bg-black/60 backdrop-blur-sm flex justify-start">
      <div className="w-[88vw] h-full bg-white dark:bg-[#0f172a] shadow-2xl flex flex-col border-r border-gray-200 dark:border-slate-800 animate-in slide-in-from-left duration-300 transition-colors">

        {/* ── Top Navbar ── */}
        <div className="flex items-center gap-4 p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-[#1e293b]/60 shadow-sm flex-shrink-0">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 w-80 shadow-inner focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900 transition">
            <Search size={15} className={cn('text-gray-400', searching && 'animate-pulse text-blue-400')} />
            <input
              type="text"
              placeholder="GraphRAG search memories…"
              className="flex-1 outline-none text-sm bg-transparent placeholder:text-gray-400 dark:placeholder:text-slate-500 text-gray-800 dark:text-slate-100"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-300 hover:text-gray-500 transition">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-5 border-l border-gray-200 dark:border-slate-700 pl-4 text-sm text-gray-600 dark:text-slate-300 font-medium">
            <label className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-slate-400">Bins:</span>
              <input type="range" min="1" max="20" value={bins} onChange={(e) => setBins(Number(e.target.value))} className="w-20 accent-blue-500" />
              <span className="w-5 text-blue-600 dark:text-blue-400 font-bold text-xs">{bins}</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-slate-400">Clusters:</span>
              <input type="range" min="1" max="10" value={clusters} onChange={(e) => setClusters(Number(e.target.value))} className="w-20 accent-blue-500" />
              <span className="w-5 text-blue-600 dark:text-blue-400 font-bold text-xs">{clusters}</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-semibold rounded-lg text-xs transition">
              Select All
            </button>
            <button className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg text-xs shadow-sm transition">
              Apply
            </button>
            {/* ── Close Memory Button (prominently in navbar) ── */}
            <button
              onClick={() => setLeftSidebarOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-semibold rounded-lg text-xs border border-red-200 dark:border-red-900/60 transition cursor-pointer"
            >
              <X size={13} />
              Close Memory
            </button>
          </div>
        </div>

        {/* ── Body: Canvas + DocViewer ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Canvas + Retrieved list */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Static Canvas Area */}
            <div className="flex-1 relative bg-[#fafafa] dark:bg-[#0c121e] overflow-hidden transition-colors">
              <div
                className="absolute inset-0 opacity-[0.04] dark:opacity-[0.1]"
                style={{
                  backgroundImage:
                    'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Database className="w-8 h-8 text-blue-400 animate-pulse" />
                  <p className="text-sm font-semibold text-gray-400 dark:text-slate-400 tracking-wider">Syncing Database…</p>
                </div>
              ) : displayMemories.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-slate-500">
                  <Database size={32} className="opacity-30" />
                  <p className="text-sm font-semibold">
                    {searchQuery ? `No results for "${searchQuery}"` : 'No memories found.'}
                  </p>
                  <p className="text-xs">Memories you save from chat will appear here.</p>
                </div>
              ) : (
                <div className="absolute inset-0 p-6 overflow-auto">
                  <div className="relative min-w-[1200px] min-h-[600px]">
                    {displayMemories.map((m, i) => {
                      const isActive = nodes.some((n) => n.id === m.id);
                      const isSelected = selectedMemory?.id === m.id;
                      const x = (i % 7) * 170 + 40;
                      const y = Math.floor(i / 7) * 130 + 40;
                      const parsed = parseMemoletText(m.text);

                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMemory(isSelected ? null : m);
                          }}
                          className={cn(
                            'absolute p-3 rounded-xl border shadow-sm cursor-pointer transition-all hover:scale-105 hover:shadow-md overflow-hidden flex flex-col gap-1 w-40 h-28',
                            isSelected
                              ? 'bg-blue-100 dark:bg-blue-950/90 border-blue-500 shadow-blue-200 dark:shadow-blue-950 scale-105'
                              : isActive
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-700 shadow-blue-100 dark:shadow-blue-950/40'
                              : 'bg-white dark:bg-[#161f30] border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                          )}
                          style={{ left: x, top: y, borderLeftColor: m.color || undefined, borderLeftWidth: 3 }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-gray-500 dark:text-slate-400">
                              {nodes.find((n) => n.id === m.id)?.data.displayId ?? m.displayId ?? `#${m.id.substring(0, 6)}`}
                            </span>
                            <div className="flex items-center gap-1">
                              {m.text?.includes('---PAIR---') && (
                                <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 px-1 rounded">
                                  {splitIntoPairs(m.text).length} Pairs
                                </span>
                              )}
                              {m.is_deprecated && (
                                <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-1 rounded" title={m.deprecation_reason || "Outdated advice"}>
                                  ⚠️
                                </span>
                              )}
                              {isActive && <CheckCircle size={10} className="text-blue-500" />}
                              {isSelected && <ChevronRight size={10} className="text-blue-600" />}
                            </div>
                          </div>
                          {parsed.summary ? (
                            <p className="text-[10px] font-medium text-gray-600 dark:text-slate-300 leading-tight line-clamp-3">
                              {parsed.summary}
                            </p>
                          ) : (
                            <p className="text-[10px] font-medium text-gray-600 dark:text-slate-300 leading-tight line-clamp-3">
                              {m.keywords?.join(', ') || m.text}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Retrieved Sentences Sub-panel */}
            <div className="h-56 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] flex flex-col flex-shrink-0 transition-colors">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-[#161f30]">
                <h3 className="text-xs font-bold text-gray-700 dark:text-slate-200">
                  Retrieved Memories ({displayMemories.length})
                  {searching && <span className="ml-2 text-blue-400 font-normal">Searching…</span>}
                </h3>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {displayMemories.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center text-gray-400 dark:text-slate-500">
                    <Database size={22} className="mb-2 text-gray-300 dark:text-slate-600" />
                    <p className="text-xs font-medium">
                      {searchQuery ? `No memories matching "${searchQuery}"` : 'No memories found in database'}
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-1.5 text-[11px] text-blue-500 hover:underline cursor-pointer"
                      >
                        Reset search
                      </button>
                    )}
                  </div>
                ) : (
                  displayMemories.map((m) => {
                    const parsed = parseMemoletText(m.text);
                    const canvasNode = nodes.find((n) => n.id === m.id);
                    const badgeText = canvasNode?.data.displayId ?? m.displayId ?? `#${m.id.substring(0, 6)}`;
                    return (
                      <div
                        key={m.id}
                        className="group flex flex-col gap-1.5 p-3 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex bg-blue-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wide">
                              {badgeText}
                            </span>
                            {m.text?.includes('---PAIR---') && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded">
                                📚 {splitIntoPairs(m.text).length} Pairs
                              </span>
                            )}
                            {m.is_deprecated && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded-full" title={m.deprecation_reason || "Outdated advice"}>
                                <AlertTriangle size={10} />
                                Stale
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAddToSandbox(m)}
                              className={cn(
                                "text-[11px] font-semibold transition cursor-pointer",
                                nodes.some((n) => n.id === m.id)
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-blue-600 dark:text-blue-400 hover:text-blue-700 opacity-0 group-hover:opacity-100"
                              )}
                            >
                              {nodes.some((n) => n.id === m.id) ? '✓ Added' : '+ Add to Canvas'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMemory(m.id);
                              }}
                              disabled={deletingId === m.id}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer disabled:opacity-50"
                              title="Permanently delete from database & GraphRAG"
                            >
                              <Trash2 size={13} className={deletingId === m.id ? 'animate-spin' : ''} />
                            </button>
                          </div>
                        </div>
                        {parsed.summary && (
                          <p className="text-xs text-gray-700 dark:text-slate-200 font-medium line-clamp-2">{parsed.summary}</p>
                        )}
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">
                          [{m.keywords?.map((k) => `'${k}'`).join(', ')}]
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Inline DocViewer ── */}
          {selectedMemory && (
            <MemoryDocViewer
              memolet={selectedMemory}
              onClose={() => setSelectedMemory(null)}
              onDelete={handleDeleteMemory}
              deleting={deletingId === selectedMemory.id}
            />
          )}
        </div>
      </div>

      {/* ── Side tab handle (secondary close) ── */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2" style={{ left: '88vw' }}>
        <button
          onClick={() => setLeftSidebarOpen(false)}
          className="flex flex-col items-center gap-2 py-6 px-1.5 bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-slate-800 border-l-0 rounded-r-xl shadow-md text-gray-400 dark:text-slate-400 hover:text-red-500 hover:pl-2 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
        >
          <X size={14} className="mb-2" />
          <span className="[writing-mode:vertical-rl] text-[10px] font-bold tracking-widest uppercase">
            Close Memory
          </span>
        </button>
      </div>
    </div>
  );
}
