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

## 1.d Sesión 2026-08-20 — aceptación de términos (§9) y toques al monorepo

Esta sesión salió del repo web y tocó el monorepo (`C:\ProyectoRepuestopepuestop`,
rama `dev`). Detalle completo en `PLAN_CARRITO_CHECKOUT.md` §9 y §10.

1. **Historial de aceptaciones (LISTO)**. Tabla `RT_aceptacion_terminos` append-only con
   documento (COMPRADOR | VENDEDOR | PRIVACIDAD), versión, fecha, IP, user agent y origen.
   `RT_usuario.accepts_terms` / `terms_accepted_at` quedan como caché de la última.
   La versión vigente la decide el backend (`repuestop.legal.version-vigente`); el cliente
   informa cuál mostró y se rechaza si no coincide. IP y user agent salen SIEMPRE de la
   petición HTTP, nunca del body: son evidencia.

2. **Registro de comprador de la web arreglado (LISTO)**. Estaba roto: `registerBuyerApi`
   mandaba `userName` y el backend exige `firstName` + `lastName`, `direccion` con
   `comunaId` y `acceptsTerms`. Fallaba con 400 antes de tocar la base. Era un desfase
   preexistente, no lo trajo ningún pull.

3. **Autocompletado de direcciones (LISTO)**. `GET /ubicaciones/direcciones` (llegó en el
   commit `d19381e` del monorepo) conectado al alta de dirección, que es el mismo
   formulario del paso de entrega del checkout. El mapeo nombre → id vive en
   `src/services/geoLookup.js`.

4. **Aviso de re-aceptación (LISTO)**. `TermsReacceptanceModal`, con el texto legal
   dentro del propio aviso.

### Cómo verificar cambios en el backend Java

**`mvn compile` NO alcanza: solo procesa `src/main`.** Railway despliega con
`mvn package -DskipTests`, y `skipTests` salta la EJECUCIÓN de los tests pero no su
COMPILACIÓN. Cambiar una firma en `src/main` y verificar con `mvn compile` deja pasar
tests que ya no compilan, y el deploy revienta en `testCompile`.

Pasó exactamente eso al sumar `AceptacionTerminosService` al constructor de `AuthService`
(corregido en `4dd7b32`). **Verificar siempre con `mvn package -DskipTests`** o, como
mínimo, `mvn test-compile`.

Al correr la suite completa hay 14 fallos **preexistentes y ajenos**: 13 son ambientales
(tests que levantan el contexto Spring y necesitan credenciales de Postgres) y 1 es real
en `CorsProfilePropertiesTest`, que espera solo los tres subdominios de dev mientras la
config también permite `localhost` y rangos de red local. Ninguno bloquea el deploy
porque Railway no ejecuta tests.

## 2. Estado de Producción

La plataforma web se encuentra **100% conectada al backend real, optimizada con TanStack Query, con soporte de pasarela Flow end-to-end, y protegida con code splitting y error boundaries** para despliegue productivo.

---

## 3. Sesión 2026-08-21 — unificación del dominio y catálogos de producción

Sesión larga. Cerró las Fases 1, 2 y 3 de `PLAN_UNIFICACION_WEB.md` (ver ese archivo para
el detalle) y destrabó producción con dos hotfixes de backend.

### 3.1 Estado real de producción al cierre

| Pieza | Estado |
|---|---|
| `repuestop.cl` | **sirve el marketplace**. Movido desde el sitio institucional antiguo. |
| `www.repuestop.cl` | 307 → ápex. El ápex es el canónico. |
| Proyecto Vercel prod | `repuestop-market`, rama `main` |
| Proyecto Vercel dev | `dev-repuestop-market`, rama `dev` → `dev-repuestop.repuestop.cl` |
| Backend prod | `main` en `225feca`. **APAGADO a propósito**: la página no se lanzó, así que estaba quemando recursos de Railway. |
| Backend dev | `api-dev.repuestop.cl`, arriba. **Es el ambiente de trabajo.** |
| Base de datos prod | geografía + catálogos cargados (ver 3.3) |

**Mientras el backend esté apagado, `repuestop.cl` sirve la cáscara del marketplace sin
datos**: catálogo vacío, login roto, todo lo que dependa de la API falla. Es aceptable
porque no se ha lanzado, pero ver 3.5 sobre el riesgo de indexación.

### 3.2 Cosas que costaron y no hay que volver a descubrir

**Las dos instancias de Railway corren con `SPRING_PROFILES_ACTIVE=prod`.** Por lo tanto
`application-dev.properties` **nunca se carga**, ni siquiera en el ambiente de desarrollo.
Al razonar sobre configuración de ambientes, preguntar por la variable de Railway; no citar
ese archivo como fuente de verdad. De acá salieron los dos bugs de producción de esta
sesión.

