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
      {
        q: '¿Cómo pido una cotización?',
        a: 'Desde la ficha de un repuesto usa "Pedir cotización" y describe lo que necesitas, indicando tu vehículo. La solicitud abre un chat con la tienda, donde te responden con precio, stock y condiciones de entrega.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.GUEST],
        topicId: 'buyer-quote',
      },
      {
        q: '¿Qué pasa cuando acepto una cotización?',
        a: 'Al aceptarla, el repuesto queda disponible para que completes la compra con las condiciones acordadas en el chat. Mientras no la aceptes no hay ningún cobro.',
        roles: [HELP_ROLES.BUYER],
        topicId: 'buyer-quote',
      },
      {
        q: '¿Qué hago si la tienda no responde mi cotización?',
        a: 'Puedes pedir cotización a otras tiendas por el mismo repuesto: no hay límite ni exclusividad. Si una tienda deja conversaciones sin responder de forma reiterada, repórtala desde el menú de opciones del chat.',
        roles: [HELP_ROLES.BUYER],
        topicId: 'buyer-quote',
      },
    ],
  },
  {
    slug: 'tienda',
    titulo: 'Mi tienda',
    descripcion: 'Datos de la tienda, cobros, comisiones y verificación.',
    icono: 'store',
    topicId: { [HELP_ROLES.SELLER]: 'seller-orders' },
    faqs: [
      {
        q: '¿Cómo edito los datos de mi tienda?',
        a: 'En tu perfil entra a "Mi tienda y datos": ahí actualizas la descripción, el logo, la portada, los horarios y los métodos de envío que aceptas. El nombre y el RUT de la tienda no se editan solos, porque son los datos con los que se verificó tu cuenta: para corregirlos escríbenos desde Contactar soporte.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-products',
      },
      {
        q: '¿Cómo recibo el dinero de mis ventas?',
        a: 'Desde "Retirar dinero" en tu perfil solicitas el retiro de tu saldo disponible. Los datos bancarios se cargan y validan en ese mismo apartado, no en los datos de la tienda, y deben coincidir con el RUT registrado.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-orders',
      },
      {
        q: '¿Cuánto me cobra RepuesTop por vender?',
        a: 'No hay un cargo fijo mensual: se descuenta una comisión por venta concretada, que varía según el monto del pedido, más el costo de procesamiento de la pasarela de pago. En el detalle de cada pedido puedes abrir "Ver cálculo de comisión" y revisar el desglose exacto de esa venta y el monto que te queda.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-orders',
      },
      {
        q: '¿Qué es el Beneficio Tarifa Fundador?',
        a: 'Es la tarifa preferente para las primeras tiendas que se suman a RepuesTop. Si tu cuenta lo tiene activo, verás la insignia en la cabecera de tu perfil y la comisión aplicada en tus pedidos será la del beneficio.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-orders',
      },
      {
        q: '¿Qué significa el sello de Tienda Verificada?',
        a: 'Indica que validamos la identidad de la tienda y sus datos tributarios al momento de registrarse. Aparece en tu perfil público y en el directorio de tiendas, y es una de las señales que más miran los compradores al elegir a quién comprarle.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-products',
      },
      {
        q: '¿Cómo publico un anuncio de mi tienda?',
        a: 'En "Gestión de anuncios" puedes crear una publicación para el Mural de Anuncios y elegir el plan de difusión. El pago del anuncio es aparte de las ventas y se gestiona desde ese mismo panel.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-products',
      },
    ],
  },
  {
    slug: 'cuenta',
    titulo: 'Cuenta y perfil',
    descripcion: 'Registro, sesión, datos personales y bloqueos.',
    icono: 'user',
    topicId: { [HELP_ROLES.BUYER]: 'general', [HELP_ROLES.SELLER]: 'blocked-account' },
    faqs: [
      {
        q: '¿Qué hago si mi cuenta fue bloqueada?',
        a: 'Revisa la pantalla de bloqueo y solicita revisión. También puedes abrir un ticket para que soporte evalúe tu caso.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.SELLER],
        topicId: 'blocked-account',
      },
      {
        q: '¿Cómo actualizo mis datos o mi dirección de envío?',
        a: 'En tu perfil, en "Mis datos y perfil", puedes editar tu nombre, teléfono, foto y las direcciones de despacho que usas al comprar. Los cambios se aplican a los pedidos que hagas después de guardarlos, no a los que ya están en curso.',
        roles: [HELP_ROLES.BUYER],
        topicId: 'general',
      },
      {
        q: 'No puedo iniciar sesión, ¿qué reviso?',
        a: 'Confirma que estés usando el mismo correo con el que te registraste, incluido el acceso con Google si fue así como creaste la cuenta. Si el problema persiste, escríbenos desde Contactar soporte indicando el correo y el mensaje de error que ves.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.SELLER],
        topicId: 'general',
      },
      {
        q: '¿Cómo elimino mi cuenta?',
        a: 'La opción está al final del menú lateral de tu perfil, en "Eliminar cuenta". Antes de eliminarla resuelve los pedidos, reclamos o retiros que tengas en curso, porque el cierre de la cuenta no los cancela ni los devuelve.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.SELLER],
        topicId: 'general',
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
    descripcion: 'Cómo funciona RepuesTop, reglas de uso y datos personales.',
    icono: 'policy',
    topicId: { [HELP_ROLES.BUYER]: 'general', [HELP_ROLES.SELLER]: 'seller-products' },
    faqs: [
      {
        q: '¿RepuesTop vende directamente los repuestos?',
        a: 'RepuesTop conecta compradores con vendedores de repuestos. La plataforma te ayuda a encontrar, cotizar y comprar.',
        roles: ALL_ROLES,
        topicId: 'general',
      },
      {
        q: '¿Quién responde por el repuesto que compro?',
        a: 'El vendedor es responsable del repuesto que publica: su descripción, su compatibilidad, su estado y el despacho. RepuesTop provee la plataforma, el medio de pago y la mediación cuando algo no sale como se acordó.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.GUEST],
        topicId: 'general',
      },
      {
        q: '¿Puedo devolver un repuesto?',
        a: 'Sí. La vía es abrir un reclamo desde el detalle del pedido eligiendo el motivo que corresponda (pieza incompatible, dañada, incorrecta o arrepentimiento). Desde ahí se coordina la devolución con el vendedor y, si no hay acuerdo, el caso pasa a mediación. No coordines devoluciones por fuera de la plataforma: sin el reclamo registrado no queda respaldo.',
        roles: [HELP_ROLES.BUYER],
        topicId: 'buyer-orders',
      },
      {
        q: '¿Qué puedo publicar y qué no?',
        a: 'Puedes publicar repuestos automotrices que tengas disponibles, con fotos propias, compatibilidad correcta y stock real. No se permiten publicaciones de piezas de origen dudoso, avisos que deriven la venta fuera de la plataforma, ni datos de contacto directo en el título o la descripción.',
        roles: [HELP_ROLES.SELLER],
        topicId: 'seller-products',
      },
      {
        q: '¿Por qué se puede bloquear una cuenta?',
        a: 'Por incumplir las reglas de uso: publicaciones engañosas, no responder los pedidos, insistir en coordinar pagos fuera de la plataforma o reportes reiterados de otros usuarios. El bloqueo se puede apelar: desde la pantalla de bloqueo solicitas la revisión y el caso queda registrado.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.SELLER],
        topicId: 'blocked-account',
      },
      {
        q: '¿Qué se hace con mis datos personales?',
        a: 'Se usan para operar tu cuenta, procesar tus pedidos y coordinar los despachos. Con la otra parte de una compra solo se comparte lo necesario para concretar la entrega. Puedes revisar y actualizar tus datos desde tu perfil, y solicitar la eliminación de tu cuenta desde esa misma sección.',
        roles: ALL_ROLES,
        topicId: 'general',
      },
    ],
  },
  {
    slug: 'seguridad',
    titulo: 'Centro de seguridad',
    descripcion: 'Compra protegida, mediación y cuidado de tu cuenta.',
    icono: 'shield',
    topicId: { [HELP_ROLES.BUYER]: 'buyer-orders', [HELP_ROLES.SELLER]: 'seller-orders' },
    faqs: [
      {
        q: '¿Cómo sé que una tienda es confiable?',
        a: 'Fíjate en el sello de Tienda Verificada, que indica que validamos su identidad y sus datos tributarios al registrarse, y revisa su perfil público: catálogo, métodos de envío y datos de contacto. Toda la conversación y la compra deben ocurrir dentro de la plataforma.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.GUEST],
        topicId: 'buyer-quote',
      },
      {
        q: '¿Cómo protege RepuesTop mi compra?',
        a: 'El pago se procesa por la pasarela dentro de la plataforma y queda asociado a tu pedido, con su estado y su historial. Si algo sale mal puedes abrir un reclamo desde el detalle del pedido y el caso pasa a nuestro equipo de mediación.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.GUEST],
        topicId: 'buyer-orders',
      },
      {
        q: '¿Por qué no debo pagar ni coordinar fuera de la plataforma?',
        a: 'Un pago hecho por transferencia directa, fuera del flujo de compra, no queda registrado en RepuesTop: no genera pedido, no tiene seguimiento y no podemos mediar si el repuesto no llega o no es el correcto. Si un vendedor te insiste en pagar por fuera, repórtalo.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.GUEST],
        topicId: 'buyer-quote',
      },
      {
        q: '¿Cómo funciona la mediación?',
        a: 'Cuando se abre un reclamo, ambas partes pueden exponer su versión y adjuntar fotos en el chat del caso. Si no se llega a un acuerdo, el caso se escala a un mediador de RepuesTop que revisa la evidencia y define cómo se resuelve. Puedes seguir el estado en Reportes y disputas de tu perfil.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.SELLER],
        topicId: 'buyer-orders',
      },
      {
        q: '¿Cómo reporto a un usuario o una conversación?',
        a: 'Dentro del chat de la cotización, abre el menú de opciones y elige "Reportar". El reporte llega a nuestro equipo con el historial de esa conversación y queda registrado en Reportes y disputas.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.SELLER],
        topicId: 'buyer-quote',
      },
      {
        q: '¿RepuesTop me va a pedir mi contraseña o los datos de mi tarjeta?',
        a: 'Nunca. Nuestro equipo no pide contraseñas, códigos de verificación ni números de tarjeta por chat, correo o teléfono. Los datos de pago se ingresan solo en la pasarela durante la compra. Si recibes un mensaje que te los pide, no respondas y avísanos.',
        roles: ALL_ROLES,
        topicId: 'general',
      },
      {
        q: '¿Qué hago si creo que entraron a mi cuenta?',
        a: 'Cambia tu contraseña de inmediato desde tus datos de perfil y revisa tus pedidos y cotizaciones recientes. Si ves movimientos que no reconoces, escríbenos desde Contactar soporte con el detalle para que bloqueemos la cuenta mientras se revisa.',
        roles: [HELP_ROLES.BUYER, HELP_ROLES.SELLER],
        topicId: 'general',
      },
    ],
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




