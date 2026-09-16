import { create } from 'zustand';
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';

export interface CanvasCluster {
  id: string;
  name: string;
  color: string;
  keywords: string[];
}

export type MemoletData = {
  text: string;
  keywords: string[];
  color?: string;
  weight?: number;
  priorityTier?: 'high' | 'normal' | 'low';
  highlighted?: boolean;
  summary?: string;    // parsed from structured text for display
  displayId?: string;  // short ID like "1_0", "2_3", "6_2-8" shown in the UI
  parentMemoletId?: string; // parent lineage for extracted sub-memolets
  clusterId?: string;
  clusterColor?: string;
  isTimeSensitive?: boolean;
  deprecationRisk?: string;
  temporalAnchor?: string;
  validityHorizonDays?: number;
  isDeprecated?: boolean;
  deprecationReason?: string;
  suggestedUpdate?: string;
  [key: string]: unknown;
};

export type ConnectorHubData = {
  label?: string;
  clusterColor?: string;
  [key: string]: unknown;
};

export type MemoletNode = Node<MemoletData, "memolet">;
export type ConnectorHubNode = Node<ConnectorHubData, "connectorHub">;
export type CanvasNode = Node<any>;

interface MemoletState {
  nodes: CanvasNode[];
  edges: Edge[];
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  
  // Clusters & Voronoi
  clusters: CanvasCluster[];
  setClusters: (clusters: CanvasCluster[]) => void;
  activeVoronoi: boolean;
  toggleVoronoi: () => void;
  
  // Actions
  setNodes: (nodes: CanvasNode[]) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  addMemolet: (node: CanvasNode) => void;
  updateMemoletData: (id: string, data: Partial<MemoletData>) => void;
  updateNodeDimensions: (id: string, width: number, height: number) => void;
  removeMemolet: (id: string) => void;
  removeEdge: (id: string) => void;
  getConnectedNodeIds: (nodeId: string) => string[];
  
  // Extraction & Hub creation
  extractSubMemolet: (
    parentId: string,
    snippetText?: string,
    position?: { x: number; y: number },
    pairIndex?: number,
    customSummary?: string
  ) => string;
  addConnectorHub: (
    position: { x: number; y: number },
    sourceId?: string,
    targetId?: string
  ) => string;
  
  setLeftSidebarOpen: (isOpen: boolean) => void;
  setRightSidebarOpen: (isOpen: boolean) => void;
  
  highlightNode: (id: string | null) => void;
  
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  importModalOpen: boolean;
  setImportModalOpen: (isOpen: boolean) => void;

  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  memoriesNeedsSync: boolean;
  setMemoriesNeedsSync: (needsSync: boolean) => void;
  resetStore: () => void;
}

const DEFAULT_CLUSTERS: CanvasCluster[] = [
  { id: 'c1', name: 'Core Architecture', color: '#bbf7d0', keywords: ['FastAPI', 'database', 'backend', 'stream'] },
  { id: 'c2', name: 'Knowledge & AI', color: '#fef08a', keywords: ['GraphRAG', 'Neo4j', 'vector', 'retrieval'] },
  { id: 'c3', name: 'State & Security', color: '#bfdbfe', keywords: ['auth', 'session', 'token', 'jwt'] },
  { id: 'c4', name: 'Tasks & Integration', color: '#fed7aa', keywords: ['celery', 'redis', 'queue', 'import'] },
];

