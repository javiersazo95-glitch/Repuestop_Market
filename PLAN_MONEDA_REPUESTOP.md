# Plan — Moneda RepuesTop y arrastre del monorepo `fae41ed` a la web

Fecha de análisis: 2026-08-24. Rama web: `dev`. Rama monorepo: `dev` (`fae41ed`,
ya en `origin/dev`, así que Railway dev debería tenerlo).

Este documento es la libreta técnica de la migración: contiene lo que ya se leyó
del monorepo y de la web, para no volver a abrir esos archivos.

---

## 0. Qué trae el commit `fae41ed` del monorepo

`feat(mobile): moneda RepuesTop, flujo de cotizacion y registro con Google`
— 65 archivos, +3703/−514. Es **casi todo móvil**; el backend son 4 archivos.

### 0.1 Backend (afecta a la web aunque la web no se toque)

| Archivo | Cambio | Impacto web |
|---|---|---|
| `dto/CotizacionConversacionResponseDTO.java` | nuevo campo **`vigenteDesde`** (`OffsetDateTime`) | **SÍ** — la web calcula el vencimiento desde `createdAt` |
| `service/ConversacionService.java` | al guardar/reemitir la cotización setea `updatedAt`; el mapper devuelve `vigenteDesde = updatedAt ?? createdAt` | idem |
| `service/PedidoCheckoutCotizacionSupport.java` | pedido **PENDIENTE** → renueva la intención de pago y devuelve `urlPago`; pedido **CANCELADO** → suelta `conversacion_id` (UNIQUE `V2026072801`) para permitir otro checkout | **beneficio automático**: `CheckoutPage.jsx:276` ya redirige a `order.urlPago` |
| `service/AuthService.java` | registro con `authProvider=GOOGLE`: **dirección opcional** (comprador) y **teléfono opcional** (vendedor). El registro con correo/clave los sigue exigiendo | **SÍ, indirecto**: nacen cuentas sin dirección ni teléfono que después entran a la web a comprar |

### 0.2 Móvil — la Moneda RepuesTop (lo que hay que portar)

- **`mobile/components/ads/RepuestopCoin.tsx`** (nuevo, 304 líneas). Moneda
  dibujada en SVG sobre un `viewBox` de 200×200 centrado en (100,100), con dos
  caras (`front` / `back`) y una serie grabada (`serial`, default `RT-00001`).
  Geometría exacta a replicar:
  - `RIM = 100`, `RING_OUTER = 92`, `RING_INNER = 71`, `RING_MID = 81.5`
  - `ARC_TOP = RING_INNER + 1 = 72` (línea base del texto de arriba, en el borde
    **interno** porque ese texto crece hacia afuera)
  - `ARC_BOTTOM = RING_OUTER - 2 = 90` (línea base de abajo, borde **externo**,
    barrido `0` para que el texto quede derecho y crezca hacia adentro)
  - `MIN_SIZE_FOR_WORDMARK = 64` — bajo ese diámetro se oculta el wordmark
  - Leyendas (`COIN_LEGENDS`): frente arco `REPUESTOP`, frente abajo `FICHA`;
    reverso arco `MÁS VISIBILIDAD, MÁS CLIENTES`, reverso `FICHA OFICIAL`.
    **OJO: el troquel sigue diciendo "FICHA" aunque toda la UI pasó a "moneda".**
  - Degradados: `canto` lineal (0.1,0 → 0.9,1) `#ffffff → #cbd5e1 → #8fa0b3 →
    #cbd5e1 → #f1f5f9`; `aroAzul` (0.15,0 → 0.85,1)
    `#2f6fd0 → #0f4aa8 → #1d5fc4`; `aroPlata` `#f8fafc → #c3ced9 → #e8edf3`; `disco` radial
    (cx .38, cy .3, r .85) `#ffffff → #f2f5f9 → #d3dbe4`
  - Estriado del canto: **96 marcas radiales**, `stroke #e6ecf3`, ancho 1.1,
    entre `RIM-4` y `RIM`
  - Estrellas de 5 puntas (radio interior = `r * 0.45`): dos en el frente sobre
    `RING_MID` a izquierda y derecha; tres en el reverso en `y=134`
  - Reverso: pastilla `#12377e` en `x=60 y=160 w=80 h=15 rx=7.5` con `★ serie ★`
  - Emblema: el logo real de la marca al centro (en web: `/repuestop_icon.png`),
    ancho `size * 0.4` (o `0.46` sin wordmark); en el reverso va al 50% de
    opacidad y desplazado `-size*0.09`, imitando el relieve grabado
  - Wordmark: `Repues` `#243442` + `Top` `#0056BF` (en el reverso ambos `#5b6a7d`)
  - **Los ids de `<defs>` son globales**: hay que sufijarlos por instancia
    (`useId()`), o varias monedas en pantalla se pisan los degradados entre sí.

