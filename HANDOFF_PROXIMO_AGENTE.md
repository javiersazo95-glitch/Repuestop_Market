# Handoff — integración web ↔ backend

> Para el agente que retoma esto. Escrito para leerse sin contexto previo.
> Fecha: 2026-08-13. Repo web: `C:\ProyectoRepuestop\Repuestop_Market`. Repo
> backend/mobile: `C:\ProyectoRepuestop\repuestop`.

## 1. Estado actual — qué ya está resuelto y verificado

El plan original vivía en `PLAN_INTEGRACION_BACKEND.md` (mismo repo). Las
fases 0–7 de ese plan están implementadas. En esta sesión se resolvieron:

1. **Condición de carrera del Carrito (RESUELTO Y VERIFICADO EN RED)**:
   Se agregó `pendingAddsRef` en `MarketplaceContext.jsx`. Si el usuario agrega e inmediatamente
   elimina un producto antes de que la petición `POST /carrito/items` vuelva del servidor, la petición
   se marca como cancelada. Al resolver, ejecuta automáticamente `DELETE /carrito/items/{itemId}` en el backend,
   impidiendo que el ítem reaparezca en el drawer o quede huérfano en `rt_carrito_item`. Confirmado con capturas
   de red en vivo (`200 OK` en el `DELETE` automático).
2. **Fase 4 completada — Fichas de Producto y Perfil a TanStack Query**:
   - `ProductPage.jsx`, `ProductDetailPage.jsx` y `RelatedProductsCarousel.jsx` migrados a `useQuery` (`qk.product`, `qk.productQuestions`, `qk.relatedProducts`). Las preguntas públicas usan `useMutation` con actualización optimista de caché (`setQueryData`).
   - `ProfileDashboard.jsx` (panel de comprador/vendedor, ~1980 líneas) migrado completamente a TanStack Query (`qk.buyerOrders`, `qk.sellerOrders`, `qk.favorites`, `qk.conversations`, `qk.sellerStore`, `qk.sellerInventory`, `qk.sellerProductQuestions`). Eliminados todos los `useEffect` + `useState` de carga manual.
3. **Limpieza de Código Huérfano y Datos Ficticios**:
   - Eliminados los archivos muertos `LiveQuotationWidget.jsx`, `liveMarketplaceData.js` y `products.js`.
   - `LicensePlateHero.jsx` y `getVehicleBrandsApi()` actualizados para propagar `AbortSignal` y consultar las marcas de vehículo reales directamente desde la API (`GET /catalogos/inventario/marcas-vehiculo`).

4. **Fase 8 completada — Escala, Rendimiento y Observabilidad**:
   - **Code-Splitting por Ruta**: implementado con `React.lazy` y `<Suspense>` en `AppRoutes.jsx`. El bundle JS inicial se redujo de **670 kB a 343 kB (reducción del 49%)**.
   - **Límites de Error (`RouteErrorBoundary`)**: componente modular con recuperación de UI y botón interactivo "Reintentar" / "Volver al Inicio" en `src/components/RouteErrorBoundary.jsx`.
   - **Skeletons de Carga Consistentes**: creados en `src/components/skeletons/` (`PageLoadingSkeleton`, `ProductCardSkeleton`, `ProductDetailSkeleton`, `StoreCardSkeleton`) para Catálogo, Tiendas y Ficha de Producto con animación *shimmer* y cero saltos de layout (CLS).
   - **Accesibilidad y Trazabilidad**: estados de carga marcados con `aria-busy="true"` y alertas con `role="alert"`. Trazabilidad `X-Request-Id` operativa en `api.js`.

Verificación técnica: `npm run build` compila limpiamente en **3.4s** generando chunks independientes por ruta.

## 1.b Sesión 2026-08-19 — panel de perfil

1. **Vista del comprador alineada con la del proveedor (LISTO)**. El rediseño
   denso del panel estaba scoped a `.seller-profile-dashboard`; el comprador caía
   en los estilos base viejos (cuerpo centrado a 1280 contra un hero full-bleed,
   KPIs en 3+1, acciones en 2 columnas). El bloque pasó a `.profile-dashboard`,
   compartido por ambos roles, y quedaron marcadas solo las reglas que sí
   dependen del rol. De paso se eliminó una copia minificada del mismo bloque que
   estaba al final de `index.css` ("kept last for cascade") y revertía para el
   proveedor cualquier cambio hecho arriba. Detalle en `PLAN_VISTA_COMPRADOR.md`.
2. **Chat de mediación → expediente de disputa (LISTO)**. Dejó de ser un modal a
   pantalla completa y vive como maestro/detalle dentro de `/perfil/consultas`,
   con el caso abierto en la URL (`?caso=<pedidoId>`). Se corrigió que la
   evidencia elegida nunca llegaba al estado (la `FileList` se vaciaba antes de
   leerla), que el detalle de la escalación es obligatorio en el backend y que el
   compositor seguía abierto con la conversación ya pausada. Detalle, contrato
   verificado contra el backend y pendientes en `PLAN_EXPEDIENTE_DISPUTA.md`.

