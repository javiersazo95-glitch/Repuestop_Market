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

Esta sesión salió del repo web y tocó el monorepo (`C:\ProyectoRepuestop
epuestop`,
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

**A — El mural lee del backend. CERRADA (sesión 2026-08-21, ver 4.6).**

**B — Publicar y gestionar. CERRADA (sesión 2026-08-22, ver 4.8).** `POST`/`PUT`/`DELETE`,
`GET /anuncios/mios`, la subida multipart y la UI de moderación.

**C — Agendamiento. CERRADA (sesión 2026-08-23, ver 4.12).** Los cinco endpoints de
`/anuncios/agendamientos`.

**D — Fichas. CERRADA (sesión 2026-08-23, ver 4.13).** Dejo de estar bloqueada: el backend
gano `RT_movimiento_ficha` con saldo, historial y cobro dentro de `AnuncioService`, y los
dos clientes se re-apuntaron. **Las cuatro fases del mural estan cerradas.**

### 4.5 Antes de empezar

**El backend de anuncios solo existe en `dev`.** Trabajar contra `api-dev.repuestop.cl`. Si
se integra y luego se despliega a producción sin el merge de `dev` → `main`, va a funcionar
en dev y dar 404 en `repuestop.cl` — el mismo patrón que se diagnosticó dos veces en esta
sesión.

Mientras el mural siga en `localStorage`, queda fuera del `sitemap.xml` y del texto de
`/nosotros` a propósito. Cuando la integración cierre, entran: son dos cambios chicos, ya
está anotado dónde.


### 4.6 Fase A cerrada — sesión 2026-08-21

El mural (`AdsWallView`) lee `GET /anuncios` vía `fetchPublicAds()` en `adsStorage.js`,
con `adaptAd()`/`adaptAds()` en `adapters.js`. Verificado contra el backend local con
cuatro anuncios de prueba (uno por plan), aprobados y visibles.

**Correcciones al diagnóstico de 4.2, para no volver a creerlo:**

- `rating` y `reviewsCount` **sí existen** en `AnuncioResponseDTO`, pero
  `AnuncioService.toResponse()` los devuelve **hardcodeados en `5.0` y `0`**. El adaptador
  los descarta: mostrarlos era un 5.0 falso idéntico en todas las tarjetas.
- El `id` **no llega como `Long`**: sale como `String` (`String.valueOf(a.getId())`).
- Editar un anuncio no solo lo devuelve a `PENDIENTE`: `actualizar()` también hace
  `setActivo(false)`. Y como el móvil sube de plan vía `PUT`, **gastar Fichas para promover
  un anuncio lo saca del mural** hasta que moderación lo re-apruebe. Hay que advertirlo en
  la UI antes de cobrar (fase B).
- El móvil ya consumía el backend antes de esta sesión, así que las convenciones del
  adaptador estaban fijadas: esta fase las copió, no las inventó.

**Homologaciones con el móvil que había que hacer sí o sí:**

- `AD_TIERS` tenía `destacada.hasWhatsapp: false` en la web y `true` en el móvil, y le
  faltaba `maxTags`. Manda el móvil: `maxTags` (2/4/6/8) es exactamente lo que valida
  `AnuncioService.validar()`, así que con los valores viejos el POST de la fase B habría
  dado 400. WhatsApp y agenda ahora se gatean por `AD_TIERS[tier]` + `hasOnlineBooking`,
  nunca por una lista de tiers escrita a mano.
- `ownerSellerId` llega como `"ML-123"` y la sesión guarda `sellerId: 123`. Sin normalizar
  el prefijo (`idKey()` en `automotiveAdsData.js`), `isOwnAd` nunca daba true y el dueño
  podía llamarse a sí mismo.
- Se portaron desde `mobile/constants/automotive-ads-data.ts`: `isOwnAd`, `hasAdOwner`,
  `filterAdsOwnedBy`, `OWN_AD_BLOCK_MESSAGES`, `getAdExpiryInfo`, `AD_TIER_ORDER`,
  `getUpgradableTiers`, `getTierActivatableFeatures`, `AD_FEATURE_TAGS`. Más un
  `isAdVisibleOnWall()` propio de la web y el hook `useAdOwnership`.

**Datos falsos retirados:** los 14 anuncios demo (el handoff decía 24), `COMPANY_STORIES`
y el `count` fijo de `SERVICE_CATEGORIES` (24/8/5…), que ahora se calcula sobre los
anuncios cargados. El carrusel de historias se arma con los anuncios que tienen
`storyImages` y no se renderiza si no hay ninguno.

**Dos llaves de storage, a propósito:** el mural cachea en `repuestop_ads_wall_cache` y
emite `repuestop_ads_wall_updated`; el panel de gestión sigue local en
`repuestop_classified_ads` con `repuestop_ads_updated`. Si compartieran llave, refrescar el
mural borraría los borradores locales del perfil. Al cerrar la fase B esto se unifica.

**Trampa de entorno que costó una hora:** publicar daba 503 en local. `RT_anuncio` tenía a
la vez las columnas en inglés (`category`, `description`, `commune`) y en español
(`categoria`, `descripcion`, `comuna`), todas `NOT NULL`: el entity solo escribe las
españolas, así que todo INSERT violaba el `NOT NULL` de las otras y
`GlobalExceptionHandler` lo traducía a un 503 genérico. Es exactamente lo que arregla
`V2026082004__remove_legacy_english_anuncio_columns.sql`, pero la base local nunca corrió
esa migración: la última entrada de `flyway_schema_history` era `2026081301` y `RT_anuncio`
la había creado Hibernate con `ddl-auto=update`. Se aplicó el DROP a mano en local. En dev
y prod Flyway sí corre, así que allá no pasa.

**HALLAZGO DE SEGURIDAD, sin resolver:** `PATCH /anuncios/{id}/approve` y `/reject` no
tienen `@PreAuthorize` ni chequeo de rol, y `SecurityConfig` solo los cubre con el
catch-all `authenticated()`. En esta sesión un usuario con rol `CLIENTE` **aprobó sus
propios anuncios** y quedaron publicados. La moderación entera es evitable con una sesión
cualquiera. Hay que cerrarlo en el backend antes de la fase B, que es la que expone
publicar desde la web.


### 4.7 Datos de prueba y arranque de la fase B

**Los cuatro anuncios de prueba quedan en la base LOCAL a proposito**, uno por plan, para
no tener que recrearlos al empezar la fase B. Todos son del usuario 5
(`smkabdiel01@gmail.com`) y estan `APROBADO` + `activo`:

| id | plan | para probar |
|---|---|---|
| 5 | basica | sin WhatsApp, sin fotos, sin agenda |
| 6 | destacada | WhatsApp habilitado por plan, `is24Hours`, sin fotos |
| 7 | premium | 3 fotos (tope 4), 2 `storyImages` -> carrusel de historias |
| 8 | empresarial | 2 fotos, 1 historia, `hasOnlineBooking` con `agendaConfig` completo |

Desde la sesion del 2026-08-22 hay un quinto anuncio APROBADO, el **id 9** (plan destacada,
con una foto real en R2), creado para verificar la escritura de la fase B. Sirve igual que
los otros como dato de prueba.

Como los cuatro son del usuario 5, con esa sesion abierta el mural los marca "Tu anuncio" y
bloquea llamar / escribir / agendar. Para ver la tarjeta como visitante hay que cerrar
sesion o usar otra cuenta.

**Aprobar anuncios nuevos en local ya NO se puede con una sesion normal.** Es la
consecuencia directa del fix SEC-BACKEND-014: `PATCH /anuncios/{id}/approve` ahora exige
`ROLE_SUPER_ADMIN` o `PERM_MEDIACION_CONFIANZA_OPERADOR`. Con una cuenta comun el backend
responde 403. Para dejar visible un anuncio de prueba en local, o se usa una cuenta de
backoffice, o se marca a mano:

```sql
UPDATE RT_anuncio SET estado_moderacion = 'APROBADO', activo = true, revisado_en = now()
WHERE id = <id>;
```

**Antes de retomar, dos cosas del entorno local:**

1. Reiniciar el backend: la instancia que quedo corriendo el 2026-08-21 todavia tiene el
   codigo sin el fix de seguridad.
2. Si se levanta contra una base nueva, revisar que `RT_anuncio` no traiga otra vez las
   columnas en ingles (ver 4.6). Sintoma: publicar da 503.

**El mural en produccion no funciona todavia, y es esperado.**
`https://api.repuestop.cl/api/v1/anuncios` responde 404 y `api-dev` responde 200: el
backend de anuncios sigue solo en `dev`. Con la fase A desplegada, repuestop.cl muestra el
estado de error del mural en vez de los 14 demos que habia antes. Se arregla con el merge
de `dev` -> `main` del backend, no tocando la web. Mientras tanto el sitio sigue bloqueado
a indexacion y sin lanzar, asi que el impacto es bajo.

**Lo primero de la fase B, en orden:**

1. `POST`/`PUT`/`DELETE /anuncios` y `GET /anuncios/mios` en `api.js`, y reemplazar las
   funciones locales de `adsStorage.js` (`createAdInStorage`, `updateAdInStorage`,
   `deleteAdInStorage`) por las que hablan con el backend, copiando el flujo de
   `mobile/services/ads-storage.ts`.
2. Subida multipart a `POST /anuncios/imagenes` con `signal: AbortSignal.timeout(30000)`,
   como manda CLAUDE.md.
3. Toda la UI de moderacion en `AdsManagementSection`: estados PENDIENTE / APROBADO /
   RECHAZADO con `rejectionReason`, vencimiento con `getAdExpiryInfo()` (ya portado), y
   **el aviso de que editar devuelve el anuncio a revision y lo saca del mural** — incluido
   antes de cobrar Fichas por subir de plan, porque el upgrade se hace via `PUT`.
4. Recien cuando la escritura pase por el backend se pueden unificar las dos llaves de
   localStorage (ver 4.6); antes no.


### 4.8 Fase B cerrada — sesión 2026-08-22

Publicar, editar, dar de baja y subir de plan pasan por el backend, y el panel de
gestión muestra el estado de moderación de cada anuncio.

**Lo que se agregó, por capa:**

- `api.js`: `getMyAdsApi`, `createAdApi`, `updateAdApi`, `deleteAdApi`,
  `uploadAdImagesApi` (multipart con `AbortSignal.timeout(30000)`) y `toMediaPath()`,
  el inverso de `resolveMediaUrl`.
- `adapters.js`: `toAdRequestPayload()`, el anuncio de la UI -> `AnuncioRequestDTO`.
- `adsStorage.js`: `fetchMyAds`, `createAd`, `updateAd`, `deleteAd`, `uploadAdImages`,
  `adErrorMessage`, `spendTokensForNewAd`, y `spendTokensForAdUpgrade` ahora asíncrono.
  Se fueron `getStoredAds` / `saveStoredAds` / `createAdInStorage` / `updateAdInStorage` /
  `deleteAdInStorage`.
- `AdForm.jsx` (nuevo): formulario único de publicar y editar.
- `AdsManagementSection`, `CreateAdModal`, `EditAdModal`, `UpgradeAdRankModal` reescritos.
- `ads-wall.css`: sección "FASE B" al final del archivo.

**Las cuatro trampas del backend que definieron el diseño:**

1. **El PUT reescribe todos los campos** (`AnuncioService.aplicar()`). Dos formularios
   distintos para crear y editar significaban que editar borraba las historias y la
   agenda, que el de edición no mandaba. Por eso hay un `AdForm` único que emite el
   anuncio COMPLETO mezclado sobre el original, no solo los campos tocados.
2. **Todo PUT vuelve a `PENDIENTE` + `activo=false`.** Editar un teléfono saca el anuncio
   del mural, y como el upgrade de plan es un PUT, **pagar Fichas también lo saca**. Se
   advierte en `EditAdModal` y en `UpgradeAdRankModal` antes de cobrar, y el panel pinta
   ese estado como "En revisión" (el `moderationStatus` sigue diciendo APROBADO: un sello
   verde con el texto "en revisión" es justo la contradicción que genera el ticket).
3. **`DELETE` es baja lógica y no marca nada.** Solo apaga `activo` y conserva el
   `moderationStatus`, así que el anuncio vuelve en `GET /anuncios/mios` idéntico a uno
   pendiente (los pendientes también vienen con `activo=false`). Sin marca local, borrar
   un anuncio pendiente lo hacía reaparecer al refrescar. Se resolvió con la llave
   `repuestop_ads_deleted`. **Es por navegador: la solución de fondo es del backend**
   (un estado propio, o excluirlos de `listarMios`). Anotado como pendiente.
4. **`hasOnlineBooking` sin `agendaConfig` da 400** y la agenda solo existe en el plan
   Empresarial. El formulario nunca lo enciende solo: el plan da el derecho y la agenda
   se configura en la fase C. `toAdRequestPayload()` lo apaga si no hay configuración.

**Otras decisiones:**

- **Las dos llaves de `localStorage` se unificaron**, como decía 4.6 que había que hacer
  al cerrar esta fase. `repuestop_classified_ads` quedó sin uso: no se borra desde el
  código porque son datos del usuario, pero nada la lee. Quien tuviera borradores locales
  del panel no los ve más — nunca existieron fuera de su navegador.
- **Publicar ahora cuesta Fichas**, con el mismo tarifario de `UPGRADE_TOKEN_COSTS`,
  homologado con `spendTokensForNewAd` del móvil. Antes se podía elegir Empresarial gratis
  al publicar y solo se cobraba al mejorar el rango, que es el agujero obvio.
- **Se retiraron los últimos datos falsos del módulo**: los seis `SAMPLE_PHOTO_PRESETS` de
  Unsplash de `CreateAdModal` (ahora se suben fotos de verdad a R2) y la foto de archivo
  que el panel usaba como miniatura de un anuncio sin imágenes.
- **Dos campos dejaron de deducirse de texto libre**: `priceType` era `priceText`
  conteniendo "cotiz" e `is24Hours` era `openingHours` conteniendo "24". Ahora son un
  radio y un checkbox, que es lo que el backend guarda y el mural filtra.
- El selector de planes del upgrade se arma con `getUpgradableTiers()`: antes eran tres
  tarjetas fijas que dejaban "mejorar" a un plan igual o inferior al que ya tenía.

**Verificación end to end contra el backend local**, con la sesión del usuario 5. Se creó
el anuncio **id 9** ("Mecánica express a domicilio (prueba fase B)") y con él se ejercieron
las cuatro escrituras:

| Paso | Resultado |
|---|---|
| Subida multipart | La foto quedó en `Publicidad/Usuario_5_Comprador_Elias/` y se sirve por el proxy (`/api/v1/uploads/r2/...`); la miniatura carga en el formulario |
| `POST` | id 9 nace `PENDIENTE` + `activo=false`, la imagen se guarda como ruta RELATIVA (`toMediaPath` funcionando), `whatsapp` null en plan básica, `priceValue` null en "a cotizar", `expiresAt` a 30 días |
| `PUT` (editar) | Cambió el teléfono y **conservó la foto y las etiquetas**, que es lo que el PUT completo tenía que evitar perder |
| `PUT` (subir de plan) | básica -> destacada, saldo 300 -> 250, transacción registrada, anuncio sigue `PENDIENTE` |
| `DELETE` | Sale del panel; el backend lo deja `PENDIENTE` + `activo=false` (o sea, idéntico a uno en revisión, tal como se esperaba) y la llave `repuestop_ads_deleted` impide que reaparezca al pulsar Actualizar |

También verificado en la UI: el tope de etiquetas del plan deshabilita el resto de los chips
al llegar a 2/2 (que es lo que evita el 400), "Mejorar plan" sale deshabilitado solo en el
anuncio empresarial, el plan básica no muestra la sección de Historias, y el upgrade ofrece
únicamente los planes por encima del actual.

**Un bug encontrado y corregido durante esta verificación**: el panel cerraba el modal al
publicar, así que la pantalla de "tu anuncio quedó en revisión" —justo donde se explica que
todavía no está en el mural— nunca alcanzaba a verse. Ahora el modal lo cierra el usuario.

**Estado en que quedó la base local**: el anuncio id 9 quedó dado de baja (`PENDIENTE`,
`activo=false`) y oculto por la llave local. Los cuatro anuncios de prueba (ids 5 a 8) no se
tocaron. El saldo de Fichas de ese navegador quedó en 250.

**Lo único no ejercido** es el cobro de Fichas al publicar (`spendTokensForNewAd`), porque la
prueba se hizo en plan básica, que cuesta 0. El débito en sí es el mismo código que ya se
verificó en el upgrade.

**Aprobación verificada.** Se aprobó el id 9 desde backoffice y el panel lo muestra
"Publicado" con sello verde, su foto y "Vence en 30 días"; el mural público pasó a cinco
anuncios. Con eso queda ejercido el camino completo de moderación salvo el rechazo, que es
lo único que falta ver con datos reales (el motivo de rechazo y su banda roja).

**Un hueco del parche local que apareció justo ahí, y ya está tapado.** El id 9 se había
dado de baja antes de aprobarlo, así que quedó en las dos listas a la vez: `activo=true` en
el backend y marcado como borrado en `repuestop_ads_deleted`. Resultado: visible en el mural
público e invisible para su propio dueño, que es peor que no haber ocultado nada. `approve`
hace `setActivo(true)` sin mirar si el anuncio venía dado de baja, así que la marca local
ahora solo vale mientras el anuncio siga apagado: si vuelve del backend con `activo=true`,
`fetchMyAds()` la descarta. Es un motivo más para el pendiente de darle a la baja lógica un
estado propio en el backend.

**Pendientes de esta fase:**

- Sigue en pie que el backend de anuncios solo existe en `dev` (sección 4.5): esta fase no
  cambia eso.
- Las Fichas siguen sin backend (fase D bloqueada): el saldo, el historial y el cobro son
  locales del navegador.


### 4.9 Rama de trabajo y cambios del backend del 2026-08-22

**El trabajo del mural va en `dev`, no en `main`.** `dev` es la rama que tiene ambiente
levantado (Vercel dev contra `api-dev.repuestop.cl`); produccion quedo con el backend
apagado, asi que un deploy a `main` no se puede probar. El historial venia al reves (main
como tronco y merges "traer main a dev"), y por eso la fase B se commiteo primero en `main`
(334386b) y despues se trajo a `dev` con un merge. De aqui en adelante: commitear en `dev`,
y recien llevar a `main` cuando el backend de anuncios llegue a produccion.

**Consecuencia a no olvidar:** `main` tiene la fase A y la B pero NO el fix de rutas de
imagen de mas abajo. Cuando se haga el merge `dev` -> `main`, va incluido.

**Tres cambios del backend (rama `dev` del monorepo) que tocan esta fase:**

1. `42d1be8` agrego `AnuncioService.normalizarRutaImagen()`: el backend ahora recorta el
   host de las URLs del proxy propio al guardar Y al responder, y la migracion
   `V2026082201__normalize_anuncio_image_paths.sql` arregla los registros viejos. Confirma
   que guardar la ruta relativa (lo que hace `toMediaPath()` en la web) es lo correcto; el
   cliente ya no es el unico que lo cuida.
2. Del mismo commit sale un fix real para la web: `resolveImageUri()` del movil ahora
   REARMA sobre el backend actual cualquier URL absoluta que apunte al proxy propio. La web
   no lo hacia — `resolveMediaUrl()` dejaba pasar todo lo que empezara con `http`, asi que
   una foto guardada por una build vieja apuntando a otro host se veia rota, y si el host
   era `http://`, bloqueada por contenido mixto. Ya esta portado, con el mismo criterio: se
   rearma solo lo que calza `https?://host/api/v1/uploads/...` y las URLs externas quedan
   intactas.
3. `selectManageableAds()` que agrego el movil NO hace falta en la web. Resuelve que la
   cache del dispositivo es del equipo y no de la sesion, y por eso puede tener avisos de
   otra cuenta; la web no cachea "mis anuncios" (`fetchMyAds()` solo lee del backend, que ya
   viene acotado al token), asi que el problema no existe aca. Si alguna vez se le agrega
   cache a esa lista, hay que traerse esta funcion.


### 4.10 Cabos sueltos de la fase B, cerrados — sesión 2026-08-22

**El rechazo, verificado con datos reales.** Se rechazó el id 9 a mano en la base local
(`UPDATE ... estado_moderacion='RECHAZADO'` con motivo, ver 4.7) y la tarjeta responde como
debía: sello rojo "Rechazado", el motivo textual dentro de la banda roja, el contador
"Rechazados" en 1 y la pestaña de filtro dejando solo ese anuncio. Además se comprobó el
ciclo que la propia tarjeta promete: **editar un anuncio rechazado lo devuelve a
`PENDIENTE` y borra el motivo**, así que la corrección vuelve a la cola sin pasos extra. El
anuncio quedó restaurado a `APROBADO`, igual que antes de la prueba.

**La baja lógica ahora tiene estado propio en el backend, y el parche de la web se fue.**
`AnuncioService.eliminar()` marca `moderationStatus = "ELIMINADO"` además de apagar
`activo`, y ese estado se excluye de `listarMios()` y de `listarTodosAdmin()`. La fila se
conserva para auditoría; lo que cambia es que deja de aparecer en todas las listas.

Por qué hacía falta, y por qué también en la cola del backoffice: la baja solo apagaba
`activo`, y como los anuncios en revisión también vienen con `activo=false`, el dado de baja
volvía en `/anuncios/mios` indistinguible de uno pendiente. Peor: seguía en la cola de
moderación y aprobarlo lo revivía — pasó de verdad en esta sesión con el id 9, que quedó
visible en el mural público e invisible para su dueño.

Con eso, `fetchMyAds()` de la web volvió a ser una línea: la llave `repuestop_ads_deleted`
y sus dos helpers se eliminaron. La llave vieja se deja en los navegadores que la tengan
(son datos del usuario, aunque ya nadie los lea).

**Orden de despliegue, importante:** el backend `dev` tiene que subir ANTES que la web
`dev`. Si sube primero la web, dar de baja un anuncio pendiente vuelve a hacerlo reaparecer
al refrescar, porque el backend viejo lo sigue devolviendo. No es grave ni permanente, pero
conviene evitarlo.

**Verificado en vivo con el backend reiniciado.** Se creó el anuncio de descarte id 10 en
estado PENDIENTE —el caso exacto que el parche tapaba— y se dio de baja desde el botón del
panel: el backend lo dejó `ELIMINADO` + `activo=false`, dejó de venir en `/anuncios/mios`,
no reapareció al pulsar Actualizar y la llave `repuestop_ads_deleted` siguió vacía, o sea
que ya nadie la escribe. El mural público no se movió. En la base local queda el id 10 como
ELIMINADO; no estorba, justamente porque no aparece en ninguna lista.

La exclusión de la cola del backoffice (`listarTodosAdmin()`) no se pudo ver desde la web
—esa ruta exige rol de backoffice— así que quedó cubierta con su propio test
(`elAnuncioDadoDeBajaTampocoLlegaALaColaDelBackoffice`). Son 5 tests en verde y
`mvn package -DskipTests` pasa.


### 4.11 Fase C — agendamiento (lo que sigue)

**Por qué es lo que sigue.** El plan Empresarial cobra 250 Fichas por la agenda en línea y
hoy la web no la puede entregar: `hasOnlineBooking` solo se acepta con un `agendaConfig`
válido (`AnuncioService.validar()`), y no hay ninguna UI para armarlo, así que
`toAdRequestPayload()` lo manda siempre apagado. Y del lado del visitante,
`AdAppointmentModal.jsx` es un formulario que **no llama a nada**: no tiene ni backend ni
`localStorage`. Reservar una hora en la web hoy no guarda nada.

**Endpoints** (todos bajo `/api/v1/anuncios/agendamientos`):

```
POST   /anuncios/{anuncioId}     reservar hora (visitante)
GET    /anuncios/{anuncioId}     reservas de un anuncio (dueño)
GET    /mias                     mis reservas (visitante)
PATCH  /{id}/estado              confirmar / rechazar / cancelar
POST   /notificaciones           recordatorios
```

`AnuncioAgendamientoService` (backend, rama `dev`) creció bastante en `9f6eae3` y `42d1be8`;
conviene leerlo antes de asumir el contrato.

**Referencia del móvil, que ya tiene el flujo completo y recién lo terminó** (commits
`9f6eae3` y `42d1be8` del monorepo):

- `mobile/components/ads/AgendaConfigModal.tsx` y `AgendaConfigsSection.tsx` — armar la agenda.
- `mobile/components/ads/AppointmentsCalendarModal.tsx` — el calendario del dueño (es grande).
- `mobile/components/ads/AdAppointmentModal.tsx` y `AppointmentSummaryPopup.tsx` — reservar.
- `mobile/app/appointments-history.tsx` — historial.
- `mobile/services/ads-storage.ts` — `getStoredAppointments`, `getAppointmentsForAd`,
  `createAppointmentInStorage`, `updateAppointmentStatus`.

**Forma de `agendaConfig`**, tal como la valida el backend: `startDay` y `endDay` (0-6),
`slotMinutes` (15-120), `defaultHours` `{start,end}`, `sameHoursEveryDay`, `customHours` por
día cuando es false, `breakEnabled` + `breakHours`, y `closedDays` (lista de 0-6). Cualquier
cosa fuera de eso responde 400 con "La configuración de agenda no es válida". El anuncio de
prueba **id 8 ya tiene un `agendaConfig` completo** para copiar la forma exacta.

**Dónde entra en la web:**

- `AdForm.jsx` — bloque de agenda, visible solo en plan Empresarial, que es lo que permite
  encender `hasOnlineBooking`. Hoy `toAdRequestPayload()` lo apaga si no hay configuración:
  esa regla se queda, lo que cambia es que ahora habrá configuración.
- `AdAppointmentModal.jsx` — conectarlo al POST.
- `AdsManagementSection.jsx` — las reservas recibidas, por anuncio.
- `automotiveAdsData.js` — `CLOSED_APPOINTMENT_STATUSES` e `isClosedAppointment` ya están
  portados de la fase A, esperando esta fase.
- `adsStorage.js` y `adapters.js` — mismo patrón que la fase B: las llamadas en `api.js`, el
  adaptador en `adapters.js`, y nada de `localStorage`.

**Recordar:** se trabaja en `dev` (sección 4.9), y `npm run build` + `npm run lint` antes de
commitear.


### 4.12 Fase C cerrada — sesión 2026-08-23

El agendamiento está completo y verificado contra el backend local. Los cinco endpoints de
`/anuncios/agendamientos` se consumen desde la web; nada quedó en `localStorage`.

**Archivos nuevos**

- `src/data/agendaConfig.js` — port de `mobile/constants/agenda-config.ts`. Es el archivo
  que hay que cuidar: su generación de bloques tiene que coincidir EXACTO con
  `validarBloque()` de `AnuncioAgendamientoService`, o la web ofrece horarios que el POST
  rechaza con 400 después de llenar todo el formulario.
- `src/components/ads/AgendaScheduleEditor.jsx` — editor del horario, con vista previa de la
  semana y de los bloques del primer día hábil.
- `src/components/ads/AdAgendaModal.jsx` — la agenda de un anuncio vista por su dueño.

**Decisiones que conviene no volver a discutir**

1. **La agenda vive dentro del anuncio, no en una librería aparte.** El móvil tiene agendas
   con nombre reutilizables entre avisos, pero las guarda en AsyncStorage del dispositivo
   (`services/agenda-configs-storage.ts`): no hay endpoint de agendas. Replicarlo en la web
   era volver a `localStorage`, justo lo que la fase B sacó. Lo único que se persiste es el
   `agendaConfig` del anuncio, que es lo que el backend guarda igual.

2. **La web siempre emite un `agendaConfigId`, aunque no tenga librería de agendas.** El
   `AdAppointmentModal` del móvil descarta la agenda si ese campo viene vacío (sale temprano
   antes de mirar `adOrCompany.agendaConfig`), así que un aviso publicado desde la web con la
   agenda completa pero sin id se veía SIN días disponibles en la app. El backend no valida
   ese campo, o sea que aceptaba el anuncio roto. Se genera `web-agc-<timestamp>-<rand>` en
   `AdForm`. **Si alguna vez se saca, se rompe la web -> app.**

3. **`GET /anuncios/agendamientos/anuncios/{id}` sirve para las dos cosas.** Al dueño le
   devuelve su agenda completa; a cualquier otra sesión, solo los bloques futuros ocupados y
   con los datos del cliente censurados. Por eso el modal de reserva tacha los horarios
   tomados sin endpoint de disponibilidad aparte. Y `GET /mias` devuelve en UNA respuesta las
   reservas de los dos roles (`findRelevantes()`), así que `AdsManagementSection` hace una
   sola llamada y separa por `customerUserId`.

4. **El correo del cliente no se pide.** `crear()` hace `setClienteEmail(user.getEmail())` e
   ignora lo que venga en el request. El campo se muestra en solo lectura con el correo de la
   sesión; un input editable era un dato que no se usa. Por lo mismo el modal exige sesión
   iniciada y bloquea el anuncio propio ANTES de mostrar el formulario: las tres cosas
   terminan en un error del backend recién al confirmar.

5. **Los avisos van con `Promise.allSettled` y sin `await`.** Son tres: el correo a cliente y
   taller (`/anuncios/agendamientos/notificaciones`) y las notificaciones in-app al cliente y
   al proveedor. La reserva ya está guardada cuando se disparan; un fallo de correo no puede
   verse como una reserva fallida.

**Verificado en vivo (backend local, usuario 4 como visitante sobre el anuncio 8)**

- Publicación de un anuncio Empresarial con agenda desde la web -> id 11 en la base con
  `agenda_config_id = web-agc-1787494131832-592` y el `agenda_config` con la forma exacta que
  valida el backend. Es la prueba del punto 2.
- El `agendaConfig` del id 8 —que la web no creó— maneja bien la tira de fechas (salta
  domingo y lunes) y los bloques (salta la colación 13:00-14:00). Dirección app -> web.
- Reserva creada (id 1), con las dos notificaciones: la in-app al cliente y los DOS correos
  salieron de verdad por Resend (log del backend). La notificación in-app al proveedor se
  salta cuando el anuncio no tiene `proveedor_id` —el caso del id 8—, igual que en el móvil.
- Aceptar desde la agenda del dueño: la reserva 2 quedó `accepted` y los botones desaparecen.
- Cancelar desde "Mis reservas": la reserva 1 quedó `cancelled` y **el bloque de las 10:00
  volvió a aparecer** en el modal de reserva. Reservar las 09:00 lo hizo desaparecer. Es la
  constante `OCUPADOS` del backend (`pending` + `accepted`) funcionando de punta a punta.

**Un bug de CSS que se introdujo y se corrigió en la misma sesión:** la tira de fechas
scrollea sola, pero una pista de grid se dimensiona por su contenido más ancho, así que
estiraba `.booking-form-grid` a 1462px y sacaba una barra horizontal en toda la tarjeta del
modal. Se arregló con `minmax(0, 1fr)` en las dos declaraciones de la grilla. Si se agrega
otro hijo que scrollee horizontalmente, es el mismo patrón.

**Datos de prueba que quedan en la base LOCAL** (además de los de 4.7):

| fila | qué es |
|---|---|
| anuncio 11 | Empresarial del usuario 4, con agenda creada desde la web, APROBADO a mano |
| agendamiento 1 | anuncio 8, cliente 4, `cancelled` — sirve para ver una cita cerrada |
| agendamiento 2 | anuncio 11, cliente 5, `accepted` — insertado por SQL, es la única forma de probar la vista del dueño sin la sesión del usuario 5 |
| agendamiento 3 | anuncio 8, cliente 4, `pending` — ocupa el bloque de las 09:00 del 2026-08-25 |

**Lo que NO se pudo verificar y por qué:** la censura de datos a un tercero
(`listarPorAnuncio` con `redact`) necesita una reserva de un usuario distinto sobre un
anuncio ajeno, y en local solo hay dos cuentas con anuncios. Es comportamiento del backend,
no de la web, y tiene su propio test allá.

**El baseline de lint de este archivo y de CLAUDE.md estaba desactualizado.** `npm run lint`
daba **114** warnings antes de tocar nada, no 145. Después de la fase C son **107**: bajó
porque el `AdAppointmentModal` viejo tenía imports muertos. Cero warnings en los archivos
nuevos.

**Lo que sigue:** la fase D (Fichas) sigue BLOQUEADA por el backend, sin endpoint de saldo ni
de consumo. Y queda el hueco heredado: el plan Empresarial cobra 250 Fichas contra un
monedero que solo existe en `localStorage`.


### 4.13 Fase D cerrada — sesión 2026-08-23

**Las cuatro fases del mural están cerradas.** La D dejó de estar bloqueada: el
backend ganó un monedero real y los dos clientes se re-apuntaron a él.

#### Lo que faltaba, y por qué era grave

Lo único que existía era `RT_compra_ficha`: el registro contable de una compra ya
pagada, para el tab "Publicidad" de Administración Contable. Eso no es un
monedero — sabe cuántas Fichas se compraron y nunca cuántas se gastaron. El saldo
vivía en `localStorage` (web) y `AsyncStorage` (móvil), y **el bono de bienvenida
de 300 Fichas se otorgaba ahí mismo**, así que vaciar el navegador o reinstalar la
app lo reponía. Publicar un aviso Empresarial cuesta 250.

Además la web **nunca llamaba a `POST /fichas/compras`** —solo lo hacía el móvil—,
así que toda recarga hecha desde el navegador quedaba fuera de la contabilidad
además de no acreditar nada.

#### Backend (monorepo `dev`, commit `4e73881`)

- `RT_movimiento_ficha`, append-only. El saldo es la SUMA de las filas, nunca una
  columna guardada: no hay dos números que puedan discrepar. Los `CHECK` rechazan
  cantidad negativa o tipo inventado.
- `GET /fichas/saldo` y `GET /fichas/movimientos`. Exponen además el tarifario,
  para que los clientes dejen de replicarlo a mano.
- **No hay endpoint de consumo, a propósito.** El cobro vive dentro de
  `AnuncioService.crear()` y `actualizar()`, en la misma transacción que el
  anuncio: el cliente queda fuera del camino de la plata, no puede publicar sin
  pagar, y si el saldo no alcanza la excepción deshace también el anuncio. Resulta
  idempotente por el ESTADO y no por una llave — un reintento o crea otro anuncio
  (y debe cobrar) o encuentra el tier ya aplicado (y cobra cero).
- `actualizar()` lee el tier ANTES de `aplicar()`, que lo pisa, y solo cobra si el
  plan SUBE. Corre en cada edición: sin esa comparación, corregir un teléfono
  costaría 250 Fichas. Se cobra el precio completo del plan de destino, no la
  diferencia — es lo que ya hacían los clientes; cambiarlo es decisión de producto.
- `registrarCompra()` ahora acredita, y la migración trae backfill de las compras
  ya pagadas.
- El bono se otorga del lado del servidor la primera vez que la cuenta toca su
  monedero, idempotente por `event_key`. **No se backfillea**: hacerlo masivo
  obligaría a adivinar cuánto había gastado cada usuario en su dispositivo, que es
  justo el dato que nunca existió en el servidor.

#### Clientes

- Móvil (`41ed844`): saldo e historial del backend; `spendTokensForNewAd` y
  `spendTokensForAdUpgrade` dejaron de cobrar; **se eliminaron `setTokensBalance` y
  `addTokenTransaction`** (una función pública para fijarse el propio saldo era el
  agujero). AsyncStorage queda como copia de solo lectura del último saldo.
- Web (`a28e3f0`): lo mismo, más el `POST /fichas/compras` que faltaba y un
  `TokensHistoryModal` nuevo — el botón "Historial" existía en `TokensWalletCard`
  pero nadie le pasaba el handler.

#### Verificado en local, contra el backend real

Bono otorgado una sola vez en tres consultas; Empresarial 300 → 50; edición sin
cambio de plan 50 → 50; publicación sin saldo **422 con el anuncio deshecho**
(confirmado por SQL, no solo por la respuesta); compra de 275 → 325 y sin duplicar
al reintentar la misma referencia; upgrade a Destacada 325 → 275; bajar de plan
275 → 275. La recarga desde la web quedó como `PUB-000002` con referencia `WEB-*`
y acreditada. 380 tests con el baseline intacto de 14 fallos preexistentes.

**La migración se aplicó a mano en local** porque el perfil `local` usa
`ddl-auto=update` y NO ejecuta Flyway; el perfil `prod` sí, y es el que corre en
Railway en los dos ambientes.


### 4.14 Estado del despliegue — 2026-08-23

**El backend de anuncios y fichas ya está en `api-dev.repuestop.cl`.** Verificado:
`/anuncios` responde 200 y `/fichas/saldo` y `/fichas/movimientos` responden 401
—existen y piden sesión— en vez de 404. Como Flyway corre al arrancar con el
perfil `prod`, que el servicio esté arriba significa que `V2026082304` se aplicó.

**La APK nueva ya está generada** con el móvil re-apuntado al monedero del backend.

Con eso el orden de despliegue quedó respetado (backend → clientes) y **las pruebas
manuales ya se pueden hacer contra un ambiente real**. La lista está al final de
esta sección.

**Producción sigue sin el backend de anuncios.** El merge `dev` → `main` del
monorepo es lo que lo habilita; hasta entonces `repuestop.cl` muestra el mural en
estado de error, que es lo esperado.

#### Pruebas pendientes de hacer en dev

Web: 1) borrar `repuestop_fichas_balance` de localStorage y recargar — el saldo
debe volver igual, antes volvían 300; 2) el historial debe cuadrar con el saldo;
3) una recarga debe aparecer en el tab Publicidad del backoffice —esa era la parte
rota—; 4) publicar Empresarial descuenta 250; 5) **editar sin cambiar de plan NO
descuenta**; 6) subir de Básica a Destacada descuenta 50; 7) con saldo bajo, los
planes caros salen bloqueados.