- **`CoinInfoModal.tsx`** (nuevo, 248). Hoja explicativa "Moneda RepuesTop": las
  dos caras a 122px con las etiquetas `PARTE DELANTERA` / `PARTE TRASERA`
  (pastilla `#1e3a8a`), una fila de 4 ventajas separadas por divisores (Moneda
  exclusiva / Úsala para destacar / Más visibilidad / Impulsa tu negocio) y dos
  bloques: "¿Qué es la Moneda RepuesTop?" y "Segura y confiable".

- **`CoinDropAnimation.tsx`** (nuevo, 222). Lluvia de monedas a pantalla completa.

- **`TokensWalletCard.tsx`** (reescrita). Pasa a **tarjeta con degradado azul de
  marca** `#1d5fc4 → #0f4aa8 → #06285c` (mismo barrido diagonal que el `aroAzul`
  de la moneda), radio 18, sombra. Contiene: moneda de 74px en un badge circular
  de 78px `rgba(226,232,240,.12)` con borde `.28`; etiqueta "Monedero de Monedas
  RepuesTop"; chip verde "Saldo activo" (`rgba(16,185,129,.18)` / `#34d399`);
  saldo 33px `#fff` + "Monedas disponibles"; botón `i` circular `#cbd5e1` que
  abre el `CoinInfoModal`; hint centrado `#d7e3f4` (elegido por contraste ~7:1;
  el `#94a3b8` anterior daba 2.6:1); fila de 3 beneficios con divisores
  (Destacadas 50 `#fbbf24` · Premium 120 `#ddd6fe` · Empresariales 250
  `#6ee7b7`); botón "Recargar monedas" con degradado **plata**
  `#ffffff → #eef3f9 → #ccd8e7`, texto `#0f4aa8`, moneda de 36px y chevron
  anclado a la derecha.
  > **Conflicto de diseño con la web**: el handoff §4.15 dice que en la web el
  > monedero se aplanó a propósito (`.tokens-wallet-bar`, `#0f172a`, sin
  > degradado ni brillo). Ver §3 "Preguntas abiertas".

- **`RechargeTokensModal.tsx`**: `isSuccess` pasa a una máquina de 3 fases
  `'compra' → 'lluvia' → 'resumen'`; la lluvia toma la pantalla completa sobre
  `rgba(8,17,36,.92)` con "¡Listo! / Estamos acreditando tus monedas…" y al
  terminar cede al comprobante. Además: el borde de color ahora significa
  **solo** "seleccionado" (antes el pack popular llevaba borde morado fijo y, por
  ir después en el arreglo, pisaba al seleccionado: se veían dos marcados a la
  vez); se agrega `checkmark-circle` en el pack elegido; monedas reales en vez de
  `circle-multiple`; éxito con moneda de 92px y copy "¡Gracias por confiar en
  RepuesTop!".

- **`TokensHistoryModal.tsx`**: las filas pasan a ser **pulsables** y abren una
  hoja de detalle (`TransactionDetail`) con descripción y fecha completas (en la
  fila van recortadas a 1 línea), monto grande con signo, y filas etiqueta/valor:
  Descripción, Fecha y hora, Movimiento, Monto pagado, Aviso asociado, N.º de
  registro. Encabezado con 4 resúmenes: Recargas, Monedas cargadas, Monedas
  usadas, Total pagado.

