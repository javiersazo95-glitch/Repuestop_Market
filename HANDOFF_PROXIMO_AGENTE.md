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