App: 8) **la misma cuenta debe mostrar el MISMO saldo que la web** — es la prueba
que más importa, antes cada dispositivo tenía su propio número; 9) reinstalar no
repone Fichas; 10) publicar desde la app se refleja en la web; 11) sin conexión
muestra el último saldo conocido; 12) recargar sin red avisa que no se pudo
confirmar, no muestra éxito.

Mural: 13) aviso con agenda publicado desde la WEB debe mostrar días disponibles en
la APP (era el bug de `agendaConfigId`); 14) al revés; 15) reservar desde una
cuenta y aceptar desde la otra, con los dos correos.


### 4.15 Formulario de publicación y gestión — sesión 2026-08-23

Cinco commits en la web (`96d37af`, `a28e3f0`, `a3499d1`, `6970714`, `7c7efb6`,
`e38b615`). Lo que conviene no volver a introducir:

- **`.ads-management-panel` anulaba el padding de `.profile-panel`** con `0`
  horizontal y era el único panel del perfil que lo hacía: todo iba de borde a
  borde. Ahora lo hereda.
- **El monedero era una tarjeta con degradado + brillo radial + `backdrop-filter`**,
  tres recursos que no existen en ninguna otra vista. Es una barra plana `#0f172a`.
- **Región era un `<input>` de texto libre y la comuna una lista fija de 18** que
  mezclaba Providencia con Viña, Concepción, Antofagasta y Temuco. Ahora salen del
  catálogo real y la comuna depende de la región. El anuncio guarda NOMBRES, así
  que el catálogo se usa para elegir bien y se envía el nombre resuelto.
- **El plan se pintaba encima de la miniatura** reusando `AD_TIERS[x].badge`, que
  está escrito para la tarjeta del mural: "Empresarial Verificado" son 24
  caracteres y sobre 90x70px se partía en tres líneas tapando el 64% de la foto.
  Ahora usa `name` en la fila de datos. **`badge` sigue en uso en `AdCard`**.
- **Teléfono y WhatsApp aceptaban letras y símbolos.** El `+56` es parte del campo
  y solo se escriben los 9 dígitos, igual que el móvil.
- **El precio de referencia no tenía tope**: `Number()` pierde precisión pasando
  los 16 dígitos y el backend recibe un `Long` que se desborda a los 19. Queda en 9
  dígitos; el texto de cotización en 80 y la descripción en 500. Los topes del
  backend NO se tocaron: un cliente más estricto es seguro y bajarlos allá
  obligaría a migrar avisos existentes.
- `src/data/openingHours.js` es un port de `mobile/hooks/auth/useScheduleField.ts`
  y **replica el FORMATO exacto** ("Lun a Vie 09:00 a 18:00"): `Proveedor.hours` es
  una cadena suelta que comparten las tres plataformas. Vive en `src/data/` porque
  lo usan el formulario de anuncios Y el registro de `/vender`.
- Al encender las reservas **la agenda se siembra con el horario declarado**. El
  aviso pide dos horarios sin obligar a que calcen: se podía publicar "Lun a Sáb
  09:00 a 20:00" con una agenda que solo ofrecía Mar a Vie hasta las 18:00.

**Bug de `/vender` corregido.** Entrar directo mostraba el registro SIN estilos y
bastaba pasar antes por `/nosotros`: las 218 reglas `founder-*` viven en
`about-repuestop.css`, que solo importaba `AboutRepuesTopPage`, y como las rutas
van en chunks perezosos esa hoja nunca se inyectaba. Ahora la importa el componente
que la necesita.

**El registro de `/vender` ya captura el horario.** `SellerRegistrationPayload` ya
tenía `hours?` y el backend lo persiste, pero la web nunca lo llenaba: una tienda
registrada desde el sitio quedaba sin horario y la registrada desde el celular sí
lo traía.

#### Pendientes que quedaron anotados

- **El filtro del mural** (`AdsFilterSidebar`) sigue con `CHILE_COMMUNES`, las 18
  mezcladas. Es su último uso. Ahí el catálogo completo sería peor (346 comunas en
  un desplegable); lo razonable es listar solo las que tienen anuncios, pero eso
  cambia el comportamiento del mural.
- **El horario y la agenda se siembran uno del otro pero no se resincronizan.** Si
  se edita el horario sin tocar la agenda, vuelven a poder separarse. Cerrarlo del
  todo sería derivar `openingHours` de la agenda cuando hay reservas encendidas.
- **Dos tests del móvil en rojo, previos a esta sesión**:
  `components/ads/__tests__/ads-flow.test.tsx` tiene un mock de anuncios escrito
  para el modelo local que no guarda el id que devuelve el backend, así que
  `getStoredAds()` no encuentra nada. No tiene que ver con Fichas.


### 4.16 Moneda RepuesTop y arrastre de `fae41ed` — sesión 2026-08-24

**El detalle técnico completo está en `PLAN_MONEDA_REPUESTOP.md`**, que es la
libreta de esta migración: qué trae el commit del monorepo, qué se portó, qué NO
y por qué. Acá va solo lo que conviene saber sin abrir ese archivo.

Nueve fases cerradas en la web (`ee989dc`, `b772440`, `e235d4e`, `5e7fdb6`,
`02d4eab`, `f9b754c`, `7803441`, `e069706`, `a0823ad`, `04441ad`) y dos commits
de backend en el monorepo (`8166ea8`, `61989c8`).

#### Lo que cambió de cara al usuario

- **"Ficha" pasó a llamarse "Moneda RepuesTop"** en todo el texto visible. Por
  dentro NO cambió nada: endpoints `/fichas/*`, `cantidadFichas`,
  `RT_movimiento_ficha` y la llave `repuestop_fichas_balance` siguen igual.
  Renombrarlos rompe el contrato y le borra el saldo cacheado a quien la tenga.
- La moneda ahora se **dibuja** (`RepuestopCoin.jsx`, SVG con dos caras), igual
  que en la app. El monedero volvió a ser **tarjeta con degradado azul**, lo que
  revierte a propósito el aplanado de la §4.15: la decisión nueva es que se vea
  igual que en la app.
- Recarga con lluvia de monedas, historial con detalle por movimiento, y
  "Activar mejoras" tras subir de plan (lleva al formulario y marca `NUEVO` lo
  que se acaba de desbloquear).
- **Registro de compradores con Google** en la web, que antes solo iniciaba
  sesión.

#### Tres bugs de plata o de datos que aparecieron de paso

1. **`Pack Avanzado` con `priceClp: 19900`** mientras se mostraba y cobraba
   `$19.990`. Ese campo es el `montoPagado` de `POST /fichas/compras`, así que
   cada pack vendido desde la web entraba a Administración Contable con **$90
   menos**. El móvil siempre tuvo 19990. **Las compras ya registradas con el
   monto viejo quedaron así**: si importa, se corrige en la base.
2. **La cotización reemitida nacía vencida**: la web contaba la vigencia desde
   `createdAt`, que es inmutable. Ahora usa `vigenteDesde`.
3. **El teléfono se guardaba como `""`**, con lo que "no tiene teléfono" dejaba
   de ser distinguible. Se normaliza a nulo en el origen.

#### Sobre el teléfono, que quedó mal documentado en su momento

`PerfilUsuarioDTO` ahora expone `phone` (sale de `Usuario.telefono`, que es el
dato vivo; `Proveedor.telefonoContacto` solo se llena al registrar la tienda).

Pero **la web ya podía saberlo antes**: viene en `usuario.telefono` de la
respuesta de login (`UsuarioDTO`), que es de donde lo lee la app
(`auth-registration.ts:178`). Si se quiere exigir teléfono antes de comprar, va
`user.phone ?? user.telefono`. La app no necesita cambios: lee el teléfono del
login y al editarlo descarta el cuerpo de la respuesta del PATCH.

#### Lo que NO se hizo, a propósito

- **No hay guarda de teléfono en el checkout.** Se implementó y se descartó al
  probarla. La dirección sí está cubierta: el paso de entrega no deja avanzar sin
  una de la libreta.
- **El historial no muestra "Monto pagado" ni "Total pagado".**
  `MovimientoFichaDTO` no trae el monto en pesos; en la app salen de un campo que
  nadie llena y muestran $0 siempre.
- **El troquel de la moneda dice "FICHA"**, no "MONEDA". Es deliberado: prima que
  la pieza sea idéntica en las dos plataformas. Si se cambia, se cambia en ambas.

#### Estado de despliegue

Monorepo `dev` empujado hasta `61989c8`. **La web quedó commiteada pero NO
empujada**: el orden es backend primero.

#### Probado contra el backend local

Mejora de plan de punta a punta (Básica → Destacada, saldo 300 → 250 cobrado por
el backend), historial con su detalle, recarga con la lluvia, bloqueo de
auto-compra, y el alta con Google dos veces
(`/auth/google` 404 → `/auth/register/buyer` 200 → `/auth/google` 200).

---

### 4.17 Pasada de pruebas de flujo — sesión 2026-08-24

Recorrido en el navegador sobre el backend local, con los arreglos que fue
dejando. Lo que sigue es solo lo que no se deduce del diff.

#### Pedido pendiente: lo que se cerró y lo que falta

La web **no tenía ninguna forma de pagar un pedido que quedara en `PENDIENTE`**.
`urlPago` existía en un solo lugar del código (el checkout) y el banner de pago
fallido mandaba al comprador al detalle del pedido a "reintentar el pago", donde
no había con qué. Se agregó "Retomar pago" contra
`POST /usuarios/{id}/pedidos/{pedidoId}/reintentar-pago`, que el backend ya
exponía y la app ya consumía.

El caso grave eran los pedidos del **carrito**: la idempotencia que renueva el
`urlPago` vive en `PedidoCheckoutCotizacionSupport` y cuelga de `conversacion_id`
(UNIQUE desde `V2026072801`), así que solo cubre a las cotizaciones. Un pedido de
carrito en `PENDIENTE` quedaba impagable hasta expirar.

**No se portó el sondeo del móvil** (60 llamadas a `confirmar-pago` cada 2 s): en
la app Flow se abre incrustado y la pantalla sobrevive; en la web la página se va
entera y vuelve con el resultado en `?status=...&orderId=...`, donde basta una
sola llamada.

#### Motivo de cancelación del pedido — CERRADO (monorepo `19a6a06`)

`PedidoResponseDTO` **no expone por qué se canceló un pedido**. El único campo es
`cancelacionPorBloqueoVendedor`. Para el comprador, un pedido cancelado porque no
alcanzó a pagar dentro de la ventana de 30 minutos se ve EXACTAMENTE IGUAL que uno
cancelado por el vendedor o por un reembolso: dice "Cancelado" y nada más.

Inferirlo en el cliente sería adivinar, así que la web no podía arreglarlo sola.

**Se implementó en la misma sesión.** `Pedido` guarda `motivoCancelacion` y
`canceladoPor` como enums, más `detalleCancelacion` (solo para `OTRO`) y
`canceladoEn` — aparte de `updatedAt`, que se pisa en cada `@PreUpdate` y además
es el reloj de la ventana de pago. Los cuatro caminos que cancelaban un pedido
pasan por `Pedido.marcarCancelado()`, para que ninguno pueda dejar el estado sin
su motivo. La web lo traduce en `src/data/cancellationReason.js`.

**Se guarda el CÓDIGO, no la etiqueta.** El nivel ítem ya tenía la taxonomía pero
`PedidoCancelacionSupport` persistía el texto renderizado y tiraba el código. Se
corrigió: `motivo_cancelacion` quedó deprecada y la verdad vive en
`motivo_cancelacion_codigo`. **El DTO sigue devolviendo la misma etiqueta de
siempre** en `motivoCancelacion`, ahora derivada, porque la APK en producción la
muestra tal cual y el código en crudo le pondría "SIN_STOCK" al comprador.

Dos cosas que casi se rompen y conviene no repetir:

- `LiquidacionPedidoCalculator.cancellationTooltip()` leía la columna de texto
  para la glosa de Administración Contable. Al dejar de escribirse, toda
  cancelación nueva habría quedado **sin motivo en la liquidación**. Ahora deriva
  del código.
- `PedidoServiceTest` afirmaba el texto guardado. Como `-DskipTests` compila pero
  no ejecuta, el build pasaba igual: habría sido un fallo 15 sumado a los 14
  preexistentes.

**Los cuatro caminos quedaron ejercitados.** El del vendedor con el pedido #13
(`SIN_STOCK` / `VENDEDOR`, ítem con el código y la etiqueta legada intacta), y el
del job con el #14 (`EXPIRACION_PAGO` / `SISTEMA`, con el `canceladoEn` coincidiendo
al milisegundo con la línea del log). En pantalla conviven los dos motivos junto a
los cancelados históricos, que siguen sin motivo.

No se pudo ejercitar la glosa contable: esos endpoints exigen rol de backoffice
desde SEC-BACKEND-014.

**El ítem que quedaba `ACTIVO` al expirar quedó corregido** (monorepo `91e280d`).
`expirarPedidosVencidos()` marcaba el pedido y restauraba el stock pero no tocaba
los ítems, y `LiquidacionPedidoCalculator.itemsActivos()` los contaba como vivos
en la liquidación. Ahora pasan a `CANCELADO_EXPIRACION_PAGO`, un estado propio:
usar `CANCELADO_VENDEDOR` le habría ensuciado las métricas al vendedor por algo
que no decidió. Solo se tocan los ítems en `ACTIVO`, para no pisar los que otro
vendedor ya había cancelado en un pedido multi-tienda.

