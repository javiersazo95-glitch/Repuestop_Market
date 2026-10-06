/**
 * Textos legales de RepuesTop.
 *
 * ORIGEN: copiados de `mobile/constants/legal-texts.ts` del monorepo
 * (C:/ProyectoRepuestop/repuestop). Este repo es independiente, asi que NO hay
 * import compartido: si el texto cambia alla, hay que actualizarlo aqui.
 *
 * ADAPTACION A WEB: se reemplazaron las menciones a "la app" por "la Plataforma"
 * (el documento ahora cubre app y sitio web) y se agrego la seccion de cookies,
 * que en la app no aplicaba. Ambos cambios deben ser validados por un abogado
 * antes de publicar en produccion.
 */

/** Fecha de la version vigente, para mostrar en pantalla. */
export const LEGAL_VERSION = '1 de octubre de 2026';

/**
 * Codigo estable de la misma version, el que viaja al backend y queda guardado en
 * RT_aceptacion_terminos. Va aparte de LEGAL_VERSION porque comparar el texto largo en
 * espanol entre web, app y backend es fragil: basta una tilde o un espacio distinto para
 * que la comparacion falle y se le pida re-aceptar a todo el mundo.
 *
 * Debe coincidir con `repuestop.legal.version-vigente` del backend y con
 * LEGAL_VERSION_CODE de la app.
 */
export const LEGAL_VERSION_CODE = '2026-10-01';

/**
 * O49 (28-sep): identificacion de la empresa operadora, exigida por el Reglamento de Comercio
 * Electronico (DS 6/2021, art. 7: razon social, RUT, domicilio, contacto y representante legal)
 * y por la ley de datos personales (responsable del tratamiento). Se usa en los tres documentos
 * y en el pie del sitio. Mismos datos que BO_datos_empresa del backend (contrato de adhesion) y
 * que `mobile/constants/legal-texts.ts`.
 */
export const EMPRESA = {
  razonSocial: 'COREBIT SpA',
  rut: '78.474.031-5',
  domicilio: 'Pérez Valenzuela 1572, oficina 411, comuna de Providencia, Región Metropolitana de Santiago',
  domicilioCorto: 'Pérez Valenzuela 1572, of. 411, Providencia',
  representantes: 'Elias Choque y Javier Sazo',
  correo: 'contacto@repuestop.cl',
};

const IDENTIFICACION_EMPRESA = `${EMPRESA.razonSocial}, RUT ${EMPRESA.rut}, con domicilio en ${EMPRESA.domicilio}`;

// Seccion final, al estilo de los marketplaces chilenos (p. ej. Paris, "Representante legal"):
// la designacion es del operador y no se extiende a los vendedores.
const REPRESENTANTE_LEGAL = `${EMPRESA.razonSocial}, administradora de la Plataforma, designa como sus representantes legales a ${EMPRESA.representantes}, ambos con domicilio en ${EMPRESA.domicilio}. Esta designación no se extiende a los vendedores, que actúan por cuenta propia y tienen sus propios representantes legales.`;

// Bloques compartidos por los Términos del comprador y del vendedor: un comprador o una tienda pueden
// acreditar un servicio automotriz y publicar en el Mural, y cualquiera de los dos puede comprar Monedas.
const MURAL_SERVICIOS_TERMS = `RepuesTop ofrece un Mural de Anuncios donde talleres y servicios automotrices acreditados publican sus servicios, y una agenda para pedir citas con ellos.

A. ROL DE REPUESTOP:
En el Mural, RepuesTop actúa solo como vitrina y medio de contacto y agenda. No presta, supervisa ni garantiza los servicios publicados, no los cobra ni recibe su pago, y no media en controversias sobre su calidad, precio, plazo o resultado. El servicio, su precio, su garantía y la boleta o factura correspondiente son de exclusiva responsabilidad del taller o servicio que lo presta. Los reclamos sobre un servicio deben dirigirse al taller; el usuario puede además reportar el anuncio en la Plataforma y ejercer sus derechos ante el SERNAC o los tribunales competentes.

B. ACREDITACIÓN DEL SERVICIO:
Solo pueden publicar quienes acrediten su servicio automotriz con documento de identidad, inicio de actividades y patente municipal, además de los datos del negocio que pida la Plataforma. RepuesTop puede aprobar la acreditación, pedir correcciones o rechazarla; el anunciante puede corregir sus antecedentes y volver a enviarlos.

C. PUBLICACIÓN Y PLANES:
Cada anuncio se publica por períodos de 30 días, pagados con Monedas según el plan: Básica (100 Monedas), Destacada (200), Premium (400) y Empresarial (800). El primer anuncio Básico de cada cuenta es gratis durante su primer período. Cada plan define la cantidad de fotos, etiquetas e historias, el botón de WhatsApp y, en el plan Empresarial, la agenda de citas.
Las Monedas se descuentan al enviar el anuncio. Subir de plan cuesta el valor completo del plan nuevo, no la diferencia; bajar de plan no tiene costo ni devolución. La renovación no es automática: el anunciante puede renovar por otros 30 días pagando el valor de su plan, y la Plataforma le avisa 3 días antes del vencimiento. Al vencer, el anuncio deja de mostrarse.

D. REVISIÓN Y DEVOLUCIÓN DE MONEDAS:
La primera publicación de cada anuncio pasa por una revisión de RepuesTop. Si el anuncio se rechaza en esa primera revisión, o el anunciante lo elimina mientras está en revisión, se devuelven las Monedas cobradas. Si el anunciante corrige el anuncio rechazado y lo vuelve a enviar a revisión, se cobran nuevamente las Monedas devueltas. Una vez aprobado, eliminar el anuncio no devuelve Monedas.
RepuesTop puede rechazar, ocultar o retirar anuncios engañosos, fraudulentos, ilegales, duplicados, con datos de contacto falsos o contrarios a estos Términos, incluso después de aprobados.

E. AGENDA DE CITAS:
Para pedir una cita, el usuario debe iniciar sesión, elegir una hora disponible e indicar su nombre, teléfono y correo y, si quiere, la patente, el vehículo y una descripción. Esos datos se comparten con el taller. La cita queda solicitada hasta que el taller la acepte o la rechace; si llega la hora sin respuesta, vence.
El usuario puede reagendar o cancelar su cita, y el taller puede cancelar las citas que ya aceptó. Si el taller elimina su anuncio, sus citas vigentes se cancelan y se avisa al usuario. Pedir una cita no tiene costo en RepuesTop: el servicio se paga directamente al taller. El anunciante no puede pedir citas en su propio anuncio.

F. OBLIGACIONES DEL ANUNCIANTE:
El nombre, la dirección, el teléfono y el WhatsApp que publica el anunciante quedan visibles para cualquier visitante del Mural. El anunciante debe mantener esos datos y sus horarios correctos, atender las citas que acepte y cumplir la normativa aplicable a los servicios que presta, incluida la protección de los consumidores.`;

