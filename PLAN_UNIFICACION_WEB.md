# Plan: unificar el sitio institucional con el marketplace

`repuestop.cl` sirve hoy el sitio institucional (`C:/ProyectoRepuestop/Repuestop_web`).
El objetivo es que ese dominio sirva el **marketplace**, y que el contenido institucional
viva en `/nosotros` con el header, el footer y la paleta del marketplace.

## 0. El hallazgo que cambia el tamaño del trabajo

**La migración de código ya está hecha.** No hay que unir dos repos: hay que jubilar uno
y mover el dominio.

| Pieza | Estado en el marketplace |
|---|---|
| JSX de la landing | ✅ `src/components/AboutRepuesTopPage.tsx` (764 líneas; el original tiene 782, mismas 5 secciones: `inicio`, `experiencias`, `como-funciona`, `proveedores`, `descargar`) |
| CSS | ✅ `src/about-repuestop.css` (1.414 líneas), con **scope** bajo `.repuestop-about-page` donde el original usaba `:root`, para no contaminar el resto del sitio |
| Imágenes | ✅ `public/about-assets/` |
| Registro de tienda fundadora | ✅ `src/components/FounderRegistration.tsx`, y la copia del marketplace es **más nueva** (16 líneas de diferencia: `termsVersion` y la prop `onBack`) |
| Ruta | ✅ `/nosotros` (`ROUTES.about`) |

**El repo antiguo está congelado desde el 28-07-2026** (`921da46`). El marketplace ya lo
superó. Su rama activa es `dev`, remoto
`https://github.com/javiersazo95-glitch/Repuestop_web`.

### Lo que sí falta

1. `AboutPage` está registrada **fuera de `AppLayout`** (`AppRoutes.jsx:74`), así que no
   recibe el header ni el footer del marketplace.
2. `AboutRepuesTopPage.tsx:692` trae su propio `<header className="site-header">` con
   menú hamburguesa, heredado de cuando era un sitio independiente.
3. El CSS scopeado conserva los colores del sitio antiguo en vez de los tokens del
   marketplace (`--color-brand-blue`, `--font-display`, …).
4. El contenido está desactualizado respecto de lo que la web ya ofrece hoy.
5. **El marketplace no tiene proyecto propio en Vercel**: solo existe el del sitio antiguo.
6. **El marketplace no tiene `robots.txt` ni `sitemap.xml`**; el sitio antiguo sí.

### Enlaces verificados (20-08-2026)

- `/postular-fundador` **solo se enlaza desde dentro del propio sitio antiguo**
  (`App.tsx:535`, `FounderModal.tsx:80`). No hay enlaces externos, así que el redirect es
  una precaución barata, no una necesidad.
- `https://inventario.repuestop.cl/` es el panel de vendedores, un proyecto aparte. Ya
  está en el marketplace (`FounderRegistration.tsx:29`). **No se toca.**
- `https://api.repuestop.cl/api/v1` es el backend. El marketplace lo resuelve por
  `VITE_API_URL`; el sitio antiguo lo tenía con fallback por hostname en `config.ts`.

---

## Fase 1 — `/nosotros` dentro del marketplace ✅ (commit `f9982e2`)

**Riesgo bajo, sin efecto en producción** (el dominio todavía apunta al sitio antiguo).

1. **Mover la ruta dentro de `AppLayout`** en `AppRoutes.jsx`: sacar
   `<Route path={ROUTES.about} …>` del bloque de páginas a pantalla completa y ponerla
   junto a `home`, `catalog`, `cart` y `checkout`.
2. **Eliminar el header propio** de `AboutRepuesTopPage.tsx`: el componente `SiteHeader`
   (línea ~692), su estado `open` de menú, y los iconos `Menu` / `X` del import. Los
   anclas internas (`#experiencias`, `#como-funciona`, …) siguen funcionando: son de la
   misma página.
3. **Adaptar el CSS a la paleta del marketplace** en `about-repuestop.css`: reemplazar los
   colores propios por los tokens de `:root` de `index.css`, y borrar las reglas del
   header eliminado. Mantener el scope `.repuestop-about-page`: es lo que evita que
   1.414 líneas de CSS se derramen sobre el resto del sitio.
