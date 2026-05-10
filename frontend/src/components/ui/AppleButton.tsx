import AppleLogo from './AppleLogo';
import { ChevronRight } from './Icons';

type Props = {
  label?: string;
  full?: boolean;
  showApple?: boolean;
};

export default function AppleButton({
  label = 'Probar Adkio',
  full = false,
  showApple = false,
}: Props) {
  return (
    <button
      className={
        'group inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-medium text-sm px-5 py-3 transition-all hover:bg-white/90 active:scale-[0.98] ' +
        (full ? 'w-full' : '')
      }
    >
      {showApple && <AppleLogo className="w-4 h-4" />}
      <span>{label}</span>
      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-[1px]" />
    </button>
  );
}
