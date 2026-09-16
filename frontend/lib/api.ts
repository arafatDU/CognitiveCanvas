const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

let clerkTokenGetter: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(getter: () => Promise<string | null>) {
  clerkTokenGetter = getter;
}

export async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  if (clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter();
      if (token) return token;
    } catch {
      // Fallback
    }
  }

  // Check if Clerk is loaded on window
  // @ts-ignore
  if (typeof window !== 'undefined' && window.Clerk?.session) {
    try {
      // @ts-ignore
      const token = await window.Clerk.session.getToken();
      if (token) return token;
    } catch {
      // Fallback
    }
  }

  return localStorage.getItem('memolet_token');
}

type FetchOptions = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, headers = {}, ...rest } = options;
  const token = await getToken();

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth && token) {
    mergedHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: mergedHeaders,
    ...rest,
  });

  if (res.status === 401) {
    localStorage.removeItem('memolet_token');
    localStorage.removeItem('memolet_user');
    // If not on login/register/landing, redirect to login
    if (typeof window !== 'undefined' && !['/', '/login', '/register'].includes(window.location.pathname)) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth endpoints ──────────────────────────────────────────────────────────

export interface LoginPayload {
  username: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterResponse extends AuthTokenResponse {
  user: { username: string; id: string };
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiFetch<AuthTokenResponse>('/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(payload),
    }),

  register: (payload: LoginPayload) =>
    apiFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(payload),
    }),
};

// ── Memory endpoints ────────────────────────────────────────────────────────

export interface MemoletDTO {
  id: string;
  text: string;
  keywords: string[];
  color?: string;
  weight?: number;
  displayId?: string; // computed client-side: "1_0", "1_1", "2_0", ...
  is_time_sensitive?: boolean;
  deprecation_risk?: string;
  temporal_anchor?: string;
  validity_horizon_days?: number;
  is_deprecated?: boolean;
  deprecation_reason?: string;
  suggested_update?: string;
  audited_at?: string;
}

/** Convert a displayId like "1_0" to its 0-indexed sequential integer */
export function displayIdToIndex(displayId: string): number {
  const match = displayId.match(/^(\d+)_(\d+)$/);
  if (!match) return -1;
  const group = parseInt(match[1], 10);
  const offset = parseInt(match[2], 10);
  return (group - 1) * 10 + offset;
}

/** Convert a 0-indexed sequential integer to displayId ("1_0", "1_1", ..., "2_0") */
export function indexToDisplayId(index: number): string {
  const group = Math.floor(index / 10) + 1;
  const offset = index % 10;
  return `${group}_${offset}`;
}

/**
 * Computes the next available unique displayId that does not collide
 * with any existing nodes on the canvas or previously assigned ids.
 */
export function getNextDisplayId(
  existingNodes: { data?: { displayId?: string } }[],
  reservedIds: (string | undefined)[] = []
): string {
  const usedIndices = new Set<number>();
  for (const node of existingNodes) {
    if (node.data?.displayId) {
      const idx = displayIdToIndex(node.data.displayId);
      if (idx >= 0) usedIndices.add(idx);
    }
  }
  for (const rid of reservedIds) {
    if (rid) {
      const idx = displayIdToIndex(rid);
      if (idx >= 0) usedIndices.add(idx);
    }
  }

  let candidate = 0;
  while (usedIndices.has(candidate)) {
    candidate++;
  }
  return indexToDisplayId(candidate);
}

/** Legacy helper kept for backwards compatibility if needed */
export function assignDisplayIds<T extends MemoletDTO>(memolets: T[]): T[] {
  return memolets.map((m, i) => ({
    ...m,
    displayId: indexToDisplayId(i),
  }));
}

export interface ParsedPair {
  index: number;
  label: string;
  summary: string;
  user: string;
  ai: string;
  raw: string;
  isStructured?: boolean;
}

/**
 * Splits a memolet's serialized text into multiple pairs if separated by ---PAIR---
 * For single-pair memolets, returns a 1-item array.
 */