const MONEDAS_TERMS = `Las Monedas son créditos de uso interno de RepuesTop que permiten pagar los planes del Mural de Anuncios y destacar productos (productos Top).
• Valor y compra: cada Moneda equivale a $50, IVA incluido, y se compran en packs desde 100 Monedas ($5.000), pagando mediante la pasarela de pago de la Plataforma. Se acreditan cuando la pasarela confirma el pago. Por cada compra, RepuesTop emite la boleta o factura que el usuario elija antes de pagar y se la envía por correo.
• Uso: solo sirven para planes del Mural, si el usuario tiene un servicio automotriz acreditado, y para productos Top, si tiene una tienda aprobada. Comprar Monedas no da por sí solo acceso a esos servicios.
• Las Monedas no vencen, son personales, no se pueden transferir a otra cuenta y no se pueden canjear por dinero.
• Retracto y devoluciones: conforme al artículo 3° bis letra b) de la Ley N° 19.496, RepuesTop excluye expresamente el derecho a retracto respecto de las Monedas una vez acreditadas, por tratarse de un servicio digital que queda disponible de inmediato. Las Monedas ya gastadas solo se devuelven en los casos previstos en estos Términos. Lo anterior no afecta los derechos del usuario si una compra no se acredita o se cobra por error: en ese caso puede pedir a soporte su corrección o reembolso.
• Si el pago de una compra de Monedas se anula o se desconoce ante la pasarela o el emisor del medio de pago, RepuesTop puede descontar las Monedas correspondientes.
• Al cerrar la cuenta, el saldo de Monedas no usado se pierde. Antes de confirmar el cierre, la Plataforma informa el saldo disponible.`;

