'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitMerge, Trash2 } from 'lucide-react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { cn } from '@/lib/utils';

export type ConnectorHubProps = NodeProps;

export const ConnectorHubComponent = memo(({ id, selected }: ConnectorHubProps) => {
  const [hovered, setHovered] = useState(false);
  const removeMemolet = useMemoletStore((s) => s.removeMemolet);
  const edges = useMemoletStore((s) => s.edges);

  const connectedCount = edges.filter((e) => e.source === id || e.target === id).length;

  return (
    <div
      className={cn(
        'relative w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md group select-none',
        'bg-amber-100/90 hover:bg-amber-100 border-2 border-amber-400 backdrop-blur-xs',
        selected ? 'ring-2 ring-amber-400 scale-105 shadow-lg' : 'hover:scale-105'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Context Synthesis Hub (${connectedCount} connected)`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-2.5 h-2.5 bg-amber-500 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-2.5 h-2.5 bg-amber-500 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-2.5 h-2.5 bg-amber-500 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-2.5 h-2.5 bg-amber-500 border-white"
      />

      <GitMerge size={18} className="text-amber-700 animate-pulse" />

      {/* Connected badge */}
      {connectedCount > 0 && (
        <span className="absolute -bottom-2 -right-2 bg-amber-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-xs">
          {connectedCount}
        </span>
      )}

      {/* Delete button on hover */}
      {hovered && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeMemolet(id);
          }}
          className="absolute -top-2.5 -right-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition z-20 cursor-pointer"
          title="Delete synthesis hub"
        >
          <Trash2 size={10} />
        </button>
      )}

      {/* Hover tooltip label */}
      {hovered && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900/90 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-lg pointer-events-none z-30">
          Context Synthesis Hub
        </div>
      )}
    </div>
  );
});

ConnectorHubComponent.displayName = 'ConnectorHubComponent';
