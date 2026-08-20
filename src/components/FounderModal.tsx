import { useState, useEffect } from 'react';
import { Crown, X, Clock, ShieldCheck, CheckCircle2, Sparkles, ArrowRight, Percent, Award, Radar, Rocket } from 'lucide-react';

const BENEFITS = [
  { icon: Percent, gradient: 'linear-gradient(135deg, #0056bf, #10c8e8)', title: '5% de comisión por un año', text: 'Una tasa preferencial de solo 5% garantizada durante todo tu primer año en la plataforma.' },
  { icon: Award, gradient: 'linear-gradient(135deg, #071b45, #0056bf)', title: 'Distintivo en publicaciones', text: 'Un sello oficial de "Fundador" que destaca tu tienda y genera mayor confianza con compradores.' },
  { icon: Radar, gradient: 'linear-gradient(135deg, #7257ff, #10c8e8)', title: 'Mayor visibilidad en RepuesTop', text: 'Tus repuestos podrán aparecer destacados en las búsquedas por patente de la web y, más adelante, de la app móvil.' },
  { icon: Rocket, gradient: 'linear-gradient(135deg, #ffb800, #ff8a00)', title: 'Panel de ventas en la web', text: 'Carga y ordena tu inventario desde el panel web mientras preparamos la experiencia móvil.' }
];

export default function FounderModal({ isOpen, onClose, onApply }: { isOpen: boolean; onClose: () => void; onApply: () => void }) {
  const [show, setShow] = useState(false);
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      requestAnimationFrame(() => setShow(true));
    } else {
      setShow(false);
      const t = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!render) return null;

  return (
    <div
      className="founder-modal-overlay"
      onClick={onClose}
      style={{ opacity: show ? 1 : 0, transition: 'opacity 0.3s ease' }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="founder-modal"
        onClick={e => e.stopPropagation()}
        style={{
          transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
          opacity: show ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <button className="founder-modal-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        <div className="founder-modal-hero">
          <img className="founder-modal-seal" src="/about-assets/repuestop-icon.jpg" alt="" aria-hidden="true" />
          <span className="founder-modal-ribbon"><Sparkles size={13} /> Cupos limitados · Primera etapa</span>
          <div className="founder-modal-icon"><Crown size={30} strokeWidth={2.5} /></div>
          <h2>Sé una Tienda <em>Fundadora</em> RepuesTop</h2>
          <p>Estamos eligiendo a los primeros proveedores de repuestos del país. Súmate ahora y asegura beneficios exclusivos que no volverán a repetirse.</p>
          <div className="founder-modal-stats">
            <div><strong>5%</strong><span>Comisión fija</span></div>
            <div><strong>0$</strong><span>Costo de inscripción</span></div>
            <div><strong>24h</strong><span>Respuesta del equipo</span></div>
          </div>
        </div>

        <div className="founder-modal-body">
          <div className="founder-modal-grid">
            {BENEFITS.map((item, i) => (
              <div key={i} className="founder-modal-card">
                <span className="founder-modal-card-icon" style={{ background: item.gradient }}><item.icon size={22} strokeWidth={2} /></span>
                <div className="founder-modal-card-content">
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="founder-modal-cta">
            <div className="founder-modal-cta-urgency"><Clock size={15} /> Quedan pocos cupos para la primera etapa de fundadores</div>
            <button
              className="button"
              onClick={() => { onClose(); onApply(); }}
            >
              Quiero ser tienda fundadora <ArrowRight size={18} />
            </button>
            <div className="founder-modal-guarantees">
              <span><ShieldCheck size={14} /> Postulación gratuita</span>
              <span><CheckCircle2 size={14} /> Sin compromiso</span>
              <span><Clock size={14} /> Respuesta en 24h</span>
            </div>
          </div>

          <button className="founder-modal-skip" onClick={onClose}>Quizás más tarde</button>
        </div>
      </div>
    </div>
  );
}