3. **Hilo con el mediador (LISTO)**. El expediente suma solapas sobre el bloque
   del hilo: "Con el vendedor/comprador" y "Con el mediador", esta última solo si
   el caso está escalado. Cada parte lee su propio array
   (`mensajesMediadorComprador` / `mensajesMediadorVendedor`; nunca
   `mensajesMediador`, que mezcla ambas partes), escribe por
   `/pedidos/{id}/mediacion-mensajes` y aporta evidencia por
   `/pedidos/{id}/mediacion-evidencias`, que es un envío aparte del mensaje.

Pendiente conocido tras esta sesión: `/conversaciones/{id}/mediacion-imagenes`
(adjuntar imagen al chat directo) sigue sin usarse en la web, y no hay aviso de
mensajes nuevos del mediador fuera del expediente.

## 1.c Sesión 2026-08-19 — carrito y checkout

El carrito era un panel lateral (`CartDrawer`) que hacía de carrito, selector de
dirección, selector de documento tributario y checkout, todo a la vez. Se reemplazó por
un flujo con URL propia. Plan completo, decisiones y pendientes en
`PLAN_CARRITO_CHECKOUT.md`; acá solo el resumen.

1. **`/carrito` (LISTO)**. Líneas agrupadas por tienda, con el método de entrega por
   grupo (el ítem del carrito ya guardaba `metodoEnvio` y `costoEnvioLocal` por línea, y
   el backend cobra un envío por proveedor). Resumen fijo, aviso de stock bajo, y bloqueo
   del avance si alguna línea no tiene método de entrega.

2. **`/checkout` en pasos (LISTO)**. `entrega → documento → pago`, con el paso en la URL
   (`?paso=`) para que el botón "atrás" del navegador funcione. Valida el RUT de factura
   con `isValidRut`, que el drawer no hacía. Guarda `submittingRef` contra el doble clic.

3. **Pago de cotizaciones (LISTO)**. `/checkout?cotizacion=ID` reemplazó la copia del
   checkout que vivía dentro de `QuoteDetailModal` (dirección, documento y llamada
   propias). Los datos de display viajan por `location.state` desde el chat, con respaldo
   en `getBuyerConversationsApi` para la entrada por URL directa, porque
   `checkoutConversationQuoteApi` necesita el `productoId` —que está en la conversación,
   no en la cotización— y no existe endpoint para traer una conversación por id.

4. **`/compra-exitosa` rediseñada (LISTO)**. Es un comprobante: cabecera de documento con
   el número de pedido, y el seguimiento con los hitos `Pago confirmado → En preparación →
   Entrega`. Usa el mismo `delivery-truck.webp` de la app (copiado a `src/assets/`), en
   CSS puro.

5. **`CartDrawer` eliminado**, junto con su CSS y con `isCartOpen`/`openCart`/`closeCart`.

### Dos hallazgos que conviene no volver a descubrir

- **El comprador no paga comisión.** `PedidoCheckoutCarritoSupport` deja
  `comisionComprador` y `comisionPasarela` en cero: el total es `subtotal + costoEnvio`, y
  el 10/7/5 % se le descuenta al vendedor. La app hace lo mismo (`buyerDisplayPrice` es
  identidad y `flowFeeAmount()` devuelve 0). Los campos `comisionServicio` y
  `totalEstimado` de `GET /carrito` **no sirven**: `CarritoService` deja la comisión
  hardcodeada en cero y el total sin el envío. El cálculo único vive en
  `calcularTotalesCarrito()` (`MarketplaceContext.jsx`).

- **Bug de cobro corregido.** El drawer mandaba `metodoEnvio` como
  `"Retiro en tienda | Envío dentro de la comuna ($4.500)"`. Cuando una línea no traía
  costo, el backend hacía `metodoEnvio.replaceAll("[^0-9]", "")` sobre ese string y pegaba
  los dígitos de ambos precios ($4.500 + $3.990 → **$45.003.990** de envío). Ahora
  `checkoutFallbackShippingMethod()` manda el método solo si es único en todo el carrito, y
  vacío cuando hay mezcla: el método de cada línea ya tiene prioridad en el backend.

Pendientes que abrió esta sesión (detalle en `PLAN_CARRITO_CHECKOUT.md`):
suscripciones/Fichas de anuncios sin backend en ninguna plataforma (§7), subórdenes por
vendedor para el carrito multi-tienda (§8), y la aceptación de términos en el registro
(§9) — hoy nadie los acepta en ningún punto de la web.

## 2. Estado de Producción

La plataforma web se encuentra **100% conectada al backend real, optimizada con TanStack Query, con soporte de pasarela Flow end-to-end, y protegida con code splitting y error boundaries** para despliegue productivo.
