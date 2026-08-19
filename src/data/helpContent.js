/**
 * Contenido único del centro de ayuda. Las FAQ vivían repartidas en constantes
 * dentro de `SupportHelpPanel`; aquí quedan agrupadas por categoría para que
 * cada una tenga su propia URL (`/ayuda/pedidos`).
 *
 * Cada FAQ declara:
 * - `roles`: quién la ve (`COMPRADOR`, `VENDEDOR`, `INVITADO`).
 * - `topicId`: el tema con el que se abre el formulario de contacto. DEBE ser
 *   uno de los ids que ya usa el backend/formulario (`buyer-orders`,
 *   `buyer-payment`, `buyer-quote`, `general`, `seller-orders`,
 *   `seller-products`, `seller-quote`, `blocked-account`). Un id inventado
 *   dejaría el selector de asunto vacío.
 */

export const HELP_ROLES = { BUYER: 'COMPRADOR', SELLER: 'VENDEDOR', GUEST: 'INVITADO' };

const ALL_ROLES = [HELP_ROLES.BUYER, HELP_ROLES.SELLER, HELP_ROLES.GUEST];

/**
 * Temas del formulario de contacto por rol. Los ids son los que el backend ya
 * clasifica: cambiarlos rompe el filtrado del backoffice. Viven aquí y no en el
 * formulario para que la vista de contacto pueda leer la etiqueta del tema.
 */
export const CONTACT_TOPICS = {
  COMPRADOR: [
    ['Pedido o despacho', 'buyer-orders'], ['Pago o carrito', 'buyer-payment'], ['Cotización', 'buyer-quote'], ['Cuenta o perfil', 'general'],
  ],
  VENDEDOR: [
    ['Pedidos o envío', 'seller-orders'], ['Productos', 'seller-products'], ['Mensajes o cotización', 'seller-quote'], ['Cuenta bloqueada', 'blocked-account'],
  ],
};

