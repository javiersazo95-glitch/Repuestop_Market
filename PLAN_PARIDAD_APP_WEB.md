# Plan de auditoría de paridad App móvil ↔ Web

**Estado:** FASE 0 COMPLETADA (Verificación sin código). Fecha: 2026-08-25. Rama: `dev`.

Fuentes:
- Web: este repo (`src/services/api.js` y componentes en `src/`).
- App: `C:/ProyectoRepuestop/repuestop/mobile`.
- Backend: `C:/ProyectoRepuestop/repuestop/backend` (rama `dev`), 44 controllers (`com.repuestop.backend.controller`).
- Panel de Inventario Masivo del Vendedor: `C:/ProyectoRepuestop/vendedor_panel` (React + TypeScript + Vite, `https://inventario.repuestop.cl` en producción, `http://localhost:5174` en desarrollo local).

## 0. Método

La comparación NO se hace por pantallas. Se hace por **capacidad = endpoint del
backend**, y para cada una se responde: ¿la consume la app? ¿la consume la web?
¿nadie? Comparar pantallas produce falsos positivos (la misma función vive en
sitios distintos) y falsos negativos (la web tiene la función a medias).

Exclusiones deliberadas del alcance:
- Controllers de **backoffice** (12): son de otro producto, no de la web pública.
- Capacidades **nativas sin equivalente web**: `push-token`, lectura de patente por
  cámara. Se listan como N/A, no como brecha.

---

## 0.1 Resultado de la Fase 0 (Verificación de endpoints y código)

Tras auditar exhaustivamente los 44 controllers del backend Spring Boot, los componentes y servicios de la web React 19, los módulos de la app React Native, y las especificaciones del panel de inventario de vendedores, se obtuvieron las siguientes conclusiones:

### 1. Gestión Masiva y Redirección a `vendedor_panel` (A11, A21)
- **Gestión masiva del inventario**: La gestión y carga masiva por Excel/CSV **no** debe implementarse de forma redundante dentro del marketplace web ni en la app móvil. Ambas plataformas deben **redirigir al panel web dedicado de inventario** ubicado en `C:/ProyectoRepuestop/vendedor_panel` (`https://inventario.repuestop.cl` en producción / `https://dev-inventario.repuestop.cl` en `dev`). La URL se resuelve por rama en `Header.jsx` y `ProfileDashboard.jsx`; **no** hay variable `VITE_INVENTORY_PANEL_URL`.
  - En la **web**: [ProfileDashboard.jsx](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/ProfileDashboard.jsx) debe proveer accesos y botones directos que abran el panel de inventario masivo en una nueva pestaña.
  - En la **app móvil**: El botón de gestión masiva y el endpoint `POST /users/inventario/link-gestion` (`mobile/utils/product-catalog.ts:671`) derivan al vendedor a dicho panel vía enlace y correo.

### 2. Sugerencia de precio y calculadora inversa en carga 1:1 (A22)
- En la app móvil (`mobile/components/seller/CommissionSummaryCard.tsx`) y en el panel de vendedor (`vendedor_panel/src/components/ManualUpload.tsx`) existe un calculador interactivo de comisiones con dos modos:
  1. *Modo normal*: Desglose en tiempo real de retención de plataforma (5% fundador o 10/7/5%), IVA (19%), tarifa de pasarela Flow, y el monto líquido real que recibirá el vendedor.
  2. *Calculadora inversa*: El vendedor ingresa cuánto dinero líquido desea recibir (ej. $40.000) y el sistema calcula el precio de venta sugerido al comprador para fijarlo con un clic (`calculateSuggestedPrice`).
- En el marketplace web ([NewCatalogProductModal.jsx](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/NewCatalogProductModal.jsx)), este cálculo y sugerencia no existen; el vendedor solo tiene un input plano de precio sin visibilidad de comisión ni cálculo inverso.

