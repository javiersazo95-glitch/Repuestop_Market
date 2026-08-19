# Plan: alinear la vista del comprador con la del proveedor

Estado: **aplicado** (build y lint verdes). Este documento queda como registro
de la decision, no como backlog.
Alcance: `src/index.css` (bloque del dashboard) + ajustes puntuales en
`src/components/ProfileDashboard.jsx`. No toca API, adapters ni backend.

## 1. Diagnostico

Ambos roles renderizan **el mismo componente** (`ProfileDashboard.jsx`, 2327 lineas):
mismo topbar, mismo hero "facebook", mismo sidebar, misma grilla de Resumen
(`profile-overview-grid` = columna principal + `profile-overview-side-col`).
La diferencia visual NO esta en el JSX, esta en el CSS: en `src/index.css`
existe un bloque de rediseño **scoped solo a vendedor**:

- `src/index.css:760-936` — banner "SELLER DASHBOARD — desktop layout aligned
  with the provider proposal", ~140 reglas con prefijo `.seller-profile-dashboard`
  + 3 media queries (1180 / 900 / 640).

El comprador (`.buyer-profile-dashboard`, clase asignada en
`ProfileDashboard.jsx:978`) no tiene ningun override y cae en los estilos base
antiguos, repartidos en:

- topbar base: `src/index.css:2762-2880`
- hero legacy (`.profile-hero*`, muerto salvo `.profile-hero-avatar/-tags`): `2884-2995`
- `.profile-body` / `.profile-sidebar` / `.sidebar-mini-profile`: `3001-3120`
- `.profile-overview-grid` / stats v2 / quick actions v2 / widgets: `3445-3830`
- hero "facebook" base: `6587-6790`

### Diferencias concretas comprador vs proveedor

| # | Aspecto | Comprador (base) | Proveedor (override) |
|---|---------|------------------|----------------------|
| 1 | Ancho del contenido | `.profile-body` `max-width:1280px` centrado (`3001`) | `max-width:none`, `padding:24px 28px 54px` (`848`) |
| 2 | Alineacion hero/cuerpo | `.facebook-cover-hero-container` es **full-bleed** con `border-radius` y `margin-bottom:24px` (`6591`), mientras el cuerpo esta centrado a 1280 → avatar pegado al borde izquierdo de la ventana y desalineado con el sidebar | contenedor `height:202px`, sin radio ni sombra, y `.facebook-hero-bar` en `position:absolute` con `max-width:1440px; padding:0 42px` (`798-826`) → hero alineado con el cuerpo |
| 3 | Hero | barra blanca bajo la portada, nombre negro 26px, avatar 130px con `margin-top:-65px` | textos **sobre** la portada con velo oscuro, nombre blanco 28px, avatar 114px centrado vertical |
| 4 | Sidebar | tarjeta blanca redondeada (radio 20, sombra fuerte) con `sidebar-mini-profile` oscuro arriba (duplica el nombre del hero) | sidebar transparente, sin tarjeta, `sidebar-mini-profile { display:none }` (`866`), items 38px/12px |
| 5 | Grilla Resumen | `minmax(0,1fr) 340px`, gap 24 (`3446`) | `minmax(0,1fr) 266px`, gap 28 (`875`) |
| 6 | KPIs | `auto-fit minmax(180px,1fr)` → con la columna angosta caen **3+1** (se ve en la captura) | `repeat(4, 1fr)` fijo, tarjetas 134px (`878-883`) |
| 7 | Acciones rapidas | `auto-fit minmax(240px,1fr)` → 2 columnas | `repeat(3,1fr)`, tarjetas 78px (`888-892`) |
| 8 | Densidad general | radios 18-20px, paddings 24-26px, titulos 16px | radios 10-11px, paddings 16-18px, titulos 14px (`885-902`) |
| 9 | Actividad reciente | filas base | grilla de 3 columnas comprimida, 11px (`893-898`) |
| 10 | Topbar | `max-width:1280`, chip con sombra, boton "Salir" visible | full width `padding:10px 28px`, chip plano, `btn-topbar-logout { display:none }` (`795`) |
| 11 | Fondo | `#f4f6fb` | `#f8fafc` (`765`) |
| 12 | Responsive | solo `max-width:860px` heredado | breakpoints propios 1180/900/640 (`904-936`) |

### Diferencias que son de ROL y deben conservarse

