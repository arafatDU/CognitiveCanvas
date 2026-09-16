'use client';

import { memo, useMemo } from 'react';
import { useViewport } from '@xyflow/react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { computeVoronoiCells, VoronoiSite } from '@/lib/voronoiUtils';

export const VoronoiBackground = memo(() => {
  const nodes = useMemoletStore((s) => s.nodes);
  const activeVoronoi = useMemoletStore((s) => s.activeVoronoi);
  const { x, y, zoom } = useViewport();

  const sites = useMemo<VoronoiSite[]>(() => {
    return nodes
      .filter((n) => n.type === 'memolet' && n.position)
      .map((n) => {
        // Calculate center of node
        const w = (n.measured?.width ?? (n.style?.width as number) ?? 160);
        const h = (n.measured?.height ?? (n.style?.height as number) ?? 140);
        return {
          id: n.id,
          x: n.position.x + w / 2,
          y: n.position.y + h / 2,
          color: n.data?.color || '#e2e8f0',
          clusterId: n.data?.clusterId,
        };
      });
  }, [nodes]);

  const cells = useMemo(() => {
    if (!activeVoronoi || sites.length < 2) return [];
    return computeVoronoiCells(sites);
  }, [sites, activeVoronoi]);

  if (!activeVoronoi || cells.length === 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {cells.map((cell) => {
          if (!cell.path) return null;
          return (
            <path
              key={cell.id}
              d={cell.path}
              fill={cell.color}
              fillOpacity={0.14}
              stroke={cell.color}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              strokeOpacity={0.35}
              className="transition-all duration-300"
            />
          );
        })}
      </g>
    </svg>
  );
});

VoronoiBackground.displayName = 'VoronoiBackground';