4. Revisar `scroll-margin-top`, hoy calculado para el header propio: con el header del
   marketplace la altura cambia y las anclas quedan corridas.

**Cómo quedó.** Además del header hubo que sacar el footer propio (`final-footer` dentro
de `FinalStage`): dentro de `AppLayout` la página quedaba con dos footers. El CSS no se
reescribió variable por variable; el bloque de tokens locales quedó como una **capa de
alias** sobre los del market (`--blue: var(--color-brand-blue)`, `--navy:
var(--text-primary)`, …), así un cambio de paleta en `index.css` arrastra esta página
solo. El `scroll-margin-top` resultó al revés de lo previsto: el header del marketplace
**no es sticky** —`.light-market-header` pisa `.trust-header-main` con `position:
relative`—, así que se va con el scroll y las anclas quedaron en 24px de respiro, no en
más de 84.

**Verificación:** `/nosotros` con el header y el footer del marketplace, las cinco
secciones con la paleta correcta, las anclas cayendo en el lugar justo, y el resto del
sitio sin cambios visuales (nada del CSS scopeado se escapó).

## Fase 2 — Actualizar el contenido ✅

El texto describía la plataforma como "web disponible, app próximamente", cuando la web ya
hacía bastante más de lo que contaba.

**Qué ofrece hoy la web y no estaba en el texto:** carrito multi-tienda con envío por
proveedor, checkout en tres pasos —Entrega, Documento, Pago (`CheckoutPage.jsx:20`)— con
boleta o factura, pago de cotizaciones cerradas en el chat, comprobante con seguimiento
del pedido, centro de ayuda con tickets, y mediación de disputas con evidencia.

### Corrección: la lista de "qué traerá la app" estaba mal

Este plan decía que la app aportaría agendamiento de citas, historial de citas, monedero
de Fichas y publicación de anuncios. **Las cuatro ya están en la web** —`AdAppointmentModal`
montado desde `AdsWallView.jsx:398`, `TokensWalletCard` y `RechargeTokensModal` dentro de
`AdsManagementSection`, que cuelga de `ProfileDashboard.jsx:1654`—.

Y más importante: **en ninguna de las dos plataformas tienen backend**. `adsStorage.js:78`
guarda anuncios, saldo de Fichas y transacciones en `localStorage`; el móvil usa su
`services/ads-storage` equivalente. Es el pendiente §7 de `PLAN_CARRITO_CHECKOUT.md`.
**Las Fichas se están desarrollando ahora mismo** —el backend ya tiene
`CompraFichaController`, pero el mural todavia no lo consume—, asi que esto es un estado
transitorio, no una funcion abandonada.

Por eso **el mural de anuncios, las Fichas y las citas quedaron fuera del texto
institucional**: mientras el mural siga leyendo de `localStorage`, anunciarlas es prometer
algo que el usuario todavia no puede usar de verdad. En cuanto la integracion cierre,
entran al texto —es un cambio de tres parrafos, no un rediseno—.

Eso dejó sin contenido el "qué traerá la app". Comparando pantalla por pantalla, el móvil
tiene casi el mismo set que la web; lo genuinamente propio es nativo: `expo-notifications`
(push) y `expo-image-picker` (cámara). El texto nuevo apuesta por eso —paridad + lo
nativo— en vez de inventar funciones.

### Qué se cambió

- "próximamente" → "en desarrollo" en toda la página: llevaba meses ahí y sonaba a promesa
  vencida.
- H1: de *"Tu marketplace de repuestos, hoy en la web y pronto en tu teléfono"* a *"De la
  patente a la puerta de tu casa, con respaldo en cada paso"*. El titular gastaba su única
  frase hablando de plataformas en vez de decir qué hace el producto.
- La franja de pruebas del hero cubría solo el inicio del viaje (patente, compatibilidad,
  pago, tiendas); ahora cubre el arco completo, con la mediación —lo más sólido que tiene
  el backend— mencionada por primera vez en la página.
- Entró "Carrito y checkout" a las tarjetas del comprador; el PIN de retiro se mudó al
  texto de "Seguimiento claro" en vez de perderse.
- La bajada del proveedor no decía que el vendedor cobra; ahora menciona el retiro de saldo.

