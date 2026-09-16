import { CanvasNode } from '@/store/useMemoletStore';
import { Edge } from '@xyflow/react';

export interface CompiledSpatialContext {
  activeMemoletIds: string[];
  highlightedIds: string[];
  obscuredIds: string[];
  groupedSets: string[][]; // clusters of memolet IDs connected via hubs or edges
  instructionText: string;
}

/**
 * Compiles 2D canvas nodes, their surface area dimensions, and edge/hub connections
 * into structured prompt instructions according to the UIST '24 instructed RAG specification.
 */
export function compileSpatialContext(
  nodes: CanvasNode[],
  edges: Edge[]
): CompiledSpatialContext {
  const memoletNodes = nodes.filter((n) => n.type === 'memolet');
  const hubNodes = nodes.filter((n) => n.type === 'connectorHub');

  const activeMemoletIds = memoletNodes.map((n) => n.id);
  const highlightedIds: string[] = [];
  const obscuredIds: string[] = [];
  const standardIds: string[] = [];

  for (const node of memoletNodes) {
    const tier = node.data?.priorityTier;
    const weight = node.data?.weight ?? 1;

    if (tier === 'high' || weight >= 1.75) {
      highlightedIds.push(node.data?.displayId || node.id);
    } else if (tier === 'low' || weight <= 0.65) {
      obscuredIds.push(node.data?.displayId || node.id);
    } else {
      standardIds.push(node.data?.displayId || node.id);
    }
  }

  // Find grouped sets via Connector Hubs
  const groupedSets: string[][] = [];

  for (const hub of hubNodes) {
    const connectedEdges = edges.filter(
      (e) => e.source === hub.id || e.target === hub.id
    );
    const connectedNodeIds = new Set<string>();

    for (const edge of connectedEdges) {
      const neighborId = edge.source === hub.id ? edge.target : edge.source;
      const neighborNode = memoletNodes.find((n) => n.id === neighborId);
      if (neighborNode) {
        connectedNodeIds.add(neighborNode.data?.displayId || neighborNode.id);
      }
    }

    if (connectedNodeIds.size > 1) {
      groupedSets.push(Array.from(connectedNodeIds));
    }
  }

  // Also check direct node-to-node synthesis edges
  for (const edge of edges) {
    const sourceNode = memoletNodes.find((n) => n.id === edge.source);
    const targetNode = memoletNodes.find((n) => n.id === edge.target);
    if (sourceNode && targetNode && edge.data?.label === 'SYNTHESIS') {
      const pair = [
        sourceNode.data?.displayId || sourceNode.id,
        targetNode.data?.displayId || targetNode.id,
      ];
      // Avoid duplicate sets
      const alreadyGrouped = groupedSets.some(
        (set) => set.includes(pair[0]) && set.includes(pair[1])
      );
      if (!alreadyGrouped) {
        groupedSets.push(pair);
      }
    }
  }

  // Build human-readable instruction text for LLM system prompt
  const instructions: string[] = [];

  if (highlightedIds.length > 0) {
    instructions.push(
      `HIGHLIGHT_CONTEXT: Give highest architectural priority and prominent explanation to context from: ${highlightedIds.map((id) => `[[citation:${id}]]`).join(', ')}.`
    );
  }

  if (groupedSets.length > 0) {
    const groupStrs = groupedSets.map(
      (g) => `(${g.map((id) => `[[citation:${id}]]`).join(' + ')})`
    );
    instructions.push(
      `GROUP_CONTEXT: Synthesize the following memories cohesively into unified sections: ${groupStrs.join(', ')}.`
    );
  }

  if (obscuredIds.length > 0) {
    instructions.push(
      `OBSCURE_CONTEXT: Treat context from ${obscuredIds.map((id) => `[[citation:${id}]]`).join(', ')} as peripheral background nuance only.`
    );
  }

  return {
    activeMemoletIds,
    highlightedIds,
    obscuredIds,
    groupedSets,
    instructionText: instructions.join('\n'),
  };
}