**Vercel movió el Production Branch de sitio.** Ya no está en *Settings → Git* sino en
*Settings → Environments → Production → Branch Tracking*.

**Redeploy no cambia de rama.** Reconstruye el mismo commit. Para desplegar otra rama hace
falta un push nuevo; en su momento se usó un commit vacío.

**El Ignored Build Step no corre al guardarlo**, solo cuando llega un push. Parece inerte
hasta el primer push y está bien.

**Al agregar dominios, Vercel configuró la redirección al revés por su cuenta** (ápex → www)
y como `www` no existía en DNS, dejó el sitio caído unos minutos. Verificar siempre la
dirección después de agregar dominios.

**Vercel gestiona HSTS en el edge** e ignora `Strict-Transport-Security` de `vercel.json`.
No es una regresión: `repuestop.cl` tampoco lo emitía antes.

**El DNS vive en Cloudflare** y el CNAME de Vercel exige **Proxy en "DNS only"** (nube
gris). Proxeado, Vercel no valida el dominio.

### 3.3 Los dos hotfixes de backend, y por qué existieron

Producción arrancó vacía de catálogos. La causa raíz de ambos casos fue la misma:
`DevDataInitializer` estaba anotado `@Profile("dev")` **entero**, y ningún ambiente corre
ese perfil.

- **`V2026082150__seed_geografia_chile.sql`** (commit `8df9f32`): 1 país, 16 regiones, 346
  comunas, con los mismos ids que dev. Desbloqueó el registro de tiendas, que se quedaba con
  el selector de Región en "Cargando..." para siempre.
- **`DevDataInitializer` → `DataInitializer`** (commit `225feca`): la clase ahora corre en
  todos los ambientes; los datos de prueba (usuarios, tienda demo, productos, patentes mock)
  quedaron tras un guard por perfil. Cargó 27.076 versiones de vehículo desde los CSV.

Verificado en producción: 265 marcas de vehículo, 75 marcas de repuesto, 25 categorías,
1/16/346 de geografía.

**Consecuencia útil**: como la siembra ahora es automática, si la base de producción se
recreara, los catálogos se recargan solos al arrancar. Lo que NO se recupera son los datos
de usuario reales (cuentas, tiendas registradas).

### 3.4 Pendientes abiertos

**Error sin diagnosticar**: al registrar métodos de envío para publicar un producto, la web
responde *"usuario no encontrado"*. **Bloquea publicar productos**, o sea que el catálogo de
producción no puede llenarse. Sospecha sin verificar: mismo patrón que el 404 de
`/auth/google` —un endpoint buscando un registro que en producción todavía no existe—,
quizá la cuenta recién creada no tiene aún fila de proveedor asociada. Hay que mirarlo.

**`main` está 23 commits atrás de `dev`.** No tiene `AnuncioController`,
`AnuncioProveedorController`, `AgendamientoAnuncioController`, `CompraFichaController` ni
`AceptacionTerminosService`, ni el fix `c30a45a` de la redirección post-pago de Flow. **La
web que está en producción es más nueva que el backend que la atiende.** Ese merge es una
operación grande: incluye 5 migraciones de esquema (`V2026082001` a `V2026082101`).

**Fase 4 de `PLAN_UNIFICACION_WEB.md`** sin hacer: archivar el repo antiguo
(`javiersazo95-glitch/Repuestop_web`) y borrar sus **dos** proyectos de Vercel.

### 3.5 Riesgo de SEO mientras la página no se lanza

`repuestop.cl` está en vivo, sin datos y con el backend apagado. `robots.txt` dice
`Allow: /` y Google ya conocía el dominio por el sitio antiguo, así que **va a recrawlear y
puede indexar el sitio roto**.

**Hecho**: `public/robots.txt` quedó en `Disallow: /`, con la configuración real comentada
justo debajo y un bloque de cabecera que explica cómo revertirlo. **El día del lanzamiento
hay que descomentarla**, o el sitio nunca se indexa. Es el único paso de SEO pendiente para
el launch.

Tampoco se envió el sitemap a Search Console, a propósito: hacerlo con el catálogo vacío
haría que Google clasifique esas rutas como páginas pobres, y recuperar posiciones cuesta
más que indexar bien la primera vez. **Enviarlo cuando haya catálogo real.**

Queda hecho el redirect anti-duplicado: `repuestop-market.vercel.app` y
`dev-repuestop-market.vercel.app` hacen 308 a su dominio real.

---

## 4. Próxima fase — homologar el mural de anuncios con el backend

