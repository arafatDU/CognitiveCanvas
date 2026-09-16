'use client';

import { memo, useState } from 'react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { Layers, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ClusterLegend = memo(() => {
  const [collapsed, setCollapsed] = useState(false);
  const clusters = useMemoletStore((s) => s.clusters);
  const activeVoronoi = useMemoletStore((s) => s.activeVoronoi);
  const toggleVoronoi = useMemoletStore((s) => s.toggleVoronoi);
  const nodes = useMemoletStore((s) => s.nodes);
  const highlightNode = useMemoletStore((s) => s.highlightNode);

  // Group nodes by color to count them
  const nodeCountByColor = nodes.reduce((acc, n) => {
    const c = n.data?.color || '#cbd5e1';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="absolute top-4 left-4 z-20 max-w-xs bg-white/90 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-lg transition-all select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
          <Layers size={13} className="text-blue-600" />
          <span>Semantic Themes</span>
          <span className="text-[10px] text-gray-400 font-normal">({nodes.length} nodes)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleVoronoi}
            className={cn(
              'p-1 rounded text-gray-500 hover:text-gray-800 transition cursor-pointer',
              activeVoronoi ? 'text-blue-600' : 'text-gray-400'
            )}
            title={activeVoronoi ? 'Hide Voronoi Regions' : 'Show Voronoi Regions'}
          >
            {activeVoronoi ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded text-gray-500 hover:text-gray-800 transition cursor-pointer"
          >
            {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </div>

      {/* Cluster List */}
      {!collapsed && (
        <div className="p-2 space-y-1.5 max-h-56 overflow-y-auto text-[11px]">
          {clusters.map((cl) => {
            const count = nodeCountByColor[cl.color] || 0;
            return (
              <div
                key={cl.id}
                className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-gray-100/70 transition cursor-pointer group"
                onClick={() => {
                  // Find first node matching this color and highlight
                  const matchingNode = nodes.find((n) => n.data?.color === cl.color);
                  if (matchingNode) highlightNode(matchingNode.id);
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-md flex-shrink-0 mt-0.5 shadow-2xs border border-black/10 group-hover:scale-110 transition"
                  style={{ backgroundColor: cl.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800 truncate">{cl.name}</span>
                    {count > 0 && (
                      <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded-full">
                        {count}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 truncate leading-tight">
                    {cl.keywords.join(', ')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

ClusterLegend.displayName = 'ClusterLegend';
