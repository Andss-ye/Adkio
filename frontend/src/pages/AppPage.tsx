import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isLoggedIn, getAccount, logout as authLogout } from '@/lib/auth';
import { useCampaignStream, type StreamStatus, type PlatformHint, type ToolEvent } from '@/hooks/useCampaignStream';
import { useViewport } from '@/hooks/useViewport';
import Sidebar, { type SidebarSection } from '@/components/shell/Sidebar';
import TopBar from '@/components/shell/TopBar';
import PlatformIcon from '@/components/shell/PlatformIcon';
import {
  IcSparkle, IcCheck, IcReset, IcArrowRight, IcSend, IcMic, IcPlus,
  IcChevronDown,
} from '@/components/shell/icons';
import SettingsDrawer from '@/components/dashboard/SettingsDrawer';

const STATUS_LABELS: Record<StreamStatus, string> = {
  idle: 'Listo',
  streaming: 'Analizando…',
  plan_ready: 'Plan listo',
  approving: 'Lanzando…',
  launched: 'Campaña activa',
  error: 'Error',
};

const PLATFORMS: { value: PlatformHint; label: string }[] = [
  { value: 'auto', label: 'All channels' },
  { value: 'meta', label: 'Meta' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google_ads', label: 'Google' },
];

const DEMO_PROMPT =
  'Quiero llenar nuestro evento en Bogotá, 15 de junio, $200, somos exclusivos';

const SUGGESTIONS = [
  'Lower daily cap to $300',
  'Add a TikTok mirror',
  'Tighten the audience',
];

type ThreadMsg = {
  role: 'user' | 'ai';
  text: string;
  ts: string;
  chips?: string[];
};

type ColTab = 'chat' | 'reasoning' | 'draft';

function nowStamp(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function fmtDuration(t: ToolEvent): string {
  if (!t.finishedAt) return '…';
  const ms = t.finishedAt - t.startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function toolDisplayName(t: string): string {
  const map: Record<string, string> = {
    copy_generator: 'creative.generate',
    audience_analyzer: 'audience.build',
    budget_validator: 'budget.validate',
    campaign_validator: 'campaign.validate',
    campaign_launcher: 'campaign.deploy',
    report_generator: 'report.build',
    platform_recommender: 'platform.recommend',
  };
  return map[t] ?? t.replace(/_/g, '.');
}

export default function AppPage() {
  const {
    toolEvents, plan, status, errorMsg, launchResult,
    mode, backendHealth, startStream, approveCampaign, reset,
  } = useCampaignStream();

  const vp = useViewport();
  /** 3-col layout on xl, 2-col (chat + active panel) on lg, tab UX on md/sm */
  const useTabs = !vp.isXl && !vp.isLg;
  const useTwoCol = vp.isLg;
  const isOverlay = vp.isSm;

  const [collapseOverride, setCollapseOverride] = useState<boolean | null>(null);
  const collapsed = collapseOverride ?? (vp.isMd || vp.isLg);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const [input, setInput] = useState(
    () => sessionStorage.getItem('adkio.prefill_prompt') ?? '',
  );
  useEffect(() => {
    // Si venimos de "Refinar" en el dashboard, limpiamos el prefill ya consumido.
    if (sessionStorage.getItem('adkio.prefill_prompt')) {
      sessionStorage.removeItem('adkio.prefill_prompt');
    }
  }, []);
  const [platformHint, setPlatformHint] = useState<PlatformHint>('auto');
  const [thread, setThread] = useState<ThreadMsg[]>([
    {
      role: 'ai',
      ts: nowStamp(),
      text:
        '¡Hola! Soy Adkio. Describí tu campaña en lenguaje natural — defino audiencia, copy y presupuesto, y la dejo staged para que la apruebes.',
    },
  ]);
  /** which column to show when in tab mode (or which side panel when two-col) */
  const [activeTab, setActiveTab] = useState<ColTab>('chat');
  /** which side panel to show in two-col mode (right side toggles) */
  const [sidePanel, setSidePanel] = useState<'reasoning' | 'draft'>('draft');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, setLogged] = useState(isLoggedIn());
  const account = getAccount();

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-grow textarea */
  const autoSize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };
  useEffect(autoSize, [input]);

  /* When plan/launch ready, auto-focus the relevant panel */
  useEffect(() => {
    if (status === 'streaming' && useTabs) setActiveTab('reasoning');
    if (status === 'plan_ready') {
      if (useTabs) setActiveTab('draft');
      else if (useTwoCol) setSidePanel('draft');
    }
  }, [status, useTabs, useTwoCol]);

  /* Status-driven AI messages — append once per status change */
  useEffect(() => {
    if (status === 'plan_ready' && plan) {
      setThread((prev) =>
        prev.some((m) => m.role === 'ai' && m.text.startsWith('Plan listo'))
          ? prev
          : [
              ...prev,
              {
                role: 'ai', ts: nowStamp(),
                text: 'Plan listo. Revisá el draft y aprobá cuando quieras que lo deploye.',
                chips: ['Aprobar y deployar', 'Bajar presupuesto', 'Cambiar audiencia'],
              },
            ],
      );
    }
    if (status === 'launched' && launchResult) {
      setThread((prev) =>
        prev.some((m) => m.role === 'ai' && m.text.includes('campaign_id'))
          ? prev
          : [
              ...prev,
              {
                role: 'ai', ts: nowStamp(),
                text:
                  `¡Campaña creada! campaign_id = ${launchResult.campaign_id}. ` +
                  (launchResult.is_mock
                    ? 'Mock — sin credenciales conectadas. Conectá la plataforma para lanzar de verdad.'
                    : 'Está monitoreándola desde Ads Manager.'),
              },
            ],
      );
    }
    if (status === 'error' && errorMsg) {
      setThread((prev) =>
        prev.some((m) => m.role === 'ai' && m.text.startsWith('Error:'))
          ? prev
          : [...prev, { role: 'ai', ts: nowStamp(), text: `Error: ${errorMsg}` }],
      );
    }
  }, [status, plan, launchResult, errorMsg]);

  const isStreaming = status === 'streaming' || status === 'approving';

  const handleSend = (override?: string) => {
    const text = (override ?? input).trim() || DEMO_PROMPT;
    if (isStreaming) return;
    setThread((prev) => [...prev, { role: 'user', text, ts: nowStamp() }]);
    setInput('');
    startStream(text, 'demo-edu-latam', platformHint);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setThread([
      { role: 'ai', ts: nowStamp(), text: 'Listo para una nueva campaña. Describime el objetivo.' },
    ]);
    setInput('');
    reset();
    if (useTabs) setActiveTab('chat');
  };

  const handleNavigate = (s: SidebarSection) => {
    if (isOverlay) setOverlayOpen(false);
    if (s === 'new') return;
    if (s === 'connections') { setSettingsOpen(true); return; }
    window.location.href = '/dashboard';
  };

  const handleLogout = () => {
    authLogout();
    setLogged(false);
    window.location.href = '/';
  };

  const userName = account?.email?.split('@')[0] ?? 'Demo';
  const userInitials = (userName[0] ?? 'A').toUpperCase() + (userName[1] ?? 'D').toUpperCase();

  const compactBar = vp.isSm;

  const chatCol = (
    <ChatColumn
      thread={thread}
      input={input}
      onInput={setInput}
      onKeyDown={onKeyDown}
      onSend={() => handleSend()}
      isStreaming={isStreaming}
      inputRef={inputRef}
      threadRef={threadRef}
      platformHint={platformHint}
      onPlatformHint={setPlatformHint}
      statusLabel={STATUS_LABELS[status]}
      bordered={!useTabs}
    />
  );
  const reasoningCol = <ReasoningColumn toolEvents={toolEvents} status={status} />;
  const draftCol = (
    <DraftColumn
      plan={plan}
      launchResult={launchResult}
      status={status}
      platformHint={platformHint}
      onDeploy={() => approveCampaign()}
      onReset={handleReset}
      bordered={!useTabs}
    />
  );

  return (
    <div className="adkio-surface" style={{ height: '100vh', display: 'flex', minWidth: 0 }}>
      <Sidebar
        active="new"
        collapsed={collapsed}
        overlay={isOverlay}
        overlayOpen={overlayOpen}
        onToggleCollapsed={() => setCollapseOverride((v) => !(v ?? collapsed))}
        onCloseOverlay={() => setOverlayOpen(false)}
        onNavigate={handleNavigate}
        onOpenSettings={() => {
          setSettingsOpen(true);
          if (isOverlay) setOverlayOpen(false);
        }}
        userName={userName}
        userInitials={userInitials}
        counts={{}}
      />

      <main
        style={{
          background: 'var(--bg-main)',
          overflow: 'hidden',
          borderTopLeftRadius: vp.isSm ? 0 : 18,
          borderTop: vp.isSm ? 0 : '1px solid var(--hairline-soft)',
          borderLeft: vp.isSm ? 0 : '1px solid var(--hairline-soft)',
          marginTop: vp.isSm ? 0 : 8,
          marginRight: vp.isSm ? 0 : 8,
          flex: 1, display: 'grid', gridTemplateRows: 'auto 1fr',
          minWidth: 0,
        }}
      >
        <TopBar
          breadcrumb={
            vp.isXl
              ? [
                  { label: 'Workspace', href: '/dashboard' },
                  { label: 'Campaigns', href: '/dashboard' },
                  { label: 'New campaign' },
                ]
              : [{ label: 'New campaign' }]
          }
          userName={userName}
          userEmail={account?.email}
          userInitials={userInitials}
          onLogout={handleLogout}
          onOpenSettings={() => setSettingsOpen(true)}
          showHamburger={isOverlay}
          onHamburger={() => setOverlayOpen(true)}
          compact={compactBar}
          rightExtras={
            <>
              {vp.isXl && (
                <BackendBadge mode={mode} backendHealth={backendHealth} status={status} />
              )}
              {vp.isLg || vp.isXl ? (
                <button onClick={handleReset} style={ghostBtnStyle()}>
                  <IcReset width={13} height={13} /> Reset
                </button>
              ) : null}
              {vp.isXl && (
                <button onClick={() => (window.location.href = '/dashboard')} style={ghostBtnStyle()}>
                  <IcArrowRight width={13} height={13} /> Dashboard
                </button>
              )}
              <button
                onClick={() => approveCampaign()}
                disabled={status !== 'plan_ready'}
                style={primaryBtnStyle(status !== 'plan_ready')}
                title={status !== 'plan_ready' ? 'Plan must be ready before deploying' : 'Deploy now'}
              >
                <IcCheck width={13} height={13} />
                {vp.isSm ? 'Deploy' : 'Deploy campaign'}
              </button>
            </>
          }
        />

        {/* Tab strip on md/sm — wrapped in one grid child so 1fr applies to the section */}
        {useTabs && (
          <div
            style={{
              display: 'grid', gridTemplateRows: 'auto 1fr',
              minHeight: 0, overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex', gap: 4, padding: '8px 14px 0',
                borderBottom: '1px solid var(--hairline-soft)',
                background: 'rgba(20,21,23,.85)',
                overflowX: 'auto',
              }}
              className="no-scrollbar"
            >
              {([
                { k: 'chat', label: 'Conversation' },
                { k: 'reasoning', label: `Reasoning ${toolEvents.length ? `· ${toolEvents.length}` : ''}` },
                { k: 'draft', label: plan ? 'Draft · ready' : 'Draft' },
              ] as { k: ColTab; label: string }[]).map((t) => (
                <button
                  key={t.k}
                  onClick={() => setActiveTab(t.k)}
                  style={{
                    padding: '8px 12px', borderRadius: '8px 8px 0 0',
                    fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
                    color: activeTab === t.k ? 'var(--text)' : 'var(--text-2)',
                    background: activeTab === t.k ? 'var(--bg-card)' : 'transparent',
                    border: 0, cursor: 'pointer',
                    borderBottom: activeTab === t.k ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <section
              style={{
                display: 'flex', flexDirection: 'column',
                minHeight: 0, overflow: 'hidden',
              }}
            >
              {activeTab === 'chat' && chatCol}
              {activeTab === 'reasoning' && reasoningCol}
              {activeTab === 'draft' && draftCol}
            </section>
          </div>
        )}

        {/* Two-col on lg: chat fixed left + togglable side panel */}
        {useTwoCol && (
          <section
            style={{
              display: 'grid', gridTemplateColumns: '380px 1fr',
              height: '100%', minHeight: 0, overflow: 'hidden',
            }}
          >
            {chatCol}
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: 0, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex', gap: 4, padding: '8px 14px',
                  borderBottom: '1px solid var(--hairline-soft)',
                }}
              >
                {([
                  { k: 'reasoning' as const, label: `Reasoning ${toolEvents.length ? `· ${toolEvents.length}` : ''}` },
                  { k: 'draft' as const, label: plan ? 'Draft · ready' : 'Draft' },
                ]).map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setSidePanel(t.k)}
                    style={{
                      padding: '6px 12px', borderRadius: 7,
                      fontSize: 12.5, fontWeight: 500,
                      color: sidePanel === t.k ? 'var(--text)' : 'var(--text-2)',
                      background: sidePanel === t.k ? 'var(--bg-raised)' : 'transparent',
                      border: 0, cursor: 'pointer',
                      boxShadow: sidePanel === t.k ? 'inset 0 0 0 1px #2E3035' : 'none',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {sidePanel === 'reasoning' ? reasoningCol : draftCol}
            </div>
          </section>
        )}

        {/* Full 3-col on xl */}
        {vp.isXl && (
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(340px,380px) minmax(0,1fr) minmax(380px,440px)',
              height: '100%', minHeight: 0, overflow: 'hidden',
            }}
          >
            {chatCol}
            {reasoningCol}
            {draftCol}
          </section>
        )}
      </main>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/* ─────────────────────────── styles & helpers ─────────────────────────── */

function ghostBtnStyle(): React.CSSProperties {
  return {
    background: '#1A1B1F',
    border: '1px solid var(--hairline-soft)',
    padding: '7px 12px', borderRadius: 9,
    fontSize: 12.5, color: 'var(--text-2)',
    display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled
      ? 'rgba(74,143,255,.2)'
      : 'linear-gradient(135deg,#5b9dff,#2a6fdb)',
    color: '#fff',
    padding: '7px 14px', borderRadius: 9,
    fontSize: 12.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 8,
    boxShadow: disabled ? 'none' : '0 8px 18px -8px rgba(74,143,255,.55)',
    border: 0, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
  };
}

function BackendBadge({
  mode, backendHealth, status,
}: {
  mode: 'live' | 'mock';
  backendHealth: 'checking' | 'online' | 'offline';
  status: StreamStatus;
}) {
  const dotColor =
    backendHealth === 'online' ? '#7eb6ff' : backendHealth === 'offline' ? '#E8B260' : '#9A9BA1';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '5px 12px 5px 10px', borderRadius: 999,
        background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
        color: 'var(--text-2)', fontSize: 12, whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dotColor,
          boxShadow: backendHealth === 'online' ? '0 0 8px #7eb6ff, 0 0 0 4px rgba(126,182,255,.14)' : undefined,
        }}
      />
      {backendHealth === 'online'
        ? `Draft · ${mode === 'mock' ? 'mock data' : STATUS_LABELS[status]}`
        : backendHealth === 'offline'
        ? 'Demo mode (offline)'
        : 'Connecting…'}
    </span>
  );
}

/* ─────────────────────────── Column 1: Chat ─────────────────────────── */

function ChatColumn({
  thread, input, onInput, onKeyDown, onSend, isStreaming, inputRef, threadRef,
  platformHint, onPlatformHint, statusLabel, bordered,
}: {
  thread: ThreadMsg[];
  input: string;
  onInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isStreaming: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  threadRef: React.RefObject<HTMLDivElement>;
  platformHint: PlatformHint;
  onPlatformHint: (p: PlatformHint) => void;
  statusLabel: string;
  bordered: boolean;
}) {
  const [openPlatform, setOpenPlatform] = useState(false);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [thread, threadRef]);

  return (
    <div
      style={{
        display: 'grid', gridTemplateRows: 'auto 1fr auto',
        minHeight: 0, minWidth: 0,
        borderRight: bordered ? '1px solid var(--hairline-soft)' : 'none',
      }}
    >
      <ColHead title="Conversation" sub={`${thread.length} messages · ${statusLabel}`} />

      <div
        ref={threadRef}
        className="dark-scroll"
        style={{
          padding: 18, overflow: 'auto',
          display: 'flex', flexDirection: 'column', gap: 18,
          minHeight: 0,
        }}
      >
        {thread.map((m, i) => (
          <Message key={i} msg={m} />
        ))}
        {isStreaming && (
          <div style={{ display: 'flex', gap: 4, paddingLeft: 30 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 5, height: 5, borderRadius: '50%', background: '#7eb6ff',
                  animation: 'adkio-dot-pulse 1.2s infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '14px 18px 18px',
          borderTop: '1px solid var(--hairline-soft)',
          background: 'rgba(16,18,22,.6)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                onInput(s);
                inputRef.current?.focus();
              }}
              style={{
                fontSize: 11.5, color: 'var(--text-2)',
                background: 'rgba(255,255,255,.025)',
                border: '1px solid rgba(255,255,255,.06)',
                padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.borderColor = 'rgba(126,182,255,.3)';
                e.currentTarget.style.background = 'rgba(126,182,255,.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-2)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)';
                e.currentTarget.style.background = 'rgba(255,255,255,.025)';
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div
          style={{
            position: 'relative', borderRadius: 18, padding: 1.5,
            background:
              'conic-gradient(from var(--ang), #4a8fff 0%, #7eb6ff 18%, #2a6fdb 34%, #0b2a6e 50%, #1e5fd9 66%, #82c1ff 82%, #4a8fff 100%)',
            animation: 'adkio-ai-spin 5.5s linear infinite',
            filter: 'drop-shadow(0 8px 22px rgba(46,110,220,.28)) drop-shadow(0 0 36px rgba(74,143,255,.22))',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg,#15171C 0%,#101216 100%)',
              borderRadius: 16.5, padding: '12px 14px 10px',
              display: 'flex', flexDirection: 'column', gap: 10,
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(circle at 90% -20%, rgba(74,143,255,.1), transparent 50%)',
              }}
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder='Reply to Adkio — e.g. "Use 1% lookalike, add a TikTok mirror."'
              rows={1}
              disabled={isStreaming}
              style={{
                background: 'transparent', border: 0, outline: 0,
                color: 'var(--text)', font: 'inherit', fontSize: 14,
                width: '100%', resize: 'none',
                minHeight: 24, maxHeight: 160, lineHeight: 1.45, padding: 2,
                fontFamily: 'Geist, sans-serif',
              }}
            />
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                position: 'relative', zIndex: 1, flexWrap: 'wrap',
              }}
            >
              <button style={composerCircleBtn()} title="Attach">
                <IcPlus width={13} height={13} />
              </button>
              <PlatformPicker
                value={platformHint}
                onChange={onPlatformHint}
                open={openPlatform}
                setOpen={setOpenPlatform}
              />
              <span style={{ flex: 1 }} />
              <button style={composerCircleBtn(true)} title="Voice (coming soon)">
                <IcMic width={13} height={13} />
              </button>
              <button
                onClick={onSend}
                disabled={isStreaming || !input.trim()}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#5b9dff,#2a6fdb)',
                  display: 'grid', placeItems: 'center', cursor: 'pointer',
                  boxShadow: '0 6px 14px -6px rgba(74,143,255,.7), inset 0 1px 0 rgba(255,255,255,.3)',
                  border: 0,
                  opacity: isStreaming || !input.trim() ? 0.55 : 1,
                }}
                title="Send"
              >
                <IcSend width={13} height={13} style={{ color: '#fff' }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Channel/platform picker — uses a portal to escape the composer's `overflow:hidden`
 * (otherwise the menu opens upward and the top half gets clipped).
 */
function PlatformPicker({
  value, onChange, open, setOpen,
}: {
  value: PlatformHint;
  onChange: (v: PlatformHint) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const MENU_WIDTH = 180;
  const MENU_HEIGHT_APPROX = 4 + PLATFORMS.length * 32; // padding + each item

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Open upward by default; if not enough room above, open downward.
      const spaceAbove = r.top;
      let top = r.top - MENU_HEIGHT_APPROX - 6;
      if (spaceAbove < MENU_HEIGHT_APPROX + 12) top = r.bottom + 6;
      let left = r.left;
      // Keep menu within viewport
      if (left + MENU_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - MENU_WIDTH - 8;
      }
      if (left < 8) left = 8;
      setCoords({ left, top });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, MENU_HEIGHT_APPROX]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        style={composerPillBtn()}
        onClick={() => setOpen(!open)}
        title="Platform"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <IcSparkle width={12} height={12} />
        {PLATFORMS.find((p) => p.value === value)?.label}
        <IcChevronDown width={11} height={11} style={{ opacity: 0.55, marginLeft: 2 }} />
      </button>
      {open && coords && createPortal(
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          />
          <div
            role="listbox"
            style={{
              position: 'fixed',
              left: coords.left,
              top: coords.top,
              width: MENU_WIDTH,
              background: '#1A1B1F',
              border: '1px solid var(--hairline-soft)',
              borderRadius: 10, padding: 4,
              zIndex: 200,
              boxShadow: '0 24px 48px -12px rgba(0,0,0,.6)',
              fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {PLATFORMS.map((p) => {
              const selected = value === p.value;
              return (
                <button
                  key={p.value}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(p.value);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', textAlign: 'left',
                    padding: '8px 10px', borderRadius: 6,
                    fontSize: 12.5,
                    color: selected ? '#F1F1F3' : '#9A9BA1',
                    background: selected ? '#23252A' : 'transparent',
                    border: 0, cursor: 'pointer',
                    fontWeight: selected ? 500 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) {
                      (e.currentTarget as HTMLElement).style.background = '#1F2024';
                      (e.currentTarget as HTMLElement).style.color = '#F1F1F3';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = '#9A9BA1';
                    }
                  }}
                >
                  <span style={{ flex: 1 }}>{p.label}</span>
                  {selected && <IcCheck width={12} height={12} style={{ color: 'var(--accent)' }} />}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

function composerCircleBtn(noBorder?: boolean): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: '50%',
    background: noBorder ? 'transparent' : 'rgba(255,255,255,.04)',
    border: noBorder ? 0 : '1px solid rgba(255,255,255,.06)',
    display: 'grid', placeItems: 'center',
    color: 'var(--text-2)', cursor: 'pointer',
  };
}

function composerPillBtn(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 28, padding: '0 10px', borderRadius: 999,
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.06)',
    color: 'var(--text-2)', fontSize: 12, fontWeight: 500,
    cursor: 'pointer',
  };
}

function Message({ msg }: { msg: ThreadMsg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 11.5 }}>
        <span
          style={{
            width: 22, height: 22, borderRadius: 7,
            display: 'grid', placeItems: 'center',
            fontSize: 10.5, fontWeight: 600,
            background: isUser
              ? 'linear-gradient(135deg,#aab3c0,#6c7484)'
              : 'linear-gradient(135deg,#5b9dff,#2a6fdb)',
            color: isUser ? '#0A0F1A' : '#fff',
          }}
        >
          {isUser ? 'JD' : 'A'}
        </span>
        <b style={{ color: 'var(--text)', fontWeight: 500, fontSize: 12 }}>
          {isUser ? 'You' : 'Adkio'}
        </b>
        <time className="tab-num" style={{ marginLeft: 'auto' }}>{msg.ts}</time>
      </div>
      <div
        style={{
          background: isUser
            ? '#202126'
            : 'linear-gradient(180deg,#16202F 0%,#141A26 100%)',
          border: isUser
            ? '1px solid var(--hairline)'
            : '1px solid rgba(126,182,255,.18)',
          borderRadius: 12, padding: '11px 13px', fontSize: 13.5,
          color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word',
        }}
      >
        <p style={{ margin: 0 }}>{msg.text}</p>
        {msg.chips && msg.chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {msg.chips.map((c, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11, color: i === 0 ? '#9cc4ff' : 'var(--text-2)',
                  background:
                    i === 0 ? 'rgba(126,182,255,.07)' : 'rgba(255,255,255,.04)',
                  border:
                    i === 0
                      ? '1px solid rgba(126,182,255,.3)'
                      : '1px solid rgba(255,255,255,.06)',
                  padding: '3px 8px', borderRadius: 999,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Column header ─────────────────────────── */

function ColHead({ title, sub, icon }: { title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', borderBottom: '1px solid var(--hairline-soft)',
        background: 'rgba(16,18,22,.6)',
      }}
    >
      <span
        style={{
          width: 24, height: 24, borderRadius: 7,
          display: 'grid', placeItems: 'center', flex: 'none',
          background: 'rgba(74,143,255,.1)',
          border: '1px solid rgba(126,182,255,.18)',
          color: '#9cc4ff',
        }}
      >
        {icon ?? <IcSparkle width={13} height={13} />}
      </span>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '-.005em' }}>
        {title}
      </h3>
      {sub && (
        <span
          style={{
            color: 'var(--text-3)', fontSize: 11.5, marginLeft: 'auto',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────── Column 2: Reasoning ─────────────────────────── */

function ReasoningColumn({ toolEvents, status }: { toolEvents: ToolEvent[]; status: StreamStatus }) {
  const stepsLabel =
    toolEvents.length === 0
      ? 'idle'
      : status === 'streaming'
      ? `${toolEvents.length} steps · running`
      : `${toolEvents.length} steps · done`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <ColHead title="Reasoning & tool calls" sub={stepsLabel} icon={<IcSparkle width={13} height={13} />} />
      <div
        className="dark-scroll"
        style={{
          flex: 1, minHeight: 0, overflow: 'auto',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {toolEvents.length === 0 ? <EmptyReasoning /> : <Timeline events={toolEvents} terminal={status} />}
      </div>
    </div>
  );
}

function EmptyReasoning() {
  return (
    <div
      style={{
        margin: 'auto', textAlign: 'center', color: 'var(--text-3)',
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
        padding: '32px 24px',
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'rgba(74,143,255,.08)',
          border: '1px solid rgba(126,182,255,.18)',
          display: 'grid', placeItems: 'center',
          color: '#9cc4ff',
        }}
      >
        <IcSparkle width={20} height={20} />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>Esperando un prompt</p>
      <p style={{ margin: 0, fontSize: 11.5, maxWidth: 240, lineHeight: 1.5 }}>
        Cuando le pidas una campaña vas a ver cada paso del agente — think + tool calls +
        resultado — en vivo.
      </p>
    </div>
  );
}

function Timeline({ events, terminal }: { events: ToolEvent[]; terminal: StreamStatus }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          position: 'absolute', left: 7, top: 6, bottom: 6, width: 1,
          background: 'linear-gradient(180deg, rgba(126,182,255,.4), rgba(126,182,255,.08))',
        }}
      />
      {events.map((ev, i) => (
        <TimelineCard key={i} ev={ev} />
      ))}
      {terminal === 'plan_ready' && <DeployStaged />}
    </div>
  );
}

function TimelineCard({ ev }: { ev: ToolEvent }) {
  const isRunning = ev.status === 'running';
  const isDone = ev.status === 'done';
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--bg-card)',
        border: '1px solid var(--hairline)',
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
      }}
    >
      <div
        style={{
          position: 'absolute', left: -22, top: 14, width: 14, height: 14,
          borderRadius: '50%', background: isDone ? '#5b9dff' : '#0E1116',
          border: '2px solid ' + (isDone ? '#5b9dff' : isRunning ? '#7eb6ff' : 'rgba(126,182,255,.45)'),
          animation: isRunning ? 'adkio-dot-pulse 1.4s infinite' : 'none',
        }}
      />
      {isDone && (
        <div
          style={{
            position: 'absolute', left: -17, top: 18, width: 4, height: 7,
            borderRight: '1.5px solid #0A0F1A',
            borderBottom: '1.5px solid #0A0F1A',
            transform: 'rotate(45deg)',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, minWidth: 0 }}>
        <KindBadge kind="tool" />
        <b
          style={{
            fontWeight: 500, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          className="font-mono"
        >
          {toolDisplayName(ev.tool)}
        </b>
        <span
          className="tab-num"
          style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11, flexShrink: 0 }}
        >
          {fmtDuration(ev)}
        </span>
      </div>

      {ev.rationale && (
        <div style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word' }}>
          {ev.rationale}
        </div>
      )}

      {isDone && ev.result && (
        <div
          className="font-mono dark-scroll"
          style={{
            fontSize: 11.5,
            background: '#0E1014', border: '1px solid var(--hairline-soft)',
            borderRadius: 8, padding: '9px 10px',
            color: 'var(--text-2)', lineHeight: 1.5,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 160, overflow: 'auto',
          }}
        >
          {formatJsonish(ev.result)}
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: 'think' | 'tool' | 'deploy' }) {
  const map = {
    think: { color: '#bcd2ef', bg: 'rgba(126,182,255,.08)', border: 'rgba(126,182,255,.18)' },
    tool: { color: '#9cc4ff', bg: 'rgba(74,143,255,.1)', border: 'rgba(74,143,255,.22)' },
    deploy: { color: '#7CD992', bg: 'rgba(124,217,146,.08)', border: 'rgba(124,217,146,.22)' },
  } as const;
  const t = map[kind];
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 10.5, letterSpacing: '.04em',
        padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase',
        fontWeight: 500, flexShrink: 0,
        color: t.color, background: t.bg, border: `1px solid ${t.border}`,
      }}
    >
      {kind}
    </span>
  );
}

function DeployStaged() {
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg,#16202F 0%,#141A26 100%)',
        border: '1px solid rgba(126,182,255,.18)',
        borderRadius: 12, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div
        style={{
          position: 'absolute', left: -22, top: 14, width: 14, height: 14,
          borderRadius: '50%', background: '#0E1116',
          border: '2px solid rgba(126,182,255,.45)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
        <KindBadge kind="deploy" />
        <b style={{ fontWeight: 500, color: 'var(--text)' }} className="font-mono">
          campaign.deploy
        </b>
        <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11 }}>
          awaiting confirm
        </span>
      </div>
      <div style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55 }}>
        Staged for review. Click <b style={{ color: 'var(--text)' }}>Deploy campaign</b> at the top right
        to push to the platform.
      </div>
    </div>
  );
}

function formatJsonish(obj: Record<string, unknown> | unknown, depth = 0): string {
  if (obj == null) return 'null';
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') return `"${obj}"`;
    return String(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((v) => formatJsonish(v, depth + 1)).join(', ') + ']';
  }
  const entries = Object.entries(obj as Record<string, unknown>).filter(([k]) => k !== 'rationale');
  if (entries.length === 0) return '{}';
  const pad = '  '.repeat(depth);
  const inner = entries.map(([k, v]) => `${pad}  ${k}: ${formatJsonish(v, depth + 1)}`).join(',\n');
  return `{\n${inner}\n${pad}}`;
}

/* ─────────────────────────── Column 3: Draft ─────────────────────────── */

function DraftColumn({
  plan, launchResult, status, platformHint, onDeploy, onReset, bordered,
}: {
  plan: ReturnType<typeof useCampaignStream>['plan'];
  launchResult: ReturnType<typeof useCampaignStream>['launchResult'];
  status: StreamStatus;
  platformHint: PlatformHint;
  onDeploy: () => void;
  onReset: () => void;
  bordered: boolean;
}) {
  const platform: 'meta' | 'tiktok' | 'google_ads' =
    launchResult?.platform ??
    plan?.platform_recommendation?.platform ??
    (platformHint === 'auto' ? 'meta' : (platformHint as 'meta' | 'tiktok' | 'google_ads'));
  const shortId = launchResult?.campaign_id
    ? `CMP-${launchResult.campaign_id.slice(-6).toUpperCase()}`
    : 'CMP-DRAFT';

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
        borderLeft: bordered ? '1px solid var(--hairline-soft)' : 'none',
      }}
    >
      <ColHead title="Campaign draft" sub={`${shortId} · v1`} icon={<IcCheck width={13} height={13} />} />
      <div
        className="dark-scroll"
        style={{
          flex: 1, minHeight: 0, overflow: 'auto',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {plan ? (
          <>
            <SummaryCard plan={plan} platform={platform} />
            <AudienceCard plan={plan} />
            <CreativeCard plan={plan} />
            <ForecastCard plan={plan} launchResult={launchResult} />
            <DeployCard
              status={status}
              onDeploy={onDeploy}
              onReset={onReset}
              platform={platform}
              launchResult={launchResult}
            />
          </>
        ) : (
          <EmptyDraft />
        )}
      </div>
    </div>
  );
}

function ResultCard({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? 'linear-gradient(180deg,#16202F 0%,#141A26 100%)' : 'var(--bg-card)',
        border: '1px solid ' + (accent ? 'rgba(126,182,255,.18)' : 'var(--hairline)'),
        borderRadius: 14, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0,
      }}
    >
      <h4
        style={{
          margin: 0, fontSize: 11.5, textTransform: 'uppercase',
          letterSpacing: '.1em', color: accent ? '#9cc4ff' : 'var(--text-3)', fontWeight: 500,
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 0', borderBottom: '1px dashed var(--hairline-soft)',
        fontSize: 13, minWidth: 0,
      }}
    >
      <span style={{ color: 'var(--text-3)', width: 90, flex: 'none', fontSize: 12 }}>{label}</span>
      {icon}
      <span
        style={{
          color: 'var(--text)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryCard({
  plan, platform,
}: {
  plan: NonNullable<ReturnType<typeof useCampaignStream>['plan']>;
  platform: 'meta' | 'tiktok' | 'google_ads';
}) {
  const totalBudget = plan.budget?.presupuesto_diario_calculado != null
    ? plan.budget.presupuesto_diario_calculado * (plan.duracion_dias || 14)
    : 0;
  const platformName = platform === 'meta' ? 'Meta' : platform === 'tiktok' ? 'TikTok' : 'Google';
  const checklist = plan.validation?.checklist_results ?? {};
  const checkTotal = Object.keys(checklist).length;
  const checkPassed = Object.values(checklist).filter(Boolean).length;
  const reco = plan.platform_recommendation;
  return (
    <ResultCard title="Summary">
      <SummaryRow label="Name" value={plan.copy?.headline ?? 'Untitled campaign'} />
      <SummaryRow
        label="Platform"
        value={`${platformName} · Leads`}
        icon={<PlatformIcon platform={platform} size={18} variant="ticker" />}
      />
      <SummaryRow label="Geo" value={plan.targeting?.paises?.join(', ') || 'LATAM'} />
      <SummaryRow label="Audience" value={`${plan.targeting?.edad_min}–${plan.targeting?.edad_max} años`} />
      <SummaryRow label="Flight" value={`${plan.duracion_dias} días`} />
      <SummaryRow
        label="Budget"
        value={
          <span className="tab-num">
            ${plan.budget?.presupuesto_diario_calculado?.toFixed(0) ?? '0'} / día · total $
            {totalBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        }
      />
      {checkTotal > 0 && (
        <SummaryRow label="Validación" value={`${checkPassed}/${checkTotal} criterios OK`} />
      )}
      {reco?.rationale && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, paddingTop: 4 }}>
          Por qué {platformName}: {reco.rationale}
        </div>
      )}
    </ResultCard>
  );
}

function AudienceCard({ plan }: { plan: NonNullable<ReturnType<typeof useCampaignStream>['plan']> }) {
  const t = plan.targeting;
  const reachMax = 5_000_000;
  const reach = Math.max(1, t?.tamano_estimado ?? 1);
  const pct = Math.min(100, Math.round((reach / reachMax) * 100));
  return (
    <ResultCard title="Audience">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ArowItem label={`Geo · ${t?.paises?.join(', ') || 'LATAM'}`} />
        <ArowItem label={`Ages ${t?.edad_min}–${t?.edad_max}`} />
        <ArowItem
          label={`Interests · ${(t?.intereses ?? []).slice(0, 3).join(', ') || '—'}`}
          value={`${(t?.intereses ?? []).length}`}
        />
        <ArowItem label="Excluded" value={String((t?.exclusiones ?? []).length)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0 }}>Est. reach</span>
        <div
          style={{
            flex: 1, height: 6, borderRadius: 99,
            background: '#15171C', overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block', height: '100%',
              background: 'linear-gradient(90deg,#5b9dff,#7eb6ff)',
              borderRadius: 99, width: `${Math.max(8, pct)}%`,
            }}
          />
        </div>
        <b className="tab-num" style={{ fontSize: 12.5, flexShrink: 0 }}>
          {reach >= 1_000_000 ? `${(reach / 1_000_000).toFixed(1)}M` :
           reach >= 1_000 ? `${(reach / 1_000).toFixed(0)}k` : `${reach}`}
        </b>
      </div>
    </ResultCard>
  );
}

function ArowItem({ label, value }: { label: string; value?: string }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12.5, color: 'var(--text-2)',
        padding: '6px 0', borderBottom: '1px dashed var(--hairline-soft)',
        minWidth: 0,
      }}
    >
      <span
        style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {value && (
        <b className="tab-num" style={{ color: 'var(--text)', fontWeight: 500, flexShrink: 0 }}>
          {value}
        </b>
      )}
    </div>
  );
}

