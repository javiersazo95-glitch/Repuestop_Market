import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Camera, Check, CreditCard, Image as ImageIcon, Info, Lock, Mail,
  Pencil, Phone, Save, Search, Truck, Wallet, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getVehicleBrandsApi, updateStoreSpecialistBrandsApi, updateSellerShippingMethodsApi } from '../services/api';
import { qk } from '../services/queryKeys';
import ShippingMethodsPicker from './ShippingMethodsPicker';
import BuyerAddressBook from './BuyerAddressBook';
import VehicleBrandLogo from './VehicleBrandLogo';
import SellerVerificationCard from './SellerVerificationCard';
import { getShippingIconConfig } from './NewOnboardedStoresSection';
import {
  SHIPPING_METHOD_DEFS, parseShippingSelections, buildShippingMethodsString,
} from '../data/shippingMethods';
import { formatRut, isValidRut, isValidClPhone } from '../services/adapters';
import { helpContactPath } from '../routes/paths';

/** Deja pasar solo dígitos y, si estaba al inicio, un único "+" (prefijo de país). */
function sanitizePhoneInput(rawValue) {
  const value = String(rawValue || '');
  const hasLeadingPlus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '');
  return (hasLeadingPlus ? '+' : '') + digits;
}

/**
 * Pestaña "Mi Tienda, Perfil y Datos Bancarios" / "Mis Datos y Perfil" del panel de
 * perfil. Extraida de ProfileDashboard: es la pieza mas grande de las 4 etapas
 * porque, ademas de la vista y el formulario de edicion, incluye el modal de
 * "marcas especialistas" (exclusivo de este formulario). `storeInfo` y
 * `effectiveSellerId` siguen viniendo del padre porque los usan tambien el
 * resumen y el header de la tienda; cambiar logo/portada tambien siguen en el
 * padre (el boton "Editar Portada" del hero los dispara igual) y llegan como
 * callbacks.
 */
