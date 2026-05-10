import { useCampaignStream } from '@/hooks/useCampaignStream';
import ChatPanel from '@/components/app/ChatPanel';
import ReasoningPanel from '@/components/app/ReasoningPanel';
import CampaignPreview from '@/components/app/CampaignPreview';
import NoiseFilter from '@/components/ui/NoiseFilter';

export default function AppPage() {
  const { toolEvents, plan, status, errorMsg, launchResult, startStream, approveCampaign } =
    useCampaignStream();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#0a0a0a' }}>
      <NoiseFilter />

      {/* Window chrome */}
      <div className="h-9 flex items-center px-4 border-b border-white/10 bg-black/40 flex-shrink-0 relative">
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
        <div className="absolute left-1/2 -translate-x-1/2 text-xs text-white/40">
          Adkio — Generador de campañas
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '28% 42% 30%' }}>
        <ChatPanel
          status={status}
          errorMsg={errorMsg}
          onSend={(prompt) => startStream(prompt)}
        />
        <ReasoningPanel toolEvents={toolEvents} status={status} />
        <CampaignPreview
          plan={plan}
          status={status}
          launchResult={launchResult}
          onApprove={approveCampaign}
        />
      </div>
    </div>
  );
}
