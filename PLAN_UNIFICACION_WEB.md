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

### 3.2 Los backends (Railway) — antes de crear nada en Vercel

Hay **dos instancias** del backend, y cada una tiene su propia configuración.

**a) CORS.** El perfil de producción trae hoy (`application-prod.properties:27`):

```
https://repuestop.cl,https://www.repuestop.cl,https://inventario.repuestop.cl,https://backoffice.repuestop.cl
```

`repuestop.cl` ya está, así que después del corte el market funciona sin tocar nada. Pero
para **verificar el proyecto de producción antes de mover el dominio** hace falta agregar
temporalmente su URL de Vercel:

```
…,https://repuestop-market.vercel.app
```

El backend usa `setAllowedOriginPatterns` (`SecurityConfig.java:190`), así que acepta
comodines, aunque el comentario del archivo recomienda evitarlos en prod. **Quitar esa
entrada después del corte** (paso 3.8).

En el backend **dev**, `dev-repuestop.repuestop.cl` ya está en la lista. Nada que hacer.

**b) `WEB_BASE_URL` — acá hay un problema en el ambiente dev.**

Es a donde el backend manda al comprador **después de pagar en Flow**: `PagoController`
construye `${WEB_BASE_URL}/compra-exitosa?status=success&orderId=…`.

`application.properties:67` lo define como `${WEB_BASE_URL:https://repuestop.cl}` y
**`application-dev.properties` no lo sobrescribe**. O sea: salvo que Railway tenga la
variable seteada en la instancia de dev, **un pago de prueba en el ambiente de desarrollo
manda al comprador a producción**. Verificar en Railway y, si falta:

| Instancia | `WEB_BASE_URL` |
|---|---|
| Backend dev | `https://dev-repuestop.repuestop.cl` |
| Backend prod | `https://repuestop.cl` (déjalo como está) |

Segunda consecuencia: **hoy esa URL está rota en producción**. `repuestop.cl` sirve la
landing antigua, que no tiene `/compra-exitosa`, así que un pago real desde la web deja al
comprador en una página que no existe. Mover el dominio **arregla** esto.

### 3.3 Google Cloud Console — orígenes autorizados

El login con Google usa `google.accounts.id.initialize` (`AuthModal.jsx:29`) y Google valida
el **origen exacto**. Un origen no autorizado no da error claro: el botón simplemente no
funciona.

*APIs y servicios → Credenciales →* cliente OAuth `117201265366-…apps.googleusercontent.com`
*→ Orígenes de JavaScript autorizados*:

- `https://dev-repuestop.repuestop.cl` — nuevo, para el ambiente dev
- `https://repuestop-market.vercel.app` — temporal, para verificar prod antes del corte
- `https://repuestop.cl` y `https://www.repuestop.cl` — **confirmar que ya estén**. Deberían,
  por el sitio antiguo, pero verificarlo antes del corte y no después.

Los cambios de orígenes tardan unos minutos en propagar.

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

**El nombre del proyecto define la URL `*.vercel.app`** que hay que allowlistear en 3.2 y
3.3. Elegirlo antes y no cambiarlo después.

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

### 3.6 DNS de `dev-repuestop.repuestop.cl`

En el proyecto dev, *Settings → Domains* → agregar `dev-repuestop.repuestop.cl`. Vercel va a
pedir un registro DNS (normalmente un `CNAME` a `cname.vercel-dns.com`) en el proveedor
donde vive `repuestop.cl`. Es el mismo procedimiento que se usó para `dev-inventario` y
`dev-backoffice`, así que el patrón ya está en el proveedor.

**Esto no toca producción**: es un subdominio nuevo, `repuestop.cl` sigue intacto.

### 3.7 Verificar

Primero en **dev**, que es el ambiente completo y no arriesga nada. Después, lo mínimo en el
`*.vercel.app` de producción.

**En `dev-repuestop.repuestop.cl` (contra `api-dev`):**

