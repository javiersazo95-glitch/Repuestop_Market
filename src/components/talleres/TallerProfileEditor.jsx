import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Calendar, Camera, Car, ChevronRight, Clock, FileText, Home, ImagePlus, Loader2, MessageCircle,
  Pencil, Plus, Store, Wrench, X
} from 'lucide-react';
import { fetchMiTaller, updateMiTallerPerfil, uploadTallerPhotos } from '../../services/talleresStorage';
import { daysLeft, getDiagnosticStatus, getTallerInfo, prizeProgress, saveTallerInfo } from '../../services/workshopApi';
import { apiErrorMessage } from '../../services/walletStorage';
import { toMediaPath, updateAutomotiveServiceHoursApi, updateAutomotiveServiceLogoApi } from '../../services/api';
import { getAgendaConfigs } from '../../services/agendaConfigsStorage';
import { PRINCIPAL_AGENDA_ID } from '../../data/agendaConfig';
import { hoursFromRecord, toWorkshopHoursPayload, workshopHoursMissing } from '../../data/workshopHours';
import ConfirmDialog from '../ConfirmDialog';
import EditDialog from './EditDialog';
import PrincipalAgendaCard from './PrincipalAgendaCard';
import WorkshopHoursSection from './WorkshopHoursSection';
import './taller-editor.css';

const MAX_PHOTOS = 6;
// Mismos topes que `TallerInfoDTOs.Request` del backend.
const MAX_DESCRIPTION = 400;
const MAX_YEARS = 80;
const MAX_EQUIPMENT = 10;

const whatsappDigits = (taller) => String(taller?.whatsapp ?? '').replace(/\D/g, '').replace(/^56/, '').slice(0, 9);

/** Bajo «Recibir citas en línea»: días activos y búsquedas de repuestos hacia el próximo periodo gratis. */
function BookingProgress({ status }) {
  const days = daysLeft(status);
  const done = status.necesidadesPorGratis - status.necesidadesParaProximoGratis;
  return (
    <div className="taller-editor__progress">
      <div className="taller-editor__progress-track"><div style={{ width: `${Math.round(prizeProgress(status) * 100)}%` }} /></div>
      <p>
        <span>Gratis · {done}/{status.necesidadesPorGratis} búsquedas de repuestos</span>
        <strong className={status.activo && days > 3 ? 'is-ok' : 'is-warn'}>{status.activo ? (days === 1 ? '1 día activo' : `${days} días activos`) : 'Sin días activos'}</strong>
      </p>
    </div>
  );
}

/** Fila de un grupo: icono, titulo, resumen y una accion. Con `onClick`, toda la fila abre la edicion. */
function Row({ icon: Icon, title, summary, placeholder, attention, onClick, trailing, children }) {
  const text = <span className={`agenda-cfg-row-summary ${!summary && attention ? 'taller-editor__attention' : ''}`}>{summary || placeholder}</span>;
  return (
    <div className="taller-editor__row">
      <div className="agenda-cfg-row">
        <span className="agenda-cfg-row-ic"><Icon size={19} /></span>
        {onClick ? (
          <button type="button" className="agenda-cfg-row-main" onClick={onClick}>
            <span className="agenda-cfg-row-title">{title}</span>
            {text}
          </button>
        ) : (
          <div className="agenda-cfg-row-main" style={{ cursor: 'default' }}>
            <span className="agenda-cfg-row-title">{title}</span>
            {text}
          </div>
        )}
        {trailing}
      </div>
      {children}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="agenda-configs-section">
      <div className="agenda-cfg-head"><div className="agenda-cfg-head-txt"><strong>{title}</strong></div></div>
      <div className="agenda-cfg-list">{children}</div>
    </section>
  );
}

/**
 * «Mi perfil» del taller: portada y logo arriba y, por grupos, lo que los clientes ven en el buscador y en su perfil.
 * Cada fila resume lo registrado y se abre para editarlo; fotos e interruptores guardan al instante. Misma organizacion
 * que `mobile/components/talleres/WorkshopProfileDashboard.tsx`, con las piezas visuales de la web.
 *
 * - `record`: expediente aprobado (nombre, logo y horario declarado).
 * - `hasAgenda`: el taller ya registro su horario principal (requisito para recibir citas en linea).
 * - `only24Hours`: un taller solo 24/7 se contacta directo, sin agenda.
 */