## Fase 3 — Vercel, los dos ambientes y el dominio

**Es la fase con riesgo real: acá se toca producción.** El orden importa: cada bloque
depende del anterior, y varios son de backend o de Google. Si se saltan, la verificación
falla y parece un problema de Vercel cuando no lo es.

### 3.0 El market es la única pieza sin ambiente de desarrollo

El resto del sistema ya vive en dos ambientes:

| | Producción (rama `main`) | Desarrollo (rama `dev`) |
|---|---|---|
| Backend | `api.repuestop.cl` | `api-dev.repuestop.cl` |
| Panel vendedores | `inventario.repuestop.cl` | `dev-inventario.repuestop.cl` |
| Backoffice | `backoffice.repuestop.cl` | `dev-backoffice.repuestop.cl` |
| Sitio web | `repuestop.cl` | `dev-repuestop.repuestop.cl` |

`dev-repuestop.repuestop.cl` ya está reservado en el CORS del backend de desarrollo
(`application-dev.properties:22`). **El marketplace es lo único que hoy solo tiene `main`**,
así que la Fase 3 no es "crear un proyecto en Vercel": es montar los dos ambientes y
recién después mover el dominio.

Ventaja de hacerlo en este orden: el ambiente dev pasa a ser **donde se verifica**, en vez
de andar probando contra el backend de producción.

### 3.0.1 Lo que ya quedó resuelto en el código

Ya está commiteado, no hay que hacerlo a mano:

| Punto | Dónde |
|---|---|
| Headers de seguridad (los 5 del sitio antiguo) | `vercel.json` |
| Redirect `/postular-fundador` → `/vender` (301) | `vercel.json` |
| `robots.txt` | `public/robots.txt` |
| `sitemap.xml` con las rutas reales | `public/sitemap.xml` |
| `VERCEL_GIT_COMMIT_REF` en la cadena de `__DEPLOY_BRANCH__` | `vite.config.js` |

### 3.1 Crear la rama `dev` en el market

Hoy el repo solo tiene `main`.

```bash
git checkout -b dev && git push -u origin dev && git checkout main
```

De aquí en adelante el flujo queda igual que en los otros repos: se trabaja en `dev`, y a
`main` se mergea lo que va a producción.

### 3.2 Los backends (Railway) ✅ verificado el 21-08-2026

**Los `.properties` no son la fuente de verdad de ninguno de los dos ambientes.**
Ambas instancias de Railway corren con `SPRING_PROFILES_ACTIVE=prod`, así que
`application-dev.properties` **nunca se carga** —ni siquiera en dev— y, además, las
variables de entorno de Railway ganan sobre cualquier default `${VAR:fallback}` del
archivo. Al razonar sobre configuración de ambientes hay que preguntar por la variable de
Railway, no citar el `.properties`.

Estado encontrado:

| Variable | Instancia dev (`api-dev`) | Instancia prod (`api`) |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` | `prod` |
| `CORS_ALLOWED_ORIGINS` | seteada, endpoints de desarrollo | seteada, endpoints de producción |
| `WEB_BASE_URL` | `https://dev-repuestop.repuestop.cl` — **ya estaba** | no existe → default `https://repuestop.cl` ✔ |

**No hubo que cambiar nada.** El ambiente dev ya estaba preparado para un frontend en
`dev-repuestop.repuestop.cl` que todavía no existía; esta fase ocupa ese hueco.

Dos cosas quedan pendientes para más adelante, no ahora:

- **Paso 3.7**: agregar temporalmente la URL `*.vercel.app` del proyecto de producción a
  `CORS_ALLOWED_ORIGINS` de la instancia prod, para poder verificar antes del corte.
- **Paso 3.9**: quitarla después.

Contexto de por qué `WEB_BASE_URL` importa: es a donde el backend manda al comprador
**después de pagar en Flow** — `PagoController` construye
`${WEB_BASE_URL}/compra-exitosa?status=success&orderId=…`. Hoy, en producción, esa URL
está rota: `repuestop.cl` sirve la landing antigua, que no tiene `/compra-exitosa`, así
que un pago real deja al comprador en una página que no existe. Mover el dominio
**arregla** esto.

### 3.3 Google Cloud Console ✅ verificado el 21-08-2026

