import { useEffect, useRef } from 'react';
import { Clock, Smartphone, X } from 'lucide-react';

const DETAILS = [
  { label: 'Nombre oficial', value: 'RepuesTop: Repuestos por Patente' },
  { label: 'Compatibilidad', value: 'Para cualquier teléfono Android' },
  { label: 'Plataforma oficial', value: 'RepuesTop Chile' },
  { label: 'Mientras tanto', value: 'Web 100% disponible en tu computador o celular' },
];

export default function AndroidDownloadModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    openerRef.current = document.activeElement;
    cardRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="rt-modal" onClick={onClose}>
      <div
        ref={cardRef}
        className="rt-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rt-android-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="rt-modal__close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="rt-modal__badge">
          <Smartphone size={26} />
        </div>

        <span className="rt-eyebrow">Próximamente para Android</span>
        <h2 id="rt-android-title">La app de RepuesTop está en camino</h2>
        <p>
          Mientras se publica en Google Play Store, puedes usar exactamente las mismas funciones
          desde la plataforma web en tu computador o en el navegador de tu celular: buscar por
          patente, cotizar con tiendas, pagar seguro y retirar con tu PIN, sin instalar nada.
        </p>

        <dl className="rt-modal__details">
          {DETAILS.map((detail) => (
            <div key={detail.label}>
              <strong>{detail.label}</strong>
              <span>{detail.value}</span>
            </div>
          ))}
        </dl>

        <button type="button" className="rt-btn rt-btn--outline" onClick={onClose}>
          Continuar en la Web
        </button>

        <p className="rt-modal__note">
          <Clock size={14} />
          <span>
            La plataforma web cubre todas las funciones para compradores y casas de repuestos
            desde cualquier dispositivo.
          </span>
        </p>
      </div>
    </div>
  );
}
