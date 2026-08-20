# Plan: vista propia de carrito y checkout

Reemplaza el `CartDrawer` (panel lateral que hoy es carrito + dirección + documento
tributario + checkout, todo junto) por un flujo con URL propia: `/carrito` para revisar
y `/checkout` en pasos para pagar.

Este documento está escrito para poder implementarse **sin releer el código base**:
la sección 1 es el inventario técnico de lo que ya existe.

## 0. Decisiones tomadas (19-08-2026)

| Tema | Decisión |
|---|---|
| Estructura | `/carrito` + `/checkout` en pasos con resumen fijo (patrón Mercado Libre / Falabella) |
| Backend | **No se toca.** Se implementa contra el contrato actual. Subórdenes por vendedor queda como fase futura (§8) |
| Cotizaciones | El pago sale del chat y pasa a `/checkout?cotizacion=ID` |
| Carrito de invitado | Se persiste en `localStorage` |
| Totales | Un solo cálculo compartido en `MarketplaceContext`. **No** se usan los del endpoint del carrito: ver §1.3 |
| "Comprar ahora" del quick view | Se unifica: todos los caminos pasan por selección de envío |
| Suscripciones / Fichas de anuncios | **Fuera de este plan.** Ver §7: el backend registra la compra pero no la cobra |

---

## 1. Inventario técnico (estado actual)

### 1.1 Forma del ítem de carrito

`mapServerCart()` en `src/context/MarketplaceContext.jsx` normaliza el DTO del backend a:

```js
{
  id,             // proveedorProductoId  <- clave de todas las mutaciones en cliente
  cartItemId,     // itemId del backend   <- clave de las llamadas HTTP
  proveedorId,
  titulo, marca, oemCode,
  precio,         // precioUnitario
  quantity,       // cantidad
  stock,          // stockDisponible
  imagen,         // ya pasó por resolveMediaUrl()
  vendedor,       // nombre de la tienda (string)
  shippingMethod, // metodoEnvio         <- POR LÍNEA
  shippingFee,    // costoEnvioLocal     <- POR LÍNEA
}
```

El carrito de invitado guarda objetos de producto crudos + `quantity`, sin `cartItemId`.

### 1.2 API disponible (`src/services/api.js`)

```
getCartApi(usuarioId)                        GET    /usuarios/{id}/carrito
addCartItemApi(usuarioId, payload)           POST   /usuarios/{id}/carrito/items
updateCartItemApi(usuarioId, itemId, p)      PUT    /usuarios/{id}/carrito/items/{itemId}
removeCartItemApi(usuarioId, itemId)         DELETE /usuarios/{id}/carrito/items/{itemId}
checkoutCartApi(usuarioId, payload)          POST   /usuarios/{id}/pedidos/checkout
checkoutConversationQuoteApi(usuarioId, p)   POST   /usuarios/{id}/pedidos/cotizacion/checkout
getAddressesApi(usuarioId)                   (con caché local de tipo de dirección)
getBuyerOrderByIdApi(usuarioId, orderId)
```

`payload` de add/update: `{ proveedorProductoId, cantidad, metodoEnvio, costoEnvioLocal }`.

`payload` de `checkoutCartApi`: `{ direccionId, metodoEnvio, tipoDocumentoTributario,
facturaRut, facturaRazonSocial, facturaGiro }` — todos strings.

`payload` de `checkoutConversationQuoteApi`: `{ productoId, precioUnitario, cantidad,
metodoEnvio, conversacionId, tipoDocumentoTributario, facturaRut, facturaRazonSocial,
facturaGiro, direccionId }`.

Ambos devuelven un `PedidoResponseDTO`; si trae `urlPago`, hay que redirigir a Flow con
`window.location.href` **después** de guardar el pedido en
`sessionStorage['repuestop_last_successful_order']` (contrato de `plan_retorno_flow.md`
Fase 3; `PurchaseSuccessPage` lo lee, y si no está usa `?orderId=` + `getBuyerOrderByIdApi`).

### 1.3 Totales: el comprador NO paga comisión

`GET /usuarios/{id}/carrito` devuelve `CarritoResumenDTO` con `subtotalProductos`,
`comisionServicio` y `totalEstimado`, **pero ninguno sirve como fuente**:
`CarritoService.obtenerCarrito()` hace `comision = BigDecimal.ZERO` y
`total = subtotal`, sin el envío. Usarlos mostraría un total más bajo que el que se cobra.

Y no hay comisión que mostrarle al comprador. En `PedidoCheckoutCarritoSupport`:

```java
BigDecimal comisionComprador = BigDecimal.ZERO;
BigDecimal comisionPasarela  = BigDecimal.ZERO;
BigDecimal total = subtotalComprador.add(costoEnvio);
```

La comisión del 10 / 7 / 5 % (`comisionVendedor`) se le descuenta al **vendedor**. La app
móvil hace lo mismo: `buyerDisplayPrice(p) => p` y `flowFeeAmount() => 0`, así que la fila
"Comisión de pasarela" de su `CheckoutSummary` nunca se pinta.

**Conclusión:** el comprador paga `subtotal + envío`, y el envío se cuenta una vez por
proveedor. Ese cálculo vive en `calcularTotalesCarrito()` dentro de
`MarketplaceContext.jsx` y se expone como `cartTotals` (`{ subtotal, costoEnvio, total }`).
Ninguna vista vuelve a calcularlo por su cuenta.

### 1.4 Cómo calcula el envío el checkout del backend

