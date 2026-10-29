/**
 * Preguntas y respuestas de las necesidades de compra (subastas de repuestos).
 *
 * Cada respuesta describe lo que hace hoy el backend (NecesidadCompraService, SubastaPedidoService y
 * PedidoCheckoutSubastaSupport); si cambia una regla, se corrige aquí y en la copia de la app
 * (mobile/utils/auction-help-faqs.ts, que se genera de este mismo contenido).
 *
 * - `roles`: quién la ve (COMPRADOR, VENDEDOR, INVITADO).
 * - `grupo`: encabezado con el que la app agrupa las preguntas.
 */

const BUYER = 'COMPRADOR';
const SELLER = 'VENDEDOR';
const GUEST = 'INVITADO';
const ALL = [BUYER, SELLER, GUEST];
const BUYER_AND_GUEST = [BUYER, GUEST];

export const AUCTION_HELP_FAQS = [
  // ---------------------------------------------------------------- Cómo funciona
  {
    grupo: 'Cómo funciona',
    q: '¿Qué es una necesidad de compra?',
    a: 'Es un pedido que publicas cuando quieres que las casas de repuestos compitan por ofrecértelo. Indicas tu vehículo (por patente), uno o varios repuestos con su cantidad, el plazo máximo de envío, un presupuesto de referencia y cuánto tiempo quieres recibir ofertas. Las tiendas verificadas te envían sus ofertas en privado, tú las comparas y aceptas la que más te convenga. Publicar es gratis.',
    roles: ALL,
  },
  {
    grupo: 'Cómo funciona',
    q: '¿Cuáles son las etapas, de principio a fin?',
    a: '1) Publicas el pedido. 2) Las tiendas verificadas lo reciben y ofertan mientras esté activo. 3) Tú comparas y aceptas una o varias ofertas. 4) Pagas una sola vez en la plataforma. 5) Cada tienda despacha o entrega su parte. 6) Al recibir conforme se libera el pago a la tienda y ambas partes pueden calificarse.',
    roles: ALL,
  },
  {
    grupo: 'Cómo funciona',
    q: '¿Cómo hago seguimiento a mi necesidad?',
    a: 'Cada necesidad tiene un código del tipo NC-000123, visible en la lista y en el detalle. Desde Mis necesidades de compra ves su estado (Activa, Finalizada, Expirada), el tiempo restante y las ofertas recibidas, y te llega una notificación cada vez que una tienda ofrece. Si escribes a soporte, indica ese código para que lo ubiquemos de inmediato.',
    roles: [BUYER, SELLER],
  },
  {
    grupo: 'Cómo funciona',
    q: '¿Quién puede ver mi necesidad y qué información se muestra?',
    a: 'Cualquier persona puede ver las necesidades activas, pero tu patente nunca se muestra completa (por ejemplo AB**12). Las ofertas son privadas: cada tienda ve solo la suya, los montos no se comparten entre tiendas ni con otros compradores. Solo las tiendas y el creador de la necesidad pueden comentar.',
    roles: ALL,
  },
  {
    grupo: 'Cómo funciona',
    q: '¿Puedo ver necesidades de compra si no tengo cuenta?',
    a: 'Sí, puedes explorarlas. Para publicar una necesidad debes iniciar sesión como comprador y tener al menos una dirección registrada; para ofertar debes ser una casa de repuestos verificada y aprobada.',
    roles: [GUEST],
  },

  // ---------------------------------------------------------------- Publicar y editar (comprador)
  {
    grupo: 'Publicar y editar',
    q: '¿Cuánto tiempo dura mi necesidad y qué pasa cuando termina?',
    a: 'Tú eliges la vigencia al publicar: 24 horas, 48 horas (la recomendada), 72 horas, 5 o 7 días, contadas desde la publicación. Al terminar el plazo la necesidad pasa a Expirada y deja de recibir ofertas. Si ya habías aceptado ofertas, esas se mantienen y puedes pagarlas; solo lo que seguía pendiente se cierra.',
    roles: BUYER_AND_GUEST,
  },
  {
    grupo: 'Publicar y editar',
    q: '¿Puedo editar mi necesidad después de publicarla?',
    a: 'Sí, mientras no hayas aceptado ninguna oferta y el plazo no haya terminado. Si cambias los repuestos, las cantidades o la patente de algún repuesto, las ofertas ya enviadas quedan sin efecto y se avisa a las tiendas para que vuelvan a ofertar. Si solo cambias datos como fotos, descripción, presupuesto o plazo de envío, las ofertas se mantienen. Una vez que aceptas una oferta ya no se puede editar, porque las condiciones quedaron fijadas con las tiendas.',
    roles: [BUYER],
  },
  {
    grupo: 'Publicar y editar',
    q: '¿Qué pasa si me arrepiento y ya no quiero la necesidad?',
    a: 'Si todavía no aceptaste ninguna oferta, no tienes que hacer nada: no aceptes ofertas y la necesidad se cierra sola al terminar el plazo, sin cobro ni sanción alguna. Hoy no existe un botón para cancelarla antes de tiempo; si necesitas que se cierre antes, escríbenos desde Contactar soporte indicando el código NC-… de tu necesidad y lo revisamos.',
    roles: [BUYER],
  },
  {
    grupo: 'Publicar y editar',
    q: '¿Para qué sirve el presupuesto máximo?',
    a: 'Es solo una referencia para que las tiendas sepan cuánto esperas gastar. No es un tope obligatorio: puedes recibir ofertas por sobre ese valor y decidir si aceptas o no. También puedes dejarlo sin tope.',
    roles: BUYER_AND_GUEST,
  },

  // ---------------------------------------------------------------- Ofertas (comprador)
  {
    grupo: 'Ofertas y aceptación',
    q: '¿Cómo comparo y acepto una oferta?',
    a: 'En el detalle de tu necesidad abre Ofertas recibidas. Verás cada tienda con su evaluación, la fecha en que envió la oferta, el precio por repuesto, el despacho y la garantía. Puedes aceptar una oferta en cualquier momento mientras la necesidad esté activa: no tienes que esperar a que termine el plazo.',
    roles: [BUYER],
  },
  {
    grupo: 'Ofertas y aceptación',
    q: '¿Puedo aceptar más de una oferta?',
    a: 'No hace falta: cada oferta que recibes es completa, porque las tiendas solo pueden enviarla si cubren todos los repuestos de tu pedido. Compara las ofertas y acepta la que más te convenga; al aceptarla, todo el pedido queda adjudicado a esa tienda y las demás ofertas se descartan.',
    roles: [BUYER],
  },
  {
    grupo: 'Ofertas y aceptación',
    q: '¿Aceptar una oferta significa que ya compré o que me cobran?',
    a: 'No. Aceptar solo reserva esos repuestos para esa tienda; no se cobra nada hasta que pagas. La compra se concreta recién cuando completas el pago.',
    roles: [BUYER],
  },
  {
    grupo: 'Ofertas y aceptación',
    q: 'Acepté una oferta y me arrepentí antes de pagar, ¿qué pasa?',
    a: 'No se te cobra nada: sin pago no hay compra ni obligación de pagar. Lo que sí ocurre es que la aceptación queda registrada y ya no puedes editar el pedido. No hay un botón para deshacerla; si quieres liberar esos repuestos o necesitas empezar de nuevo, escríbenos con el código NC-… desde Contactar soporte.',
    roles: [BUYER],
  },
  {
    grupo: 'Ofertas y aceptación',
    q: '¿Qué pasa si una tienda no tiene todos mis repuestos?',
    a: 'No puede enviarte una oferta: la plataforma exige que cada oferta cubra todos los repuestos de tu pedido. Así solo recibes propuestas completas y las comparas entre sí. No estás obligado a aceptar ninguna.',
    roles: [BUYER],
  },
  {
    grupo: 'Ofertas y aceptación',
    q: '¿Qué pasa si no recibo ninguna oferta?',
    a: 'Cuando termina el plazo, la necesidad queda Expirada sin ningún costo para ti. Para volver a intentarlo puedes publicar una nueva con una vigencia mayor, revisar que el repuesto y el vehículo estén bien descritos, agregar fotos o ajustar el presupuesto. También puedes pedir cotización directa a una tienda desde la ficha de un repuesto del catálogo.',
    roles: [BUYER],
  },
  {
    grupo: 'Ofertas y aceptación',
    q: 'Recibí ofertas pero ninguna me convence, ¿qué hago?',
    a: 'No aceptes ninguna y deja que termine el plazo. No hay costo ni penalización por no elegir. Si quieres otras ofertas dentro del mismo pedido, puedes editarlo (si cambias los repuestos las tiendas deberán volver a ofertar) o publicar uno nuevo.',
    roles: [BUYER],
  },
  {
    grupo: 'Ofertas y aceptación',
    q: 'Una tienda me ofreció algo distinto a lo que pedí, ¿qué hago?',
    a: 'Revisa el detalle de cada línea de la oferta antes de aceptar: ahí se ve qué repuesto de su inventario te ofrece. Si no te sirve, no la aceptes. Si ya pagaste y lo recibido no corresponde a lo comprado, abre un reclamo desde el detalle del pedido con el motivo Producto incorrecto o incompleto.',
    roles: [BUYER],
  },

  // ---------------------------------------------------------------- Pago y entrega (comprador)
  {
    grupo: 'Pago y entrega',
    q: '¿Cómo pago mis ofertas aceptadas?',
    a: 'Desde el detalle de la necesidad entra a Pagar. Verás el pedido separado por tienda, eliges el método de entrega de cada una (retiro en tienda, despacho dentro de la comuna o fuera de ella, según lo que la tienda ofrezca) y tu dirección, y pagas una sola vez por la plataforma de pago aunque hayas aceptado ofertas de varias tiendas. Pagar como comprador no tiene comisión adicional.',
    roles: [BUYER],
  },
  {
    grupo: 'Pago y entrega',
    q: 'Me quedé a mitad del pago o el pago no se completó, ¿qué hago?',
    a: 'Un pago iniciado queda pendiente 30 minutos. Si no lo completas, vence solo y no se cobra. Mientras tengas un pago pendiente de una parte del pedido no puedes iniciar otro: termínalo o espera a que venza y vuelve a pagar. Si te descontaron y el pedido no aparece, escríbenos con el comprobante.',
    roles: [BUYER],
  },
  {
    grupo: 'Pago y entrega',
    q: 'Acepté ofertas de varias tiendas, ¿cómo funcionan los pedidos y envíos?',
    a: 'Se crea un solo pedido con un solo pago, pero cada tienda prepara y despacha lo suyo, con su propio estado y su propio envío. Puede que los repuestos lleguen en fechas distintas y cada tienda tiene su seguimiento dentro del pedido.',
    roles: [BUYER],
  },
  {
    grupo: 'Pago y entrega',
    q: 'Ya pagué y me arrepentí, ¿puedo cancelar o devolver?',
    a: 'Sí, según en qué etapa esté. Mientras el pedido de una tienda esté pendiente de pago, pagado o en preparación, puedes cancelarlo desde el detalle del pedido: la cancelación es inmediata, abarca la parte de esa tienda y el reembolso se solicita a la pasarela de pago. Si ya fue despachado o está listo para retiro, tienes derecho a retracto: 10 días corridos desde que recibes el producto, abriendo un reclamo con el motivo Me arrepentí de la compra y con fotos del producto y su empaque. El repuesto no debe estar instalado, probado ni usado, y el flete de la devolución es de tu cargo.',
    roles: [BUYER],
  },
  {
    grupo: 'Pago y entrega',
    q: '¿Hay repuestos que no admiten devolución por arrepentimiento?',
    a: 'Sí. Los productos de la categoría Eléctrico (fusibles y relés, bobinas, alternadores, baterías, comandos y switches, entre otros) no tienen devolución por retracto, y tampoco los fabricados o codificados a pedido para tu vehículo, ni los que ya fueron instalados o usados. En todos esos casos la garantía legal se mantiene: si llega con fallas, es incompatible o no corresponde a lo comprado, puedes reclamarlo.',
    roles: [BUYER],
  },
  {
    grupo: 'Pago y entrega',
    q: 'La tienda no despacha o no responde después de aceptar su oferta, ¿qué hago?',
    a: 'Abre un reclamo desde el detalle del pedido eligiendo El vendedor tarda demasiado en preparar o enviar el producto, o No logro contactar al vendedor. Si no hay acuerdo, el caso pasa a mediación de RepuesTop, que puede ordenar un reembolso total o parcial. Mientras el caso esté en mediación, la tienda no puede retirar el dinero de esa venta. Los reclamos por fallas pueden hacerse hasta 6 meses después de la entrega.',
    roles: [BUYER],
  },
  {
    grupo: 'Pago y entrega',
    q: 'Recibí el repuesto con fallas o incompatible, ¿qué hago?',
    a: 'Abre un reclamo desde el detalle del pedido, con el motivo que corresponda (incompatible, dañado, incorrecto o incompleto) y fotos. Se coordina la devolución o el cambio con la tienda y, si no hay acuerdo, el caso pasa a mediación. No coordines devoluciones por fuera de la plataforma: sin el reclamo registrado no queda respaldo.',
    roles: [BUYER],
  },

  // ---------------------------------------------------------------- Tiendas
  {
    grupo: 'Para casas de repuestos',
    q: '¿Quién puede enviar ofertas?',
    a: 'Solo las casas de repuestos verificadas, aprobadas y activas. No puedes ofertar en tu propia necesidad, y solo puedes ofrecer repuestos que estén en tu inventario. Te avisamos por notificación cuando se publica una necesidad nueva.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: '¿Cómo envío una oferta?',
    a: 'Abre la necesidad y toca Ofertar ahora. Para cada repuesto pendiente eliges un producto de tu inventario y su precio unitario. Debes cubrir todos los repuestos del pedido: si te falta alguno, no podrás registrar la oferta. Indica además tiempo de entrega, tipo de entrega, garantía y notas. Tu método de envío debe servir para la comuna del comprador (retiro, dentro de la comuna o fuera de ella); si no, la plataforma te indicará por qué no puedes ofrecerlo.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: '¿Puedo modificar o retirar mi oferta?',
    a: 'Puedes modificarla mientras la necesidad esté activa y el comprador no la haya aceptado: al volver a enviarla se actualiza tu oferta (hay una sola por tienda). No existe la opción de retirarla; si ya no puedes cumplir, modifícala antes de que sea aceptada o escríbenos desde Contactar soporte. Una oferta aceptada ya no se puede modificar.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: '¿Qué pasa si el comprador acepta mi oferta?',
    a: 'Te llega una notificación y esos repuestos quedan adjudicados a tu tienda. La venta se concreta cuando el comprador paga; desde ese momento verás el pedido en tus ventas, con su estado y envío, y deberás prepararlo y despacharlo o entregarlo en el plazo ofrecido.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: 'Me aceptaron la oferta pero el comprador no paga, ¿qué hago?',
    a: 'Mientras no haya pago no hay venta ni obligación de despachar, y no se genera ningún cobro. Un pago iniciado vence a los 30 minutos y el comprador puede reintentarlo. Si pasan los días y el comprador no paga, puedes escribirnos a soporte con el código NC-… de la necesidad.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: 'Perdí la necesidad: el comprador eligió a otra tienda, ¿qué pasa con mi oferta?',
    a: 'Si el comprador acepta la oferta de otra tienda, la tuya queda descartada y te lo avisamos. No tiene ningún costo ni afecta tu evaluación.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: 'El comprador no responde ni revisa mi oferta, ¿qué pasa?',
    a: 'En el seguimiento de tus ofertas puedes ver si el comprador ya la revisó. El comprador puede aceptar en cualquier momento hasta el cierre del plazo. Si el plazo termina sin que acepte, la necesidad queda Expirada y tu oferta también, sin costo para ti. Puedes mejorar tu oferta mientras siga activa y no esté aceptada.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: '¿Qué pasa si el comprador edita su pedido?',
    a: 'Si cambia los repuestos, cantidades o patentes, tus ofertas anteriores quedan sin efecto y te avisamos para que vuelvas a ofertar sobre el pedido actualizado. Si solo cambia datos como fotos o descripción, tu oferta se mantiene.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: 'Mi oferta fue aceptada pero ya no tengo stock, ¿qué hago?',
    a: 'Avísanos de inmediato desde Contactar soporte con el código NC-… y no despaches algo distinto a lo ofertado. Para evitarlo, mantén tu inventario al día y ofrece solo lo que tienes disponible. No cumplir una oferta aceptada puede dar lugar a un reclamo del comprador y a mediación.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: '¿Cuánto me cobran y cuándo me pagan?',
    a: 'La venta se trata como cualquier otro pedido: de lo que paga el comprador se descuenta la comisión vigente de RepuesTop (más IVA) y la de la pasarela de pago, y el dinero se libera una vez que el comprador recibe conforme, según las reglas de liquidación. El comprador no paga comisión adicional.',
    roles: [SELLER],
  },
  {
    grupo: 'Para casas de repuestos',
    q: 'El comprador se arrepintió después de comprar, ¿qué pasa conmigo?',
    a: 'Si el pedido está pendiente de pago, pagado o en preparación, el comprador puede cancelarlo y el reembolso se hace de inmediato. Si ya fue despachado, el comprador tiene 10 días corridos desde la recepción para pedir retracto. Debes confirmar en el chat del caso, dentro de 5 días hábiles, si la devolución llegó en buen estado u objetarla con fotos; si no respondes, se presume recibida en buen estado. Mientras el caso esté en mediación no puedes retirar el dinero de esa venta.',
    roles: [SELLER],
  },
];

export const AUCTION_HELP_INTRO = {
  titulo: 'Necesidades de compra',
  descripcion: 'Todo sobre publicar, ofertar, aceptar, pagar y qué pasa si te arrepientes o no hay respuesta.',
};