- Hero: chip "Tienda Verificada" y "Beneficio Tarifa Fundador" son `isSeller`
  (`ProfileDashboard.jsx:1068-1090`); el comprador solo lleva "Miembro desde".
- CTA "Retirar dinero" en hero: `isSeller && activeTab==='resumen'` (`1095`).
- Topbar "Visitar mi tienda": `isSeller && user.sellerId` (`992`).
- Sidebar: `BUYER_SIDEBAR_GROUPS` vs `SELLER_SIDEBAR_GROUPS` (`389`).
- KPIs y acciones rapidas: ya divergen por rol (`860-930`).
- Widget lateral "Resumen de tus compras": solo comprador (`1276`).
- Portada: el comprador usa `BUYER_PROFILE_COVER_URL` fija (`43`, `513-515`);
  el boton "Editar portada" solo se renderiza para vendedor (`1032`).
- Camara sobre el avatar: el vendedor la oculta por CSS (`829`) porque cambia el
  logo desde "Mi tienda y datos". **El comprador la necesita**: es su unica via
  para subir foto (y el paso de onboarding `avatar` la invoca, `782`).

## 2. Enfoque elegido

**Promover el bloque del vendedor a bloque compartido del dashboard**, en vez de
duplicarlo con prefijo `.buyer-profile-dashboard`. Razones:

- las ~140 reglas son de layout y densidad, no de rol;
- duplicar deja dos bloques que se desincronizan al primer ajuste;
- todo queda scoped bajo `.profile-dashboard`, que solo usa este componente
  (verificado: ninguna otra vista usa `profile-dashboard`, `facebook-hero-bar`
  ni `tag-contrast`).

Quedan como excepciones explicitas de rol solo 3 reglas.

## 3. Pasos

### Paso 1 — `src/index.css:760-936`: reescribir el prefijo

1. Cambiar el banner del bloque a:
   `PROFILE DASHBOARD — layout denso compartido por comprador y proveedor`
   (explicando que las excepciones por rol van marcadas abajo).
2. Reemplazar `.seller-profile-dashboard` por `.profile-dashboard` en todo el
   rango 765-936, **incluidas las 3 media queries**, EXCEPTO en las reglas del
   paso 2.

### Paso 2 — excepciones que siguen siendo del vendedor

Mantener con prefijo `.seller-profile-dashboard`:

- `795` `.btn-topbar-logout { display: none; }`  (ver Pregunta A)
- `829` `.btn-change-avatar-camera { display: none; }`
- `813` `.btn-change-cover-photo { display: none; }` → **regla muerta**: el boton
  solo se renderiza si `isSeller` (`1032`). Eliminarla.

Ademas, `871` `.profile-nav-item.nav-seller.active` debe generalizarse a
`.profile-dashboard .profile-nav-item.active { color:#0875eb; background:#eaf3ff; box-shadow:none; }`
para que el item activo del comprador (`nav-buyer`) tome el mismo azul.

### Paso 3 — ajustes que el comprador necesita y el vendedor no tenia

Agregar al final del bloque compartido (una linea por selector, estilo del archivo):

1. Camara del avatar sobre el hero oscuro: con avatar de 114px la posicion base
   (`bottom:4px; right:4px; 34px`) queda grande; usar
   `.buyer-profile-dashboard .btn-change-avatar-camera { width:30px; height:30px; bottom:2px; right:2px; }`.
2. `.buyer-profile-dashboard .facebook-hero-name` / `-email` heredan el blanco del
   bloque compartido (reglas `833-834`) — verificar contraste contra
   `comprador-default.png`; si la portada es clara, subir el velo del comprador:
   `.buyer-profile-dashboard .facebook-cover-banner::before { background: linear-gradient(90deg, rgba(5,21,42,.72), rgba(5,21,42,.30) 60%, rgba(5,21,42,.55)); }`.
3. El comprador tiene 6 acciones rapidas (`overviewActions`, `920-928`) → con
   `repeat(3,1fr)` quedan 2 filas de 3, igual que el vendedor. Sin cambio.

### Paso 4 — `src/components/ProfileDashboard.jsx`

Cambios minimos (el JSX ya es comun):

1. `1112-1124` — `sidebar-mini-profile` queda oculto por CSS para ambos roles.
   Opcional: borrar el bloque JSX y las reglas `3040-3100` (`.sidebar-mini-*`).
   Recomendado dejarlo para una pasada de limpieza aparte, no en este cambio.
2. Solo si se responde SI a la Pregunta B: agregar el CTA de hero del comprador
   junto al del vendedor (`1095-1107`), reutilizando `.btn-withdraw-money-hero`
   o una clase hermana.