- **`UpgradeAdRankModal.tsx`**: monedas reales en vez de círculos ámbar
  (`costCoin` / `balanceCoin` eliminados); el morado `#7c3aed` pasa a
  `colors.primary`; el botón dice `Mejorar por {costo}` con la moneda como unidad
  (el texto completo no entraba en una línea).

- **`CreateAdModal.tsx` + `ads-management.tsx`**: tras mejorar de plan, el
  formulario se abre **saltando a "Beneficios de tu Plan"** (3 reintentos a 450,
  900 y 1500 ms porque el modal entra deslizándose), con borde verde `#059669`,
  un aviso "Desbloqueaste X. Enciéndelo aquí abajo y guarda los cambios" y una
  etiqueta `NUEVO` sobre cada interruptor recién habilitado.
  El plan anterior (`upgradedFromTier`) se captura **en `handleUpgradeSuccess`**,
  que es el último momento en que existe: leerlo después devuelve el plan nuevo y
  la diferencia da vacía.

- **`constants/automotive-ads-data.ts`**: nueva
  `getNewlyUnlockedFeatures(fromTier, toTier)` = features del destino menos las
  del origen. Cubierta por `ad-tier-expiry.test.ts`.

- **`services/ads-storage.ts`**: `spendTokensForAdUpgrade` ahora recibe el
  **anuncio completo** (`ad`) en vez de `(adId, adTitle)`, porque el PUT
  sobrescribe todo el anuncio y mandar 3 campos daba 400.
  **La web ya lo hacía bien**: `UpgradeAdRankModal.jsx` llama
  `spendTokensForAdUpgrade(ad, tier)`. No hay nada que arreglar.

- **Nomenclatura**: en TODA la UI móvil "Ficha(s)" pasó a "Moneda(s)". Los
  nombres internos (`tokens`, `TOKEN_PACKS`, `RT_movimiento_ficha`,
  `/fichas/saldo`) NO cambiaron: es solo texto visible.

### 0.3 Móvil — lo demás

- `utils/images.ts` → `buildProtectedImageSource`: las fotos del chat viven en
  carpetas de `/api/v1/uploads/**` que **exigen sesión**, y un `<Image>` no manda
  cabeceras. Carpetas **públicas** (permitAll) según el móvil: `r2|drive` ×
  `Productos/`, `Perfiles/`, `Plantillas/`, `Publicidad/`. Todo lo demás
  (evidencia de chats de cotización y mediación, KYC) es protegido.
- `utils/purchase-profile.ts` (nuevo): teléfono y dirección se exigen al
  **cotizar, agregar al carro o pagar**, no en el registro. `isOwnStoreProduct()`
  corta la auto-compra antes del checkout (SEC-BACKEND-022 ya la rechaza, pero
  recién al pagar).
- `google-account-card.tsx`, `useAccountTypeScreen`, `auth-google-signup`:
  registro con Google que no pide nombre/correo/clave/teléfono.
- `AdsStoriesCarousel.tsx`: el carrusel no resolvía la ruta de sus fotos.
- `product-catalog-cards.tsx`: imagen genérica por categoría.
- Texto: "Proveedor" → "vendedor de casa de repuestos".

---

## 1. Estado de la web frente a esos cambios (ya verificado)

