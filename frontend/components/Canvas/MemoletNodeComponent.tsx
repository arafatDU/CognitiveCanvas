'use client';
import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer, Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Plus, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { MemoletData, useMemoletStore } from '@/store/useMemoletStore';
import { auditorApi, parseMemoletText } from '@/lib/api';

export type CustomNodeProps = NodeProps<Node<MemoletData, 'memolet'>>;

export const MemoletNodeComponent = memo(({ id, data, selected }: CustomNodeProps) => {
  const [hovered, setHovered] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const updateMemoletData = useMemoletStore((s) => s.updateMemoletData);

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
        'relative bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-3 w-full h-full flex flex-col transition-all border-2 group overflow-visible',
        data.isDeprecated
          ? 'border-amber-400 ring-2 ring-amber-200'
          : data.highlighted
          ? 'border-blue-500 ring-2 ring-blue-300'
          : 'border-transparent hover:border-gray-300',
        selected ? 'border-gray-500 shadow-lg' : '',
        hovered || selected ? 'z-50' : 'z-10'
      )}
      style={{ backgroundColor: data.color || '#f3f4f6' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => useMemoletStore.getState().setSelectedNodeId(id)}
    >
      <NodeResizer 
        color="#a8a29e" 
        isVisible={!!selected} 
        minWidth={160} 
        minHeight={160} 
      />

      <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100" />
      <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100" />
      <Handle type="target" position={Position.Left} id="left" className="opacity-0 group-hover:opacity-100" />
      <Handle type="source" position={Position.Right} id="right" className="opacity-0 group-hover:opacity-100" />

      {/* Header */}
      <div className="flex items-center space-x-1.5 text-base font-semibold mb-1 text-gray-800">
        <span>{data.keywords.length > 0 ? '📝' : '📎'}</span>
        <span className="font-mono text-sm font-bold tracking-wide">
          {data.displayId ?? id.substring(0, 6)}
        </span>

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
      <div className="text-sm text-gray-600 break-words whitespace-pre-wrap overflow-hidden flex-1">
        {data.keywords.join(', ')}
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

      {/* Hover Tooltip/Summary */}
      {hovered && (
        <div className="absolute top-0 left-full pl-2 w-80 z-50 text-base text-gray-700 pointer-events-auto">
          <div className="p-3 bg-white shadow-2xl rounded-xl border border-gray-200">
            <div className="flex items-center justify-between font-mono font-bold mb-1.5 text-gray-900 border-b border-gray-100 pb-1.5 text-sm">
              <span>{data.displayId ?? id.substring(0, 8)}</span>
              {data.temporalAnchor && (
                <span className="text-[10px] font-normal text-gray-500 font-sans truncate max-w-[140px]" title={data.temporalAnchor}>
                  {data.temporalAnchor}
                </span>
              )}
            </div>
            {data.summary ? (
              <p className="text-sm text-blue-700 leading-relaxed line-clamp-4">{data.summary}</p>
            ) : (
              <p className="line-clamp-4 text-sm text-gray-600 leading-relaxed">{data.keywords.join(' · ')}</p>
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

      {/* Extract Button */}
      {hovered && (
        <button
          className="absolute -right-3 -top-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 shadow-lg transition-transform hover:scale-110 z-30"
          title="Extract"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Extract logic
          }}
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
});
MemoletNodeComponent.displayName = 'MemoletNodeComponent';