Hoy `src/services/adsStorage.js` guarda anuncios, saldo de Fichas y transacciones en
`localStorage`. La app móvil hace lo mismo con su `services/ads-storage`. **Ningún cliente
consume el backend todavía**, así que quien integre primero fija las convenciones del
adaptador; conviene que ambos acuerden el mismo mapeo.

### 4.1 La buena noticia: el backend fue modelado desde el cliente

El entity `Anuncio` usa nombres en inglés —`title`, `company`, `categoryLabel`, `priceText`,
`storyImages`, `servicesOffered`, `is24Hours`, `hasOnlineBooking`, `agendaConfig`— que son
exactamente los del objeto de `src/data/automotiveAdsData.js`. La homologación es sobre todo
cambiar la capa de almacenamiento: `AdCard`, `AdsWallView`, `AdsFilterSidebar` y
`StoriesViewerModal` deberían sobrevivir casi intactos.

### 4.2 Lo que el backend agrega y la web no contempla

| Concepto | Hoy en la web | En el backend |
|---|---|---|
| Moderación | no existe, aparece al instante | nace `PENDIENTE`; solo se ve si está `APROBADO` |
| Rechazo | no existe | `RECHAZADO` + `rejectionReason` |
| Expiración | no existe | `expiresAt` a 30 días |
| `id` | string (`'ad-emp-01'`) | `Long` |
| `rating` / `reviewsCount` | los muestra la tarjeta | **no existen** |

`moderationStatus` es `PENDIENTE` | `APROBADO` | `RECHAZADO`. Son strings, no un enum Java,
pero aplica la misma regla de CLAUDE.md: tienen que calzar exactos.

**La trampa a diseñar desde el principio**: editar un anuncio lo devuelve a `PENDIENTE`
(`AnuncioService.java:77`). Un vendedor que corrige un teléfono ve desaparecer su anuncio del
mural. Si la UI no lo explica, llega como ticket de soporte.

### 4.3 Endpoints disponibles

```
GET    /api/v1/anuncios                      publico; solo activo + APROBADO + no expirado
GET    /api/v1/anuncios/{id}                 publico
GET    /api/v1/anuncios/mios                 del dueño, cualquier estado
POST   /api/v1/anuncios
PUT    /api/v1/anuncios/{id}
DELETE /api/v1/anuncios/{id}
PATCH  /api/v1/anuncios/{id}/approve|reject  backoffice
POST   /api/v1/anuncios/imagenes             multipart
POST   /api/v1/proveedores/{id}/anuncios/imagenes
POST   /api/v1/anuncios/agendamientos/anuncios/{anuncioId}
GET    /api/v1/anuncios/agendamientos/mias
GET    /api/v1/anuncios/agendamientos/anuncios/{anuncioId}
PATCH  /api/v1/anuncios/agendamientos/{id}/estado
POST   /api/v1/anuncios/agendamientos/notificaciones
POST   /api/v1/fichas/compras
```

`/api/v1/anuncios` y `/api/v1/anuncios/*` ya están en el `permitAll` de `SecurityConfig`.

### 4.4 Las cuatro fases propuestas

**A — El mural lee del backend.** `GET /anuncios` y `/anuncios/{id}`, adaptador en
`adapters.js`. Riesgo bajo, no toca escritura, valida el contrato completo. Decidir qué
hacer con los 24 anuncios de demo de `INITIAL_CLASSIFIED_ADS`: desaparecen, salvo que se
siembren en la base.

**B — Publicar y gestionar.** `POST`/`PUT`/`DELETE`, `GET /anuncios/mios` y la subida
multipart con `AbortSignal.timeout(30000)` como manda CLAUDE.md. Acá entra toda la UI de
moderación.

**C — Agendamiento.** Los cinco endpoints de `/anuncios/agendamientos`. Depende de B.

**D — Fichas: BLOQUEADA.** El backend solo expone `POST /fichas/compras`. **No hay endpoint
de saldo ni de consumo**, y la web muestra saldo e historial (`TokensWalletCard`) y gasta
Fichas para promover (`UpgradeAdRankModal`). Hay que definirlo en el backend antes de tocar
la web.

### 4.5 Antes de empezar

**El backend de anuncios solo existe en `dev`.** Trabajar contra `api-dev.repuestop.cl`. Si
se integra y luego se despliega a producción sin el merge de `dev` → `main`, va a funcionar
en dev y dar 404 en `repuestop.cl` — el mismo patrón que se diagnosticó dos veces en esta
sesión.

Mientras el mural siga en `localStorage`, queda fuera del `sitemap.xml` y del texto de
`/nosotros` a propósito. Cuando la integración cierre, entran: son dos cambios chicos, ya
está anotado dónde.
