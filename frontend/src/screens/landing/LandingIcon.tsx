import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  ChevronRight,
  ExternalLink,
  Lock,
  Pill,
  Plus,
  QrCode,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

export type LandingIconName =
  | 'capsule'
  | 'shield'
  | 'plus'
  | 'warning'
  | 'qr'
  | 'lock'
  | 'chevron'
  | 'external';

const icons: Record<LandingIconName, ComponentType<LucideProps>> = {
  capsule: Pill,
  shield: ShieldCheck,
  plus: Plus,
  warning: TriangleAlert,
  qr: QrCode,
  lock: Lock,
  chevron: ChevronRight,
  external: ExternalLink,
};

interface LandingIconProps extends LucideProps {
  name: LandingIconName;
  size?: number;
}

export function LandingIcon({
  name,
  size = 24,
  strokeWidth = 1.8,
  ...rest
}: LandingIconProps) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />;
}