`PedidoCheckoutCarritoSupport.crearPedidoDesdeCarrito()`:

1. Recorre los ítems del carrito. Para cada uno toma `item.getMetodoEnvio()`; **solo si
   está vacío** cae al `metodoEnvio` del payload.
2. Si el método contiene `delivery|dentro|comuna` → suma `costoEnvioLocal` **una vez por
   proveedor** (`costoEnvioPorProveedor.putIfAbsent`).
3. Si contiene `regiones|courier|fuera|envio` → `tipoEnvio = "courier_por_pagar"`, costo 0.
4. Fallback peligroso: si el ítem no trae costo, hace
   `metodoEnvio.replaceAll("[^0-9]", "")` sobre el string del payload.
5. `pedido.setCourier(metodoEnvio.trim())` guarda el string tal cual.

**Bug latente actual:** `CartDrawer` manda `selectedShippingMethods.join(' | ')`. Con dos
métodos con precio y un ítem sin `costoEnvioLocal` (justo lo que produce el "Comprar
ahora" del quick view, que agrega sin método), el paso 4 concatena los dígitos de ambos:
`"Envío dentro de la comuna ($4.500) | Envío regiones ($3.990)"` → `45003990` → cobra
$45.003.990 de envío. Se corrige en la Fase 1.

### 1.5 Métodos de envío (`src/data/shippingMethods.js`)

Texto libre publicado por la tienda, separado por comas. Helpers ya existentes:

```js
parseShippingMethods(metodosEnvio)  // string|array -> array de strings
resolveShippingService(method)      // -> { name, label, icon, color, bg }
shippingMethodPrice(method)         // "... ($4500)" -> "$4500" | null
shippingMethodCost(method)          // -> 4500 (number)
```

`resolveShippingService` es la **única** fuente del ícono/color de cada método. No crear
tablas nuevas.

### 1.6 Componentes y rutas involucrados

- `src/components/CartDrawer.jsx` (321 líneas) — se elimina en la Fase 6.
- `src/components/PurchaseShippingModal.jsx` (92) — se conserva, cambia su `onConfirm`.
- `src/components/BuyerAddressBook.jsx` — gestor de direcciones, se reusa tal cual.
- `src/components/QuoteDetailModal.jsx:299-338` — `purchaseQuote()`, se vacía en la Fase 5.
- `src/routes/AppLayout.jsx` — monta `CartDrawer`, `AuthModal`, `QuotationRequestModal`.
- `src/routes/paths.js` — mapa único de rutas + helpers de URL.
- `src/routes/useAppNavigation.js` — callbacks `goX` que usan las vistas.
- `src/context/MarketplaceContext.jsx` — estado del carrito (optimista, con debounce por
  ítem de 500 ms y cancelación de "add" en vuelo). **No tocar esa mecánica.**
- `src/pages/PurchaseSuccessPage.jsx` — confirmación post-Flow, se reusa sin cambios.

### 1.7 Paleta (`src/index.css`, `:root`)

```
--color-brand-blue #0066ff   --color-brand-blue-hover #0052cc
--color-brand-navy #1e293b   --color-cyan-glow #38bdf8
--color-emerald-green #059669
--bg-page #f8fafc  --bg-white #fff  --bg-navy-dark #0f172a
--text-primary #0f172a  --text-secondary #334155  --text-muted #64748b
--border-subtle #e2e8f0
--radius-sm 8px  --radius-md 12px  --radius-lg 18px
--font-primary 'Plus Jakarta Sans'  --font-display 'Outfit'
```

---

## 2. Lenguaje visual

El riesgo del rediseño es que salga la vista genérica de IA: tarjetas flotantes con
degradado, iconos grandes centrados, mucho aire y cero densidad. La referencia correcta
es **la boleta de un taller**: un documento denso, alineado, donde los números mandan.

Reglas concretas:

- **Ni un degradado.** Fondos planos (`--bg-white` sobre `--bg-page`). El único acento
  fuerte es `--color-brand-blue` y se reserva para el CTA de pago y el total.
- **Separadores, no sombras.** Las líneas del carrito se separan con
  `border-bottom: 1px solid var(--border-subtle)`, no con una tarjeta por producto.
  Sombra solo en el bloque de resumen fijo (`--shadow-card`), y nada más.
- **Radios chicos.** `--radius-sm`/`--radius-md`. Nada de 24px ni pastillas gigantes.
- **Números tabulares.** Los precios usan `font-family: var(--font-display)` con
  `font-variant-numeric: tabular-nums` y alineación a la derecha, para que las columnas
  cuadren verticalmente como en una factura.
- **Agrupación por tienda como encabezado de sección**, no como tarjeta: una fila con el
  logo pequeño, el nombre de la tienda, y a la derecha su método de envío. Debajo, sus
  productos. Es el patrón de Mercado Libre y es el que hace entendible el multi-tienda.
- **Iconografía sobria**: `lucide-react` a 15-17 px, color `--text-muted`, nunca como
  ilustración centrada. La única excepción es el estado de carrito vacío.
- **Sin emoji, sin copy exclamativo.** "Revisa tu compra", no "¡Ya casi es tuyo!".
- Los pasos del checkout se pintan como una **regla numerada horizontal** (1 Entrega —
  2 Documento — 3 Pago), con el paso activo en navy y los completados con check verde
  `--color-emerald-green`. No usar un stepper con círculos rellenos de color.

Todo el CSS va a `src/index.css` en una sección nueva con banner de comentario,
`/* ===== CARRITO Y CHECKOUT ===== */`, al final del archivo. Reusar clases existentes
donde aplique (las de `.purchase-shipping-*` y `.cart-document-*` ya tienen estilo propio
y sirven de base).

---

## Fase 1 — Fundaciones: estado, totales y rutas ✅ HECHA

Sin UI nueva todavía. Deja el contexto listo para las dos vistas.

> **Corrección aplicada durante la implementación.** La versión original de esta fase
> decía "guardar el resumen del backend en la caché de Query". Al revisar
> `CarritoService` apareció que `comisionServicio` está hardcodeada en cero y
> `totalEstimado` no incluye el envío (§1.3), así que adoptarlos habría **empeorado** el
> total. En su lugar se centralizó el cálculo en el contexto, que además evita tocar los
> cinco `setQueryData` de las mutaciones optimistas. Y se movieron a la Fase 2 el registro
> de las rutas (1.3) y el cambio del botón del header (1.1c), para que no quedara un
> commit con `/carrito` enlazado apuntando a una página vacía.

### 1.1 `MarketplaceContext.jsx`

**a) Totales compartidos.** `calcularTotalesCarrito(items)` calcula
`{ subtotal, costoEnvio, total }` con la misma regla del checkout del backend (el envío se
cuenta una vez por proveedor). Se expone como `cartTotals` y `CartDrawer` ya lo consume en
vez de recalcular. El comentario de la función deja escrito por qué no se usan
`comisionServicio` / `totalEstimado`, para que nadie los "arregle" después.

