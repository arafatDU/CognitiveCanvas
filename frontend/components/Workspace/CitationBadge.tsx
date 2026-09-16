'use client';

import { memo } from 'react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { cn } from '@/lib/utils';

interface CitationBadgeProps {
  displayId: string;
  className?: string;
}

export const CitationBadge = memo(({ displayId, className }: CitationBadgeProps) => {
  const nodes = useMemoletStore((s) => s.nodes);
  const highlightNode = useMemoletStore((s) => s.highlightNode);
  const setSelectedNodeId = useMemoletStore((s) => s.setSelectedNodeId);

  // Clean string: remove outer brackets or citation: prefix
  const cleanId = displayId.replace(/[\[\]]/g, '').replace(/^citation:\s*/i, '').trim();

  // Find matching node
  const node = nodes.find(
    (n) =>
      n.data?.displayId === cleanId ||
      n.id === cleanId ||
      n.id.startsWith(cleanId)
  );

  const emoji = node?.data?.keywords?.length ? '📝' : '📎';
  const color = node?.data?.color || '#bfdbfe';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node) {
      setSelectedNodeId(node.id);
      highlightNode(node.id);
    }
  };

  const handleMouseEnter = () => {
    if (node) {
      highlightNode(node.id);
    }
  };

  const handleMouseLeave = () => {
    highlightNode(null);
  };

  return (
    <span
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        borderColor: color,
      }}
      className={cn(
        'inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold transition-all cursor-pointer select-none',
        'bg-white/90 hover:bg-white text-gray-800 border shadow-2xs hover:scale-105 active:scale-95 hover:shadow-sm',
        node?.data?.highlighted ? 'ring-2 ring-blue-400 border-blue-500 scale-105' : '',
        className
      )}
      title={`Click to inspect memolet ${cleanId}`}
    >
      <span className="text-[11px]">{emoji}</span>
      <span>{cleanId}</span>
    </span>
  );
});

CitationBadge.displayName = 'CitationBadge';