export default function TallerProfileEditor({ record, businessName, hasAgenda, only24Hours = false, onOpenAgenda, onOpenServices, onSaved }) {
  const [taller, setTaller] = useState(null);
  const [infoData, setInfoData] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(null); // 'cover' | 'logo' | 'gallery' | 'flags'
  const [actionError, setActionError] = useState('');
  const [photoToRemove, setPhotoToRemove] = useState(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [dialog, setDialog] = useState(null); // 'info' | 'hours' | 'whatsapp'
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [infoForm, setInfoForm] = useState({ descripcion: '', anios: '', garantia: '', equipamiento: [] });
  const [hoursForm, setHoursForm] = useState(null);
  const [whatsappForm, setWhatsappForm] = useState('');
  const coverInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const load = useCallback(async ({ signal } = {}) => {
    const [profile, info] = await Promise.all([fetchMiTaller({ signal }), getTallerInfo()]);
    if (signal?.aborted) return;
    setTaller(profile);
    setInfoData(info);
    setLoadError('');
    getDiagnosticStatus().then(setBookingStatus).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal })
      .catch((error) => {
        if (error?.name === 'AbortError' || controller.signal.aborted) return;
        setLoadError(apiErrorMessage(error, 'No pudimos cargar el perfil de tu taller.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  const photos = taller?.photos || [];
  const cover = photos[0] || null;
  const gallery = photos.slice(1);
  const services = taller?.services || [];
  const brands = taller?.specialistBrands || [];
  const info = infoData?.info || {};
  const whatsapp = whatsappDigits(taller);
  const isPublished = services.length > 0;

  // Guarda un cambio directo (foto o interruptor) y deja el perfil como lo devolvio el backend.
  const run = async (kind, action) => {
    setBusy(kind);
    setActionError('');
    try {
      await action();
      await load();
      onSaved?.();
    } catch (error) {
      setActionError(apiErrorMessage(error, 'No se pudo guardar. Inténtalo nuevamente.'));
    } finally {
      setBusy(null);
    }
  };

  const pickedFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    return files;
  };

  const changeCover = (event) => {
    const [file] = pickedFiles(event);
    if (!file) return;
    run('cover', async () => {
      const [url] = await uploadTallerPhotos([file]);
      setTaller(await updateMiTallerPerfil({ photos: [url, ...photos.slice(1)] }));
    });
  };

  const changeLogo = (event) => {
    const [file] = pickedFiles(event);
    if (!file) return;
    run('logo', async () => {
      const [url] = await uploadTallerPhotos([file]);
      await updateAutomotiveServiceLogoApi(toMediaPath(url));
      setLogoFailed(false);
    });
  };

  const addGallery = (event) => {
    const files = pickedFiles(event).slice(0, MAX_PHOTOS - photos.length);
    if (files.length === 0) return;
    run('gallery', async () => {
      const urls = await uploadTallerPhotos(files);
      setTaller(await updateMiTallerPerfil({ photos: [...photos, ...urls].slice(0, MAX_PHOTOS) }));
    });
  };

  const confirmRemovePhoto = async () => {
    const index = photoToRemove;
    setPhotoToRemove(null);
    await run('gallery', async () => {
      setTaller(await updateMiTallerPerfil({ photos: photos.filter((_, i) => i !== index) }));
    });
  };

  // El interruptor cambia de inmediato; si el backend lo rechaza, `load` no corre y se vuelve al valor anterior.
  const saveFlag = (patch) => {
    const previous = taller;
    setTaller({ ...taller, ...patch });
    return run('flags', async () => {
      try {
        setTaller(await updateMiTallerPerfil(patch));
      } catch (error) {
        setTaller(previous);
        throw error;
      }
    });
  };

  const openDialog = async (kind) => {
    setDialogError('');
    if (kind === 'info') {
      setInfoForm({
        descripcion: info.descripcion || '',
        anios: info.aniosExperiencia != null ? String(info.aniosExperiencia) : '',
        garantia: info.garantia || '',
        equipamiento: Array.isArray(info.equipamiento) ? info.equipamiento : [],
      });
    }
    if (kind === 'whatsapp') setWhatsappForm(whatsapp);
    if (kind === 'hours') {
      const configs = await getAgendaConfigs().catch(() => []);
      setHoursForm(hoursFromRecord(record, configs.find((config) => config.id === PRINCIPAL_AGENDA_ID) || null));
    }
    setDialog(kind);
  };

  const saveDialog = async (action) => {
    setDialogBusy(true);
    setDialogError('');
    try {
      await action();
      await load();
      onSaved?.();
      setDialog(null);
    } catch (error) {
      setDialogError(apiErrorMessage(error, 'No se pudo guardar. Inténtalo nuevamente.'));
    } finally {
      setDialogBusy(false);
    }
  };

  const saveInfo = () => {
    const years = parseInt(infoForm.anios, 10);
    if (!infoForm.descripcion.trim()) return setDialogError('Cuéntales a los clientes quién eres en la descripción.');
    if (!Number.isFinite(years) || years > MAX_YEARS) return setDialogError(`Indica tus años de experiencia (entre 0 y ${MAX_YEARS}).`);
    if (!infoForm.garantia) return setDialogError('Elige la garantía que das a tus trabajos.');
    return saveDialog(() => saveTallerInfo({
      descripcion: infoForm.descripcion.trim(), aniosExperiencia: years, garantia: infoForm.garantia, equipamiento: infoForm.equipamiento,
    }));
  };

  const saveWhatsapp = () => {
    if (whatsappForm && whatsappForm.length !== 9) return setDialogError('El WhatsApp debe tener 9 dígitos.');
    return saveDialog(() => updateMiTallerPerfil({ whatsapp: whatsappForm ? `56${whatsappForm}` : '' }));
  };

  const saveHours = () => {
    const missing = workshopHoursMissing(hoursForm);
    if (missing.length > 0) return setDialogError(`Indica ${missing.join(', ')}.`);
    return saveDialog(() => updateAutomotiveServiceHoursApi(toWorkshopHoursPayload(hoursForm)));
  };

  const toggleEquipment = (item) => setInfoForm((current) => ({
    ...current,
    equipamiento: current.equipamiento.includes(item)
      ? current.equipamiento.filter((value) => value !== item)
      : [...current.equipamiento, item].slice(0, MAX_EQUIPMENT),
  }));

  if (loading) {
    return <div className="agenda-configs-section"><div className="agenda-cfg-loading"><Loader2 size={18} className="spin-icon" /> Cargando el perfil de tu taller…</div></div>;
  }
  if (loadError) {
    return <div className="agenda-configs-section"><div className="ad-form-error"><AlertTriangle size={15} /><span>{loadError}</span></div></div>;
  }

  const name = taller?.name || businessName || 'Tu taller';
  const logo = taller?.logo || null;
  const serviceNames = services.slice(0, 3).map((service) => service.name).join(' · ') + (services.length > 3 ? ` · +${services.length - 3}` : '');
  const hoursSummary = only24Hours ? 'Atención 24 horas' : taller?.hours;

  return (
    <div className="taller-editor">
      {actionError && <div className="ad-form-error" role="alert"><AlertTriangle size={15} /><span>{actionError}</span></div>}

      {/* Portada y logo */}
      <section className="agenda-configs-section taller-editor__identity" aria-label="Portada y logo del taller">
        <div className="taller-editor__cover">
          {cover ? <img src={cover} alt="Portada del taller" /> : <span className="taller-editor__cover-empty"><ImagePlus size={22} /> Agrega una portada</span>}
          <button type="button" className="agenda-cfg-icon taller-editor__cover-btn" aria-label="Cambiar portada" disabled={Boolean(busy)} onClick={() => coverInputRef.current?.click()}>
            {busy === 'cover' ? <Loader2 size={15} className="spin-icon" /> : <Camera size={15} />}
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={changeCover} />
        </div>
        <div className="taller-editor__who">
          <div className="taller-editor__logo">
            <span className="taller-editor__logo-img">{logo && !logoFailed ? <img src={logo} alt="Logo del taller" onError={() => setLogoFailed(true)} /> : <Store size={26} />}</span>
            <button type="button" className="agenda-cfg-icon" aria-label="Cambiar logo" disabled={Boolean(busy)} onClick={() => logoInputRef.current?.click()}>
              {busy === 'logo' ? <Loader2 size={14} className="spin-icon" /> : <Camera size={14} />}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={changeLogo} />
          </div>
          <div className="taller-editor__who-text">
            <strong>{name}</strong>
            <span className={isPublished ? 'is-on' : ''}>
              {isPublished ? 'Visible en talleres y servicios' : 'Aún no visible: agrega un servicio'}
              {taller?.commune ? ` · ${taller.commune}` : ''}
            </span>
          </div>
        </div>
      </section>

      <Group title="Presentación">
        <Row
          icon={FileText}
          title="Sobre tu taller"
          summary={info.descripcion}
          placeholder="Cuenta quién eres, tu experiencia y tu garantía"
          attention
          onClick={() => openDialog('info')}
          trailing={<button type="button" className="agenda-cfg-icon" aria-label="Editar sobre tu taller" onClick={() => openDialog('info')}><Pencil size={15} /></button>}
        />
        <Row
          icon={ImagePlus}
          title="Galería"
          summary={cover ? `${gallery.length} de ${MAX_PHOTOS - 1} fotos del taller y trabajos terminados` : 'Agrega primero la portada; después, fotos del taller y trabajos terminados'}
          trailing={
            <button type="button" className="agenda-cfg-icon" aria-label="Agregar fotos a la galería" disabled={Boolean(busy) || photos.length >= MAX_PHOTOS || !cover} title={cover ? undefined : 'Agrega primero la portada'} onClick={() => galleryInputRef.current?.click()}>
              {busy === 'gallery' ? <Loader2 size={15} className="spin-icon" /> : <Plus size={15} />}
            </button>
          }
        >
          <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={addGallery} />
          {gallery.length > 0 && (
            <div className="taller-editor__photos">
              {gallery.map((src, index) => (
                <div className="taller-editor__photo" key={`${src}-${index}`}>
                  <img src={src} alt={`Foto ${index + 1} del taller`} />
                  <button type="button" onClick={() => setPhotoToRemove(index + 1)} aria-label={`Quitar foto ${index + 1}`}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </Row>
      </Group>

      <Group title="Lo que ofreces">
        <Row
          icon={Wrench}
          title="Servicios y precios"
          summary={services.length > 0 ? serviceNames : null}
          placeholder="Agrega tu primer servicio para publicarte"
          attention
          onClick={() => onOpenServices?.(false)}
          trailing={
            <>
              <button type="button" className="agenda-cfg-icon" aria-label="Agregar un servicio" onClick={() => onOpenServices?.(true)}><Plus size={15} /></button>
              <ChevronRight size={16} color="#64748b" />
            </>
          }
        />
        <Row
          icon={Car}
          title="Marcas especialistas"
          summary={brands.length > 0 ? brands.join(' · ') : null}
          placeholder="Multimarca: atiendes todas las marcas. Se definen en cada servicio."
        />
      </Group>

      <Group title="Atención y citas">
        <Row
          icon={Clock}
          title="Horario de atención"
          summary={hoursSummary}
          placeholder="Registra cuándo atiendes"
          attention
          onClick={() => openDialog('hours')}
          trailing={<button type="button" className="agenda-cfg-icon" aria-label="Editar horario de atención" onClick={() => openDialog('hours')}><Pencil size={15} /></button>}
        />
        {!only24Hours && <PrincipalAgendaCard compact onSaved={() => { load().catch(() => {}); onSaved?.(); }} />}
        <Row
          icon={Calendar}
          title="Recibir citas en línea"
          summary={only24Hours
            ? 'Un taller que atiende solo 24/7 se contacta directo.'
            : hasAgenda ? 'Los clientes reservan dentro de tu horario principal.' : null}
          placeholder={<>Primero registra tu horario. <button type="button" className="taller-editor__inline-link" onClick={onOpenAgenda}>Registrar horario</button></>}
          trailing={
            <input
              type="checkbox"
              className="taller-editor__check"
              aria-label="Recibir citas en línea"
              checked={Boolean(taller?.hasOnlineBooking) && !only24Hours}
              disabled={only24Hours || !hasAgenda || busy === 'flags'}
              onChange={(event) => saveFlag({ hasOnlineBooking: event.target.checked })}
            />
          }
        >
          {taller?.hasOnlineBooking && !only24Hours && bookingStatus && <BookingProgress status={bookingStatus} />}
        </Row>
        <Row
          icon={Home}
          title="Voy a domicilio"
          summary="Dentro de la comuna de tu taller."
          trailing={
            <input
              type="checkbox"
              className="taller-editor__check"
              aria-label="Voy a domicilio"
              checked={Boolean(taller?.homeService)}
              disabled={busy === 'flags'}
              onChange={(event) => saveFlag({ homeService: event.target.checked })}
            />
          }
        />
        <Row
          icon={MessageCircle}
          title="WhatsApp para tus citas"
          summary={whatsapp ? `+56 ${whatsapp}` : null}
          placeholder="Solo lo ven los clientes que ya agendaron contigo, en su confirmación"
          onClick={() => openDialog('whatsapp')}
          trailing={<button type="button" className="agenda-cfg-icon" aria-label="Editar WhatsApp" onClick={() => openDialog('whatsapp')}><Pencil size={15} /></button>}
        />
      </Group>

      {dialog === 'info' && (
        <EditDialog icon={FileText} title="Sobre tu taller" subtitle="Una presentación breve que ayuda al cliente a elegirte." busy={dialogBusy} error={dialogError} saveLabel="Guardar" onClose={() => setDialog(null)} onSave={saveInfo}>
          <div className="form-group">
            <label htmlFor="taller-info-description">Descripción</label>
            <textarea
              id="taller-info-description"
              rows={4}
              maxLength={MAX_DESCRIPTION}
              value={infoForm.descripcion}
              placeholder="Ej: Taller familiar con 15 años en Maipú. Especialistas en frenos y suspensión; entregamos presupuesto antes de cada trabajo."
              onChange={(event) => setInfoForm({ ...infoForm, descripcion: event.target.value })}
            />
            <small className="taller-editor__counter">{infoForm.descripcion.length}/{MAX_DESCRIPTION}</small>
          </div>
          <div className="taller-editor__pair">
            <div className="form-group">
              <label htmlFor="taller-info-years">Años de experiencia</label>
              <input id="taller-info-years" type="text" inputMode="numeric" maxLength={2} value={infoForm.anios} placeholder="Ej: 10" onChange={(event) => setInfoForm({ ...infoForm, anios: event.target.value.replace(/\D/g, '') })} />
            </div>
            <div className="form-group">
              <label htmlFor="taller-info-warranty">Garantía de tus trabajos</label>
              <select id="taller-info-warranty" value={infoForm.garantia} onChange={(event) => setInfoForm({ ...infoForm, garantia: event.target.value })}>
                <option value="">Selecciona</option>
                {(infoData?.opcionesGarantia || []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Equipamiento (opcional)</label>
            <div className="taller-editor__checks">
              {(infoData?.opcionesEquipamiento || []).map((item) => (
                <label key={item} className={infoForm.equipamiento.includes(item) ? 'is-on' : ''}>
                  <input type="checkbox" checked={infoForm.equipamiento.includes(item)} onChange={() => toggleEquipment(item)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </EditDialog>
      )}

      {dialog === 'hours' && hoursForm && (
        <EditDialog icon={Clock} title="Horario de atención" subtitle="Cuándo atiendes y si ofreces urgencias 24/7." busy={dialogBusy} error={dialogError} saveLabel="Guardar horario" onClose={() => setDialog(null)} onSave={saveHours}>
          <WorkshopHoursSection value={hoursForm} onChange={setHoursForm} disabled={dialogBusy} idPrefix="taller-hours" />
        </EditDialog>
      )}

      {dialog === 'whatsapp' && (
        <EditDialog icon={MessageCircle} title="WhatsApp para tus citas" subtitle="Los clientes lo ven solo después de agendar contigo, junto a la confirmación de su cita." busy={dialogBusy} error={dialogError} saveLabel="Guardar" onClose={() => setDialog(null)} onSave={saveWhatsapp}>
          <div className="form-group">
            <label htmlFor="taller-whatsapp">Número de WhatsApp</label>
            <div className="taller-editor__phone">
              <span>+56</span>
              <input id="taller-whatsapp" type="tel" inputMode="numeric" maxLength={9} placeholder="9XXXXXXXX" value={whatsappForm} onChange={(event) => setWhatsappForm(event.target.value.replace(/\D/g, '').slice(0, 9))} />
            </div>
            <small>Déjalo vacío si no quieres compartirlo.</small>
          </div>
        </EditDialog>
      )}

      <ConfirmDialog
        isOpen={photoToRemove != null}
        title="¿Quitar esta foto?"
        message="La foto dejará de mostrarse en tu perfil."
        confirmLabel="Sí, quitar"
        cancelLabel="No, volver"
        onConfirm={confirmRemovePhoto}
        onCancel={() => setPhotoToRemove(null)}
      />
    </div>
  );
}
