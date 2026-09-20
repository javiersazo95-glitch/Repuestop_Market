import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Building2, Camera, Check, CreditCard, FileText, Image as ImageIcon, Info, Loader2, Lock, Mail,
  MapPin, Package, Pencil, Phone, Save, Search, Store, Truck, Wallet, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getVehicleBrandsApi, updateStoreSpecialistBrandsApi, updateSellerShippingMethodsApi,
  getRegionesApi, getComunasApi, getPaisesApi,
} from '../services/api';
import { qk } from '../services/queryKeys';
import ShippingMethodsPicker from './ShippingMethodsPicker';
import BuyerAddressBook from './BuyerAddressBook';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import { resolverUbicacionPorNombre } from '../services/geoLookup';
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
  const [taxIdDraft, setTaxIdDraft] = useState(
    isSeller ? (storeInfo?.taxId || user?.taxId || '') : (user?.facturaRut || user?.taxId || '')
  );
  const [facturaRazonSocialDraft, setFacturaRazonSocialDraft] = useState(user?.facturaRazonSocial || '');
  const [facturaGiroDraft, setFacturaGiroDraft] = useState(user?.facturaGiro || '');
  const [shippingSelectionsDraft, setShippingSelectionsDraft] = useState(() => parseShippingSelections(''));
  const [specialistBrandIdsDraft, setSpecialistBrandIdsDraft] = useState([]);
  const [availableVehicleBrands, setAvailableVehicleBrands] = useState([]);
  const [showSpecialistBrandsModal, setShowSpecialistBrandsModal] = useState(false);
  const [specialistBrandSearch, setSpecialistBrandSearch] = useState('');
  const [storeAddressDraft, setStoreAddressDraft] = useState(storeInfo?.address || user?.address || '');
  const [storeRegionIdDraft, setStoreRegionIdDraft] = useState('');
  const [storeComunaIdDraft, setStoreComunaIdDraft] = useState('');
  const [storeComunaDraft, setStoreComunaDraft] = useState(storeInfo?.comuna || user?.comuna || '');
  const [storeRegionDraft, setStoreRegionDraft] = useState(storeInfo?.region || user?.region || '');
  const [sellerRegiones, setSellerRegiones] = useState([]);
  const [sellerComunas, setSellerComunas] = useState([]);
  const [sellerGeoLoading, setSellerGeoLoading] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setNameDraft(user?.userName || user?.nombre || '');
      setPhoneDraft(user?.phone || user?.telefono || '');
      setTaxIdDraft(isSeller ? (storeInfo?.taxId || user?.taxId || '') : (user?.facturaRut || user?.taxId || ''));
      setFacturaRazonSocialDraft(user?.facturaRazonSocial || '');
      setFacturaGiroDraft(user?.facturaGiro || '');
      setStoreAddressDraft(storeInfo?.address || user?.address || '');
      setStoreComunaDraft(storeInfo?.comuna || user?.comuna || '');
      setStoreRegionDraft(storeInfo?.region || user?.region || '');
    }
  }, [user, storeInfo, isSeller, isEditing]);

  useEffect(() => {
    if (!isSeller || !isEditing) return;
    let cancelled = false;
    const currentComuna = storeInfo?.comuna || user?.comuna || '';
    const currentRegion = storeInfo?.region || user?.region || '';
    setSellerGeoLoading(true);
    resolverUbicacionPorNombre({ comuna: currentComuna, region: currentRegion })
      .then((res) => {
        if (cancelled) return;
        if (res.regiones?.length) setSellerRegiones(res.regiones);
        if (res.comunas?.length) setSellerComunas(res.comunas);
        if (res.regionId) setStoreRegionIdDraft(String(res.regionId));
        if (res.comunaId) setStoreComunaIdDraft(String(res.comunaId));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSellerGeoLoading(false);
      });
    return () => { cancelled = true; };
  }, [isSeller, isEditing, storeInfo?.comuna, storeInfo?.region, user?.comuna, user?.region]);

  const handleStoreRegionChange = (regionId) => {
    setStoreRegionIdDraft(regionId);
    setStoreComunaIdDraft('');
    setStoreComunaDraft('');
    const selectedRegion = sellerRegiones.find((r) => String(r.id) === String(regionId));
    setStoreRegionDraft(selectedRegion?.nombre || '');
    if (!regionId) {
      setSellerComunas([]);
      return;
    }
    setSellerGeoLoading(true);
    getComunasApi(regionId)
      .then((data) => setSellerComunas(Array.isArray(data) ? data : []))
      .catch(() => setSellerComunas([]))
      .finally(() => setSellerGeoLoading(false));
  };

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

  // Validación reactiva en vivo para feedback inmediato
  const cleanRut = String(taxIdDraft || '').replace(/[^0-9kK]/g, '').toUpperCase();
  const isRutEmpty = cleanRut.length === 0;
  const isRutValid = isRutEmpty || isValidRut(taxIdDraft);
  const isRutInvalid = !isRutEmpty && !isValidRut(taxIdDraft);

  const isNameValid = nameDraft.trim().length >= 2;
  const isPhoneValid = !phoneDraft.trim() || isValidClPhone(phoneDraft);
  const isProfileFormValid = isNameValid && isPhoneValid && (isSeller || isRutValid);

  // Mismas reglas que ya existen en el resto de la app: el chequeo de dígito
  // verificador del RUT es el que usa Retirar dinero (src/services/adapters.js),
  // y el celular sigue el formato chileno estándar (9 + 8 dígitos).
  const validateProfileForm = () => {
    const errors = {};

    if (!isNameValid) {
      errors.name = 'Ingresa un nombre válido.';
    }

    if (!isPhoneValid) {
      errors.phone = 'Ingresa un celular chileno válido, ej: +56 9 1234 5678.';
    }

    if (!isSeller && isRutInvalid) {
      errors.taxId = cleanRut.length < 8
        ? 'RUT incompleto (ingresa al menos 8 caracteres con dígito verificador).'
        : 'El RUT ingresado no es válido (revisa el dígito verificador).';
    }

    if (isSeller) {
      if (!storeAddressDraft.trim()) {
        errors.storeAddress = 'Ingresa la dirección comercial de la tienda.';
      }
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
      userName: nameDraft.trim(),
      phone: phoneDraft.trim(),
    };

    if (!isSeller) {
      const cleanRut = taxIdDraft.trim();
      payload.facturaRut = cleanRut;
      payload.taxId = cleanRut;
      payload.facturaRazonSocial = facturaRazonSocialDraft.trim();
      payload.facturaGiro = facturaGiroDraft.trim();
    } else {
      if (storeAddressDraft.trim()) {
        payload.address = storeAddressDraft.trim();
      }
      if (storeComunaIdDraft) {
        payload.comunaId = Number(storeComunaIdDraft);
      }
      if (storeRegionDraft) {
        payload.region = storeRegionDraft;
      }
      if (storeComunaDraft) {
        payload.city = storeComunaDraft;
      }
    }

    // Nombre y RUT de la tienda no se editan desde este formulario (ver
    // bloque de solo lectura más abajo): son datos de identidad que deben
    // cambiarse a través de soporte.
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
                setTaxIdDraft(isSeller ? (storeInfo?.taxId || user?.taxId || '') : (user?.facturaRut || user?.taxId || ''));
                setFacturaRazonSocialDraft(user?.facturaRazonSocial || '');
                setFacturaGiroDraft(user?.facturaGiro || '');
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
                  onChange={(e) => {
                    setNameDraft(e.target.value);
                    if (formErrors.name) {
                      setFormErrors((prev) => {
                        const { name, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  maxLength={80}
                  required
                  className={
                    formErrors.name || (nameDraft.trim().length > 0 && !isNameValid)
                      ? 'input-invalid has-error'
                      : (nameDraft.trim().length >= 2)
                      ? 'has-success'
                      : ''
                  }
                />
                {nameDraft.trim().length > 0 && !isNameValid && (
                  <small className="auth-field-error">
                    <AlertCircle size={13} /> Ingresa un nombre válido (mínimo 2 caracteres).
                  </small>
                )}
                {formErrors.name && !nameDraft.trim() && (
                  <small className="auth-field-error">
                    <AlertCircle size={13} /> {formErrors.name}
                  </small>
                )}
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
                  onChange={(e) => {
                    setPhoneDraft(sanitizePhoneInput(e.target.value));
                    if (formErrors.phone) {
                      setFormErrors((prev) => {
                        const { phone, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  placeholder="+56 9 1234 5678"
                  maxLength={20}
                  className={
                    formErrors.phone || (phoneDraft.trim() && !isPhoneValid)
                      ? 'input-invalid has-error'
                      : (phoneDraft.trim() && isPhoneValid)
                      ? 'has-success'
                      : ''
                  }
                />
                {phoneDraft.trim() && !isPhoneValid && (
                  <small className="auth-field-error">
                    <AlertCircle size={13} /> Ingresa un celular chileno válido (ej: +56 9 1234 5678).
                  </small>
                )}
                {phoneDraft.trim() && isPhoneValid && (
                  <small className="auth-field-success">
                    <Check size={13} /> Celular válido
                  </small>
                )}
                {!phoneDraft.trim() && (
                  <small className="form-helper-text">Solo números y, al inicio, el signo + (código de país).</small>
                )}
                {formErrors.phone && !phoneDraft.trim() && (
                  <small className="auth-field-error">
                    <AlertCircle size={13} /> {formErrors.phone}
                  </small>
                )}
              </div>
            </div>
            {!isSeller && (
              <>
                <div className="form-section-title" style={{ marginTop: '20px' }}>Datos para Facturación (Opcional)</div>
                <small className="form-helper-text" style={{ marginBottom: '12px', display: 'block' }}>
                  Guarda estos datos para no tener que escribirlos cada vez que elijas &ldquo;Factura&rdquo; al pagar.
                </small>
                <div className="form-group">
                  <label>
                    RUT para Facturación
                    <span className="char-counter">{taxIdDraft.length}/12</span>
                  </label>
                  <input
                    type="text"
                    value={taxIdDraft}
                    onChange={(e) => {
                      setTaxIdDraft(formatRut(e.target.value));
                      if (formErrors.taxId) {
                        setFormErrors((prev) => {
                          const { taxId, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    placeholder="12.345.678-K"
                    maxLength={12}
                    className={
                      (formErrors.taxId || isRutInvalid)
                        ? 'input-invalid has-error'
                        : (cleanRut.length >= 8 && isValidRut(taxIdDraft))
                        ? 'has-success'
                        : ''
                    }
                  />
                  {isRutEmpty && (
                    <small className="form-helper-text">Opcional. Si lo completas, se validará el dígito verificador.</small>
                  )}
                  {cleanRut.length > 0 && cleanRut.length < 8 && (
                    <small className="auth-field-error">
                      <AlertCircle size={13} /> RUT incompleto (ingresa al menos 8 caracteres con dígito verificador).
                    </small>
                  )}
                  {cleanRut.length >= 8 && !isValidRut(taxIdDraft) && (
                    <small className="auth-field-error">
                      <AlertCircle size={13} /> El RUT ingresado no es válido (revisa el dígito verificador).
                    </small>
                  )}
                  {cleanRut.length >= 8 && isValidRut(taxIdDraft) && (
                    <small className="auth-field-success">
                      <Check size={13} /> RUT válido
                    </small>
                  )}
                  {formErrors.taxId && isRutEmpty && (
                    <small className="auth-field-error">
                      <AlertCircle size={13} /> {formErrors.taxId}
                    </small>
                  )}
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>
                      Razón Social
                      <span className="char-counter">{facturaRazonSocialDraft.length}/180</span>
                    </label>
                    <input
                      type="text"
                      value={facturaRazonSocialDraft}
                      onChange={(e) => setFacturaRazonSocialDraft(e.target.value)}
                      placeholder="Ej. Comercial Repuestos SpA"
                      maxLength={180}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Giro Comercial
                      <span className="char-counter">{facturaGiroDraft.length}/150</span>
                    </label>
                    <input
                      type="text"
                      value={facturaGiroDraft}
                      onChange={(e) => setFacturaGiroDraft(e.target.value)}
                      placeholder="Ej. Venta de repuestos automotrices"
                      maxLength={150}
                    />
                  </div>
                </div>
              </>
            )}

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

                {/* DIRECCIÓN COMERCIAL OFICIAL DE LA TIENDA */}
                <div className="form-section-title" style={{ marginTop: '20px' }}>
                  Dirección Comercial de la Tienda
                </div>
                <div className="form-group">
                  <label>
                    Calle y Número
                    <span className="char-counter">{storeAddressDraft.length}/180</span>
                  </label>
                  <AddressAutocompleteInput
                    value={storeAddressDraft}
                    onChange={setStoreAddressDraft}
                    onSelectLocation={async (loc) => {
                      if (loc?.comuna || loc?.region) {
                        try {
                          const resolved = await resolverUbicacionPorNombre(loc);
                          if (resolved.regiones?.length) setSellerRegiones(resolved.regiones);
                          if (resolved.comunas?.length) setSellerComunas(resolved.comunas);
                          if (resolved.regionId) {
                            setStoreRegionIdDraft(String(resolved.regionId));
                            const r = (resolved.regiones || []).find((x) => String(x.id) === String(resolved.regionId));
                            if (r) setStoreRegionDraft(r.nombre);
                          }
                          if (resolved.comunaId) {
                            setStoreComunaIdDraft(String(resolved.comunaId));
                            const c = (resolved.comunas || []).find((x) => String(x.id) === String(resolved.comunaId));
                            if (c) setStoreComunaDraft(c.nombre);
                          }
                        } catch (err) {
                          console.warn('Error resolviendo ubicación geográfica:', err);
                        }
                      }
                    }}
                    comuna={storeComunaDraft}
                    region={storeRegionDraft}
                    placeholder="Ej. Av. Marathon 1234"
                    maxLength={180}
                  />
                  {formErrors.storeAddress && <small className="field-error-text">{formErrors.storeAddress}</small>}
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Región {sellerGeoLoading && !sellerRegiones.length && <Loader2 size={12} className="spin-icon" />}</label>
                    <select
                      value={storeRegionIdDraft}
                      onChange={(e) => handleStoreRegionChange(e.target.value)}
                    >
                      <option value="">Selecciona una región</option>
                      {sellerRegiones.map((reg) => (
                        <option key={reg.id} value={reg.id}>{reg.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Comuna {sellerGeoLoading && storeRegionIdDraft && <Loader2 size={12} className="spin-icon" />}</label>
                    <select
                      value={storeComunaIdDraft}
                      onChange={(e) => {
                        setStoreComunaIdDraft(e.target.value);
                        const com = sellerComunas.find((c) => String(c.id) === String(e.target.value));
                        setStoreComunaDraft(com?.nombre || '');
                      }}
                      disabled={!storeRegionIdDraft || sellerGeoLoading}
                    >
                      <option value="">
                        {!storeRegionIdDraft ? 'Primero selecciona una región' : sellerGeoLoading ? 'Cargando comunas...' : 'Selecciona una comuna'}
                      </option>
                      {sellerComunas.map((com) => (
                        <option key={com.id} value={com.id}>{com.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <small className="form-helper-text">
                  Esta es la dirección física oficial de tu tienda: punto único para catálogo público, retiros presenciales de clientes, despachos de pedidos y recepción de devoluciones.
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
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => {
                  setIsEditing(false);
                  setFormErrors({});
                  setNameDraft(user?.userName || user?.nombre || '');
                  setPhoneDraft(user?.phone || user?.telefono || '');
                  setTaxIdDraft(isSeller ? (storeInfo?.taxId || user?.taxId || '') : (user?.facturaRut || user?.taxId || ''));
                  setFacturaRazonSocialDraft(user?.facturaRazonSocial || '');
                  setFacturaGiroDraft(user?.facturaGiro || '');
                  setStoreAddressDraft(storeInfo?.address || user?.address || '');
                  setStoreComunaDraft(storeInfo?.comuna || user?.comuna || '');
                  setStoreRegionDraft(storeInfo?.region || user?.region || '');
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-auth-primary"
                disabled={isSaving || !isProfileFormValid}
                style={{ width: 'auto' }}
              >
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
                    <span className="info-label">{isSeller ? 'RUT de la Tienda' : 'RUT (Facturación)'}</span>
                    <strong className="info-value">{isSeller ? (storeInfo?.taxId || user?.taxId || '—') : (user?.facturaRut || user?.taxId || '—')}</strong>
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
                  {!isSeller && (
                    <>
                      <div className="details-info-row">
                        <span className="info-label"><FileText size={13} /> Razón Social (Facturación)</span>
                        <strong className="info-value">{user?.facturaRazonSocial || '—'}</strong>
                      </div>
                      <div className="details-info-row">
                        <span className="info-label"><FileText size={13} /> Giro Comercial (Facturación)</span>
                        <strong className="info-value">{user?.facturaGiro || '—'}</strong>
                      </div>
                    </>
                  )}
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
                {isSeller && (
                  <div className="details-info-list store-shipping-methods-row" style={{ marginTop: '18px' }}>
                    <div className="details-info-row">
                      <span className="info-label">Métodos de Envío Registrados</span>
                      <div className="shipping-methods-pills" style={{ marginTop: '6px', gap: '8px' }}>
                        {String(storeInfo?.shippingMethods || 'Retiro en tienda, Envío dentro de la comuna, Envío fuera de la comuna')
                          .split(',')
                          .map((m, idx) => {
                            const method = m.trim();
                            const config = getShippingIconConfig(method);
                            const Icon = config.icon;
                            return (
                              <span
                                key={idx}
                                className="shipping-method-pill"
                                style={{ color: config.color, backgroundColor: config.bg, borderColor: config.color, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontWeight: 700 }}
                                title={config.label}
                              >
                                <Icon size={14} />
                                <span>{method}</span>
                              </span>
                            );
                          })}
                      </div>
                      <small className="form-helper-text">La tarifa local se usa automáticamente al crear cotizaciones y pedidos.</small>
                    </div>
                  </div>
                )}
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

              {/* Ubicación y Logística: para el vendedor se consolida en la dirección comercial oficial
                  de la tienda (punto único para catálogo, retiros, despachos y devoluciones).
                  Para el comprador se muestra su libreta de direcciones guardadas. */}
              <div className="details-card-block store-section-card">
                <h3 className="section-subtitle">
                  <span className="section-subtitle-icon icon-amber"><Truck size={16} /></span>
                  <span>{isSeller ? 'Ubicación y Logística Comercial' : 'Ubicación y Direcciones de Entrega'}</span>
                </h3>

                {isSeller && (
                  <div className="store-official-address-card" style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    border: '1.5px solid #bfdbfe',
                    background: '#f8faff',
                    marginBottom: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: '#2563eb',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0
                        }}>
                          <Store size={22} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>
                              Dirección Comercial de la Tienda
                            </h4>
                            <span style={{
                              background: '#dbeafe',
                              color: '#1e40af',
                              border: '1px solid #bfdbfe',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}>
                              Punto de Retiro, Despacho y Devoluciones
                            </span>
                          </div>
                          <p style={{ margin: '6px 0 0', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                            {storeInfo?.address || user?.address || 'Dirección comercial no registrada'}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                            {[storeInfo?.comuna || user?.comuna, storeInfo?.region || user?.region].filter(Boolean).join(', ') || 'Comuna y región no registradas'}
                          </p>
                          {storeInfo?.hours && (
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>
                              Horario de atención: {storeInfo.hours}
                            </p>
                          )}
                        </div>
                      </div>
                      {!isEditing && (
                        <button
                          type="button"
                          className="details-card-link-button"
                          onClick={() => setIsEditing(true)}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          <Pencil size={13} /> Editar tienda
                        </button>
                      )}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                      gap: '10px',
                      paddingTop: '12px',
                      borderTop: '1px solid #e2e8f0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
                        <Store size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                        <span>Ficha pública en el catálogo</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
                        <Truck size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                        <span>Retiros de clientes y transportistas</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
                        <Package size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                        <span>Recepción de cambios y devoluciones</span>
                      </div>
                    </div>
                  </div>
                )}

                {!isSeller && (
                  <BuyerAddressBook usuarioId={user?.userId} />
                )}
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