El login usa `google.accounts.id.initialize` (`AuthModal.jsx:29`) y Google valida el
**origen exacto**. Un origen no autorizado no da error visible: el botón simplemente no
hace nada, y el motivo (`origin is not allowed`) aparece solo en la consola.

En el cliente OAuth `117201265366-…apps.googleusercontent.com`, *Orígenes autorizados de
JavaScript*, quedó así:

- `https://dev-repuestop.repuestop.cl` — ya estaba
- `https://repuestop.cl` — ya estaba
- `https://www.repuestop.cl` — **faltaba, se agregó**

Ese `www` habría roto el login con Google en el momento exacto del corte de dominio, que
es el peor momento para descubrirlo.

Queda pendiente para el paso 3.7: agregar la URL `*.vercel.app` del proyecto de
producción, para poder verificar el login antes del corte.

### 3.4 Los dos proyectos en Vercel

Ambos importan el mismo repo, `javiersazo95-glitch/Repuestop_Market`.

| | Proyecto **dev** | Proyecto **producción** |
|---|---|---|
| Nombre sugerido | `repuestop-market-dev` | `repuestop-market` |
| Framework Preset | Vite | Vite |
| Root Directory | `./` | `./` |
| Build Command | `npm run build` | `npm run build` |
| Output Directory | `dist` | `dist` |
| Production Branch | **`dev`** | **`main`** |
| Dominio final | `dev-repuestop.repuestop.cl` | `repuestop.cl` + `www` |

**Ignored Build Step** (*Settings → Git → Ignored Build Step*). Sin esto, cada push a
cualquier rama dispara un build en **los dos** proyectos.

```bash
# proyecto dev (el mismo comando que ya usas en el sitio antiguo)
if [ "$VERCEL_GIT_COMMIT_REF" != "dev" ]; then exit 0; else exit 1; fi

# proyecto producción (el espejo)
if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then exit 0; else exit 1; fi
```

Recordatorio de por qué se lee al revés: en el Ignored Build Step de Vercel **`exit 0`
cancela el build y `exit 1` lo ejecuta**, al contrario del convenio de Unix.

`vercel.json` está en el repo, así que los rewrites, los headers y el redirect aplican
solos en ambos proyectos.

En los build logs sale un `npm warn allow-scripts` por el `postinstall` de `core-js`. Es
ruido: `core-js` llega transitivo por `jspdf → canvg` y ese script solo imprime un mensaje
de financiamiento. El bundle sale idéntico.

**El nombre del proyecto define la URL `*.vercel.app`** que hay que allowlistear en 3.2 y
3.3. Elegirlo antes y no cambiarlo después.


#### Proyecto dev ✅ creado y verificado el 21-08-2026

Nombre real: **`dev-repuestop-market`** (no `repuestop-market-dev`). URL estable:
`https://dev-repuestop-market.vercel.app`.

Tres cosas que costaron y conviene no volver a descubrir:

1. **El Production Branch ya no vive en *Settings → Git***. Vercel lo movió a
   **Settings → Environments → Production → Branch Tracking**. Ahí se pone `dev`.
2. **Redeploy no sirve para cambiar de rama.** Reconstruye *el mismo commit*
   ("same source code as your current one"), así que si el único deployment vino de
   `main`, Redeploy solo puede darte otro de `main`.
3. **El Ignored Build Step no corre al guardarlo**, sino cuando llega un evento de push.
   Hasta el primer push a `dev` parece que "no se toma", y está bien.

La salida es un commit vacío en `dev` (`git commit --allow-empty`) para disparar el
pipeline con la rama correcta.

**Verificado sobre el bundle desplegado**, que es la prueba real de que el build salió de
`dev` y con las variables puestas:

| Cadena buscada en `/assets/*.js` | Encontrada |
|---|---|
| `dev-inventario.repuestop.cl` | 1 ✔ |
| `inventario.repuestop.cl` (sin `dev-`) | 0 ✔ |
| `api-dev.repuestop.cl` | 1 ✔ |
| `api.repuestop.cl` | 0 ✔ |
| `localhost:8080` | 0 ✔ |

