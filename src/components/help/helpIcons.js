import { FileText, Package, ShieldCheck, Store, Tag, UserRound, MessagesSquare, HelpCircle } from 'lucide-react';

// Traduce el `icono` declarado en helpContent.js a un componente de lucide, para
// que el dataset siga siendo datos planos y no importe React.
const ICONS = {
  package: Package,
  tag: Tag,
  quote: MessagesSquare,
  store: Store,
  user: UserRound,
  policy: FileText,
  shield: ShieldCheck,
};

export function helpIcon(name) {
  return ICONS[name] || HelpCircle;
}