export const HELP_CATEGORIES = [
  {
    slug: 'pedidos',
    titulo: 'Pedidos y envíos',
    descripcion: 'Estados, entregas, devoluciones y reclamos.',
    icono: 'package',
    topicId: { [HELP_ROLES.SELLER]: 'seller-orders', [HELP_ROLES.BUYER]: 'buyer-orders' },
    faqs: [
      {
        q: '¿Cómo sigo mi pedido?',
        a: 'Ingresa a Pedidos y abre el detalle. Allí verás el estado, el envío y el historial de la compra.',
        roles: [HELP_ROLES.BUYER],
        topicId: 'buyer-orders',
      },
      {
        q: '¿Cómo abro un reclamo?',
        a: 'Desde el detalle del pedido puedes iniciar un reclamo si hubo un problema con el producto, el envío o la entrega.',
        roles: [HELP_ROLES.BUYER],
        topicId: 'buyer-orders',
      },
      {
        q: '¿Qué pasa con la comisión y el envío?',
        a: 'En el carrito y en el detalle del pedido se muestran los cargos adicionales antes de confirmar la compra.',
        roles: [HELP_ROLES.BUYER],
        topicId: 'buyer-payment',
      },
      {
        q: '¿Cómo registro un envío?',
        a: 'En Pedidos abre la orden correspondiente y completa los datos de despacho según el método de envío que configuraste.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-orders',
      },
    ],
  },
  {
    slug: 'productos',
    titulo: 'Productos',
    descripcion: 'Publicación, compatibilidad y stock.',
    icono: 'tag',
    faqs: [
      {
        q: '¿Qué hago si no encuentro mi repuesto?',
        a: 'Revisa el vehículo, usa filtros y prueba pedir una cotización desde la ficha del producto o el chat de cotización.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.GUEST],
        topicId: 'buyer-quote',
      },
      {
        q: '¿Cómo publico un producto?',
        a: 'Usa Crear producto y completa compatibilidad, fotos, stock, precio y método de despacho antes de guardar.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-products',
      },
    ],
  },
  {
    slug: 'cotizaciones',
    titulo: 'Cotizaciones',
    descripcion: 'Cómo solicitar, revisar y gestionar cotizaciones.',
    icono: 'quote',
    faqs: [
      {
        q: '¿Cómo respondo una cotización?',
        a: 'En Mensajes puedes revisar cada conversación, completar el precio, stock y condiciones, y luego enviar la respuesta.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-quote',
      },
    ],
  },
  {
    slug: 'tienda',
    titulo: 'Mi tienda',
    descripcion: 'Gestión de tienda, datos y configuración.',
    icono: 'store',
    faqs: [],
  },
  {
    slug: 'cuenta',
    titulo: 'Cuenta y perfil',
    descripcion: 'Registro, sesión, datos personales y bloqueos.',
    icono: 'user',
    faqs: [
      {
        q: '¿Qué hago si mi cuenta fue bloqueada?',
        a: 'Revisa la pantalla de bloqueo y solicita revisión. También puedes abrir un ticket para que soporte evalúe tu caso.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'blocked-account',
      },
      {
        q: '¿Qué puedo hacer como invitado?',
        a: 'Puedes explorar repuestos, revisar compatibilidades y conocer cómo funciona RepuesTop antes de crear una cuenta.',
        roles: [HELP_ROLES.GUEST],
        topicId: 'general',
      },
      {
        q: '¿Por qué conviene registrarme?',
        a: 'Al registrarte puedes cotizar, comprar, guardar tus datos, hacer seguimiento de pedidos y recibir notificaciones importantes.',
        roles: [HELP_ROLES.GUEST],
        topicId: 'general',
      },
      {
        q: '¿Puedo comprar sin cuenta?',
        a: 'No. Para proteger tus compras y coordinar el despacho necesitas crear una cuenta o iniciar sesión.',
        roles: [HELP_ROLES.GUEST],
        topicId: 'general',
      },
    ],
  },
  {
    slug: 'politicas',
    titulo: 'Políticas de la plataforma',
    descripcion: 'Cómo funciona RepuesTop, términos y condiciones de uso.',
    icono: 'policy',
    faqs: [
      {
        q: '¿RepuesTop vende directamente los repuestos?',
        a: 'RepuesTop conecta compradores con vendedores de repuestos. La plataforma te ayuda a encontrar, cotizar y comprar.',
        roles: ALL_ROLES,
        topicId: 'general',
      },
    ],
  },
  {
    slug: 'seguridad',
    titulo: 'Centro de seguridad',
    descripcion: 'Compra protegida, mediación y buenas prácticas.',
    icono: 'shield',
    faqs: [],
  },
];

/** `SELLER|PROVIDER|PROVEEDOR` -> VENDEDOR; sin usuario -> INVITADO. */
export function resolveReportType(role, user) {
  if (!user) return HELP_ROLES.GUEST;
  const raw = String(role || user?.role || '').toUpperCase();
  return ['SELLER', 'PROVIDER', 'PROVEEDOR'].includes(raw) ? HELP_ROLES.SELLER : HELP_ROLES.BUYER;
}

/** FAQ de una categoría visibles para el rol. */
export function faqsForRole(category, reportType) {
  return (category?.faqs || []).filter((faq) => faq.roles.includes(reportType));
}

/**
 * Categorías con al menos una FAQ para el rol. Las que todavía no tienen
 * contenido redactado (`tienda`, `seguridad`) no se muestran en vez de
 * ofrecer una pantalla vacía.
 */
export function getCategoriesForRole(reportType) {
  return HELP_CATEGORIES.filter((category) => faqsForRole(category, reportType).length > 0);
}

export function getCategory(slug) {
  return HELP_CATEGORIES.find((category) => category.slug === slug) || null;
}

/** Tema por defecto del formulario al contactar desde una categoría. */
export function categoryTopicId(category, reportType) {
  if (!category) return null;
  if (category.topicId?.[reportType]) return category.topicId[reportType];
  return faqsForRole(category, reportType)[0]?.topicId || null;
}

/** Las N primeras FAQ del rol, para el bloque destacado de la portada. */
export function highlightedFaqs(reportType, limit = 5) {
  return getCategoriesForRole(reportType)
    .flatMap((category) => faqsForRole(category, reportType).map((faq) => ({ ...faq, categoria: category.slug })))
    .slice(0, limit);
}