`__DEPLOY_BRANCH__` se resolvió a `'dev'` y el compilador eliminó la rama muerta del
ternario, así que en el bundle queda una sola URL. Es la forma más directa de comprobar
que `VERCEL_GIT_COMMIT_REF` y `VITE_API_URL` quedaron bien, sin necesidad de iniciar sesión.

También verificado: SPA rewrite (`/perfil/pedidos` recargado da 200), redirect
`/postular-fundador` → `/vender`, `robots.txt` y `sitemap.xml` respondiendo.

**Sobre `Strict-Transport-Security`:** no llega, y **es lo esperado**. `repuestop.cl` hoy,
con el mismo `vercel.json`, tampoco lo emite: Vercel gestiona HSTS en el edge e ignora esa
entrada. Los otros cuatro headers sí llegan. No hay regresión respecto de lo que sirve
producción hoy, que era el objetivo. La entrada se deja en `vercel.json` porque documenta
la intención y no molesta.

**El catálogo viene vacío con errores de CORS en la URL `*.vercel.app`, y también es lo
esperado**: el CORS de dev permite `dev-repuestop.repuestop.cl`, no la URL de Vercel. Se
resuelve solo al mover el dominio (3.6). No agregar la URL de Vercel al CORS: es trabajo
que habría que deshacer.

### 3.5 Variables de entorno, por proyecto

*Settings → Environment Variables*. Son variables de **build**: Vite las inlinea al
compilar, así que **cambiar una exige un redeploy**; no basta con guardar.

| Variable | Proyecto dev | Proyecto producción | ¿Obligatoria? |
|---|---|---|---|
| `VITE_API_URL` | `https://api-dev.repuestop.cl/api/v1` | `https://api.repuestop.cl/api/v1` | **Sí, crítica** |
| `VITE_GOOGLE_CLIENT_ID` | `117201265366-ao32ed2314d1ncce1qt47biide1ij62r.apps.googleusercontent.com` | igual | No |
| `VITE_BUYER_PROFILE_COVER_URL` | (URL de portada) | igual | No |
| `VITE_DEPLOY_BRANCH` | **no setear** | **no setear** | No |

**`VITE_API_URL` es la que no se puede olvidar.** `src/services/api.js:2` cae a
`http://localhost:8080/api/v1` si falta, sin respaldo por hostname: el sitio compila,
despliega y se ve perfecto, y **todas** las llamadas al backend mueren en el navegador del
visitante. No rompe el build; rompe el sitio. Ojo con el sufijo `/api/v1` — la app móvil
usa `/api/` a secas, no copiar de ahí.

**`VITE_DEPLOY_BRANCH` ya no hace falta.** Decide a qué panel de vendedores apunta el header
(`__DEPLOY_BRANCH__ === 'main'` → `inventario.repuestop.cl`, si no → `dev-inventario`;
`Header.jsx:46` y `ProfileDashboard.jsx:295`). Con `VERCEL_GIT_COMMIT_REF` en la cadena de
`vite.config.js`, cada proyecto la resuelve solo: el de dev construye `dev` y apunta a
dev-inventario, el de prod construye `main` y apunta a inventario. Setearla a mano solo
agrega una forma de equivocarse.

*(Corrección al plan original: decía que sin `VITE_GOOGLE_CLIENT_ID` el login con Google
queda deshabilitado. No es así — `founderConfig.ts:32` trae el client ID real como fallback
y `AuthModal.jsx:14` lo tiene hardcodeado. La variable peligrosa es `VITE_API_URL`.)*

### 3.6 Mover `dev-repuestop.repuestop.cl` — el ensayo del corte

**Ese dominio ya existe y ya funciona**: es el del proyecto dev del sitio antiguo, el que
construye la rama `dev`. No hay DNS que configurar; el registro ya apunta a Vercel.

Lo que hay que hacer es **moverlo de proyecto**, que es el mismo procedimiento del corte
de producción del 3.8 — pero sobre el ambiente de desarrollo, donde no hay consecuencias.
Sale gratis usarlo como ensayo: si algo del procedimiento sorprende (la espera del
certificado, una verificación de dominio que Vercel pida), sorprende acá y no sobre
`repuestop.cl`.

1. Proyecto **dev del sitio antiguo** → *Settings → Domains* → quitar
   `dev-repuestop.repuestop.cl`.