**b) Persistir el carrito de invitado.**
`guestCartItems` es `useState([])`. Inicializarlo desde `localStorage` con clave
`repuestop_guest_cart_v1` y un `useEffect` que lo escriba en cada cambio, con el mismo
patrón defensivo que `ACTIVE_VEHICLE_KEY` (try/catch, ignorar `'undefined'`, descartar lo
que no sea array). La fusión al iniciar sesión ya existe y sigue funcionando igual.

**c) Reemplazar `openCart`/`closeCart` por navegación. → MOVIDO A LA FASE 2**
(el drawer tiene que seguir funcionando hasta que `/carrito` exista de verdad).
`isCartOpen`/`openCart`/`closeCart` salen del contexto. En su lugar:

- `Header` (`src/components/Header.jsx:308`) — el botón `.cart-trigger-box` navega a
  `ROUTES.cart` en vez de llamar `onOpenCart`. `AppLayout` le pasa `onOpenCart={nav.goCart}`.
- `AppLayout.jsx:100` — el `onLoginSuccess` del `AuthModal` usa `if (!isCartOpen)` para no
  sacar al usuario del carrito al loguearse. Cambiar la condición por
  `if (!location.pathname.startsWith(ROUTES.cart) && !location.pathname.startsWith(ROUTES.checkout))`.

**d) Método de envío limpio para el checkout.** Nuevo helper exportado desde
`src/data/shippingMethods.js`:

```js
/**
 * El checkout del backend recibe UN metodoEnvio, pero el carrito puede tener uno por
 * línea. El método de la línea tiene prioridad en PedidoCheckoutCarritoSupport, así que
 * este valor es solo el fallback: se manda cuando todas las líneas coinciden, y vacío
 * cuando hay mezcla (concatenarlos hacía que el backend sumara los dígitos de ambos
 * precios y cobrara un envío inventado).
 */
export function checkoutFallbackShippingMethod(items) {
  const methods = [...new Set(items.map((i) => i.shippingMethod).filter(Boolean))];
  return methods.length === 1 ? methods[0] : '';
}
```

### 1.2 `src/routes/paths.js`

```js
cart: '/carrito',
checkout: '/checkout',
```

Más el helper `checkoutPath({ cotizacion } = {})` que devuelve `/checkout` o
`/checkout?cotizacion=ID`. Agregar `goCart` y `goCheckout` a `useAppNavigation.js`.

### 1.3 `src/routes/AppRoutes.jsx` → MOVIDO A LA FASE 2

Dos rutas nuevas **dentro** de `<AppLayout>` (llevan header y footer del marketplace):

```jsx
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
...
<Route path={ROUTES.cart} element={<CartPage />} />
<Route path={ROUTES.checkout} element={<RequireAuth><CheckoutPage /></RequireAuth>} />
```

`/carrito` es pública (un invitado tiene que poder ver su carrito); `/checkout` exige
sesión, igual que `/compra-exitosa`.

**Verificación hecha (19-08-2026):** `npm run build` OK; `npm run lint` 169 warnings, el
mismo baseline exacto de antes del cambio. En el navegador: producto agregado como
invitado con "Envío dentro de la comuna ($3000)" → badge en 1, `repuestop_guest_cart_v1`
escrito, **recarga completa de la página y el carrito sigue en 1** (antes se perdía). El
resumen del drawer da $52.900 + $3.000 = $55.900, ahora leído de `cartTotals`.

---

## Fase 2 — `/carrito` ✅ HECHA (vista y ruta; el switch del header va en la Fase 3)

`src/pages/CartPage.jsx` + `src/components/CartLineItem.jsx` +
`src/components/CartStoreGroup.jsx` + `src/components/CheckoutSummaryPanel.jsx`.