| Tema | Estado web | Archivo:línea |
|---|---|---|
| Vigencia de la cotización | **Roto igual que el móvil**: usa `createdAt` | `src/utils/quoteFlow.js:70` `getQuoteExpiration()` |
| Consumidores de la vigencia | 3 | `QuoteDetailModal.jsx:162`, `:458`, `CheckoutPage.jsx:99` |
| Retomar pago de cotización | **Ya funciona** con el fix de backend | `CheckoutPage.jsx:276` |
| `spendTokensForAdUpgrade(ad, tier)` | **Ya manda el anuncio completo** | `UpgradeAdRankModal.jsx:56` |
| Moneda RepuesTop | **No existe**. Se usa el icono `Coins` de lucide | `TokensWalletCard.jsx`, `RechargeTokensModal.jsx`, `TokensHistoryModal.jsx`, `UpgradeAdRankModal.jsx` |
| Monedero | Barra plana `#0f172a` (rediseño deliberado de §4.15) | `ads-wall.css:2395` |
| Historial | Lista de solo lectura, sin detalle por movimiento | `TokensHistoryModal.jsx` |
| Recarga | Sin animación; éxito directo | `RechargeTokensModal.jsx` |
| "Fichas" en texto visible | En todas partes | ver §2 fase 2 |
| `getNewlyUnlockedFeatures` | **No existe** (sí `getTierActivatableFeatures`, `automotiveAdsData.js:104`) | |
| Activar mejoras tras subir de plan | **No existe**: `handleUpgradeSuccess` solo refresca saldo y anuncio, no abre el formulario | `AdsManagementSection.jsx:195` |
| Bloqueo de auto-compra / auto-cotización | **No existe** para productos (sí para anuncios, `useAdOwnership.js`) | `ProductDetailPage.jsx` |
| Perfil incompleto (Google sin dirección/teléfono) | **Sin guardas**: el registro web siempre pide dirección (`AuthModal.jsx:298`) pero una cuenta creada con Google desde la APP entra sin ella | |
| Registro con Google (comprador) | **Solo login**; si no existe la cuenta muestra "Verifica que ya tengas una cuenta" | `AuthModal.jsx:245` |
| Imágenes protegidas del chat | **No aplica**: la web no adjunta fotos en el chat de cotización | |

### Insumos web que ya existen y hay que reusar

- `/repuestop_icon.png` en `public/` — el emblema del centro de la moneda.
- `resolveMediaUrl()` / `toMediaPath()` en `src/services/api.js:17` y `:36`.
- Estilos del monedero y de los modales en `src/components/ads/ads-wall.css`
  (2528 líneas): `.tokens-wallet-*` (2395+), `.recharge-modal-card` (1519),
  `.token-pack-card` (1544), `.tokens-history-*` (2362+).
- `.booking-modal-overlay` / `.booking-modal-card` / `.story-close-btn` son las
  clases de modal que ya usan los tres modales del monedero.

---

## 2. Plan por fases

Cada fase cierra con `npm run build` + `npm run lint` (baseline **107 warnings**)
y su propio commit en español.

**Estado: fase 1 cerrada (`ee989dc`), fase 2 cerrada (`b772440`).**

### Fase 1 — Vigencia de la cotización desde `vigenteDesde` *(corrección, chica)*

Backend ya desplegado. `getQuoteExpiration()` toma
`quote.vigenteDesde ?? quote.createdAt`. Sin el cambio, una cotización que el
vendedor reemite llega **vencida** al comprador de la web y no la puede pagar.
Riesgo: nulo (fallback a `createdAt`). **1 archivo.**

### Fase 2 — "Ficha" → "Moneda" en el texto visible *(renombre, mecánica)*

Solo cadenas de UI. **No se tocan** identificadores, claves de `localStorage`
(`repuestop_fichas_balance`), endpoints (`/fichas/*`), campos del DTO
(`cantidadFichas`) ni nombres de tabla; queda anotado al inicio de
`adsStorage.js` para que no se intente después.

Cuidado al hacer el reemplazo: **"ficha" también significa "ficha de producto" y
"ficha técnica del vehículo"** en ~15 archivos (`ProductDetailPage`,
`AboutRepuesTopPage`, `helpContent.js`, `shippingMethods.js`, `index.css`…).
Esos NO se tocan. La moneda solo aparece en `src/components/ads/*`,
`src/services/adsStorage.js` y dos comentarios de `src/services/api.js`.

**Hallazgo de la fase**: el `Pack Avanzado` tenía `priceClp: 19900` mientras se
mostraba y se cobraba como `$19.990`. Ese campo es el `montoPagado` que viaja en
`POST /fichas/compras`, así que cada Pack Avanzado vendido desde la web quedaba
registrado en Administración Contable con **$90 menos**. El móvil siempre tuvo
`19990`. Corregido.