Ese estado es nuevo y **la APK desplegada no lo conoce**: su `isCancelled` compara
contra `CANCELADO_VENDEDOR` y `CANCELADO_BLOQUEO_VENDEDOR`
(`mobile/components/order-detail/order-detail-parts.tsx`), así que la fila del ítem
no se verá tachada. Es cosmético —el pedido ya sale cancelado a nivel cabecera— y
se corrige cuando el móvil sume el valor. La web no lee el estado del ítem.

**Sigue pendiente publicar los minutos de la ventana de pago.**
`PAYMENT_WINDOW_MINUTES` en `src/data/orderStatusFlow.js` es un **espejo** de
`repuestop.pedido.expiracion.minutos` del `application.properties`, que no se
expone por API. Si allá cambia, el contador de la web miente.

#### Lo que se revisó y resultó estar bien

- **Volver a pagar una cotización cuyo pedido se canceló está correcto.** Los 30
  minutos son una ventana de reserva de stock, no una prohibición de comprar: al
  expirar se restaura el stock y `PedidoCheckoutCotizacionSupport` suelta el
  `conversacion_id` para permitir un pedido nuevo. La cotización sigue vigente por
  su cuenta. Calza con la práctica del rubro.
- **No hay pedidos duplicados** al reentrar al checkout de una cotización: el
  backend es idempotente y devuelve el mismo pedido con un `urlPago` fresco.
- **La app no tiene ninguna guarda propia** en `checkoutQuote()`; toda la
  protección vive en el backend.

---

### 4.18 Cancelación de pedidos y Flyway en local — sesión 2026-08-25

#### El comprador ya puede cancelar su pedido no pagado

**El botón "Cancelar pedido" de la app móvil nunca funcionó.** Llama a la
transición genérica `PUT /pedidos/{id}/estado` a `CANCELADO`, y
`validarAvanceControlado` solo le permitía al comprador `ENVIADO→ENTREGADO` y
`ENTREGADO→FINALIZADO`. Cada intento moría en `InvalidStateTransitionException` y
el usuario veía "No se pudo cancelar el pedido", que parece un problema de red. La
UI del móvil y la regla del backend llevaban tiempo contradiciéndose.

Ahora se permite `PENDIENTE → CANCELADO` pedido por el propio comprador
(monorepo `94602b6`), la app reconoce los estados nuevos (`9ee2727`) y la web
estrena el botón, que no existía (`f6dc87d`, `373c6e7`, `b6f2fc3`).

**El corte en `PENDIENTE` es deliberado**: cancelar un `PAGADO` exige devolver la
plata y ese pipeline vive en `PedidoCancelacionSupport`. Hay un test que fija esa
frontera.

**La cancelación relee el pedido con `SELECT ... FOR UPDATE`.** Es la única
transición que compite con la pasarela: si el webhook de Flow confirma el pago en
el mismo instante, el pedido quedaría `CANCELADO` con el cobro capturado. El lock
va solo en ese camino.

#### Los cuatro estados de ítem cancelado

`ACTIVO`, `CANCELADO_VENDEDOR`, `CANCELADO_BLOQUEO_VENDEDOR`,
`CANCELADO_EXPIRACION_PAGO` y `CANCELADO_COMPRADOR`. Se espejan en **tres**
lugares y hay que tocarlos juntos:

- `PedidoService.ITEM_ESTADO_*` (backend, fuente de verdad),
- `LiquidacionPedidoCalculator.itemsActivos()` — **si un estado cancelado no se
  excluye ahí, esos ítems entran a la liquidación como si estuvieran vivos**,
- `CANCELLED_ITEM_STATUSES` en `mobile/components/order-detail/order-detail-parts.tsx`.

Y las etiquetas del enum de motivo van en `src/data/cancellationReason.js` de la
web. Agregar un valor al enum del backend y olvidar ese diccionario deja el motivo
en blanco sin ningún error: pasó con `SOLICITUD_DEL_COMPRADOR`.

#### FLYWAY: ojo, esto cambia cómo se prueban las migraciones

**Hasta esta sesión Flyway estaba APAGADO en local** (`spring.flyway.enabled=false`
en `application-dev.properties`, y el perfil local es `dev,local`). El esquema
local lo construía entero Hibernate con `ddl-auto=update` desde las entidades, así
que **ninguna migración se ejecutaba nunca antes de desplegar**. Una migración con
los identificadores entre comillas se dio por validada porque el backend arrancó,
cuando en realidad Flyway ni la miró.

Ya está encendido en `application-local.properties` (monorepo `42eb796`), con
`baseline-version=2026082304` porque la base ya tenía el esquema hecho y no tenía
`flyway_schema_history`. El baseline solo aplica a un esquema no vacío sin
historial: sobre una base nueva Flyway lo ignora y corre todo en orden.

**Los backfills de las migraciones anteriores nunca corrieron en local** y no van a
correr. En producción sí.

#### TRAMPA ABIERTA: `ddl-auto=update` y los CHECK de los enums

Con `ddl-auto=update`, Hibernate crea un `CHECK` por cada columna
`@Enumerated(STRING)` **con los valores que el enum tenía al crear la columna**, y
después NUNCA lo actualiza. Al sumar `COMPRADOR` a `OrigenCancelacionPedido`, el
INSERT reventaba con `viola la restricción check rt_pedido_cancelado_por_check` y
la API respondía **503**. Falla en runtime y lejos del enum que se cambió.

`V2026082501` suelta esos checks recorriendo `pg_constraint` (el nombre lo elige
Hibernate y cambia entre versiones), pero **no cierra la trampa**: Flyway corre
antes del schema update, Hibernate puede recrear el check con los valores del
momento, y el próximo valor que se agregue vuelve a romperlo.

**El arreglo de fondo es `spring.jpa.hibernate.ddl-auto=validate` con Flyway como
dueño del esquema.** Hoy los tres perfiles usan `update`, incluido prod por
variable de entorno. Es decisión de infraestructura y quedó sin tomar.

#### Lo que sigue faltando

- **La web no tiene la cancelación del VENDEDOR.** El endpoint
  `POST /proveedores/{id}/pedidos/{id}/cancelacion` existe y la app lo usa, pero un
  grep por "cancelacion" en todo `src/` de la web no devuelve nada.
- El motivo de cancelación **no se muestra en la app**, solo en la web.
- Los minutos de la ventana de pago siguen sin exponerse por API:
  `PAYMENT_WINDOW_MINUTES` en `src/data/orderStatusFlow.js` espeja
  `repuestop.pedido.expiracion.minutos`.

---

### 4.19 Paridad app ↔ web: fases aplicadas y primeras pruebas — sesión 2026-08-25

El plan completo está en `PLAN_PARIDAD_APP_WEB.md`. Se auditó comparando por **endpoint
del backend**, no por pantallas: para cada capacidad se preguntó quién la consume (app /
web / nadie). Eso evita los falsos negativos de comparar vistas, que es como se había
mirado antes.

Las 7 fases están aplicadas. De las pruebas alcanzaron a cerrarse **cinco**, todas
contra el **backend local** (`localhost:8080`, perfil `dev,local`), no contra `api-dev`:

1. A23 — fotos existentes al editar un producto (verificada también en R2)
2. A9 — métodos de envío de la tienda
3. A2 + C1 — cancelación del vendedor con motivo
4. A3 — despacho con comprobante (el archivo llega a R2, `Comprobante_envio/Pedido_8/`)
5. A4 — calificación del comprador y cierre del pedido

**Sigue la prueba 6: tickets de soporte (A5 + B2).** Después quedan A6, A7, A10, A12,
A13, A14, A15, A19, A24, A1 y A20.

#### Cambio de backend (commit `3390139`)

Es el único que necesitó tocar Java, y es el importante:
`InventarioImagenSupport.reemplazarImagenes()` era **todo o nada**. Bastaba con subir
UNA foto al editar un producto para que borrara de R2 las anteriores, sin vuelta atrás.
Ahora `ProveedorProductoRequestDTO` acepta `existingPhotos` con las URLs que el cliente
quiere conservar:

- `existingPhotos == null` → comportamiento histórico intacto. La app móvil y la carga
  masiva no mandan el campo, así que para ellas **no cambia nada**.
- `existingPhotos != null` → borra solo lo que no está declarado y agrega las nuevas al
  final (`guardarImagenes` acepta un `sortOrderInicial`; antes reiniciaba en 0 y dejaba
  dos imágenes peleando por ser la primera).

`construirUrlImagen()` se movió de `InventarioResponseMapper` a
`InventarioImagenUrlResolver` como `public static`: las dos puntas tienen que armar
**exactamente** la misma cadena o la comparación falla y se borra una foto que el
vendedor quería conservar. Hay tres tests nuevos en `InventarioImagenSupportTest`.

**Orden de despliegue: backend primero.** Si la web sale antes, manda `existingPhotos` a
un backend que lo ignora y vuelve el borrado total.

#### Lo que destaparon las pruebas

Ocho bugs que no estaban en el plan, varios **preexistentes**. El detalle está en
`PLAN_PARIDAD_APP_WEB.md` §7.1; lo que conviene recordar:

- **`npx oxlint --deny no-undef src/`** encuentra los `ReferenceError` que ni el build ni
  el lint ven. Había tres, cada uno reventaba una vista entera.
- **`window.confirm` y `alert()` no funcionan en un navegador embebido.** Ya no queda
  ninguno en `src/`.
- **Clases de CSS inventadas** dejan modales sin fondo sin fallar en ninguna parte.

#### Observación abierta

Hay pedidos antiguos con el método de envío **concatenado** en `courier` (el #6 tiene
`"Retiro en tienda | Envío dentro de la comuna ($3000)"`). Es dato viejo, no una
regresión: el checkout actual usa `checkoutFallbackShippingMethod()`, que manda vacío si
hay mezcla. Pero esos pedidos se ven contradictorios —dicen "Retiro en Tienda" y cobran
envío— y no se ha medido cuántos son.

---

### 4.20 Pendiente del BACKOFFICE: no refleja el ticket cerrado — 2026-08-26

Detectado probando el cierre de tickets desde la web. **No es un bug del backend ni del
marketplace**: los dos se comportan bien.

**Síntoma**: un ticket que el usuario ya cerró sigue mostrando el compositor en el
backoffice. El agente escribe, el mensaje aparece en su pantalla, y no llega ni por
correo ni a la web del usuario.

**Diagnóstico**: el backend **rechaza** correctamente esos mensajes.
`TicketSoporteBackofficeService.sendMessage()` corta con
`BusinessRuleViolationException("La consulta ya está finalizada y no admite nuevos
mensajes")` sobre cualquier ticket en `RESUELTO`, `CERRADO` o `CANCELADO`. Verificado
contra la base: el ticket 23 (`TCK-1787078752317`) quedó `CERRADO` con **un solo
mensaje**, el original; ninguno de los que se escribieron después se persistió.

O sea, el backoffice **no está mostrando el error del 4xx** y probablemente pinta el
mensaje de forma optimista. El agente cree que respondió y no respondió: es el peor
modo de falla posible para soporte.

**Dónde tocar**: `backoffice_sistema/backoffice/frontend/src/modules/support/SupportTicketDetailModal.tsx`,
que es el único que llama a `sendTicketMessage()` (`src/api/support.ts:159`).

**Qué hace falta** (es exactamente lo que ya se hizo en el marketplace):

1. Deshabilitar el compositor cuando el estado es `RESUELTO`/`CERRADO`/`CANCELADO`, y
   mostrar en su lugar un aviso de que la consulta está cerrada.
2. Surfacear el error si el POST falla igual, en vez de tragárselo.

El estado ya viaja en la respuesta del ticket, así que no hace falta backend.

**Ojo con el modelo, que no es obvio**: en un ticket de soporte normal **cerrar es
exclusivamente del usuario**. `updateStatus` rechaza el cambio de estado con
"El estado de los tickets de soporte cambia automáticamente al responder o al ser
cerrados por el usuario", y solo lo permite en tickets de origen `QA`. Soporte no puede
cerrar ni reabrir; si el flujo del backoffice necesita eso, es un cambio de reglas de
negocio, no de UI.


---

### 4.21 Pruebas de paridad 1 a 12 y limites del chat — sesion 2026-08-26

Segunda tanda de pruebas sobre `PLAN_PARIDAD_APP_WEB.md`. **Doce cerradas**, incluido el
flujo de compra completo (pedir cotizacion -> el vendedor cotiza -> pago).

| # | Capacidad | Estado |
|---|---|---|
| 1-5 | Fotos al editar, metodos de envio, cancelacion del vendedor, despacho, calificacion | OK |
| 6 | A5+B2 tickets de soporte | OK |
| 7 | A6 responder preguntas (vendedor) | OK |
| 8 | A10 pausar / retomar publicacion | OK |
| 9 | A19 favoritos | OK |
| 10 | A13 mis preguntas (comprador) | OK |
| 11 | A24 notificaciones | OK parcial, ver plan 7.4 |
| 12 | A14 chat de cotizacion | OK |

**Faltan**: A1/A20 (recuperar clave y validacion de email), A8 (cuenta bloqueada), A15
(imagenes en mediacion) y A16 (busqueda por catalogo de vehiculo, sin cablear).

#### Lo que se arreglo, agrupado por causa

**Cache de React Query sin invalidar** — tres veces el mismo patron: la accion se
guardaba en el backend y la vista que lista no se enteraba hasta recargar. Paso con
favoritos, con las preguntas del comprador y con las cotizaciones. **Regla: si una
accion en una vista cambia datos que otra lista, hay que invalidar**, y la clave debe
vivir en `queryKeys.js` -las escritas a mano en el componente son las que nadie invalida.

**`window.confirm` y `alert()`** no abren nada en un navegador embebido: el boton queda
mudo. Ya no queda ninguno en `src/`.

**Clases de CSS inventadas** dejaban modales sin fondo. Y al ENVOLVER un elemento se
rompen los selectores con `>`.

**Campos sin tope** que la base si tenia: courier y tracking son `length = 120`,
`valorEnvioInformado` es NUMERIC(12,2). Un valor largo se perdia al guardar.

#### Limites del chat de cotizacion (nuevos)

- Mensaje **500** caracteres (la app sigue en 1000, conviene alinearla).
- Imagenes: **3 MB** y **10 por conversacion**, validado en `ConversacionService` ademas
  del cliente. Antes no habia NADA: el unico tope era el multipart de Spring, 10 MB.
- **Compresion antes de subir** (`src/utils/imageCompression.js`): 1600 px de lado mayor
  y JPEG al 80%. Una foto de celular pasa de 3-8 MB a 200-400 KB. R2 son 10 GB
  compartidos con productos, anuncios, perfiles y comprobantes; sin esto el chat solo se
  comia el bucket con unas mil fotos.
- El comprador **no escribe hasta que el vendedor responde**, misma regla que la app
  (`quote-chat.tsx:218`), pero **si puede adjuntar fotos** desde el inicio.
- Vencida o cerrada bloquea chat, adjuntos y "Solicitar modificacion".

#### Cambios de backend de esta sesion

Todos en el monorepo, rama `dev`, ya desplegados a `origin`:

- `bd5d358` + `644ea7b` — agrupado de los correos de ticket (ventana de 10 min,
  configurable) y la **zona horaria** de `ultimo_email_notificado_at`: se creo como
  TIMESTAMP sin zona y Hibernate la leia 4 horas en el futuro, con lo que la ventana no
  vencia nunca. Migraciones `V2026082604` y `V2026082605`.
- `bc2b106` — constancia de cierre por correo e invitacion a cerrar en cada respuesta.
- `8e2e864` — limites de imagen del chat.

**Regla del ticket que no era obvia**: en un ticket de soporte normal **cerrar es
exclusivamente del usuario**. `updateStatus` rechaza el cambio de estado salvo en
tickets de origen QA, y `sendMessage` rechaza mensajes sobre un ticket finalizado.

#### Cotizacion vencida: hilo nuevo

`POST /conversaciones` reutiliza la conversacion ABIERTA del producto y solo mira el
estado, no si la oferta sigue viva. Con la cotizacion vencida el comprador quedaba
atrapado. El backend ya soportaba `forceNew`; ahora la web lo manda cuando la oferta
anterior vencio. **La app movil tiene el mismo problema**: manda `forceNewBackend` solo
para consultas de compatibilidad (`useProductDetailScreen.ts:711`).

#### `no-undef` encendido

Ver CLAUDE.md. La regla es `error` y `npm run lint` devuelve exit 1 si aparece un
identificador inexistente. Baseline de warnings: **114**.

---

### 4.22 A1/A20 recuperacion de clave y check-email — sesion 2026-08-26

Probadas contra el backend LOCAL y cerradas: comprador por correo, tienda por RUT y el
aviso de correo ya registrado en el registro de compradores. Con esto quedan por probar
solo A8 (cuenta bloqueada), A15 y el flujo de verificacion con un estado distinto de
APPROVED.

#### El bug: `send-code` y `verify-code`/`reset` NO aceptan el mismo identificador

`POST /auth/recover-password/send-code` con `rol=PROVEEDOR` resuelve la cuenta **solo
por RUT** (`findByTaxId`, `AuthService:1712`) y **devuelve el correo registrado** en el
campo `email`. Pero `verify-code` y `reset` resuelven **solo por email**
(`findByEmail`, lineas 1767 y 1793). Son dos identificadores distintos y `AuthModal`
guardaba los dos en el mismo estado: el paso 1 pisaba lo que el usuario habia escrito
con el correo que respondia el backend.

El camino feliz (correo -> codigo -> clave) funcionaba igual, asi que no se veia. Lo
que rompia:

- **"Reenviar codigo" siempre fallaba para tiendas**: reenviaba con el correo resuelto y
  `send-code` lo pasaba por `normalizarRut()`, devolviendo 404 "Proveedor no encontrado
  con el RUT ingresado". El cooldown de 60s empuja justo a ese boton.
- **"Cambiar Correo"** devolvia al paso 1 con un email dentro del campo "RUT de la Tienda".
- Entrando desde el login de vendedor se prellenaba el correo tipeado en el campo de RUT,
  y el toggle Comprador/Tienda no limpiaba el campo.

**El arreglo**: estado `recoverIdentifier` (lo que el usuario ESCRIBE, unico que acepta
`send-code`) separado de `recoverEmail` (el correo que responde el backend, unico que
aceptan `verify-code` y `reset`). Regla: **con rol PROVEEDOR son valores distintos y no
se pueden mezclar.**

#### Como se prueba en local (no es obvio)

**El codigo de 6 digitos NO viene en la respuesta.** `repuestop.auth.expose-verification-code`
de `application-local.properties` aplica solo al registro y al captador
(`AuthService:1696`, `CaptadorService:61`), nunca a recuperacion. Sale de:

1. Sin `RESEND_API_KEY`, el correo se simula y el HTML completo se imprime en la consola
   del backend: buscar `[MOCK EMAIL] Detalles: ... Contenido:`.
2. Con la clave llega el correo real, pero Resend en modo prueba solo entrega a la
   direccion verificada; por eso el backend le quita el `+etiqueta` al destinatario.
3. Siempre funciona: `SELECT email, password_reset_code, password_reset_expiry FROM
   rt_usuario WHERE email='...'`.