> **Estado.** La vista está completa y la ruta registrada, pero el botón "Mi carrito" del
> header **sigue abriendo el drawer** y `ProductDetailPage` sigue llamando `openCart()`:
> mientras `/checkout` no exista, cambiarlos dejaría al usuario sin forma de pagar. El
> switch (1.1c) se hace al final de la Fase 3, cuando el flujo nuevo esté completo.
> Hasta entonces `/carrito` se revisa entrando por URL, y su CTA apunta a `/checkout`,
> que todavía cae en la página 404.
>
> Cambios respecto de lo planificado:
> - `updateCartShipping(productIds, { shippingMethod, shippingFee })` se agregó al
>   contexto; recibe una lista porque el cambio se aplica a todas las líneas de la tienda.
> - `PurchaseShippingModal` acepta `intent='update'` e `initialMethod`, para reusarlo como
>   editor de entrega desde el carrito con el método actual ya marcado.

### Layout

Dos columnas (`grid-template-columns: 1fr 340px`, colapsa a una sola bajo 980 px).

**Izquierda — las líneas, agrupadas por tienda.** `useMemo` que agrupa `cartItems` por
`proveedorId` (fallback `vendedor`). Por grupo:

- Encabezado: nombre de la tienda (link a `storePath({ id: proveedorId, nombre: vendedor })`),
  y a la derecha el método de envío del grupo.
- El método se muestra con `resolveShippingService`. **Los métodos disponibles vienen del
  producto (`product.metodosEnvio`) y el ítem del carrito no los trae.** Decisión: no
  llamar al detalle del producto desde el carrito. El método se elige en
  `PurchaseShippingModal` al agregar (Fase 4) y aquí hay un botón "Cambiar" que reabre ese
  modal con los métodos reales, cargando el producto con `getPublicProductApi(item.id)`
  solo en ese momento.
- Al confirmar un cambio de método hace falta una acción nueva en el contexto,
  `updateCartShipping(productId, { shippingMethod, shippingFee })`, que llame
  `updateCartItemApi` con la misma cantidad. Se aplica a **todas las líneas de esa tienda**
  (el backend cobra un costo de envío por proveedor, así que dos métodos distintos en la
  misma tienda no tienen representación posible).

Cada línea (`CartLineItem`): miniatura 72 px (o `CategoryIconTile` con
`CATEGORY_ICON_BY_ID`/`CATEGORY_COLOR_BY_ID` si no hay imagen, como hoy), título, OEM,
precio unitario, control de cantidad (reusar `onUpdateQuantity`, que ya tiene debounce),
subtotal de línea alineado a la derecha, y "Eliminar" como texto, no como ícono de
basurero rojo.

Añadir lo que el drawer no tiene y sí esperan los usuarios: aviso de **stock** cuando
`quantity >= stock` ("Última unidad disponible" / "Solo quedan N"), y el tag de vehículo
compatible cuando hay `activeVehicle` (ya existe la clase `.item-veh-tag`).

**Derecha — resumen fijo** (`position: sticky; top: 90px`):

```
Productos (N)              $XXX.XXX     <- subtotalProductos del backend
Envío                      $XX.XXX      <- suma de costos por proveedor; "Por coordinar"
                                            si hay courier; "Retiro en tienda" si todo es retiro
Comisión de servicio       $X.XXX       <- comisionServicio del backend
─────────────────────────────────
Total                      $XXX.XXX     <- totalEstimado del backend
[ Continuar la compra ]
```

Bajo el botón: "Compra protegida RepuesTop" con `ShieldCheck` y los medios de pago (Flow /
Khipu), reusando el bloque `.marketplace-payment-methods` que ya existe en el quick view.

El botón navega a `/checkout`. Si no hay sesión, abre `AuthModal` (vía `openAuthModal`) con
`state: { from: ROUTES.checkout }` para continuar ahí al loguearse.

**Bloqueo de avance:** `const missingShipping = cartItems.some(i => !i.shippingMethod)`.
Si hay líneas sin método (las que entran por el botón rápido de `ProductCard`), el CTA
queda deshabilitado y esas líneas muestran "Elige cómo recibirlo" en rojo suave.

