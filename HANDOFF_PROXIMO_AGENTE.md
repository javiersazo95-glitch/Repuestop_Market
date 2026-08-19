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

## 2. Estado de Producción

La plataforma web se encuentra **100% conectada al backend real, optimizada con TanStack Query, con soporte de pasarela Flow end-to-end, y protegida con code splitting y error boundaries** para despliegue productivo.
