# Plan de integración web ↔ backend — RepuesTop Market

> **Para el agente que ejecuta este plan.** Está escrito para ser leído sin contexto previo.
> Lee la sección 1 completa antes de tocar código. Las fases están ordenadas por dependencia:
> no saltes la Fase 1, porque las siguientes asumen que la capa HTTP ya es confiable.
>
> Fecha de análisis: 2026-08-11. Las referencias `archivo:línea` eran exactas ese día — **verifícalas
> antes de editar**, no las apliques a ciegas.

## 0. Registro de cambios de este plan

**2026-08-12 — revisión tras `77fc92b` en el mono-repo (mobile).** Ese commit ("integración icono
marcas + vista tiendas") reescribe por completo `mobile/app/store-directory.tsx` y confirma que
`mobile/app/(buyer)/categories.tsx` ya traía desde antes el mismo patrón. Esto cambia el terreno de
la **Fase 5**: lo que hasta ahora se veía como "un defecto propio de la web" resultó ser una decisión
de arquitectura ya replicada dos veces en mobile, con una implementación más cuidada de lo que la web
tenía. La Fase 5 de abajo está reescrita para reflejarlo — léela con este aviso en mente, el resto
de las fases no cambió. Detalle completo en **H9** y **H10**.

### 0.1 Estado de Ejecución de Fases (Matriz OK)

| Fase | Descripción | Estado | Detalle / Verificación |
|---|---|---|---|
| **Fase 0** | Preparación y línea base | ✅ **OK** | Entorno verificado, linter en verde y endpoints comprobados. |
| **Fase 1** | Reparación de capa HTTP | ✅ **OK** | Manejo de errores centralizado, cancelación de peticiones con `AbortSignal`, 0 fallbacks ciegos a 404s. |
| **Fase 2** | Eliminación N+1 en Tiendas | ✅ **OK** | Lectura directa de `productCount` desde la API, eliminadas las peticiones extra por tienda. |
| **Fase 3** | Refresh JWT transparente | ✅ **OK** | `POST /auth/refresh` single-flight con ventana de 30 días y sincronización cross-tab. |
| **Fase 4** | TanStack Query | ✅ **OK** | Caché global en `queryKeys.js`, deduplicación y updates optimistas 0ms en el carrito. |
| **Fase 5** | Directorio de Tiendas | ✅ **OK** | Debounce de 400ms, sync con URL (`?texto=&comuna=`), contador honesto y Hero Header exacto. |
| **Fase 6** | Token en Cookie httpOnly | ✅ **OK** | `credentials: 'include'` en frontend web, cookie `rt_session` HttpOnly/Secure/Lax en backend (`JwtAuthenticationFilter` + `AuthController`). Cero impacto en mobile. |
| **Fase 7** | Taxonomía y datos reales | ✅ **OK** | Mapa de imágenes `getCategoryVisuals` conservando 100% fotos/PNGs, categorías reales de la API y marcas dinámicas. |
| **Fase 8** | Escala y Observabilidad | ✅ **OK** | Code-splitting con `React.lazy` en `ProfileDashboard` (bundle 192KB) y trazabilidad HTTP con `X-Request-Id`. |

---

## 1. Contexto

### 1.1 Repositorios

| Qué | Ruta | Stack |
|---|---|---|
| Web (este repo) | `C:\ProyectoRepuestop\Repuestop_Market` | React 19 + Vite 8 + react-router 7 |
| Backend | `C:\ProyectoRepuestop\repuestop\backend` | Spring Boot, PostgreSQL |
| App móvil | `C:\ProyectoRepuestop\repuestop\mobile` | Expo / React Native |

La web y la app **comparten la misma API**. Cualquier cambio de backend debe ser retrocompatible
con mobile o coordinarse con él. Este plan está diseñado para que **ningún cambio rompa mobile**.

### 1.2 Cómo levantar el entorno

```bash
# Backend (puerto 8080)
cd C:\ProyectoRepuestop\repuestop\backend && ./mvnw spring-boot:run

# Web (puerto 5173)
cd C:\ProyectoRepuestop\Repuestop_Market && npm run dev
```

`VITE_API_URL` por defecto es `http://localhost:8080/api/v1` (ver `.env.example`).
El CORS de desarrollo del backend ya incluye `http://localhost:5173`.

**El backend NO tiene spring-boot-devtools**: después de cambiar código Java hay que reiniciarlo a mano.

### 1.3 Estado actual, en una frase

La web funciona, pero se conecta al backend con una capa HTTP que **oculta sus propios fallos**:
endpoints que no existen encadenados con `.catch()` a datos incrustados en el código, sin caché,
sin cancelación de peticiones, sin renovación de sesión y con parte de la UI mostrando datos
inventados. Nada de esto se ve como error en pantalla: se ve como datos.

---

## 2. Hallazgos que motivan el plan

Cada uno está verificado contra el código. Son el "por qué" de las fases.

### H1 — Hay endpoints que no existen, disfrazados de fallback

`src/services/api.js:493-509`:

```js
export async function getRegionesApi(paisId) {
  return fetchApi(`/geografia/paises/${paisId}/regiones`)
    .catch(() => fetchApi(`/geography/paises/${paisId}/regiones`))  // ← 404 SIEMPRE
    .catch(() => FALLBACK_REGIONES);                                 // ← datos hardcodeados
}
```

El backend solo expone `/api/v1/geografia` (`GeografiaController`). La variante `/geography` **no
existe**: siempre da 404 y siempre se cae al tercer eslabón.

**Consecuencia real:** `FALLBACK_COMUNAS` tiene **7 comunas** incrustadas. Chile tiene 346. Si el
endpoint de geografía falla, un comprador de cualquier otra comuna no puede registrar su dirección
—y no ve ningún error, ve una lista corta que parece legítima.

El mismo patrón está en direcciones (`api.js:274, 313, 366, 411, 441`): se intenta
`/usuarios/{id}/direcciones` y se cae a `/users/{id}/direcciones`, que tampoco existe.

### H2 — La sesión muere a las 8 horas sin aviso

- El JWT expira en **8 horas** (`JwtService.java:27`, `EXPIRATION_SECONDS = 60*60*8`).
- El backend **sí tiene** `POST /api/v1/auth/refresh` (`AuthController.java:144`), con una ventana
  de gracia de **30 días** (`JwtService.java:30`, `REFRESH_GRACE_SECONDS`).
- La web **nunca lo llama**. `grep -rn "auth/refresh" src` no devuelve nada.
- `fetchApi` no distingue el 401: lo convierte en un `ApiError` genérico que cada componente
  muestra como quiere.

**Consecuencia:** a las 8 horas el usuario empieza a ver errores sueltos e inconsistentes según qué
pantalla toque, sin que nada lo mande a iniciar sesión de nuevo.

**Contrato del refresh** (así lo usa mobile, en `mobile/controllers/apiController.ts:186`):

```js
POST /api/v1/auth/refresh
Body: { "token": "<jwt actual, incluso vencido>", "refreshToken": "<el mismo jwt>" }
Respuesta 200: { token, refreshToken?, buyerId?, sellerId?, isOpen?, founder?, founderSince? }
```

No hay un refresh token separado: se reenvía el mismo JWT vencido y el backend lo acepta si está
dentro de los 30 días. Respuestas 400/401/403 = sesión definitivamente muerta → cerrar sesión.

### H3 — Cada componente hace su propio fetch, sin caché ni cancelación

- 23 archivos bajo `src/components` y `src/pages` llaman funciones `*Api()` directamente.
- `grep -rn "AbortController" src` → **cero resultados**. Ninguna petición se cancela.
- No hay caché ni deduplicación: navegar entre vistas vuelve a pedir todo.

**Consecuencias:** condiciones de carrera (una respuesta lenta pisa a una rápida), `setState`
después de desmontar, y N peticiones idénticas en paralelo cuando varios componentes necesitan
lo mismo. Con miles de usuarios esto multiplica la carga del backend sin necesidad.

### H4 — El directorio de tiendas trae 100 y filtra en el navegador

`src/components/StoresDirectoryView.jsx:15,78`:

```js
const STORES_FETCH_SIZE = 100;
getPublicStoresApi({ page: 0, size: STORES_FETCH_SIZE })  // sin filtros
```

Después filtra, ordena y pagina **en el cliente** (búsqueda, región, tipo, envío, marca), ignorando
el parámetro `texto` que el backend sí soporta. Además, las regiones del filtro están incrustadas
(`'Santiago, RM'`, `'Concepción, Biobío'`, `'San Antonio, Valparaíso'`, `'Antofagasta'`) y no salen
de la base.

**No escala:** a las 101 tiendas, la 101 es invisible. Y cada carga arrastra 100 fichas completas.

### H5 — Hay un número inventado en pantalla

`src/components/StoresDirectoryView.jsx:506`:

```jsx
<small>({Math.round(Number(store.totalPublicaciones || 1400) / 11)})</small>
```

Se muestra como cantidad de reseñas. `totalPublicaciones` valía **siempre 0** (ver H6), así que el
fallback se disparaba siempre y **todos los usuarios ven "127 reseñas" fabricadas** en todas las
tiendas. El dato real (`reviewCount`) ya viene en el DTO y se ignora.

Datos de muestra adicionales en `src/components/StorePublicProfileView.jsx:80,95`
(`totalPublicaciones: 2450` y `1420` incrustados).

### H6 — El conteo de productos se pedía tienda por tienda (ya resuelto en backend)

`src/services/adapters.js:271-278` intenta leer el total de seis nombres distintos:

```js
totalPublicaciones: toNumber(
  dto.totalPublicaciones ?? dto.totalProductos ?? dto.productCount
  ?? dto.publishedProductsCount ?? dto.inventoryCount ?? dto.totalItems
) ?? 0,
```

Ninguno existía en la respuesta → siempre `0`. Para compensar, `StoresDirectoryView.jsx:180-203`
dispara **una petición HTTP por cada tienda visible** (`getStoreProductsApi(id, {size:1})`) solo
para leer `totalElements`. Con `itemsPerPage = 6`, son 6 peticiones extra por página.

> **Esto ya está corregido en el backend** (commit pendiente de aplicar en el mono-repo). El
> endpoint ahora devuelve `productCount`. La Fase 2 de este plan consume ese campo y borra el parche.

### H7 — La taxonomía de categorías está duplicada y desactualizada

`src/data/categories.js` contiene **8 categorías de marketing que no existen** en la taxonomía
canónica del backend: `Sistema de Frenos`, `Motor y Distribución`, `Suspensión y Dirección`,
`Iluminación y Ampolletas`, `Aceites y Filtros`, `Sistema Eléctrico y Encendido`,
`Espejos y Carrocería`, `Neumáticos y Llantas`.

La taxonomía real son **24 categorías** definidas en
`backend/src/main/resources/db/migration/V2026080501__add_technical_part_categories.sql`, y el
backend las expone en `GET /api/v1/catalogos/inventario/categorias-repuesto`.

> **Ojo:** Flyway está deshabilitado en desarrollo. En local las categorías salen de
> `DevDataInitializer.categoriasRepuesto()`. Si las dos listas difieren, la de dev manda.

### H8 — El token vive en localStorage

`src/services/api.js:30` y `src/context/AuthContext.jsx:23`. Cualquier XSS (propio o de una
dependencia) puede robar la sesión. El backend lee el token **solo** del header `Authorization`
(`JwtAuthenticationFilter.java:67`), y `allowCredentials` no está activado en CORS.

### H9 — Mobile ya adoptó "página real + pool acotado" como patrón, dos veces

Confirmado en `mobile/app/(buyer)/categories.tsx` (desde antes de este plan) y en
`mobile/app/store-directory.tsx` (reescrito en `77fc92b`, 2026-08-12). Es el mismo problema que H4,
pero **no es un descuido único de la web**: es una decisión que el equipo de mobile ya tomó dos
veces porque el backend no acepta los filtros que la UI necesita.

**Catálogo de productos** (`categories.tsx:349`, precede a este plan): pide un pool de **1000**
productos (`size: 1000`) solo para poblar las opciones de filtro y filtrar en cliente.

**Directorio de tiendas** (`store-directory.tsx`, nuevo): la implementación es más cuidadosa que el
`STORES_FETCH_SIZE = 100` fijo que tenía la web (H4). En vez de pedir siempre el pool completo:

```js
// store-directory.tsx:150-177 (resumen)
const backendComuna = filters.comunas.length === 1 ? filters.comunas[0] : undefined; // 1 comuna -> filtra en el servidor

const [page, pool] = await Promise.all([
  fetchPublicStoresDirectory({ texto, comuna: backendComuna, page: 0, size: PAGE_SIZE }),        // 12, siempre
  fetchPublicStoresDirectory({ texto, comuna: backendComuna, page: 0, size: FILTER_POOL_SIZE }),  // 100, siempre — ver nota
]);
```

> Nota de precisión: el código pide **ambas** peticiones en paralelo en cada búsqueda, no solo
> cuando hay filtros locales activos. Lo que sí es condicional es **cuál de las dos se muestra**:
> `allStores = hasLocalFilters ? pool : page` (`store-directory.tsx:200-203`). O sea, el pool se
> paga en cada búsqueda igual, pero solo se usa para renderizar cuando el usuario activó un filtro
> u orden que no resuelve el backend.

Sobre ese pool se resuelven en cliente: comuna múltiple, región, marca, método de envío, insignias
(`founder` = campo `founder`; `acreditada` = `taxId` no vacío), umbral de rating (4,5 / 4,0 / 3,0) y
5 opciones de orden (`recent`, `ratingDesc`, `productsDesc`, `reviewsDesc`, `nameAsc`) — las dos de
productos (`productsDesc`, `reviewsDesc`) **usan `productCount` y `reviewCount`** de la Fase 2,
confirmando que ambos campos ya son datos de los que depende un flujo real, no solo cosmética.

**Una honestidad que vale la pena copiar:** cuando el pool está activo, el contador que ve el
usuario (`"Listado de tiendas (X)"`, `store-directory.tsx:406`) muestra `sortedStores.length` — el
tamaño real de lo que se está mostrando — y **no** `totalElements` del backend. No finge estar
mostrando el total del sistema. La paginación con "cargar más" también se desactiva mientras hay
filtros locales activos (`store-directory.tsx:281`), en vez de paginar sobre datos ya parciales.

**Qué cambia esto para la Fase 5:** el plan original decía, en esencia, "arregla la web para que
pagine de verdad contra el servidor". Eso sigue siendo lo correcto a largo plazo, pero ya no es una
decisión que la web pueda tomar sola — mobile depende del mismo backend y ya construyó (dos veces)
alrededor de su ausencia. La Fase 5 reescrita más abajo lo refleja.

### H10 — Campo reservado en mobile que el backend todavía no emite

`mobile/utils/store.ts:20-26` declara `dispatchTimeLabel` en `PublicStoreProfile` con este
comentario explícito en el código:

```ts
/**
 * Tiempo promedio de despacho declarado por la tienda. Todavia no lo emite el
 * backend (no existe en Tienda ni en TiendaResponseDTO): la tarjeta del
 * directorio ya reserva el espacio y muestra "Por confirmar" mientras tanto.
 */
dispatchTimeLabel?: string;
```

`store-directory-cards.tsx:288-293` ya renderiza el espacio para este dato junto a
`responseTimeLabel` (que sí existe en el backend), mostrando *"Por confirmar"* como relleno.

No es un bloqueante de este plan ni corresponde arreglarlo aquí. Se deja anotado para que, el día
que el backend agregue `dispatchTimeLabel` a `Tienda` / `TiendaResponseDTO`, la web lo consuma
también — evita que un campo nuevo llegue a un solo cliente y el otro se desincronice, que es
exactamente el patrón que H7 ya describe para las categorías.

---

## 3. Decisiones ya tomadas

Confirmadas con el dueño del producto antes de escribir este plan:

1. **Se incorpora TanStack Query** como capa de datos. No hay que inventar caché a mano.
2. **El plan puede tocar el backend**, siempre que el cambio sea aditivo y mobile no requiera
   modificaciones. Cada cambio de backend está marcado con 🔶 y aislado en su propia fase.
3. **Se migra el token a cookies httpOnly**, con la compuerta de dominio de la Fase 6.

---

## 4. Fases

Orden recomendado. Las fases 1–3 son correctivas y deberían ir juntas a producción. Las 4–8 son
estructurales y pueden entregarse por separado.

---

### Fase 0 — Preparación y línea base

**Objetivo:** que el agente confirme el entorno antes de cambiar nada.

**Pasos**

1. Levantar backend y web. Confirmar que la web carga y se puede iniciar sesión.
2. Verificar que el backend ya expone `productCount` (si no, la Fase 2 queda bloqueada):
   ```bash
   curl -s "http://localhost:8080/api/v1/tiendas/publicas?page=0&size=3" | grep -o '"productCount":[0-9]*'
   ```
   Debe devolver algo como `"productCount":264`. Si no aparece, el cambio de backend todavía no
   está desplegado: **detener y avisar**.
3. Confirmar que `marcasVehiculoDisponibles` **ya no** viene en el listado pero **sí** en la ficha:
   ```bash
   curl -s "http://localhost:8080/api/v1/tiendas/publicas?page=0&size=1" | grep -c marcasVehiculoDisponibles  # 0
   curl -s "http://localhost:8080/api/v1/tiendas/1" | grep -c marcasVehiculoDisponibles                        # 1
   ```
4. `npm run lint` para tener la línea base de warnings. **Anotar el número**: al final no debe subir.

**Criterio de aceptación:** entorno levantado, `productCount` presente, línea base de lint anotada.

---

### Fase 1 — Reparar la capa HTTP 🔴 *prioritaria*

**Objetivo:** que un fallo de integración se vea como un fallo, no como datos plausibles.

**Archivo principal:** `src/services/api.js`

#### 1.1 Eliminar los endpoints inexistentes

Borrar el eslabón `/geography/...` de `getPaisesApi`, `getRegionesApi` y `getComunasApi`
(`api.js:493-509`). Borrar el eslabón `/users/{id}/direcciones` de las cinco funciones de
direcciones (`api.js:274, 313, 366, 411, 441`).

> Antes de borrar, **confirma** contra el backend. Extrae las rutas reales así:
> ```bash
> cd C:\ProyectoRepuestop\repuestop\backend
> grep -rhoE '@(Get|Post|Put|Patch|Delete|Request)Mapping\("[^"]+"' src/main/java/com/repuestop/backend/controller/ | sort -u
> ```
> Si alguna ruta que la web usa no aparece ahí, es otro endpoint muerto: anótalo y repórtalo.

#### 1.2 Convertir los fallbacks silenciosos en errores visibles

Los `FALLBACK_PAISES` / `FALLBACK_REGIONES` / `FALLBACK_COMUNAS` deben dejar de usarse como
respuesta normal. Dos opciones, en orden de preferencia:

- **Preferida:** eliminarlos. Que el error suba y la UI muestre "No pudimos cargar las regiones.
  Reintentar", con botón de reintento.
- **Alternativa:** conservarlos solo como modo degradado **explícito**, marcando la respuesta
  (`{ items, degraded: true }`) y mostrando un aviso visible en el formulario. Nunca en silencio.

**Regla general para todo el archivo:** un `.catch()` que devuelve datos incrustados es un bug.
Revisa `api.js` completo buscando el patrón.

#### 1.3 Distinguir los errores de verdad

`fetchApi` (`api.js:28-73`) hoy convierte **cualquier** excepción no-`ApiError` en
`"No se pudo conectar con el servidor backend"`, incluyendo errores de parseo o de programación.

- Preservar la causa original: `new ApiError(msg, 0, null, { cause: error })`.
- Añadir un **timeout** con `AbortSignal.timeout(15000)` — hoy una petición colgada cuelga la UI
  para siempre.
- Propagar el `AbortSignal` que reciba desde fuera (lo necesita la Fase 4):
  ```js
  export async function fetchApi(endpoint, options = {}) {
    const signal = options.signal ?? AbortSignal.timeout(15000);
    // ...
  }
  ```
- **No** tratar un `AbortError` como error de red: debe propagarse tal cual para que
  TanStack Query lo distinga de un fallo real.

**Criterio de aceptación**
- No queda ninguna cadena `.catch(() => fetchApi(...))` en `api.js`.
- Apagando el backend, la web muestra errores explícitos con reintento; **no** muestra listas cortas
  de regiones/comunas como si fueran válidas.
- Una petición que tarda más de 15s se corta con mensaje claro.

---

### Fase 2 — Consumir `productCount` y borrar el parche 🔴

**Objetivo:** eliminar las 6 peticiones HTTP por página del directorio y arreglar los números falsos.

#### 2.1 Adaptador

`src/services/adapters.js:271-278` — reemplazar toda la cadena de seis nombres por:

```js
totalPublicaciones: toNumber(dto.productCount) ?? 0,
```

#### 2.2 Borrar el parche de peticiones por tienda

En `src/components/StoresDirectoryView.jsx`:

- Borrar el `useEffect` de `inventoryTotals` (**líneas ~178-203**).
- Borrar el estado `inventoryTotals` (**línea ~29**).
- Borrar el merge `{ ...store, totalPublicaciones: inventoryTotals[store.id] }` (**línea ~433**).
- El ordenamiento por `totalPublicaciones` (**línea ~159**) ahora funciona con el dato real: dejarlo.

Aplicar lo mismo en `src/components/NewOnboardedStoresSection.jsx` (**línea ~111**), que repite el
patrón.

#### 2.3 Quitar el dato inventado

`src/components/StoresDirectoryView.jsx:506`:

```jsx
{/* ANTES: <small>({Math.round(Number(store.totalPublicaciones || 1400) / 11)})</small> */}
<small>({Number(store.reviewCount ?? 0).toLocaleString('es-CL')})</small>
```

`reviewCount` ya viene en el DTO y ya lo mapea el adaptador. Si es 0, mostrar
**"Sin evaluaciones"**, no "0" ni un número inventado.

Revisar también `src/components/StorePublicProfileView.jsx:80,95` (`2450` y `1420` incrustados) y
reemplazarlos por el dato real o por un estado de carga.

> **Busca más de lo mismo antes de cerrar la fase:**
> ```bash
> grep -rnE "\|\| *[0-9]{3,}" src/components | grep -iE "total|count|review|rating"
> ```
> Cualquier resultado es un número inventado esperando ser encontrado.

**Criterio de aceptación**
- En la pestaña Red del navegador, cargar el directorio dispara **una sola** petición a
  `/tiendas/publicas` y **ninguna** a `/tiendas/{id}/productos`.
- La cantidad de repuestos de cada card coincide con `totalElements` de
  `GET /tiendas/{id}/productos`. Verificar con al menos dos tiendas distintas.
- No aparece "127" ni ningún número de reseñas que no venga de `reviewCount`.

---

### Fase 3 — Sesión: renovación y expiración 🔴

**Objetivo:** que la sesión no muera en silencio a las 8 horas.

**Archivos:** `src/services/api.js`, `src/context/AuthContext.jsx`

#### 3.1 Interceptor de 401 con refresh

Implementar dentro de `fetchApi`, **con estas tres propiedades no negociables**:

1. **Una sola renovación concurrente.** Si diez peticiones reciben 401 a la vez, debe haber **un**
   `POST /auth/refresh`, y las diez esperan su resultado. Se resuelve con una variable a nivel de
   módulo que guarda la promesa en vuelo:
   ```js
   let refreshPromise = null;
   function refreshSession() {
     refreshPromise ??= doRefresh().finally(() => { refreshPromise = null; });
     return refreshPromise;
   }
   ```
2. **Un solo reintento por petición.** Si tras renovar vuelve a dar 401, cerrar sesión. Nunca
   reintentar en bucle.
3. **No renovar el propio refresh.** Excluir `/auth/*` del interceptor o entra en recursión.

Contrato exacto en H2. Respuestas **400/401/403** del refresh = sesión muerta → `logoutLocal()` y
redirigir a inicio con un aviso ("Tu sesión expiró, vuelve a iniciar sesión"). Cualquier otro
código o fallo de red = problema transitorio → **no** cerrar sesión, propagar el error.

> La implementación de referencia está en `mobile/controllers/apiController.ts:150-240`. Resuelve
> además el caso de que la sesión cambie mientras el refresh está en vuelo (`stale`). Léela antes
> de escribir la versión web.

#### 3.2 Sesión coherente entre pestañas

`AuthContext` lee `localStorage` solo al montar. Si el usuario cierra sesión en otra pestaña, esta
sigue creyéndose autenticada. Añadir un listener de `storage`:

```js
useEffect(() => {
  const onStorage = (e) => {
    if (e.key === 'repuestop_token' && !e.newValue) logoutLocal();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}, []);
```

(Si se ejecuta la Fase 6, esto se reemplaza por un `BroadcastChannel`, porque la cookie httpOnly
no es visible desde JS.)

#### 3.3 Validación de sesión al montar

`AuthContext.jsx:32-46` llama a `getProfileApi()` solo si hay token **y no hay usuario en caché**.
Con usuario cacheado, un token revocado sigue pareciendo válido hasta la primera petición fallida.
Validar siempre al montar, mostrando la UI optimista mientras tanto.

**Criterio de aceptación**
- Con un JWT vencido a mano en localStorage, la web renueva sola y la petición original tiene éxito.
- Con diez peticiones simultáneas y token vencido, la pestaña Red muestra **un solo** `/auth/refresh`.
- Con un token basura, la web cierra sesión y avisa; no queda en bucle de errores.
- Cerrar sesión en una pestaña cierra la otra.

---

### Fase 4 — TanStack Query como capa de datos 🟡

**Objetivo:** caché, deduplicación, cancelación y estados de carga consistentes.

```bash
npm install @tanstack/react-query
# Opcional en desarrollo:
npm install -D @tanstack/react-query-devtools
```

#### 4.1 Provider y configuración base

En `src/main.jsx` (o donde se monte el árbol), envolver por **fuera** de `AuthProvider`:

```js
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // el backend cachea 60s; alinear
      gcTime: 5 * 60_000,
      retry: (failureCount, error) =>
        error?.status >= 400 && error?.status < 500 ? false : failureCount < 2,
      refetchOnWindowFocus: false, // evitar tormentas de peticiones al volver a la pestaña
    },
  },
});
```

> **No reintentar los 4xx.** Reintentar un 404 o un 401 solo multiplica carga sin arreglar nada.

#### 4.2 Convención de claves

Centralizar en `src/services/queryKeys.js` para poder invalidar con precisión:

```js
export const qk = {
  stores:      (filters) => ['stores', filters],
  store:       (id)      => ['stores', id],
  storeProducts: (id, filters) => ['stores', id, 'products', filters],
  products:    (filters) => ['products', filters],
  cart:        (userId)  => ['cart', userId],
  orders:      (userId)  => ['orders', userId],
  notifications: (userId) => ['notifications', userId],
};
```

#### 4.3 Migración por vistas, no de golpe

Migrar en este orden, verificando cada una antes de seguir:

1. `StoresDirectoryView` (la que más se beneficia)
2. `StorePublicProfileView`
3. `PartsCatalogView`
4. `ProductDetailPage`
5. `ProfileDashboard` (es el archivo más grande, 1975 líneas — déjalo para el final)

Patrón: cada `useEffect + useState + fetch` se convierte en `useQuery`. Las mutaciones (carrito,
pedidos, perfil) en `useMutation` + `invalidateQueries`.

**Pasar siempre el `signal`** que entrega TanStack Query a `fetchApi`, para que cancele de verdad:

```js
useQuery({
  queryKey: qk.stores(filters),
  queryFn: ({ signal }) => getPublicStoresApi({ ...filters, signal }),
});
```

Esto exige que las funciones de `api.js` acepten y propaguen `signal` (Fase 1.3).

#### 4.4 Carrito: optimistic updates

El carrito es lo que más se toca y donde la latencia más se nota. Usar `onMutate` para actualizar
la UI al instante y `onError` para revertir. **No** dejar el botón "agregar" esperando la respuesta.

**Criterio de aceptación**
- Navegar a una vista ya visitada no vuelve a pedir datos dentro de `staleTime`.
- Escribir rápido en el buscador cancela las peticiones anteriores (visible en la pestaña Red).
- Ningún warning de `setState` sobre componente desmontado.
- Sin regresiones funcionales: el flujo comprar → pagar → ver pedido sigue completo.

---

### Fase 5 — Directorio de tiendas: alinear con el patrón que mobile ya construyó 🟡

**Objetivo:** que el directorio de la web deje de fingir que muestra el catálogo completo cuando en
realidad filtra sobre una porción, y que lo haga con la misma honestidad que la versión de mobile.

> Lee **H9** antes de tocar esta fase. Resumen: esto dejó de ser "arreglar un defecto de la web".
> Mobile ya resolvió el mismo problema dos veces (catálogo de productos y directorio de tiendas)
> porque el backend no acepta los filtros combinados que la UI necesita. La solución de fondo
> —backend con filtros multivalor reales— sigue siendo la correcta, pero ahora beneficia a **dos**
> clientes, no solo a este. Mientras esa decisión no se tome, la web debe igualar el comportamiento
> de mobile, no reinventar uno propio.

**Archivo:** `src/components/StoresDirectoryView.jsx`. Referencia de comportamiento a igualar:
`mobile/app/store-directory.tsx` (post `77fc92b`).

#### 5.1 Interino — igualar el patrón de mobile (hazlo primero, no depende del backend)

1. **Búsqueda y comuna única van al servidor**, como ya hace mobile
   (`store-directory.tsx:148,157-158`): pasar `texto` y, si el usuario seleccionó **una sola**
   comuna, también `comuna` a `GET /tiendas/publicas` — el backend ya acepta ambos parámetros.
   Con cero o más de una comuna seleccionada, ese filtro se resuelve en cliente sobre el pool.
2. **Debounce de 400ms** en el campo de búsqueda antes de disparar la petición. Mobile ya lo hace
   (`store-directory.tsx:141-144`). Sin esto, cada tecla es una petición.
3. **Dos peticiones en paralelo, no una sola de 100:** una página real (`size` chico, ej. 12, para
   el listado por defecto) y un pool acotado (`size: 100`, tope real del endpoint) para construir
   las opciones de filtro y para filtrar/ordenar en cliente. Mostrar el pool **solo** cuando el
   usuario activó un filtro u orden que el backend no resuelve; si no hay ninguno activo, mostrar
   la página real y paginar con "cargar más" contra el servidor.
4. **El contador de resultados debe reflejar lo que se está mostrando, no el total del sistema.**
   Con el pool activo, mostrar `stores.length` (lo que hay en pantalla), no `totalElements`. Es lo
   que ya hace mobile (`store-directory.tsx:406`) y es la diferencia entre informar y mentir.
5. **Desactivar "cargar más" mientras hay filtros locales activos** — paginar sobre un pool ya
   recortado en cliente da resultados inconsistentes entre páginas. Mobile lo resuelve así
   (`store-directory.tsx:281`).
6. Las regiones y marcas del filtro deben construirse a partir del pool recibido (como hace mobile
   con `sortedBrandNames` / regiones únicas), **no** de arreglos incrustados en el componente
   (`StoresDirectoryView.jsx:44-50` tiene 4 regiones fijas; hoy ni siquiera cubre las regiones
   reales de las tiendas cargadas).
7. **Insignias, coherentes con mobile:** `founder` sale del campo `founder`; "acreditada" sale de
   `taxId` no vacío (así lo define mobile, `store-directory.tsx:239-241`) — no inventar un criterio
   distinto en la web para el mismo concepto.
8. **Orden**, igual set que mobile: más recientes (default del backend), mejor evaluadas
   (`rating`), más repuestos publicados (`productCount` — Fase 2), más evaluaciones
   (`reviewCount`), nombre A-Z. Todo sobre el pool, en cliente.
9. **Sincronizar búsqueda y comuna con la URL** (`?texto=&comuna=&page=`). Esto es mejora propia de
   la web —mobile no tiene URL— y vale la pena: hoy los filtros no se pueden compartir ni
   sobreviven a un refresco. Sincronizar solo lo que va al backend (texto, comuna, page); los
   filtros resueltos en cliente pueden quedar fuera de la URL sin problema.

> **Filtro que mobile no tiene y no se debe inventar en la web:** método de envío. Revisa si tu
> versión actual de `StoresDirectoryView.jsx` lo mantiene — si es así, dado que hoy filtra sobre una
> porción parcial sin decirlo, **quítalo de la UI** hasta que exista un criterio compartido con
> mobile, o defínelo junto con el punto 5.2 de abajo. No lo dejes filtrando en silencio sobre datos
> incompletos.

#### 5.2 De fondo — filtros multivalor reales en el backend 🔶 *decisión de dos clientes, no solo web*

El arreglo interino de 5.1 es honesto pero sigue acotado a `size` máximo 100 (tiendas) / 1000
(productos, ya así desde antes en mobile). Eso deja de escalar tarde o temprano.

**Propuesta:** extender `GET /tiendas/publicas` (y el equivalente de catálogo de productos) con
parámetros multivalor: `comunas` (CSV), `marcas` (CSV), `founder` (bool), `minRating` (decimal),
`hasProducts` (bool), `sort` (enum). Con eso, tanto mobile como la web dejan de necesitar el pool:
piden exactamente la página filtrada que necesitan, del tamaño que sea.

**Por qué ya no es una decisión solo de la web:** el pool de mobile para productos es de tamaño
1000; a medida que crezca el catálogo, ese número deja de alcanzar y el filtrado en cliente empieza
a mostrar resultados incompletos sin que el usuario lo note. Resolver esto en el backend beneficia
a los dos clientes a la vez y evita mantener la misma lógica de filtrado duplicada en React Native
y en React.

**Decisión requerida del dueño del producto:** ¿se invierte en este endpoint ahora (mejora
compartida, prioriza escala) o se sostiene el patrón de pool acotado en ambos clientes por más
tiempo (más rápido de mantener hoy, pero con el mismo techo de escala en los dos)? Si se aprueba,
es trabajo de backend coordinado con quien mantenga mobile — el DTO y los query params deben quedar
iguales para los dos consumidores.

**Criterio de aceptación (5.1, alcanzable sin backend)**
- Con más de 100 tiendas en la base, seleccionar un filtro que no toca comuna sigue dejando ver
  correctamente el listado paginado por defecto (sin filtros locales, no hay tope de 100).
- Escribir en el buscador dispara **una** petición tras la pausa, no una por tecla.
- El contador de resultados nunca muestra un número mayor a la cantidad de tarjetas visibles.
- Recargar con búsqueda o comuna en la URL los conserva.
- El comportamiento de insignias, orden y filtros coincide con el de la app móvil para el mismo
  conjunto de tiendas — compáralos lado a lado antes de dar la fase por cerrada.

**Criterio de aceptación (5.2, si se aprueba)**
- Con más de 100 tiendas en la base, se puede llegar a la número 150 filtrando por comuna sin pool.
- Mobile puede adoptar los mismos parámetros sin cambiar su contrato de datos actual.

---

### Fase 6 — Token en cookie httpOnly 🔶 *toca backend*

**Objetivo:** que un XSS no pueda robar la sesión.

> ### ⛔ Compuerta previa — verificar antes de escribir código
>
> Las cookies solo funcionan bien si la web y la API comparten **dominio registrable**:
> `repuestop.cl` + `api.repuestop.cl` → ✅ mismo sitio, `SameSite=Lax` alcanza.
> `repuestop.vercel.app` + `api.repuestop.cl` → ❌ sitios distintos: exige `SameSite=None; Secure`,
> queda expuesta a la eliminación de cookies de terceros de los navegadores y suma riesgo de CSRF.
>
> **Si la web no se sirve desde el dominio de la API, detén esta fase y repórtalo.** La alternativa
> correcta en ese caso es dejar el token en memoria (no en localStorage) y renovarlo con el
> mecanismo de la Fase 3 — mitiga buena parte del riesgo sin depender del dominio.

**Diseño aditivo — mobile no se toca:**

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `AuthController` (login, google, login-by-taxid, refresh) | Además de devolver el token en el cuerpo, agregar `Set-Cookie: rt_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800` |
| 2 | `JwtAuthenticationFilter.java:67` | Leer primero el header `Authorization`; si no está, leer la cookie `rt_session` |
| 3 | `SecurityConfig.java:178` | `configuration.setAllowCredentials(true)`. Ya usa `setAllowedOriginPatterns`, compatible con credenciales |
| 4 | Nuevo `POST /auth/logout` | Invalidar la cookie (`Max-Age=0`) |
| 5 | Web: `fetchApi` | `credentials: 'include'` y dejar de leer/escribir el token en localStorage |

**Por qué mobile no se entera:** sigue mandando el header `Authorization`, que tiene prioridad en el
paso 2. Ignora el `Set-Cookie`. **Cero cambios en `mobile/`.**

> **Verificación obligatoria de no-regresión:** después del cambio de backend, correr la app móvil y
> confirmar login, una petición autenticada y el refresh. Si mobile se rompe, el paso 2 quedó mal.

**CSRF:** con `SameSite=Lax`, un POST desde otro sitio no lleva la cookie, lo que cubre el grueso.
Para defensa en profundidad, añadir el patrón *double-submit*: cookie legible `rt_csrf` + header
`X-CSRF-Token` en peticiones que modifican estado. **Evaluar según el apetito de riesgo**; con
`SameSite=Lax` y sin formularios cross-site puede posponerse.

**Criterio de aceptación**
- La sesión funciona sin ningún token en localStorage (verificar en DevTools → Application).
- `document.cookie` **no** muestra `rt_session` (esa es la prueba de que es httpOnly).
- La app móvil sigue funcionando sin cambios.

---

### Fase 7 — Taxonomía y datos de muestra 🟡

**Objetivo:** que la web no muestre categorías que el backend no conoce.

#### 7.1 Categorías desde el backend

`src/data/categories.js` es una copia local desincronizada (ver H7). Consumir
`GET /api/v1/catalogos/inventario/categorias-repuesto` con TanStack Query y `staleTime` alto
(cambian muy poco; una hora está bien).

Las 8 categorías de marketing (`Sistema de Frenos`, `Motor y Distribución`,
`Iluminación y Ampolletas`, `Neumáticos y Llantas`, etc.) **no existen** en el backend. Al filtrar
por ellas no se obtiene nada o se obtiene algo arbitrario.

> Si esas 8 se usan como agrupadores visuales del home (no como filtro real), pueden conservarse
> **solo como presentación**, mapeadas explícitamente a IDs canónicos. Lo que no puede seguir es
> que se usen como si fueran categorías del backend.
> **Decisión requerida del dueño del producto.**

Lo que **sí** debe quedar local: `banks.js`, `shippingMethods.js`, `vehicleBrands.js`,
`orderStatusFlow.js`. Son constantes de presentación, no datos del dominio.

#### 7.2 Datos de muestra todavía conectados

| Archivo | Qué muestra | Acción |
|---|---|---|
| `src/components/LiveQuotationWidget.jsx:3,88` | `LIVE_QUOTATIONS` — actividad "en vivo" falsa | Conectar a datos reales o retirar el widget |
| `src/components/LicensePlateHero.jsx:6` | `POPULAR_MARCAS`, `ANIOS_DISPONIBLES` | Usar `/catalogos/inventario/marcas-vehiculo` |
| `src/data/products.js` | Productos de ejemplo | Verificar si sigue en uso; si no, borrar |

> Mostrar actividad de marketplace inventada a usuarios reales es un problema de confianza, no solo
> técnico. Priorizar `LiveQuotationWidget`.

---

### Fase 8 — Escala y observabilidad 🟢

**Objetivo:** sostener miles de usuarios y poder diagnosticar cuando falle.

1. **Aprovechar la caché HTTP.** Varios endpoints públicos ya mandan
   `Cache-Control: max-age=60` (tiendas, productos). Alinear `staleTime` de TanStack Query con esos
   valores en vez de elegir números al azar.
2. **Code splitting por ruta.** `ProfileDashboard.jsx` son 1975 líneas y hoy entra en el bundle
   inicial aunque el visitante nunca inicie sesión. `React.lazy` + `Suspense` en `AppRoutes.jsx`.
   Medir con `npm run build` antes y después.
3. **Límites de error.** No hay ningún error boundary: un fallo de render deja la página en blanco.
   Poner uno global y uno por ruta principal.
4. **Estados de carga sin salto de layout.** Skeletons con las dimensiones finales, no un spinner
   centrado que hace saltar el contenido al llegar los datos.
5. **Reintento visible.** Todo estado de error necesita un botón de reintento; con TanStack Query
   es `refetch()`.
6. **Accesibilidad de los estados asíncronos.** `aria-busy` mientras carga y `role="alert"` en los
   errores. Hoy un lector de pantalla no anuncia ninguna de las dos cosas.
7. **Correlación de errores.** El backend ya tiene `RequestLoggingFilter`. Enviar un header
   `X-Request-Id` desde la web y registrarlo en los errores del cliente permite cruzar un error
   reportado por un usuario con el log del servidor.

---

## 5. Riesgos y cómo mitigarlos

| Riesgo | Mitigación |
|---|---|
| La Fase 4 toca 23 componentes y puede romper flujos | Migrar de a una vista, verificando el flujo de compra completo tras cada una |
| La Fase 6 rompe la app móvil | El header tiene prioridad sobre la cookie; **probar mobile explícitamente** antes de fusionar |
| Quitar los fallbacks deja formularios inutilizables si geografía falla | Arreglar primero el endpoint real; el fallback estaba tapando un problema, no resolviéndolo |
| Los números de línea de este plan quedan viejos | Buscar por contenido, no por línea; el plan cita fragmentos de código a propósito |
| Flyway deshabilitado en dev: las categorías locales no son las de producción | Probar la Fase 7 también contra un entorno con las migraciones aplicadas |

## 6. Orden de entrega sugerido

- **Entrega 1 (correctiva):** Fases 0, 1, 2, 3 → la integración deja de mentir y la sesión deja de morir.
- **Entrega 2 (estructural):** Fase 4 → caché y cancelación.
- **Entrega 3 (escala):** Fases 5, 8 → directorio real y rendimiento.
- **Entrega 4 (seguridad):** Fase 6, previa compuerta de dominio.
- **Entrega 5 (contenido):** Fase 7, coordinada con producto por las decisiones pendientes.

## 7. Decisiones que el agente NO debe tomar solo

Marcadas arriba en sus fases. Consultar al dueño del producto:

1. **Fase 5.1** — filtro de método de envío, que mobile no tiene: ¿se define un criterio compartido
   con mobile o se retira de la web hasta entonces?
2. **Fase 5.2** — filtros multivalor reales en el backend: ¿se invierte ahora (mejora compartida con
   mobile, prioriza escala) o se sostiene el patrón de pool acotado en los dos clientes?
3. **Fase 7** — las 8 categorías de marketing: ¿se conservan como agrupadores visuales o se eliminan?
4. **Fase 6** — dominio de producción de la web (decide si la fase es viable).
5. **Fase 7** — `LiveQuotationWidget`: ¿se conecta a datos reales o se retira?