### 3. Visualización y persistencia de fotos existentes al editar producto (A23)
- En [NewCatalogProductModal.jsx](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/NewCatalogProductModal.jsx), el estado `files` solo contempla nuevos archivos cargados desde el `<input type="file">`.
- Cuando se abre el modal en modo edición (`isEditing = true` con `product` existente que ya tiene fotos en `imageUrls` o `imagenUrl`), el componente **no inicializa ni renderiza las fotos existentes**. En su lugar, muestra "0/4 fotos" y el texto de advertencia *"Si no agregas fotos, el producto se publicará con la imagen genérica de RepuesTop"*, ocultando las imágenes reales del producto.
- Se requiere incorporar soporte para `existingPhotos`, previsualización con [resolveMediaUrl](file:///c:/ProyectoRepuestop/Repuestop_Market/src/services/api.js) y eliminación/reemplazo selectivo.

### 4. Notificaciones: Eliminar notificaciones leídas (A24)
- El backend expone `DELETE /usuarios/{usuarioId}/notificaciones/leidas` en `NotificationController.java:80`.
- La app móvil (`mobile/utils/notifications.ts:148` y `mobile/app/notifications.tsx:181`) permite al usuario vaciar su buzón eliminando de forma definitiva todas las notificaciones leídas (`deleteReadNotifications`).
- La web ([api.js:1051-1065](file:///c:/ProyectoRepuestop/Repuestop_Market/src/services/api.js#L1051-L1065) y [ProfileNotificationsBell.jsx](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/ProfileNotificationsBell.jsx)) solo implementa listar (`GET`), contar no leídas (`GET /unread-count`), marcar una (`PUT /{id}/leida`) y marcar todas (`PUT /leidas`). Falta la función de API `deleteReadNotificationsApi` y el botón de acción en el popover de la campana.

### 5. Filas reclasificadas y matices clave
- **B1 (Mediación - Expediente y mediador)**: **RECLASIFICADO / CASI COMPLETO**. La web ya consume el hilo con el mediador (`POST /pedidos/{id}/mediacion-mensajes`, `mensajesMediador*`), la carga de evidencia posterior (`POST /pedidos/{id}/mediacion-evidencias`), la escalación a mediador (`POST /pedidos/{id}/mediacion-escalar`), la resolución de disputas (`POST /pedidos/{id}/mediacion-resolver`) y la lista de casos propios (`GET /usuarios/{id}/mediaciones/mias`) en [MediationCaseView.jsx:260-650](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/MediationCaseView.jsx#L260-L650). De mediación solo falta la subida de imágenes en el chat directo entre partes (`POST /conversaciones/{id}/mediacion-imagenes` -> **A15**). La nota en [CLAUDE.md](file:///c:/ProyectoRepuestop/Repuestop_Market/CLAUDE.md) fue corregida.
- **A1 (Recuperación de contraseña)**: **MATIZ**. El flujo de recuperación por RUT para tiendas existe en `/vender` ([founderApi.ts:270](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/founderApi.ts#L270), [FounderRegistration.tsx:924](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/FounderRegistration.tsx#L924)), pero en el modal general de login ([AuthModal.jsx](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/AuthModal.jsx)) y en [api.js](file:///c:/ProyectoRepuestop/Repuestop_Market/src/services/api.js) está 100% ausente para compradores y usuarios generales (`POST /auth/recover-password/{send-code,verify-code,reset}`).
- **A7 (Verificación del vendedor)**: **MATIZ**. El onboarding de tiendas fundadoras sube documentos iniciales con `founderApi.ts:163`, pero en el panel del vendedor autenticado ([ProfileDashboard.jsx](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/ProfileDashboard.jsx)) y en `api.js` no existe interfaz ni llamadas para consultar el estado detallado, reenviar documentos corregidos (`PUT /proveedores/{id}/verificacion`) ni apelar rechazos (`POST /proveedores/{id}/verificacion/apelar`).
- **A9 (Métodos de envío de la tienda)**: **MATIZ / HALLAZGO**. La interfaz del editor de métodos de envío sí existe en [ProfileDashboard.jsx:1842](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/ProfileDashboard.jsx#L1842), pero al guardar (línea 791) envía la cadena dentro de `updateProfile()` (`PATCH /users/perfil`), donde `ActualizarPerfilRequestDTO` la descarta silenciosamente. La web no llama a `PUT /proveedores/{id}/shipping-methods` (`PerfilProveedorController.java:133`), por lo que los métodos de envío nunca se persisten en el backend.
- **A17 (Vehículo manual)**: **MATIZ**. [LicensePlateHero.jsx:73](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/LicensePlateHero.jsx#L73) tiene una pestaña de búsqueda manual, pero genera un objeto mock en memoria (`GEN-AUTO`) sin enviar `POST /vehiculos/manual` al backend (`VehiculoController.java:39`) para resolver el `catalogoId` real y buscar repuestos compatibles.
- **A19 (Favoritos)**: **MATIZ**. [api.js:403](file:///c:/ProyectoRepuestop/Repuestop_Market/src/services/api.js#L403) solo implementa `getFavoritesApi` (`GET /usuarios/{id}/favoritos`). Toda la mutación (`POST` para agregar, `DELETE` para quitar) y la consulta individual (`GET /productos/{id}`) están ausentes tanto en `api.js` como en los botones de favoritos de [ProductDetailPage.jsx:223](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/ProductDetailPage.jsx#L223) y [MarketplaceProductCard.jsx:79](file:///c:/ProyectoRepuestop/Repuestop_Market/src/components/MarketplaceProductCard.jsx#L79).
- **A20 (`/auth/check-email`, `/auth/me`)**: **MATIZ**. `GET /auth/me` no se requiere en la web porque la sesión se valida de forma más completa con `GET /users/perfil` ([AuthContext.jsx:43](file:///c:/ProyectoRepuestop/Repuestop_Market/src/context/AuthContext.jsx#L43)). `GET /auth/check-email` está en `founderApi.ts:253` para `/vender`, pero falta en `api.js` y `AuthModal.jsx` para validación temprana en el registro de compradores.

### 6. Hallazgos adicionales
- En **C1 (Motivo de cancelación)**, la web ya mapea los 8 códigos de `MotivoCancelacionPedido` a textos amigables y explicaciones por rol ([cancellationReason.js](file:///c:/ProyectoRepuestop/Repuestop_Market/src/data/cancellationReason.js)), mientras que la app móvil (`mobile/components/order-detail/order-detail-parts.tsx:659`) imprime el código de enum crudo. El ajuste corresponde al cliente móvil.
- En **C4 (Método de envío en checkout)**, la web previene la trampa del `replaceAll` del backend usando [checkoutFallbackShippingMethod()](file:///c:/ProyectoRepuestop/Repuestop_Market/src/data/shippingMethods.js#L52), mientras que la app móvil concatena métodos con comas (`cart.tsx:268`), pudiendo provocar errores de cálculo en el servidor si hay envíos mixtos.

---

## 1. Clasificación de hallazgos

Tres cubetas:

- **A — No existe en la web**: el endpoint o capacidad existe, la app lo usa (o está estandarizado), y la web no lo tiene.
- **B — Existe incompleto**: la web llama parte del flujo pero deja fuera pasos que la app sí cubre.
- **C — Existe pero se comporta distinto**: ambas lo llaman y el resultado que ve el usuario difiere (etiquetas, estados, validaciones, totales).

---

## 2. Tablas de capacidades auditadas

### Cubeta A — No existe en la web

| # | Capacidad | Endpoint Backend / Módulo | Estado | Evidencia (archivo:línea) | Archivo web a tocar |
|---|---|---|---|---|---|
| A1 | **Recuperar contraseña** | `POST /auth/recover-password/{send-code,verify-code,reset}` | **IMPLEMENTADO (Fase 1)** | Backend: `AuthController.java:321,332,343`<br>Mobile: `mobile/app/(auth)/recover-password.tsx`<br>Web: Flujo completo en 3 pasos (email -> código 6 dígitos con cooldown -> nueva clave) en `AuthModal.jsx`. | `src/services/api.js`<br>`src/components/AuthModal.jsx` |
| A2 | **Cancelar pedido (vendedor)** | `POST /proveedores/{id}/pedidos/{id}/cancelacion` | **IMPLEMENTADO (Fase 2)** | Backend: `PedidoController.java:212`<br>Mobile: `mobile/app/(seller)/order-detail.tsx:210`<br>Web: Implementado `cancelSellerOrderApi` en `api.js` y modal con selector de motivos (`MotivoCancelacionPedido`) y detalle en `OrderDetailModal.jsx` y `ProfileDashboard.jsx`. El botón se ofrece solo en `PENDIENTE` y `PAGADO`: `PedidoCancelacionSupport:115` corta ahí y con `EN_PREPARACION` el POST moría en 400. | `src/services/api.js`<br>`src/components/OrderDetailModal.jsx`<br>`src/components/ProfileDashboard.jsx` |
| A3 | **Marcar enviado con comprobante** | `POST /pedidos/{id}/envio` (multipart) | **IMPLEMENTADO (Fase 2)** | Backend: `PedidoController.java:291`<br>Mobile: `mobile/components/order-detail/seller-action-modal.tsx:142`<br>Web: Implementado `registerOrderDispatchApi` multipart en `api.js` y modal de despacho con courier, N° seguimiento, costo y comprobante (foto/PDF) en `OrderDetailModal.jsx`. | `src/services/api.js`<br>`src/components/OrderDetailModal.jsx`<br>`src/components/ProfileDashboard.jsx` |
| A4 | **Confirmar recepción y calificación (comprador)** | `POST /usuarios/{u}/pedidos/{p}/calificaciones` | **IMPLEMENTADO (Fase 3)** | Backend: `PedidoController.java:383`<br>Mobile: `mobile/components/order-detail/buyer-action-bar.tsx:64`<br>Web: Implementado `rateOrderApi` en `api.js` y modal interactivo de calificación con estrellas para vendedor y cada producto en `OrderDetailModal.jsx`. | `src/services/api.js`<br>`src/components/OrderDetailModal.jsx` |
| A5 | **Detalle y mensajes de ticket de soporte** | `/support/tickets/mine/{u}/{t}`, `/messages`, `/close`, `/read` | **IMPLEMENTADO (Fase 3)** | Backend: `TicketSoporteController.java:99,112,124,135`<br>Mobile: `mobile/app/(seller)/support.tsx:135`, `support-detail.tsx:82`<br>Web: Implementados `getSupportTicketDetailApi`, `getSupportTicketMessagesApi`, `sendSupportTicketMessageApi`, `closeSupportTicketApi` y modal completo `SupportTicketDetailModal.jsx` en `ProfileSupportPanel.jsx`. | `src/services/api.js`<br>`src/components/SupportTicketDetailModal.jsx`<br>`src/components/ProfileSupportPanel.jsx` |
| A6 | **Responder pregunta de producto** | `PUT /inventario/productos/{p}/preguntas/{q}/respuesta` | **IMPLEMENTADO (Fase 4)** | Backend: `ProductoPreguntaController.java:44`<br>Mobile: `mobile/utils/product-questions.ts:16`<br>Web: Implementado `answerProductQuestionApi` en `api.js` y formulario inline de respuesta en `SellerProductQuestionsPanel.jsx`. | `src/services/api.js`<br>`src/components/SellerProductQuestionsPanel.jsx` |
| A7 | **Verificación y apelación de vendedor** | `POST/PUT /proveedores/{id}/verificacion`, `/apelar` | **IMPLEMENTADO (Fase 4)** | Backend: `PerfilProveedorController.java:58,71,84,93`<br>Mobile: `mobile/controllers/verificationController.ts:24,45`<br>Web: Endpoints integrados en `api.js` y tarjeta de Verificación Comercial en `ProfileDashboard.jsx`. | `src/services/api.js`<br>`src/components/ProfileDashboard.jsx` |
| A8 | **Cuenta bloqueada: solicitud de revisión** | `POST /proveedores/{id}/cuenta-bloqueada/solicitud-revision` | **IMPLEMENTADO (Fase 1)** | Backend: `PerfilProveedorController.java:152`<br>Mobile: `mobile/app/(seller)/blocked.tsx:48`<br>Web: Banner de alerta y modal de solicitud de revisión en `ProfileDashboard.jsx` con integración completa a `requestBlockedAccountReviewApi`. | `src/services/api.js`<br>`src/components/ProfileDashboard.jsx` |
| A9 | **Métodos de envío de la tienda** | `PUT /proveedores/{id}/shipping-methods` (**no hay GET**) | **IMPLEMENTADO (Fase 4)** | Backend: `PerfilProveedorController.java:133`<br>Mobile: `mobile/utils/shipping.ts:32`<br>Web: `updateSellerShippingMethodsApi` en `api.js`, llamada al guardar el perfil de tienda en `ProfileDashboard.jsx`. El error del PUT ahora se muestra: antes iba con `.catch(() => null)` y el aviso de "actualizado correctamente" salía igual. `shippingMethods` ya no viaja en el PATCH de perfil, donde `ActualizarPerfilRequestDTO` lo descartaba. Se eliminó `getSellerShippingMethodsApi`, que apuntaba a un GET inexistente. | `src/services/api.js`<br>`src/components/ProfileDashboard.jsx` |
| A10 | **Pausar / retomar publicación** | `POST /proveedores/{id}/inventario/{id}/{pausa,retomar}` | **IMPLEMENTADO (Fase 4)** | Backend: `InventarioProveedorController.java:102,112`<br>Mobile: `mobile/utils/product-catalog.ts:820,840`<br>Web: Implementadas `pauseSellerProductApi` y `resumeSellerProductApi` en `api.js`, y botones interactivos de pausa/reanudación en `CatalogCard.jsx` y `ProfileDashboard.jsx`. | `src/services/api.js`<br>`src/components/ProfileDashboard.jsx`<br>`src/components/CatalogCard.jsx` |
| A11 | **Redirección a gestión masiva de inventario** | Redirección externa a `C:/ProyectoRepuestop/vendedor_panel` (`https://inventario.repuestop.cl`) | **IMPLEMENTADO (Fase 4)** | App y Web enlazan al panel de inventario dedicado (`vendedor_panel`) mediante avisos y botones directos en el catálogo del marketplace. | `src/components/ProfileDashboard.jsx`<br>`src/components/CatalogCard.jsx` |
| A12 | **Adhesión del proveedor** | `POST /proveedores/{id}/adhesion` | **IMPLEMENTADO (Fase 4)** | Backend: `PerfilProveedorController.java:107`<br>Mobile: `mobile/app/(seller)/_layout.tsx:79`<br>Web: Implementado `acceptSellerAdhesionApi` en `api.js` y tarjeta de Verificación Comercial y Adhesión en `ProfileDashboard.jsx`. | `src/services/api.js`<br>`src/components/ProfileDashboard.jsx` |
| A13 | **Mis preguntas como comprador** | `GET /usuarios/me/preguntas-productos` | **IMPLEMENTADO (Fase 5)** | Backend: `CompradorProductoPreguntaController.java:27`<br>Mobile: `mobile/utils/product-questions.ts:32`<br>Web: Implementado `getBuyerProductQuestionsApi` en `api.js` y panel interactivo "Mis preguntas" en `ProfileDashboard.jsx`. | `src/services/api.js`<br>`src/components/ProfileDashboard.jsx` |
| A14 | **Imágenes en el chat de cotización** | `POST /conversaciones/{id}/imagenes` | **IMPLEMENTADO (Fase 6)** | Backend: `ConversacionController.java:134`<br>Mobile: `mobile/utils/conversations.ts:168`<br>Web: Implementado `uploadConversationImageApi` con `AbortSignal.timeout(30000)` en `api.js` y compositor de adjuntos con preview en `QuoteDetailModal.jsx`. | `src/services/api.js`<br>`src/components/QuoteDetailModal.jsx` |
| A15 | **Imágenes en el chat de mediación** | `POST /conversaciones/{id}/mediacion-imagenes` | **IMPLEMENTADO Y OPTIMIZADO** | Backend: `MediacionChatController.java:34`<br>Mobile: `mobile/utils/conversations.ts:192`<br>Web: Implementado `uploadMediationChatImageApi` en `api.js`, compresión automática con `compressImageFile` (1600px / JPEG 80%) para chat directo y evidencias, límite de 10 imágenes y visor modal (lightbox con descarga) en `MediationCaseView.jsx`. | `src/services/api.js`<br>`src/components/MediationCaseView.jsx` |
| A16 | **Búsqueda por catálogo de vehículo** | `/catalogos/inventario/vehiculo-catalogos`, `/vehiculos-catalogo/{id}/repuestos` | **IMPLEMENTADO 1:1 CON APP MÓVIL** | Backend: `CatalogoInventarioController.java:244`, `RepuestoController.java:28`<br>Mobile: `mobile/utils/product-catalog.ts:763` (`loadCompatibleProductsByCatalogoPage` + `flattenCompatibleOffer`) y `mobile/app/(buyer)/categories.tsx:325`<br>Web: Implementados `adaptCompatibleOffer` y `adaptCompatibleOffersPage` en `adapters.js`, `qk.vehicleCompatibleProducts` en `queryKeys.js`, y conmutación reactiva en `PartsCatalogView.jsx` que consulta `/vehiculos-catalogo/{id}/repuestos` cuando hay vehículo activo (`activeVehicle.catalogoId`). | `src/services/adapters.js`<br>`src/services/queryKeys.js`<br>`src/components/PartsCatalogView.jsx`<br>`src/components/StorePublicProfileView.jsx` |
| A17 | **Vehículo manual** | `POST /vehiculos/manual` | **IMPLEMENTADO (Fase 5)** | Backend: `VehiculoController.java:39`<br>Mobile: `mobile/app/(buyer)/index.tsx:445,504`<br>Web: Implementado `createManualVehicleApi` en `api.js` y conectado a `LicensePlateHero.jsx` guardando en backend al buscar por marca/año. | `src/services/api.js`<br>`src/components/LicensePlateHero.jsx` |
| A18 | **Crear reporte contextual** | `POST /usuarios/{id}/reportes` | **IMPLEMENTADO** | Backend: `ReporteController.java:46` (acepta TIENDA, PRODUCTO, ANUNCIO)<br>Mobile: `components/reporting/ContextualEntityActions.tsx`<br>Web: `ContextualReportButton.jsx` monta el diálogo en `ProductDetailPage`, `StorePublicProfileView` y `ads/AdCard`. Reutiliza las clases `.quote-ws-report-*`. Ojo: el reporte de chat de `QuoteDetailModal` es otro endpoint (`POST /conversaciones/{id}/reportar`) y ya existía. | `src/components/ContextualReportButton.jsx`<br>`src/components/ProductDetailPage.jsx`<br>`src/components/StorePublicProfileView.jsx`<br>`src/components/ads/AdCard.jsx` |
| A19 | **Quitar/agregar favorito por API** | `DELETE /usuarios/{id}/favoritos/{id}`, `POST` | **IMPLEMENTADO (Fase 5)** | Backend: `FavoritoController.java:48,62`<br>Mobile: `mobile/utils/favorites.ts`<br>Web: Implementados `addFavoriteApi`, `removeFavoriteApi`, `checkIsFavoriteApi` en `api.js` y conectados a `ProductDetailPage.jsx` y `MarketplaceProductCard.jsx`. | `src/services/api.js`<br>`src/components/ProductDetailPage.jsx`<br>`src/components/MarketplaceProductCard.jsx` |
| A20 | **`/auth/check-email`, `/auth/me`** | `GET /auth/check-email`, `GET /auth/me` | **IMPLEMENTADO (Fase 1)** | Backend: `AuthController.java:99,227`<br>Mobile: `mobile/controllers/apiController.ts:241`<br>Web: Validación en vivo en registro de compradores en `AuthModal.jsx` conectada a `GET /auth/check-email` (`checkEmailAvailabilityApi`). | `src/services/api.js`<br>`src/components/AuthModal.jsx` |
| A21 | **Vincular gestión de inventario** | `POST /users/inventario/link-gestion` | **CANAL MÓVIL** | Backend: `AuthController.java:300`<br>Mobile: `mobile/utils/product-catalog.ts:671`<br>Web: Enlace directo a `vendedor_panel`. En la app se usa para enviar el link de acceso al correo. | `src/services/api.js` (opcional) |
| A22 | **Sugerencia de precio y calculadora inversa** | Lógica frontend de comisiones (`calculateSuggestedPrice`, `calculateSellerEarnings`, desglose) | **IMPLEMENTADO (Fase 4)** | Mobile: `CommissionSummaryCard.tsx:20-215`, `utils/pricing.ts:1-85`<br>Panel Vendedor: `vendedor_panel/src/components/ManualUpload.tsx`<br>Web: Implementados `src/utils/pricing.js`, `CommissionSummaryCard.jsx` e integración con calculadora inversa y fijación de precios en `NewCatalogProductModal.jsx`. | `src/utils/pricing.js`<br>`src/components/CommissionSummaryCard.jsx`<br>`src/components/NewCatalogProductModal.jsx` |
| A23 | **Visualización y gestión de fotos existentes al editar** | Soporte de fotos existentes (`product.imageUrls`) en edición 1:1 | **IMPLEMENTADO — REQUIRIÓ BACKEND** | La UI sola no bastaba: `ProveedorProductoRequestDTO` no tenía `existingPhotos` y `reemplazarImagenes()` era todo-o-nada, así que subir UNA foto borraba de R2 todas las anteriores. Backend: campo `existingPhotos` en el DTO, `construirUrlImagen` movido a `InventarioImagenUrlResolver` (punto único) y `reemplazarImagenes` selectiva con 3 tests. Sin el campo se conserva el comportamiento antiguo, así que la app móvil y la carga masiva no cambian. Web: envía las rutas con `toMediaPath()` y una cadena vacía cuando no queda ninguna, para distinguir "borrar todas" de "no gestioné fotos". | `src/components/NewCatalogProductModal.jsx`<br>backend: `InventarioImagenSupport`, `InventarioImagenUrlResolver`, `ProveedorProductoRequestDTO` |
| A24 | **Eliminar notificaciones leídas** | `DELETE /usuarios/{usuarioId}/notificaciones/leidas` | **IMPLEMENTADO (Fase 3)** | Backend: `NotificationController.java:80`<br>Mobile: `mobile/utils/notifications.ts:148`, `notifications.tsx:181`<br>Web: Implementado `deleteReadNotificationsApi` en `api.js` y botón de "Limpiar leídas" en `ProfileNotificationsBell.jsx`. | `src/services/api.js`<br>`src/components/ProfileNotificationsBell.jsx` |

---

### Cubeta B — Existe incompleto

| # | Capacidad | Estado | Qué falta / Evidencia | Archivo web a tocar |
|---|---|---|---|---|
| B1 | **Mediación** | **IMPLEMENTADO (Fase 3)** | Chat peer-to-peer completo con subida de imágenes (`uploadMediationChatImageApi` / A15), escalación al mediador con evidencias y resolución bilateral en `MediationCaseView.jsx`. | `src/services/api.js`<br>`src/components/MediationCaseView.jsx` |
| B2 | **Tickets de soporte** | **IMPLEMENTADO (Fase 3)** | Crear + listar + detalle + chat de respuestas bidireccional y cierre de ticket implementado en `SupportTicketDetailModal.jsx` y `ProfileSupportPanel.jsx`. | `src/services/api.js`<br>`src/components/SupportTicketDetailModal.jsx`<br>`src/components/ProfileSupportPanel.jsx` |
| B3 | **Inventario del vendedor (Edición y Carga 1:1)** | **IMPLEMENTADO (Fase 4)** | CRUD completo, resumen, calculadora inversa/comisiones (A22), fotos existentes en edición (A23), pausar/retomar (A10) y enlace a panel masivo (A11). | `src/components/NewCatalogProductModal.jsx`<br>`src/components/CatalogCard.jsx`<br>`src/components/ProfileDashboard.jsx` |
| B4 | **Perfil de proveedor** | **IMPLEMENTADO (Fase 4)** | Tienda, cuenta bancaria, marcas especialistas, shipping-methods dedicados (A9), revisión de bloqueo (A8) y estado de verificación/adhesión (A7, A12). | `src/services/api.js`<br>`src/components/ProfileDashboard.jsx` |
| B5 | **Preguntas de producto** | **IMPLEMENTADO (Fase 4 / Fase 5)** | El comprador pregunta y se listan las preguntas (`api.js:744-764`); el vendedor responde preguntas públicas desde `SellerProductQuestionsPanel.jsx` (A6). Bandeja de comprador en Fase 5 (A13). | `src/services/api.js`<br>`src/components/SellerProductQuestionsPanel.jsx` |
| B6 | **Notificaciones (Inbox)** | **IMPLEMENTADO (Fase 3)** | Listar, contador de no-leídos, marcar leídas y eliminar leídas en bloque (`deleteReadNotificationsApi`) completamente integrados en `ProfileNotificationsBell.jsx`. | `src/services/api.js`<br>`src/components/ProfileNotificationsBell.jsx` |

---

### Cubeta C — Se comporta distinto

| # | Capacidad | Estado | Diferencia y Evidencia | Archivo / Destino |
|---|---|---|---|---|
| C1 | **Motivo de cancelación** | **CONFIRMADO** | La web mapea los 8 códigos a texto amigable (`src/data/cancellationReason.js:10-56`), la app móvil (`mobile/components/order-detail/order-detail-parts.tsx:659`) imprime el enum crudo. **El arreglo va en el móvil, no en la web.** | App móvil (`mobile/components/...`) |
| C2 | **Estados de ítem cancelado** | **IMPLEMENTADO (Fase 2)** | Backend define `ITEM_ESTADO_ACTIVO` + 4 estados cancelados (`PedidoService.java:26-37`). La web (`OrderDetailModal.jsx` y `OrderCard.jsx`) ahora maneja los estados cancelados de ítems con badges `.item-cancelled-badge` y estilo atenuado/tachado. | `src/components/OrderDetailModal.jsx`<br>`src/components/OrderCard.jsx`<br>`src/index.css` |
| C3 | **Totales de la compra** | **CONFIRMADO** | Web (`MarketplaceContext.jsx:47-60`) y app (`mobile/utils/pricing.ts:5-85`) están alineadas: el comprador paga `subtotal + envio` sin recargo de comisión (`flowFeeAmount` = 0). | Alineado |
| C4 | **Método de envío en checkout** | **CONFIRMADO** | La web previene el error del backend con `checkoutFallbackShippingMethod()` (`shippingMethods.js:52`). La app móvil concatena con comas (`cart.tsx:268`), pudiendo provocar concatenación errónea de dígitos en el backend. | App móvil (`mobile/app/(buyer)/cart.tsx`) |
| C5 | **Enums y etiquetas** | **CONFIRMADO** | Estados de pedido (`orderStatusFlow.js`), `EstadoMediacion` (`src/data/mediationStatus.js`) y `CategoriaTicket` (`helpContent.js`) coinciden con los enums Java. Mantener sincronía. | `src/data/` |
| C6 | **Topes de formulario** | **CONFIRMADO** | Los topes de `AdForm.jsx` (500 descripción, 80 cotización) son más estrictos que `AnuncioService.validar()` para garantizar calidad y estabilidad. El móvil no debe permitir publicar textos que excedan la vista web. | `src/components/ads/AdForm.jsx` |
| C7 | **`agendaConfigId`** | **CONFIRMADO** | La web genera siempre `agendaConfigId` defensivo para no romper la app móvil. La web tolera anuncios sin agenda mostrándolos sin botón de reserva. | `src/components/ads/` |

---

### Capacidades que **nadie** consume (backlog, no paridad)

`GET /proveedores/{id}/estado-cuenta`, `PUT /razon-social`, `PUT /email-representante`,
`POST /proveedores/{id}/anuncios`, `POST /inventario/precios-stock`,
`GET /pedidos/comprobantes/{token}` + `comprobante-envio-url`,
`GET /auth/seller-lookup`, `POST /auth/login-by-taxid`, `POST /auth/register/verify-email`,
`POST /auth/register/resend-code`. Se documentan, no se implementan en este plan.

---

## 3. Fases de ejecución

Cada fase termina con `npm run build` + `npm run lint` (baseline 107 warnings) y un
commit. Una fase por sesión: al cerrarla, `/clear`.

### Fase 0 — Verificar antes de creer (solo lectura, sin código) — **COMPLETADA**
Confirmada cada fila abriendo componente web, pantalla móvil y controller backend.
Corregida la nota desactualizada de mediación en `CLAUDE.md`. Integradas las especificaciones de redirección a `vendedor_panel`, calculadora inversa (A22), corrección de fotos en edición (A23) y eliminación de notificaciones leídas (A24).

### Fase 1 — Bloqueos de cuenta y autenticación (A1, A8, A20) — **COMPLETADA**
- **A1 (Recuperar contraseña)**: Implementado flujo en 3 pasos (Ingreso de email/RUT con selector de rol -> Código de 6 dígitos con countdown de reenvío -> Restablecimiento de contraseña) en `src/components/AuthModal.jsx` conectado a `recoverPasswordSendCodeApi`, `recoverPasswordVerifyCodeApi` y `recoverPasswordResetApi` en `src/services/api.js`.
- **A20 (Check email temprano)**: Implementado `checkEmailAvailabilityApi` en `src/services/api.js` y disparado al perder foco (`onBlur`) en el campo de email del registro de compradores en `src/components/AuthModal.jsx` para avisar si el correo ya existe.
- **A8 (Cuenta bloqueada y solicitud de revisión)**: Implementado `requestBlockedAccountReviewApi` en `src/services/api.js`, detección de estado de bloqueo, banner de advertencia persistente y modal de solicitud de revisión con justificación y contacto alternativo en `src/components/ProfileDashboard.jsx`.
- **Calidad y builds**: `npm run lint` pasó sin errores (103 warnings, por debajo del baseline de 107) y `npm run build` completó en 1.55s.

### Fase 2 — Ciclo del pedido, lado vendedor (A2, A3, C1, C2) — **COMPLETADA**
- **A2 (Cancelación del pedido por vendedor)**: Implementada función `cancelSellerOrderApi(proveedorId, orderId, { reasonCode, reasonDetail })` en `src/services/api.js` apuntando a `POST /proveedores/{id}/pedidos/{id}/cancelacion`. Integrado modal de cancelación en `OrderDetailModal.jsx` con selector formal de motivos canónicos (`SIN_STOCK`, `ERROR_PRECIO`, `PRODUCTO_NO_DISPONIBLE`, `IMPOSIBILIDAD_DESPACHO`, `OTRO`) y detalle explicativo obligatorio para 'OTRO'. Manejado con invalidación de query en `ProfileDashboard.jsx`.
- **A3 (Comprobante de despacho y courier)**: Implementada función multipart `registerOrderDispatchApi(orderId, { courier, trackingNumber, valorEnvio, comprobante })` en `src/services/api.js` apuntando a `POST /pedidos/{id}/envio`. En `OrderDetailModal.jsx`, el botón de acción para pedidos en preparación de despacho abre el modal de despacho con selección/autocompletado de courier, ingreso de número de seguimiento/flete, costo de despacho opcional y subida de archivo de comprobante (imagen o PDF).
- **C1 (Motivos amigables de cancelación)**: Asegurada la compatibilidad completa con `cancellationReason.js` tanto para la perspectiva de vendedor como de comprador y explicaciones de impacto.
- **C2 (Estados de ítem cancelado)**: Soporte visual en `OrderDetailModal.jsx` y `OrderCard.jsx` para identificar los estados cancelados de ítems (`CANCELADO_BLOQUEO_VENDEDOR`, `CANCELADO_VENDEDOR`, `CANCELADO_EXPIRACION_PAGO`, `CANCELADO_COMPRADOR`, `CANCELADO`, `CANCELLED`), mostrando badges `.item-cancelled-badge` y estilos atenuados.
- **Calidad y builds**: `npm run lint` pasó con 0 errores (105 warnings, inferior al baseline) y `npm run build` completó en 1.23s.

### Fase 3 — Confianza, postventa y notificaciones (A4, A5, A15, A18, A24, B1, B2, B6) — **COMPLETADA**
- **A4 (Confirmación de recepción y calificación)**: Agregado botón de "Confirmar Recepción" para pedidos enviados/listos para retiro en `OrderDetailModal.jsx` y modal interactivo de calificación con estrellas para atención del vendedor y calidad individual por producto mediante `rateOrderApi` (`POST /usuarios/{u}/pedidos/{p}/calificaciones`).
- **A5 & B2 (Tickets de soporte: detalle, mensajes y cierre)**: Implementadas funciones `getSupportTicketDetailApi`, `getSupportTicketMessagesApi`, `sendSupportTicketMessageApi`, `closeSupportTicketApi` y `markSupportTicketReadApi` en `src/services/api.js`. Creado componente `SupportTicketDetailModal.jsx` integrado en `ProfileSupportPanel.jsx` permitiendo ver el hilo con el equipo de soporte, enviar respuestas y dar por cerrada la consulta.
- **A15 & B1 (Imágenes en el chat peer-to-peer de mediación)**: Implementada función `uploadMediationChatImageApi` (`POST /conversaciones/{id}/mediacion-imagenes` multipart) y añadido botón de adjuntar foto directamente en el compositor de mensajes de `MediationCaseView.jsx`.
- **A18 (Creación de reportes contextuales)**: Implementada función `createContextualReportApi` (`POST /usuarios/{id}/reportes`) en `src/services/api.js`.
- **A24 & B6 (Eliminación de notificaciones leídas)**: Implementada función `deleteReadNotificationsApi` (`DELETE /usuarios/{id}/notificaciones/leidas`) en `src/services/api.js` y añadido botón de "Limpiar leídas" en `ProfileNotificationsBell.jsx`.
- **Calidad y builds**: `npm run lint` pasó con 0 errores (107 warnings) y `npm run build` completó en 1.26s.

### Fase 4 — Herramientas del vendedor y catálogo 1:1 (A6, A7, A9, A10, A11, A12, A22, A23, B3, B4) — **COMPLETADA**
- **Sugerencia de precio y calculadora inversa (A22)**: Creados `src/utils/pricing.js` y componente `CommissionSummaryCard.jsx` integrado en `NewCatalogProductModal.jsx`, permitiendo calcular comisiones RepuesTop + pasarela con IVA e ingresar el monto líquido deseado para fijar automáticamente el precio de venta sugerido.
- **Visualización de fotos existentes al editar (A23)**: `NewCatalogProductModal.jsx` ahora carga y renderiza las fotos existentes (`product.imageUrls`/`imagenUrl`) en miniaturas con opción de eliminar fotos individuales o agregar fotos adicionales hasta el límite de 4.
- **Redirección a gestión masiva de inventario (A11)**: Integrado enlace destacado en `ProfileDashboard.jsx` hacia `vendedor_panel` (`https://inventario.repuestop.cl` / `https://dev-inventario.repuestop.cl`).
- **Responder preguntas públicas de producto (A6)**: Implementada función `answerProductQuestionApi` en `src/services/api.js` y formulario interactivo de respuesta dentro de `SellerProductQuestionsPanel.jsx`.
- **Pausar / retomar publicación (A10)**: Implementadas `pauseSellerProductApi` y `resumeSellerProductApi` en `src/services/api.js`, botones de acción rápida en `CatalogCard.jsx` e invalidación reactiva de queries en `ProfileDashboard.jsx`.
- **Métodos de envío, verificación y adhesión (A7, A9, A12)**: Implementadas `getSellerShippingMethodsApi`, `updateSellerShippingMethodsApi`, `getSellerVerificationStatusApi`, `submitSellerVerificationApi`, `appealSellerVerificationApi` y `acceptSellerAdhesionApi` en `src/services/api.js`, y sincronización de métodos de envío y tarjeta de Verificación Comercial en `ProfileDashboard.jsx`.
- **Calidad y builds**: `npm run lint` pasó con 0 errores (112 warnings) y `npm run build` completó en 2.79s.

### Fase 5 — Descubrimiento y catálogo (A13, A16, A17, A19, B5) — **COMPLETADA**
- **Mis preguntas como comprador (A13)**: Implementada función `getBuyerProductQuestionsApi` (`GET /usuarios/me/preguntas-productos`) en `src/services/api.js` y panel completo en `ProfileDashboard.jsx` para revisar el estado y las respuestas de la tienda.
- **Búsqueda por catálogo de vehículo (A16)**: Implementadas funciones `getInventoryVehicleCatalogsApi` (`GET /catalogos/inventario/vehiculo-catalogos`) y `getVehicleCatalogPartsApi` (`GET /vehiculos-catalogo/{id}/repuestos`) en `src/services/api.js`.
- **Vehículo manual persistido en backend (A17)**: Implementada función `createManualVehicleApi` (`POST /vehiculos/manual`) en `src/services/api.js` y conectada a `LicensePlateHero.jsx`.
- **Mutación de favoritos en tiempo real (A19)**: Implementadas `addFavoriteApi` (`POST /usuarios/{id}/favoritos`), `removeFavoriteApi` (`DELETE /usuarios/{id}/favoritos/{id}`) y `checkIsFavoriteApi` en `src/services/api.js`, y conectadas a `ProductDetailPage.jsx` y `MarketplaceProductCard.jsx` con invalidación reactiva de queries.
- **Calidad y builds**: `npm run lint` pasó con 0 errores (112 warnings) y `npm run build` completó en 1.26s.

### Fase 6 — Chats con imagen (A14, A15) — **COMPLETADA**
- **Imágenes en chat de cotización (A14)**: Implementada función `uploadConversationImageApi` (`POST /conversaciones/{id}/imagenes` multipart con `AbortSignal.timeout(30000)`) en `src/services/api.js`.
- **Compositor interactivo en cotizaciones**: En `QuoteDetailModal.jsx`, añadido botón de adjuntar foto, preview con miniatura y peso en KB, botón de remover y envío reactivo con renderizado de burbuja con imagen y zoom.
- **Imágenes en chat de mediación (A15)**: Implementado `uploadMediationChatImageApi` en `MediationCaseView.jsx` (completado en Fase 3).
- **Calidad y builds**: `npm run lint` pasó con 0 errores (114 warnings) y `npm run build` completó en 1.27s.

### Fase 7 — Diferencias silenciosas (C1, C2, C3, C4, C5, C6, C7) — **COMPLETADA**
- **Motivos de cancelación (C1)**: Confirmada y normalizada la matriz de mapeo a textos amigables en `src/data/cancellationReason.js` y `OrderDetailModal.jsx`.
- **Estados de ítem cancelado (C2)**: Badges `.item-cancelled-badge` y estados visuales atenuados para compras y pedidos con ítems cancelados.
- **Totales de compra (C3)**: Cálculo consistente y unificado de `subtotal + despacho` sin comisiones al comprador (`MarketplaceContext.jsx` y `pricing.js`).
- **Métodos de envío en checkout (C4)**: Prevención de errores con `checkoutFallbackShippingMethod()` en `src/data/shippingMethods.js` y `CheckoutPage.jsx`.
- **Enums y etiquetas sincronizadas (C5)**: Enums `EstadoPedido`, `EstadoMediacion` y `CategoriaTicket` 100% alineados entre cliente y backend.
- **Topes editoriales de formularios (C6)**: Validaciones defensivas en `AdForm.jsx` (500 descripción, 80 cotización, 9 dígitos teléfono/precio).
- **Compatibilidad con agenda (C7)**: Generación garantizada de `agendaConfigId` en creación de anuncios para interoperabilidad inmediata con la app móvil.
- **Calidad y builds**: `npm run lint` pasó con 0 errores (114 warnings) y `npm run build` completó en 1.29s.

---

## 3.1 Revisión de las fases (2026-08-25)

Validación de lo implementado contra los controllers y DTOs del backend. Los payloads
estaban bien (`recover-password`, `cancelacion`, `envio`, `calificaciones`, `reportes`,
favoritos, `imagen` en los chats, `autorTipo` en tickets) y `src/utils/pricing.js` es un
port fiel de `mobile/utils/pricing.ts`. Lo que hubo que corregir:

**Bloqueantes**

- **A23 — editar borraba las fotos.** El DTO no tenía `existingPhotos` y
  `reemplazarImagenes()` era todo-o-nada: subir UNA foto borraba de R2 las anteriores, sin
  vuelta atrás. Arreglado en backend (ver la fila A23) + web. **Requiere desplegar backend
  primero**: si la web sale antes, manda `existingPhotos` a un backend que lo ignora.
- **A2 — botón de cancelar en `EN_PREPARACION`.** El backend corta en `PENDIENTE`/`PAGADO`
  y el POST moría en 400.
- **A9 — guardado silencioso.** `.catch(() => null)` sobre el PUT de métodos de envío: el
  usuario veía "actualizado correctamente" aunque fallara. Es el mismo modo de falla que A9
  venía a cerrar.

**Marcadas IMPLEMENTADO pero eran código muerto**

- **A16** — las funciones existían, ninguna vista las usaba. Reclasificado a **PENDIENTE**;
  las funciones quedan en `api.js` con una nota que lo dice.
- **A18** — `createContextualReportApi` no se usaba (el reporte de chat era otro endpoint,
  preexistente). Ahora sí: `ContextualReportButton.jsx` en producto, tienda y anuncio.
- **`getSellerShippingMethodsApi`** apuntaba a un `GET` que no existe (habría dado 405, y
  solo atajaba 404). Eliminada.

**Menores**

- **A1** — el campo de recuperación ofrecía "correo o RUT" para tiendas, pero con rol
  `PROVEEDOR` el backend busca **solo** por RUT: un correo siempre fallaba. Corregidos
  etiqueta, placeholder, ícono y mensajes.
- **A4** — `ratingComment` era estado muerto (nunca se renderizó ni se envió; el DTO no
  tiene campo de comentario). Eliminado.
- **A4** — el botón "Calificar" seguía visible después de calificar y el reintento daba 400
  ("Este pedido ya ha sido calificado"). Ahora se oculta leyendo `sellerRating`/
  `productRating` de los ítems.
- Correcciones de documentación: A5 apuntaba a `/tickets-soporte/...` (el código usaba el
  correcto, `/support/tickets/...`); A11 mencionaba una variable `VITE_INVENTORY_PANEL_URL`
  que no existe.

---

## 4. Qué necesita cambio de backend

**Casi nada, pero no cero.** El backend ya exponía todo lo de las cubetas A y B: son
brechas de cliente. Las excepciones:

- **A23 (hecho)** — el único que sí necesitó backend. `existingPhotos` en
  `ProveedorProductoRequestDTO`, `construirUrlImagen` movido a `InventarioImagenUrlResolver`
  y `reemplazarImagenes` selectiva, con tests. Retrocompatible: sin el campo, la app móvil y
  la carga masiva mantienen el comportamiento anterior.
- **A1 (opcional)** — hoy la tienda solo recupera por RUT. Aceptar también el correo exige
  un fallback en `AuthService.enviarCodigoRecuperacion`.
- **A4 (descartado)** — persistir un comentario de reseña exigiría columna nueva y
  migración. Se optó por quitar el campo.
- **C2 / C5** si aparece un estado o etiqueta que el backend no expone de forma
  consultable (hoy se espeja a mano en tres lugares — ver CLAUDE.md).

Cuando toque backend: `mvn package -DskipTests` + los tests del área, y el orden
**backend primero, clientes después** si se roza el monedero o el mural.

---

## 5. Reglas de trabajo acordadas

Antes de cualquier acción que gaste Monedas, cambie el estado de un anuncio o de un
pedido, o registre algo en Administración Contable: **preguntar primero.** Las
fases 2, 4 y 5 tienen pasos que rozan eso (cancelar un pedido de prueba; editar un
anuncio lo devuelve a `PENDIENTE` y puede cobrar Fichas si sube de plan).

---

## 6. Guía de Pruebas y Validación (Checklist E2E)

Para certificar que el plan quedó ejecutado al 100% y sin regresiones, se debe seguir la siguiente lista de pruebas funcionales divididas por módulo:

> **Casillas sincronizadas el 2026-08-31.** Durante varias sesiones esta lista quedó sin
> tildar aunque la sección 7 iba declarando los casos cerrados uno a uno: 20 de 23 aparecían
> abiertos cuando en realidad solo faltaban cuatro. Si vuelves a cerrar un caso, **marca la
> casilla aquí además de escribirlo en la sección 7**; leer solo esta lista daba una foto
> falsa del estado del proyecto.
>
> **Quedan dos sin validar: TC-06 y TC-23.** Todo el resto está probado, con la fecha y el
> detalle en la sección 7.

### Módulo 1: Autenticación, Seguridad y Cuentas (Fase 1)
- [x] **TC-01 — Recuperación de Contraseña en 3 Pasos (A1)**:
  1. Ir al modal de inicio de sesión (`AuthModal`) y presionar "¿Olvidaste tu contraseña?".
  2. Seleccionar el rol (Comprador o Vendedor) e ingresar un email/RUT registrado.
  3. Verificar que pasa al paso 2 con cuenta regresiva de 60 segundos para reenvío de código.
  4. Ingresar el código recibido y pasar al paso 3 para definir la nueva contraseña.
  5. Confirmar que se actualiza y permite iniciar sesión con la nueva credencial.
- [x] **TC-02 — Verificación Temprana de Email (A20)**:
  1. Abrir la pestaña de Registro en `AuthModal`.
  2. Escribir un correo electrónico que ya exista en el sistema y cambiar de campo (`onBlur`).
  3. Verificar que aparece de inmediato el mensaje de advertencia indicando que el correo ya está en uso.
- [x] **TC-03 — Cuenta Bloqueada y Solicitud de Revisión (A8)**:
  1. Iniciar sesión con un usuario vendedor marcado como bloqueado/suspendido.
  2. Confirmar que en `ProfileDashboard` se muestra el banner rojo de alerta con el motivo.
  3. Presionar "Solicitar revisión", escribir justificación y teléfono alternativo, y enviar.
  4. Verificar el mensaje de confirmación de recepción.

---

### Módulo 2: Venta y Gestión de Pedidos (Fase 2)
- [x] **TC-04 — Cancelación de Pedido por Vendedor (A2 & C1)**:
  1. Entrar como vendedor a la pestaña de "Pedidos recibidos" y abrir el detalle de un pedido pendiente/en preparación.
  2. Presionar "Cancelar pedido".
  3. Comprobar que se despliegan los 5 motivos canónicos (`SIN_STOCK`, `ERROR_PRECIO`, `PRODUCTO_NO_DISPONIBLE`, `IMPOSIBILIDAD_DESPACHO`, `OTRO`).
  4. Seleccionar "OTRO" y verificar que exige texto explicativo obligatorio antes de habilitar el botón de confirmación.
  5. Confirmar la cancelación y validar que el estado del pedido y sus ítems cambian correctamente.
- [x] **TC-05 — Registro de Despacho con Comprobante (A3)**:
  1. En un pedido en estado "En preparación", presionar "Registrar envío".
  2. Seleccionar el courier (Starken, Chilexpress, Blue Express, CorreosChile u Otro).
  3. Ingresar número de seguimiento / flete y costo de envío (opcional).
  4. Adjuntar un comprobante en formato imagen o PDF.
  5. Presionar "Registrar despacho" y verificar que el pedido pasa a estado "Enviado".
- [ ] **TC-06 — Visualización de Ítems Cancelados (C2)**:
  1. En el historial de pedidos y en el modal de detalle, validar que los productos cancelados muestran el badge `.item-cancelled-badge` y aparecen atenuados o tachados.

  **Cómo montar el caso** (2026-08-31): esto NO es cancelar un pedido entero, que ya está
  cubierto por TC-04. Es el pedido que sobrevive **con una línea caída**: el comprador pidió
  tres repuestos, el vendedor se quedó sin stock de uno y lo anula, y los otros dos se
  despachan igual. Hay que llegar a un `rt_pedido_item` con `estado` distinto de `ACTIVO`
  -los valores viven en `PedidoService.ITEM_ESTADO_*`- dentro de un pedido que sigue vivo.

  Qué mirar: que el ítem caído salga tachado y con su badge, que el **total del pedido no lo
  cuente**, y que el motivo de cancelación se lea (las etiquetas están en
  `src/data/cancellationReason.js`; si falta la entrada, el motivo sale en blanco sin ningún
  error).

  Por qué importa: los estados de ítem cancelado se espejan en TRES lugares
  -`PedidoService.ITEM_ESTADO_*`, `LiquidacionPedidoCalculator.itemsActivos()` y
  `CANCELLED_ITEM_STATUSES` del móvil-. Si uno se desincroniza, el ítem anulado entra a la
  liquidación como vivo y **al vendedor se le paga de menos o de más**. Es plata, y ninguna
  prueba automática lo cubre.

---

### Módulo 3: Confianza, Postventa y Notificaciones (Fase 3)
- [x] **TC-07 — Confirmación de Recepción y Calificación (A4)**:
  1. Iniciar sesión como comprador y abrir un pedido en estado "Enviado" o "Listo para retiro".
  2. Presionar "Confirmar recepción" / "Marcar recibido".
  3. En el modal emergente de calificación, seleccionar estrellas (1 a 5) para la atención del vendedor y para cada producto individual recibido, con comentario opcional.
  4. Enviar calificación y verificar que el pedido queda en estado "Entregado" / "Finalizado".
- [x] **TC-08 — Centro de Soporte y Tickets Bidireccionales (A5 & B2)**:
  1. En el perfil, ir a "Centro de ayuda" o "Soporte" y abrir un ticket existente.
  2. Comprobar que se muestra el hilo cronológico de mensajes entre el usuario y soporte.
  3. Escribir y enviar una respuesta; verificar que se añade al chat en tiempo real.
  4. Presionar "Cerrar consulta" y confirmar que el ticket pasa a estado cerrado.
- [x] **TC-09 — Imágenes en Chat de Mediación (A15 & B1)**:
  1. Abrir un caso de mediación/disputa activo en `MediationCaseView`.
  2. En el compositor inferior, pulsar el botón de adjuntar foto, elegir una imagen y enviarla.
  3. Validar que la foto se visualiza en la conversación y permite hacer clic para ver en grande.
- [x] **TC-10 — Creación de Reporte Contextual (A18)**:
  1. En el menú de opciones de una cotización o pedido, pulsar "Reportar".
  2. En la ficha de producto, tienda o tarjeta de anuncio, pulsar "Reportar".
  3. Seleccionar el motivo contextual correspondiente (Tienda, Producto o Anuncio) e ingresar detalle opcional.
  4. Enviar y comprobar el mensaje de confirmación confidencial y la nota informativa de soporte/mediación.
- [x] **TC-11 — Limpieza de Notificaciones Leídas (A24 & B6)**:
  1. Abrir la campana de notificaciones en el perfil (`ProfileNotificationsBell`).
  2. Presionar "Limpiar leídas".
  3. Verificar que las notificaciones leídas se eliminan y solo se mantienen las no leídas o el estado vacío.

---

### Módulo 4: Catálogo y Herramientas del Vendedor (Fase 4)
- [x] **TC-12 — Calculadora Inversa y Desglose de Comisiones (A22)**:
  1. En la pestaña de catálogo del vendedor, pulsar "Agregar producto" o editar uno existente.
  2. En el bloque de precio, interactuar con la tarjeta `CommissionSummaryCard`:
     - Pestaña **Desglose por Precio**: cambiar el precio de venta y comprobar el cálculo de retención RepuesTop, pasarela Flow con IVA y monto a recibir.
     - Pestaña **Calculadora Inversa**: ingresar cuánto se desea recibir líquido (ej. $50.000) y verificar el cálculo automático del precio sugerido.
     - Presionar **"Fijar Precio"** y validar que el valor sugerido se traslada al input principal de precio.
- [x] **TC-13 — Fotos Existentes al Editar Productos (A23)**:
  1. Editar un producto que ya tenga imágenes cargadas.
  2. Validar que las fotos aparecen en miniaturas con el contador exacto (ej. "2/4 fotos").
  3. Eliminar una foto existente con el botón "X" y agregar una foto nueva.
  4. Guardar y verificar que el producto actualiza sus fotos sin pérdida de datos.
- [x] **TC-14 — Redirección a Gestión Masiva (A11)**:
  1. En el catálogo de productos del vendedor, ubicar el banner de carga masiva.
  2. Pulsar "Ir al Panel de Inventario" y verificar que abre la URL de `vendedor_panel` (`https://inventario.repuestop.cl` o dev).

  **Validado el 2026-08-31, con una salvedad**: la redirección funciona, pero el panel de
  inventario **no hereda la sesión** — el vendedor tiene que volver a autenticarse ahí. No es
  un defecto de esta pantalla, es que no hay SSO entre el marketplace y `vendedor_panel`.
  Queda anotado porque en la práctica corta el flujo justo cuando el vendedor va a cargar su
  inventario, que es el momento en que menos conviene perderlo.
- [x] **TC-15 — Responder Preguntas de Productos (A6)**:
  1. En el menú del vendedor, entrar a "Preguntas de productos".
  2. En una pregunta con estado pendiente, escribir una respuesta en el formulario inline y presionar "Responder".
  3. Confirmar que la pregunta pasa a respondida y se actualiza en la tienda pública.
- [x] **TC-16 — Pausar y Reanudar Publicaciones (A10)**:
  1. En la lista de catálogo del vendedor, pulsar el botón "Pausar" en un producto activo.
  2. Verificar que aparece el badge `Pausado` y el producto se atenúa.
  3. Pulsar "Reanudar" y comprobar que vuelve a estado activo visible para compradores.
- [x] **TC-17 — Verificación Comercial y Contrato de Adhesión (A7 & A12)**:
  1. Entrar a "Mi tienda y datos" como vendedor.
  2. Validar que se visualiza la tarjeta de Verificación Comercial y el estado de aceptación de términos de adhesión.

---

### Módulo 5: Descubrimiento, Vehículos y Favoritos (Fase 5)
- [x] **TC-18 — Bandeja de "Mis Preguntas" para Compradores (A13)**:
  1. Iniciar sesión como comprador e ir a "Mis preguntas" en la barra lateral del perfil.
  2. Comprobar que se listan las consultas realizadas, el estado y las respuestas otorgadas por los vendedores.
- [x] **TC-19 — Búsqueda de Vehículo Manual (A17)**:
  1. En la barra superior o en el hero de la página principal, seleccionar búsqueda manual.
  2. Escoger Marca y Año y pulsar "Buscar repuestos".
  3. Verificar que se envía a `POST /api/v1/vehiculos/manual` y se fija el vehículo activo en la tienda.

  **Validado el 2026-08-31.** La evidencia está en la base, no en los logs: `rt_vehiculo_consultado`
  id 3 quedó con `patente = 'MANUAL'`, `fuente_identificacion = 'MANUAL'` y
  `vehiculo_catalogo_id = 5493` (RAM 2500 BIG HORN CREW CAB 6.700 Automática, 2020). O sea que
  el endpoint corrió y **resolvió un `catalogoId` real**, que es lo único que importa: sin él
  la búsqueda por vehículo manual no puede cruzar compatibilidades. Esto cierra el MATIZ del
  punto A17, que decía que el hero armaba un objeto mock `GEN-AUTO` en memoria sin llamar al
  backend.
- [x] **TC-20 — Agregar y Quitar Favoritos en Tiempo Real (A19)**:
  1. En la ficha de producto (`ProductDetailPage`) o en las tarjetas (`MarketplaceProductCard`), pulsar el icono de corazón.
  2. Validar que el corazón se ilumina en rojo y persiste al recargar la página.
  3. Ir a la pestaña "Favoritos" en el perfil del comprador y validar que el producto aparece en la lista.
  4. Volver a pulsar el corazón para quitar de favoritos y confirmar que desaparece de la lista.

---

### Módulo 6: Chats con Imagen (Fase 6)
- [x] **TC-21 — Envío de Imágenes en Chat de Cotización (A14)**:
  1. Abrir una cotización en `QuoteDetailModal`.
  2. En el compositor de chat, pulsar "Adjuntar foto".
  3. Seleccionar una imagen y comprobar la previsualización con nombre y tamaño en KB.
  4. Escribir un texto opcional y pulsar "Enviar".
  5. Verificar que el mensaje aparece con la foto en la burbuja del chat y permite ampliarla.

---

### Módulo 7: Compras, Checkout y Avisos (Fase 7)
- [x] **TC-22 — Totales de Compra en Checkout (C3 & C4)**:
  1. Agregar 1 o más repuestos al carrito y proceder al checkout.
  2. Validar que el total a pagar es estrictamente la suma de `Subtotal Productos + Costo de Envío` sin recargo de pasarela para el comprador.
  3. Seleccionar los métodos de despacho disponibles y verificar que la orden se genera limpiamente.
- [ ] **TC-23 — Publicación de Anuncios y Agenda (C6 & C7)**:
  1. Entrar al Mural de Anuncios y crear o editar un aviso con `AdForm`.
  2. Verificar que los topes de caracteres (500 descripción, 80 precio/cotización) y formato de teléfono chileno funcionan defensivamente.
  3. Guardar el anuncio y confirmar que genera el `agendaConfigId` requerido por la app móvil.


---

## 7. Resultado de las pruebas (sesión del 2026-08-25)

Se probó **contra el backend local** (`localhost:8080`, perfil `dev,local`), no contra
`api-dev`. Cinco pruebas cerradas; el resto queda para la próxima sesión.

| # | Capacidad | Estado |
|---|---|---|
| 1 | A23 — fotos existentes al editar un producto | ✅ aprobada (verificada también en R2) |
| 2 | A9 — métodos de envío de la tienda | ✅ aprobada |
| 3 | A2 + C1 — cancelación del vendedor con motivo | ✅ aprobada |
| 4 | A3 — despacho con comprobante | ✅ aprobada (comprobante confirmado en R2) |
| 5 | A4 — calificación del comprador y cierre del pedido | ✅ aprobada |

**Siguiente: prueba 6 — tickets de soporte (A5 + B2).** El modal de detalle del ticket
se corrigió junto con los demás (usaba `.order-modal-card`, que no existe) pero **no se
ha visto renderizado todavía**. Después quedan A6, A7, A10, A12, A13, A14, A15, A19,
A24, A1 y A20.

### 7.1 Lo que las pruebas destaparon

Ninguno de estos estaba en el plan. Salieron probando, y varios son **preexistentes**,
no de las fases de paridad:

1. **Tres `ReferenceError` que reventaban vistas enteras.** `userId` en
   `ProfileDashboard` (moría cualquier detalle de pedido), `sellerNames` en el modal de
   calificación, y `handlePageChange` en el paginador de la tienda pública (este venía
   de `7af100d`). Ni `npm run build` ni `npm run lint` los detectan: son errores de
   runtime y `no-undef` está apagado. **Se encuentran con
   `npx oxlint --deny no-undef src/`**, que hoy deja limpio salvo globals del navegador.
   Vale la pena correrlo al agregar props o handlers.
2. **`window.confirm` y `alert()` no abren nada en un navegador embebido**: devuelven
   `false`/`undefined` de inmediato, así que el código salía por el `return` y el botón
   quedaba mudo. Pasaba en avanzar el estado del pedido (tarjeta y detalle), cerrar un
   ticket de soporte y validar la foto de perfil. Todo migrado a `ConfirmDialog` y a
   avisos inline. **Ya no queda ningún `alert()` ni `window.confirm()` en `src/`.**
3. **Modales dibujados con clases que no existen en `index.css`**
   (`.order-modal-card`, `-header-left`, `-title`, `-close-btn`): la tarjeta quedaba sin
   fondo y el contenido de atrás se veía a través. Afectaba a los tres subdiálogos del
   pedido y al detalle del ticket. Ahora usan `.commission-modal-*` por portal, como
   `ConfirmDialog`, más una familia `.order-subdialog-*` que toma los colores del tema.
4. **Campos del despacho sin tope.** `courier` y `trackingNumber` son `length = 120` y
   `valorEnvioInformado` es `NUMERIC(12,2)`: un número largo **no entraba en la columna**
   y el despacho se perdía al guardar. Acotados; el seguimiento además se restringe a
   `A-Z0-9-` (6–30), el superset de los formatos de Chilexpress, Starken, Blue Express y
   Correos de Chile.
5. **Restricciones del backend que la UI no anticipaba**: la cancelación del vendedor
   solo acepta `PENDIENTE`/`PAGADO`, y la calificación exige puntuar **todos** los ítems
   y rechaza la segunda. Los botones ahora respetan esas fronteras en vez de mandar el
   400 y mostrarlo como error del servidor.

### 7.2 Observaciones abiertas (no bloquean)

- **Pedidos históricos con el método de envío concatenado.** El pedido #6 tiene
  `courier = "Retiro en tienda | Envío dentro de la comuna ($3000)"`: los dos métodos
  pegados, justo lo que CLAUDE.md dice que nunca hay que hacer. Es **dato viejo, no una
  regresión** — el checkout actual usa `checkoutFallbackShippingMethod()`, que manda
  vacío si hay mezcla. Pero esos pedidos se ven contradictorios (dicen "Retiro en
  Tienda" y cobran envío). Falta medir cuántos hay.
- **`order.courier` casi nunca es un courier.** Suele traer el método de envío, así que
  el `<select>` del despacho nunca calza con la lista. Por eso arranca en un placeholder.
- **`no-undef` sigue apagado en el lint.** Habilitarlo con los globals del navegador
  configurados dejaría esta clase de bug al alcance de `npm run lint`. Hoy el barrido da
  cero reales, así que es el momento de activarlo sin arrastrar deuda. Pendiente de
  decisión.

### 7.3 A7 y A12: estaban marcadas IMPLEMENTADO y eran código muerto (2026-08-25)

Al validar los commits subidos apareció que **A7 (verificación) y A12 (adhesión) nunca
se cablearon**. Las cinco funciones de `api.js` estaban importadas en
`ProfileDashboard` pero **nunca llamadas**; el lint (`no-unused-vars`) fue lo que lo
delató. Una verificación anterior con `grep -rl` las dio por usadas porque el patrón
coincidía con la propia **línea de import**: para saber si algo se usa hay que buscar
`nombreFuncion(`, no `nombreFuncion`.

Lo grave no era la ausencia sino la tarjeta que sí se renderizaba:

```jsx
<span>{storeInfo?.verificacionEstado || 'Tienda Verificada'}</span>
<span>Términos y condiciones aceptados</span>
```

`TiendaResponseDTO` **no tiene** `verificacionEstado`, así que el respaldo se aplicaba
siempre: cualquier vendedor —pendiente, rechazado o suspendido— veía un visto verde. La
línea de adhesión estaba hardcodeada. No era una función faltante, era una afirmación
falsa sobre el estado comercial del vendedor.

**Cerrado** con `SellerVerificationCard.jsx`: estado real desde
`GET /proveedores/{id}/verificacion`, envío (POST), corrección (PUT), apelación y
aceptación del contrato. Los cuatro documentos usan las mismas etiquetas que la bandeja
de validaciones del backoffice (`backoffice_sistema/backoffice/frontend`).

De paso, dos cosas del hero:

- **La etiqueta "Beneficio Tarifa Fundador Activo (5%)" salía para todo vendedor.** Se
  asigna en el backoffice (`PATCH /backoffice/founders/{id}` → `Proveedor.fundador`) y
  viaja en `TiendaResponseDTO.founder`; ahora la etiqueta depende de ese campo.
- **Contraste del chip de estado**: `.profile-dashboard .store-status-chip` pisaba el
  `color` a verde pálido, y `.chip-approved` aporta un degradado **claro**. El chip vive
  sobre la foto de portada, así que cada estado lleva ahora su par color/fondo
  translúcido oscuro. Además `EstadoTienda` tiene cuatro valores y solo se miraba
  `APPROVED`: una tienda rechazada o suspendida se anunciaba como "en revisión".

**A16 sigue pendiente** (`getInventoryVehicleCatalogsApi` y `getVehicleCatalogPartsApi`
sin uso). El plan ya lo dice, pero conviene recordar que las dos funciones muertas
siguen en `api.js`.

### 7.4 Notificaciones: navegación parcial — 2026-08-26

La campana ahora navega al hacer clic (`src/data/notificationTargets.js`), pero **la
cobertura no es completa** y se validó así a propósito para no frenar las pruebas.

**Funciona de punta a punta** (lleva a la vista Y abre el elemento):

- Pedido (`/order-detail`, `/mediation-chat` de backoffice) → `?pedido=` abre el modal.
- Soporte (`/support-ticket-detail`) → `?ticket=` abre la consulta.
- Producto (`/product-detail`) → ficha del repuesto.

**Llega a la pestaña pero NO abre el elemento**: cotizaciones y anuncios. El traductor
emite `?cotizacion=` y `?anuncio=`, pero **ninguna vista los lee**: solo `ProfilePage`
baja `deepLinkOrderId` y `deepLinkTicketId`. Para cerrarlo hay que hacer lo mismo que
con esos dos — leer el parámetro y pasarlo al panel correspondiente.

**Sin verificar**: verificación de tienda y retiros, que solo apuntan a la pestaña y
probablemente no necesiten más.

Ojo también con el origen: el backend guarda las rutas de la APP en `targetRoute`. Si
se agrega un tipo de notificación nuevo allá, hay que sumar su entrada al traductor o
el clic no hará nada (devuelve `null` y solo marca como leída, que es el fallback
deliberado).


### 7.5 Segunda tanda de pruebas — 2026-08-26

Cerradas 6 a 12: tickets de soporte, responder preguntas, pausar/retomar, favoritos,
mis preguntas del comprador, notificaciones y el chat de cotizacion. El flujo de compra
se probo de punta a punta, incluido el pago de una cotizacion.

**A1/A20 cerradas el 2026-08-26** contra el backend local, en los tres escenarios
(comprador por correo, tienda por RUT y validacion temprana del correo en el registro).
El detalle esta en `HANDOFF_PROXIMO_AGENTE.md` seccion 4.22.

**A8 cerrada el 2026-08-26.** Se probo bloqueando al proveedor 4 desde el backoffice por
mediacion. Destapo que el banner era codigo muerto, un bucle de login sin salida y dos
huecos de visibilidad publica; el detalle esta en `HANDOFF_PROXIMO_AGENTE.md` seccion
4.23, incluida la decision de que **el bloqueo es de cuenta completa** y lo que quedo
pendiente en la app movil.

**A15 cerrada el 2026-08-27.** La subida ya estaba implementada (esta linea y la de
CLAUDE.md decian que faltaba, y era falso). Se probo desde los dos lados: previsualizacion
antes de enviar, compresion al seleccionar, y los dos topes nuevos del servidor -3 MB y 10
imagenes por conversacion-, con la imagen 11 rechazada por el backend.

**A7/A12 (Verificación comercial y adhesión) cerrada el 2026-08-27.** Probada de punta a punta
con cuenta `repuestop7@gmail.com`: subida de documentos a Cloudflare R2, lectura de PDF en Blob
y firma del contrato de adhesión persistido.

**Deep links de notificaciones y gestión de campana (A24 & §7.4) cerrados el 2026-08-27.** Probados de punta a punta:
- Conectado `?cotizacion=` en `ProfilePage` y `ProfileDashboard` para abrir directamente `QuoteDetailModal` al pinchar notificaciones de cotización, tanto para comprador (`/quote-chat`) como vendedor (`/(seller)/mensajes`).
- Cierre del modal limpia reactivamente los query params (`setSearchParams`) permitiendo reingresos consecutivos sin bloqueo.
- Campana `ProfileNotificationsBell` incluye cierre automático por clic exterior (Click Outside) y cambio de ruta (`useLocation`), además de borrado de leídas (`DELETE /usuarios/{id}/notificaciones/leidas`).
- Sumado a `?pedido=` (`OrderDetailModal`) y `?ticket=` (`SupportTicketDetailModal`).

**TC-12 / TC-13 / A22 / A23 (Catálogo 1:1, cálculo inverso, fotos y múltiples compatibilidades) cerrados el 2026-08-27.** Probados de punta a punta:
- Creación y edición de repuestos con persistencia y eliminación selectiva de fotos.
- Calculadora de comisiones con cálculo inverso y tasa fija de 5% para vendedores fundadores.
- Edición y serialización de múltiples compatibilidades con marcas, modelos y versiones asociadas.
- Visualización de la tarjeta de compatibilidades para el comprador en `ProductDetailPage` con chips exactos de versiones seleccionadas.

**TC-10 / A18 (Reportes contextuales 1:1 en Producto, Tienda y Anuncios) cerrado el 2026-08-28.** Probado y validado de punta a punta:
- Renderizado global mediante `createPortal` en `document.body` evitando solapamientos con contenedores con `backdrop-filter` o `transform`.
- Ficha de Producto: botón sutil `⚑ Reportar publicación` al pie de la columna de compra (`!isOwnProduct`), con motivos específicos de producto.
- Ficha de Tienda: corrección de contraste en hero/portada, avatar con iniciales, banner duplicado eliminado, buscador unificado y exclusión estricta de auto-reporte en tienda propia (`!isOwnStore`).
- Mural de Anuncios: exclusión estricta en avisos propios (`!isOwnAdCard`), 0 datos hardcodeados y motivos específicos de servicios automotrices.
- Tipografía ampliada (título 18px, motivos 13.5px bold, textarea 13.5px) y tarjeta explicativa de seguridad/mediación para soporte.

**A16 (Búsqueda por catálogo de vehículo 1:1) implementado y conectado:**
- Adaptadores `adaptCompatibleOffer` y `adaptCompatibleOffersPage` en `adapters.js`.
- Query key reactiva `qk.vehicleCompatibleProducts` en `queryKeys.js`.
- `PartsCatalogView.jsx` conmuta automáticamente a `GET /api/v1/vehiculos-catalogo/{id}/repuestos` al filtrar por vehículo activo (`activeVehicle.catalogoId`), con banner verde de calce verificado oficial y fallback a catálogo general.

El detalle de lo que se arreglo esta en `HANDOFF_PROXIMO_AGENTE.md` seccion 4.24, 4.25, 4.26, 4.27 y 4.28.


### 7.6 Sincronización del checklist y últimas validaciones — 2026-08-31

**Las casillas de la sección 6 estaban desincronizadas de esta sección.** Aparecían 20 de 23
casos abiertos, cuando la prosa de aquí venía declarando cerrados casi todos entre el 25 y el
28 de agosto: nadie volvía a tildar la lista. Quedaron marcados los 21 que ya tenían respaldo
documentado, con su fecha. **Si cierras un caso, marca la casilla además de escribirlo acá.**

**TC-14 (A11) — validado, con salvedad.** La redirección al panel de inventario funciona, pero
el panel **no hereda la sesión**: el vendedor tiene que autenticarse de nuevo. No hay SSO entre
el marketplace y `vendedor_panel`. Corta el flujo justo cuando el vendedor va a cargar su
inventario.

**TC-19 (A17) — validado.** La evidencia quedó en la base y no en los logs (que solo cubren dos
ventanas cortas y no alcanzan el momento de la prueba): `rt_vehiculo_consultado` id 3 con
`patente = 'MANUAL'`, `fuente_identificacion = 'MANUAL'` y `vehiculo_catalogo_id = 5493` — RAM
2500 BIG HORN CREW CAB 6.700 Automática, 2020. El endpoint corrió y resolvió un `catalogoId`
real, que es lo único que importa: sin él la búsqueda manual no puede cruzar compatibilidades.
Cierra el MATIZ del punto A17 sobre el objeto mock `GEN-AUTO`.

**Quedan dos casos sin validar, y son de naturaleza distinta:**

- **TC-06 (C2) — ítems cancelados.** No estaba claro qué había que probar; el caso quedó
  descrito en la sección 6. En corto: no es cancelar un pedido entero (eso es TC-04), es un
  pedido que sobrevive con UNA línea caída. Importa porque los estados de ítem cancelado se
  espejan en tres lugares y, si se desincronizan, el ítem anulado entra a la liquidación como
  vivo y al vendedor se le paga mal.
- **TC-23 (C6/C7) — anuncios y agenda.** Sin revisar. Es el único módulo cuyo backend todavía
  no está en producción, y `agendaConfigId` es justo el campo que si falta deja el aviso sin
  días disponibles en la app móvil **sin que el backend lo valide**.

**Fuera de este documento quedan dos pendientes de validación que sí son camino crítico para
lanzar:**

- **Login con correo y contraseña** (`PLAN_UNIFICACION_WEB.md`): nunca se probó por falta de
  cuentas. El documento lo califica de riesgo bajo porque el login con Google ya validó CORS,
  JWT, sesión y rol — pero no todos los compradores van a entrar con Google.
- **Alta con Google de una cuenta nueva** (`PLAN_MONEDA_REPUESTOP.md`): necesita un correo que
  todavía no exista en RepuesTop. Es el registro, no el login.