3. Nada mas: KPIs, acciones, widgets y checklist ya son por rol.

### Paso 5 — limpieza opcional (mismo commit o aparte)

CSS que queda muerto tras el cambio: `.profile-hero`, `.profile-hero.hero-buyer`,
`.profile-hero.hero-seller`, `::before/::after` decorativos y `.profile-hero-inner`
(`2884-2930`) — ninguna de esas clases se renderiza hoy. `.profile-hero-avatar`
(`2938`) y `.profile-hero-tags` (`2985`) SI se usan: no tocarlas.

## 4. Verificacion

1. `npm run build` (debe pasar) y `npm run lint` (sin errores nuevos; warnings
   preexistentes de `no-unused-vars` en `ProfileDashboard.jsx` son tolerados).
2. Preview en `/perfil/resumen` con cuenta comprador: hero alineado con el
   sidebar, KPIs en 4 columnas, acciones en 3, sin tarjeta de mini-perfil.
3. Revisar las otras pestañas del comprador con el cuerpo ancho: `pedidos`,
   `cotizaciones`, `favoritos`, `datos` (usa `BuyerAddressBook`), `anuncios` y
   `soporte` (`ProfileSupportPanel`, ya denso desde el commit 8605a29).
4. Revisar que la vista del **vendedor no cambie**: es la misma cascada, el
   riesgo esta en el paso 2 (item activo del sidebar) y en el paso 3.
5. Responsive: 1180 / 900 / 640 en ambos roles.

## 5. Decisiones tomadas

- **A. "Salir"**: se muestra en **ambos** roles. Se elimino la regla que lo ocultaba
  en proveedor.
- **B. CTA del hero del comprador**: "Buscar repuestos" → `ROUTES.catalog`, solo en
  la pestaña Resumen (espejo de "Retirar dinero"). Clase nueva `.btn-hero-cta`,
  alias de `.btn-withdraw-money-hero` en las 5 reglas donde vive ese boton.
- **C. Portada del comprador**: sigue fija (`VITE_BUYER_PROFILE_COVER_URL`).
- **D. Chips del hero del comprador**: solo "Miembro desde".

## 6. Hallazgo extra durante la aplicacion

`src/index.css` tenia una **copia minificada del bloque completo del proveedor**
al final del archivo (comentario "Seller provider dashboard: final scoped
overrides (kept last for cascade)", ~6 lineas de 2-4 KB cada una). Valores
identicos al bloque original — se comparo regla por regla — pero al ir ultima
revertia para el proveedor cualquier cambio hecho arriba (entre otros, volvia a
ocultarle "Salir"). Se elimino: el bloque compartido queda como unica fuente.

Efecto secundario a tener presente: el bloque compartido esta al inicio del
archivo, no al final, asi que ahora depende de **especificidad** y no de orden.
Todas sus reglas son de 2 clases y le ganan a las bases de 1 clase; las dos
excepciones se resolvieron a mano:

- `.profile-dashboard { background }` (1 clase) chocaba con la regla base del
  mismo selector mas abajo → se quito el `background` de la base (`2757`).
- `.profile-nav-item.nav-buyer/.nav-seller.active` (3 clases, linea ~3132) le
  ganaba al item activo compartido → el compartido subio a 4 clases.

## 7. Preguntas abiertas

(resueltas, se dejan como referencia de la conversacion)

- **A. Boton "Salir"**: el vendedor lo oculta (`795`), el comprador lo muestra.
  Propuesta: mantenerlo visible para el comprador (es su unica salida de sesion
  desde el dashboard) y revisar aparte si al vendedor le falta.
- **B. CTA en el hero del comprador**: el vendedor tiene "Retirar dinero" a la
  derecha; sin CTA ese espacio queda vacio. Opciones: (1) sin CTA, (2)
  "Buscar repuestos" → home/catalogo, (3) "Mis pedidos". Propuesta: (2).
- **C. Portada del comprador**: hoy fija por env. Con el hero oscuro se ve como
  banner de 202px. Confirmar si queda fija o si se le habilita el selector de
  portadas (implica endpoint/plantillas para comprador, hoy solo hay de tienda).
- **D. Chips del hero del comprador**: solo "Miembro desde". Se puede sumar algo
  propio del rol (ej. "N compras", "RUT verificado"). Propuesta: dejar solo
  "Miembro desde" en este cambio.