export const useMemoletStore = create<MemoletState>((set, get) => ({
  nodes: [],
  edges: [],
  leftSidebarOpen: false,
  rightSidebarOpen: false,
  importModalOpen: false,
  activeConversationId: null,
  selectedNodeId: null,
  memoriesNeedsSync: true,
  clusters: DEFAULT_CLUSTERS,
  activeVoronoi: true,

  setClusters: (clusters) => set({ clusters }),
  toggleVoronoi: () => set((state) => ({ activeVoronoi: !state.activeVoronoi })),
  setImportModalOpen: (isOpen) => set({ importModalOpen: isOpen }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  resetStore: () =>
    set({
      nodes: [],
      edges: [],
      leftSidebarOpen: false,
      rightSidebarOpen: false,
      importModalOpen: false,
      activeConversationId: null,
      selectedNodeId: null,
      memoriesNeedsSync: true,
    }),

  setNodes: (nodes) => set({ nodes }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setMemoriesNeedsSync: (needsSync) => set({ memoriesNeedsSync: needsSync }),

  onNodesChange: (changes: NodeChange<CanvasNode>[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as CanvasNode[],
    });
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          type: 'semantic',
          data: { label: 'SYNTHESIS' },
        },
        get().edges
      ),
    });
  },

  addMemolet: (node) => {
    set({ nodes: [...get().nodes, node] });
  },

  updateMemoletData: (id, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    });
  },

  updateNodeDimensions: (id, width, height) => {
    const baselineArea = 160 * 160;
    const currentArea = width * height;
    const normalizedWeight = Number((currentArea / baselineArea).toFixed(2));
    let priorityTier: 'high' | 'normal' | 'low' = 'normal';
    if (normalizedWeight >= 1.75) priorityTier = 'high';
    else if (normalizedWeight <= 0.65) priorityTier = 'low';

    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              style: { ...(n.style || {}), width, height },
              data: {
                ...n.data,
                weight: normalizedWeight,
                priorityTier,
              },
            }
          : n
      ),
    });
  },

  extractSubMemolet: (parentId, snippetText, position, pairIndex, customSummary) => {
    const parent = get().nodes.find((n) => n.id === parentId);
    const newId = `sub-${Date.now()}`;
    const parentDisplay = parent?.data?.displayId || parentId.substring(0, 4);

    // If pairIndex is specified, allocate parentDisplay-pairIndex, else count existing children
    const childIndex = pairIndex !== undefined
      ? pairIndex
      : get().nodes.filter((n) => n.data?.parentMemoletId === parentId).length + 1;
    const displayId = `${parentDisplay}-${childIndex}`;

    const parentWidth = (parent?.style?.width as number) || 160;
    const parentHeight = (parent?.style?.height as number) || 160;

    const defaultPos = parent
      ? { x: parent.position.x + 220, y: parent.position.y + (childIndex - 1) * 60 }
      : { x: 300, y: 300 };

    const childNode: CanvasNode = {
      id: newId,
      type: 'memolet',
      position: position || defaultPos,
      style: { width: parentWidth, height: parentHeight },
      data: {
        text: snippetText || (parent?.data?.text ? `Sub-context from ${parentDisplay}:\n${parent.data.text.slice(0, 300)}...` : 'Extracted Sub-Memolet'),
        keywords: parent?.data?.keywords ? [...parent.data.keywords.slice(0, 3), 'pair'] : ['pair'],
        color: parent?.data?.color || '#bfdbfe',
        displayId,
        parentMemoletId: parentId,
        summary: customSummary || (snippetText ? snippetText.slice(0, 140) : `Extracted pair from ${parentDisplay}`),
      },
    };

    const newEdge: Edge = {
      id: `e-${parentId}-${newId}`,
      source: parentId,
      target: newId,
      type: 'semantic',
      data: { label: 'DERIVED_FROM' },
    };

    set({
      nodes: [...get().nodes, childNode],
      edges: [...get().edges, newEdge],
    });

    return newId;
  },

  addConnectorHub: (position, sourceId, targetId) => {
    const hubId = `hub-${Date.now()}`;
    const hubNode: CanvasNode = {
      id: hubId,
      type: 'connectorHub',
      position,
      data: { label: 'Group Hub' },
    };

    const newEdges: Edge[] = [];
    if (sourceId) {
      newEdges.push({
        id: `e-${sourceId}-${hubId}`,
        source: sourceId,
        target: hubId,
        type: 'semantic',
        data: { label: 'SYNTHESIS' },
      });
    }
    if (targetId) {
      newEdges.push({
        id: `e-${hubId}-${targetId}`,
        source: hubId,
        target: targetId,
        type: 'semantic',
        data: { label: 'SYNTHESIS' },
      });
    }

    set({
      nodes: [...get().nodes, hubNode],
      edges: [...get().edges, ...newEdges],
    });

    return hubId;
  },

  removeMemolet: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  removeEdge: (id) => {
    set({
      edges: get().edges.filter((e) => e.id !== id),
    });
  },

  getConnectedNodeIds: (nodeId) => {
    const edges = get().edges;
    const connected = new Set<string>();
    for (const edge of edges) {
      if (edge.source === nodeId) connected.add(edge.target);
      if (edge.target === nodeId) connected.add(edge.source);
    }
    return Array.from(connected);
  },

  setLeftSidebarOpen: (isOpen) => set({ leftSidebarOpen: isOpen }),
  setRightSidebarOpen: (isOpen) => set({ rightSidebarOpen: isOpen }),

  highlightNode: (id) => {
    set({
      nodes: get().nodes.map((n) => ({
        ...n,
        data: { ...n.data, highlighted: n.id === id || n.data?.displayId === id },
      })),
    });
  },
}));
