'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMemoletStore } from '@/store/useMemoletStore';
import { MessageSquareText, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

import { chatApi } from '@/lib/api';

type Message = {
  role: 'user' | 'ai';
  content: string;
  citations?: string[];
};

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'ai',
    content:
      'Begin your day with a leisurely snorkeling trip at Hanauma Bay Nature Preserve.\nThe entry fee is $7.50 per person.\nIt\'s a fantastic way to see Hawaii\'s vibrant marine life up close.\nRemember to reserve your spot ahead of time, especially during peak seasons.',
    citations: ['6_2', '5_5'],
  },
];

export default function RightSidebar() {
  const { rightSidebarOpen, setRightSidebarOpen, highlightNode, nodes } =
    useMemoletStore();

  const [activeTab, setActiveTab] = useState<'Chat' | 'Context'>('Chat');
  const [inputValue, setInputValue] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect @mention trigger
  useEffect(() => {
    const match = inputValue.match(/@(\w*)$/);
    if (match) {
      setShowMention(true);
      setMentionQuery(match[1].toLowerCase());
    } else {
      setShowMention(false);
      setMentionQuery('');
    }
  }, [inputValue]);

  const insertMention = useCallback(
    (id: string) => {
      setInputValue((prev) => prev.replace(/@\w*$/, `@${id} `));
      setShowMention(false);
      inputRef.current?.focus();
    },
    []
  );

  const filteredMemolets = nodes.filter(
    (m) =>
      m.id.toLowerCase().includes(mentionQuery) ||
      m.data?.keywords?.some((k: string) => k.toLowerCase().includes(mentionQuery))
  );

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    // Parse @mentioned memolet IDs from message
    const mentionedIds = [...text.matchAll(/@([\w]+)/g)].map((m) => m[1]);

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const data = await chatApi.send({
        message: text,
        active_memolet_ids: mentionedIds,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: data.reply ?? 'No response.',
          citations: data.citations?.flat() ?? [],
        },
      ]);
    } catch {
      // Graceful mock fallback — backend offline / not authenticated
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            content: `I received your message: "${text}"\n\n(Backend offline — showing mock reply. Start the FastAPI server to connect.)`,
          },
        ]);
      }, 400);
    } finally {
      setLoading(false);
    }
  }, [inputValue, loading]);

  // Collapsed state: floating button
  if (!rightSidebarOpen) {
    return (
      <div className="absolute bottom-6 right-6 z-50">
        <button
          onClick={() => setRightSidebarOpen(true)}
          className="p-4 bg-blue-500 rounded-2xl text-white shadow-lg hover:bg-blue-600 transition-transform hover:scale-105 active:scale-95"
          title="Open chat"
        >
          <MessageSquareText size={26} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[420px] flex flex-col h-[calc(100vh-2rem)] my-4 mr-4 rounded-2xl bg-white border border-gray-200 shadow-2xl z-40 overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-4 py-2">
        <div className="flex space-x-1">
          {(['Chat', 'Context'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition',
                activeTab === tab
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          onClick={() => setRightSidebarOpen(false)}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      {activeTab === 'Chat' ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fdfdfd]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col gap-1 max-w-[85%]',
                  msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                )}
              >
                <div
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                  )}
                >
                  {msg.content}

                  {/* Citation badges */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.citations.map((cite, j) => (
                        <span
                          key={j}
                          onMouseEnter={() => highlightNode(cite)}
                          onMouseLeave={() => highlightNode(null)}
                          className="inline-flex items-center text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-100 transition"
                        >
                          [{cite}]
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 mr-auto">
                <span className="flex gap-1">
                  <span className="animate-bounce delay-0">●</span>
                  <span className="animate-bounce delay-150">●</span>
                  <span className="animate-bounce delay-300">●</span>
                </span>
                Thinking…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="bg-white border-t border-gray-200 p-3 relative">
            {/* @mention autocomplete popup */}
            {showMention && (
              <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
                <div className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 sticky top-0 rounded-t-xl">
                  Select Memory
                </div>
                {filteredMemolets.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400">No memories match.</div>
                ) : (
                  filteredMemolets.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => insertMention(m.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition"
                    >
                      <span className="font-semibold text-gray-800">
                        {m.data.keywords.length > 0 ? '📝' : '📎'} {m.id}
                      </span>
                      <span className="ml-2 text-gray-400 text-xs">
                        {m.data.keywords.slice(0, 4).join(', ')}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="flex items-center gap-2 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 focus-within:border-blue-400 focus-within:bg-white transition shadow-sm">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !showMention && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                  if (e.key === 'Escape') setShowMention(false);
                }}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none text-gray-800"
                placeholder="Ask anything or use @ to cite a memory…"
                autoComplete="off"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || loading}
                className="mr-2 p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-lg transition"
                title="Send"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Context tab — shows active memolets */
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#fdfdfd]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Active Memolets ({nodes.length})
          </p>
          {nodes.length === 0 && (
            <p className="text-sm text-gray-400">No memolets loaded.</p>
          )}
          {nodes.map((n) => (
            <div
              key={n.id}
              onMouseEnter={() => highlightNode(n.id)}
              onMouseLeave={() => highlightNode(null)}
              className="p-3 rounded-xl border border-gray-100 bg-white shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition group"
              style={{ borderLeft: `4px solid ${n.data.color ?? '#e5e7eb'}` }}
            >
              <div className="text-xs font-bold text-gray-700 mb-1">{n.id}</div>
              <div className="text-xs text-gray-500 leading-snug">
                {n.data.keywords.join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
