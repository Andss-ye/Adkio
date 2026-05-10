type Props = {
  label: string;
  tag?: string;
};

export default function SectionEyebrow({ label, tag }: Props) {
  return (
    <div className="inline-flex items-center gap-3 text-xs text-white/60">
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      <span>{label}</span>
      {tag && (
        <span className="px-2 py-0.5 rounded-full border border-white/10 text-white/50">
          {tag}
        </span>
      )}
    </div>
  );
}