export function splitIntoPairs(text: string): ParsedPair[] {
  if (!text) return [];

  if (text.includes('---PAIR---')) {
    const parts = text.split(/---PAIR---/);
    const pairs: ParsedPair[] = [];
    const pairBlocks = parts.slice(1);

    pairBlocks.forEach((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return;
      const summaryMatch = trimmed.match(/(?:Summary|Overview):\s*([\s\S]*?)(?=\n(?:User|AI):|$)/i);
      const userMatch = trimmed.match(/User:\s*([\s\S]*?)(?=\nAI:|$)/i);
      const aiMatch = trimmed.match(/AI:\s*([\s\S]*)/i);

      const s = summaryMatch ? summaryMatch[1].trim() : '';
      const u = userMatch ? userMatch[1].trim() : '';
      const a = aiMatch ? aiMatch[1].trim() : '';

      pairs.push({
        index: idx,
        label: `Pair ${idx + 1}`,
        summary: s || (u ? `${u.slice(0, 60)}...` : `Pair ${idx + 1}`),
        user: u,
        ai: a,
        raw: `Summary: ${s}\nUser: ${u}\nAI: ${a}`,
        isStructured: Boolean(u || a),
      });
    });

    return pairs;
  }

  // Single-pair structured check
  const summaryMatch = text.match(/(?:Summary|Overview):\s*([\s\S]*?)(?=\nUser:|$)/i);
  const userMatch = text.match(/User:\s*([\s\S]*?)(?=\nAI:|$)/i);
  const aiMatch = text.match(/AI:\s*([\s\S]*)/i);

  if (userMatch && aiMatch) {
    const s = summaryMatch ? summaryMatch[1].trim() : '';
    const u = userMatch[1].trim();
    const a = aiMatch[1].trim();
    return [{
      index: 0,
      label: 'Pair 1',
      summary: s || `${u.slice(0, 60)}...`,
      user: u,
      ai: a,
      raw: text,
      isStructured: true,
    }];
  }

  return [];
}

/** Parse the structured text format into component parts */
export function parseMemoletText(text: string): {
  summary: string;
  user: string;
  ai: string;
  isStructured: boolean;
  pairs: ParsedPair[];
} {
  if (!text) {
    return { summary: '', user: '', ai: '', isStructured: false, pairs: [] };
  }

  if (text.includes('---PAIR---')) {
    const overviewMatch = text.match(/(?:Overview|Summary):\s*([\s\S]*?)(?=\n---PAIR---|$)/i);
    const pairs = splitIntoPairs(text);
    const firstPair = pairs[0];
    return {
      summary: overviewMatch ? overviewMatch[1].trim() : (firstPair?.summary || ''),
      user: firstPair?.user || '',
      ai: firstPair?.ai || '',
      isStructured: true,
      pairs,
    };
  }

  const summaryMatch = text.match(/(?:Summary|Overview):\s*([\s\S]*?)(?=\nUser:|$)/i);
  const userMatch = text.match(/User:\s*([\s\S]*?)(?=\nAI:|$)/i);
  const aiMatch = text.match(/AI:\s*([\s\S]*)/i);

  if (userMatch && aiMatch) {
    const s = summaryMatch ? summaryMatch[1].trim() : '';
    const u = userMatch[1].trim();
    const a = aiMatch[1].trim();
    return {
      summary: s,
      user: u,
      ai: a,
      isStructured: true,
      pairs: [{
        index: 0,
        label: 'Pair 1',
        summary: s || `${u.slice(0, 60)}...`,
        user: u,
        ai: a,
        raw: text,
      }],
    };
  }
  return { summary: '', user: '', ai: text, isStructured: false, pairs: [] };
}