export const COMPRADOR_TERMS = `1. IDENTIFICACIÓN DE LA PLATAFORMA
RepuesTop es una plataforma de comercio electrónico, disponible como aplicación móvil y sitio web, administrada por ${IDENTIFICACION_EMPRESA}, en adelante también "RepuesTop", "la Plataforma" o "la Empresa". Estos Términos regulan el registro, acceso y uso de la Plataforma por parte de compradores.

2. ACEPTACIÓN DE LOS TÉRMINOS
Al crear una cuenta, acceder a la Plataforma, realizar una búsqueda, solicitar una cotización, comprar un producto, pedir una cita o usar cualquier funcionalidad, el comprador declara haber leído, entendido y aceptado estos Términos y la Política de Privacidad.
La aceptación se realiza mediante una casilla u otro mecanismo digital equivalente. RepuesTop registra la fecha, hora, cuenta, versión del documento aceptado y los antecedentes técnicos necesarios para acreditar dicha aceptación.

3. NATURALEZA DE REPUESTOP
RepuesTop no fabrica, almacena, revisa físicamente, importa ni vende directamente los productos publicados por los vendedores. Su función principal es facilitar la conexión entre compradores y vendedores formalizados, permitiendo búsqueda, cotización, pago, comunicación, seguimiento, soporte y mediación. Además ofrece un Mural de Anuncios de talleres y servicios automotrices, regulado en la sección 15.
El vendedor es el único responsable de la existencia, calidad, estado, origen, compatibilidad, precio, stock, despacho, garantía, emisión de boleta o factura y cumplimiento tributario asociado al producto vendido.

4. REGISTRO DEL COMPRADOR
Para comprar en RepuesTop el comprador deberá registrarse, mediante el formulario de la Plataforma, con verificación de su correo, o con su cuenta de Google.
RepuesTop podrá solicitar nombre completo, correo electrónico, teléfono, dirección, RUT, comuna, región y otros datos necesarios para operar la cuenta, procesar compras, coordinar entregas, emitir comprobantes, gestionar soporte o prevenir fraude.
Las personas naturales deberán ser mayores de edad para registrarse y comprar en la Plataforma. Si el usuario actúa en representación de una empresa, declara contar con facultades suficientes para ello.
El comprador es responsable de entregar información verdadera, completa, actualizada y verificable. RepuesTop podrá suspender o bloquear cuentas que entreguen información falsa, usen identidades de terceros o realicen mal uso de la Plataforma.

5. BÚSQUEDA POR PATENTE, VIN, MODELO O DATOS DEL VEHÍCULO
RepuesTop permite búsquedas mediante patente, VIN, chasis, marca, modelo, versión, año u otros datos del vehículo. La información entregada por la Plataforma tiene carácter orientativo y depende de fuentes de datos, integraciones o información ingresada por usuarios y vendedores.
Si los datos del vehículo son incompletos o no coinciden con la realidad, el comprador podrá utilizar la búsqueda manual por marca, modelo, año y versión.
RepuesTop no garantiza compatibilidad exacta del producto con el vehículo. La confirmación de compatibilidad será responsabilidad del vendedor cuando interactúe con el comprador, y el comprador deberá verificar la información antes de realizar la compra.

6. PREGUNTAS, COTIZACIONES Y CHAT
El comprador podrá realizar preguntas o solicitar cotizaciones al vendedor. El chat de cotización deberá utilizarse exclusivamente para resolver dudas sobre el producto, precio, disponibilidad, compatibilidad, despacho y condiciones de compra.
Cada cotización tiene el plazo de validez que fija el vendedor, en minutos, horas o días; una cotización vencida no se puede pagar. Mientras el comprador no pague, el vendedor podrá modificar o retirar la cotización.
El comprador puede pedir una modificación de la cotización; mientras el vendedor no responda, la cotización queda en pausa y no se puede pagar. El comprador puede compartir el enlace de una cotización, que muestra siempre su versión vigente.
Una vez pagada una cotización o compra, el vendedor no podrá modificar unilateralmente el precio del pedido ya pagado, sin perjuicio de las reglas sobre cancelación, errores evidentes, falta de stock, reclamos o mediación.

7. COMPRA, PAGO Y TARIFA DE SERVICIO
Las compras deberán pagarse dentro de RepuesTop mediante la pasarela de pago Flow, con los medios que esta habilite. Un pago iniciado y no completado vence a los 30 minutos y el pedido se cancela.
Actualmente RepuesTop no cobra una tarifa de servicio al comprador: el precio que se muestra en el checkout es el que se paga, más el despacho dentro de la comuna si corresponde. Si en el futuro se incorpora una tarifa, se informará de forma clara antes de confirmar el pago y requerirá la aceptación de los términos actualizados.

8. PROHIBICIÓN DE OPERACIONES EXTERNAS
Queda prohibido utilizar RepuesTop para contactar vendedores y cerrar operaciones de compra fuera de la Plataforma, eludir comisiones, evitar el sistema de pago, alterar la trazabilidad o impedir la gestión de soporte y reclamos.
Si comprador y vendedor realizan una operación externa, RepuesTop no será responsable por pagos, entregas, garantías, reclamos, devoluciones, fraudes, mediaciones ni daños asociados a dicha operación. El soporte, los reclamos, la mediación y la compra protegida de RepuesTop cubren exclusivamente las compras pagadas dentro de la Plataforma. Una cotización o una conversación por chat no constituyen compra mientras no se paguen en RepuesTop.

9. DESPACHO, RETIRO Y ENTREGA
Según lo que ofrezca cada vendedor, el comprador puede elegir por producto entre retiro en tienda, despacho dentro de la comuna de la tienda y envío fuera de la comuna. En una misma tienda no se puede combinar retiro con despacho.
• Despacho dentro de la comuna: su costo lo fija el vendedor y se paga junto con la compra.
• Envío fuera de la comuna: se realiza por courier con pago al recibir ("por pagar"). Su costo lo cobra el courier al momento de la entrega y no se incluye en el pago hecho en la Plataforma.
• Retiro en tienda: cuando el pedido está listo, el comprador recibe un código (PIN) de 6 dígitos, que debe mostrar al retirar. El vendedor lo necesita para entregar el producto.
El vendedor debe despachar o dejar listo para retiro el pedido dentro de 2 días hábiles desde la confirmación del pago (lunes a viernes, sin feriados). Si no lo hace, el comprador puede cancelar su compra en esa tienda según la sección 11.C, o iniciar un reclamo.
El comprador puede confirmar la recepción en la Plataforma. Si no lo hace, la recepción se da por confirmada automáticamente a los 10 días del envío en los envíos por courier (con un aviso al día 7) y a los 2 días en los despachos dentro de la comuna. Si el vendedor declara que entregó el producto, el comprador tiene 48 horas para indicar que no lo recibió; si no responde, se da por recibido. Tres días después de la recepción, el pedido se finaliza, salvo que exista un reclamo abierto.

10. BOLETA, FACTURA E IMPUESTOS
El vendedor es responsable de emitir la boleta o factura correspondiente por el producto vendido. La Plataforma le exige subirla para confirmar el pedido, y el comprador la recibe por correo.
El comprador podrá solicitar factura cuando corresponda, indicando los datos de facturación.
Si el vendedor no emite el documento tributario correspondiente, RepuesTop podrá notificarlo, solicitar regularización y adoptar medidas de soporte, mediación o sanción según la gravedad y reiteración del incumplimiento.

11. CAMBIOS, DEVOLUCIONES, RETRACTO Y GARANTÍA
Los cambios, devoluciones, retractos, garantías y reembolsos se regirán por la normativa chilena aplicable (Ley N° 19.496 y Ley N° 21.398), por las condiciones informadas por el vendedor y por las reglas operativas de RepuesTop.

Forma de pago de los reembolsos: los reembolsos de compras pagadas en la Plataforma se procesan a través de la pasarela de pago (Flow). El comprador recibirá un correo de la pasarela para aceptar la devolución, que deberá aceptar dentro del plazo que ahí se indique. En pagos con tarjeta, la devolución se realiza como reversa en el mismo medio de pago y su reflejo depende del emisor, con un plazo informado por la pasarela de hasta 10 días hábiles. Si el plazo vence sin aceptación, el comprador podrá solicitar a soporte que coordine la devolución.

A. DERECHO A RETRACTO LEGAL (COMPRAS A DISTANCIA / MEDIOS ELECTRÓNICOS):
Conforme al artículo 3° bis letra b) de la Ley N° 19.496, tratándose de compras realizadas a través de la Plataforma, el comprador persona natural podrá poner término unilateralmente al contrato (retracto) dentro del plazo de diez (10) días corridos contados desde la recepción física del producto.
Para ejercer válidamente el derecho a retracto se deberán cumplir copulativamente las siguientes condiciones:
1. El producto debe ser restituido nuevo, sin uso, en su empaque y caja original de fábrica sellada, con todos sus manuales, etiquetas, sellos de seguridad y accesorios completos.
2. No procederá el derecho a retracto si el repuesto ha sido manipulado, armado, conectado, probado o instalado en un vehículo, o si presenta signos de montaje mecánico, residuos de combustible, lubricantes o grasa.
3. Exclusiones por naturaleza del bien (Art. 3 bis Ley 19.496): Dada su extrema sensibilidad técnica a daños por sobrecargas, problemas de masa o fallas eléctricas preexistentes en el vehículo del comprador, quedan expresamente excluidos del retracto una vez desellados o abiertos: sensores (oxígeno, flujo de aire, ABS, etc.), módulos de control o ECUs, bobinas de encendido, alternadores, arrancadores y cualquier componente eléctrico o electrónico. Asimismo, se excluyen repuestos fabricados, adaptados o importados a pedido especial del cliente o configurados con codificación única de chasis (VIN).
4. Costos de flete: Los gastos de despacho y flete derivados de la devolución por retracto voluntario serán de cargo exclusivo del comprador.
5. Procedimiento: el comprador debe iniciar un reclamo por retracto desde el detalle del pedido dentro del plazo de 10 días, adjuntando fotografías del producto y de su empaque sellado, y coordinar la devolución con el vendedor en el chat del reclamo. Si no llegan a acuerdo, cualquiera de los dos puede pedir la intervención de un mediador de RepuesTop dentro de ese mismo plazo; el mediador resuelve con la evidencia de ambas partes y, si corresponde, ordena el reembolso. Mientras el caso esté en mediación, el vendedor no puede retirar el dinero de esa venta.

B. GARANTÍA LEGAL (6 MESES):
Conforme al artículo 21 de la Ley N° 19.496 (modificado por la Ley N° 21.398), cuando el producto presente fallas, defectos de fabricación, deficiencias de calidad o resulte incompatible por indicación o recomendación errónea atribuible al vendedor, el comprador tendrá derecho, dentro del plazo de seis (6) meses desde la recepción, a optar entre: (a) la reparación gratuita, (b) la reposición del producto, o (c) la devolución del dinero pagado. En estos casos de garantía legal por falla comprobada, los costos de traslado o flete para la devolución correrán por cuenta del vendedor.
La garantía legal la cumple el vendedor. Dentro de los primeros 10 días desde la recepción, el comprador puede reclamarla en la Plataforma con ayuda de un mediador, conforme a la sección 12. Después de ese plazo, y hasta los 6 meses, RepuesTop la canaliza mediante una solicitud de soporte desde el detalle del pedido: comunica el caso al vendedor y acompaña al comprador, pero el reembolso ya no se hace con dinero retenido por RepuesTop, sino directamente por el vendedor.

C. CANCELACIÓN POR EL COMPRADOR:
Mientras el pedido de una tienda esté pendiente de pago, pagado o en preparación, el comprador puede cancelarlo desde el detalle del pedido. La cancelación es inmediata, abarca la parte de esa tienda y el reembolso se solicita a la pasarela de pago en el mismo momento. Una vez despachado o listo para retiro, la solicitud se tramita exclusivamente de acuerdo con las reglas de retracto, garantía o mediación.

12. RECLAMOS Y MEDIACIÓN
Después de realizar un pago, el comprador o el vendedor pueden iniciar un reclamo desde el detalle del pedido. Los reclamos y la mediación solo proceden respecto de compras pagadas dentro de RepuesTop. Un reclamo se puede iniciar hasta 6 meses después de la entrega; si su motivo es el retracto, dentro de los 10 días desde la recepción.
El reclamo comienza como una conversación entre comprador y vendedor. Si no llegan a acuerdo, cualquiera de los dos puede pedir la intervención de un mediador de RepuesTop dentro de los 10 días corridos desde la recepción. RepuesTop también podrá intervenir cuando exista sospecha de fraude, incumplimiento, producto falso, producto no entregado o cualquier situación que afecte la seguridad de la Plataforma.
Ambas partes podrán subir evidencia en los formatos que la Plataforma habilite (imágenes y PDF).
El mediador resuelve con la evidencia disponible. Puede ordenar un reembolso total o parcial, la reposición o la reparación del producto, o resolver a favor del vendedor (por ejemplo, si el producto es conforme, la entrega está acreditada o el reclamo está fuera de plazo). También puede adoptar medidas como retener pagos o suspender cuentas.
La decisión de RepuesTop será obligatoria dentro de la Plataforma, sin perjuicio de los derechos legales que puedan corresponder a las partes ante el SERNAC, el Juzgado de Policía Local u otros tribunales competentes.

13. CALIFICACIONES
Una vez recibido el pedido, el comprador puede calificar a la tienda y sus productos con una nota de 1 a 5. Las calificaciones deben reflejar una experiencia real de compra; RepuesTop puede eliminar calificaciones fraudulentas o manipuladas.

14. USO DEL CHAT Y EVIDENCIA
Los mensajes enviados dentro de la Plataforma podrán ser registrados como evidencia en caso de reclamo, soporte, investigación de fraude, mal uso o mediación.
No se permite compartir teléfonos, correos, enlaces externos, instrucciones de pago externo u otros medios destinados a cerrar operaciones fuera de RepuesTop.
Los mensajes no podrán ser eliminados por los usuarios, salvo que RepuesTop implemente una funcionalidad específica conforme a sus políticas internas y obligaciones legales.
RepuesTop no revisará conversaciones de manera general o indiscriminada. Sin embargo, podrá acceder y revisar conversaciones relacionadas con una compra, cotización, reclamo, denuncia, sospecha de fraude, mal uso de la Plataforma, solicitud de soporte o mediación.

15. MURAL DE ANUNCIOS, SERVICIOS AUTOMOTRICES Y CITAS
${MURAL_SERVICIOS_TERMS}

16. MONEDAS
${MONEDAS_TERMS}

17. CONDUCTAS PROHIBIDAS
• Realizar fraude, suplantación de identidad o entrega de información falsa.
• Cerrar compras o pagos fuera de RepuesTop cuando el contacto se originó en la Plataforma.
• Insultar, amenazar, acosar o discriminar a otros usuarios.
• Manipular precios, calificaciones, reclamos o evidencias.
• Pedir citas que no se piensa atender, publicar anuncios engañosos o reportar anuncios de mala fe.
• Usar bots, scraping, extracción masiva de datos o herramientas que afecten la Plataforma.
• Utilizar la Plataforma para fines distintos a buscar, cotizar o comprar repuestos y accesorios permitidos, o a usar el Mural de Anuncios.

18. SUSPENSIÓN, BLOQUEO Y CIERRE DE CUENTA
RepuesTop podrá suspender o bloquear una cuenta cuando exista mal uso de la Plataforma, fraude, suplantación, incumplimiento grave, operaciones externas, agresiones, entrega de evidencia falsa o afectación a la seguridad de la Plataforma. La suspensión puede ser por un plazo determinado o indefinida. El comprador puede pedir la revisión de la medida desde la Plataforma, y RepuesTop podrá mantenerla, modificarla o levantarla.
El comprador puede cerrar su cuenta desde la Plataforma. El cierre se hace efectivo 30 días después de solicitarlo y en ese plazo puede revertirlo iniciando sesión nuevamente. No se puede cerrar la cuenta mientras haya pedidos o mediaciones en curso. El saldo de Monedas se pierde al cerrar la cuenta (sección 16). RepuesTop podrá conservar información necesaria por motivos legales, tributarios, contables, de seguridad, prevención de fraude, atención de reclamos, mediaciones o cumplimiento normativo, conforme a la Política de Privacidad.

19. NOTIFICACIONES Y COMUNICACIONES
RepuesTop podrá enviar notificaciones y correos transaccionales relacionados con seguridad, pagos, compras, citas, reclamos, mediaciones, cambios de Términos, estado de pedidos y funcionamiento de la cuenta.
RepuesTop no envía comunicaciones comerciales o promocionales. Si en el futuro lo hace, pedirá antes las autorizaciones correspondientes.

20. MODIFICACIONES DE LOS TÉRMINOS
RepuesTop podrá modificar estos Términos para adaptarlos a cambios legales, operativos, tecnológicos, comerciales o de seguridad. Los cambios relevantes serán informados mediante notificación en la Plataforma, aviso al iniciar sesión u otro canal disponible.
Cuando el cambio sea relevante, RepuesTop podrá exigir una nueva aceptación digital para continuar usando la Plataforma.

21. LEY APLICABLE Y SOLUCIÓN DE CONFLICTOS
Estos Términos se rigen por las leyes de la República de Chile. Antes de iniciar otras acciones, el comprador deberá utilizar los canales internos de soporte o mediación disponibles en RepuesTop, sin perjuicio de los derechos que la ley le reconozca.

22. CONTACTO
Para soporte, reclamos o mediación, el canal principal será el botón de ayuda dentro de la Plataforma. Para asuntos legales o privacidad, el correo de contacto será contacto@repuestop.cl. Para soporte general, el correo será soporte@repuestop.cl, sin perjuicio de los canales que RepuesTop habilite.

23. REPRESENTANTE LEGAL
${REPRESENTANTE_LEGAL}`;