- [ ] La home carga y el catálogo trae productos reales del backend.
- [ ] Consola del navegador sin errores de CORS.
- [ ] Login con correo y contraseña.
- [ ] Login con Google (si falla solo este: origen no autorizado en 3.3).
- [ ] Búsqueda por patente y filtro del catálogo.
- [ ] Agregar al carrito y que el total cuadre (`subtotal + envío`, sin comisión).
- [ ] Checkout: los tres pasos, boleta y factura, hasta la pantalla de pago.
- [ ] Si se prueba un pago: que el retorno caiga en `dev-repuestop…/compra-exitosa` y **no**
      en `repuestop.cl` (valida 3.2b).
- [ ] `/nosotros` con el header y el footer del marketplace, anclas cayendo bien.
- [ ] `/ayuda` y `/ayuda/contacto`.
- [ ] Una URL profunda **recargada con F5** (ej. `/perfil/pedidos`): valida el rewrite de SPA.
- [ ] `/postular-fundador` redirige a `/vender`.
- [ ] `/robots.txt` y `/sitemap.xml` responden.
- [ ] Como vendedor, que el panel de inventario apunte a **`dev-inventario`**.

**En `repuestop-market.vercel.app` (contra `api` de producción):**

- [ ] El catálogo trae productos del backend **de producción** (valida 3.2a y `VITE_API_URL`).
- [ ] Login con correo y contraseña.
- [ ] Como vendedor, que el panel de inventario apunte a **`inventario`**, sin el `dev-`.
      Esto valida el arreglo de `vite.config.js`; es el error que no avisa.
- [ ] Los headers de seguridad llegan:

```bash
curl -sI https://repuestop-market.vercel.app | grep -i "x-frame-options\|x-content-type\|referrer-policy\|strict-transport"
```

**Si algo de esto falla, no seguir al 3.8.**

### 3.8 Mover el dominio

Vercel no permite el mismo dominio en dos proyectos, así que hay **unos minutos de corte**.
Hacerlo en horario de bajo tráfico.

1. Proyecto **antiguo de producción** → *Settings → Domains* → quitar `repuestop.cl` y
   `www.repuestop.cl`.
2. Proyecto **`repuestop-market`** → *Settings → Domains* → agregar `repuestop.cl`, y
   `www.repuestop.cl` como redirect al ápex.
3. Si el DNS ya apunta a Vercel, no hay que tocar registros: el dominio solo cambia de
   proyecto. Si Vercel pide verificación, seguir sus instrucciones de DNS.
4. Esperar a que Vercel emita el certificado. Hasta que emita, HTTPS falla.

**Rollback**: volver a mover el dominio al proyecto antiguo. No es instantáneo —hay que
esperar el certificado otra vez—, por eso todo se verifica antes.

**El proyecto dev del sitio antiguo no se toca en este paso.** Se jubila en la Fase 4, junto
con el repo.

### 3.9 Después del corte

- [ ] `https://repuestop.cl` sirve el marketplace, con candado válido.
- [ ] `https://www.repuestop.cl` redirige al ápex.
- [ ] Rehacer el checklist sobre el dominio real.
- [ ] Probar un pago y que el retorno de Flow caiga en `repuestop.cl/compra-exitosa`. Antes
      del corte esa URL no existía.
- [ ] **Quitar `https://repuestop-market.vercel.app` de `CORS_ALLOWED_ORIGINS`** en el
      backend de producción.
- [ ] Quitar ese mismo origen de los autorizados en Google Cloud Console.
- [ ] Search Console: enviar `https://repuestop.cl/sitemap.xml`. El sitio pasa de una landing
      de una página a un marketplace de muchas rutas; la indexación se rehace y las
      posiciones actuales se van a mover.

### Resumen del orden

```
3.1 crear rama dev
 └→ 3.2 backends (CORS prod temporal + WEB_BASE_URL en dev)
     └→ 3.3 Google (orígenes autorizados)
         └→ 3.4 crear los dos proyectos Vercel + Ignored Build Step
             └→ 3.5 variables de entorno por proyecto
                 └→ 3.6 DNS de dev-repuestop
                     └→ 3.7 VERIFICAR: todo en dev, lo clave en prod  ← si falla, se para acá
                         └→ 3.8 mover el dominio
                             └→ 3.9 limpieza y Search Console
```

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
