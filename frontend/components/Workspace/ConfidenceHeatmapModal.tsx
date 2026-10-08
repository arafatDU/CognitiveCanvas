'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, Info, ExternalLink, Sparkles } from 'lucide-react';
import { CanvasNode } from '@/store/useMemoletStore';
import { CitationBadge } from './CitationBadge';
import { cn } from '@/lib/utils';

export interface HeatmapMessageData {
  id?: string;
  role: 'user' | 'ai';
  content: string;
  model?: string;
  citations?: string[];
  sentences?: string[];
  confidenceHeatmap?: number[];
  sentenceCitations?: string[][];
}

interface ConfidenceHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: HeatmapMessageData | null;
  nodes: CanvasNode[];
}

export function ConfidenceHeatmapModal({
  isOpen,
  onClose,
  message,
  nodes,
}: ConfidenceHeatmapModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  const sentences = message.sentences && message.sentences.length > 0
    ? message.sentences
    : [message.content];

  const scores = message.confidenceHeatmap && message.confidenceHeatmap.length === sentences.length
    ? message.confidenceHeatmap
    : sentences.map(() => 0.5);

  const sentenceCitations = message.sentenceCitations || [];

  const avgScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
    : 0;

  const highCount = scores.filter((s) => s >= 0.7).length;
  const modCount = scores.filter((s) => s >= 0.45 && s < 0.7).length;
  const lowCount = scores.filter((s) => s < 0.45).length;

  const activeSentence = selectedIndex !== null ? sentences[selectedIndex] : null;
  const activeScore = selectedIndex !== null ? scores[selectedIndex] : null;
  const activeCites = selectedIndex !== null && sentenceCitations[selectedIndex]
    ? sentenceCitations[selectedIndex]
    : [];

  const matchingNode = activeCites.length > 0
    ? nodes.find((n) => n.id === activeCites[0] || n.data?.displayId === activeCites[0])
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-linear-to-r from-amber-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shadow-2xs">
              🔥
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Grounding & Confidence Heatmap
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                  {message.model || 'LLM Response'}
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                Sentence-level semantic verification against your active memory canvas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metric Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3.5 bg-gray-50/80 border-b border-gray-200/70 text-xs">
          <div className="flex flex-col">
            <span className="text-gray-500 font-medium">Overall Grounding</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-extrabold text-gray-900">{avgScore}%</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${avgScore}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <div className="font-bold">{highCount} sentences</div>
              <div className="text-[10px] text-emerald-700">Strong Grounding (≥70%)</div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <div>
              <div className="font-bold">{modCount} sentences</div>
              <div className="text-[10px] text-amber-700">Moderate Grounding (45-69%)</div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-800">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
            <div>
              <div className="font-bold">{lowCount} sentences</div>
              <div className="text-[10px] text-gray-500">Ungrounded (&lt;45%)</div>
            </div>
          </div>
        </div>

        {/* Modal Body: Split View (Interactive Sentences + Inspector Panel) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          {/* Left Column: Sentences List */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Click a sentence to inspect supporting memory evidence:
            </div>

            {sentences.map((sent, i) => {
              const score = scores[i] ?? 0.5;
              const pct = Math.round(score * 100);
              const cites = sentenceCitations[i] || [];
              const isSelected = selectedIndex === i;

              let badgeColor = 'bg-gray-100 text-gray-700 border-gray-300';
              let bgTint = 'hover:bg-gray-50/80 border-gray-200 text-gray-800';
              if (score >= 0.7) {
                badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                bgTint = 'bg-emerald-50/40 border-emerald-200 text-emerald-950 hover:bg-emerald-50';
              } else if (score >= 0.45) {
                badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                bgTint = 'bg-amber-50/40 border-amber-200 text-amber-950 hover:bg-amber-50';
              }

              return (
                <div
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={cn(
                    'group relative p-3 rounded-xl border text-sm leading-relaxed cursor-pointer transition-all',
                    bgTint,
                    isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md scale-[1.01]' : 'shadow-2xs'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex-1 font-normal select-text">{sent}</p>
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      <span className={cn('text-[11px] font-mono font-bold px-1.5 py-0.5 rounded border', badgeColor)}>
                        {pct}%
                      </span>
                      {cites.map((cId, cIdx) => {
                        const cNode = nodes.find((n) => n.id === cId || n.data?.displayId === cId);
                        const display = cNode?.data?.displayId ?? cId.substring(0, 4);
                        return <CitationBadge key={cIdx} displayId={display} className="pointer-events-none" />;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Grounding Inspector Drawer */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="sticky top-0 bg-gray-50/90 border border-gray-200 rounded-xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Evidence Inspector
                </span>
                {activeScore !== null && (
                  <span
                    className={cn(
                      'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                      activeScore >= 0.7
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : activeScore >= 0.45
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                    )}
                  >
                    {Math.round(activeScore * 100)}% Match
                  </span>
                )}
              </div>

              {selectedIndex === null ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <Info className="w-8 h-8 mx-auto text-gray-300" />
                  <p className="text-xs font-medium">Click on any sentence on the left to inspect its grounding verification.</p>
                </div>
              ) : (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-gray-400 font-semibold block text-[10px] uppercase">Selected Statement</label>
                    <p className="mt-1 text-gray-800 italic bg-white p-2.5 rounded-lg border border-gray-200 leading-normal">
                      "{activeSentence}"
                    </p>
                  </div>

                  <div>
                    <label className="text-gray-400 font-semibold block text-[10px] uppercase">Grounding Analysis</label>
                    <div className="mt-1">
                      {activeScore! >= 0.7 ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 leading-normal">
                          ✅ <strong>High Factuality:</strong> This sentence is directly grounded in context from active memory nodes on your canvas.
                        </div>
                      ) : activeScore! >= 0.45 ? (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 leading-normal">
                          💡 <strong>Partial Synthesis:</strong> The model combined memory concepts with generalized architectural patterns.
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 leading-normal">
                          ℹ️ <strong>Ungrounded / Parametric Knowledge:</strong> Sourced from the model's base training weights rather than specific memory nodes.
                        </div>
                      )}
                    </div>
                  </div>

                  {matchingNode ? (
                    <div>
                      <label className="text-gray-400 font-semibold block text-[10px] uppercase">
                        Matched Memory Node
                      </label>
                      <div className="mt-1 p-2.5 rounded-lg bg-white border border-gray-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <CitationBadge displayId={matchingNode.data?.displayId || matchingNode.id.slice(0, 4)} />
                          {matchingNode.data?.keywords && (
                            <span className="text-[10px] text-gray-400">
                              {matchingNode.data.keywords.slice(0, 3).join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 line-clamp-4 text-[11px] font-mono leading-relaxed bg-gray-50 p-2 rounded border border-gray-100">
                          {matchingNode.data?.summary || matchingNode.data?.text || 'No preview text'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    activeCites.length > 0 && (
                      <div>
                        <label className="text-gray-400 font-semibold block text-[10px] uppercase">Cited Memolet ID</label>
                        <div className="mt-1 font-mono text-xs bg-gray-100 p-2 rounded">
                          {activeCites[0]}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