export const VENDEDOR_TERMS = `RepuesTop es administrada por ${IDENTIFICACION_EMPRESA} (en adelante, "RepuesTop" o "la Plataforma"). Contacto: ${EMPRESA.correo}.

1. REGISTRO Y VALIDACIÓN DEL VENDEDOR
El vendedor deberá ser una empresa formalizada con inicio de actividades ante el SII y contar con patente comercial u otro antecedente equivalente exigido por RepuesTop.
Para registrarse, el vendedor deberá entregar razón social, RUT empresa, giro, dirección, teléfono, correo, datos del representante legal y demás antecedentes solicitados.
RepuesTop solicita como documentos obligatorios la cédula del representante legal, el inicio de actividades, la patente comercial y una boleta o factura emitida por la empresa, y podrá pedir antecedentes bancarios u otros necesarios para verificar la identidad, existencia y cumplimiento mínimo del vendedor.
El vendedor no podrá publicar ni vender mientras su solicitud se encuentre en validación, ni antes de aceptar el Contrato de Adhesión. La aprobación o rechazo será gestionada por el área interna designada por RepuesTop.

2. ACEPTACIÓN DE DOCUMENTOS OBLIGATORIOS
Para operar como vendedor, será obligatorio aceptar digitalmente estos Términos, el Contrato de Adhesión del Vendedor y la Política de Privacidad.
La aceptación digital se realiza mediante una casilla, botón de aceptación u otro mecanismo equivalente. RepuesTop registra la fecha, hora, cuenta, versión del documento y los datos técnicos necesarios para acreditar la aceptación.

3. RECHAZO, APELACIÓN Y ACTUALIZACIÓN DOCUMENTAL
Si el vendedor entrega documentos falsos, incorrectos, incompletos, vencidos o inconsistentes, RepuesTop podrá rechazar la solicitud indicando una justificación razonable.
El vendedor podrá corregir sus antecedentes y apelar el rechazo desde la Plataforma; su solicitud vuelve entonces a revisión.
RepuesTop podrá solicitar documentos actualizados en el futuro. Si el vendedor no los entrega, RepuesTop podrá restringir, suspender o bloquear la cuenta en casos graves o cuando exista riesgo legal, tributario, comercial, reputacional o de seguridad.

4. PRODUCTOS PERMITIDOS Y PROHIBIDOS
El vendedor podrá publicar repuestos y accesorios para vehículos, así como otros productos relacionados con el rubro vehicular que RepuesTop permita.
No se permite publicar productos usados ni reacondicionados. El vendedor podrá publicar productos originales o alternativos, debiendo informar correctamente la calidad del producto al momento de crear la publicación.
• Se prohíben productos falsificados, robados, peligrosos, sin procedencia acreditable, ilegales o no relacionados con el rubro vehicular.
• Se prohíben publicaciones engañosas, precios manipulados, descripciones falsas, imágenes no autorizadas o información que induzca a error al comprador.
• RepuesTop podrá solicitar correcciones, ocultar, pausar o eliminar publicaciones sospechosas, incompletas, falsas o contrarias a estos Términos, sin necesidad de bloquear previamente toda la cuenta del vendedor.

5. RESPONSABILIDAD POR PUBLICACIONES, STOCK Y PRECIO
El vendedor será exclusivo responsable de que la información de cada producto sea correcta, suficiente, actualizada y verificable.
El vendedor deberá mantener actualizado el stock, precio, condiciones, calidad, compatibilidad, imágenes y disponibilidad de sus productos.
Si publica un precio incorrecto, deberá corregirlo desde su inventario. Si el precio ya fue pagado por el comprador, el vendedor deberá respetarlo salvo casos de error evidente, falta de stock, imposibilidad de cumplimiento o resolución de mediación.

6. COMPATIBILIDAD DE PRODUCTOS
RepuesTop podrá orientar la búsqueda mediante patente, VIN, chasis, marca, modelo, versión o año. Sin embargo, RepuesTop no garantiza compatibilidad exacta del producto con el vehículo.
Cuando el comprador realice preguntas o solicite cotización, y al confirmar cada pedido, el vendedor será responsable de verificar la compatibilidad de acuerdo con la información disponible, su experiencia, catálogos, números de parte, marca, modelo, año y demás antecedentes pertinentes, incluido el vehículo que el comprador indicó en su compra.

7. COTIZACIONES
El vendedor podrá publicar productos con precio visible o sin precio mediante botón de cotización.
Cada cotización tiene el plazo de validez que fija el vendedor, en minutos, horas o días; una cotización vencida no se puede pagar. Antes del pago, el vendedor podrá modificar o retirar la cotización, salvo mientras haya un pago en curso. Si el comprador pide una modificación, la cotización queda en pausa hasta que el vendedor envíe una nueva o mantenga la original, y la Plataforma le recuerda responder.
Después del pago, el vendedor no podrá modificar unilateralmente las condiciones esenciales aceptadas por el comprador. Una cotización solo cuenta con soporte, reclamos y mediación de RepuesTop cuando el comprador la paga dentro de la Plataforma.

8. VENTAS, PAGOS, COMISIÓN Y LIQUIDACIÓN
Las ventas iniciadas en RepuesTop deberán pagarse dentro de la Plataforma. Se prohíbe indicar al comprador que pague por fuera, compartir datos de contacto externos o utilizar el chat para evitar comisiones.
RepuesTop cobrará al vendedor una comisión por uso de la Plataforma, intermediación tecnológica, procesamiento, soporte, seguimiento, reclamos y mediación. La comisión estándar de RepuesTop para tiendas verificadas es de 8% más el 19% de IVA, calculada sobre el valor de cada venta (productos, menos descuentos, más el despacho dentro de la comuna cobrado por el vendedor), sin tramos ni tope. Las tiendas con condición de Tienda Fundadora pagan una tarifa fija preferencial de 5% más IVA durante los primeros tres (3) meses desde la aprobación de su tienda; el beneficio es para las primeras cien (100) tiendas aprobadas, sin perjuicio de que RepuesTop pueda ampliar su cupo o duración.
El costo de recaudación y procesamiento de pagos vía pasarela electrónica (Flow: 2,89% más IVA, total 3,4391%) es de cargo del vendedor y se deducirá al liquidar la venta, sobre la misma base que la comisión.
El dinero de cada venta queda disponible para retiro 11 días después de la entrega al comprador, una vez finalizado el pedido y siempre que no existan reclamos en mediación, devoluciones pendientes o sospechas de fraude.

9. RETIROS Y FACTURA DE COMISIÓN
El vendedor solicita el retiro de su saldo disponible desde la Plataforma, sin monto mínimo, y debe tener registrados sus datos bancarios completos. Solo puede haber un retiro en curso a la vez.
Los retiros se pagan por transferencia bancaria el jueves siguiente a la solicitud. Al pagar cada retiro, RepuesTop emite la factura por la comisión y su IVA correspondiente a las ventas incluidas en ese retiro, para que el vendedor la utilice como crédito fiscal; ningún retiro se paga sin su factura.

10. RETENCIÓN DE PAGOS, REEMBOLSOS Y RECLAMOS GRAVES
RepuesTop podrá retener pagos ante sospecha de fraude, incumplimiento, reclamo, venta de producto falsificado o ilegal, falta de entrega, documentación inconsistente, revisión en curso, suspensión de la cuenta o cualquier circunstancia que razonablemente requiera revisión. Mientras una venta esté en mediación, su dinero no se puede retirar.
Si la mediación resuelve un reembolso, RepuesTop no cobra comisión sobre el monto devuelto, pero el vendedor asume el costo de la pasarela de toda la venta y el cargo que la pasarela cobra por el reembolso. Lo que no pueda descontarse de la propia venta queda como un cargo que se descuenta de sus próximos retiros.

11. CONFIRMACIÓN DEL PEDIDO, BOLETA E IMPUESTOS
Para confirmar un pedido pagado y pasarlo a preparación, el vendedor debe completar los pasos que pida la Plataforma: confirmar la disponibilidad y la entrega, verificar la compatibilidad con el vehículo del comprador y subir la boleta o factura de la venta. La Plataforma le recuerda los pedidos sin confirmar.
El vendedor será responsable de emitir boleta o factura al comprador por cada venta, según corresponda legal y tributariamente. Subir el documento es obligatorio para confirmar el pedido y el comprador lo recibe por correo.
Si no emite el documento correspondiente, RepuesTop podrá notificarlo y aplicar medidas en caso de reiteración o gravedad.

12. DESPACHO, RETIRO Y ENTREGA
El vendedor será responsable del despacho, entrega o habilitación de retiro en tienda de los productos vendidos, según las modalidades que ofrezca: retiro en tienda, despacho dentro de su comuna (con el costo que él fija, pagado junto con la compra) y envío fuera de la comuna por courier con pago al recibir.
El vendedor debe despachar o dejar listo para retiro cada pedido dentro de 2 días hábiles desde la confirmación del pago (lunes a viernes, sin feriados). Si no lo hace, el comprador puede cancelar su compra mientras el pedido esté pagado o en preparación, con reembolso inmediato, o iniciar un reclamo.
En el retiro en tienda, el comprador recibe un código (PIN) de 6 dígitos y el vendedor debe ingresarlo para entregar el producto; la Plataforma limita los intentos fallidos.
Si el comprador no confirma la recepción, esta se da por confirmada automáticamente a los 10 días del envío por courier y a los 2 días del despacho dentro de la comuna. El vendedor puede declarar la entrega: si el comprador no indica en 48 horas que no la recibió, se da por recibida; si lo indica, el caso pasa a mediación.

13. GARANTÍA, DEVOLUCIÓN Y RETRACTO
El vendedor deberá cumplir rigurosamente con la garantía legal y demás obligaciones de protección al consumidor establecidas en la Ley N° 19.496 y la Ley N° 21.398.

A. DERECHO A RETRACTO (10 DÍAS CORRIDOS):
El vendedor reconoce que el comprador persona natural tiene derecho a retractarse de su compra dentro del plazo legal de diez (10) días corridos desde la entrega, sujeto a las condiciones de admisibilidad: producto nuevo, sin uso, en su empaque original sellado y con exclusión de componentes eléctricos o electrónicos abiertos/desellados, o repuestos a pedido especial.
El comprador ejerce el retracto mediante un reclamo en la Plataforma. El vendedor debe responder en el chat del reclamo y colaborar en la recepción e inspección física del repuesto devuelto. Si no hay acuerdo, el mediador de RepuesTop resuelve con la evidencia de ambas partes y, si corresponde, ordena el reembolso conforme a la sección 10.

B. GARANTÍA LEGAL DE SEIS (6) MESES:
El vendedor es el único y directo responsable de responder por la garantía legal de seis (6) meses (Art. 21 Ley N° 19.496) frente al comprador cuando el repuesto presente defectos de fabricación o vicios ocultos. Si la pieza resulta defectuosa, fallada o incompatible por error de la tienda, el vendedor deberá asumir íntegramente los costos de traslado/devolución y ofrecer al cliente la opción de reparación, reposición o reembolso. Pasados los 10 días desde la recepción, RepuesTop canaliza estos casos mediante una solicitud de soporte y el vendedor responde directamente al comprador.

C. EVALUACIÓN Y MEDIACIÓN:
El vendedor deberá revisar con prontitud las solicitudes de devolución. Si surge controversia sobre el estado del producto (por ejemplo, si fue instalado, dañado o manipulado indebidamente), el mediador de RepuesTop intervendrá para resolver la disputa sobre la base de la evidencia técnica y documental aportada.

14. RECLAMOS Y MEDIACIÓN
Comprador y vendedor pueden iniciar un reclamo desde el detalle del pedido. Los reclamos y la mediación solo proceden respecto de ventas pagadas dentro de RepuesTop.
Si no hay acuerdo, cualquiera de las partes puede pedir la intervención de un mediador de RepuesTop dentro de los 10 días corridos desde la recepción. RepuesTop también podrá intervenir cuando detecte una situación que requiera revisión.
Ambas partes podrán subir evidencia en los formatos que la Plataforma habilite (imágenes y PDF). El mediador puede ordenar un reembolso total o parcial, la reposición o la reparación del producto, o resolver a favor del vendedor. La decisión de RepuesTop será obligatoria dentro de la Plataforma, sin perjuicio de los derechos legales de las partes.

15. PRODUCTOS TOP Y MONEDAS
El vendedor puede destacar productos como "Top" para que aparezcan primero cuando el comprador ordena los resultados por "Recomendados". Cada producto Top cuesta 200 Monedas por 30 días; la tienda puede tener hasta 10 productos Top a la vez y cuenta con 2 activaciones gratis, por una sola vez. Renovar antes del vencimiento suma 30 días; al vencer, el producto deja de destacarse sin cobro automático. Quitar la marca Top antes de tiempo no devuelve Monedas.
${MONEDAS_TERMS}

16. MURAL DE ANUNCIOS, SERVICIOS AUTOMOTRICES Y CITAS
Si el vendedor también presta un servicio automotriz y lo acredita, puede publicarlo en el Mural de Anuncios en las siguientes condiciones:
${MURAL_SERVICIOS_TERMS}

17. SUSPENSIÓN, SANCIONES Y REVISIÓN
RepuesTop podrá suspender la cuenta del vendedor en casos de no respuesta reiterada, incumplimiento de plazos, venta de productos falsificados, ilegales o sin procedencia, documentos falsos, fraude, incumplimientos graves, operaciones externas, manipulación de evidencias o afectación de la Plataforma. Al suspenderla, sus publicaciones se ocultan y los pedidos no pagados se anulan. Según la gravedad, la suspensión puede ser:
• Temporal: por un plazo determinado, al cabo del cual la cuenta se reactiva sola. El vendedor debe cumplir los pedidos ya pagados dentro de 2 días hábiles desde su pago, y el comprador tiene 7 días para retirar en tienda. Sus fondos quedan congelados hasta la reactivación.
• Definitiva: el vendedor debe cumplir los pedidos ya pagados en el mismo plazo, con un máximo de 72 horas desde la suspensión, y el comprador tiene 5 días para retirar en tienda. Sus fondos quedan en reserva hasta 30 días hábiles desde su última venta, para cubrir reclamos y devoluciones.
• Por fraude: los pedidos no despachados se cancelan y reembolsan de inmediato, y los fondos quedan retenidos hasta la revisión de RepuesTop.
En los dos primeros casos, si un pedido no se cumple dentro del plazo, RepuesTop lo cancela y reembolsa al comprador.
El vendedor puede pedir la revisión de la medida desde la Plataforma. La revisión será realizada por el área designada por RepuesTop, que podrá solicitar antecedentes adicionales y resolver mantener, modificar o levantar la medida.

18. PROPIEDAD INTELECTUAL Y CONTENIDO
El vendedor autoriza a RepuesTop a mostrar su nombre comercial, logo, tienda, productos, descripciones, precios, imágenes y demás información necesaria para operar la Plataforma. Esta autorización no implica cesión de propiedad intelectual, salvo lo necesario para prestar el servicio.
El vendedor declara que las imágenes, marcas, textos y descripciones que sube son propias, públicas, autorizadas o lícitamente utilizables. El vendedor será responsable frente a terceros por infracciones de propiedad intelectual, uso de imágenes no autorizadas o información engañosa.

19. CIERRE DE CUENTA
El vendedor puede cerrar su cuenta desde la Plataforma. No se puede cerrar mientras existan pedidos o mediaciones en curso o un retiro solicitado. El cierre se hace efectivo 30 días después de solicitarlo y en ese plazo puede revertirlo iniciando sesión nuevamente. El saldo de Monedas se pierde al cerrar la cuenta.
RepuesTop podrá conservar información necesaria por motivos legales, contables, tributarios, de seguridad, prevención de fraude, mediación, cumplimiento contractual o defensa ante reclamaciones, conforme a la Política de Privacidad.

20. MODIFICACIONES
RepuesTop podrá modificar estos Términos, comisiones, reglas de operación o condiciones comerciales. Los cambios relevantes serán informados mediante notificación en la Plataforma, aviso al iniciar sesión u otro canal disponible. Si el vendedor no acepta nuevas condiciones obligatorias, no podrá continuar operando en la Plataforma.

21. LEY APLICABLE
Estos Términos se rigen por las leyes de Chile. El vendedor acepta utilizar previamente los canales internos de soporte, reclamo y mediación de RepuesTop, sin perjuicio de los derechos y acciones que correspondan conforme a la ley.

22. REPRESENTANTE LEGAL
${REPRESENTANTE_LEGAL}`;

