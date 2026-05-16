import { useCampaignStream } from '@/hooks/useCampaignStream';
import ChatPanel from '@/components/app/ChatPanel';
import ReasoningPanel from '@/components/app/ReasoningPanel';
import CampaignPreview from '@/components/app/CampaignPreview';
import NoiseFilter from '@/components/ui/NoiseFilter';
import { ChevronLeft } from '@/components/ui/Icons';

export default function AppPage() {
  const {
    toolEvents,
    plan,
    status,
    errorMsg,
    launchResult,
    mode,
    backendHealth,
    startStream,
    approveCampaign,
    reset,
  } = useCampaignStream();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#0a0a0a' }}>
      <NoiseFilter />

      {/* Window chrome */}
      <div className="h-9 flex items-center px-4 border-b border-white/10 bg-black/40 flex-shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => (window.location.href = '/')}
              className="w-3 h-3 rounded-full transition-opacity hover:opacity-75"
              style={{ background: '#ff5f57' }}
              title="Volver a la landing"
            />
            <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="group inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] text-white/60 hover:text-white/95 hover:bg-white/5 transition-colors"
            title="Volver al workspace"
          >
            <ChevronLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
            <span>Workspace</span>
          </button>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 text-xs text-white/40">
          Adkio — Generador de campañas
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${backendHealth === 'checking' ? 'animate-pulse' : ''}`}
            style={{
              background:
                backendHealth === 'online' ? '#10b981' : backendHealth === 'offline' ? '#f59e0b' : '#6B7280',
            }}
          />
          <span className="text-[10px] text-white/55">
            {backendHealth === 'online' && 'Backend online'}
            {backendHealth === 'offline' && 'Demo mode (backend offline)'}
            {backendHealth === 'checking' && 'Conectando…'}
          </span>
        </div>
      </div>

      {/* Banner si estamos en mock — explícito sobre por qué */}
      {backendHealth === 'offline' && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-amber-500/20 bg-amber-500/[0.05] text-[11px] text-amber-200/90 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            <strong>Modo demo:</strong> el backend de Adkio no responde en{' '}
            <code className="px-1 py-0.5 rounded bg-white/5">/health</code>.
            Estás viendo una simulación local con datos hardcodeados — el flujo y los rationales son los mismos
            que con la API real. Arrancá el backend con{' '}
            <code className="px-1 py-0.5 rounded bg-white/5">uvicorn backend.main:app --port 8000</code>
            {' '}para ver llamadas en vivo.
          </span>
        </div>
      )}

      {/* 3-panel layout — min-h-0 lets flex children shrink so overflow-y-auto works inside */}
      <div className="flex-1 grid min-h-0" style={{ gridTemplateColumns: '28% 42% 30%' }}>
        <ChatPanel
          status={status}
          errorMsg={errorMsg}
          mode={mode}
          onSend={(prompt) => startStream(prompt)}
        />
        <ReasoningPanel toolEvents={toolEvents} status={status} />
        <CampaignPreview
          plan={plan}
          status={status}
          launchResult={launchResult}
          onApprove={approveCampaign}
          onReset={reset}
        />
      </div>
    </div>
  );
}
