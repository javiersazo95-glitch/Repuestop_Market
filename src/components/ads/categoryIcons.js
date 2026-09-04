// Icono lucide por categoria de servicio del Mural. Se comparte entre la lista
// de categorias del sidebar (AdsWallView) y el distintivo circular de cada
// tarjeta (AdCard), para no repetir el mapa en dos archivos.
import {
  LayoutGrid, Wrench, Zap, CircleDot, Truck, SprayCan, Sparkles, Snowflake,
  KeyRound, ClipboardCheck, Bike, Car, Home, Package
} from 'lucide-react';

export const CATEGORY_ICON = {
  TODAS: LayoutGrid,
  mecanica: Wrench,
  'electricidad-electronica': Zap,
  neumaticos: CircleDot,
  'asistencia-vehicular': Truck,
  'carroceria-pintura': SprayCan,
  'estetica-automotriz': Sparkles,
  climatizacion: Snowflake,
  'cerrajeria-seguridad': KeyRound,
  'servicios-inspeccion': ClipboardCheck,
  motos: Bike,
  'camiones-maquinaria': Truck,
  'compra-venta-arriendo': Car,
  'servicios-domicilio': Home,
  'otros-servicios': Package,
};

/** Icono de la categoria, con Wrench como respaldo si el id no esta mapeado. */
export function getCategoryIcon(categoryId) {
  return CATEGORY_ICON[categoryId] || Wrench;
}