2. Proyecto **`repuestop-market-dev`** → *Settings → Domains* → agregarlo.
3. Esperar el certificado. Hasta que Vercel lo emita, HTTPS falla.

**Rollback**: devolverlo al proyecto antiguo. Igual de reversible que en producción, y sin
usuarios mirando.

**Hecho el 21-08-2026, sin incidentes.** Vercel no pidió ningún registro DNS ni
verificación: reconoció el dominio y emitió el certificado. Los dos dominios del proyecto
(`dev-repuestop.repuestop.cl` y `dev-repuestop-market.vercel.app`) quedaron en *Valid
Configuration*. El catálogo empezó a traer datos en cuanto el dominio quedó activo, que es
la señal de que el CORS calzó.

El proyecto dev del sitio antiguo queda sin dominio pero **no se elimina**: se jubila en la
Fase 4. Mientras exista, devolverle el dominio es cuestión de dos clics.

### 3.7 Verificar

Primero en **dev**, que es el ambiente completo y no arriesga nada. Después, lo mínimo en el
`*.vercel.app` de producción.

**En `dev-repuestop.repuestop.cl` (contra `api-dev`)** — verificado el 21-08-2026:

- [x] Catálogo con datos reales: *2008 repuestos*, 12 por página.
- [x] Sin errores de CORS. Una llamada directa a `api-dev` devuelve **HTTP 401**, no un
      bloqueo: la petición llega al backend y vuelve con respuesta real. Un fallo de CORS
      lanzaría una excepción de red, no un status.
- [x] Ficha de producto con URL id-slug (`/repuestos/5024-filtro-de-aceite-toyota-yaris-2019`).
- [x] Carrito de invitado: persiste en `localStorage` (`repuestop_guest_cart_v1`) y los
      totales cuadran — `$10.000` productos `+ $3.000` despacho `= $13.000`, **sin
      comisión**, como manda la regla de `MarketplaceContext`.
- [x] El carrito corta en *"Inicia sesión para continuar"* en vez de dejar entrar al checkout.
- [x] `/nosotros` con el header y el footer del marketplace, H1 nuevo, cero "próximamente",
      las cinco secciones y el ancla `#experiencias` cayendo a 24px.
- [x] Las 15 rutas públicas responden 200, incluido `/perfil/pedidos` recargado (rewrite de
      SPA) y las siete de `/ayuda`.
- [x] `/postular-fundador` → `/vender`.
- [x] `robots.txt` y `sitemap.xml`.
- [x] Panel de vendedores → `dev-inventario`: verificado sobre el bundle (ver 3.4), que es
      más fuerte que mirarlo en pantalla y no necesita sesión.

Verificado con sesión real:

- [x] Login con Google, como comprador y como vendedor.
- [x] Checkout completo con boleta.
- [x] **Pago real en Flow**: el retorno cayó en
      `dev-repuestop.repuestop.cl/compra-exitosa?status=success&orderId=9`, con el pedido
      #000009 en Pagado / En preparación. Confirma que `WEB_BASE_URL` del backend dev está
      bien y que el comprobante y el seguimiento funcionan.
- [x] Totales del comprobante: $4.500 productos + envío sin costo (courier por pagar) =
      $4.500 pagados, sin comisión.
- [ ] Login con correo y contraseña — **no probado**, faltaban cuentas de prueba. Riesgo
      bajo: el login con Google ya validó CORS, `fetchApi`, el JWT, la sesión y el rol de
      vendedor; queda sin cubrir solo el endpoint de correo/contraseña, que es backend
      identico en dev y prod y que esta migración no toca.

**Nota de método**: el botón *"Añadir al carro"* abre primero un selector de método de
envío con backdrop. Al automatizar, un segundo clic pega contra el backdrop y parece que
la función está rota. No lo está.

**Proyecto de producción `repuestop-market`** — creado el 21-08-2026,
`https://repuestop-market.vercel.app`.

Esta vez no hizo falta el commit vacío: `main` es la rama por defecto del repo, así que
Vercel la tomó sola y Branch Tracking quedó en `main` sin tocar nada.

Verificado sobre el bundle desplegado, que da el espejo exacto de dev:

| Cadena en `/assets/*.js` | dev | prod |
|---|---|---|
| `dev-inventario.repuestop.cl` | 1 | **0** ✔ |
| `inventario.repuestop.cl` | 0 | **1** ✔ |
| `api-dev.repuestop.cl` | 1 | **0** ✔ |
| `api.repuestop.cl` | 0 | **1** ✔ |
| `localhost:8080` | 0 | **0** ✔ |

Es la prueba de que el arreglo de `vite.config.js` y las `VITE_API_URL` quedaron bien en
los dos ambientes, sin necesitar sesión en ninguno.

También verificado: los cuatro headers, el rewrite de SPA (`/perfil/pedidos` recargado da
200), el redirect `/postular-fundador` → `/vender`, y `robots.txt` / `sitemap.xml`
apuntando a `https://repuestop.cl` — correcto, porque son el destino final y no la URL de
Vercel.

Falta, y son los dos únicos toques a producción antes del corte:

- [ ] Agregar `https://repuestop-market.vercel.app` a `CORS_ALLOWED_ORIGINS` (Railway prod).
- [ ] Agregarlo a los orígenes autorizados en Google Cloud Console.
- [ ] Con eso: catálogo con datos de producción y login. Nada más — el resto ya está probado
      en dev.

**Si algo de esto falla, no seguir al 3.8.**

### 3.8 Mover el dominio ✅ hecho el 21-08-2026

Vercel no permite el mismo dominio en dos proyectos, así que hay unos minutos de corte.

1. Proyecto **antiguo de producción** → *Settings → Domains* → quitar `repuestop.cl`.
   (`www.repuestop.cl` no existía: el sitio antiguo vivía solo en el ápex.)
2. Proyecto **`repuestop-market`** → *Settings → Domains* → agregar `repuestop.cl` y
   `www.repuestop.cl`.

**El modo de falla que costó unos minutos de caída, y que no estaba en ningún runbook:**
al agregar los dos dominios, **Vercel configuró la redirección al revés por su cuenta** —
dejó `repuestop.cl → 308 → www.repuestop.cl`—. Como `www` no existía en DNS, el resultado
fue:

```
repuestop.cl      → HTTP 308 → https://www.repuestop.cl/
www.repuestop.cl  → no resuelve
```

O sea, **el sitio caído**: todo visitante terminaba en un host inexistente. Se arregla
solo en Vercel, sin tocar DNS: editar la fila del ápex y **quitarle la redirección**, y
después poner `www` como redirect al ápex. Con el primer clic el sitio vuelve, porque el
DNS del ápex ya resolvía.

**Verificar siempre la dirección de la redirección después de agregar los dominios.** El
ápex tiene que ser el canónico, no por gusto sino porque ya hay tres cosas apuntando ahí:
`sitemap.xml` y `robots.txt` listan `https://repuestop.cl/`, `WEB_BASE_URL` en Railway es
`https://repuestop.cl` (si el ápex redirige, cada retorno de Flow se come un salto extra),
y el sitio antiguo estaba indexado en el ápex.

`www.repuestop.cl` sí necesitó un registro nuevo, porque nunca había existido. El DNS vive
en **Cloudflare**, y el CNAME tiene que ir con **Proxy en "DNS only" (nube gris)**: si
queda proxeado, Vercel no valida el dominio y el TLS queda con doble proxy.

**Estado verificado tras el corte:**

| | |
|---|---|
| Ápex | HTTP 200, sirviendo el marketplace |
| `www` | 307 → ápex |
| CORS contra `api.repuestop.cl` | 200, `access-control-allow-origin: https://repuestop.cl` |
| Headers | los cuatro (HSTS lo gestiona Vercel, ver 3.4) |
| 14 rutas públicas | todas 200 |
| `/postular-fundador` | → `/vender` |
| `/compra-exitosa` | **200** — la URL que el retorno de Flow tenía rota ahora existe |
| `/nosotros` | H1 nuevo, chrome del marketplace, un solo footer, cero "próximamente" |
| Cifras de vendedores | ninguna |

**Rollback** (ya no necesario, pero sigue disponible): devolver los dominios al proyecto
antiguo, que no se elimina hasta la Fase 4.

### 3.9 Después del corte

