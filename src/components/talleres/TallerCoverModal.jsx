import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Image as ImageIcon, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { fetchTallerCoverTemplates } from '../../services/talleresStorage';
import { apiErrorMessage } from '../../services/walletStorage';

/**
 * Selector de portada del taller: solo las portadas oficiales de taller, igual que el selector de la
 * tienda en `ProfileDashboard` (mismos estilos `store-cover-template-*`). No se aceptan portadas propias.
 */
export default function TallerCoverModal({ currentCover, saving, error, onClose, onSave }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    fetchTallerCoverTemplates()
      .then((list) => {
        if (!active) return;
        setTemplates(list);
        setSelectedId(list.find((template) => template.url === currentCover)?.id || null);
      })
      .catch((err) => { if (active) setLoadError(apiErrorMessage(err, 'No se pudieron cargar las portadas.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentCover]);

  const selected = templates.find((template) => template.id === selectedId) || null;
  const isCurrent = Boolean(selected && selected.url === currentCover);
  const message = error || loadError;

  return createPortal(
    <div
      className="store-cover-template-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section className="store-cover-template-modal" role="dialog" aria-modal="true" aria-labelledby="taller-cover-template-title">
        <header className="store-cover-template-header">
          <div className="store-cover-template-heading">
            <span className="store-cover-template-icon" aria-hidden="true"><ImageIcon size={22} /></span>
            <div>
              <span className="store-cover-template-eyebrow"><Sparkles size={13} /> Portadas oficiales RepuesTop</span>
              <h2 id="taller-cover-template-title">Elige la portada de tu taller</h2>
              <p>Se muestra en tu perfil y en tu tarjeta del buscador de talleres.</p>
            </div>
          </div>
          <button type="button" className="store-cover-template-close" onClick={onClose} disabled={saving} aria-label="Cerrar selector de portadas">
            <X size={20} />
          </button>
        </header>

        <div className="store-cover-template-body">
          <div className="store-cover-template-notice">
            <ShieldCheck size={17} />
            <span>Puedes escoger una de estas portadas. Tus fotos propias van en la galería del perfil.</span>
          </div>

          {loading ? (
            <div className="store-cover-template-loading"><Loader2 className="spin-icon" size={24} /> Cargando portadas...</div>
          ) : (
            <div className="store-cover-template-grid" role="radiogroup" aria-label="Portadas de taller disponibles">
              {templates.map((template) => {
                const isSelected = selectedId === template.id;
                return (
                  <button
                    type="button"
                    key={template.id}
                    className={`store-cover-template-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedId(template.id)}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <span className="store-cover-template-preview">
                      <img src={template.url} alt={`Vista previa: ${template.name}`} />
                      <span className="store-cover-template-check"><Check size={16} strokeWidth={3} /></span>
                    </span>
                    <span className="store-cover-template-copy">
                      <strong>{template.name}</strong>
                      <small>{template.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {message && <div className="store-cover-template-error" role="alert"><AlertTriangle size={16} /> {message}</div>}
        </div>

        <footer className="store-cover-template-footer">
          <span><ShieldCheck size={15} /> Imágenes alojadas de forma segura en Cloudflare R2</span>
          <div>
            <button type="button" className="btn-auth-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="button" className="btn-auth-primary" onClick={() => selected && onSave(selected.id)} disabled={!selected || isCurrent || saving}>
              {saving ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />}
              {saving ? 'Guardando...' : 'Usar esta portada'}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}