export const PRIVACIDAD_POLICY = `1. RESPONSABLE DEL TRATAMIENTO
El responsable del tratamiento de datos personales es ${IDENTIFICACION_EMPRESA}, titular de RepuesTop, disponible como aplicación móvil y sitio web (en adelante, "la Plataforma"). Para asuntos de privacidad, el canal de contacto es contacto@repuestop.cl, sin perjuicio de otros canales que se habiliten dentro de la Plataforma.
Esta Política se ajusta a la Ley N° 19.628 y a las modificaciones introducidas por la Ley N° 21.719, que entran en vigencia el 1 de diciembre de 2026, así como a la normativa chilena aplicable en materia de datos personales, comercio electrónico y protección de los consumidores.

2. DATOS QUE RECOPILAMOS
RepuesTop recopila los datos que el usuario ingresa en formularios, los que se generan por el uso de la Plataforma y los necesarios para compras, pagos, reclamos, soporte y seguridad.
• Datos de cuenta: nombre, correo, teléfono, foto de perfil y contraseña (guardada de forma irreversible, nunca en texto legible). Si el usuario inicia sesión con Google, RepuesTop recibe de Google su nombre, correo y foto de perfil.
• Datos del comprador: RUT, dirección, comuna y región de entrega, datos para boleta o factura (razón social y giro, si los ingresa), historial de compras y cotizaciones, calificaciones, favoritos, reclamos y evidencias.
• Datos del vendedor: razón social, RUT de la empresa, giro, dirección, teléfono, correo, datos bancarios para el pago de sus ventas, documentos de validación, información de la tienda y datos del representante legal.
• Datos del representante legal: nombre, RUT, cédula de identidad, datos de contacto y antecedentes necesarios para validar su identidad y representación.
• Datos de talleres, servicios automotrices y otros anunciantes del Mural de Anuncios: nombre del negocio, dirección, teléfono o WhatsApp, horarios, fotos y documentos de acreditación.
• Datos de las recargas de Monedas: packs comprados, pagos, documentos de compra y su uso en planes de difusión de anuncios y productos destacados.
• Datos de las citas que el usuario agenda con un taller o servicio: nombre, teléfono, correo, patente, datos del vehículo y descripción del servicio solicitado.
• Datos de los captadores del programa de referidos: nombre, RUT, comuna, fotografía de la cédula de identidad por ambos lados, certificado de antecedentes, datos bancarios para el pago de comisiones, contenido que publican en redes sociales para el programa y registro de las tiendas y compradores que refieren.
• Datos del vehículo consultado: patente, marca, modelo, versión, año, VIN, chasis u otros datos ingresados o derivados de la consulta.
• Datos de ubicación: solo cuando el usuario lo autoriza, en los términos de la sección 5.
• Datos técnicos y de seguridad: fecha y hora de las acciones dentro de la Plataforma, dirección IP y navegador o dispositivo con que se aceptan los documentos legales, dirección IP de cada solicitud en los registros técnicos, identificador del dispositivo para notificaciones, incidencias y datos necesarios para prevenir fraude o abuso.

3. FINALIDADES DEL TRATAMIENTO
• Crear y administrar cuentas de comprador, vendedor, anunciante y captador.
• Validar vendedores formalizados, anunciantes, captadores, sus documentos y representantes legales.
• Permitir la búsqueda de repuestos por patente, VIN, chasis, modelo, año, versión o búsqueda manual.
• Procesar cotizaciones, compras, pagos, despachos, retiro en tienda y seguimiento de pedidos.
• Publicar anuncios en el Mural de Anuncios, gestionar la agenda de citas con talleres y servicios, y procesar las recargas de Monedas y los planes de difusión.
• Mostrar al usuario, si lo autoriza, las casas de repuestos, talleres y servicios más cercanos a su ubicación.
• Gestionar el programa de captadores: atribuir los referidos, calcular y pagar las comisiones y revisar el contenido publicado para el programa.
• Compartir los datos mínimos necesarios entre las partes para concretar una compra, cita, facturación, entrega, garantía o reclamo.
• Gestionar soporte, reclamos, mediaciones, apelaciones, bloqueos y prevención de fraude.
• Enviar notificaciones y correos transaccionales relacionados con seguridad, pagos, pedidos, citas, reclamos, mediaciones y cambios de los documentos legales.
• Cumplir obligaciones legales, tributarias, contables, contractuales y de seguridad.
• Mantener la operación, estabilidad y seguridad de la Plataforma y corregir sus fallas.
RepuesTop no vende datos personales ni los utiliza para elaborar perfiles con fines publicitarios.

4. DATOS DEL VEHÍCULO
RepuesTop trata los datos del vehículo consultado, incluyendo patente, marca, modelo, versión, año, VIN, chasis u otros antecedentes necesarios para orientar la búsqueda de productos compatibles. Para identificar el vehículo a partir de la patente, RepuesTop la consulta a un proveedor externo de información vehicular.
El vehículo con el que el usuario busca se guarda en su propio dispositivo. Cuando el usuario cotiza, compra o agenda una cita, los datos del vehículo quedan asociados a esa operación para verificar la compatibilidad del repuesto o preparar el servicio, y se usan además para soporte, prevención de errores y reclamos. RepuesTop no garantiza que la información del vehículo sea siempre exacta o completa.

5. UBICACIÓN (GEOLOCALIZACIÓN)
RepuesTop usa la ubicación del dispositivo con una sola finalidad: mostrar al usuario a qué distancia están las casas de repuestos, talleres y servicios automotrices publicados en la Plataforma, ordenarlos del más cercano al más lejano y sugerirle su comuna para filtrar resultados cercanos.
• Cuándo se usa: solo con la Plataforma abierta y en uso. El permiso se pide únicamente cuando el usuario elige una opción de cercanía, como el ícono de ubicación ("cerca de mí"), ordenar por "más cercano" o "usar mi ubicación" en el filtro de comuna. Si ya lo otorgó, la Plataforma muestra la distancia al abrir el directorio de tiendas, el Mural de Anuncios o el detalle de un anuncio. RepuesTop no accede a la ubicación en segundo plano ni con la aplicación cerrada.
• Qué dato se usa: la posición aproximada del dispositivo, sin el modo de alta precisión, y el nombre de la comuna y región que se deriva de ella.
• Autorización: el usuario la otorga mediante el permiso de ubicación de su teléfono o de su navegador. Es voluntaria: sin ella, la Plataforma funciona igual y el usuario puede elegir su comuna o región manualmente; solo dejará de ver la distancia a cada tienda o taller.
• Conservación: las coordenadas se procesan en el dispositivo del usuario para calcular las distancias. No se envían a los servidores de RepuesTop, no se guardan en la cuenta ni se asocian al historial del usuario. En el sitio web se mantienen en la memoria del navegador solo mientras la página permanezca abierta.
• Terceros: la ubicación no se comparte con tiendas, talleres, anunciantes ni captadores, y no se usa para publicidad, elaboración de perfiles ni venta de datos. Si el teléfono o el navegador no logra identificar la comuna, la Plataforma envía las coordenadas, sin ningún dato de la cuenta, a un servicio externo de mapas (Photon, operado por Komoot en Alemania) con el único fin de obtener el nombre de la comuna.
• Retiro del permiso: el usuario puede retirarlo en cualquier momento desde los ajustes de su teléfono o de su navegador. Desde ese momento la Plataforma deja de usar su ubicación.
La ubicación de las tiendas y talleres es distinta: RepuesTop convierte en coordenadas la dirección pública que cada tienda o anunciante publica, para mostrarla en el mapa y calcular distancias. Esa información es pública por decisión de quien la publica.

6. COMPARTICIÓN DE DATOS
RepuesTop comparte datos del comprador con el vendedor solo cuando es necesario para gestionar una cotización, compra, boleta o factura, despacho, retiro, garantía, devolución, reclamo o mediación.
RepuesTop comparte datos del vendedor con el comprador solo en el detalle de la compra, publicación, tienda, soporte, garantía, despacho o reclamo.
Cuando el usuario agenda una cita, sus datos de contacto, los datos del vehículo y la descripción del servicio se comparten con el taller o servicio que eligió. El nombre, la dirección, el teléfono y el WhatsApp que publica un anunciante quedan visibles para quienes visitan el Mural de Anuncios.
RepuesTop no comparte la ubicación del usuario con ninguna de las partes anteriores.

7. PROVEEDORES EXTERNOS Y TRANSFERENCIAS INTERNACIONALES
RepuesTop utiliza proveedores externos que tratan datos por su cuenta y solo en la medida necesaria para prestarle sus servicios. Actualmente son:
• Pagos: Flow (Chile), que recibe el monto, el detalle de la compra y el correo del comprador. RepuesTop no recibe ni guarda los datos de las tarjetas.
• Alojamiento del servidor y la base de datos: Railway. Alojamiento del sitio web: Vercel.
• Almacenamiento de archivos (fotos, documentos, boletas, comprobantes y evidencias): Cloudflare.
• Envío de correos: Resend.
• Notificaciones en el teléfono: Expo y Google Firebase Cloud Messaging.
• Inicio de sesión con Google: Google.
• Autocompletado de direcciones y mapas: TomTom y Photon (Komoot); al abrir el mapa de un anuncio, Google Maps o Apple Maps. RepuesTop también usa el catastro de direcciones del Instituto Nacional de Estadísticas, alojado en sus propios servidores.
• Información vehicular por patente: un proveedor chileno de datos vehiculares.
• Monitoreo de errores del sitio web: Sentry. Registros técnicos del servidor: Better Stack.
Varios de estos proveedores almacenan o procesan datos fuera de Chile, principalmente en Estados Unidos y la Unión Europea. RepuesTop elige proveedores que ofrecen medidas de seguridad y confidencialidad adecuadas y les entrega solo los datos necesarios para cada servicio. Si cambia alguno de estos proveedores, RepuesTop actualizará esta lista.

8. CONSERVACIÓN DE DATOS
RepuesTop conserva los datos durante el tiempo necesario para cumplir las finalidades informadas, operar la cuenta, procesar compras, atender reclamos, cumplir obligaciones legales, tributarias, contables y contractuales, prevenir fraude, resolver mediaciones o defender derechos.
El usuario puede cerrar su cuenta desde la Plataforma. El cierre se hace efectivo 30 días después de solicitarlo; en ese plazo puede revertirlo iniciando sesión nuevamente. Al vencer, los datos de la cuenta se anonimizan y se eliminan sus archivos, salvo la información que deba conservarse por obligaciones legales o tributarias, seguridad, prevención de fraude, compras, reclamos, mediaciones, liquidaciones pendientes o defensa ante reclamaciones, la que se conserva solo por el plazo que esas obligaciones exijan.
La ubicación del dispositivo no se conserva, según lo indicado en la sección 5.

9. DERECHOS DEL USUARIO
El usuario puede ejercer los derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo de sus datos personales, y los demás que le reconozca la normativa chilena.
Las solicitudes se realizan a contacto@repuestop.cl o por los canales que RepuesTop habilite, y se responden dentro de los plazos legales. RepuesTop puede pedir antecedentes para verificar la identidad del solicitante antes de responder. En el caso de la portabilidad, RepuesTop entrega los datos en un formato electrónico estructurado y de uso común.
Cuando el tratamiento se basa en la autorización del usuario, como ocurre con la ubicación, este puede retirarla en cualquier momento, sin efecto retroactivo.

10. SEGURIDAD
RepuesTop adopta medidas razonables de seguridad técnica, administrativa y organizacional para proteger los datos contra acceso no autorizado, pérdida, alteración, filtración o mal uso. Entre ellas, los datos bancarios se guardan cifrados y la aplicación móvil impide capturar la pantalla donde se muestran.
Ningún sistema es absolutamente seguro. El usuario debe proteger sus credenciales, no compartir sus claves y avisar a RepuesTop si detecta accesos no autorizados.

11. MENORES DE EDAD
RepuesTop está dirigido a personas mayores de edad. No se permite el registro de menores de edad como compradores, vendedores, anunciantes ni captadores.

12. NOTIFICACIONES
RepuesTop envía notificaciones en el teléfono y correos transaccionales relacionados con seguridad, pagos, pedidos, citas, reclamos, mediaciones, cambios de los documentos legales y funcionamiento de la cuenta. El usuario puede desactivar las notificaciones en el teléfono desde sus ajustes; los correos esenciales sobre sus operaciones y su cuenta se seguirán enviando.
RepuesTop no envía comunicaciones comerciales o promocionales. Si en el futuro lo hace, pedirá antes la autorización correspondiente.

13. CAMBIOS A ESTA POLÍTICA
RepuesTop podrá modificar esta Política de Privacidad por cambios legales, tecnológicos, operativos o de seguridad. Los cambios relevantes se informarán mediante la Plataforma, un aviso al iniciar sesión, correo u otro canal disponible.
Cuando corresponda, RepuesTop solicitará una nueva aceptación digital de la Política de Privacidad.

14. CONTACTO Y RECLAMOS ANTE LA AUTORIDAD
Para consultas o solicitudes sobre datos personales, privacidad o ejercicio de derechos, el usuario puede escribir a contacto@repuestop.cl o utilizar los canales habilitados en la Plataforma.
Sin perjuicio de lo anterior, el usuario puede presentar reclamos ante el Servicio Nacional del Consumidor (SERNAC) y, en materia de datos personales, ante la Agencia de Protección de Datos Personales una vez que entre en funciones conforme a la Ley N° 21.719.`;