export default function ProfileAccountDataPanel({
  user,
  isSeller,
  storeInfo,
  effectiveSellerId,
  setActiveTab,
  onOpenMediaModal,
  onOpenCoverTemplates,
}) {
  const { updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.userName || user?.nombre || '');
  const [phoneDraft, setPhoneDraft] = useState(user?.phone || user?.telefono || '');
  const [taxIdDraft, setTaxIdDraft] = useState(user?.taxId || '');
  const [shippingSelectionsDraft, setShippingSelectionsDraft] = useState(() => parseShippingSelections(''));
  const [specialistBrandIdsDraft, setSpecialistBrandIdsDraft] = useState([]);
  const [availableVehicleBrands, setAvailableVehicleBrands] = useState([]);
  const [showSpecialistBrandsModal, setShowSpecialistBrandsModal] = useState(false);
  const [specialistBrandSearch, setSpecialistBrandSearch] = useState('');

  // Direcciones: `RT_tienda` se actualiza sola al guardar en BuyerAddressBook.jsx;
  // esto refresca storeInfo en el perfil para que los datos de la tienda se vean
  // al tiro sin esperar a un reload completo de la pagina.
  const refreshStoreInfoAfterAddressSync = useCallback(() => {
    if (!isSeller || !effectiveSellerId) return;
    queryClient.invalidateQueries({ queryKey: qk.sellerStore(effectiveSellerId) });
  }, [isSeller, effectiveSellerId, queryClient]);

  useEffect(() => {
    if (!isSeller || !isEditing || availableVehicleBrands.length) return;
    let cancelled = false;
    getVehicleBrandsApi()
      .then((brands) => {
        if (!cancelled) setAvailableVehicleBrands(Array.isArray(brands) ? brands : []);
      })
      .catch((error) => console.warn('No se pudieron cargar las marcas de vehículo:', error));
    return () => { cancelled = true; };
  }, [isSeller, isEditing, availableVehicleBrands.length]);

  // Mismas reglas que ya existen en el resto de la app: el chequeo de dígito
  // verificador del RUT es el que usa Retirar dinero (src/services/adapters.js),
  // y el celular sigue el formato chileno estándar (9 + 8 dígitos).
  const validateProfileForm = () => {
    const errors = {};

    if (nameDraft.trim().length < 2) {
      errors.name = 'Ingresa un nombre válido.';
    }

    if (phoneDraft.trim() && !isValidClPhone(phoneDraft)) {
      errors.phone = 'Ingresa un celular chileno válido, ej: +56 9 1234 5678.';
    }

    if (!isSeller) {
      if (!taxIdDraft.trim()) {
        errors.taxId = 'Ingresa tu RUT.';
      } else if (!isValidRut(taxIdDraft)) {
        errors.taxId = 'El RUT ingresado no es válido.';
      }
    }

    if (isSeller) {
      // La dirección comercial (con región/comuna) ya no se valida acá: se
      // edita y se valida una sola vez en BuyerAddressBook, más abajo.
      const hasShippingMethod = SHIPPING_METHOD_DEFS.some((def) => shippingSelectionsDraft[def.id]?.enabled);
      if (!hasShippingMethod) {
        errors.shippingMethods = 'Selecciona al menos un método de envío.';
      }
    }

    return errors;
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    const validationErrors = validateProfileForm();
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSaveStatus({ type: 'error', message: 'Revisa los campos marcados antes de guardar.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    const payload = {
      userName: nameDraft,
      phone: phoneDraft,
    };

    if (!isSeller) {
      payload.taxId = taxIdDraft;
    }

    // Nombre y RUT de la tienda ya no se editan desde este formulario (ver
    // bloque de solo lectura más abajo): son datos de identidad que deben
    // cambiarse a través de soporte, no con un input libre. La dirección
    // comercial (address/comunaId) tampoco se envía desde acá: BuyerAddressBook
    // ya la sincroniza directamente al guardar una dirección de despacho.
    //
    // Los métodos de envío NO van en `payload`: `ActualizarPerfilRequestDTO` no
    // tiene ese campo y el PATCH los descartaba en silencio. El único que los
    // persiste es `PUT /proveedores/{id}/shipping-methods`.
    const shippingMethodsDraft = isSeller
      ? buildShippingMethodsString(shippingSelectionsDraft)
      : null;

    let result;
    try {
      if (isSeller) {
        await updateStoreSpecialistBrandsApi(user.sellerId, specialistBrandIdsDraft);
        if (shippingMethodsDraft) {
          // Sin `.catch()`: si esto falla, el usuario tiene que enterarse. Antes se
          // tragaba el error y el aviso de "actualizado correctamente" salía igual,
          // que es justo el modo de falla silenciosa que este endpoint vino a cerrar.
          await updateSellerShippingMethodsApi(user.sellerId, shippingMethodsDraft);
        }
      }
      result = await updateProfile(payload);
    } catch (error) {
      setIsSaving(false);
      setSaveStatus({ type: 'error', message: error?.message || 'No se pudo actualizar la información de la tienda.' });
      return;
    }
    setIsSaving(false);

    if (result.success) {
      // El backend es la fuente autoritativa de la tienda (comuna/región vienen
      // con nombre resuelto), así que se refetchea storeInfo desde React Query.
      if (isSeller && effectiveSellerId) {
        queryClient.invalidateQueries({ queryKey: qk.sellerStore(effectiveSellerId) });
      }
      setSaveStatus({ type: 'success', message: 'Los datos de tu tienda y perfil se actualizaron correctamente.' });
      setIsEditing(false);
    } else {
      setSaveStatus({ type: 'error', message: result.error || 'No se pudo actualizar la información.' });
    }
  };

  return (
    <>
      <div className="profile-panel">
        <div className="profile-panel-header-row">
          <h2 className="profile-panel-title">
            {isSeller ? 'Mi Tienda, Perfil y Datos Bancarios' : 'Mis Datos y Perfil'}
          </h2>
          {!isEditing && (
            <button
              className="btn-edit-profile"
              onClick={() => {
                setIsEditing(true);
                setSaveStatus(null);
                setFormErrors({});
                setNameDraft(user?.userName || user?.nombre || '');
                setPhoneDraft(user?.phone || user?.telefono || '');
                setTaxIdDraft(storeInfo?.taxId || user?.taxId || '');
                setShippingSelectionsDraft(parseShippingSelections(storeInfo?.shippingMethods));
                setSpecialistBrandIdsDraft((storeInfo?.marcasEspecialistas || []).map((brand) => String(brand.id)));
              }}
            >
              <Pencil size={14} /> Editar Información
            </button>
          )}
        </div>

        {saveStatus && (
          <div className={`auth-alert ${saveStatus.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ margin: '0 0 16px' }}>
            {saveStatus.type === 'success' ? <Check size={16} /> : <X size={16} />}
            <span>{saveStatus.message}</span>
          </div>
        )}

        {isEditing ? (
          <form className="profile-data-form unified-profile-form" onSubmit={handleSaveProfile}>
            <div className="form-section-title">Datos Personales y de Contacto</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label>
                  {isSeller ? 'Nombre Completo / Representante' : 'Nombre Completo'}
                  <span className="char-counter">{nameDraft.length}/80</span>
                </label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={80}
                  required
                  className={formErrors.name ? 'input-invalid' : ''}
                />
                {formErrors.name && <small className="field-error-text">{formErrors.name}</small>}
              </div>
              <div className="form-group">
                <label>
                  Teléfono Móvil
                  <span className="char-counter">{phoneDraft.length}/20</span>
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(sanitizePhoneInput(e.target.value))}
                  placeholder="+56 9 1234 5678"
                  maxLength={20}
                  className={formErrors.phone ? 'input-invalid' : ''}
                />
                {formErrors.phone && <small className="field-error-text">{formErrors.phone}</small>}
                <small className="form-helper-text">Solo números y, al inicio, el signo + (código de país).</small>
              </div>
            </div>
            {!isSeller && (
              <div className="form-group">
                <label>
                  RUT / Identificador Fiscal
                  <span className="char-counter">{taxIdDraft.length}/12</span>
                </label>
                <input
                  type="text"
                  value={taxIdDraft}
                  onChange={(e) => setTaxIdDraft(formatRut(e.target.value))}
                  placeholder="12.345.678-K"
                  maxLength={12}
                  required
                  className={formErrors.taxId ? 'input-invalid' : ''}
                />
                {formErrors.taxId && <small className="field-error-text">{formErrors.taxId}</small>}
              </div>
            )}

            {/* La dirección comercial de despacho (con región/comuna) ya se
                edita una sola vez, más abajo, en "Gestión de Direcciones" — ese
                widget sincroniza automáticamente comuna/región con la tienda al
                guardar (ver refreshStoreInfoAfterAddressSync). Repetirla acá
                arriba como un segundo input de texto libre era una segunda fuente
                de verdad para el mismo dato, y confundía cuál mandaba. */}

            {isSeller && (
              <>
                <div className="form-section-title" style={{ marginTop: '20px' }}>Datos de la Tienda</div>
                {/* Nombre y RUT son la identidad legal de la tienda ya verificada:
                    se muestran de solo lectura y cualquier cambio pasa por soporte,
                    en vez de un input libre que permitiría alterarlos sin control. */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Nombre de la Tienda</label>
                    <div className="form-locked-value">
                      <Lock size={13} />
                      <span>{storeInfo?.storeName || user?.storeName || '—'}</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>RUT de la Tienda / Identificador Fiscal</label>
                    <div className="form-locked-value">
                      <Lock size={13} />
                      <span>{storeInfo?.taxId || user?.taxId || '—'}</span>
                    </div>
                  </div>
                </div>
                <small className="form-helper-text">
                  Para corregir el nombre o RUT de tu tienda, contáctanos desde{' '}
                  <button type="button" className="form-helper-inline-link" onClick={() => { setIsEditing(false); navigate(helpContactPath()); }}>
                    Centro de ayuda
                  </button>.
                </small>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>Métodos de Envío Aceptados</label>
                  <ShippingMethodsPicker
                    selections={shippingSelectionsDraft}
                    onChange={setShippingSelectionsDraft}
                  />
                  {formErrors.shippingMethods && <small className="field-error-text">{formErrors.shippingMethods}</small>}
                  <small className="form-helper-text">Elige los métodos que ofrece tu tienda. Deja el precio en blanco si es gratuito.</small>
                </div>

                <div className="form-group">
                  <label>Marcas especialistas</label>
                  <button
                    type="button"
                    className="btn-manage-specialist-brands"
                    onClick={() => {
                      setSpecialistBrandSearch('');
                      setShowSpecialistBrandsModal(true);
                    }}
                  >
                    <span>Ver marcas</span>
                    <strong>{specialistBrandIdsDraft.length} seleccionada{specialistBrandIdsDraft.length === 1 ? '' : 's'}</strong>
                  </button>
                  <small className="form-helper-text">Selecciona las marcas de vehículo con las que trabaja tu tienda.</small>
                </div>

                <div className="form-section-title" style={{ marginTop: '16px' }}>Datos de Cuenta Bancaria de Cobro</div>
                <div className="withdrawal-info-banner">
                  <Info size={18} />
                  <span>Los datos bancarios se validan y guardan desde el apartado Retirar dinero.</span>
                  <button type="button" className="withdrawal-bank-button" onClick={() => { setIsEditing(false); setActiveTab('retiros'); }}>
                    <Wallet size={16} /> Gestionar cuenta bancaria
                  </button>
                </div>
              </>
            )}

            {/* La libreta de direcciones se gestiona solo en la vista principal
                ("Ubicación y Logística de Despacho"): se guarda sola con sus
                propios botones, no con "Guardar Información" de este formulario,
                así que repetirla acá adentro era el mismo widget dos veces. */}

            <div className="profile-data-form-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="btn-auth-secondary" onClick={() => { setIsEditing(false); setFormErrors({}); }}>
                Cancelar
              </button>
              <button type="submit" className="btn-auth-primary" disabled={isSaving} style={{ width: 'auto' }}>
                <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Información'}
              </button>
            </div>
          </form>
        ) : (
          <div className="store-unified-container">
            {/* La identidad (nombre, estado de verificación, tag de fundador) ya
                se muestra en el hero de portada de arriba; repetirla aquí en un
                segundo banner era información duplicada. */}

            {/* Modular Grid of Cards */}
            <div className="store-profile-unified-grid">
              {/* Card: Identidad y Contacto (fusiona los datos comerciales del
                  representante con sus datos de contacto personal) */}
              <div className="details-card-block store-section-card">
                <div className="details-card-header-row">
                  <h3 className="section-subtitle">
                    <span className="section-subtitle-icon"><Building2 size={16} /></span>
                    <span>{isSeller ? 'Identidad y Contacto' : 'Mis Datos'}</span>
                  </h3>
                  {/* Único punto de entrada para cambiar logo/portada: el botón
                      flotante sobre la foto de portada se ocultó a propósito en
                      el hero compacto del vendedor. */}
                  {isSeller && (
                    <div className="details-card-header-actions">
                      <button type="button" className="details-card-link-button" onClick={onOpenMediaModal}>
                        <Camera size={13} /> Cambiar logo
                      </button>
                      <button type="button" className="details-card-link-button" onClick={onOpenCoverTemplates}>
                        <ImageIcon size={13} /> Cambiar portada
                      </button>
                    </div>
                  )}
                </div>
                {/* Grid de 2-3 columnas en vez de una fila por dato: la tarjeta
                    ahora ocupa el ancho completo del panel, así que el espacio
                    extra se usa para mostrar los campos en pares en vez de dejar
                    un hueco en blanco al costado de una lista angosta. */}
                <div className="details-info-grid">
                  {isSeller && (
                    <div className="details-info-row">
                      <span className="info-label">Nombre Comercial de Tienda</span>
                      <strong className="info-value">{storeInfo?.storeName || user?.storeName || '—'}</strong>
                    </div>
                  )}
                  <div className="details-info-row">
                    <span className="info-label">RUT / Identificador Fiscal</span>
                    <strong className="info-value">{storeInfo?.taxId || user?.taxId || '—'}</strong>
                  </div>
                  {!isSeller && (
                    <div className="details-info-row">
                      <span className="info-label">Tipo de Cuenta</span>
                      <strong className="info-value">Comprador Verificado</strong>
                    </div>
                  )}
                  <div className="details-info-row">
                    <span className="info-label">{isSeller ? 'Representante Legal' : 'Nombre Completo'}</span>
                    <strong className="info-value">{user?.userName || user?.nombre || '—'}</strong>
                  </div>
                  <div className="details-info-row">
                    <span className="info-label"><Mail size={13} /> Correo Electrónico</span>
                    <strong className="info-value">{user?.email || '—'}</strong>
                  </div>
                  <div className="details-info-row">
                    <span className="info-label"><Phone size={13} /> Teléfono Móvil</span>
                    <strong className="info-value">{user?.phone || user?.telefono || '—'}</strong>
                  </div>
                  {isSeller && (
                    <div className="details-info-row details-info-row-wide">
                      <span className="info-label">Marcas especialistas</span>
                      <div className="profile-specialist-brands">
                        {(storeInfo?.marcasEspecialistas || []).length ? (storeInfo.marcasEspecialistas || []).map((brand) => (
                          <VehicleBrandLogo key={brand.id || brand.nombre} brand={brand.nombre} />
                        )) : <strong className="info-value">Sin marcas registradas</strong>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Un solo botón no justifica una tarjeta completa del mismo peso
                  que "Identidad y Contacto": queda como aviso liviano en vez de
                  tarjeta vacía (mismo patrón que ya usa el formulario de edición). */}
              {isSeller && (
                <div className="withdrawal-info-banner">
                  <CreditCard size={18} />
                  <span>Los datos bancarios de cobro se validan y guardan desde el apartado Retirar dinero.</span>
                  <button type="button" className="withdrawal-bank-button" onClick={() => setActiveTab('retiros')}>
                    <Wallet size={16} /> Ir a Retirar dinero
                  </button>
                </div>
              )}

              {/* Logística y Ubicación: contiene la libreta de direcciones,
                  mucho más densa que el resto. */}
              <div className="details-card-block store-section-card">
                <h3 className="section-subtitle">
                  <span className="section-subtitle-icon icon-amber"><Truck size={16} /></span>
                  <span>Ubicación y Logística de Despacho</span>
                </h3>
                <BuyerAddressBook usuarioId={user?.userId} onCommercialAddressSynced={refreshStoreInfoAfterAddressSync} />
                {isSeller && (
                  <div className="details-info-list store-shipping-methods-row">
                    <div className="details-info-row">
                      <span className="info-label">Métodos de Envío Registrados</span>
                      <div className="shipping-methods-pills" style={{ marginTop: '6px', gap: '8px' }}>
                        {String(storeInfo?.shippingMethods || 'Retiro en tienda, Envío dentro de la comuna, Envío fuera de la comuna')
                          .split(',')
                          .map((m, idx) => {
                            const config = getShippingIconConfig(m.trim());
                            const Icon = config.icon;
                            return (
                              <span
                                key={idx}
                                className="shipping-method-pill"
                                style={{
                                  color: config.color,
                                  backgroundColor: config.bg,
                                  borderColor: config.color,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px',
                                  fontWeight: 700
                                }}
                                title={config.label}
                              >
                                <Icon size={14} />
                                <span>{config.name}</span>
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              {/* Verificación y adhesión: estado REAL desde
                  `GET /proveedores/{id}/verificacion`. Antes eran dos líneas
                  fijas que decían "Tienda Verificada" y "Términos aceptados"
                  pasara lo que pasara. */}
              {isSeller && <SellerVerificationCard sellerId={effectiveSellerId} />}
              </div>
            </div>
          </div>
        )}
      </div>

      {showSpecialistBrandsModal && (
        <div className="order-modal-backdrop specialist-brands-backdrop" onClick={() => setShowSpecialistBrandsModal(false)}>
          <section className="specialist-brands-modal" role="dialog" aria-modal="true" aria-labelledby="specialist-brands-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2 id="specialist-brands-title">Marcas especialistas</h2>
                <p>Selecciona todas las marcas con las que trabaja tu tienda.</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setShowSpecialistBrandsModal(false)}><X size={19} /></button>
            </header>
            <div className="specialist-brands-selected" aria-label="Marcas ya seleccionadas">
              <span>Seleccionadas:</span>
              {availableVehicleBrands.filter((brand) => specialistBrandIdsDraft.includes(String(brand.id))).length ? (
                availableVehicleBrands
                  .filter((brand) => specialistBrandIdsDraft.includes(String(brand.id)))
                  .map((brand) => (
                    <span key={brand.id} className="specialist-selected-chip" title={brand.nombre}>
                      <VehicleBrandLogo brand={brand.nombre} />
                      {brand.nombre}
                    </span>
                  ))
              ) : <em>Aún no has seleccionado marcas</em>}
            </div>
            <div className="specialist-brands-search">
              <Search size={17} />
              <input autoFocus value={specialistBrandSearch} onChange={(event) => setSpecialistBrandSearch(event.target.value)} placeholder="Buscar marca de vehículo..." />
            </div>
            <div className="specialist-brands-options">
              {availableVehicleBrands
                .filter((brand) => brand.nombre?.toLowerCase().includes(specialistBrandSearch.trim().toLowerCase()))
                .map((brand) => {
                  const id = String(brand.id);
                  const selected = specialistBrandIdsDraft.includes(id);
                  return (
                    <button
                      type="button"
                      key={brand.id}
                      className={`specialist-brand-option ${selected ? 'is-selected' : ''}`}
                      onClick={() => setSpecialistBrandIdsDraft((current) => selected ? current.filter((currentId) => currentId !== id) : [...current, id])}
                    >
                      <VehicleBrandLogo brand={brand.nombre} />
                      <span>{brand.nombre}</span>
                      <span className="specialist-brand-tick" aria-hidden="true">{selected && <Check size={15} />}</span>
                    </button>
                  );
                })}
              {!availableVehicleBrands.length && <p className="specialist-brands-empty">No hay marcas disponibles para seleccionar.</p>}
            </div>
            <footer>
              <span>{specialistBrandIdsDraft.length} marca{specialistBrandIdsDraft.length === 1 ? '' : 's'} seleccionada{specialistBrandIdsDraft.length === 1 ? '' : 's'}</span>
              <button type="button" className="btn-auth-primary" onClick={() => setShowSpecialistBrandsModal(false)}><Check size={16} /> Listo</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
