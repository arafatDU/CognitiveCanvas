'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  BackgroundVariant,
  ReactFlowInstance,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemoletStore, CanvasNode } from '@/store/useMemoletStore';
import { MemoletNodeComponent } from './MemoletNodeComponent';
import { ConnectorHubComponent } from './ConnectorHubComponent';
import { SemanticEdge } from './CustomEdges/SemanticEdge';
import { VoronoiBackground } from './VoronoiBackground';
import { ClusterLegend } from './ClusterLegend';
import { getNextDisplayId, parseMemoletText } from '@/lib/api';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NODE_TYPES: NodeTypes = {
  memolet: MemoletNodeComponent,
  connectorHub: ConnectorHubComponent,
};

const EDGE_TYPES: EdgeTypes = {
  semantic: SemanticEdge,
};

export default function SandboxCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addMemolet,
    removeMemolet,
  } = useMemoletStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, _node: any) => {
      const container = reactFlowWrapper.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (_event as unknown as MouseEvent).clientX - rect.left;
      const y = (_event as unknown as MouseEvent).clientY - rect.top;

      // Trash zone: bottom-left corner 140x140
      const over = x < 140 && y > rect.height - 140;
      setIsOverTrash(over);
    },
    []
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setIsOverTrash(false);
      const container = reactFlowWrapper.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = (_event as unknown as MouseEvent).clientX - rect.left;
      const y = (_event as unknown as MouseEvent).clientY - rect.top;

      // Drop-to-delete zone: bottom-left corner (140×140 px)
      if (x < 140 && y > rect.height - 140) {
        removeMemolet(node.id);
      }
    },
    [removeMemolet]
  );

  // Drag and Drop from DocViewer
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const rawText = event.dataTransfer.getData('application/memolet-text') || event.dataTransfer.getData('text/plain');
      if (!rawText || !reactFlowInstance.current) return;

      const sourceId =
        event.dataTransfer.getData('application/source-memolet-id') ||
        useMemoletStore.getState().selectedNodeId;
      const pairIndexStr = event.dataTransfer.getData('application/pair-index');
      const pairSummary = event.dataTransfer.getData('application/pair-summary');
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const parentNode = nodes.find((n) => n.id === sourceId);
      const parentDisplay = parentNode?.data?.displayId;
      
      let displayId: string;
      if (parentDisplay) {
        if (pairIndexStr) {
          displayId = `${parentDisplay}-${pairIndexStr}`;
        } else {
          const subCount = nodes.filter((n) => n.data?.parentMemoletId === sourceId).length + 1;
          displayId = `${parentDisplay}-${subCount}`;
        }
      } else {
        displayId = getNextDisplayId(nodes);
      }

      const newId = `sub-${Date.now()}`;
      const parsed = parseMemoletText(rawText);
      const summary = pairSummary || parsed.summary || rawText.slice(0, 150);

      const parentWidth = (parentNode?.style?.width as number) || 160;
      const parentHeight = (parentNode?.style?.height as number) || 160;

      const newNode: CanvasNode = {
        id: newId,
        type: 'memolet',
        position,
        style: { width: parentWidth, height: parentHeight },
        data: {
          text: rawText,
          keywords: parentNode?.data?.keywords?.length ? [...parentNode.data.keywords.slice(0, 3), 'pair'] : ['pair'],
          color: parentNode?.data?.color || '#bfdbfe',
          displayId,
          parentMemoletId: sourceId || undefined,
          summary,
        },
      };

      addMemolet(newNode);

      if (sourceId) {
        const newEdge: Edge = {
          id: `e-${sourceId}-${newId}`,
          source: sourceId,
          target: newId,
          type: 'semantic',
          data: { label: 'DERIVED_FROM' },
        };
        useMemoletStore.setState((s) => ({ edges: [...s.edges, newEdge] }));
      }
    },
    [nodes, addMemolet]
  );

  return (
    <div
      className="flex-grow h-full w-full relative"
      ref={reactFlowWrapper}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode="Delete"
        snapToGrid={true}
        snapGrid={[160, 160]}
      >
        <Background gap={160} size={1} color="#cbd5e1" variant={BackgroundVariant.Lines} />
        <VoronoiBackground />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          style={{ background: '#f8fafc' }}
        />
      </ReactFlow>

      {/* Floating Semantic Cluster Legend */}
      <ClusterLegend />

      {/* Drop & Delete zone overlay */}
      <div
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 w-36 h-36 rounded-tr-full flex items-end justify-start p-3 z-10 transition-all duration-300',
          isOverTrash
            ? 'scale-110 shadow-2xl bg-red-400/80 border-2 border-red-500'
            : 'border border-red-300/40 bg-radial from-red-200/50 to-transparent'
        )}
      >
        <div className="flex flex-col items-center justify-center w-20 mb-2 ml-1">
          <Trash2
            size={isOverTrash ? 24 : 18}
            className={cn('transition-all mb-1', isOverTrash ? 'text-white animate-bounce' : 'text-red-400')}
          />
          <span
            className={cn(
              'font-bold text-[11px] tracking-wide leading-tight text-center',
              isOverTrash ? 'text-white font-extrabold' : 'text-red-500'
            )}
          >
            Drop &<br />Delete
          </span>
        </div>
      </div>
    </div>
  );
}