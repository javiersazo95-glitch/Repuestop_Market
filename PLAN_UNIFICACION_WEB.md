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

## Fase 1 — `/nosotros` dentro del marketplace

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

**Verificación:** `/nosotros` con el header y el footer del marketplace, las cinco
secciones con la paleta correcta, las anclas cayendo en el lugar justo, y el resto del
sitio sin cambios visuales (nada del CSS scopeado se escapó).

## Fase 2 — Actualizar el contenido

El texto describe la plataforma como "web disponible, app próximamente", pero la web ya
hace bastante más de lo que cuenta.

**Qué ofrece hoy la web y no está en el texto:** carrito multi-tienda con envío por
proveedor, checkout en tres pasos con boleta o factura, pago de cotizaciones cerradas en
el chat, comprobante con seguimiento del pedido, mural de anuncios, centro de ayuda con
tickets, y mediación de disputas con evidencia.

**Qué traerá la app** (según el monorepo): agendamiento de citas con configuración de
agenda, historial de citas, monedero de Fichas y publicación de anuncios desde el
teléfono.

Acordado: yo propongo los textos y tú los corriges.

## Fase 3 — Vercel y el dominio

**Es la fase con riesgo real: acá se toca producción.**

1. **Crear el proyecto Vercel del marketplace** apuntando a
   `javiersazo95-glitch/Repuestop_Market`, rama `main`.
2. **Variables de entorno** (hoy en `.env` local, ver `CLAUDE.md`): `VITE_API_URL`
   (`https://api.repuestop.cl/api/v1`), `VITE_GOOGLE_CLIENT_ID`,
   `VITE_BUYER_PROFILE_COVER_URL`, `VITE_DEPLOY_BRANCH`.
   **Sin `VITE_GOOGLE_CLIENT_ID` el login con Google queda deshabilitado**, y es fácil de
   olvidar porque no rompe el build.
3. **Verificar el deploy en la URL `*.vercel.app`** antes de tocar el dominio: login,
   catálogo contra el backend real, carrito, checkout y `/nosotros`.
4. **Copiar los headers de seguridad** del `vercel.json` antiguo al del marketplace, que
   hoy solo tiene el rewrite de SPA: `X-Frame-Options`, `X-Content-Type-Options`,
   `Referrer-Policy`, `Strict-Transport-Security`, `X-XSS-Protection`.
5. **Agregar el redirect** de `/postular-fundador` a `/vender` (301) en `vercel.json`.
6. **Crear `robots.txt` y `sitemap.xml`** en `public/` del marketplace, con las rutas
   reales (`/`, `/repuestos`, `/tiendas`, `/nosotros`, `/ayuda`, `/terminos`,
   `/privacidad`, `/mural-anuncios`). El sitemap del sitio antiguo apuntaba a anclas de
   una sola página (`/#experiencias`); ese ya no aplica.
7. **Mover el dominio**: quitar `repuestop.cl` (y `www`) del proyecto antiguo y agregarlo
   al nuevo. Vercel no permite el mismo dominio en dos proyectos, así que hay unos minutos
   de corte. Conviene hacerlo en horario de bajo tráfico.
8. **Después del corte**: verificar HTTPS, que `www` redirija al ápex, y revisar Search
   Console — el sitio cambia de una landing de una página a un marketplace de muchas, y
   la indexación se rehace.

## Fase 4 — Jubilar el repo antiguo

1. Dejar el último commit con un `README` que diga dónde vive ahora el contenido.
2. **Archivar** el repositorio en GitHub, no borrarlo: es el historial de cómo nació el
   proyecto.
3. Eliminar el proyecto de Vercel del sitio antiguo **solo después** de que el dominio
   lleve unos días estable en el nuevo.

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
