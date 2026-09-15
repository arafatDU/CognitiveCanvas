'use client';

import { useState } from 'react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { parseMemoletText, auditorApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { X, FileText, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Splits a memolet's serialized text into multiple pairs if separated by ---PAIR---
 * For single-pair memolets (current format) returns one element.
 */
function splitIntoPairs(text: string) {
  const SEPARATOR = /\n?---PAIR---\n?/;
  const blocks = text.split(SEPARATOR).filter(Boolean);
  return blocks.map((block, i) => ({
    label: blocks.length > 1 ? `Pair ${i + 1}` : 'Doc',
    ...parseMemoletText(block),
    raw: block,
  }));
}

export default function DocViewer() {
  const { nodes, selectedNodeId, setSelectedNodeId, updateMemoletData } = useMemoletStore();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const pairs = selectedNode ? splitIntoPairs(selectedNode.data.text) : [];
  const tab = pairs[activeTab] ?? pairs[0];

  const isDeprecated = selectedNode?.data.isDeprecated;
  const deprecationReason = selectedNode?.data.deprecationReason;
  const suggestedUpdate = selectedNode?.data.suggestedUpdate;
  const temporalAnchor = selectedNode?.data.temporalAnchor;

  const handleRefresh = async () => {
    if (!selectedNode || refreshing) return;
    setRefreshing(true);
    try {
      const res = await auditorApi.refresh(selectedNode.id);
      const parsed = parseMemoletText(res.text);
      updateMemoletData(selectedNode.id, {
        text: res.text,
        summary: res.summary || parsed.summary,
        isDeprecated: false,
        deprecationReason: undefined,
        suggestedUpdate: undefined,
        temporalAnchor: res.temporal_anchor,
      });
    } catch (err) {
      console.error('Failed to refresh memory in DocViewer:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (!selectedNodeId || !selectedNode) {
    return (
      <div className="w-[30%] min-w-[320px] max-w-[460px] flex flex-col h-full bg-white border-l border-gray-200 shadow-sm flex-shrink-0 overflow-hidden transition-all duration-300">
        {/* Empty state header */}
        <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="font-semibold text-sm text-gray-700 flex items-center gap-2">
            <FileText size={14} className="text-gray-400" />
            Document View
          </div>
        </div>
        <div className="flex-1 bg-white flex items-center justify-center text-gray-400 text-sm">
          Select a memolet to view details
        </div>
      </div>
    );
  }

  return (
    <div className="w-[30%] min-w-[320px] max-w-[460px] flex flex-col h-full bg-white border-l border-gray-200 shadow-sm flex-shrink-0 overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="font-semibold text-sm text-gray-700 flex items-center gap-2">
          <FileText size={14} className="text-blue-500" />
          Document View
        </div>
        <button
          onClick={() => {
            setSelectedNodeId(null);
            setActiveTab(0);
          }}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
          title="Close Doc Viewer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs — one per pair */}
      <div className="flex bg-[#f3f4f6] border-b border-gray-200 text-xs font-medium px-2 overflow-x-auto flex-shrink-0">
        {pairs.map((p, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={cn(
              'py-2.5 px-4 whitespace-nowrap transition',
              activeTab === i
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {p.label}
            {pairs.length > 1 && (
              <span className="ml-1 text-[9px] text-gray-400">
                {i + 1}/{pairs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 bg-[#fdfdfd] space-y-5">
        {/* Deprecation Warning & 1-Click Update Banner */}
        {isDeprecated && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                <span>Outdated Advice Detected</span>
              </div>
              {temporalAnchor && (
                <span className="text-[10px] text-amber-800 bg-amber-200/70 font-mono px-2 py-0.5 rounded">
                  {temporalAnchor}
                </span>
              )}
            </div>

            {deprecationReason && (
              <p className="text-xs text-amber-900 leading-relaxed mb-2 font-medium">
                {deprecationReason}
              </p>
            )}

            {suggestedUpdate && (
              <div className="text-xs text-gray-800 bg-white/90 p-2.5 rounded-lg border border-amber-200 mb-3">
                <span className="font-bold text-amber-900">Modern Equivalent: </span>
                <span>{suggestedUpdate}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Updating to Latest...' : 'Update to Latest (1-Click)'}</span>
            </button>
          </div>
        )}

        {!isDeprecated && temporalAnchor && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <Clock size={12} className="text-gray-400" />
            <span>Temporal context: <strong className="text-gray-700">{temporalAnchor}</strong></span>
          </div>
        )}

        {!selectedNode ? (
          <p className="text-sm text-gray-400">Node not found.</p>
        ) : tab?.isStructured ? (
          <div className="space-y-5">
            {/* Summary Block */}
            {tab.summary && (
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm">
                <h4 className="text-[10px] font-bold text-blue-800 mb-1 uppercase tracking-wider">
                  Summary
                </h4>
                <p className="text-sm text-blue-900 leading-relaxed">{tab.summary}</p>
              </div>
            )}

            {/* User Message */}
            <div>
              <h4 className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                User
              </h4>
              <div className="bg-gray-100/80 p-4 rounded-xl text-sm text-gray-800 whitespace-pre-wrap">
                {tab.user}
              </div>
            </div>

            {/* AI Response */}
            <div>
              <h4 className="text-[10px] font-bold text-blue-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                AI Response
              </h4>
              <div className="border border-gray-100 bg-white p-5 rounded-xl shadow-sm text-sm text-gray-800 whitespace-normal leading-relaxed prose prose-sm prose-blue max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {tab.ai}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {tab?.raw ?? selectedNode.data.text}
          </div>
        )}
      </div>
    </div>
  );
}