function CreativeCard({ plan }: { plan: NonNullable<ReturnType<typeof useCampaignStream>['plan']> }) {
  const c = plan.copy;
  if (!c) return null;
  // Sin generación de imágenes todavía → mostramos el copy real (headline/body/CTA),
  // no placeholders de creatividades vacías.
  return (
    <ResultCard title="Copy">
      <div
        style={{
          padding: '12px 14px', borderRadius: 10,
          background: '#15171C', border: '1px solid var(--hairline-soft)',
          fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, wordBreak: 'break-word',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        <b style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14.5, lineHeight: 1.25 }}>
          {c.headline}
        </b>
        <span>{c.body}</span>
        {c.cta && (
          <span
            style={{
              alignSelf: 'flex-start', marginTop: 2,
              fontSize: 11.5, padding: '4px 12px', borderRadius: 999,
              border: '1px solid rgba(126,182,255,.35)', color: '#9cc4ff',
            }}
          >
            {c.cta}
          </span>
        )}
      </div>
      {c.rationale && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
          {c.rationale}
        </div>
      )}
    </ResultCard>
  );
}

function ForecastCard({
  plan, launchResult,
}: {
  plan: NonNullable<ReturnType<typeof useCampaignStream>['plan']>;
  launchResult: ReturnType<typeof useCampaignStream>['launchResult'];
}) {
  const k = launchResult?.kpis;
  const leads = k?.expected_leads ?? Math.round((plan.targeting?.tamano_estimado ?? 0) * 0.001);
  const cpl = k?.cpl_usd ?? 0;
  const cplRange =
    k?.cpl_min_usd != null && k?.cpl_max_usd != null
      ? `$${Math.round(k.cpl_min_usd)}–$${Math.round(k.cpl_max_usd)}`
      : cpl > 0
        ? `$${cpl.toFixed(0)}`
        : '—';
  const budget = plan.budget?.presupuesto_diario_calculado ?? 0;
  const totalBudget = budget * (plan.duracion_dias || 14);
  return (
    <ResultCard title="Forecast">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <Bcell label="Leads est." value={`~${leads}`} sub={`en ${plan.duracion_dias} días`} up />
        <Bcell label="CPL est." value={cplRange} sub="USD / lead" />
        <Bcell label="Inversión" value={`$${budget.toFixed(0)}/d`} sub={`$${totalBudget.toFixed(0)} total`} />
      </div>
    </ResultCard>
  );
}