export const memoriesApi = {
  /** Returns all stored memolets from the database */
  getAll: () =>
    apiFetch<MemoletDTO[]>('/memories/'),
  /** GraphRAG search — returns ranked matching memolets */
  search: (query: string) =>
    apiFetch<MemoletDTO[]>(`/memories/search?query=${encodeURIComponent(query)}`),
  /** Permanently delete a memory from PostgreSQL and Neo4j */
  delete: (id: string) =>
    apiFetch<{ status: string; id: string; message: string }>(`/memories/${id}`, {
      method: 'DELETE',
    }),
  seedDemo: () =>
    apiFetch<{ message: string; created?: { id: string; summary: string }[] }>(
      '/memories/seed-demo',
      { method: 'POST' }
    ),
  /** Extract a fine-grained submemolet into PostgreSQL and Neo4j */
  extractSubmemolet: (payload: { parent_id?: string; text: string; summary?: string; color?: string }) =>
    apiFetch<MemoletDTO>('/memories/extract-submemolet', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ── Chat endpoint ───────────────────────────────────────────────────────────

export interface ChatMessageDTO {
  id: string;
  role: 'user' | 'ai';
  content: string;
  citations?: string[];
  created_at: string;
}

export interface ConversationListResponse {
  id: string;
  title?: string;
  created_at: string;
}

export interface ConversationResponse extends ConversationListResponse {
  messages: ChatMessageDTO[];
}

export interface ChatRequest {
  message: string;
  active_memolet_ids: string[];
  model?: string;
  conversation_id?: string;
  spatial_instructions?: string;
}

export interface DeprecationWarning {
  memolet_id: string;
  temporal_anchor?: string;
  reason: string;
  suggested_update?: string;
}

export interface ChatResponse {
  reply: string;
  sentences: string[];
  confidence_heatmap: number[];
  citations: string[][];
  conflict_warning: boolean;
  conversation_id: string;
  model?: string;
  deprecation_warnings?: DeprecationWarning[];
}

export interface MemorySaveRequest {
  messages: { user: string; ai: string }[];
  conversation_id?: string;
}

export const auditorApi = {
  getTimeGrounding: () =>
    apiFetch<{ current_year: number; current_date_str: string; current_full_date: string; now_iso: string }>('/auditor/time-grounding'),
  verify: (memoletId: string) =>
    apiFetch<{
      id: string;
      is_time_sensitive: boolean;
      temporal_anchor?: string;
      is_deprecated: boolean;
      deprecation_reason?: string;
      suggested_update?: string;
      audited_at?: string;
    }>(`/auditor/verify/${memoletId}`, { method: 'POST' }),
  refresh: (memoletId: string) =>
    apiFetch<{
      status: string;
      id: string;
      summary: string;
      text: string;
      temporal_anchor?: string;
    }>(`/auditor/refresh/${memoletId}`, { method: 'POST' }),
};

export const chatApi = {
  send: (payload: ChatRequest) =>
    apiFetch<ChatResponse>('/chat/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  sendStream: async (
    payload: ChatRequest,
    onToken: (token: string) => void,
    onComplete: (data: {
      conversation_id: string;
      citations?: string[][];
      model?: string;
      confidence_heatmap?: number[];
      conflict_warning?: boolean;
      deprecation_warnings?: DeprecationWarning[];
    }) => void,
    onError: (err: Error) => void
  ) => {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('ReadableStream not supported');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.token) {
                onToken(data.token);
              }
              if (data.done) {
                onComplete(data);
              }
            } catch {
              // ignore partial json
            }
          }
        }
      }
    } catch (err: unknown) {
      onError(err instanceof Error ? err : new Error('Stream request failed'));
    }
  },
  saveMemory: (payload: MemorySaveRequest) =>
    apiFetch<{ message: string; saved: { id: string; summary: string }[] }>(
      '/chat/save-memory',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  getModels: () =>
    apiFetch<{ models: string[]; grouped?: Record<string, string[]>; default: string }>('/chat/models'),
  getConversations: () =>
    apiFetch<ConversationListResponse[]>('/chat/conversations'),
  getConversation: (id: string) =>
    apiFetch<ConversationResponse>(`/chat/conversations/${id}`),
  deleteConversation: (id: string) =>
    apiFetch<{ message: string }>(`/chat/conversations/${id}`, { method: 'DELETE' }),
};

// ── Cross-Platform Importer endpoints ───────────────────────────────────────

export interface TurnPairDTO {
  user: string;
  ai: string;
}

export interface PreviewImportResponse {
  title: string;
  source: string;
  turns: TurnPairDTO[];
  total_turns: number;
}

export interface CommitImportRequest {
  title?: string;
  turns: TurnPairDTO[];
  create_conversation?: boolean;
  save_to_memory?: boolean;
  generate_ai_summary?: boolean;
}

export interface CommitImportResponse {
  conversation_id?: string;
  title?: string;
  total_turns: number;
  saved_memolets_count: number;
  saved_memolets: Array<{ id: string; summary: string; color: string }>;
}

export const importApi = {
  preview: (payload: { url?: string; text?: string }) =>
    apiFetch<PreviewImportResponse>('/import/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  commit: (payload: CommitImportRequest) =>
    apiFetch<CommitImportResponse>('/import/commit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

