'use client';

import { memo } from 'react';
import {
  BaseEdge,
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useMemoletStore } from '@/store/useMemoletStore';

export interface SemanticEdgeData {
  relation?: string;
  label?: string;
  weight?: number;
}

export const SemanticEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
    selected,
  }: EdgeProps) => {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetPosition,
      targetX,
      targetY,
      borderRadius: 16,
    });

    const edgeData = data as SemanticEdgeData | undefined;
    const rawLabel = edgeData?.label || edgeData?.relation || 'SYNTHESIS';

    const isSynthesis = rawLabel.toUpperCase() === 'SYNTHESIS';
    const isDerived = rawLabel.toUpperCase() === 'DERIVED_FROM';

    const displayLabel = isSynthesis
      ? 'Synthesize'
      : isDerived
      ? 'Derived'
      : rawLabel;

    const handleDeleteEdge = (e: React.MouseEvent) => {
      e.stopPropagation();
      useMemoletStore.getState().removeEdge(id);
    };

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            strokeWidth: selected ? 2.5 : 1.75,
            stroke: selected ? '#2563eb' : isSynthesis ? '#60a5fa' : '#94a3b8',
            strokeDasharray: isDerived ? '4,4' : '6,4',
            strokeLinecap: 'round',
            ...style,
          }}
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="group flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-gray-200 hover:border-blue-400 hover:shadow-md px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-gray-700 shadow-xs transition-all cursor-pointer select-none"
            title={
              isSynthesis
                ? 'Synthesis Link: Active prompt bundles both memories together. Click ✕ to disconnect.'
                : 'Connection. Click ✕ to remove.'
            }
            onClick={handleDeleteEdge}
          >
            <span className="flex items-center gap-1 text-blue-600">
              <span className="text-[11px]">{isSynthesis ? '⟷' : '↳'}</span>
              <span>{displayLabel}</span>
            </span>
            <button
              type="button"
              className="p-0.5 ml-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer"
              title="Delete connection"
              onClick={handleDeleteEdge}
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }
);

SemanticEdge.displayName = 'SemanticEdge';
