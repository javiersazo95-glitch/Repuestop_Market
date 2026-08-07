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

El router vive en el cliente, así que el servidor debe responder `index.html`
para cualquier ruta desconocida; si no, `/perfil/pedidos` devuelve 404 al
refrescar. Ya está resuelto para Netlify/Cloudflare Pages (`public/_redirects`) y
Vercel (`vercel.json`). En Nginx:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción en `dist/`
- `npm run preview` — sirve el build
- `npm run lint` — oxlint
