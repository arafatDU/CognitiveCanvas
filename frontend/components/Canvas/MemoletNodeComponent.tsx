'use client';
import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer, Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Plus, AlertTriangle, RefreshCw, Clock, GitMerge, Layers } from 'lucide-react';
import { MemoletData, useMemoletStore } from '@/store/useMemoletStore';
import { auditorApi, parseMemoletText, splitIntoPairs } from '@/lib/api';

export type CustomNodeProps = NodeProps<Node<MemoletData, 'memolet'>>;

export const MemoletNodeComponent = memo(({ id, data, selected }: CustomNodeProps) => {
  const [hovered, setHovered] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredPairIdx, setHoveredPairIdx] = useState<number | null>(null);
  
  const updateMemoletData = useMemoletStore((s) => s.updateMemoletData);
  const updateNodeDimensions = useMemoletStore((s) => s.updateNodeDimensions);
  const extractSubMemolet = useMemoletStore((s) => s.extractSubMemolet);
  const addConnectorHub = useMemoletStore((s) => s.addConnectorHub);

  const pairs = splitIntoPairs(data.text);
  const hasMultiplePairs = pairs.length > 1;

  const handleRefreshMemory = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await auditorApi.refresh(id);
      const parsed = parseMemoletText(res.text);
      updateMemoletData(id, {
        text: res.text,
        summary: res.summary || parsed.summary,
        isDeprecated: false,
        deprecationReason: undefined,
        suggestedUpdate: undefined,
        temporalAnchor: res.temporal_anchor,
      });
    } catch (err) {
      console.error('Failed to refresh memory:', err);
    } finally {
      setRefreshing(false);
    }
  }, [id, refreshing, updateMemoletData]);

  return (
    <div
      className={cn(
        'relative bg-white/85 backdrop-blur-sm rounded-xl shadow-md p-3 w-full h-full flex flex-col transition-all border-2 group overflow-visible select-none',
        data.priorityTier === 'high'
          ? 'ring-2 ring-indigo-400 shadow-indigo-100 shadow-lg border-indigo-300'
          : data.priorityTier === 'low'
          ? 'opacity-80 border-dashed border-gray-300'
          : '',
        data.isDeprecated
          ? 'border-amber-400 ring-2 ring-amber-200'
          : data.highlighted
          ? 'border-blue-500 ring-4 ring-blue-300 shadow-blue-200 shadow-xl'
          : 'border-transparent hover:border-gray-300',
        selected ? 'border-gray-600 shadow-xl' : '',
        hovered || selected ? 'z-50' : 'z-10'
      )}
      style={{ backgroundColor: data.color || '#f3f4f6' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setHoveredPairIdx(null);
      }}
      onClick={() => useMemoletStore.getState().setSelectedNodeId(id)}
    >
      <NodeResizer 
        color="#6366f1" 
        isVisible={!!selected} 
        minWidth={160} 
        minHeight={140}
        onResize={(_event, params) => {
          updateNodeDimensions(id, params.width, params.height);
        }}
      />

      <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 w-2.5 h-2.5 bg-blue-500" />
      <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 w-2.5 h-2.5 bg-blue-500" />
      <Handle type="target" position={Position.Left} id="left" className="opacity-0 group-hover:opacity-100 w-2.5 h-2.5 bg-blue-500" />
      <Handle type="source" position={Position.Right} id="right" className="opacity-0 group-hover:opacity-100 w-2.5 h-2.5 bg-blue-500" />

      {/* Header */}
      <div className="flex items-center space-x-1.5 text-base font-semibold mb-1 text-gray-800">
        <span>{data.parentMemoletId ? '↳' : data.keywords?.length > 0 ? '📝' : '📎'}</span>
        <span className="font-mono text-sm font-bold tracking-wide">
          {data.displayId ?? id.substring(0, 6)}
        </span>

        {/* Priority Tier Indicator Badge */}
        {data.priorityTier === 'high' && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded shadow-2xs">
            ⚡ High
          </span>
        )}
        {data.priorityTier === 'low' && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-gray-100 text-gray-500 border border-gray-200 px-1 py-0.5 rounded">
            Low
          </span>
        )}

        {hasMultiplePairs && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded shadow-2xs">
            {pairs.length} Pairs
          </span>
        )}

        {data.isDeprecated && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full shadow-2xs animate-pulse"
            title={data.deprecationReason || 'Outdated information detected'}
          >
            <AlertTriangle size={10} />
            Stale
          </span>
        )}
        {!data.isDeprecated && data.isTimeSensitive && (
          <span
            className="ml-auto text-gray-400"
            title={data.temporalAnchor ? `Grounded context: ${data.temporalAnchor}` : 'Time-sensitive memory'}
          >
            <Clock size={11} />
          </span>
        )}
      </div>

      {/* Body: Keywords */}
      <div className="text-xs text-gray-600 break-words whitespace-pre-wrap overflow-hidden flex-1 leading-relaxed">
        {data.keywords?.join(', ')}
      </div>

      {/* Direct 1-Click Update to Latest Button on Node Card */}
      {data.isDeprecated && (
        <button
          type="button"
          onClick={handleRefreshMemory}
          disabled={refreshing}
          className="mt-2 w-full py-1 px-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white font-semibold rounded-lg text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all z-20 cursor-pointer disabled:opacity-50 flex-shrink-0"
          title="Click to automatically update this deprecated memory with current standards"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          <span>{refreshing ? "Updating..." : "Update to Latest"}</span>
        </button>
      )}

      {/* Vertical Stack of Sub-Pair Extraction Handles on Node Hover */}
      {hovered && hasMultiplePairs && (
        <div
          className="absolute -right-7 top-2 flex flex-col gap-1.5 z-40"
          onClick={(e) => e.stopPropagation()}
        >
          {pairs.map((pair, idx) => {
            const isBoxHovered = hoveredPairIdx === idx;
            return (
              <div key={idx} className="relative">
                <div
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('application/memolet-text', pair.raw);
                    e.dataTransfer.setData('application/source-memolet-id', id);
                    e.dataTransfer.setData('application/pair-index', String(idx + 1));
                    e.dataTransfer.setData('application/pair-summary', pair.summary);
                    e.dataTransfer.setData('text/plain', pair.raw);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    extractSubMemolet(id, pair.raw, undefined, idx + 1, pair.summary);
                  }}
                  onMouseEnter={() => setHoveredPairIdx(idx)}
                  onMouseLeave={() => setHoveredPairIdx(null)}
                  className={cn(
                    "w-6 h-6 rounded-md bg-white border shadow-xs flex items-center justify-center text-[11px] font-bold transition-all cursor-grab active:cursor-grabbing select-none",
                    isBoxHovered
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md scale-110 ring-2 ring-blue-200"
                      : "border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-gray-50"
                  )}
                  title={`Pair ${idx + 1}: ${pair.summary} (Drag to canvas or click to extract)`}
                >
                  {idx + 1}
                </div>

                {/* Hover preview tooltip for this specific pair */}
                {isBoxHovered && (
                  <div
                    className="absolute left-8 top-0 w-72 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-blue-200 p-3 z-50 text-left pointer-events-auto select-text"
                    onMouseEnter={() => setHoveredPairIdx(idx)}
                    onMouseLeave={() => setHoveredPairIdx(null)}
                  >
                    <div className="flex items-center justify-between font-mono font-bold mb-1.5 text-gray-900 border-b border-gray-100 pb-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          Pair {idx + 1} of {pairs.length}
                        </span>
                        <span className="text-gray-400 font-sans text-[10px]">
                          ID: {data.displayId ? `${data.displayId}-${idx + 1}` : `${id.substring(0, 4)}-${idx + 1}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-blue-600 font-sans">⠿ Drag to extract</span>
                    </div>

                    {pair.summary && (
                      <p className="text-xs font-medium text-blue-900 leading-relaxed mb-2">
                        {pair.summary}
                      </p>
                    )}

                    {pair.user && (
                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-1.5 mb-1.5 text-[11px] text-gray-700 leading-tight">
                        <span className="font-semibold text-gray-800">User: </span>
                        <span className="line-clamp-2">{pair.user}</span>
                      </div>
                    )}

                    {pair.ai && (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-1.5 mb-2 text-[11px] text-gray-700 leading-tight">
                        <span className="font-semibold text-blue-800">AI: </span>
                        <span className="line-clamp-3">{pair.ai}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        extractSubMemolet(id, pair.raw, undefined, idx + 1, pair.summary);
                      }}
                      className="w-full py-1 px-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Extract as Child Memolet</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hover Tooltip / Main Sensemaking Card */}
      {hovered && hoveredPairIdx === null && (
        <div className={cn(
          "absolute top-0 z-50 text-base text-gray-700 pointer-events-auto",
          hasMultiplePairs ? "left-[calc(100%+32px)] w-80" : "left-full pl-2 w-80"
        )}>
          <div className="p-3 bg-white/95 backdrop-blur-md shadow-2xl rounded-xl border border-gray-200">
            <div className="flex items-center justify-between font-mono font-bold mb-1.5 text-gray-900 border-b border-gray-100 pb-1.5 text-sm">
              <div className="flex items-center gap-1.5">
                <span>{data.displayId ?? id.substring(0, 8)}</span>
                {data.weight && (
                  <span className="text-[10px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    Weight: {data.weight}x
                  </span>
                )}
              </div>
              {data.temporalAnchor && (
                <span className="text-[10px] font-normal text-gray-500 font-sans truncate max-w-[120px]" title={data.temporalAnchor}>
                  {data.temporalAnchor}
                </span>
              )}
            </div>
            {data.summary ? (
              <p className="text-xs text-blue-700 leading-relaxed line-clamp-4">{data.summary}</p>
            ) : (
              <p className="line-clamp-4 text-xs text-gray-600 leading-relaxed">{data.keywords?.join(' · ')}</p>
            )}

            {data.isDeprecated && (
              <div className="mt-2.5 pt-2 border-t border-gray-100">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
                    <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                    <span>Deprecated Advice</span>
                  </div>
                  {data.deprecationReason && (
                    <p className="text-amber-800 text-[11px] leading-tight mb-1.5 font-medium">{data.deprecationReason}</p>
                  )}
                  {data.suggestedUpdate && (
                    <p className="text-gray-700 text-[11px] leading-tight mb-2">
                      <span className="font-semibold text-amber-900">Modern: </span>{data.suggestedUpdate}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleRefreshMemory}
                    disabled={refreshing}
                    className="w-full py-1.5 px-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition pointer-events-auto cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                    <span>{refreshing ? "Updating to Latest..." : "Update to Latest"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Buttons: Extract Sub-Memolet & Add Synthesis Hub */}
      {hovered && (
        <div className="absolute -right-2 -top-4 flex items-center gap-1 z-30">
          <button
            type="button"
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-full p-1 shadow-md transition-transform hover:scale-110 cursor-pointer"
            title="Create Synthesis Hub connected to this node"
            onClick={(e) => {
              e.stopPropagation();
              addConnectorHub({ x: 250, y: 150 }, id);
            }}
          >
            <GitMerge size={12} />
          </button>
          <button
            type="button"
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 shadow-md transition-transform hover:scale-110 cursor-pointer"
            title="Extract Sub-Memolet"
            onClick={(e) => {
              e.stopPropagation();
              extractSubMemolet(id);
            }}
          >
            <Plus size={12} />
          </button>
        </div>
      )}
    </div>
  );
});

MemoletNodeComponent.displayName = 'MemoletNodeComponent';