- [ ] `https://repuestop.cl` sirve el marketplace, con candado válido.
- [ ] `https://www.repuestop.cl` redirige al ápex.
- [ ] Rehacer el checklist sobre el dominio real.
- [ ] Probar un pago y que el retorno de Flow caiga en `repuestop.cl/compra-exitosa`. Antes
      del corte esa URL no existía.
- [ ] **Quitar `https://repuestop-market.vercel.app` de `CORS_ALLOWED_ORIGINS`** en el
      backend de producción.
- [ ] Quitar ese mismo origen de los autorizados en Google Cloud Console.
- [ ] **Evitar que `repuestop-market.vercel.app` compita en Google.** Vercel marca
      `noindex` en los deployments de *preview*, pero **no** en el alias de producción, así
      que después del corte ese dominio seguiría sirviendo el sitio completo y Google puede
      indexarlo como contenido duplicado de `repuestop.cl`. Se arregla agregando a
      `vercel.json` un redirect condicionado por host:

      ```json
      {
        "source": "/(.*)",
        "has": [{ "type": "host", "value": "repuestop-market.vercel.app" }],
        "destination": "https://repuestop.cl/$1",
        "permanent": true
      }
      ```

      **Va después del corte, no antes**: mientras se verifica, ese dominio tiene que servir
      el sitio. El mismo problema aplica a `dev-repuestop-market.vercel.app`, aunque ahí
      importa menos.
- [ ] Search Console: enviar `https://repuestop.cl/sitemap.xml`. El sitio pasa de una landing
      de una página a un marketplace de muchas rutas; la indexación se rehace y las
      posiciones actuales se van a mover.

### Resumen del orden

```
3.1 crear rama dev
 └→ 3.2 backends (verificado: no habia que cambiar nada)
     └→ 3.3 Google (verificado: faltaba www)
         └→ 3.4 crear los dos proyectos Vercel + Ignored Build Step
             └→ 3.5 variables de entorno por proyecto
                 └→ 3.6 mover dev-repuestop (ensayo del corte)
                     └→ 3.7 VERIFICAR: todo en dev, lo clave en prod  ← si falla, se para acá
                         └→ 3.8 mover el dominio (hecho)
                             └→ 3.9 limpieza y Search Console
```

## Estado al 21-08-2026

**Fases 1, 2 y 3 cerradas.** `repuestop.cl` sirve el marketplace. El detalle de lo que
paso en produccion —incluidos los dos hotfixes de backend que hubo que hacer, el error de
metodos de envio que quedo abierto y el riesgo de SEO mientras la pagina no se lanza— esta
en `HANDOFF_PROXIMO_AGENTE.md`, seccion 3.

Queda solo la Fase 4.

## Fase 4 — Jubilar el repo antiguo

1. Dejar el último commit con un `README` que diga dónde vive ahora el contenido.
2. **Archivar** el repositorio en GitHub, no borrarlo: es el historial de cómo nació el
   proyecto.
3. Eliminar **los dos** proyectos de Vercel del sitio antiguo —el de `main` y el de
   `dev`— solo después de que el dominio lleve unos días estable en el nuevo. Archivar el
   repo en GitHub no borra sus proyectos de Vercel: hay que hacerlo aparte, o quedan
   colgando de un repo que ya nadie toca.

---

## Riesgos y cómo se mitigan

**El corte de dominio no es reversible al instante.** Si algo sale mal, volver implica
mover el dominio de nuevo y esperar propagación otra vez. Por eso la Fase 3 verifica todo
en `*.vercel.app` **antes** de tocar `repuestop.cl`.

**El SEO cambia de forma.** `repuestop.cl` está indexado como una landing de una sola
página con anclas. Pasa a ser un marketplace con muchas rutas. Las posiciones actuales se
van a mover, y el sitemap nuevo hay que enviarlo a Search Console.

**El CSS scopeado.** Las 1.414 líneas de `about-repuestop.css` solo son seguras mientras
el scope `.repuestop-about-page` se mantenga. Si en la Fase 1 se "limpia" ese prefijo,
reglas como `section[id] { scroll-margin-top }` empiezan a aplicar a todo el sitio.

**El backend no cambia.** `api.repuestop.cl` sigue igual; esto es solo frontend.