### Fase 3 — El componente `RepuestopCoin` *(la pieza)*

`src/components/ads/RepuestopCoin.jsx`, SVG inline con la geometría de §0.2,
`useId()` para los `<defs>`, `role="img"` + `aria-label`, y el emblema desde
`/repuestop_icon.png`. Se reemplazan los iconos `Coins` de lucide en el monedero,
la recarga, el historial y la mejora de rango.

### Fase 4 — Monedero e info de la moneda

`TokensWalletCard` con la moneda, el botón `i` y `CoinInfoModal` (las dos caras +
las 4 ventajas + los 2 bloques). **Depende de la respuesta a la pregunta A.**

### Fase 5 — Recarga con lluvia de monedas

Máquina `compra → lluvia → resumen`, `CoinDropAnimation` en CSS/keyframes (no
`Animated`), corrección del doble borde del pack popular + `checkmark`, y el copy
nuevo del comprobante. Respetar `prefers-reduced-motion`.

### Fase 6 — Detalle del movimiento en el historial

Filas pulsables → hoja de detalle con los 6 campos. Requiere confirmar qué
devuelve `fetchTokenTransactions()` (`priceClp`, `adId`) contra
`GET /fichas/movimientos`.

### Fase 7 — Activar las funciones recién desbloqueadas

`getNewlyUnlockedFeatures()` en `automotiveAdsData.js`; `handleUpgradeSuccess`
captura el tier anterior ANTES de reemplazar el anuncio y abre `EditAdModal`;
`AdForm` destaca la tarjeta de beneficios y marca `NUEVO` los interruptores
nuevos. En web el salto es `scrollIntoView`, sin los 3 reintentos del móvil.

### Fase 8 — Perfil incompleto y auto-compra *(la que más protege al usuario)*

1. `missingPurchaseProfileFields()` web: bloquear **agregar al carro, cotizar y
   pagar** cuando falte dirección o teléfono, con un enlace al perfil. Hace falta
   porque desde `fae41ed` nacen cuentas Google sin esos datos.
2. `isOwnStoreProduct()`: cortar la auto-compra y la auto-cotización en la ficha
   de producto y en el carrito, como ya hace `useAdOwnership` con los anuncios.

### Fase 9 *(opcional, a decidir)* — Registro con Google para compradores

Hoy el botón de Google en `AuthModal` **solo inicia sesión**. Con el backend
nuevo se podría registrar sin pedir dirección ni teléfono, igual que la app. Es
una funcionalidad nueva, no un arrastre.

---

## 3. Decisiones tomadas (2026-08-24, por el dueño del producto)

**A. Monedero: tarjeta azul igual que la app.** Se porta el degradado
`#1d5fc4 → #0f4aa8 → #06285c`, el chip "Saldo activo", la fila de beneficios y el
botón plata. **Esto revierte a propósito el aplanado del handoff §4.15**: la
decisión de entonces fue "no destaque como isla de otra plataforma", y la nueva es
"las dos plataformas se ven iguales". Si alguien vuelve a leer §4.15, esa anotación
quedó superada por esta.

**B. El troquel dice "FICHA", igual que la app.** Se replica tal cual, aunque la UI
alrededor diga "Moneda": prima que la moneda sea el MISMO objeto en web y app. Si
algún día se corrige, se corrige en las dos a la vez.

**C. Sí se hace la fase 9** (registro con Google para compradores en la web). Con
eso la web también empieza a crear cuentas sin dirección ni teléfono, así que la
**fase 8 tiene que estar cerrada antes** de habilitarla.

**D. El perfil incompleto se exige SOLO en el checkout**, en el paso de envío, que
es donde el dato realmente hace falta. La app corta en tres momentos (carro,
cotizar, pagar) porque no tiene un checkout en pasos; la web sí, y ahí interrumpir
antes sería gratuito. La auto-compra (punto 2 de la fase 8) sí se corta temprano,
en la ficha de producto, porque ahí el problema no es un dato faltante sino una
acción que nunca va a poder completarse.
