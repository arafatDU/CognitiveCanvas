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

export type MemoletData = {
  text: string;
  keywords: string[];
  color?: string;
  weight?: number;
  highlighted?: boolean;
  summary?: string;    // parsed from structured text for display
  displayId?: string;  // short ID like "1_0", "2_3" shown in the UI
  isTimeSensitive?: boolean;
  deprecationRisk?: string;
  temporalAnchor?: string;
  validityHorizonDays?: number;
  isDeprecated?: boolean;
  deprecationReason?: string;
  suggestedUpdate?: string;
};

export type MemoletNode = Node<MemoletData, "memolet">;

interface MemoletState {
  nodes: MemoletNode[];
  edges: Edge[];
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  
  // Actions
  setNodes: (nodes: MemoletNode[]) => void;
  onNodesChange: (changes: NodeChange<MemoletNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  addMemolet: (node: MemoletNode) => void;
  updateMemoletData: (id: string, data: Partial<MemoletData>) => void;
  removeMemolet: (id: string) => void;
  
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

export const useMemoletStore = create<MemoletState>((set, get) => ({
  nodes: [],
  edges: [],
  leftSidebarOpen: false,
  rightSidebarOpen: false,
  importModalOpen: false,
  activeConversationId: null,
  selectedNodeId: null,
  memoriesNeedsSync: true,

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

  onNodesChange: (changes: NodeChange<MemoletNode>[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as MemoletNode[],
    });
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
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

  removeMemolet: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  setLeftSidebarOpen: (isOpen) => set({ leftSidebarOpen: isOpen }),
  setRightSidebarOpen: (isOpen) => set({ rightSidebarOpen: isOpen }),

  highlightNode: (id) => {
    set({
      nodes: get().nodes.map((n) => ({
        ...n,
        data: { ...n.data, highlighted: n.id === id },
      })),
    });
  },
}));