/**
 * Secciones agregadas para el sitio web: la politica del movil no cubria cookies
 * ni el reclamo ante la autoridad. PENDIENTE DE REVISION LEGAL.
 */
export const PRIVACIDAD_WEB_EXTRA = `15. COOKIES Y ALMACENAMIENTO LOCAL EN EL SITIO WEB
RepuesTop utiliza almacenamiento local en el navegador únicamente para operar la Plataforma: mantener la sesión iniciada, proteger la cuenta, conservar el carrito y el pedido en curso, y recordar el vehículo y las patentes consultadas para mostrar repuestos compatibles. Si el usuario llega mediante el enlace de un captador, también se guarda el código de referido mientras dure la visita. La ubicación del navegador no se guarda en este almacenamiento (ver sección 5). Todas estas tecnologías son necesarias para prestar el servicio que el usuario solicita.

El sitio no utiliza cookies ni tecnologías de publicidad, marketing, analítica de audiencia, elaboración de perfiles ni seguimiento entre sitios. No hay rastreadores de terceros incorporados y no se venden ni ceden datos personales mediante estas tecnologías.

RepuesTop utiliza un servicio externo de monitoreo de errores para detectar y corregir fallas de la Plataforma. Ese servicio recibe el detalle técnico del error y la ruta del sitio donde ocurrió, con los identificadores numéricos y los datos sensibles de la dirección removidos antes del envío. No recibe datos de contacto, datos bancarios, contraseñas ni grabaciones de la sesión del usuario. El tratamiento se funda en el interés legítimo de mantener la seguridad, la disponibilidad y el correcto funcionamiento del servicio, y no en el consentimiento. Los servidores de este proveedor se encuentran fuera de Chile, conforme a lo indicado en la sección 7.

Al no existir tecnologías opcionales, la Plataforma no solicita una autorización de cookies: muestra un aviso informativo con el detalle de lo que se almacena, consultable en cualquier momento desde la sección de cookies del Centro de Ayuda. Si en el futuro RepuesTop incorpora tecnologías de analítica, marketing o perfilamiento, estas se mantendrán desactivadas hasta que el usuario otorgue una autorización libre, informada, específica e inequívoca, sin casillas preseleccionadas y revocable en cualquier momento.

El usuario puede además eliminar en cualquier momento el almacenamiento local desde la configuración de su navegador; hacerlo cerrará su sesión y vaciará el carrito.

Este esquema considera la Ley N° 21.719, que regula la protección y el tratamiento de datos personales y entra en vigencia el 1 de diciembre de 2026. RepuesTop actualizará esta política si cambian las obligaciones aplicables o la configuración tecnológica del sitio.`;