function Bcell({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div
      style={{
        background: '#15171C', border: '1px solid var(--hairline-soft)',
        borderRadius: 10, padding: 10, minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10.5, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '.08em',
        }}
      >
        {label}
      </div>
      <div
        className="tab-num"
        style={{
          fontSize: 18, fontWeight: 600, letterSpacing: '-.015em', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: up ? 'var(--pos)' : 'var(--text-2)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function DeployCard({
  status, onDeploy, onReset, platform, launchResult,
}: {
  status: StreamStatus;
  onDeploy: () => void;
  onReset: () => void;
  platform: 'meta' | 'tiktok' | 'google_ads';
  launchResult: ReturnType<typeof useCampaignStream>['launchResult'];
}) {
  if (status === 'launched' && launchResult) {
    return (
      <ResultCard title="Deployed" accent>
        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.55, wordBreak: 'break-word' }}>
          campaign_id =&nbsp;
          <code
            className="font-mono"
            style={{
              fontSize: 12, color: '#9cc4ff',
              background: 'rgba(74,143,255,.08)', padding: '1px 5px', borderRadius: 4,
            }}
          >
            {launchResult.campaign_id}
          </code>
          {launchResult.is_mock && (
            <>
              <br />
              ⚠ Mock — sin credenciales de {platform === 'meta' ? 'Meta' : platform === 'tiktok' ? 'TikTok' : 'Google'}. Conectá la plataforma para deployar de verdad.
            </>
          )}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onReset} style={{ ...primaryBtnStyle(false), flex: 1, minWidth: 140, justifyContent: 'center', padding: 10 }}>
            New campaign
          </button>
          <button
            onClick={() => {
              if (launchResult?.campaign_id) {
                sessionStorage.setItem('adkio.focus_campaign', launchResult.campaign_id);
              }
              window.location.href = '/dashboard';
            }}
            style={{ ...ghostBtnStyle() }}
          >
            View dashboard
          </button>
        </div>
      </ResultCard>
    );
  }

  return (
    <ResultCard title="Ready to deploy" accent>
      <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.55 }}>
        Adkio will publish the campaign and start monitoring CPL hourly. You can pause it
        from the dashboard at any time.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={onDeploy}
          disabled={status !== 'plan_ready'}
          style={{ ...primaryBtnStyle(status !== 'plan_ready'), flex: 1, minWidth: 140, justifyContent: 'center', padding: 10, fontSize: 13 }}
        >
          <IcCheck width={13} height={13} />
          {status === 'approving' ? 'Deploying…' : 'Deploy now'}
        </button>
        <button onClick={onReset} style={ghostBtnStyle()}>
          Save draft
        </button>
      </div>
    </ResultCard>
  );
}

function EmptyDraft() {
  return (
    <div
      style={{
        margin: 'auto', textAlign: 'center', color: 'var(--text-3)',
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
        padding: '32px 24px',
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg,#23252A,#1A1B1F)',
          border: '1px solid var(--hairline)',
          display: 'grid', placeItems: 'center',
          color: 'var(--text-3)',
        }}
      >
        <span
          style={{
            width: 26, height: 18,
            border: '2px dashed var(--text-3)', borderRadius: 4,
          }}
        />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>Sin draft</p>
      <p style={{ margin: 0, fontSize: 11.5, maxWidth: 280, lineHeight: 1.5 }}>
        Cuando el agente termine de planear la campaña, vas a ver acá summary, audiencia,
        creatividades y forecast.
      </p>
    </div>
  );
}
