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

- Falta ver un rechazo con datos reales (el motivo y su banda roja en la tarjeta). Exige
  cuenta de backoffice o el UPDATE a mano de la seccion 4.7; con una cuenta normal
  `reject` responde 403 (SEC-BACKEND-014).
- Backend: darle a la baja lógica un estado propio para poder retirar el parche de
  `repuestop_ads_deleted`.
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