**Carrito vacío:** una sola vista centrada, sin ilustración inventada: `ShoppingBag` en
`--text-muted`, título, línea de ayuda y dos botones ("Ver el catálogo" / "Buscar por
patente" → `/repuestos`).

**Errores:** `cartError` del contexto se muestra como banda arriba de las líneas, con su
botón de cierre (`dismissCartError`), tal como en el drawer.

**Verificación hecha (19-08-2026):** `npm run build` OK; lint en 169 warnings (baseline).
En el navegador, como invitado: la vista agrupa por tienda y muestra
$52.900 + $3.000 = $55.900. "Cambiar" abre el editor con el método actual ya marcado y el
CTA "Guardar entrega"; al pasar a retiro en tienda el despacho sale del total ($52.900) y
queda persistido. Con 2 unidades el envío sigue cobrándose **una sola vez** ($3.000, no
$6.000). Con una línea sin método: el grupo queda en "Elige cómo recibirlo", el resumen
dice "Por definir" y el CTA queda deshabilitado con el aviso. Sin errores de consola en
pestaña limpia.

---

## Fase 3 — `/checkout` en pasos ✅ HECHA (falta probarla con sesión)

> **Estado.** `src/pages/CheckoutPage.jsx` + ruta protegida + el switch de la Fase 2:
> el botón "Mi carrito" del header y el "Comprar ahora" de la ficha ahora van a
> `/carrito`. El `CartDrawer` quedó **inalcanzable pero montado**, como respaldo hasta
> confirmar el flujo nuevo contra el backend real; se elimina en la Fase 6.
>
> **Pendiente de verificación:** el recorrido completo con sesión iniciada (direcciones,
> factura, pago) no se pudo probar desde acá porque exige credenciales. Lo verificado es
> la guarda: `/checkout` como invitado redirige al home y abre el login, y `RequireAuth`
> guarda `from: '/checkout'` para volver ahí después de entrar.

`src/pages/CheckoutPage.jsx`. Estado local `step` (`'entrega' | 'documento' | 'pago'`),
sincronizado con `?paso=` en la URL para que el botón "atrás" del navegador funcione.

Guardas de entrada, en este orden:
1. Sin sesión → `RequireAuth` ya redirige.
2. Carrito vacío y sin `?cotizacion=` → `<Navigate to={ROUTES.cart} replace />`.

Layout: misma grilla de dos columnas, con el resumen fijo idéntico al del carrito
(extraerlo a `src/components/CheckoutSummaryPanel.jsx` y usarlo en las dos vistas), más la
regla numerada de pasos arriba.

### Paso 1 — Entrega

- Si **todo** el carrito es retiro en tienda (`resolveShippingService(...).name ===
  'Retiro en tienda'` en todas las líneas): no se pide dirección. Se muestra la dirección
  de cada tienda como dato de retiro y se avanza. La condición actual del drawer
  (`needsAddress`) hace lo mismo con `includes('retiro') || includes('tienda')`;
  mantenerla pero pasando por `resolveShippingService` para no duplicar el string-matching.
- Si no: lista de direcciones (`getAddressesApi`) como **radios con la dirección completa**,
  no un `<select>` — el select del drawer es lo que más abarata la vista. Marca la
  principal (`esPrincipal`) por defecto. "Agregar otra dirección" despliega
  `<BuyerAddressBook usuarioId={userId} />` en línea, como hoy.
- Debajo, el resumen de entrega por tienda: "Tienda X — Envío dentro de la comuna ($4.500)".

### Paso 2 — Documento tributario

Portar tal cual el bloque `.cart-document-*` del drawer (boleta/factura + RUT, razón
social, giro). Precargar desde `user.facturaRut` / `facturaRazonSocial` / `facturaGiro`.
Validaciones: documento obligatorio; con factura, RUT obligatorio, usando `formatRut` e
`isValidRut` de `src/services/adapters.js` (que hoy el drawer no usa).

### Paso 3 — Pago y confirmación

Recapitulación en modo lectura (entrega + documento + líneas), medios de pago, el aviso
"Al pagar aceptas los Términos y Condiciones" (**sin** checkbox, ver §9) y el CTA
`Pagar $XXX.XXX`.

### Reglas de avance (ajuste tras la primera revisión)

El CTA del resumen se **deshabilita** mientras el paso no esté completo, y el resumen
muestra qué falta (`missingForStep`): un botón apagado sin explicación frustra igual que
uno habilitado que no hace nada. El "Volver a <paso>" vive **pegado al CTA** en el panel
del resumen, no al pie del formulario, que es donde la persona está mirando cuando decide
retroceder; los pasos ya completados de la regla numerada también son clicables y lo
muestran al pasar por encima.

`handleCheckout` — igual que `CartDrawer.handleCheckout` pero con el `metodoEnvio` limpio:

```js
const order = await checkoutCartApi(userId, {
  direccionId: needsAddress ? String(selectedAddressId) : '',
  metodoEnvio: checkoutFallbackShippingMethod(cartItems),
  tipoDocumentoTributario: documentType,
  facturaRut: documentType === 'FACTURA' ? invoice.rut.trim() : '',
  facturaRazonSocial: documentType === 'FACTURA' ? invoice.razonSocial.trim() : '',
  facturaGiro: documentType === 'FACTURA' ? invoice.giro.trim() : '',
});
clearCart();
try { sessionStorage.setItem('repuestop_last_successful_order', JSON.stringify(order)); } catch {}
if (order?.urlPago) { window.location.href = order.urlPago; return; }
navigate(ROUTES.purchaseSuccess, { state: { order } });
```

El botón queda deshabilitado con spinner durante la llamada (`Loader2` + `.spin-icon`, ya
existente) y **no** se puede reenviar: guardar un `submittingRef` además del estado, porque
un doble clic antes del re-render crea dos pedidos.

---

## Fase 4 — Unificar las entradas al carrito ✅ HECHA

> **La fase se redujo al revisar el código.** Los puntos 1 y 3 no aplicaban: los
> componentes con botón de "agregar rápido" **no se montan en ninguna parte**.
> `ProductQuickViewModal`, `ProductCard` y `FlashDeals` quedaron sin uso cuando
> `onQuickView` pasó a ser `nav.goProduct` (`CatalogPage`, `HomePage`, `StorePage`), y
> `MarketplaceProductCard` —la tarjeta que sí se usa— no tiene `onAddToCart` (aunque
> `StorePublicProfileView` se lo pasa y ella lo ignora).
>
> O sea que **el único camino vivo para agregar al carrito es la ficha del producto**, y
> ese ya pasa obligatoriamente por `PurchaseShippingModal`. El bug de "se agrega sin
> método de envío" no puede dispararse desde la UI actual; la validación `missingShipping`
> de la Fase 2 queda igual como red para datos viejos del backend.
>
> Queda pendiente de limpieza (fuera de este plan): borrar los tres componentes muertos.

El objetivo es que exista **un solo** camino: elegir envío → carrito.

1. **`ProductQuickViewModal.jsx:236`** — hoy `onAddToCart(product)` sin método de envío
   (origen del bug de §1.4). Cambiar por el mismo `PurchaseShippingModal` que usa la ficha:
   el modal recibe `intent='buy'`, y al confirmar agrega y navega a `/carrito`.
   (La alternativa de mandar a la ficha del producto se descarta: el quick view existe
   justamente para no salir del catálogo.)
2. **`ProductDetailPage.jsx:192`** (`confirmPurchaseAction`) — reemplazar `openCart()` por
   `nav.goCart()`. Con `intent === 'add'` (añadir al carro) **no** navegar: mostrar el
   mini-panel del punto 4.
3. **`ProductCard.jsx:46`** y demás botones "agregar" rápidos — se quedan como están
   (agregan sin método); el método se elige después en `/carrito` con "Cambiar", y el
   bloqueo de la Fase 2 impide llegar al pago sin elegirlo.
4. **Mini-panel de confirmación** ✅ — `src/components/CartAddedToast.jsx`, montado en
   `AppLayout` y controlado por `lastAddedItem` en `MarketplaceContext` (se limpia con
   timeout de 5 s). Panel discreto arriba a la derecha con miniatura, "Agregado a tu
   carrito", el total de ítems y dos acciones. **No se muestra dentro de /carrito ni
   /checkout**: ahí el cambio ya se ve en la lista y el aviso sería ruido. El aviso se
   dispara con el cambio optimista, no con la respuesta del servidor; si la petición
   falla, el rollback y `cartError` se encargan de contarlo.

**Verificación hecha (19-08-2026):** "Añadir al carro" deja al usuario en la ficha y
muestra el aviso con el nombre del producto y "6 productos en el carrito"; a los 5 s
desaparece solo. "Comprar ahora" salta a `/carrito` y ahí el aviso **no** aparece.

---

## Fase 5 — Pago de cotizaciones en el checkout ✅ HECHA (falta probarla con sesión)

> **Ajustes respecto de lo planificado:**
> - `quantityFromLabel` **no** había que moverlo: ya vivía en `src/utils/quoteFlow.js`.
> - `checkoutConversationQuoteApi` necesita el `productoId`, que está en la
>   **conversación** y no en la cotización, y no existe un endpoint para traer una
>   conversación por id. Se resolvió pasando los datos de display por `location.state`
>   desde el chat (mismo patrón que `nav.goProduct`), con respaldo en
>   `getBuyerConversationsApi(userId)` para quien entre por URL directa.
> - El checkout valida la vigencia con `isQuoteExpired` antes de dejar pagar.
> - El total en modo cotización es el precio cerrado (`precioFinal`); el envío no se
>   recalcula porque va acordado dentro de `condicionesEntrega` y lo liquida el backend.
> - `lineItems` va envuelto en `useMemo`: sin eso, los tres `useMemo` que dependen de él
>   se recalculaban en cada render y no memoizaban nada.
>
> **Pendiente de verificación:** el pago con sesión. Verificado que como invitado
> `/checkout?cotizacion=1` redirige al login, y `RequireAuth` guarda el `search` en
> `from`, así que el parámetro sobrevive al inicio de sesión.

`QuoteDetailModal.jsx` tiene su propia copia de dirección + documento tributario +
`purchaseQuote()` (líneas ~299-338). Se elimina esa copia.

1. El botón "Revisar y pagar" del chat navega a `checkoutPath({ cotizacion: quote.id })`.
2. `CheckoutPage` detecta `?cotizacion=ID`, entra en **modo cotización** y carga el detalle
   con `getConversationQuoteApi(conversacionId)` (ya existe en `api.js`). El resumen
   muestra una sola línea con el producto cotizado, precio final y las condiciones de
   entrega del vendedor (`condicionesEntrega`), que **reemplazan** al selector de envío:
   en una cotización el envío ya está acordado.
3. `needsAddress` se calcula desde `condicionesEntrega` (`!includes('retiro')`), como hoy.
4. El pago llama `checkoutConversationQuoteApi` con el payload de §1.2, usando
   `quantityFromLabel()` para la cantidad. Esa función vive hoy dentro de
   `QuoteDetailModal.jsx`; moverla a `src/services/adapters.js` para poder importarla.
5. En modo cotización el carrito **no** se toca (`clearCart` no se llama) y el paso 1 del
   stepper se rotula "Entrega acordada" en modo lectura.

---

## Fase 6 — Limpieza ✅ HECHA

> `CartDrawer.jsx` eliminado, junto con su montaje y sus props en `AppLayout`, y con
> `isCartOpen` / `openCart` / `closeCart` en el contexto. Del CSS salió el bloque completo
> del drawer (~75 líneas), sus reglas sueltas del bloque de resumen y dos restos en media
> queries ajenas (`.cart-drawer-container`, un `.drawer-footer` dentro del media de
> `.purchase-shipping-*`). Se conservaron `.cart-document-*` y `.purchase-shipping-*`,
> que el checkout sí usa.
>
> Antes de borrar se verificó clase por clase cuáles seguían referenciadas desde algún
> `.jsx`: `count-badge`, `total-amount` y `empty-icon` resultaron estar en uso por
> `PartsCatalogView`, `OrderCard`, `QuoteCard` y otros, así que quedaron intactas.
>
> **Verificación:** `npm run build` OK, `npm run lint` en 169 (baseline), cero
> referencias al drawer en el repo, y en pestaña limpia el catálogo y el header cargan
> sin errores de consola con el CSS aplicado.

1. Borrar `src/components/CartDrawer.jsx` y su montaje en `AppLayout.jsx` (y las props
   `cartItems`, `cartError`, `onUpdateQuantity`, `onRemoveItem`, `onClearCart`,
   `onOrderCreated` que el layout solo le pasaba a él).
2. Borrar del contexto `isCartOpen`, `openCart`, `closeCart`.
3. En `src/index.css`, eliminar la sección del drawer (`.cart-drawer-backdrop`,
   `.cart-drawer-panel`, `.drawer-header`, `.drawer-body`, `.drawer-footer`,
   `.empty-cart-state`, `.cart-order-success`, `.btn-proceed-checkout`,
   `.cart-checkout-address`, `.cart-address-*`, `.btn-manage-cart-addresses`).
   Las clases `.cart-document-*`, `.cart-item-*`, `.summary-row`, `.total-row` y
   `.checkout-trust-badge` se **conservan y reusan** en las vistas nuevas.
4. `npm run build` + `npm run lint` (no introducir warnings nuevos).

**Commit sugerido:** `feat(carrito): vista propia de carrito y checkout en pasos`.

---

## 7. Pendiente: suscripciones y Fichas de anuncios

**Sigue fuera de este plan por decisión del usuario (20-08-2026: "dejar para después").**

> **Actualizado tras el pull del monorepo (commit `d19381e`, 20-08-2026).** La versión
> anterior de esta sección decía que no existía backend. Eso ya no es exacto.

### Lo que SÍ existe ahora

- `POST /api/v1/fichas/compras` (`CompraFichaController`) — **registra** una compra de
  fichas ya pagada para que quede en Administración Contable. El comprador se toma de la
  sesión, nunca del body. Payload: `{ cantidadFichas, montoPagado, packNombre,
  metodoPago, referenciaPago }`.
- Entidad `CompraFicha`, `CompraFichaRepository`, `CompraFichaService` (con tests) y la
  migración `V2026082001__create_compra_ficha_publicidad.sql`.
- Vista de backoffice: `CompraFichaAdminDTO` y `ResumenComprasFichaDTO`, en el tab
  Publicidad de Administración Contable.
- `POST /anuncios/imagenes` y `POST /proveedores/{id}/anuncios/imagenes` — subida de
  imágenes del anuncio a R2 (`AnuncioImagenService`). **Solo imágenes**, no CRUD.
- En la app: `mobile/services/token-purchases.ts`, que reporta la compra con cola de
  reintento offline (`@repuestop_compras_fichas_pendientes`, máximo 50).

### Lo que SIGUE sin existir

- **Cobro real.** No hay pasarela para fichas. `rechargeTokensWithPack` acredita el saldo
  local y solo dispara el registro contable sin esperar respuesta; el "Webpay Plus" del
  modal es una etiqueta, no un pago.
- **Saldo en servidor.** `TOKENS_BALANCE_KEY` sigue en AsyncStorage: el saldo vive en el
  dispositivo, se pierde al reinstalar y no se comparte entre la app y la web.
- **Anuncios en servidor.** El CRUD sigue en almacenamiento local en ambas plataformas.
- **Suscripciones.** No hay nada.

### Qué haría falta para cobrarlas de verdad

Saldo de fichas en servidor (hoy en el teléfono), un endpoint que genere la transacción
Flow para un pack (`FlowPasarelaPago` ya existe y es reutilizable) y su webhook, que
acredite el saldo al confirmarse el pago. `POST /fichas/compras` quedaría como lo que es:
el asiento contable, no el cobro. Recién con eso tiene sentido una línea de "servicio
RepuesTop" en el checkout.

Sigue en pie que **no se puede reusar `/pedidos/checkout`**: ese flujo descuenta stock de
`ProveedorProducto`, calcula comisión de vendedor y genera liquidación.

---

---

## 9. Aceptación de términos ✅ PARCIAL (20-08-2026)

> **La versión anterior de esta sección estaba equivocada** al decir que "nadie acepta
> los términos en ningún punto de la web": `FounderRegistration.tsx` —el registro de
> vendedor que monta `/vender`— sí tiene checkbox, validación y manda `acceptsTerms`. El
> grep anterior miró `SellerRegisterModal.jsx`, que no se usa.

### Lo que ya existía en el backend

Nada que crear: `Usuario` tiene `accepts_terms` y `terms_accepted_at`;
`validarComprador` / `validarProveedor` llaman a `validarTerminos()`, que rechaza el
registro si no viene `true`; y `AuthService` persiste ambos campos.

### El bug que apareció al revisarlo

**El registro de comprador de la web estaba roto.** `registerBuyerApi` mandaba `userName`
y el backend exige `firstName` + `lastName`, además de `direccion` (con `comunaId` y
`calleYNumero`) y `acceptsTerms`. Fallaba con `400 firstName es obligatorio` antes de
llegar a la base. No lo trajo ningún pull: el DTO no se toca desde `a0949d4`.

Resuelto: `registerBuyerApi` manda el contrato completo, y `AuthModal` suma el campo de
dirección (con el autocompletado de §10, que resuelve el `comunaId` solo) y el checkbox
de términos con enlaces a `/terminos` y `/privacidad`.

**Verificado contra el backend real:** sin marcar el checkbox el envío se bloquea con
"Debes aceptar los Términos y Condiciones para crear tu cuenta"; marcándolo, el registro
responde `200` y queda en el log de `AuthService`.

### La versión del documento ✅ HECHA (20-08-2026)

Implementado en el monorepo (commit `de9c24e`, rama `dev`).

- Tabla `RT_aceptacion_terminos` append-only: `usuario_id`, `documento`
  (COMPRADOR | VENDEDOR | PRIVACIDAD), `version`, `aceptado_en`, `ip`, `user_agent`,
  `origen` (REGISTRO | REACEPTACION | BACKFILL). `accepts_terms` / `terms_accepted_at`
  se quedan en `RT_usuario` como caché de la última aceptación.
- La migración trae **backfill**: sin él, todos los usuarios existentes aparecerían como
  "nunca aceptaron". Inserta las dos filas por usuario.
- **La versión vigente la decide el backend** (`repuestop.legal.version-vigente`). El
  cliente informa cuál mostró y se compara; si no coincide, se rechaza con un mensaje
  que pide actualizar. Si no manda versión, se asume la vigente: bloquear ahí dejaría
  sin registrarse a quien tenga la app desactualizada.
- **IP y user agent salen de la petición HTTP, nunca del body.** Son evidencia.
- `POST /users/perfil/aceptar-terminos` para re-aceptar sin recrear la cuenta, y
  `requiereAceptarTerminos` en `PerfilUsuarioDTO`.
- Web y app mandan `LEGAL_VERSION_CODE` (`2026-08-19`), un código estable aparte de
  `LEGAL_VERSION` (`19 de agosto de 2026`): comparar el texto largo en español entre
  tres plataformas es frágil, basta una tilde para pedirle re-aceptar a todo el mundo.
- Web: `TermsReacceptanceModal` montado **sobre las rutas** en `App.jsx` (el perfil vive
  fuera de `AppLayout`). Muestra el texto completo **dentro** del aviso en pestañas
  —términos del rol y privacidad—, reusando `LegalDocument`. No lleva a otra pestaña:
  la primera versión enlazaba a `/terminos` y el propio aviso terminaba tapando el texto
  ahí. Sin botón de cerrar (seguir usando implica aceptar) pero con "Cerrar sesión" como
  salida.

**Un error que costó encontrar:** el botón decía "Acepto ambos documentos" pero solo se
guardaba una fila; `DOCUMENTO_PRIVACIDAD` estaba definido y nunca se usaba. Apareció al
revisar la base después de una prueba real. `registrarAceptacionCompleta()` escribe las
dos filas y `requiereAceptar()` exige ambas.

**Verificado en la base local** con los dos usuarios reales: comprador (`COMPRADOR` +
`PRIVACIDAD`) y vendedor (`VENDEDOR` + `PRIVACIDAD`), con su IP y user agent. El registro
por API guardó el `User-Agent` de la petición, que confirma el sellado del servidor.

### Pendiente menor

En dev, Flyway está deshabilitado (`spring.flyway.enabled=false`) y manda
`ddl-auto=update`: la tabla la crea Hibernate y **el backfill no corre**. En local hay
que ejecutarlo a mano; en producción lo aplica la migración.

---

## 8. Fase futura: subórdenes por vendedor

Documentado para cuando se coordine con la app móvil. Hoy `Pedido` es la raíz de estados,
liquidaciones, retiros y mediación, y `updateOrderStatusApi(orderId, estado, pin)` cambia
el pedido **completo**: si la tienda A despacha y la B no, no hay forma de representarlo.

El destino correcto (el de Mercado Libre y Falabella) es **un pago, una dirección, una
suborden por vendedor**, cada una con su estado, su envío y su devolución. Eso implica:

- Backend: entidad `PedidoProveedor` (o `SubPedido`) entre `Pedido` y `PedidoItem`, con
  `metodoEnvio`, `costoEnvio`, `estado` y `courier` propios; migrar
  `updateOrderStatusApi`, la liquidación (`LiquidacionPedidoCalculator`), los retiros y
  el módulo de mediación para que apunten a la suborden.
- Web: `CheckoutPage` manda `envios: [{ proveedorId, metodoEnvio, costoEnvio }]` en vez del
  `metodoEnvio` único; `OrderCard`/`OrderDetailModal` pintan una suborden por tienda.
- App móvil: `app/(buyer)/cart.tsx`, `orders.tsx` y `order-detail.tsx` en paralelo.

Mientras tanto, la solución de la Fase 1.1d (método por línea + fallback vacío cuando hay
mezcla) es correcta y no deja datos inventados en la base.

---

## 10. Autocompletado de direcciones (20-08-2026)

El monorepo trajo `GET /api/v1/ubicaciones/direcciones?texto=&comuna=&region=`
(`DireccionAutocompletadoService`, sobre Photon/OpenStreetMap con caché en memoria de 300
entradas y mínimo de 3 caracteres). Quedó **público** en `SecurityConfig`.

En la web se agregó `AddressAutocompleteInput.jsx` (debounce 400 ms y mínimo 3 caracteres,
igual que `AddressAutocompleteField` de la app) y se conectó al campo "Calle y número" de
`BuyerAddressBook`, que es el mismo formulario que monta el paso de entrega del checkout.

El detalle no obvio: el endpoint devuelve **nombres** de comuna y región, y el backend
guarda **ids**. `handleSuggestionLocation()` resuelve la cascada país → región → comuna
comparando nombres normalizados (sin tildes ni mayúsculas) y solo rellena lo que calza; si
el catálogo no tiene esa comuna, los selects siguen disponibles a mano.

**Pendiente de verificación:** no se pudo probar contra el backend porque el proceso Java
estaba detenido. Además hay que **recompilarlo** con el código recién traído: el endpoint
no existe en un backend levantado desde el commit anterior.
