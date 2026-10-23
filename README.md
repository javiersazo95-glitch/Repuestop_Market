# RepuesTop Market

Marketplace de repuestos (React + Vite). El backend Spring Boot se configura con
`VITE_API_URL` (ver `.env.example`).

## Rutas

La navegación usa `react-router-dom`. Toda URL es compartible y sobrevive a un
refresco; los paths se construyen desde `src/routes/paths.js` (no escribas rutas
a mano en los componentes).

| Ruta | Vista |
| --- | --- |
| `/` | Home del marketplace |
| `/repuestos` | Catálogo. Filtros en el query string: `?categoria=`, `?categoriaId=`, `?subcategoria=`, `?subcategoriaId=`, `?q=`, `?pagina=` |
| `/repuestos/:id-slug` | Ficha del repuesto (ej. `/repuestos/37-aceite-5w30`) |
| `/tiendas` | Directorio de tiendas |
| `/tiendas/:id-slug` | Perfil público de una tienda |
| `/perfil/:pestaña` | Panel de la cuenta (requiere sesión). Ej. `/perfil/pedidos` |
| `/ayuda` | Centro de ayuda |
| `/nosotros` | Quiénes somos |
| `/vender` | Registro de tienda fundadora |
| cualquier otra | Página 404 |

El id va primero en el slug (`37-aceite-5w30`) para poder resolverlo aunque el
nombre del producto cambie.

## Despliegue (fallback SPA)

El router vive en el cliente, así que el servidor debe responder el HTML de la SPA
para cualquier ruta desconocida; si no, `/perfil/pedidos` devuelve 404 al
refrescar. Ya está resuelto para Netlify/Cloudflare Pages (`public/_redirects`) y
Vercel (`vercel.json`, que sirve `app.html`: ver la sección SEO). En Nginx:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## SEO: páginas indexables (23-10-2026)

Una SPA entrega el mismo HTML en todas las rutas. Hasta el 23-oct eso hacía que
`/vender`, `/nosotros`, `/ayuda` y los legales tuvieran el título, la descripción y el
`canonical` del inicio, y Google las trataba como copias de la portada. Ahora:

- **`src/routes/seoPages.js`** es la lista única de páginas indexables (título y
  descripción de cada una). Las categorías de ayuda entran solo si tienen preguntas para
  visitantes (`HELP_ROLES.GUEST`): Google entra sin sesión y las demás lo redirigen a
  `/ayuda`.
- El plugin **`paginasIndexables`** de `vite.config.js`, al compilar, escribe
  `dist/<ruta>/index.html` por página (título, descripción, `canonical`, `og:url`,
  `og:title`, `og:description` propios), `dist/sitemap.xml` con esas mismas URL y
  `dist/app.html` (sin `canonical` ni `og:url`) para el resto de las rutas de la SPA.
- **`vercel.json`** enruta cada página a su archivo y el resto a `app.html`. El build
  **falla** si una página de la lista no tiene su rewrite (`vercel.json` no admite
  comentarios ni importar la lista).
- **`public/robots.txt`** abre esas mismas rutas (apertura parcial del 20-oct) y declara
  el sitemap. Al agregar una página: sumarla en `seoPages.js`, en el rewrite de
  `vercel.json` y en el `robots.txt`.
- `dev-repuestop.repuestop.cl` responde `X-Robots-Tag: noindex, nofollow` (header por host
  en `vercel.json`) para no competir con `repuestop.cl`.
- `useDocumentTitle` usa el mismo `BASE_TITLE` del `<title>` de `index.html`;
  `useNoIndex` marca la página 404 como no indexable, porque las URL inexistentes
  responden 200.

`npm run preview` no reproduce los rewrites de Vercel: sirve la portada en `/vender` y el
archivo generado solo en `/vender/`. Para revisar lo que ve Google, mirar
`dist/<ruta>/index.html` o el sitio ya desplegado.

**Al abrir el catálogo a compradores** (plan P3-12): activar la configuración completa del
`robots.txt` y agregar `/repuestos` y `/tiendas` a `seoPages.js` y a `vercel.json`. Las
fichas de producto y de tienda (`/repuestos/:id`, `/tiendas/:id`) necesitan su propio
título y `canonical` desde el backend; no entran en esta lista estática.

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción en `dist/`
- `npm run preview` — sirve el build
- `npm run lint` — oxlint
