import { Home, ShoppingBag, Search, Cog, Gauge, Telescope, Box } from 'lucide-react';
import EngineIcon from '../components/EngineIcon';
import { ROUTES } from '../routes/paths';

// Barra inferior de la version movil (<=768px): los 4 accesos principales de cada rol.
// Los items se DERIVAN de `sidebarGroups` (ya filtrado por cuenta bloqueada), asi que
// nunca aparece aqui una pestaña que el sidebar oculta. El quinto boton es "Mas", que
// abre la hoja con todos los grupos.
// Barra inferior del celular: las mismas pestañas, etiquetas e iconos que la app según el perfil
// (`AppBottomTabBar.tsx`). `tab` abre esa sección de la cuenta; `to` sale a la página pública equivalente
// (la app también cambia de pantalla). El quinto botón es "Más", que abre la hoja con todos los grupos.
export const MOBILE_APP_TABS = {
  buyer: [
    { key: 'inicio', label: 'Inicio', icon: Home, to: ROUTES.home },
    { key: 'fallas', label: 'Mis fallas', icon: EngineIcon, tab: 'mis_fallas' },
    { key: 'repuestos', label: 'Repuestos', icon: Cog, tab: 'repuestos', virtual: true },
    { key: 'busco', label: 'Encargar', icon: Search, tab: 'subastas' },
  ],
  seller: [
    { key: 'inicio', label: 'Inicio', icon: Home, tab: 'resumen' },
    { key: 'pedidos', label: 'Pedidos', icon: ShoppingBag, tab: 'pedidos' },
    { key: 'inventario', label: 'Inventario', icon: Box, tab: 'productos' },
    { key: 'buscan', label: 'Encargos', icon: Telescope, tab: 'buscan', virtual: true },
  ],
  workshop: [
    { key: 'inicio', label: 'Inicio', icon: Gauge, tab: 'resumen' },
    { key: 'fallas', label: 'Mis fallas', icon: EngineIcon, tab: 'fallas_taller' },
    { key: 'repuestos', label: 'Repuestos', icon: Cog, tab: 'repuestos', virtual: true },
    { key: 'busco', label: 'Encargar', icon: Search, tab: 'subastas' },
  ],
};