Otras dos trampas: **el limite es 10 peticiones por minuto por IP** sobre TODAS las rutas
de auth juntas (`AuthRateLimitingFilter`), asi que iterar rapido da un 429 que parece un
bug del flujo; y `reset` rechaza una clave igual a la actual ("La nueva contraseña no
puede ser igual a la contraseña actual"), o sea que la prueba necesita una clave nueva
de verdad.

**Pendiente opcional de backend** (ya anotado en el plan §4): hoy la tienda recupera solo
por RUT. Aceptar tambien el correo exige un fallback en `enviarCodigoRecuperacion`.

---

### 4.23 A8 cuenta bloqueada: el bloqueo es de CUENTA COMPLETA — sesion 2026-08-26

A8 cerrada y probada contra el backend local, bloqueando al proveedor 4 desde el
backoffice por mediacion. Del plan de paridad quedan A15 y A16.

#### La decision que no se deduce del codigo

**Un vendedor bloqueado tampoco puede comprar.** No es "se bloquea el rol vendedor":
`JwtAuthenticationFilter` responde 403 a TODO lo que no este en su whitelist, y el lado
comprador -carrito, checkout, `/usuarios/{id}/pedidos`, favoritos- esta entero afuera.
Se evaluo abrirlo y se decidio que no: el backend ya se comportaba asi, y un bloqueo
suele nacer de una disputa de plata, donde dejar operar la misma cuenta del otro lado
del mostrador es discutible.

Consecuencia para los clientes: **los accesos de compra se esconden**, no se dejan a la
vista para que fallen. En la web eso es el carrito del header, `/carrito`, `/checkout` y
`addToCart`.

#### La whitelist del filtro, y su forma

Lo permitido a un bloqueado: **leer lo suyo y hablar con soporte.** Perfil
(`GET /users/perfil`), estado de cuenta, su ficha de tienda, sus direcciones, los GET de
`pedidos` / `inventario` / `conversaciones`, `/support/**`, la solicitud de revision y el
logout. Todo lo demas, 403.

**Las rutas nuevas se permiten SOLO en GET a proposito.** `/users/perfil` tambien atiende
POST de foto y de aceptar terminos, y `/usuarios/{id}/direcciones` atiende POST; ambos
cuelgan del mismo camino y siguen cortados. Hay test que lo pina.

**`/users/perfil` fuera de la whitelist provocaba un bucle de login del que el bloqueado
no podia salir**: `AuthContext` leia el 403 como sesion invalida, cerraba sesion y
mostraba el login; el login funciona (ruta publica) pero el perfil siguiente daba 403 de
nuevo. En la web se corrigio ademas la causa de fondo: **solo el 401 cierra sesion**, el
403 es "autenticado pero sin acceso".

#### Visibilidad publica: `ProveedorVisibilidadPublica`

Directorio, ficha de tienda y catalogo filtraban cada uno por su cuenta con
`status != 'suspended'`. Dos huecos:

1. **El bloqueo por MEDIACION no se miraba**, y es el camino mas comun. No toca
   `Proveedor.status`: `MediacionBackofficeService` marca `Mediacion.cuentaBloqueada` y
   suspende la entidad **Tienda**, que es OTRA TABLA. El vendedor quedaba con el panel
   bloqueado y la API cortada mientras el marketplace le seguia vendiendo.
2. **`'rejected'` quedaba fuera**, aunque el filtro JWT ya lo trata como bloqueado.

La regla vive ahora en `ProveedorVisibilidadPublica` (`Predicate` para las consultas
paginadas, version sobre entidad para los detalles). La ficha publica responde **404 y no
403**: un 403 confirmaria que ese id corresponde a una tienda sancionada. **El guard va en
`TiendaPublicaController` y NO en `obtenerTienda()`**, que lo comparte el panel del propio
vendedor: ponerlo en el servicio le volaba su propia tienda al bloqueado.

#### El motivo del bloqueo es el CODIGO del reclamo

`blockReason` no es una frase redactada por moderacion: el backend copia ahi
`Mediacion.motivo`, que es `Pedido.motivoReclamo` (`MediacionChatService:84`), o sea el
codigo que eligio el comprador. Se leia **"Motivo actual: incompatible"**. Se traduce con
`src/data/claimReason.js`, que es la fuente unica de esos textos (`HelpContactForm` arma
sus listas desde ahi), y se rotula como lo que es: el reclamo que origino la mediacion.

**El backend no guarda en ninguna parte un motivo de bloqueo propio.** Si moderacion tiene
que escribir una razon real, es columna nueva y migracion.

#### La tienda de demostracion en `StorePublicProfileView`

Al arreglar la visibilidad quedo a la vista: cuando `GET /tiendas/{id}` fallaba, la vista
**inventaba una ficha completa** con nombre y **RUT `77.589.410-8`** de otra empresa. Se
elimino junto con el resto de los datos afirmados sin leer nada ("Menos de 1 hora",
"Desde marzo 2022", 264 publicaciones, "3 opciones" de envio) y con el logo de Tiensoft
por defecto para cualquier tienda sin logo. Regla: **si el backend no lo mando, no se
pinta.**

#### Que falta en la APP MOVIL

La app tiene el mismo desfase que tenia la web y **no se toco**:

- **Su guard de pestañas exime las rutas de compra** (`isSellerShoppingPath`), pero el
  backend las rechaza con 403. Con la opcion A aplicada le corresponde el mismo corte que
  se hizo en la web: esconder carrito y checkout para la cuenta bloqueada.
- **El polling de `estado-cuenta` (`app/_layout.tsx:120`) estaba muerto**: recibia 403
  porque el endpoint no estaba en la whitelist. Con el fix ya responde, o sea que la app
  recien ahora detecta bloqueo y desbloqueo en vivo. Conviene verificarlo.
- Le llega la misma traduccion pendiente del motivo: mostrara el codigo crudo.

#### Como se prueba

Bloquear desde el backoffice por mediacion, o en local:
`UPDATE rt_proveedor SET status='suspended' WHERE id=<id>;` (revertir con el status
original, que depende de como quedo al aprobarse).

Comprobaciones rapidas con el proveedor bloqueado:

```
curl -s "http://localhost:8080/api/v1/tiendas/publicas?size=50" | grep -c '"proveedorId":<id>'   # 0
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080/api/v1/tiendas/<id>"             # 404
```

**El filtro es codigo compilado: hay que reiniciar el backend**, no basta con recargar.

### 4.24 Sesión 2026-08-27 — Deep Links de Notificaciones y Popover de Campana

1. **Rutas de Notificación de Vendedor en `src/data/notificationTargets.js`**:
   - Backend emitía `/(seller)/mensajes` para cotizaciones de tiendas, `/(seller)/pedidos` para pedidos y `/(seller)/productos`.
   - Se agregaron las traducciones correspondientes a rutas web (`/perfil/cotizaciones?cotizacion=...`, `/perfil/pedidos?pedido=...`, etc.).
2. **Sincronización React Router y Reapertura Consecutiva**:
   - Se reemplazó `window.history.replaceState` por `setSearchParams` con `replace: true` mediante `handleClearDeepLink` en `ProfilePage.jsx`.
   - Al cerrar los modales (`QuoteDetailModal`, `OrderDetailModal`, `SupportTicketDetailModal`), los query params se limpian formalmente en el router, permitiendo que clics consecutivos sobre la misma notificación abran el modal de inmediato.
3. **Comportamiento del Popover `ProfileNotificationsBell.jsx`**:
   - Cierre automático ante eventos de navegación / cambio de ruta (`useLocation`).
   - Cierre automático al hacer clic fuera del componente (listener de `mousedown`/`touchstart`).
   - Soporte para eliminación masiva de notificaciones leídas (`DELETE /usuarios/{id}/notificaciones/leidas`).

### 4.25 Sesión 2026-08-27 — Paridad de Catálogo 1:1, Límites de Entrada y Múltiples Compatibilidades con Versiones

1. **Paridad de Comisión Fundador (5%) en Catálogo y Cotizaciones**:
   - Se inyectó `isSellerFounder = Boolean(storeInfo?.founder ?? user?.founder ?? user?.fundador)` desde `ProfileDashboard.jsx` hacia `NewCatalogProductModal.jsx` y `QuoteDetailModal.jsx`.
   - `CommissionSummaryCard.jsx` despliega el banner distintivo amarillo para vendedores fundadores: *"Beneficio Fundador: comisión RepuesTop fija de 5%, sin importar el monto."* y calcula tarifas con la tasa de 5% fija en lugar de la escala estándar (10%/7%/5%).
2. **Límites de Caracteres y Prevención de Desbordamiento**:
   - Se definió `MAX_CATALOG_PRICE = 99999999` (máximo $99.999.999 / 8 dígitos) en `src/utils/pricing.js`, evitando loops infinitos o congelamiento del navegador en la calculadora inversa (`calculateSuggestedPrice`).
   - En `CommissionSummaryCard.jsx`, `NewCatalogProductModal.jsx` y `QuoteDetailModal.jsx` se aplicó `maxLength` y truncamiento estricto de 8 dígitos a todos los campos numéricos de precio, descuento y envío, y límites de texto en SKU (30), Marca repuesto (80), Motor (40), OEM (40), Búsqueda de categorías/versiones (80) y Descripción (1000).
3. **Carga y Edición de Múltiples Compatibilidades en Catálogo**:
   - `parseCompatibilitiesFromProduct(product)` en `NewCatalogProductModal.jsx` extrae todas las compatibilidades de `compatibilityGroupsJson` (o `compatibilityGroups`/`compatibilidad`), mapea sus `brandId` y precarga reactivamente los modelos de vehículos para cada entrada (`getVehicleModelsApi`).
   - Al guardar, serializa todos los grupos con sus campos `marca`, `modelo`, `anioDesde`, `anioHasta`, `motor`, `referenciaOem`, `version`, `versionLabels` y `vehiculoCatalogoIds`.
4. **Modal de Compatibilidades del Producto (`ProductDetailPage.jsx`)**:
   - Rediseño de la tarjeta (`article` con `display: flex; flex-direction: column`): eliminación del cuadro verde con icono de auto, cabecera limpia con título y badge del vendedor, y grid uniforme de 5 campos (Marca, Modelo, Año, Motor y Ref. OEM en cajas estilizadas).
   - Resolución exacta 1:1 de versiones seleccionadas por ID (`itemCatalogIds.map(id => ...)`): previene duplicados entre nombres cortos y largos, y muestra los chips reales elegidos por el vendedor (`GL CVT - 1.800 - Automática`, etc.) sin caer falsamente en *"Compatible con todas las versiones"*.
5. **Invalidación de Caché Inmediata en Edición de Producto**:
   - `handleCatalogProductSaved` en `ProfileDashboard.jsx` ahora invalida y remueve explícitamente `qk.product(pid)`, `compatVersionsForProduct` y `vehicleCatalogDetails`.
   - `ProductPage.jsx` fue configurado con `initialDataUpdatedAt: 0` y `staleTime: 10000`, garantizando que cualquier compatibilidad nueva agregada por el vendedor se refleje de inmediato en la ficha pública del repuesto.

### 4.26 Sesión 2026-08-28 — Reportes Contextuales 1:1, Limpieza de Perfil de Tienda y Consolidación de Mural de Anuncios

1. **Diálogos de Reporte Contextual Globales (`ContextualReportButton.jsx`)**:
   - Se montaron los modales de reporte y confirmación mediante `createPortal(..., document.body)` para evitar que quedaran atrapados dentro de contenedores con `backdrop-filter`, `transform` o `position: relative`.
   - Se mejoró la tipografía y legibilidad de todos los reportes (título 18px, motivos 13.5px bold, altura 46px, textarea 13.5px y botones de 42px).
   - Se incorporó la tarjeta explicativa con icono de escudo (`ShieldCheck`): *"¿Qué sucederá con tu reporte? Será revisado de forma confidencial por el equipo de soporte y servirá como antecedente e historial en caso de futuras mediaciones."*
2. **Correcciones Integrales en Vista Pública de Tienda (`StorePublicProfileView.jsx`)**:
   - **Aislamiento de Portada y Avatar**: Se eliminó la regla CSS genérica `.store-cover-image img` que expandía erróneamente la foto de perfil sobre todo el banner. Se crearon clases aisladas `.store-cover-backdrop-img` y `.store-avatar-img`, fijando el avatar dentro de `.store-avatar-box` con fallback estilizado de iniciales (ej. `R2`).
   - **Hero de Alto Contraste**: Se encapsuló la información del perfil en una tarjeta flotante con glassmorphism oscuro (`rgba(11, 28, 56, 0.88)`), garantizando 100% de legibilidad sobre cualquier imagen de portada.
   - **Eliminación de Redundancias**: Se removió el banner azul sticky repetitivo y el segundo buscador del catálogo, unificando la búsqueda en la consola interactiva por pestañas (*Repuesto*, *Patente*, *VIN*, *OEM*).
   - **Exclusión de Auto-Reporte**: `isOwnStore` ahora valida exhaustivamente todos los identificadores de la sesión (`sellerId`, `storeId`, `tiendaId`, `userId`, `storeName`) para ocultar el botón *"Reportar"* en la tienda propia.
3. **Reubicación del Botón de Reporte en Ficha de Producto (`ProductDetailPage.jsx`)**:
   - Siguiendo el estándar de los marketplaces chilenos (Mercado Libre Chile), se retiró el botón del centro de la pantalla y se reubicó al pie de la columna lateral de compra como un enlace sutil `⚑ Reportar publicación` (`.btn-product-report-link`).
4. **Verificación en Mural de Anuncios (`AdCard.jsx` / `AdsWallView.jsx`)**:
   - Verificado que los anuncios propios con insignia *"Tu anuncio"* ocultan automáticamente el botón de reporte (`!isOwnAdCard`).
   - Verificado que no existen anuncios mock/hardcodeados (`INITIAL_CLASSIFIED_ADS = []`); todos provienen del backend (`GET /api/v1/anuncios`).
5. **Regla de Flujo Git en `CLAUDE.md`**:
   - Registrada la regla obligatoria de no realizar commits ni `git push` a menos que el usuario lo solicite de manera explícita en su mensaje.

---

### 4.27 Sesión 2026-08-28 — Optimización de Imágenes en Chat y Evidencias de Mediación (`MediationCaseView.jsx`)

1. **Compresión Asíncrona de Evidencias**:
   - `pickEvidenceFiles` ahora ejecuta `compressImageFile(file)` (1600px / JPEG 80%) en cada archivo seleccionado antes de agregarlo al estado de evidencias (`mediatorFiles`, `files`).
   - Reduce las fotos crudas de cámara de 5-8 MB a ~200-400 KB antes de subirse a Cloudflare R2, tanto en el hilo con el mediador como en los modales de escalación y resolución.
   - `EvidencePicker` incluye indicador interactivo de compresión con spinner (`Loader2`).
2. **Límites de Imágenes en Chat Directo**:
   - Definido `MAX_CHAT_IMAGES = 10` y `MAX_CHAT_IMAGE_SIZE = 3 MB`.
   - `handleChatImageSelect` bloquea la selección al alcanzar 10 fotos por conversación y el botón de adjuntar en el footer refleja el estado (`Máx. 10` / deshabilitado).
3. **Visor de Imágenes / Lightbox a Pantalla Completa y Montaje Seguro con `createPortal`**:
   - Incorporado estado `viewerImage` con renderizado lightbox montado en `document.body` mediante `createPortal`, evitando atrapamientos en stacking context del perfil.
   - Barra flotante en vidrio oscuro (`backdrop-filter`) con `z-index: 99999`, título, botón de descarga y botón de cierre `X` con soporte para cerrar al pulsar la tecla `Esc` o clic en el fondo.
   - Burbujas de chat directo con botón interactivo `.quote-ws-image-open` e icono `Maximize2` para ampliar las imágenes.
   - Miniaturas de `EvidenceStrip` convertidas en botones interactivos (`.dispute-evidence-thumb-btn`) para examinar cualquier evidencia del expediente en alta resolución.
4. **Corrección de Centrado en Miniaturas de Precarga**:
   - Se forzó `padding: 0 !important; margin: 0 !important;` en `.dispute-evidence-thumbs li > button` para anular el padding heredado del composer general, logrando un centrado geométrico perfecto del icono de la `X`.
5. **Corrección en Base de Datos Backend (`repuestop`)**:
   - Se creó la migración Flyway `V2026082806__widen_mediacion_url_documento_to_text.sql` ensanchando `bo_mediacion.url_documento`, `nombre_documento` y `bo_mediacion_evidencia.url` a tipo `TEXT`, permitiendo acumular múltiples URLs de Cloudflare R2 sin límite de 500 caracteres.

---

### 4.28 Sesión 2026-08-29 — Búsqueda por Catálogo de Vehículo 1:1 (`PartsCatalogView.jsx` & A16)

1. **Adaptadores y Aplanado de Ofertas (`src/services/adapters.js`)**:
   - Se implementaron `adaptCompatibleOffer(spare, offer)` y `adaptCompatibleOffersPage(response)` para procesar `RepuestoOfertaPageDTO` (`GET /api/v1/vehiculos-catalogo/{catalogoId}/repuestos`), combinando la información del repuesto y la tienda (precios, stock, imágenes con `resolveMediaUrl`, calificaciones, insignias de fundador y modo de precio).
2. **Query Key Centralizada (`src/services/queryKeys.js`)**:
   - Se agregó `qk.vehicleCompatibleProducts(catalogoId, filters)`.
3. **Conmutación Inteligente en Catálogo (`src/components/PartsCatalogView.jsx`)**:
   - Si `activeVehicle?.catalogoId` está presente y `onlyCompatible` es `true`, la consulta de TanStack Query ejecuta `getVehicleCatalogPartsApi` directamente contra el motor de compatibilidad relacional del backend.
   - En caso contrario, o si el usuario desmarca la opción, conmuta automáticamente a `getPublicProductsApi` (`GET /inventario/productos`).
   - Se agregó el banner distintivo verde de compatibilidad verificada por catálogo oficial con botón para alternar o limpiar.
4. **Soporte de Compatibilidad por `catalogoId` en Tienda Pública (`src/components/StorePublicProfileView.jsx`)**:
   - Se refinó la verificación de compatibilidad para evaluar `vehiculoCatalogoIds` contra `activeVehicle.catalogoId` además del emparejamiento por marca y modelo.

---

### 4.29 Sesión 2026-08-30 — Paridad 1:1 en Flujo de Identificación y Búsqueda Manual de Vehículo (`OfficialPatentHero.jsx`)

1. **Transición In-Place sin Popups**:
   - Al pulsar *"Editar o corregir datos"*, la tarjeta del Hero conmuta directamente a la pestaña *"Búsqueda manual"* pre-poblando los datos del vehículo actual. Al pulsar *"Consultar otro vehículo"*, se limpia la búsqueda y regresa a *"Buscar por patente"*.
2. **Formulario en Cascada 1:1 con la App Móvil**:
   - Campos estandarizados: `Patente (opcional)`, `Marca`, `Modelo`, `Año`, `Versión`, `Combustible` y `Nro Chasis (opcional)`.
   - `Modelo` y `Versión` convertidos en selectores desplegables puros (`<select>`) alimentados por `GET /catalogos/inventario/marcas-vehiculo/{id}/modelos` y `GET /catalogos/inventario/versiones`.
3. **Catálogo Oficial del SII para Tipos de Combustible**:
   - Se auditaron los 25.300+ modelos de `catalogo_sii_2026_optimo.csv` en el backend, adoptando la nomenclatura oficial del SII: `Bencina`, `Diésel`, `Eléctrico`, `Híbrido Sin Recarga Exterior`, `Híbrido Recarga Exterior`, `Gas (GLP / GNC)`.
4. **Opción A en Persistencia Manual (Prevención de 400 Bad Request)**:
   - Si el usuario ingresa su patente: se valida y persiste mediante `POST /api/v1/vehiculos/manual` en la tabla `vehiculo_consultado` para indexar el vehículo en futuras búsquedas.
   - Si no ingresa patente: se genera el vehículo en memoria para la sesión actual, permitiendo explorar repuestos compatibles sin ensuciar la base de datos con patentes falsas ni violar el límite de 8 caracteres (`@Size(max = 8)`).
5. **Tooltips Informativos y Accesibilidad**:
   - Tooltip informativo en `Nro Chasis (opcional)` y en `Patente (opcional)`.
   - Eliminación del término "calce" en favor de "compatibilidad técnica exacta".

---

### 4.30 Sesión 2026-08-30 — Escalabilidad del Catálogo `/repuestos`: Gate de Contexto y Filtros en Servidor

Commits: web `491d276`; backend `12f8f3a`, `aecd4b1`, `d921e07`. Ambas ramas `dev` subidas
(backend primero).

1. **El listado ya no se pide sin contexto (`PartsCatalogView.jsx`)**:
   - Entrar a `/repuestos` disparaba un scan + `COUNT(*)` sobre todo el inventario visible.
     `hasActiveContext` deja la consulta en `enabled: false` mientras no haya texto, categoría,
     patente, comuna o algún filtro. Sin contexto se muestra una vitrina: carrusel de categorías
     con los conteos reales de `GET /inventario/productos/resumen-categorias` (un `GROUP BY`, no
     filas) y **una** página de 12 recién publicados.
   - Es el patrón de MercadoLibre y Autoplanet: la ruta de listado nunca se renderiza sin contexto.
2. **Todos los filtros pasaron a la base de datos**:
   - Subcategoría (resolviendo nombre → `subcategoriaId`), marca del repuesto (`marcaId`, acotada
     a la categoría elegida), rango de precio, condición, origen, modalidad y compatibilidad de
     vehículo. Antes se aplicaban en el cliente sobre las 12 filas de la página actual.
   - `displayedProducts` es hoy `products` a secas. **No volver a meter `.filter()` ahí.**
3. **Controles retirados por no tener respaldo real**:
   - "Más vendidos" y "Mayor descuento": `mapSortableField()` los hacía caer en silencio a
     `precio` y luego se reordenaba solo la página visible. Despacho rápido: no tiene campo.
4. **Backend — filtros nuevos en el catálogo público (`12f8f3a`)**:
   - `soloCotizacion` llegaba al controlador y **se descartaba**: el filtro de modalidad devolvía
     siempre el catálogo completo. Ahora se resuelve en la base.
   - `condicion` y `origen` tenían campo (`ProveedorProducto.condicion`, `MarcaRepuesto.paisOrigen`)
     pero no parámetro. El origen compara por coincidencia parcial porque `paisOrigen` es texto
     libre y hay marcas como "Estados Unidos / Alemania".
   - Nuevo `GET /inventario/productos/origenes`, con los países ya descompuestos y deduplicados.
5. **Backend — condición acotada a ORIGINAL/ALTERNATIVO (`aecd4b1`)**:
   - La regla ya estaba en los términos aceptados por el vendedor; la validación no la aplicaba.
   - El default de `ProveedorProducto` pasó de `NUEVO` a `ORIGINAL` (campo y `@PrePersist`): sin
     eso, un producto creado sin condición quedaba con un valor ya inválido e invisible al filtro.
   - Cubierto por `InventarioValidationSupportCondicionTest` (7 casos, verificado que falla al
     revertir la validación).
6. **Backend — compatibilidad por patente (`d921e07`)**:
   - Con patente resuelta la web consulta `/vehiculos-catalogo/{id}/repuestos`, que **ignoraba**
     subcategoría, condición, origen, comuna y modalidad. Los cinco se agregaron a la query y al
     `countQuery`.
   - El `LEFT JOIN` a `rt_repuesto_compatibilidad` corre contra todos los catálogos equivalentes
     (21 para el Yaris de prueba) y **multiplicaba filas**: FRENOS daba 4 filas para 2 productos.
     Como Spring pagina sobre esas filas, `size=24` devolvía 23 tarjetas y el contador declaraba
     34 sobre 32 reales. Pasó a `EXISTS`: una fila = un producto. Verificado en SQL que el
     conjunto no cambia (0 perdidos, 0 agregados) y que el orden es idéntico.
   - `nivelConfianza` pasó a un subquery que toma el **mejor** nivel entre las variantes.
7. **Paginación**:
   - Topada en 1.000 resultados navegables, con aviso que invita a refinar.
   - `keepPreviousData` en la consulta. **Ojo**: sin eso, al cambiar de página `catalogData` cae a
     su default (`totalPages: 1`) mientras llega la respuesta, y el clamp de `?pagina=9999`
     devolvía al usuario a la página 1. La paginación quedó muerta un rato y ni el build ni el
     lint lo notaron; solo se detecta recorriendo páginas en el navegador.

**Verificado end-to-end** contra el backend local con la patente `ABCD11` (catalogoId 1): con
patente 12+12+8 = 32 en tres páginas; sin patente 1→2→3→4 con la URL sincronizada; condición
25/7, origen Alemania 10, a cotizar 4/28, todos coincidiendo con el backend.

**Lo que queda**: ver los cuatro cabos del catálogo en la sección "Pendientes conocidos" de
`CLAUDE.md` (orden por más vendidos, despacho rápido, `esUniversal` sin marcar, y `sort` en el
endpoint de compatibilidad).

---

### 4.31 Sesión 2026-08-31 — Repuestos universales, agotados al final y vitrina de Productos Top

Commits: backend `1e8ae23`, `10e5161`; web `4ae72f0`, `2cde97f` (+ los correctivos de esta
misma sesión). Ambas ramas `dev` subidas, backend primero.

#### 1. `esUniversal`: el diagnóstico heredado estaba equivocado

La sección 4.30 dejó anotado que "los 64 productos de Compatibilidad multimarca tienen
`compatibilidadMarca` nulo". **Es falso, y conviene no repetirlo**: `getCompatibility()` en
`MarketplaceProductCard.jsx` devuelve el literal "Compatibilidad multimarca" cuando el
producto no trae resumen de compatibilidad. Nunca existió un campo que dijera eso.

El dato real en la base local: de 121 productos, **118 tienen `compatibilidad_marca`** y solo
3 la tienen vacía — dos aceites y un kit de limpieza, o sea justo los que sí son universales.
Ninguno tenía `es_universal = true` porque la columna nació en `V2026082803`, después de la
carga.

**No se hizo backfill** (decisión del usuario: el proyecto no está en producción). Lo que sí
se cerró es el agujero estructural: **ningún camino de carga permitía declarar universal**.
El Excel no tiene columna `es_universal` y el formulario web nunca mandaba el campo, así que
todo producto creado desde la web quedaba en `false`. Se agregó el toggle en
`NewCatalogProductModal` (sección 3), reusando `.catalog-condition-row`.

Al marcarlo se manda la compatibilidad **vacía**: mandar las dos cosas haría aparecer el
producto DOS veces en la búsqueda por patente, una por universal y otra por el cruce
relacional.

**La regla que NO hay que introducir**: inferir universal a partir de "no declaró marca".
Convertiría cada fila mal llenada de un Excel en un producto que sale para TODOS los
vehículos. Un falso positivo en la búsqueda por patente cuesta más que un falso negativo: es
el diferenciador del producto y quema la confianza en toda la búsqueda.

**Queda pendiente la columna `es_universal` en la plantilla Excel** (`InventarioExcelService`,
17 columnas hoy). Mientras no exista, toda carga masiva sigue produciendo `false`.

#### 2. Los agotados van al final de todo orden

El catálogo público no filtraba por stock, así que con "Precio: Menor a Mayor" el producto más
barato del inventario encabezaba aunque tuviera stock 0. Y el endpoint de compatibilidad por
patente **sí** filtra `stock > 0`, de modo que el mismo producto aparecía sin patente y
desaparecía con ella.

`ProveedorProducto.ordenDisponibilidad` es una `@Formula("CASE WHEN stock > 0 THEN 0 ELSE 1 END")`
de solo lectura, que `InventarioCatalogoPublicoService` antepone a todo orden pedido.
Los agotados quedan al final sin alterar el criterio que eligió el comprador — ordenar por
`stock` directamente lo destruiría.

Va como fórmula y no como columna real para no mantenerla sincronizada con `stock` en cada
venta, devolución y edición. **No necesita migración.**

**El riesgo real era otro**: si Spring Data no resolviera una `@Formula` en el `Sort`,
reventaría al ARMAR la consulta y se llevaría abajo el catálogo entero. Verificado que
Hibernate genera `order by (CASE WHEN pp1_0.stock > 0 THEN 0 ELSE 1 END), pp1_0.precio`.

No se filtran los agotados: la ficha sigue siendo válida y el vendedor puede reponer.

#### 3. "Recomendados" pasó de `updatedAt,desc` a `stock,desc`

Eran cuatro opciones de orden y dos hacían casi lo mismo: `updatedAt` se mueve con cualquier
edición del vendedor, así que "Recomendados" era prácticamente "Más Recientes". Al lanzar no
hay ventas ni calificaciones, y el stock es la única señal con datos reales.

#### 4. Vitrina de `/repuestos`: Productos Top de las tiendas

La marca "Producto Top" (`destacado`) ya existía completa —`PATCH /proveedores/{id}/productos/{productoId}/top`,
el toggle en `CatalogCard`— pero solo ordenaba **dentro de la ficha de la tienda**.

**Tope de 2 por tienda**, validado en `cambiarDestacadoProducto()`. Sin tope y siendo gratis,
al llevar la marca a una vitrina compartida el incentivo se invierte: encerrada en la propia
tienda, marcar todo no destaca nada y el único perjudicado es el vendedor; en un espacio
común, a cada uno le conviene marcar su catálogo entero y en un mes la marca no significa
nada. Se valida **solo al encender y solo si no estaba ya encendido**: repetir el PATCH sobre
un producto que ya es Top no puede quedar bloqueado por el cupo que él mismo ocupa.

**Filtro `soloDestacados`** en el catálogo público, resuelto en la base. Es filtro y **no**
orden a propósito: ordenar por `destacado` dejaría todo el resto del catálogo detrás en orden
arbitrario.

**Índice PARCIAL** `V2026083101` sobre `destacado WHERE destacado`. Uno común no sirve: la
columna es booleana y casi todo el catálogo está en `false`, así que el índice pesaría como la
tabla y el planner lo ignoraría. Verificado que Postgres lo usa (`Index Scan using
idx_proveedor_producto_destacado`).

**Los dos bloques de la vitrina son independientes: 12 y 12.** La primera versión hacía que el
relleno descontara (`SHOWCASE_SIZE - destacados.length`), así que cada Top le comía un lugar a
los recién publicados y la pantalla mostraba 12 en total en vez de 24. Se piden
`SHOWCASE_SIZE + destacados.length` recientes para poder descartar los que ya salieron arriba
sin quedarse corto.

**Por qué no solo Top**: los marca el vendedor a mano y rotan lentísimo por diseño (2 por
tienda). Una portada hecha solo de eso muestra lo mismo semana tras semana y se lee como un
sitio muerto. "Recién publicados" es la señal contraria y cambia todos los días.

#### 5. Producto universal en la ficha: el modal decía lo contrario de la verdad

Un repuesto universal no declara vehículos, así que la lista de compatibilidades sale vacía y
el modal mostraba **"No encontramos compatibilidades"** — que se lee como "no le sirve a
ningún auto" cuando el dato real es "le sirve a todos". En `ProductDetailPage`, con
`esUniversal` el bloque pasa a afirmarlo directamente y **no se ofrece el modal**.

`adaptProduct` no exponía `esUniversal`; ahora sí.

**Ojo con `.product-universal-note`**: es `display: flex`, y el `<strong>` dentro del párrafo
creaba items flex hermanos que se encogían por separado, dejando una palabra por línea. Todo
el texto va dentro de UN `<span>`.

#### 6. Los mensajes del Producto Top estaban escritos para informáticos

Decían "aparecerá en la vitrina de /repuestos" — una ruta de código en un texto que lee un
vendedor de repuestos. Reescritos en el aviso de la sección, en el mensaje de confirmación y
en el tooltip del botón: hablan de "la portada de repuestos, donde lo ven todos los
compradores" y mencionan el tope de 2.

#### Verificado

- **En dev** (`api-dev`, 2.058 productos): `soloDestacados=true` → 1 (antes del deploy
  devolvía 2.058, o sea el parámetro ignorado — Spring descarta en silencio un `@RequestParam`
  que no conoce, y esa es la firma de "código viejo"). Compone bien con los demás filtros
  (`soloDestacados` + `condicion`: 1 + 0 = 1). Sin regresiones: condición 2025+33, modalidad
  12+2046, origen 730, comuna 55; y los cinco filtros del endpoint de compatibilidad intactos.
- **En local, en el navegador**: vitrina con 3 Top + 12 recientes sin repetidos; el tope
  respetado por vendedor (proveedor 1 en 2, proveedor 2 en 1); producto 7285 guardado con
  `es_universal = t` y `compatibilidad_marca` vacío desde el toggle nuevo; la ficha del
  universal mostrando el aviso y sin el botón de compatibilidades.
- **Los agotados al final no se pueden observar en dev**: no hay ni un producto con stock 0
  (`sort=stock,asc` arranca en 3). Verificado en local con SQL sobre datos reales.

#### Pendientes que deja esta sesión

- Columna `es_universal` en la plantilla Excel (ver punto 1).
- **Hay productos publicados en $0** en dev con stock: ids `3021` ("Bujía de Encendido Super
  Plus", stock 48) y `4` ("Batería Bosh", stock 9). Encabezan cualquier orden por precio
  ascendente.
- El flujo de búsqueda por patente desde la UI con sesión iniciada sigue sin probarse end to
  end (se ejercitó sembrando el vehículo en `localStorage`).
- Levantar el backend local requiere `BANK_DATA_ENCRYPTION_KEY`; sin ella el arranque muere
  con `AEADBadTagException: Tag mismatch!` al descifrar datos bancarios existentes.

---

### 4.32 Sesión 2026-08-31 (tarde) — Flujo de pedidos: cada rol ve su número y su plata

Commits: backend `165a7ac`, `a212e48`, `a3fd1ec`, `ba1403e`; web `d651274`;
backoffice_sistema `6226ada`. Los tres repos subidos, backoffice y backend primero.

Salió de una prueba de TC-06 (ítems cancelados dentro de un pedido vivo) que destapó seis
defectos en la ficha del pedido. **El backend ya mandaba casi todos los datos correctos; la
web no los usaba.**

#### El caso que lo destapó, y cómo montarlo

No es cancelar un pedido —eso es TC-04—, es un pedido que **sobrevive con una línea caída**.
La única forma de llegar ahí por la UI es un **carrito de dos tiendas**:
`PedidoCancelacionSupport` solo toca los ítems del vendedor que cancela, y
`cancelacionTotal` es falso si quedan ítems activos de otro. El pedido 21 de la base local es
justo eso (vendedor 1 activo, vendedor 2 cancelado por `SIN_STOCK`).

#### Los seis defectos

1. **`Pedido #21` era el id de la tabla.** El backend ya traía los dos números correctos y
   nadie los usaba: `numeroPedidoComprador` (secuencia POR COMPRADOR, la app ya la usa vía
   `getOrderDisplayCode`) y `codigoVendedor` en el ítem (secuencia POR VENDEDOR). Del código
   del vendedor se muestra **solo la cola** (`Venta #000017`): el prefijo lleva el id del
   proveedor y existe para garantizar unicidad, no para leerse. Además el id era enumerable —
   "#21" le decía a cualquier vendedor cuántos pedidos lleva el marketplace entero.
2. **`local_delivery` crudo en pantalla.** Al traducirlo quedó repetido con el "Tipo de
   Entrega" de dos líneas más abajo, así que el courier —que es información ADICIONAL al
   método— pasó a su propia píldora y solo cuando existe.
3. **El banner de reembolso lo veía quien no había cancelado nada.** `refundStatus` se leía
   del pedido completo sin filtrar por vendedor.
4. **El vendedor que canceló veía su "Monto Neto a Recibir" intacto** ($49.103 de plata que
   no le iba a llegar): `subtotalVendedor` filtraba por `proveedorId` pero no por estado.
   `LiquidacionPedidoCalculator.itemsActivos()` **sí** los excluía, o sea que la pantalla
   contradecía al pago.
5. **"Confirmar pedido" y "Cancelar Pedido" seguían ofreciéndose al vendedor sin líneas
   vivas**, y al pulsarlos movía el pedido ENTERO, cambiándole el estado al otro vendedor.
6. **El comprador veía "Total Pagado $92.990" sin una sola mención del reembolso.**
   `montoReembolsado` y `totalActivo` los envía el backend desde siempre.

#### Lo que apareció al validar y no estaba en el plan

- **El checkout de COTIZACIÓN nunca asignaba `codigoVendedor`** — solo lo hacía el del
  carrito. Toda venta nacida de una cotización quedaba sin código. Se detectó viendo un
  "Venta #19" mezclado entre los "#0000xx" en el panel del vendedor.
- **Un `||` se tragaba el cero.** `order.subtotal || itemsSubtotal || order.total` tomaba un
  subtotal legítimo de $0 —el vendedor canceló todo lo suyo— como "no vino" y caía al cálculo
  local, que devolvía el monto de la venta anulada: el neto salía $0 pero seguía descontando
  −$6.902 de comisión. **Ojo con esta familia de bug**: cualquier `||` sobre un importe trata
  el cero como ausente.
- **La lista y el detalle mostraban cifras distintas** para el mismo pedido: el detalle ya
  decía "Total Final $34.990" y la tarjeta seguía en $92.990.
- **`no-undef` atajó un error real**: al separar courier de método quedó una referencia muerta
  a `deliveryTerms`. Habría reventado la ficha entera en runtime y el build pasaba igual.

Se agregó `src/data/orderIdentity.js` con la numeración por rol, la etiqueta de envío y la
lista de estados cancelados, que estaba **copiada literal** en `OrderCard` y
`OrderDetailModal`.

#### Nuevo `codigoSoporte` ("PED-0000021")

Ni el número del comprador ni el del vendedor sirven para soporte: el primero es su propia
secuencia (dos compradores tienen ambos un "#3") y el segundo identifica la parte de un
vendedor, no el pedido. Se expone uno por pedido y se muestra en el subtítulo del detalle.

#### El prefijo `ML-` → `RTP-`: mucho más profundo de lo que parecía

El identificador del vendedor empieza a ser visible para él, y "ML" se lee como MercadoLibre.
**El problema de fondo no era el prefijo sino que estaba escrito a mano en SIETE lugares** sin
constante compartida. Ahora todos derivan de `CodigoVendedor.PREFIJO`.

**No puede ser "RT-" a secas**: el código de compartir de un producto ya es "RT-`<dígitos>`"
("RT-7285") y `extraerIdDesdeCodigoCompartir` resuelve como producto cualquier "RT" seguido
solo de números, así que "RT-1" sería ambiguo entre el vendedor 1 y el producto 1. "RTP-1"
normaliza a "RTP1" y no pasa ese filtro.

**El código NO vive solo en su columna, y eso casi se sube roto.** `codigoPedido()` de
`MediacionChatService` **no** devuelve un `PED-<id>`: devuelve el código del vendedor, y ese
string es la llave de `bo_mediacion.pedido_id`. Renombrar solo `rt_pedido_item` dejó huérfanas
las tres mediaciones existentes, con el pedido 20 activo en mediación. Se detectó por casualidad,
al ir a mirar cómo se armaba la llave para agregar el código de soporte.

Se barrieron las **416 columnas de texto** del esquema. La migración `V2026083102` cubre
`rt_pedido_item`, `rt_retiro`, `bo_mediacion` (`pedido_id`, `id_externo`, `titulo`) y
`rt_notificacion.mensaje`.

**Quedan a propósito con el prefijo viejo:**

- `bo_mediacion.url_documento`, `bo_mediacion_evidencia.url` y `rt_mensaje.imagen_url`: el
  código va dentro del **PATH de un objeto real en Cloudflare R2**
  (`/api/v1/uploads/r2/Mediacion/MED-ML-1-PED-000003/...`). Reescribir la ruta en la base no
  renombra el archivo allá: la dejaría apuntando a un objeto inexistente. Las subidas nuevas
  usan el prefijo nuevo y ambos resuelven.
- `bo_log_auditoria.detalle`, que es bitácora de lo que se hizo.

#### `count(*) + 1` en los códigos correlativos

Los códigos de venta y retiro se emitían con `count(*) + 1`. La columna es UNIQUE, así que la
falla no es un número feo: es **un checkout caído en medio de un pago**. Dos problemas:

1. **`count` no es la secuencia.** Cuenta filas —incluidas las que quedaron sin código— y BAJA
   al borrarse una. Verificado en la base dentro de una transacción revertida: con un ítem del
   vendedor 1 borrado, `count + 1` da 17 y **choca** con el `RTP-1-PED-000017` existente,
   mientras `max + 1` da 18 y no choca.
2. Dos checkouts simultáneos del mismo vendedor leían el mismo count.

Se resuelve igual que `PedidoAccesoSupport.siguienteNumeroPedidoComprador`, que ya lo tenía
resuelto para el número del comprador: lock de la fila del proveedor y **después** leer el
máximo. La emisión quedó en un solo lugar, `CodigoVendedorSecuencia`, con 8 tests
(`CodigoVendedorSecuenciaTest`). **Comprobado que el test sirve**: al revertir la
implementación a leer antes de bloquear, fallan 2 de los 8.

**Ojo**: `PedidoService` construye los supports de checkout **a mano** con `new`, no por
inyección, así que cada dependencia nueva hay que pasarla también por su constructor. Y los
dos tests que los construyen necesitaron el mock nuevo — eso solo lo agarra `mvn package`,
`compile` no toca `src/test`.

#### La app móvil no necesita cambios (verificado, no supuesto)

Los tres puntos donde lee `refundStatus`:

- `(buyer)/orders.tsx:157` — sin efecto: para el comprador se conserva si hay cualquier ítem
  cancelado, y un pago `seller-cancel:` solo existe junto a uno.
- `(seller)/pedidos.tsx:581` — sin efecto: esa rama ya exige
  `items.every(status === 'CANCELADO_VENDEDOR')`.
- `order-detail.tsx:109` — **es el arreglo**: al vendedor que no canceló nada deja de decirle
  "Reembolso en proceso".

`codigoSoporte` y `codigoVendedor` son aditivos: la app los ignora. **Pendiente para la app**:
su vista de vendedor sigue cayendo a los últimos 6 del id; debería usar `codigoVendedor`.

#### Verificado

En el navegador, con las **tres cuentas** sobre el pedido 21: comprador `Pedido #16` con
"Productos cancelados −$58.000" y "Total Final $34.990" en lista y detalle; vendedor 1
`Venta #000017` sin banner de reembolso; vendedor 2 `Venta #000001` con subtotal y neto en $0,
sin comisión fantasma y sin acciones. Migración aplicada y las dos mediaciones vuelven a
resolver. `mvn package` ✅, 43 tests del área ✅, build web ✅, lint 0 errores / 98 warnings,
`tsc -b` del backoffice ✅.

#### Lo que queda: la Ruta B

**El estado del pedido sigue siendo uno solo y compartido.** El vendedor 1 todavía puede mover
a "En preparación" un pedido que también es del vendedor 2; solo se impidió que lo mueva quien
ya no participa.

Se evaluaron dos caminos y **se eligió el segundo**:

- **Ruta A — partir el pedido en el checkout, como MercadoLibre.** El costo no está en crear N
  pedidos: está en que **el pago es uno solo**. `Pago` tiene `pedido_id` y toda la cadena
  asume 1:1 (retorno de Flow, reembolsos, conciliación contable, comprobante). Obliga a
  re-probar el flujo de pago completo con la pasarela, que es lo único ya validado con plata
  real. Arrastra mediación, liquidación, retiros y notificaciones. **Descartada** salvo que el
  negocio pida separar la plata desde el pago.
- **Ruta B — un pedido, estado por vendedor, como Falabella.** Estado a nivel de ítem (o una
  tabla `pedido_proveedor`), transiciones por vendedor, y el estado global del pedido pasa a
  ser **derivado**. No toca pagos ni contabilidad. Es §8 de `PLAN_CARRITO_CHECKOUT`.

La lectura ya se comporta como si hubiera subórdenes: `PedidoResponseMapper.toResponse(pedido,
proveedorId)` filtra los ítems y recalcula la liquidación completa del vendedor. **Falta la
escritura.**

### 4.33 Sesión 2026-08-31 (noche) — Ruta B fase 1: estado del pedido por vendedor

Commit: backend `e93cdbc`. **Solo backend; la web no se tocó.**

Cierra la escritura que la 4.32 dejó pendiente: el estado del pedido era uno solo y
compartido, así que en un carrito de dos tiendas el vendedor 1 movía el pedido del vendedor 2.

#### Se eligió la tabla, no el estado por ítem

`RT_pedido_proveedor`, una fila por `(pedido, proveedor)`, UNIQUE. El estado por ítem se
descartó porque **un vendedor con tres líneas despacha UN paquete**: el courier, el tracking,
el comprobante y el PIN son de la suborden, no de la línea, y habría que duplicarlos en N
filas mantenidas iguales a mano.

Eso también corrige el diagnóstico de la 4.32, que hablaba solo del estado. Son **siete**
campos de `RT_pedido` que son del vendedor y se pisaban entre sí: `estado`, `courier`,
`tracking_number`, `comprobante_envio_*`, `valor_envio_informado`, `codigo_retiro` y
`updated_at` (que es el reloj de los 3 días para finalizar: cualquier movimiento del otro
vendedor se lo reiniciaba a este).

#### `pedido.estado` NO se eliminó: se deriva y se persiste

Es la decisión que define el tamaño del cambio. Lo leen 25 archivos —contabilidad, comisiones
del captador, mediación, el job de expiración, `sumTotalComisionCobrada`— más el backoffice y
la app móvil, y varias consultas SQL filtran por esa columna. Materializarlo deja todo eso
funcionando **sin tocar una línea**, y por eso la app móvil no necesitó cambios.

La regla, sobre las subórdenes vivas (`PedidoSubordenSupport.derivar`):

1. ninguna viva → `CANCELADO`;
2. alguna `EN_MEDIACION` → `EN_MEDIACION` (la mediación es del pedido entero: la llave de
   `bo_mediacion.pedido_id` es una sola);
3. si no, **el estado MENOS avanzado**. El comprador ve "En preparación" hasta que despacha
   el último vendedor. Es el modelo Falabella.

`PENDIENTE` y `PAGADO` **no son estados del vendedor**: el pago es uno solo y cruza todas las
vivas a la vez. Recién desde `PAGADO` cada vendedor maneja el suyo.

**Ojo**: si un camino escribe `pedido.estado` sin escribir las subórdenes, el primer recálculo
se lo borra. Pasó con la mediación (`crearReclamo`) y con la expiración de pagos; los dos
tuvieron que marcar las subórdenes además del pedido.

#### El sujeto de la transición

`PedidoTransicionSupport` no se tocó: la misma tabla, aplicada ahora a la suborden. Lo que
cambia es quién es el sujeto — vendedor → la suya; comprador y webhook de pago → todas las
vivas. **La app móvil no manda `proveedorId` y funciona igual**, porque el sujeto se resuelve
desde el solicitante.

Camino de respaldo: un pedido sin subórdenes derivables (sin ítems, o con productos que
perdieron al proveedor) cae al comportamiento de siempre sobre `pedido.estado`. Sin eso queda
inmóvil, y lo destaparon 4 tests existentes.

#### Dos bugs que aparecieron al hacerlo

- **`registrarEnvio` validaba permisos contra `items.get(0)`.** Con dos tiendas, el vendedor
  de la segunda línea recibía **403 al despachar lo suyo**. Ahora busca entre todos los ítems.
- **La ventana de cancelación se medía sobre el pedido.** Si el otro vendedor ya había
  confirmado —pedido en `EN_PREPARACION`— a este se le cerraba la cancelación con "Solo se
  pueden cancelar pedidos pendientes" sin haber hecho nada. Es el mismo bug al revés y no
  estaba anotado. Ahora se mide sobre su suborden.

#### Lo que se descubrió probando en el navegador

Dos fallos que **no** los agarró ningún test ni el build, y que salieron de mirar la pantalla:

1. **La respuesta de la ESCRITURA no estaba scopeada.** `actualizarEstadoPedido` terminaba con
   `toResponse(actualizado)` sin `proveedorId`. La lectura estaba acotada por vendedor desde
   la 4.32, la escritura no. Y la web mezcla esa respuesta sobre lo que tiene en pantalla
   (`{ ...prevSelected, ...merged }` en `ProfileDashboard`), así que **el vendedor confirmaba
   su parte y de golpe le aparecía la línea de la otra tienda**. Con los ítems venían los
   totales del comprador, su banner de reembolso y **su PIN de retiro**, que el mapper solo
   adjunta cuando `proveedorId == null`. Se acotó en `actualizarEstadoPedido`, `registrarEnvio`
   y `crearReclamo`; los otros tres `toResponse` sin scope son caminos solo del comprador.
2. **El vendedor no veía su propio estado.** El DTO seguía mandando `pedido.getEstado()`, o sea
   el derivado. El vendedor confirmaba, la suborden avanzaba en la base, y la pantalla seguía
   diciendo "Pagado" con el botón "Confirmar pedido" puesto: lo pulsaba otra vez y nada.
   **Esto estaba planificado para la fase 2 y fue un error de planificación**: sin ello la
   fase 1 no es un intermedio usable, es una regresión visible. Se adelantó — cuando la
   respuesta va a un vendedor, `estado` es el de su suborden. Todo lo demás del DTO ya venía
   acotado a él desde la 4.32; el estado era lo único que no.

#### Migración y datos existentes

`V2026083103` crea la tabla y hace el backfill con un `INSERT ... SELECT` agrupado por
`(pedido, proveedor)`. El estado se siembra con el del pedido, salvo que **todos** los ítems
de ese vendedor estén cancelados: esa suborden nace `CANCELADO`. Los datos de envío se copian
a todas las filas del pedido, que es exactamente lo que se venía mostrando.

Se validó corriéndola dentro de una transacción revertida antes de aplicarla: **17 subórdenes
sobre 16 pedidos**, con el 21 quedando `vendedor 1 → PAGADO` / `vendedor 2 → CANCELADO`.

Más una red: `asegurarSubordenes()` crea al vuelo la fila que falte, por si un pedido se cuela
entre la migración y el deploy.

**Ojo con `asegurarSubordenes`**: recargar la lista en cada paso vuelve a consultar la tabla y
pierde de vista un cambio recién escrito y sin flush. Los métodos que mueven subórdenes usan
las sobrecargas que reciben la lista ya cargada. Se detectó con un test que fallaba.

#### Verificado

`mvn package` ✅. **54 tests ✅**, 11 nuevos (`PedidoSubordenSupportTest` con la regla de
derivación, más dos de dos tiendas en `PedidoServiceTest`). **Comprobado que los tests sirven**:
al revertir cada uno de los tres arreglos fallan con el síntoma exacto — `expected: <PAGADO>
but was: <EN_PREPARACION>`, `expected: <1> but was: <2>` ítems, y `expected: <EN_PREPARACION>
but was: <PAGADO>`.

En el navegador, pedido 22 (carrito de dos tiendas, pagado por Flow):

- las subórdenes las creó el **checkout** (`created_at` idéntico al del pedido) y el pago las
  cruzó a `PAGADO` **a la vez**;
- vendedor 1 confirma → su suborden `EN_PREPARACION`, la del vendedor 2 intacta, **el pedido
  se queda en `PAGADO`**;
- vendedor 2 ve su venta en "Pagado", ajena, y con "Cancelar Pedido" habilitado;
- vendedor 2 confirma → el pedido avanza **solo entonces** a `EN_PREPARACION`.

#### Trampas del área, confirmadas otra vez

`PedidoService` construye los supports **a mano con `new`**: el repositorio nuevo hubo que
pasarlo por su constructor y por el de los dos tests que lo instancian. Eso solo lo agarra
`mvn package`, `compile` no toca `src/test`.

El `estado` de la suborden es `@Enumerated(STRING)`, así que le aplica la trampa de
`ddl-auto=update`: el CHECK queda congelado con los 8 valores de hoy.

#### Lo que queda (fase 2, la web)

- **La vista del comprador con dos tiendas sigue siendo un bloque único.** Ve el derivado, que
  es correcto, pero no distingue qué tienda va más adelantada. Falta `subordenes[]` en el DTO
  y un bloque por tienda en `OrderDetailModal`.
- **El DTO sigue mandando el `updatedAt` del pedido.** La web lo usa para el contador de los
  3 días antes de finalizar (`orderStatusFlow.js`), y el backend ya valida contra el reloj de
  la suborden: en un pedido de dos tiendas el contador puede no cuadrar con lo que el servidor
  acepta.
- **PIN de retiro por vendedor** (hoy hay uno solo por pedido; se escribe duplicado en la
  suborden a la espera), **liquidación y contabilidad por suborden**, y la vista de vendedor
  de la app móvil, que sigue cayendo a los últimos 6 del id en vez de usar `codigoVendedor`.
- `codigoVendedor` **no se movió** del ítem a propósito: ese string es la llave de
  `bo_mediacion.pedido_id` y aparece dentro de paths de R2 (ver 4.32).

### 4.34 Sesión 2026-09-01 — Ruta B fase 2: la vista del comprador

Commits: backend + web. Cierra lo que la 4.33 dejó anotado como fase 2.

El comprador con dos tiendas veía un bloque único. Su estado —el derivado, el menos avanzado
de las subórdenes vivas— era correcto, pero no le decía cuál de las dos iba más adelantada, y
la lista de repuestos salía plana: **la fila del ítem no muestra la tienda**, así que no había
forma de saber quién despachaba qué.

#### `subordenes[]`, y solo para el comprador

`PedidoSubordenResponseDTO` con siete campos: `proveedorId`, `nombreTienda`, `estado`,
`courier`, `trackingNumber`, `codigoRetiro` y `updatedAt`.

**Al vendedor se le manda `null` a propósito.** Todo su DTO está acotado a él desde la 4.32, y
la web mezcla la respuesta sobre lo que ya tiene en pantalla (`{ ...prevSelected, ...merged }`
en `ProfileDashboard`): mandarle la lista le pintaría la otra tienda dentro de su propia venta,
que es exactamente el bug que la 4.33 arregló.

Lo que **no** lleva, y por qué:

- **Los ítems.** Ya vienen en `items[]` con su `proveedorId`; el cliente agrupa por ahí.
  Duplicarlos es una segunda copia que se puede desincronizar de la primera.
- **El subtotal por tienda.** Se calcula en el cliente. En el DTO sería un segundo total capaz
  de contradecir a `total`, y el comprador paga uno solo.
- **El motivo de cancelación.** No hay columna en `RT_pedido_proveedor`; el motivo vive en los
  ítems. Agregarla es fase 3.

Orden por id de suborden (el de creación del checkout). Sin un orden explícito los bloques se
reordenan entre refrescos según lo que devuelva la BD.

**Las canceladas se incluyen.** Omitirlas dejaría a los ítems de esa tienda sin bloque dueño, y
además son la explicación del `montoReembolsado` que ya se muestra. El estado global no se
contamina: `derivar()` ya las excluye.

#### El cabo del `updatedAt`, resuelto en el backend

La 4.33 lo dejó anotado: el DTO mandaba el `updatedAt` del PEDIDO y la web calcula desde ahí
los 3 días antes de finalizar (`sellerFinalizationAvailability`), mientras el backend ya
validaba contra el reloj de la suborden.

Se arregló donde correspondía: **cuando `proveedorId != null`, `updatedAt` es el de su
suborden**, igual que ya se hacía con `estado`. `orderStatusFlow.js` no se tocó. Y como ese
campo lo lee el mismo DTO que consume la app móvil, allá el contador queda arreglado de paso.

Ojo con el efecto de borde que NO ocurre: `orderPaymentWindow` (los 30 minutos para pagar)
también lee `updatedAt`, pero corre en `PENDIENTE` y en modo comprador, donde `proveedorId` es
nulo. No le llega.

#### De paso, una consulta por fila que se fue

`estadoParaElDestinatario` hacía su propio `findByPedidoIdAndProveedorId`, o sea **una consulta
por cada fila** de la lista de ventas. Ahora hay una sola `findByPedidoId` al principio del
mapper y de ahí salen el estado, el reloj y el desglose.

#### La web, sin una sola clase CSS nueva

Todo en `OrderDetailModal.jsx`:

1. La tarjeta de la tienda (`sellers`, que ya existía) pasa a ser la tarjeta de la suborden:
   badge de estado bajo el nombre y filas de Seguimiento / Courier con los datos de ESA
   suborden. `ENVIADO` con retiro en tienda se muestra "Listo para retirar", igual que
   `OrderCard`.
2. Los repuestos se agrupan por tienda con un `.section-subtitle` por grupo.

**Con UNA tienda no se pinta nada nuevo** (`showSubOrders` exige más de una): son casi todos
los pedidos y el desglose de un solo bloque repite lo que la píldora de arriba ya dice.

**El timeline de arriba no se tocó.** Sigue mostrando el derivado. Partirlo en dos convertiría
la pantalla en dos pedidos, que es el modelo MercadoLibre descartado en la 4.32 — el pago es
uno solo y `Pago.pedido_id` asume 1:1.

Dos ajustes van en `style` inline, y no son decoración:

- `.person-highlight-copy` es un flex column sin `align-items`, o sea `stretch`: sin
  `alignSelf: 'flex-start'` la píldora se estira de lado a lado de la tarjeta.
- `.section-subtitle` trae `margin-bottom: 6px` propio que, sumado al `gap` de
  `.order-items-table`, dejaba el encabezado más cerca del grupo anterior que de sus filas.

Y ojo con las filas nuevas de la lista de datos: `.participant-information-list` usa `>`
(hijo directo). Envolverlas las deja sin recuadro.

#### El PIN de retiro: el backend lo mandaba y NADIE lo pintaba

Salió de mirar la pantalla, no del plan. `grep codigoRetiro` sobre `src/components/` y
`src/pages/` daba **cero resultados**: el campo viajaba en el DTO desde siempre y ninguna vista
lo mostraba, así que **el comprador no tenía de dónde leer su código** para dictárselo al
vendedor. El retiro en tienda estaba cortado de su lado, en todos los pedidos, no solo en los
de dos tiendas.

Y la 4.33 se quedó corta en un punto: decía que el PIN "se escribe duplicado en la suborden".
En los datos reales **ya es por vendedor**: el pedido 22 trae `860797` en la suborden de
Repuestos 1 y `null` en la de Repuestos 2, porque el código se genera al despachar y solo la
que despachó lo tiene.

Se muestra en la tarjeta de la tienda, no en un recuadro global: con dos tiendas son dos
códigos distintos y uno solo arriba no dice a cuál corresponde. Se cae a `order.codigoRetiro`
**solo con una tienda**, para pedidos anteriores al backfill; con dos, el del pedido no dice de
quién es, y pintarlo bajo la tienda equivocada es peor que no pintar nada.

Es lo único de este cambio que también aplica al pedido de una sola tienda.

#### Verificado

`mvn package` ✅, **48 tests ✅** (2 nuevos). **Comprobado que los tests sirven**: al revertir
cada arreglo fallan con el síntoma exacto — `expected: not <null>` para el desglose y
`expected: <2026-08-28…> but was: <2026-09-01…>` para el reloj.

`npm run build` ✅, `npm run lint` → **98 warnings, 0 errores** (baseline exacto).

En el navegador, con el backend local:

- **comprador, pedido 22** (dos tiendas, retiro en tienda): global "En preparación";
  Repuestos 2 → "En preparación", Repuestos 1 → "Listo para retirar" con su PIN; ítems
  agrupados bajo su encabezado;
- **pedido 21** (suborden cancelada): Repuestos 2 con badge "Cancelado" y su ítem tachado, y el
  global sigue "En preparación" porque la cancelada no participa;
- **pedido 20** (una tienda): cero encabezados, cero badges, fila plana. Sin regresión, y el
  PIN sí aparece;
- **vendedor 1** por API: `estado: ENVIADO` (el suyo), `subordenes: null`, un solo ítem.

#### Lo que queda (fase 3)

Sin cambios respecto de la 4.33, menos el PIN: **liquidación y contabilidad por suborden**, y
la vista de vendedor de la app móvil, que sigue cayendo a los últimos 6 del id en vez de usar
`codigoVendedor`. El PIN por vendedor ya está resuelto de este lado; lo que falta allá es que
`pedido.codigoRetiro` (el global, hoy redundante) deje de escribirse.

### 4.35 Sesión 2026-09-01 (tarde) — Ruta B fase 3, parte 1: la plata por suborden

**Sin commitear a pedido del usuario.** Solo backend.

Se entró a hacer "liquidación y contabilidad por suborden" y el diagnóstico de partida resultó
equivocado en su punto principal. Vale la pena dejarlo escrito, porque el próximo que lea la
§4.34 va a llegar con la misma sospecha.

#### El `.findFirst()` NO era el problema de plata

`LiquidacionPedidoCalculator.proveedorItems()` resuelve el proveedor con `.findFirst()` sobre
los ítems, y eso parecía plata mal asignada. **No lo es**: solo alimenta el DTO de LECTURA del
backoffice; el pago real (`Retiro`) no lo llama nunca.

Lo que sí produce es una fila engañosa. En un pedido de dos tiendas, `seller`, `sellerTaxId`,
`sellerEmail` y `sellerLegalName` —**el titular de la cuenta bancaria**— salen del primer ítem,
mientras los importes se calculan sobre las dos. La pantalla dice "Repuestos 2" con los montos
sumados de las dos tiendas. El sistema no paga por ahí, pero la pantalla invita a hacerlo.
**Sigue pendiente** (era el paso 3 y se dejó para otra sesión).

#### Bug de plata 1: el envío se pagaba DOS VECES

El de verdad, y no estaba en el archivo que se fue a mirar.

RepuesTop no despacha nada: despacha cada vendedor y el comprador paga **un envío por
proveedor**. El checkout ya lo cobra así (`costoEnvioPorProveedor` en
`PedidoCheckoutCarritoSupport`), pero después **colapsaba el mapa en una suma** y guardaba solo
`rt_pedido.costo_envio`, tirando el desglose.

Sin el desglose, `RetiroProveedorService.calcularMontoPagarVendedor` le sumaba ese total **a
cada vendedor**. Probado con un test que lo dice textual: **"Se pago 11000 de envio habiendo
cobrado 5500"**.

Y contaminaba además `CaptadorVentaCommissionService`, que calcula la comisión del captador
sobre esa misma base.

El arreglo guarda el envío en la suborden (`V2026090101`), que es donde corresponde: el envío
es de la SUBORDEN, no de la línea —un vendedor con tres productos despacha un paquete y cobra
un envío—.

**Backfill: exacto solo donde no hay nada que repartir.** Un pedido de un vendedor recibe el
total, que es suyo entero. Los de varias tiendas quedan en **NULL a propósito**: ese desglose
no se puede reconstruir, y escribir un reparto inventado lo volvería indistinguible de un dato
real. El cálculo cae a un reparto en partes iguales **solo en memoria** — aproximado por
vendedor, pero mantiene la invariante que le importa a la caja: **no se paga más envío del que
se cobró**. Lo que no se puede hacer nunca es caer al total del pedido, que es el bug.

**Ojo con el divisor**: se cuenta desde los ÍTEMS del pedido, no desde las subórdenes. Un
pedido sin filas daría `size()==0`, se dividiría por 1 y volveríamos a pagar el total a cada uno.

#### Bug de plata 2: el retiro se bloqueaba con el estado DERIVADO

`RetiroProveedorService.obtenerItemsPendientes` filtraba por
`item.getPedido().getEstado() == FINALIZADO`, que es el derivado —el menos avanzado—. Un
vendedor que ya cerró lo suyo **no podía cobrar hasta que el otro finalizara**, y si el otro no
finalizaba nunca, no cobraba nunca.

Es alcanzable en producción a los 3 días: la mayoría de los compradores no pulsa "finalizar",
así que cada vendedor cierra el suyo cuando se le habilita, y entre que cierra el primero y el
segundo el primero no puede cobrar.

Ahora se mide contra su suborden, con **fallback al pedido si falta la fila**: fallar hacia "se
puede retirar" es preferible a dejarle la plata bloqueada por una fila que falta.

#### Bug 3, que destapó el arreglo: la pantalla contradecía al pago

`PedidoResponseMapper` tenía una guarda `pedidoDeUnSoloVendedor` antes de sumar el envío al
total del vendedor. Existía para no inflar el número, pero el precio era mostrarle **cero
envío** al vendedor de un carrito multi-tienda. Desde que la liquidación le paga su parte de
verdad, esa pantalla le muestra menos de lo que va a recibir.

Con el desglose por suborden ya no hay que elegir entre un número inflado y uno en cero.

**Y el primer intento de arreglarlo estuvo mal**, lo cual importa porque el error es fácil de
repetir. Se sumó el envío a `totalRespuesta`, y **la web usa ese campo como "Subtotal
Repuestos"** (`order.subtotal ?? order.total`). Resultado en pantalla: Subtotal $32.000, Envío
$7.000, comisiones, y "Monto Neto a Recibir" $29.277 — **las líneas no daban el total**
(32.000 + 7.000 − 2.723 = 36.277). El neto siempre estuvo bien; lo roto era el desglose.

Lo correcto es **no tocar `total` y acotarle `costoEnvio` al vendedor**: el envío viaja en su
propio campo y se suma una sola vez. Hay un test que fija la invariante
(`elDesgloseDelVendedorCuadraYSuEnvioEsElDeSuSuborden`): `total + costoEnvio − comisiones`
tiene que dar `totalVendedor`.

#### Bug 4: los datos del despacho también eran del pedido

`registrarEnvio` escribe courier, tracking, comprobante y valor informado **en el pedido y en
la suborden**, así que `RT_pedido` conserva los del ÚLTIMO que despachó. El DTO se los mandaba
al vendedor leyéndolos del pedido: **el vendedor 1 podía ver el tracking del vendedor 2.** Es
la fase 1 a medio aplicar — movió las columnas a la suborden y el DTO siguió leyendo el pedido.

#### Y tres campos más, de la misma familia

Salieron de auditar el DTO campo por campo, a propósito, después de los anteriores:

- **`montoReembolsado`**: sumaba los reembolsos de las dos tiendas. `refundStatus` sí venía
  acotado desde la 4.32, el monto no. El vendedor que no canceló nada veía el reembolso del
  otro. Los pagos `REEMBOLSADO` son del pedido entero y no se pueden repartir, así que para un
  vendedor se leen sus ítems.
- **`totalActivo`**: sumaba todos los ítems activos + la comisión del comprador + el envío
  total. Para un vendedor ahora es el valor vivo de SUS líneas a secas; su neto —que sí incluye
  su envío— viaja en `totalVendedor`. Hoy la web no se lo muestra al vendedor
  (`isSeller ? totalSeller : totalActive`), pero se acotó igual.
- **`cancelacionPorBloqueo`**: miraba los ítems de todos, así que al vendedor sano se le
  encendía el aviso por la tienda bloqueada del otro.

**Lección para el próximo**: cada vez que se agrega un campo a este DTO hay que preguntarse si
es del pedido o del destinatario. Van cinco arreglos del mismo tipo en dos sesiones.

#### Verificado en vivo, con el pedido 23

Se creó una compra real de dos tiendas con delivery local y **montos distintos a propósito**
($3.000 y $4.000): con montos iguales, "cada uno el suyo" y "el promedio" dan el mismo número
y la prueba no distingue nada.

- **Checkout**: la base guardó `3000.00` y `4000.00` por separado (no 3500/3500, que sería el
  promedio, ni 7000 a cada uno, que era el bug). Suma = 7000 = lo que pagó el comprador.
- **Pantalla del vendedor**, antes y después de reiniciar con el arreglo:
  Repuestos 1 pasó de `total 29000 / totalVendedor 26277` (sin envío) a `32000 / 29277`;
  Repuestos 2 quedó en `total 62000` = 58000 + **sus 4000**. Y `subordenes: null` en los dos,
  o sea que el scoping de la fase 2 sigue intacto.
- **Retiro**: con la suborden de Repuestos 1 en FINALIZADO y la de Repuestos 2 en ENTREGADO
  (pedido en ENTREGADO), Repuestos 1 pudo retirar **$29.553** y Repuestos 2 vio **$0**. El
  monto confirma el envío correcto: con los 7000 del pedido habrían sido $33.553.
- Flyway: `2026090101 | costo envio por suborden | success = t`.

El escenario del retiro se armó con UPDATE directo y **el pedido 23 se restauró a PAGADO**.

- **Desglose del vendedor en pantalla**, después de corregir el primer intento: Subtotal
  $29.000, Envío $3.000, comisiones, Neto $29.277 — y ahora **las líneas suman**.

`mvn package` ✅ y **83 tests ✅** (6 nuevos). Comprobado que los tests sirven: al revertir cada
arreglo fallan con el síntoma exacto.

#### Por qué el retiro no se pudo probar por la UI

**Hoy el flujo real no puede producir subórdenes divergentes en FINALIZADO.** Los tres caminos
están cerrados: el vendedor necesita 3 días y el backend los exige de verdad
(`PedidoEstadoSupport`, no es solo el botón deshabilitado); el comprador finaliza **todas** las
vivas; y la mediación mete a **todas** las vivas porque la llave de `bo_mediacion` es una sola.

Eso no vuelve teórico al bug —a los 3 días es real—, pero explica por qué hubo que simular el
escenario.

#### Lo que queda

- **La fila del backoffice por vendedor** (el `.findFirst()` de arriba). Es el cambio más
  grande porque parte una fila en N y cambia el contrato de un DTO del backoffice.
- **Finalizar por tienda**: decidido en esta sesión que el comprador debería confirmar y
  finalizar **cada tienda por separado**, como Falabella, en vez de cerrar todas de una vez.
  Es coherente con la Ruta B y es lo que vuelve alcanzable el caso del retiro sin esperar 3
  días. No se hizo.
- La vista de vendedor de la app móvil (sigue cayendo a los últimos 6 del id en vez de
  `codigoVendedor`; el grep confirma que solo `mobile/components/support/DisputesCenter.tsx`
  lo usa hoy) y sacar `pedido.codigoRetiro`, redundante desde la fase 2.
- **En producción NO hay pedidos de dos tiendas con despacho a domicilio**, así que no hay
  plata pagada de más que reconciliar: el arreglo llega antes que el caso.

### 4.36 Sesión 2026-09-01 (tarde/noche) — Ruta B fase 3, parte 2: la fila del backoffice

**Commiteado en el monorepo**: `34633dd` (migración), `fec8cb0` (fase 3.2), `f227fc4`
(subtotal del comprador). Solo backend.

#### Dónde vive el backoffice, que es lo primero que hay que saber

`C:/ProyectoRepuestop/backoffice_sistema/backoffice/frontend`, repo aparte con remoto
**`javiersazo95-glitch/backoffice_sistema`** (no el monorepo). El módulo es
`src/modules/administration/`, y el archivo grande es `AdminFinancePage.tsx` (3.809 líneas).
Hay además un `Backoffice_movil`.

**Ninguno de los dos clientes llama a `/administration/orders`.** Los dos leen
`/administration/bootstrap`. O sea que `PedidoAdminRespuestaDTO` **no tiene consumidores** y
el DTO que se ve en pantalla es `AdministrationOrderDTO`. Ahí se concentra el contrato.

#### La fila se partió en N, una por (pedido, vendedor)

Antes era una por PEDIDO: `seller`, `sellerTaxId`, `sellerEmail` y `sellerLegalName` —el
**titular de la cuenta bancaria**— salían del primer ítem vía `.findFirst()`, y los importes
se calculaban sobre los ítems de todas las tiendas.

Se partió, en vez de dejar una fila con desglose, porque **todo lo que cuelga de esa fila ya
es por vendedor**: `getSettlements()` (en `utils.ts` del backoffice) deriva una liquidación
por fila y las agrupa por `sellerEmail || sellerTaxId || seller` para **emitir la boleta o
factura**, y la nómina BCI paga por vendedor. Una fila con desglose obligaba a reescribir esa
parte igual. La suma de las N filas es idéntica a la fila anterior, así que **los KPIs del
resumen no se mueven**.

**El `.findFirst()` no se borró: se le acotó la entrada.** `resumenItems()` y
`proveedorItems()` siguen mirando el primer ítem, pero reciben solo los de esa tienda.

**Se agrupa por los ÍTEMS, no por las subórdenes.** Repararlas es `asegurarSubordenes()`, que
ESCRIBE, y `getBootstrap` es `@Transactional(readOnly = true)`. La subordén se usa solo para
lo que únicamente ella sabe —estado, reloj y envío— con respaldo al pedido si falta la fila.

#### El id de la fila: `PED-0000023-P2`

**No sirve `codigoVendedor`**: se emite por LÍNEA (`PedidoCheckoutCarritoSupport:312`), así que
un vendedor con tres productos tiene tres códigos y ninguno identifica la subordén. El frontend
usa `order.id` como clave de React, de selección, del mapa de liquidaciones (`LQ-<id>`), del
historial y de `issuedDocuments`: repetirlo colapsa filas.

Ojo: **ese id no puede pasar por `normalizeOrderId()`**, que borra los no-dígitos y pegaría el
23 con el 2. Esa función solo debe seguir viendo `pedido.getId()` para el cruce con
`Mediacion.pedidoId`.

Los documentos tributarios se persisten contra **`retiroId`**, que ya es por vendedor, así que
partir las filas **no huérfana ningún documento emitido**.

#### Dos arreglos que destapó el cambio

- **El estado de la fila era el DERIVADO** (el menos avanzado). Un vendedor que ya cerró lo
  suyo salía "Preparando" hasta que la otra tienda terminara — y como las liquidaciones se
  arman filtrando `status === 'Finalizado'`, **la suya no aparecía aunque su Retiro ya
  estuviera habilitado desde la fase 3.1**. La misma fila se contradecía sola. Igual el reloj
  de los 3 días, que se reiniciaba cuando se movía la otra tienda.

- **`montoPagarVendedor` estaba en el DTO desde siempre y NUNCA se llenaba.** El backoffice
  caía a `subtotal - descuentos`, que no incluye el envío: mostraba **menos de lo que la caja
  transfiere**. Ahora se le pide el número a `RetiroProveedorService.calcularMontoPagarVendedor`,
  el mismo método que emite el pago, en vez de recalcularlo.

`PedidoSubordenSupport` se abrió a `public` **solo** para reusar `costoEnvioDe` desde
`service.admin`; el resto de sus métodos sigue siendo de paquete.

#### Verificado en el backoffice real

Con la base local, entrando al panel: el pedido **22 muestra "Enviado" y "Preparando" en la
misma compra** (antes las dos decían "Preparando"), el **21** deja el "Cancelado" solo en la
tienda que canceló y ya no marca "Cancelado parcialmente" a la sana, y el **23** separa los
envíos de $3.000 y $4.000. Cada fila abre la boleta con el RUT y el titular de SU tienda
(`78.787.878-7 / Elias Elias` vs `87.878.787-8 / Repuestos 2`).

Detalle que confirma que la matemática quedó por tienda: el monto de la boleta da **$276** y
**$1.102**, que es el IVA de la comisión con la tasa propia de cada una — Repuestos 1 es
fundador (5%) y Repuestos 2 va al 10%. Con la fila única no había forma de mostrar las dos.

#### Y el mismo bug de desglose, del lado del COMPRADOR

`PedidoResponseDTO` **no tenía campo `subtotal`** y la web hace `order.subtotal ?? order.total`.
Al vendedor le calzaba de casualidad (su `total` ES su subtotal desde la 3.1); al comprador
`total` trae el envío adentro, así que la pantalla decía **"Subtotal $94.000 + Envío $7.000 =
Total $94.000"**.

El campo es del DESTINATARIO: para el comprador son **todos** los ítems del pedido —el
reembolso de lo cancelado se descuenta en su propia línea más abajo, así que el subtotal es el
cobro original— y para un vendedor sus ítems vivos. La web no se tocó: ningún adaptador rearma
el pedido, el DTO llega crudo al modal.

**Van seis arreglos del mismo tipo en tres sesiones.** Cada campo de este DTO es del PEDIDO o
del DESTINATARIO y hay que decidirlo AL AGREGARLO.

#### El conflicto de Flyway del merge

El commit `deb08a6` del socio trajo una segunda migración `V2026090101` y Flyway aborta el
arranque. Se renumeró **la del socio** a `V2026090102`: la de `costo_envio_por_suborden` ya
está aplicada y validada en la base local, y renombrarla la dejaría como versión faltante y con
checksum ajeno. En dev no había ninguna de las dos aplicadas. **Quien ya la haya corrido en su
base local tiene que borrar la fila 2026090101 de `flyway_schema_history`.**

#### Qué falta

De la fase 3 quedan tres: **finalizar por tienda** (hoy el comprador cierra todas las
subórdenes de una vez), la **vista de vendedor de la app móvil** y sacar `pedido.codigoRetiro`.

Y salieron dos más:

- **El comprador no puede cancelar después de pagar.** El botón existe pero solo en
  `PENDIENTE` (`OrderDetailModal.jsx:179`), respaldado por `PedidoEstadoSupport:265`. La razón
  es buena —cancelar un pagado exige el pipeline de reembolso, que vive en
  `PedidoCancelacionSupport`— pero la ventana es inútil: un pedido sin pagar expira solo. En
  Chile, MercadoLibre deja cancelar hasta que el vendedor despacha y Falabella mientras está
  "En preparación"; los dos cortan **después de pagar y hasta el despacho**. Y hay una
  asimetría fea: **el vendedor sí puede cancelar un `PAGADO` y disparar el reembolso**. El
  pipeline ya existe, falta engancharlo — y debe ser **por subordén**, o cancelarle a una
  tienda mata la compra de la otra.
- En la tarjeta de "Mis Pedidos" el vendedor de un carrito multi-tienda sale como **"Tienda
  RepuesTop"**, que no es ninguna de las dos tiendas reales.
- Dato, no código: **Repuestos 2 no tiene titular de cuenta bancaria cargado** en la base
  local, así que la boleta cae al nombre de la tienda.

### 4.37 Sesión 2026-09-01 (noche) — la cancelación del comprador, por subordén

**Commiteado**: `fc310ca` en el monorepo (backend), `179b72c` acá (web).

#### El punto de partida: había botón, pero no servía

`OrderDetailModal.jsx:179` lo mostraba solo en `PENDIENTE`, o sea **antes de pagar** — y un
pedido sin pagar expira solo, así que en la práctica el comprador nunca tenía una cancelación
real. Además pasaba por la transición genérica de estado, que cancela el **pedido entero** y no
engancha ningún reembolso.

La restricción estaba puesta a propósito (`PedidoEstadoSupport:265`, con su comentario): cancelar
un `PAGADO` exige devolver la plata, y ese pipeline vive en `PedidoCancelacionSupport`. La razón
era buena; el problema es que nadie lo enganchó nunca.

Y había una asimetría fea: **el vendedor sí podía cancelar un `PAGADO` y disparar el reembolso.**
El pipeline ya existía.

Cómo lo resuelven acá: **Mercado Libre** deja cancelar hasta que el vendedor despacha, con
reembolso automático; **Falabella**, mientras el pedido está "En preparación". Los dos cortan
**después de pagar y hasta el despacho**.

#### Lo que hay ahora

`POST /pedidos/{pedidoId}/proveedores/{proveedorId}/cancelacion-comprador`, **por subordén**:
cancelarle a una tienda no puede matar la compra de la otra. Si cae la última viva,
`recalcularEstadoPedido` deja el pedido en `CANCELADO`.

Ventana: `PENDIENTE`, `PAGADO` y `EN_PREPARACION`, medida sobre **su** subordén — que la otra
tienda ya haya despachado no es asunto de esta compra. Se corta en `ENVIADO`, porque a partir de
ahí no es cancelar sino devolver, que es otro flujo y no existe.

Reusa el camino del vendedor: devuelve stock, pide el reembolso a la pasarela, es idempotente por
la clave `buyer-cancel:proveedor:pedido` y, si la pasarela falla, **completa la cancelación igual**
y deja el reembolso para revisión manual — dejarla a medias sería peor, porque el stock ya volvió
y el comprador cree que canceló. El motivo no se le pregunta: es `SOLICITUD_DEL_COMPRADOR` por
definición.

En la web el botón va **dentro de la tarjeta de cada tienda**, no en el pie del modal: con dos
tiendas, uno suelto abajo no dice a cuál le pega. Se eliminó el del pie junto con su estado y su
diálogo, que quedaban muertos.

#### Bug de plata: el reembolso repartía el envío por proporción

En el camino que **ya estaba vivo** (el del vendedor). El monto se calculaba prorrateando el TOTAL
del pedido por la proporción de los subtotales, y ese total trae los envíos de todas las tiendas
adentro. El comprador paga un despacho **por proveedor**, así que repartirlo por proporción
devuelve un número que no es el que puso:

| Cancela | Devolvía | Correcto | Diferencia |
|---|---|---|---|
| Repuestos 1 ($29.000 + $3.000) | $31.333 | $32.000 | el comprador perdía $667 |
| Repuestos 2 ($58.000 + $4.000) | $62.667 | $62.000 | los perdía RepuesTop |

Es la misma confusión que la fase 3.1 sacó de la liquidación, escondida en el reembolso. Ahora es
lo que esa tienda cobró —sus líneas más **su** envío, leído de la subordén con
`PedidoSubordenSupport.costoEnvioDe`— y **lo comparten las dos cancelaciones**.

**Ojo con una diferencia contra el pago**: acá NO se mira `tipoEnvio`. Se devuelve lo que el
comprador puso, sin importar quién iba a recibirlo. Para un retiro en tienda `costoEnvioDe` da
cero solo.

#### `PENDIENTE` no significa "no se pagó"

Lo levantó el usuario preguntando si un pendiente no debería reembolsar. Tiene razón: en
`PedidoPagoSupport` el `Pago` se marca `APROBADO` y **se guarda antes** de mover el pedido a
`PAGADO`, así que si algo falla entre esas dos escrituras queda un `PENDIENTE` con plata cobrada.
Y la tabla de transiciones permite `CANCELADO -> PAGADO`, con un log que dice "pago exitoso
tardío": ya sabían que pasa.

Por eso **el reembolso se decide por el `Pago` en `APROBADO`, nunca por el estado del pedido**.
Eso ya era así, pero era un acierto accidental; hay un test que lo fija
(`unPendienteConPagoAprobadoIgualSeReembolsa`). No "optimizar" esto mirando el estado.

#### Verificado en vivo

Cancelando **Repuestos 2 del pedido 22**. Antes de confirmar, el modal mostraba **un solo botón**:
Repuestos 1 estaba "Listo para retirar" (`ENVIADO`) y no lo ofrecía. Después: subordén 2 en
`CANCELADO`, subordén 1 intacta en `ENVIADO`, el pedido vivo, el ítem en `CANCELADO_COMPRADOR` con
$58.000 de reembolso y la pasarela aceptando la solicitud (`REEMBOLSO_SOLICITADO`, no error).

El pedido 22 quedó con Repuestos 2 cancelado de forma permanente. **El 23 se dejó intacto a
propósito**: es el fixture con los envíos de $3.000 y $4.000 y cancelarlo lo quema.

De la prueba salió un arreglo de copy: el diálogo prometía devolver "su envío" también en un retiro
en tienda.

#### El Guardian marcó un falso positivo

`authz-path-id-var` (high) sobre el `@PathVariable proveedorId`. No aplica: el `usuarioId` sale del
JWT, lo primero que hace el método es `validarDuenoPedido`, y el `proveedorId` solo filtra ítems
**dentro de ese pedido ya validado**. Un id que no está en el pedido deja la lista vacía y sale sin
efectos.

#### Qué queda

De la fase 3: **finalizar por tienda**, la **vista de vendedor de la app móvil** y sacar
`pedido.codigoRetiro`.

Y de esta sesión: **`OrderCard` conserva su botón viejo**, que cancela el pedido completo y solo en
`PENDIENTE`. Ahí no hay pago, así que no hay reembolso en juego, pero queda inconsistente con el
modal.

### 4.38 Sesión 2026-09-01 (noche) — Ruta B fase 3, parte 3: finalizar por tienda

**Sin commitear a pedido del usuario.** Backend + web.

#### El "de una vez" no estaba en el botón

Estaba en tres líneas de `PedidoEstadoSupport`, en cómo se elegía el sujeto de la acción:

```java
subordenSupport.subordenDelUsuario(subordenes, solicitanteId)
        .orElseGet(() -> vivas.isEmpty() ? subordenes : vivas);
```

El vendedor se resuelve solo, porque su usuario mapea a su subordén. **El comprador caía
siempre al `orElseGet`**, o sea a todas las vivas — y no porque se hubiera decidido así para
él, sino porque no tenía forma de decir *cuál*. La máquina de estados, el PIN y
`validarAvanceControlado` ya corrían POR SUBORDÉN dentro del bucle desde la fase 1. Lo único
que faltaba era el sujeto.

#### Lo que hay ahora

**`proveedorId` opcional en `PUT /pedidos/{id}/estado`**, no un endpoint nuevo. La cancelación
se fue a `POST .../cancelacion-comprador` porque traía un pipeline propio (stock, reembolso,
idempotencia); confirmar y finalizar **son la transición genérica**, así que un endpoint aparte
duplicaría `actualizarEstadoPedido` entero — justo el método que la §4.34 dejó como punto
único.

Dos reglas que hay que mantener:

- **`proveedorId` es del COMPRADOR.** A un vendedor se le ignora, porque su subordén se
  resuelve por su usuario y le gana antes de llegar ahí. Sin esa precedencia el campo sería la
  vía para que una tienda le moviera el estado a la otra, que es exactamente lo que la Ruta B
  vino a impedir. Hay test (`unVendedorNoMueveLaSubordenDeOtroMandandoSuId`).
- **Nulo mantiene el alcance histórico** (todas las vivas). De eso dependen la app móvil, el
  listado y el pedido de una sola tienda, que no mandan el campo. También con test.

**Se partieron LAS DOS transiciones, no una.** Partir solo la recepción deja un callejón sin
salida: con la tienda A en `ENTREGADO` y la B en `ENVIADO`, "finalizar" global apunta a las dos,
`validarTransicion` rechaza `ENVIADO -> FINALIZADO` y el botón queda muerto hasta que llegue B.

#### Qué le pasa al pedido con una tienda finalizada y la otra no

Nada nuevo: `derivar` ya lo contestaba y **no se tocó**. `FINALIZADO` tiene avance 5, así que el
pedido se queda en el estado de la otra y solo llega a `FINALIZADO` cuando cierran todas las
vivas. **El timeline del comprador sigue mostrando el derivado y así se queda**: partirlo en dos
convierte la pantalla en dos pedidos, que es el modelo descartado.

Lo que esto destraba es el caso que la §4.35 tuvo que **simular con UPDATE porque la UI no podía
producirlo**: el vendedor de la tienda ya cerrada retira su plata sin esperar a la otra. Los tres
caminos que lo bloqueaban están descritos ahí; este cierra el del comprador.

#### El reloj de los tres días ya estaba peor de lo que parecía

Confirmar la recepción global **arrancaba el reloj de las dos tiendas en el mismo instante**,
aunque una hubiera llegado una semana antes. Partir la recepción lo corrige solo, porque
`@PreUpdate` mueve el `updatedAt` de la subordén tocada y de ninguna otra.

#### Dos defectos de notificación que el cambio destapaba

Los dos con el mismo mecanismo: **el aviso falso QUEMA la clave de deduplicación y el
verdadero se descarta después como duplicado.** No es ruido, es un aviso perdido.

- **`notificarPedidoRecibido` avisaba a TODOS los proveedores del pedido.** Confirmando la
  tienda A, la B recibía "el comprador marcó como recibido" siendo falso, con la clave
  `pedido-recibido:<pedido>:proveedor:<proveedor>` ya gastada. Ahora se acota a las que de
  verdad se movieron; nulo conserva el alcance de antes.
- **El aviso al comprador se disparaba con el estado PEDIDO, no con el derivado.** Confirmar A
  decía "Pedido entregado" con B en viaje y quemaba `pedido-estado:<id>:ENTREGADO`. **Solo
  cuando la acción viene acotada a una tienda** se usa el derivado; el camino del vendedor se
  dejó intacto a propósito (también miente, pero es anterior a esto y tocarlo es otro alcance).

#### Web

- Con **más de una tienda** los botones viven **dentro de la tarjeta de cada tienda**, junto al
  de cancelar, gobernados por `seller.subOrder.estado`. Los del pie se ocultan: uno suelto abajo
  no dice a qué tienda le pega.
- Con **una sola** (que son casi todos) el pie queda **igual que antes**. Es la acción principal
  del comprador y meterla dentro de la tarjeta del vendedor la esconde sin resolver ninguna
  ambigüedad. `showSubOrders` ya gatea así el badge, el tracking y el courier.
- **`OrderCard` deja de ofrecer acciones en un pedido de varias tiendas.** Su botón mandaba la
  transición sin `proveedorId`, o sea que **el split se puenteaba desde el listado**: el
  comprador cerraba las dos tiendas de una. De paso se apagó ahí el "Cancelar pedido" viejo que
  quedó anotado en la §4.37 — mismo agujero, mismo arreglo.
- **El prompt de calificación se decide por el estado que DEVUELVE el backend**, no por el que
  se pidió. `PedidoPostVentaSupport` exige calificar todos los ítems de un pedido
  `ENTREGADO`/`FINALIZADO`; mirando `newStatus`, el modal se abría al confirmar la primera
  tienda y el POST moría en 400.

#### Y la fila del retiro mostraba el id crudo

Salió de la prueba en vivo: la pantalla "Retirar dinero" decía **"Pedido #24"**, que no es
ninguno de los números que existen — el vendedor conoce su `codigoVendedor` y el comprador su
propia secuencia. **El backend ya lo mandaba** en `codigoExterno`; la web lo ignoraba. La regla
de la cola (`RTP-1-PED-000020` -> `#000020`) se extrajo a `sellerCodeShort()` en
`orderIdentity.js` en vez de repetirla: en el backend ese prefijo llegó a estar escrito en siete
sitios.

#### Verificado en vivo con el pedido 24

Compra real de dos tiendas creada por el usuario, con los envíos separados en $3.000 y $4.000.
Ambas subórdenes llevadas a `ENVIADO` y **confirmada solo Repuestos 1**, desde la web:

- Subordén de Repuestos 1 en `ENTREGADO` y luego `FINALIZADO`; la de Repuestos 2 **intacta en
  `ENVIADO`, con su `updated_at` sin mover**.
- `rt_pedido.estado` se quedó en **`ENVIADO`**: el pedido no se dio por cerrado.
- Existe `pedido-recibido:24:proveedor:1` y **no existe** el `:proveedor:2`. Tampoco se creó
  `pedido-estado:24:ENTREGADO`.
- **Repuestos 1 pudo retirar $29.553** con Repuestos 2 todavía en viaje. El monto confirma de
  paso que la plata por subordén de la §4.35 sigue intacta: 29.000 + **sus 3.000** − comisiones.
  Con los 7.000 del pedido habrían sido $33.553, que era el envío pagado dos veces.

`mvn package` ✅ y **107 tests ✅** (4 nuevos). Web: `npm run build` ✅, `npm run lint` **98
warnings / 0 errores**.

#### Qué queda de la fase 3

La **vista de vendedor de la app móvil** (cae a los últimos 6 del id en vez de `codigoVendedor`;
vive en `repuestop/mobile` y es la única que no toca la web) y sacar **`pedido.codigoRetiro`**,
redundante desde que el PIN vive en la subordén.

### 4.39 Sesión 2026-09-01 (noche) — Ruta B fase 3, parte 4: el PIN de retiro por tienda

**Backend + web.**

#### La nota que decía "redundante" estaba equivocada

El pendiente venía anotado como *"sacar `pedido.codigoRetiro`, redundante porque el PIN ya vive
en la subordén"*. **No era redundante: era la fuente.** La subordén guardaba una *copia* —había
tres sitios haciendo `suborden.setCodigoRetiro(pedido.getCodigoRetiro())`— y
`validarEntregaRetiroEnTienda` medía contra el del pedido. La base lo confirmaba: en el pedido
22, las dos tiendas compartían el `860797`.

Lo que eso significa en la calle: **en un carrito de dos tiendas con retiro, el comprador le
dicta a la primera el mismo código que abre la entrega de la segunda.** Cuando no hay courier
que deje trazabilidad, ese PIN es la única prueba de que el pedido se entregó a la persona
correcta, así que compartirlo entre tiendas lo vacía de sentido.

Borrar la columna sin más habría dejado el sistema sin fuente del PIN. Hacerlo bien era generar
uno por tienda.

#### Ojo con el grep: `codigoRetiro` nombra DOS cosas

Además del PIN de 6 dígitos, es el código de un **retiro de dinero** (`RTP-1-RET-000002`) en
`RetiroSocio`, `RetiroAdminResponseDTO`, `RetiroProveedorAdminHelper` y
`CodigoVendedorSecuencia.siguienteCodigoRetiro()`. Un grep a ciegas mezcla las dos familias y la
segunda no tiene nada que ver.

#### Lo que hay ahora

`PedidoRetiroTiendaSupport.asegurarCodigoRetiro(pedido, suborden)` genera el PIN **en la
subordén**, cuando esa tienda queda lista para retirar, y `validarEntregaRetiroEnTienda` lo mide
contra el de **su** subordén. Ningún camino vuelve a copiar el del pedido.

**`V2026090103` copia antes de borrar.** En la base local no hacía falta —los cuatro PIN
históricos ya estaban replicados, porque `asegurarSubordenes` los venía sembrando al reparar
filas—, pero producción puede diferir y un retiro ya anunciado al comprador no puede quedarse
sin código válido. Recién después: `DROP COLUMN`.

**Y borrar la columna obligó a sacar el campo de la entidad `Pedido`.** Con `ddl-auto=update`,
un campo mapeado **RECREA** la columna que la migración acaba de borrar. Quedó un comentario en
el modelo para que nadie lo re-declare.

#### El campo plano del DTO, que es del móvil

`PedidoResponseDTO.codigoRetiro` existe hoy solo para la app móvil, que lee ese campo y **no lee
`subordenes[]`**. Ahora sale de las subordenes **vivas**: con una es el de esa tienda —casi todos
los pedidos, y el móvil sigue igual que siempre—; **con varias va nulo a propósito**, porque el
campo no dice de cuál tienda es y mandar uno hace que el comprador le dicte a una tienda el
código de la otra. La web ya no lo necesita: pinta el de cada bloque desde `subordenes[]`.

Es otra instancia de la regla de la §4.35: cada campo del DTO es del pedido o del destinatario.

#### Verificado en vivo con el pedido 25

Compra real de dos tiendas con retiro en tienda, con cada vendedor marcando "Listo para retirar":

- `V2026090103` en `success = t` y **`rt_pedido.codigo_retiro` ya no existe** (0 filas en
  `information_schema`).
- Repuestos 1 → `790372`, Repuestos 2 → `644024`. **Distintos.**
- Los PIN históricos (pedidos 7, 20 y 22) siguen en su subordén.
- El comprador ve los dos códigos, cada uno bajo su tienda.

`mvn package` ✅ y **110 tests ✅** (3 nuevos: PIN distinto por tienda, el PIN ajeno rechazado, y
el campo plano en nulo con varias tiendas). Web: `build` ✅, `lint` 98 warnings / 0 errores.

**El `mvn package` atrapó un `getCodigoRetiro()` roto en un TEST**, que `mvn compile` habría
dejado pasar hasta el deploy. Es exactamente el caso que CLAUDE.md advierte.

#### Dos arreglos que salieron de la prueba

**1. "Envío dentro de la comuna" se ofrecía a compradores de otra comuna.** Es una tarifa
intracomunal —la tienda reparte ella misma dentro de SU comuna—, así que ofrecerla a alguien de
otra comuna le cobra $4.000 por un despacho que no existe y deja al vendedor obligado a un envío
que no presta. La regla es: si el comprador no es de la comuna del vendedor, solo le quedan el
retiro en tienda y el envío fuera de la comuna.

`PurchaseShippingModal` filtra el método comparando `user.comuna` con `product.ciudadVendedor`,
normalizadas sin tildes (el catálogo de geografía viene sin tildes y las direcciones con ellas,
la misma trampa que `handleSuggestionLocation`). El usuario se lee con `useAuth()` DENTRO del
modal y no por props, porque lo montan la ficha del producto y el carrito y la regla tiene que
ser una sola.

**Se exige coincidencia POSITIVA**: sin comuna del comprador —invitado, o cuenta sin dirección
cargada— tampoco se ofrece. Es una tarifa de excepción y no se puede cobrar sobre un supuesto: el
costo de equivocarse lo paga el comprador, o el vendedor con un despacho que no presta. **El
precio es que un invitado que sí vive en la comuna no la ve hasta identificarse**, y ahí puede
terminar eligiendo el envío fuera de la comuna, que es más caro. Si eso pesa más que el error,
la salida no es relajar el filtro sino pedir la comuna antes de mostrar el modal.

Sin comuna del VENDEDOR no hay con qué comparar y la lista queda intacta: el dato falta del lado
de la tienda y castigar al comprador por eso no arregla nada.

**Y esto es solo la web: el backend no valida la combinación.** Un cliente que mande "Envío
dentro de la comuna" desde otra comuna sigue siendo aceptado en el checkout. La barrera de verdad
va ahí.

**2. El input del PIN de 6 dígitos.** Era un input genérico de 160px pegado al botón, sin
etiqueta, que en el pie del modal se leía como un campo de búsqueda perdido. Ahora es
`.order-pin-entry`: etiqueta, caja monoespaciada con `letter-spacing`, la ayuda de dónde sale el
número, y el botón alineado con la caja y no con el bloque. Lleva `!important` en el input
porque los estilos base de formulario ganan por especificidad y lo devolvían al alto de un input
común.

#### Con esto la fase 3 queda cerrada salvo el móvil

Queda **la vista de vendedor de la app móvil**, que cae a los últimos 6 del id en vez de
`codigoVendedor` y que además tendría que leer `subordenes[]` para mostrar un PIN por tienda.
Vive en `repuestop/mobile` y es la única pendiente que no toca la web.

### 4.40 Sesión 2026-09-01 (noche) — Ruta B fase 3, parte 5: la app móvil

**Solo `repuestop/mobile`.** Con esto la fase 3 queda cerrada.

#### La vista de vendedor mostraba un número que no existe

`getOrderDisplayCode(order, 'seller')` caía a `order.id.slice(-6)` **siempre**: el campo
`codigoVendedor` no estaba en el tipo `BuyerOrderItem` ni en el mapeo, así que la rama de
vendedor no tenía de dónde leerlo. El vendedor veía los últimos 6 dígitos del id interno, que no
es ninguno de los números que existen en el sistema.

Ahora lee `items[].codigoVendedor` y muestra solo la cola (`RTP-1-PED-000020` → `#000020`),
igual que `orderDisplayCode()` de la web. **Las dos implementaciones tienen que coincidir**: si
una cambia el formato, la misma venta se ve con dos números distintos según dónde se mire.

Alcanza a las seis pantallas que lo usan: el panel del vendedor, sus pedidos, el detalle, la
tarjeta de pedido, el chat de mediación y el centro de disputas.

**Había un test que fijaba el bug**: *"mantiene el identificador interno para el vendedor"*,
afirmando `#456789` sobre un id. Se reescribió; el caso del id crudo queda solo como respaldo
para pedidos anteriores a la secuencia por vendedor.

#### Una regresión que dejó la §4.39, ya en `dev`

El PIN por tienda dejó `PedidoResponseDTO.codigoRetiro` en **nulo** para pedidos de varias
tiendas —a propósito: no dice de cuál es—, y el móvil leía exactamente ese campo. Resultado: el
comprador móvil se quedaba **sin código de retiro** en un pedido de dos tiendas.

El móvil no conocía `subordenes[]` en absoluto. Ahora lo mapea a `BuyerOrder.subOrders` y el
detalle pinta **una `PickupCodeCard` por tienda**, con el nombre de la tienda cuando hay más de
una. Sin nombre, dos tarjetas iguales harían que el comprador le dictara a una tienda el código
de la otra, que es justo lo que el PIN por tienda vino a impedir.

**Ojo con el estado que filtra esas tarjetas**: es el de CADA subordén, no el del pedido. El del
pedido es el derivado —el menos avanzado de las vivas—, así que con una tienda todavía en
preparación el comprador no vería el código de la que ya está lista para retirar.

Sin subordenes se cae al campo plano, que es lo que traen los pedidos históricos.

#### El código de soporte

`help.tsx` identificaba el pedido con el número del comprador o el del vendedor. Ninguno de los
dos le sirve a soporte: son secuencias por cuenta, y dos clientes distintos tienen ambos su
"pedido #1". El backend manda `codigoSoporte` (`PED-0000021`) justo para eso y el móvil lo
ignoraba.

Va **además** del número propio, no en su lugar: quitarle al usuario el número que reconoce lo
haría dudar de si eligió el pedido correcto.

#### Verificación

`tsc --noEmit` limpio, `expo lint` **0 errores** (94 warnings preexistentes) y **12 tests en
`utils/__tests__/orders.test.ts`** (6 nuevos: el código del vendedor, su mapeo, el respaldo al
id, el PIN por tienda con el campo plano en nulo, el desglose vacío del vendedor y el código de
soporte).

Suite completa: **84 de 85 suites, 473 tests**. El único fallo es
`components/ads/__tests__/appointments-calendar-modal.test.tsx`, **preexistente** y de la agenda
de anuncios. Ojo: **la suite del móvil es inestable** — dos corridas seguidas dieron 9 y 1
suites fallidos sin ningún cambio en medio. Conviene mirar QUÉ suite falla, no el número.

#### Lo que queda del móvil, que no se hizo

La app **no tiene la cancelación por subordén ni el finalizar por tienda**: sigue mandando la
transición sin `proveedorId`, o sea que el comprador móvil cierra todas las tiendas de una vez.
El backend lo acepta porque nulo mantiene el alcance histórico a propósito, así que no está
roto — está atrasado respecto de la web. Es el mismo trabajo que las §4.38 y §4.37, aplicado a
la app.

### 4.41 Sesión 2026-09-01 (noche) — la Ruta B llega a la app móvil

**Solo `repuestop/mobile`.** Es el trabajo de las §4.37 y §4.38 aplicado a la app: la
cancelación por subordén y el finalizar por tienda.

#### El punto de partida: atrasada, no rota

La app mandaba la transición **sin `proveedorId`**, así que el comprador móvil cerraba todas
las tiendas de una vez. El backend lo aceptaba porque nulo mantiene el alcance histórico a
propósito, de modo que no había error visible: había una acción que hacía de más.

Y no tenía la cancelación por subordén en absoluto — usaba la transición genérica a `cancelled`,
que mueve el pedido entero y no engancha ningún reembolso. Es exactamente el estado del que
partió la web en la §4.37.

#### Capa de datos

`updateBuyerOrderStatus` acepta un cuarto argumento `proveedorId` y `cancelBuyerSubOrder` es
nueva, contra `POST /pedidos/{id}/proveedores/{id}/cancelacion-comprador`. Las mismas dos reglas
del backend: el campo es del COMPRADOR —a un vendedor se le ignora— y nulo mantiene el alcance
histórico, del que depende el pedido de una sola tienda.

#### La sección "Tus tiendas"

El detalle del móvil no tenía tarjetas de tienda: solo una lista plana de productos y, desde la
§4.40, las tarjetas de PIN sueltas. Ahora hay un `SubOrdersCard` con **una tarjeta por tienda**
—estado, seguimiento, su PIN y sus botones (confirmar / finalizar / cancelar)—, que **solo se
pinta con más de una**. Con una sola no hay ambigüedad que resolver y una sección de un bloque
es ruido: ahí el PIN sigue en su tarjeta suelta y las acciones donde estaban.

Es la misma decisión que la web tomó en la §4.38, por la misma razón: un botón suelto no dice a
qué tienda le pega.

**El timeline sigue mostrando el estado derivado** —el del pedido completo— y así se queda.

#### En la lista, las acciones se OCULTAN con varias tiendas

`(buyer)/orders.tsx` tenía "Marcar recibido" / "Finalizar pedido" y "Cancelar pedido" actuando
sobre el pedido entero. Con varias tiendas **el split se puenteaba desde la lista**: el comprador
cerraba las dos de una. Es el mismo agujero que la web tapó en `OrderCard`.

Se ocultan en vez de deshabilitarse: un botón muerto sin explicación se lee como una falla, y la
tarjeta completa ya lleva al detalle.

#### Dos detalles que cuestan un bug si se hacen distinto

- **`busySellerId` en vez de un booleano.** Con un solo flag de "cargando", pulsar en una tienda
  dejaba los botones de la otra girando.
- **La calificación se decide por el estado que DEVUELVE el backend**, no por el que se pidió.
  Con varias tiendas, confirmar la primera deja el pedido todavía en `ENVIADO` y el POST de
  calificaciones responde 400: exige todos los ítems de un pedido `ENTREGADO`/`FINALIZADO`. Es
  el mismo arreglo que la web necesitó en `handleUpdateOrderStatus`.

#### "Por confirmar", que salió de mirar la pantalla

El badge de cada tienda decía **"Pendiente" sobre un pedido ya pagado**, contradiciendo a la
barra de arriba en la misma pantalla. La causa es que `mapBackendStatus` colapsa `PENDIENTE` y
`PAGADO` en un solo `'pending'` —es preexistente y lo comparte toda la app—, así que la tarjeta
no podía distinguirlos. Con el pago aprobado ahora dice **"Por confirmar"**: este badge es de la
TIENDA, y lo que falta ahí es que acepte el pedido. Con el pago fallido o realmente pendiente
sigue diciendo "Pendiente".

#### Verificación

`tsc --noEmit` limpio, `expo lint` **0 errores** (94 warnings preexistentes), **15 tests en
`utils/__tests__/orders.test.ts`** (3 nuevos: el `proveedorId` en la transición, su omisión sin
tienda, y el endpoint de cancelación). Suite completa **84 de 85 suites, 476 tests**; el único
fallo sigue siendo `appointments-calendar-modal.test.tsx`, preexistente.

**Probado a medias.** La sección "Tus tiendas" se verificó en pantalla con el pedido 26 (dos
tiendas, ambas en `PAGADO`): se pinta con las dos tarjetas y sus botones de cancelar. **Las
acciones no se ejercitaron**: confirmar y finalizar por tienda, la cancelación y el
comportamiento de la lista quedaron pendientes de probar.

#### Los fixtures quedaron en este punto

- **Pedido 25**: dos tiendas, retiro en tienda, ambas en `ENVIADO` con PIN `790372` (Repuestos 1)
  y `644024` (Repuestos 2). Sirve para confirmar/finalizar por tienda.
- **Pedido 26**: dos tiendas, despacho a domicilio, ambas en `PAGADO`, envíos **$3.000 y $4.000**
  separados. Sirve para la cancelación: al cancelar Repuestos 2 debe devolver **$62.000** —sus
  líneas más **sus** $4.000—, no una proporción del total.
- **Pedido 23**: intacto, es el fixture original de los envíos $3.000/$4.000 de la §4.35.

**Ojo con un dato que se movió: Repuestos 2 está ahora en Temuco**, la misma comuna que Repuestos
1 y que el comprador. Hubo que moverla para poder armar el pedido 26 con envío intracomunal en
las dos tiendas, justo por el filtro de la §4.39. Dos efectos: **el filtro de comuna no se puede
probar mientras siga así** —hay que devolverla a Penco / Región del Biobío—, y las direcciones
que se ven en pedidos viejos cambiaron, porque salen de la tienda actual y no de una copia
guardada en el pedido.

### 4.42 Sesión 2026-09-02 — el detalle del pedido, rediseñado en web y app

La misma información vivía en tres o cuatro tarjetas que se pisaban, así que para saber **qué le
compró a una tienda, cómo le llega, cuánto costó y si puede cancelarla**, el comprador tenía que
cruzarlas a ojo. Ahora hay **un bloque por tienda** con todo lo suyo dentro, más "Entrega" arriba
y el resumen abajo. Es el modelo de Mercado Libre (un paquete por vendedor) y Falabella (el
estado junto al producto).

Aplica a **todo el modo comprador**, con una tienda o con cinco: dos diseños según cuántas
tiendas tenga el pedido obligan a reaprender la pantalla. **Al vendedor no se le tocó nada** —
necesita la tarjeta del comprador con su dirección para despachar.

#### Lo que el rediseño destapó

Casi todos los hallazgos vinieron de mirar la pantalla, no el código:

- **`totalActivo` sumaba el envío del pedido completo**, incluido el de la tienda cancelada, que
  ya no despacha y cuyo envío se devolvió. $36.000 donde debía decir $32.000. Es el mismo error
  que la fase 3.1 sacó de la liquidación y la 4.37 del reembolso.
- **`storeInfo` del móvil se cargaba solo de `items[0].sellerId`**: con dos tiendas mostraba el
  horario y la dirección de una para las dos. En un retiro, eso manda al comprador al local
  equivocado.
- **El método de envío salía concatenado** ("Envío dentro de la comuna ($3.000), Envío dentro de
  la comuna ($4.000)") en las dos plataformas: es texto libre del checkout y se pintaba como si
  fuera un dato del pedido. El costo real viaja por subordén; el DTO ahora expone `costoEnvio`.
- **El SKU y la referencia OEM mostraban el mismo valor**: `adaptProduct` colapsa
  `referenciaOem`, `skuProveedor` y `codigoInterno` en `oemCode`, que sirve para "un código, el
  que haya" pero no como fuente de dos filas distintas.

#### La calificación, que no era un cambio visual

Se pidió bajar el botón a cada tienda y resultó que `calificarPedido` lo impedía por cuatro
reglas: exigía **todos** los ítems del pedido, rechazaba si alguno ya tenía nota, medía el estado
contra el pedido (el derivado) y **pedía calificar ítems cancelados** — con lo que un pedido con
una tienda cancelada era literalmente incalificable.

**El contrato del endpoint no cambió**: cada `proveedorProducto` ya dice de quién es, así que el
alcance se deduce de los productos enviados. Mandar todos sigue calificando el pedido entero.

#### Tres trampas de front que costaron una iteración cada una

- **`Alert.alert` con botones no existe en Expo web.** El diálogo no aparece, la promesa nunca se
  resuelve y el botón queda mudo sin ningún error. La app ya tenía el patrón resuelto en
  `(buyer)/orders.tsx`; este camino no lo seguía.
- **`position: fixed` roto por un ancestro.** El velo del modal web teñía solo una zona central y
  dejaba los bordes sin oscurecer: un ancestro con `transform`/`filter` se vuelve su bloque
  contenedor. Subir la opacidad no lo arregla — el problema no es el color, es que la caja no
  cubre la ventana. Se montó por `createPortal`, como ya hacían sus propios subdiálogos.
- **`loadingDetails` en las dependencias de su propio `useEffect`.** `setLoading(true)`
  re-ejecutaba el efecto, el cleanup marcaba la respuesta como cancelada y el `finally` nunca
  apagaba el "Cargando…". El endpoint respondía 200 todo el tiempo.

#### Qué se decidió mostrar y qué no

- **El documento tributario va en el RESUMEN**, no por producto ni por tienda: es uno por pedido
  (`Pago.pedido_id` es 1:1). Repetirlo por línea sugeriría que se emiten varios.
- **La garantía bajó a la ficha técnica del repuesto.** Estaba en la tarjeta de envío, que no es
  su sitio: es del repuesto, no del despacho.
- **Dirección y horario del local van en el bloque de su tienda**, juntos: son los dos datos que
  deciden si el comprador puede ir hoy, y con dos tiendas no son los mismos.
- **La tienda cancelada se conserva atenuada y sin acciones**: es el comprobante de cuánto se
  devolvió.
- **El timeline sigue mostrando el estado derivado.**

#### Verificación

Backend: `mvn package` ✅ y **119 tests** ✅ (5 nuevos entre el total vigente y la calificación por
tienda). Web: `build` ✅, `lint` 98 warnings / 0 errores. Móvil: `tsc` limpio, `expo lint` 0
errores, **86 de 87 suites y 489 tests** — el fallo es `appointments-calendar-modal`,
preexistente.

Verificado en vivo con los pedidos 24, 25 y 26: bloques por tienda, cancelación con reembolso de
$62.000, calificación de una tienda y después la otra, y el retiro en tienda con la dirección y
el horario de cada local.

#### 4.42.1 — la vista del vendedor, homologada

El vendedor se quedaba con la vista antigua mientras el comprador tenía la nueva, así que la
misma pantalla hablaba dos idiomas. Ahora comparte la estructura: **"Despachar a"** (el
comprador y su dirección) y **"Tu venta"**, un bloque único —su pedido es siempre de una tienda,
la suya— con sus repuestos, su envío con su costo, su seguimiento y su comprobante.

**Sus acciones siguen en el pie**, no en el bloque: el vendedor despacha con un diálogo propio y
cancela con motivo formal, que no son las acciones por tienda del comprador.

**La trampa: al vendedor `subordenes` le llega NULO a propósito.** Su bloque salía sin
seguimiento, sin courier y con el envío en cero. Los datos se leen del pedido, que para él ya
viene acotado a lo suyo desde la fase 3.1, y en el móvil se le sintetiza una subordén con eso.

**Y al sacar `ShippingDetailsCard` el comprador perdía el comprobante de envío**, que solo se
abría desde ahí. Se movió a la fila de entrega de su bloque.

Se eliminó el JSX muerto en vez de dejarlo tras un `false &&`, y con él las variables que
quedaron huérfanas (`Fragment`, `itemGroups`, `shippingService`, `deliveryCourier`,
`resolveShippingService`). Los baselines vuelven a su valor: **web 98 warnings, móvil 94**.

#### Propuesta anotada: los datos del vehículo para el vendedor

Surgió la idea de mostrarle al vendedor el vehículo del comprador, para validar compatibilidad y
poder cancelar por incompatibilidad. **Hoy no es posible sin trabajo de fondo**: ni `rt_pedido`,
ni `rt_pedido_item`, ni `rt_carrito_item` guardan una sola columna de patente o vehículo —
verificado contra la base. `VehiculoConsultado` existe pero es el registro de consultas de
patente y solo se usa en el seed de desarrollo; nunca se liga a la compra. El vehículo activo
vive en el cliente mientras se navega el catálogo y **se pierde en el checkout**.

Alcance real si se decide hacer: columna nueva y migración, envío del vehículo activo desde el
checkout de web y móvil, campo en el DTO y su mapper, UI en la vista del vendedor, y un valor
nuevo en `MotivoCancelacionPedido` (hoy no hay incompatibilidad). Toca el checkout, que es el
camino de la plata, así que merece su propia sesión.

### 4.43 Sesión 2026-09-02 — el detalle del pedido deja de ser un popup (web)

El detalle se abría como modal, y desde ahí salían más modales: cancelar con motivo, registrar
despacho, calificar, los `ConfirmDialog`. **Popup sobre popup.** Ahora es una página con su
propia URL: `/perfil/pedidos/:orderId`, dentro del panel de perfil.

Lo que se gana no es solo estético: **el "atrás" del navegador funciona, la URL se puede
compartir y recargar en el detalle ya no devuelve al listado vacío.**

#### Cómo se hizo, que es lo que importa para no romperlo

**NO se partió el componente en dos.** `OrderDetailModal.jsx` tenía ~1.550 líneas y unos 25
`useState` — los diálogos, la calificación, el PIN, la tienda en curso —, y repartirlos entre
una "vista" y un "contenedor" es exactamente donde se rompen las cosas ya validadas. En vez de
eso hay **un solo `OrderDetailView` con una prop `layout`**: lo único que cambia entre `modal` y
`page` es el chrome — velo y portal contra cabecera con botón de volver.

**La ruta monta el MISMO `ProfilePage`**, no una página nueva. Así el detalle reutiliza todos
los handlers del panel (avanzar estado, cancelar por tienda, calificar, despachar) sin duplicar
una línea, y lee el pedido del listado que el panel ya carga.

#### Tres trampas

- **`ProfilePage` valida el `tab` contra `PROFILE_TABS` y manda al 404 si no calza.** La ruta
  nueva declara `:orderId`, no `:tab`, así que `tab` llegaba vacío y **la página caía en el 404
  antes de renderizar nada**. La guarda se salta cuando hay `orderId`.
- **La ruta va declarada ANTES de `/perfil/:tab`.** Si no, `pedidos/25` casa con la ruta de
  pestaña tomando "pedidos" como tab y el id se pierde.
- **`selectedOrder` sigue existiendo como buffer.** Los handlers escriben ahí la respuesta del
  backend apenas llega; `invalidateQueries` refresca el listado pero es asíncrono, así que sin
  mezclar ese buffer la acción se veía con retraso. El detalle es
  `{ ...delListado, ...selectedOrder }`, y un efecto lo siembra al entrar a la ruta — porque si
  está vacío, los `setSelectedOrder` de los handlers no tienen a quién actualizar.

#### Compatibilidad

**`?pedido=<id>` sigue funcionando**: lo genera la campana de notificaciones y viaja en correos
ya enviados. Ahora redirige a la ruta con `replace`, para que el "atrás" no devuelva al
parámetro y vuelva a redirigir en bucle.

#### Lo que NO cambió

**Los subdiálogos siguen siendo modales**, y está bien: piden un dato y se cierran. Lo que
desaparece es el modal SOBRE modal. **El móvil no se tocó**: `app/order-detail.tsx` ya era una
pantalla con su botón de volver.

`OrderDetailModal.jsx` se eliminó: dejar dos caminos al mismo detalle es garantía de que uno se
quede atrás.

Verificado en el navegador: clic en la tarjeta → `/perfil/pedidos/25`, contenido completo,
"Volver a mis pedidos" → listado, atrás del navegador → listado renderizado, y URL directa carga
sin pasar por la lista. `build` ✅, `lint` **96 warnings / 0 errores**.

### 4.44 Sesión 2026-09-02 (tarde) — el pedido se cierra solo y la plata se libera

**El problema, en una línea: si el comprador no volvía a entrar, el vendedor no cobraba nunca.**

El único camino a `ENTREGADO` era que el comprador pulsara "Confirmar recepción", y el único
camino a `FINALIZADO` —el estado contra el que `RetiroProveedorService` mide si puede retirar
su plata— era que alguien pulsara "Finalizar" tres días después. En e-commerce la mayoría no
vuelve a entrar después de recibir el paquete. **No había ningún job**: el único `@Scheduled`
sobre pedidos era `expirarPedidosVencidos`, que solo barre `PENDIENTE`.

Se implementó la mitad barata de un plan más grande (ventana de veto de 48h con el vendedor
reportando la entrega). Lo que quedó fuera y por qué está al final.

#### Backend

**El reloj es una columna nueva, no `updatedAt`.** `rt_pedido_proveedor.entregado_at`
(`V2026090201`), escrita UNA vez al entrar a `ENTREGADO`. `@PreUpdate` pisa `updated_at` con
cualquier escritura a la fila —tracking, comprobante, costo de envío—, así que un job
desatendido que mueve plata sobre ese campo reinicia plazos solo. La validación manual de los
tres días venía usando `updatedAt` y arrastraba el mismo defecto.

**El sellado vive en `PedidoSubordenSupport.guardar()`**, que es por donde pasan todas las
escrituras de subórdenes. Va ahí y no en cada llamador a propósito: la lista de bugs de este
dominio es siempre la misma —"un camino escribió el estado y se olvidó de escribir X"—, ya pasó
con `pedido.estado`, con el PIN y con el costo de envío. Un camino nuevo queda sellado sin
saber que el campo existe.

**Dos reglas, ambas por subordén** (`PedidoAutoCierreSupport`):
1. `ENVIADO` sin novedad 10 días → `ENTREGADO`.
2. `ENTREGADO` 72 horas → `FINALIZADO`, y el saldo queda disponible.

**Por qué un plazo único y no uno por modalidad de envío.** El plan pedía 48h para delivery
local y 8 días para courier. Hoy es inaplicable: **`tipo_envio` es columna del PEDIDO, no de la
subordén**, y `PedidoCheckoutCarritoSupport` la deriva colapsando el carrito entero —si una
línea tiene delivery local, el pedido completo queda `local_delivery` aunque la otra tienda
despache por Starken—. Discriminar el plazo sobre ese dato le aplica a una tienda el reloj de
la otra. Separarlos exige antes mover `tipo_envio` a la subordén.

**Lo que el job nunca toca**: subórdenes `EN_MEDIACION`, pedidos `EN_MEDIACION`, y `store_pickup`
(ahí el PIN es la única prueba de entrega y el paquete puede seguir en el mostrador). Un
`tipoEnvio` nulo también queda fuera: la comparación con NULL en SQL no es verdadera, y es la
lectura correcta —de un pedido sin modalidad declarada no se sabe si alguien despachó—.

**`PedidoAutoCierreJob` es un bean APARTE, y esa es la decisión de diseño del cambio.**
`expirarPedidosVencidos` corre todo el barrido en UNA transacción con try/catch por pedido, y
ese patrón miente: la excepción marca la transacción rollback-only, el `catch` imprime el error,
el barrido sigue como si nada y al final revienta el commit entero —ninguno de los pedidos
buenos se guarda—. Acá cada subordén atraviesa el proxy de Spring y abre su propia transacción.
**Meter estos métodos dentro de `PedidoService` no sirve**: una self-invocation no pasa por el
proxy y volveríamos a tener una sola transacción.

Corre a los 15 de cada hora, desfasado de `expirarPedidosVencidos` (cada 5) y de la
sincronización de mediaciones (cada 10). Es idempotente: cada paso revalida estado y plazo antes
de tocar nada —entre el listado y el proceso pasan minutos, y ahí el comprador pudo confirmar o
reclamar— y las notificaciones se deduplican por clave.

Plazos configurables: `repuestop.pedido.autorecepcion.dias=10`,
`.autorecepcion.aviso.dias=7`, `.autofinalizacion.dias=3`.

#### El bug de mediación que esto destapó (y que ya estaba vivo)

**`MediacionBackofficeService` escribía `pedido.estado` sin escribir las subórdenes.** Al
resolver un caso (`resolveCase`, `reactivateAccount`, regla 2A de `blockAccount`) el pedido
pasaba a `ENTREGADO` pero la subordén se quedaba `EN_MEDIACION` para siempre. Como el retiro de
dinero mide la subordén, **resolver a favor del vendedor le dejaba el caso cerrado en pantalla y
el dinero retenido de forma permanente**. Y `derivar` devolvía el pedido a `EN_MEDIACION` en el
primer recálculo, deshaciendo también lo que sí se había escrito.

Lo mismo al ENTRAR (`initMediation`): sin subórdenes en mediación, el primer recálculo devolvía
el pedido a `ENVIADO` —y el barrido nuevo podría haber dado por recibido un pedido en disputa—.
Arreglado con `marcarSubordenesEnMediacion()` y `cerrarSubordenesEnMediacion()`.

#### Notificaciones

Tres nuevas en `PedidoNotificacionSupport`, con la tienda dentro de la clave de deduplicación:
aviso al comprador al día 7 ("en 3 días lo damos por recibido"), aviso de auto-recepción, y
aviso al vendedor de que su saldo quedó disponible. **El aviso previo no es cortesía**: sin él,
el comprador se entera de que perdió la ventana para reclamar cuando ya la perdió, que es justo
lo que el cierre automático viene a evitar.

#### DTO

`entregadoAt` se expone **acotado al destinatario**, igual que `estado`, `updatedAt`, el envío y
el despacho (van seis campos con la misma regla; ver 4.35): para un vendedor es el de SU
subordén, para el comprador el de la última tienda que entregó. Además viaja por tienda en
`subordenes[].entregadoAt`.

#### Web

- **`sellerFinalizationAvailability` ahora cuenta desde `entregadoAt`**, con respaldo a
  `updatedAt` solo para las subórdenes históricas que la migración no alcanzó a sellar. Antes
  contaba siempre sobre `updatedAt`: la pantalla prometía un plazo y el servidor aplicaba otro.
- **`src/data/orderDeadlines.js`** — nuevo. `storeAutoCloseNotice()` traduce estado + relojes de
  UNA subordén al aviso que ve el comprador. **Los plazos son un ESPEJO** de las properties del
  backend, que no las expone por API — mismo caso que `PAYMENT_WINDOW_MINUTES`.
- **Banner de plazo en cada bloque de tienda de `OrderDetailView`**: ámbar mientras corre, rojo
  cuando queda poco. Solo para el comprador: al vendedor el plazo ya se lo dice su botón de
  finalizar, y el aviso está escrito para quien tiene que decidir si reclama.
- **`src/data/carrierTracking.js`** — nuevo. Enlace directo al portal de Starken, Chilexpress,
  Blue Express y CorreosChile. **El nombre del courier es texto libre** que escribe el vendedor
  (`registrarEnvio` lo guarda tal cual), así que el match es por subcadena y devuelve `null` con
  frecuencia: **la UI siempre sigue mostrando el número aunque no haya enlace**.

#### Móvil

Se portó lo mismo, con los archivos espejo de la web:

- **`mobile/utils/carrier-tracking.ts`** y **`mobile/utils/order-deadlines.ts`** — copias de
  `src/data/carrierTracking.js` y `src/data/orderDeadlines.js`. **Las dos listas de couriers y
  los dos juegos de plazos tienen que coincidir**, o el mismo despacho se ve con enlace en un
  cliente y sin él en el otro, y el mismo pedido promete plazos distintos según dónde se mire.
- **`utils/orders.ts` tiraba `sub.updatedAt`**: el campo viajaba en el DTO desde la fase 2 y el
  mapeo no lo copiaba. Sin él no se puede anunciar el plazo de auto-recepción, que corre por
  tienda. Ahora se mapean `updatedAt` y `entregadoAt` por subordén, más `entregadoAt` del
  pedido.
- **`SubOrdersCard`**: banner de plazo y botón "Ver en \<Courier\>" (`Linking.openURL`) dentro de
  la tarjeta de cada tienda, mismos colores que la web —ámbar corriendo, rojo cuando queda poco.
- **La subordén sintética del vendedor** (`app/order-detail.tsx`) también lleva los dos relojes:
  para él el pedido ya viene acotado a lo suyo desde la fase 3.1.

#### FIX (2026-09-03, validando la sesión anterior): `bo_mediacion.pedido_id` no se resolvía

Al probar la prueba 5 del plan de validación (resolver un caso y comprobar que la subordén
sale de `EN_MEDIACION`), el pedido y la subordén NO se movieron pese a que el backoffice
mostró el caso como `RESUELTA`. La causa era un bug **preexistente**, no introducido en la
sesión anterior, pero que dejaba mi propio fix (`cerrarSubordenesEnMediacion`) sin ejecutarse
nunca.

`bo_mediacion.pedido_id` guarda el **codigo_vendedor** (`RTP-1-PED-000016`), no el id del
pedido. Cinco sitios de `MediacionBackofficeService` (`initMediation`, `blockAccount`,
`getProperBuyerName`, `getProperStage`, y `actualizarEstadoPedidoTrasResolucion`) intentaban
recuperar el pedido con `getPedidoId().replaceAll("[^\d]", "")` y `Long.parseLong(...)` --
sacandole solo los digitos al texto. Sobre `"RTP-1-PED-000016"` eso da `"1000016"`: el `1`
del prefijo del proveedor se pega a la cola del vendedor, y el resultado **nunca es el id
real del pedido**. `pedidoRepository.findById(1000016)` no encuentra nada y, como todo
colgaba de un `.ifPresent()` o un `if (pedido != null)`, el fallo era **silencioso**: sin
excepcion, sin log, sin ningun indicio de que la resolucion no habia hecho nada.

El helper correcto **ya existia en la misma clase**, `resolvePedidoByOrderId()` -- usado para
pintar el detalle del caso en el backoffice, pero nunca reutilizado por las cinco funciones
que cambian estado. Resuelve primero por `codigoVendedor` exacto
(`pedidoItemRepository.findByCodigoVendedor`) y solo si eso falla cae al parseo numerico,
que sigue siendo correcto para el formato legado (`"PED-0000020"`, sin el prefijo del
proveedor). Los cinco sitios ahora lo usan.

**Sin este fix, ningun caso de mediacion resuelto a favor del vendedor liberaba la plata**:
la subordén se quedaba en `EN_MEDIACION` para siempre, exactamente el bug que mi cambio de
`cerrarSubordenesEnMediacion` decia arreglar pero que nunca llegaba a ejecutarse.

**Validado de punta a punta contra el ambiente local**: pedido nuevo (comprador) -> reclamo
(subordén y pedido a `EN_MEDIACION`, confirmado en el detalle web) -> `initMediation` desde
el backoffice (crea la fila de `bo_mediacion` en `ESPERANDO_VENDEDOR`, la sincronizacion
programada la levanta) -> resolver el caso -> la subordén sale de `EN_MEDIACION` a
`ENTREGADO` con `entregado_at` sellado en el momento exacto de la resolucion, y
`rt_pedido.estado` queda consistente. `mvn package` y los 78 tests del area en verde.

#### PENDIENTE: el número del pedido en las notificaciones del comprador

Detectado probando esta sesión. El comprador ve **"Pedido #21"** en su listado y le llegó una
notificación que le hablaba de **"RTP-1-PED-000022"** — un código que en su pantalla no existe.

Son tres números distintos para el mismo pedido, cada uno con su dueño (ver la 4.32 y
`src/data/orderIdentity.js`): `numeroPedidoComprador` (`#21`, secuencia por comprador),
`codigoVendedor` (`RTP-1-PED-000022`, secuencia por vendedor) y `codigoSoporte`
(`PED-0000026`, para un tercero).

- **Corregido acá**: `notificarAutoRecepcion` y `notificarAutoRecepcionProxima` usaban
  `getCodigoVendedorParaNotificacion()` para avisarle al COMPRADOR. Ahora hay
  `getCodigoCompradorParaNotificacion()`. `notificarAutoFinalizacion` ya estaba bien: va al
  vendedor, y ahí el código del vendedor es el correcto.
- **Sigue pendiente y es preexistente**: `notificarEstadoPedido` le manda al comprador
  `"PED-" + %07d` —el código de SOPORTE— en todos los avisos de cambio de estado. En la misma
  campana conviven "Pedido enviado — Tu pedido PED-0000026" y el listado que dice "#21".
  **Hay que barrer `PedidoNotificacionSupport` entero decidiendo, aviso por aviso, quién es el
  destinatario**, igual que se hizo con los campos del DTO en la 4.35. Es la misma clase de
  error: un dato correcto para un rol mostrado al otro.

Ojo al reprobar: la clave de deduplicación (`auto-recepcion:<pedido>:proveedor:<prov>`) ya está
quemada para el pedido que se usó de prueba, así que el texto corregido se ve en la SIGUIENTE
auto-recepción, no reenviando la misma.

#### Lo que quedó fuera, a propósito

- **La ventana de veto de 48h** (el vendedor reporta "entregado por Uber/courier" y el comprador
  confirma o veta). Es el pedazo caro: migración, endpoint con subida de comprobante, UI de
  vendedor y comprador en dos clientes, y una superficie de fraude nueva —"el vendedor declara
  entregado sin entregar"—. Con el plazo único, los pedidos ya no se congelan sin ella.
- **PIN para `local_delivery`**: depende de mover `tipo_envio` a la subordén.
- **`LiquidacionPedidoCalculator.proveedorItems()`** sigue con el `.findFirst()` de 4.35: la fila
  de lectura del backoffice muestra el titular bancario de una sola tienda con los montos de las
  dos.

#### Verificación

`mvnw package -DskipTests` ✅ — los dos tests que instancian constructores a mano necesitaban los
parámetros nuevos. **78 tests del área de pedidos + mediación, 0 fallos**, con 7 nuevos en
`PedidoAutoCierreSupportTest` (plazo exacto, exclusión de mediación, sin `entregadoAt`, y la
subordén que cambió de estado entre el listado y el proceso). El **contexto de Spring levanta**
contra el Postgres local, así que las tres `@Query` nuevas parsean y validan contra el modelo. La
migración se corrió contra `repuestop_db` dentro de un `BEGIN … ROLLBACK`: sintaxis OK, el
backfill tocaría 2 filas locales, no quedó nada aplicado. Web: `build` ✅, `lint` **96 warnings /
0 errores**; la lógica de `orderDeadlines` y `carrierTracking` verificada caso por caso en Node.
Móvil: `tsc --noEmit` sin errores nuevos (queda el preexistente de `react-test-renderer`) y la
suite completa en **87/88 suites, 498/501 tests** — el único fallo es
`components/ads/__tests__/appointments-calendar-modal.test.tsx`, el real y preexistente que ya
documenta CLAUDE.md. Hay 9 casos nuevos en `mobile/utils/__tests__/order-deadlines.test.ts`.

**Lo que NO está verificado**: el banner no se vio renderizado contra un pedido real —ni en web
ni en dispositivo; llegar ahí pide backend arriba y sesión iniciada—, y el job no se observó
corriendo en un ambiente.

> **Ojo al desplegar**: en la primera pasada tras el deploy, todo pedido en `ENVIADO` con más de
> 10 días se auto-recibe de golpe (tope de 200 por regla), y 3 días después se finaliza. Si hay
> backlog en `dev`, conviene subir `autorecepcion.dias` para el primer deploy y bajarlo después.
