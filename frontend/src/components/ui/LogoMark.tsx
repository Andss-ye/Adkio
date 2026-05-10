import adkioLogo from '@/assets/icons/adkio.png';

type Props = { className?: string; alt?: string };

export default function LogoMark({ className = 'w-8 h-8', alt = 'Adkio' }: Props) {
  return <img src={adkioLogo} alt={alt} className={`object-contain ${className}`} />;
}
