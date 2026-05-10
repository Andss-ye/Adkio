import { useState, useRef, useEffect } from 'react';
import type { StreamStatus } from '@/hooks/useCampaignStream';
import { Send, Sparkles } from '@/components/ui/Icons';

type Message = { role: 'user' | 'agent'; text: string };

const STATUS_LABELS: Record<StreamStatus, string> = {
  idle:       'Listo',
  streaming:  'Analizando…',
  plan_ready: 'Plan listo',
  approving:  'Lanzando…',
  launched:   'Campaña activa',
  error:      'Error',
};

const STATUS_COLORS: Record<StreamStatus, string> = {
  idle:       '#6B7280',
  streaming:  '#00d2ff',
  plan_ready: '#10b981',
  approving:  '#f59e0b',
  launched:   '#10b981',
  error:      '#ef4444',
};

const DEMO_PROMPT = 'Quiero llenar nuestro evento en Bogotá, 15 de junio, $200, somos exclusivos';

type Props = {
  status: StreamStatus;
  errorMsg: string | null;
  onSend: (prompt: string) => void;
};

export default function ChatPanel({ status, errorMsg, onSend }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', text: '¡Hola! Describí tu campaña en lenguaje natural y la configuro en segundos.' },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === 'streaming' || status === 'approving';

  useEffect(() => {
    if (status === 'plan_ready') {
      setMessages(prev => [...prev, { role: 'agent', text: 'Plan listo. Revisá el preview y aprobá cuando quieras.' }]);
    }
    if (status === 'launched') {
      setMessages(prev => [...prev, { role: 'agent', text: '¡Campaña creada! Revisá el reporte a la derecha.' }]);
    }
    if (status === 'error' && errorMsg) {
      setMessages(prev => [...prev, { role: 'agent', text: `Error: ${errorMsg}` }]);
    }
  }, [status, errorMsg]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim() || DEMO_PROMPT;
    if (!text || isStreaming) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-full border-r border-white/10">
      {/* Header */}
      <div className="h-10 flex items-center gap-2.5 px-4 border-b border-white/10">
        <Sparkles className="w-4 h-4 text-white/40" />
        <span className="text-xs font-medium text-white/70">Adkio</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
          <span className="text-[10px] text-white/40">{STATUS_LABELS[status]}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-white/10 text-white'
                : 'liquid-glass text-white/75'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="liquid-glass rounded-xl px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1 h-1 rounded-full bg-white/30 animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="liquid-glass rounded-xl flex items-end gap-2 p-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={isStreaming ? 'Procesando…' : DEMO_PROMPT}
            rows={2}
            className="flex-1 bg-transparent text-xs text-white placeholder-white/25 resize-none outline-none leading-relaxed no-scrollbar"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
            style={{ background: '#00d2ff' }}
          >
            <Send className="w-3 h-3 text-black" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-white/25 text-center">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
