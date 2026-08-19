# Plan — Centro de ayuda como vista propia

Rediseño del centro de ayuda (`/ayuda`) para convertirlo en una vista autónoma,
accesible desde cualquier parte de la web, con header propio, subrutas por
categoría y el formulario de consulta/reclamo en su propia ruta.

Fecha de definición: 2026-08-19. Rama: `main`.

---

## 0. Decisiones cerradas con el usuario

| Tema | Decisión |
|---|---|
| Chrome | **Header propio** de la vista + **Footer global existente** (`src/components/Footer.jsx`), fuera de `AppLayout`. |
| Pestaña `soporte` del perfil | **Se elimina** el render embebido; el item del sidebar navega a `/ayuda`. `consultas` (Reportes/Disputa) se queda en el perfil. |
| Categorías | **Subrutas reales** `/ayuda/:categoria`, con FAQ en acordeón. **Sin** página de artículo individual. |
| Formulario ticket/reclamo | **Subruta `/ayuda/contacto`**, dos columnas, con `?tema=` para preseleccionar. |
| "Estado del sistema" | **Fuera** (no hay endpoint de health). Se reemplaza por **"Mis casos abiertos"** con conteo real. |
| Buscador del hero | **No se implementa.** El hero queda con título, bajada e ilustración/icono. |
| Recursos útiles | Apuntan a categorías de ayuda (`/ayuda/politicas`, `/ayuda/seguridad`), no a páginas legales inexistentes. |

---

## 1. Mapa del estado actual (para no releer archivos)

**Ruta y página**
- `src/routes/paths.js:13` → `support: '/ayuda'`. No hay más rutas de ayuda.
- `src/routes/AppRoutes.jsx:39` → `<Route path={ROUTES.support} element={<SupportPage />} />` **dentro** del `<Route element={<AppLayout />}>` (líneas 33-46). Las páginas full-screen (`about`, `sellerRegister`) van fuera, líneas 51-52.
- `src/pages/SupportPage.jsx` (21 líneas) → solo monta `<SupportHelpPanel standalone onBack={nav.goHome} onViewCases={...} />`.
- `src/routes/useAppNavigation.js:38-41` → `goSupport: () => navigate(ROUTES.support)` y `goHelp: () => (isLoggedIn ? goProfile('soporte') : navigate(ROUTES.support))`.

**Componente central: `src/components/SupportHelpPanel.jsx` (167 líneas)**
Contiene, en este orden:
- Constantes de contenido: `BUYER_FAQS`, `SELLER_FAQS`, `GUEST_FAQS` (4 pares `[pregunta, respuesta]` cada una), `TOPICS` (por `COMPRADOR`/`VENDEDOR`, pares `[label, topicId]`), `SUBJECTS` (asuntos por `topicId`), `BUYER_CLAIMS`, `SELLER_CLAIMS`.
- Helpers: `normalizedStatus(order)` (mapea `PENDIENTE|PAGADO|EN_PREPARACION|ENVIADO|ENTREGADO|RECIBIDO|FINALIZADO|EN_MEDIACION|CANCELADO` → `pending|preparing|sent|received|finished|mediation|cancelled`) y `orderClaimOptions(order, reportType)` (motivos de reclamo condicionados al estado del pedido y a si es retiro en tienda).
- Componente por defecto: deriva `reportType` (`VENDEDOR` si el rol es `SELLER|PROVIDER|PROVEEDOR`, si no `COMPRADOR`), estado del acordeón FAQ, estado del formulario, carga pedidos (`getSellerOrdersApi(user.sellerId)` / `getBuyerOrdersApi(user.userId ?? user.id)`) solo cuando el tema es `buyer-orders`/`seller-orders`, y en `submit()` llama a:
  - `createOrderClaimApi(userId, orderId, { motivo, descripcion })` si el tema es de pedidos,
  - `createSupportTicketApi({ usuarioId, nombreReportante, tipoReportante, categoria: 'FALLA_TECNICA'|'SOLICITUD_AYUDA', plataforma: 'SITIO_WEB', motivo, detalle, sellerId, contexto })` en caso contrario.
  - Pantalla de éxito: `submittedId` → bloque `.support-success` con "Ver mis consultas" / "Enviar otra consulta".

**Consumidores actuales del componente**
- `src/components/ProfileDashboard.jsx:31` import; **:1654** `{activeTab === 'soporte' && <SupportHelpPanel ... />}`.
- Sidebar del perfil: dos definiciones idénticas de la sección `SOPORTE` con `{ id: 'soporte', label: 'Centro de ayuda', icon: Headphones }` en **:122** (comprador) y **:153** (vendedor).
- `ProfileDashboard.jsx:925` → tarjeta de acceso rápido del resumen (`onClick: () => setActiveTab('soporte')`).
- `ProfileDashboard.jsx:1777` → otro enlace "Centro de ayuda".
- `src/components/QuoteDetailModal.jsx:188` → `navigate(ROUTES.support)` desde el menú de opciones del chat de cotización.
- `Header.jsx:235` y `Header.jsx:443` → `onOpenHelp`. `Footer.jsx:87` y `Footer.jsx:95` → `onOpenHelp` (este último es "Términos y Condiciones").
- `AppLayout.jsx` pasa `onOpenHelp={nav.goHelp}` a Header y Footer.

**APIs disponibles (`src/services/api.js`)**
- `getMySupportTicketsApi(userId)` :845
- `createSupportTicketApi(ticket)` :849
- `createOrderClaimApi(userId, orderId, claim)` :856
- `getMyReportsApi(userId)` :865
- `getMyMediationsApi(userId)` (usado en `ProfileSupportPanel.jsx:4`)
- `getBuyerOrdersApi`, `getSellerOrdersApi`

**CSS**
- `src/index.css` tiene 13.873 líneas. La sección del centro de ayuda empieza en el banner
  `/* Full help flow ported from mobile: role FAQ + contextual ticket/claim form. */` en la **línea 12220**, y ocupa aproximadamente **12221-12233** (incluye el `@media (max-width: 800px)` de la 12232).
  Clases existentes: `.support-help-panel(.standalone)`, `.support-back`, `.support-help-hero`,
  `.support-help-section`, `.support-section-title`, `.support-faq-list`, `.support-ticket-meta`,
  `.support-form-grid`, `.support-detail-field`, `.support-submit-button`, `.support-no-orders`, `.support-success`.
- Bloque previo (12210-12218): `.profile-cases-*` de `ProfileSupportPanel` — **no tocar**.
- Convención: una línea por selector, secciones con banner de comentario.

**Referencia de página full-screen**: `src/pages/AboutPage.jsx` monta `AboutRepuesTopPage` con `onBack`, `onContact`, `onOpenSeller` — mismo patrón a seguir.

---

## 2. Arquitectura destino

```
src/pages/HelpCenterPage.jsx          # layout: HelpHeader + <Outlet/> + Footer
  └── src/pages/help/HelpHomeView.jsx        → /ayuda
  └── src/pages/help/HelpCategoryView.jsx    → /ayuda/:categoria
  └── src/pages/help/HelpContactView.jsx     → /ayuda/contacto

src/components/help/HelpHeader.jsx          # barra propia de la vista
src/components/help/HelpSidebar.jsx         # CTA soporte + recursos + mis casos
src/components/help/HelpFaqAccordion.jsx    # acordeón reutilizable
src/components/help/HelpContactForm.jsx     # formulario extraído de SupportHelpPanel
src/data/helpContent.js                     # dataset único de categorías + FAQ
```

`SupportHelpPanel.jsx` queda **deprecado y se elimina** al final de la fase 5; su
lógica de formulario se muda a `HelpContactForm.jsx` y su contenido a `helpContent.js`.

**Rutas nuevas en `paths.js`**
```js
support: '/ayuda',
helpCategory: '/ayuda/:categoria',
helpContact: '/ayuda/contacto',
```
más helpers `helpCategoryPath(slug)` y `helpContactPath(topicId)` (`/ayuda/contacto?tema=<topicId>`).

Ojo con el orden de rutas: `/ayuda/contacto` debe declararse **antes** de
`/ayuda/:categoria` o el param lo captura.

**Categorías (slugs)**: `pedidos`, `productos`, `cotizaciones`, `tienda`, `cuenta`,
`politicas`, `seguridad`. Cada una con `{ slug, titulo, descripcion, icono, roles: ['COMPRADOR','VENDEDOR','INVITADO'], faqs: [{ q, a, topicId }] }`.
El `topicId` de cada FAQ es el que alimenta `?tema=` del formulario y debe ser uno
de los ids ya existentes en `TOPICS`/`SUBJECTS` (`buyer-orders`, `buyer-payment`,
`buyer-quote`, `general`, `seller-orders`, `seller-products`, `seller-quote`,
`blocked-account`) — **no inventar ids nuevos** o el formulario no encontrará asuntos.

---

## 3. Fases

Cada fase termina con `npm run build` + `npm run lint` y un commit propio en español.

### Fase 1 — Rutas y esqueleto de la vista
- `paths.js`: agregar `helpCategory`, `helpContact`, helpers `helpCategoryPath`, `helpContactPath`.
- `useAppNavigation.js`: `goHelp` deja de bifurcar por sesión → siempre `navigate(ROUTES.support)`. Agregar `goHelpCategory(slug)` y `goHelpContact(topicId)`.
- `AppRoutes.jsx`: mover `ROUTES.support` **fuera** del `<Route element={<AppLayout />}>` y convertirlo en ruta padre con hijos:
  ```jsx
  <Route path={ROUTES.support} element={<HelpCenterPage />}>
    <Route index element={<HelpHomeView />} />
    <Route path="contacto" element={<HelpContactView />} />
    <Route path=":categoria" element={<HelpCategoryView />} />
  </Route>
  ```
  Mantener `lazy()` para `HelpCenterPage` (las vistas hijas viajan en el mismo chunk, es contenido pequeño).
- `HelpCenterPage.jsx`: `useDocumentTitle('Centro de ayuda')`, contenedor `.help-center-page`, `<HelpHeader/>`, `<main><Outlet/></main>`, `<Footer onOpenCatalog={() => nav.goCatalog()} onOpenStores={nav.goStores} onOpenAdsWall={nav.goAdsWall} onOpenHelp={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />`.
- Borrar `src/pages/SupportPage.jsx` y su import lazy.
- Estado al terminar: `/ayuda` renderiza header propio + placeholder + footer real. `SupportHelpPanel` sigue vivo y montado en el perfil (aún no se toca).

**Criterio de aceptación**: `/ayuda`, `/ayuda/contacto` y `/ayuda/pedidos` responden sin error y el footer se ve idéntico al del home.

### Fase 2 — Header propio + dataset de contenido
- `HelpHeader.jsx`: logo `/repuestop_icon.png` + "RepuesTop" (clic → home), botón "Volver a la tienda" (`ChevronLeft`), y a la derecha acción según sesión:
  - vendedor → "Visitar mi tienda" (`storePath` con `user.sellerId`) + chip "Proveedor"
  - comprador → "Mi perfil" (`profilePath('resumen')`) + chip "Comprador"
  - invitado → "Iniciar sesión" (`navigate(ROUTES.home, { state: { requireAuth: true } })`, que ya abre el `AuthModal` desde `AppLayout.jsx:35`)
  Sticky, `z-index` por debajo de modales.
- `src/data/helpContent.js`: migrar `BUYER_FAQS`/`SELLER_FAQS`/`GUEST_FAQS` al nuevo formato por categoría, ampliando a 4-6 FAQ por categoría. Exportar `HELP_CATEGORIES`, `getCategoriesForRole(reportType)`, `getCategory(slug)`, `resolveReportType(role, user)` (extraer la lógica de `SupportHelpPanel` línea 84).
- `HelpFaqAccordion.jsx`: recibe `faqs`, maneja `openIndex`, reusa las clases `.support-faq-list` existentes (no crear clases nuevas para el acordeón).

**Criterio de aceptación**: el header cambia correctamente entre invitado / comprador / vendedor; el dataset compila y `getCategoriesForRole` filtra.

### Fase 3 — `/ayuda` (home) y `/ayuda/:categoria`
- `HelpHomeView.jsx`:
  - Hero azul (`.help-hero`): título "Centro de ayuda", bajada "Estamos aquí para ayudarte", icono de auriculares a la derecha. **Sin buscador.**
  - Grid de accesos rápidos (`.help-quick-grid`): una tarjeta por categoría visible para el rol, con icono, título, descripción y chevron → `helpCategoryPath(slug)`.
  - "Preguntas frecuentes" destacadas: primeras 5 FAQ del rol, con enlace "Ver todas" → primera categoría del rol.
  - `<HelpSidebar/>` a la derecha (grid de 2 columnas, `minmax(0,1fr) 320px`).
- `HelpCategoryView.jsx`: `useParams().categoria` → `getCategory(slug)`; si no existe o no aplica al rol, `<Navigate to={ROUTES.support} replace />`. Muestra breadcrumb "Centro de ayuda / <Categoría>", título, acordeón completo, y al pie el bloque `.help-still-stuck`: "¿No resolviste tu problema?" → botón a `helpContactPath(categoria.topicId)`.
- `HelpSidebar.jsx`:
  - Bloque "¿Necesitas más ayuda?" → botón primario "Contactar soporte" (`/ayuda/contacto`) + "Tiempo de respuesta: 24-48 horas hábiles".
  - Bloque "Recursos útiles" → enlaces a categorías (`politicas`, `seguridad`, guía de proveedores si es vendedor).
  - Bloque "Mis casos abiertos": si hay sesión, `Promise.all([getMySupportTicketsApi, getMyReportsApi, getMyMediationsApi])` con el `userId`, cuenta los que **no** estén en estado `RESUELTO|CERRADO|CANCELADO|RESUELTA|CERRADA` y muestra el total con enlace a `profilePath('consultas')`. Si falla la carga, el bloque no se renderiza (no mostrar error en un sidebar informativo). Si es invitado, muestra "Inicia sesión para ver tus casos".

**Criterio de aceptación**: navegación entre home y categorías con botón atrás funcional; el conteo de casos coincide con lo que muestra `/perfil/consultas`.

### Fase 4 — `/ayuda/contacto`
- `HelpContactForm.jsx`: mover **tal cual** de `SupportHelpPanel` las constantes `TOPICS`, `SUBJECTS`, `BUYER_CLAIMS`, `SELLER_CLAIMS`, `normalizedStatus`, `orderClaimOptions`, el estado del formulario, el efecto de carga de pedidos, `canSubmit`, `submit()` y la pantalla de éxito. **No cambiar** los valores enviados al backend (`plataforma: 'SITIO_WEB'`, `categoria`, `tipoReportante`, `contexto`) — solo actualizar `contexto` a `topic=<id> | sourceRoute=help-center`.
- `HelpContactView.jsx`: layout de dos columnas.
  - Izquierda: `<HelpContactForm initialTopic={searchParams.get('tema')} />`.
  - Derecha: panel `.help-contact-aside` con "Qué pasa después" (3 pasos), tiempo de respuesta, y resumen del caso (usuario, rol, pedido seleccionado si aplica).
  - Invitado: en vez del formulario, bloque "Inicia sesión para enviar tu consulta" con botón que abre el `AuthModal` (misma técnica que el header) y enlace de vuelta a las FAQ.
  - Éxito: mantener número de caso; "Ver mis consultas" → `profilePath('consultas')`; "Enviar otra consulta" resetea.
- `initialTopic` debe validarse contra `TOPICS[reportType]`; si no calza, cae al primero (un `?tema=seller-products` con sesión de comprador no debe dejar el select vacío).

**Criterio de aceptación**: enviar una consulta genérica y un reclamo de pedido produce las mismas llamadas que hoy (verificable en la pestaña Red del preview).

### Fase 5 — Limpieza del perfil y de los puntos de entrada
- `ProfileDashboard.jsx`: quitar el import de `SupportHelpPanel` (:31), el render de `activeTab === 'soporte'` (:1654), y en las dos definiciones de sidebar (:122 y :153) cambiar el item por uno que navegue: `{ id: 'soporte', label: 'Centro de ayuda', icon: Headphones, href: ROUTES.support }` — el handler del sidebar debe detectar `href` y hacer `navigate` en vez de `setActiveTab`.
- Tarjeta de acceso rápido (:925) y enlace (:1777) → `navigate(ROUTES.support)`.
- `QuoteDetailModal.jsx:188` → `navigate(helpCategoryPath('cotizaciones'))`.
- `Footer.jsx:95` ("Términos y Condiciones") → `helpCategoryPath('politicas')`; requiere una prop nueva `onOpenTerms` o pasar `helpCategoryPath` desde `AppLayout`.
- Eliminar `src/components/SupportHelpPanel.jsx`.
- Verificar que ningún import quede colgando: `grep -rn "SupportHelpPanel" src`.

**Criterio de aceptación**: `npm run build` limpio y ningún camino de la app queda sin salida al centro de ayuda.

### Fase 6 — CSS y responsive
- Reemplazar el bloque `12220-12233` de `src/index.css` por una sección nueva con banner
  `/* Help center — standalone view: header, hero, categories, contact form. */`.
- Clases nuevas: `.help-center-page`, `.help-header`, `.help-hero`, `.help-quick-grid`,
  `.help-card`, `.help-layout`, `.help-sidebar`, `.help-side-card`, `.help-breadcrumb`,
  `.help-still-stuck`, `.help-contact-layout`, `.help-contact-aside`.
- **Reusar** `.support-faq-list`, `.support-form-grid`, `.support-detail-field`,
  `.support-submit-button`, `.support-ticket-meta`, `.support-success` — mantenerlas y
  solo ajustar lo necesario. Eliminar `.support-help-panel`, `.support-help-panel.standalone`,
  `.support-back`, `.support-help-hero` (ya sin uso tras la fase 5).
- Paleta consistente con la app: azul primario `#1268f3`, hero `linear-gradient(135deg,#1257c9,#0b3f9e)`,
  bordes `#dce5f0`, texto `#20314a` / `#687c98`, sombras `0 7px 20px rgba(24,54,95,.055)`.
- Breakpoints: `@media (max-width: 1024px)` → sidebar pasa debajo (`grid-template-columns: 1fr`);
  `@media (max-width: 800px)` → accesos rápidos a 1-2 columnas, header compacta el botón derecho a icono.
- Verificación con el preview del navegador en desktop (1280) y mobile (375).

**Criterio de aceptación**: sin scroll horizontal en 375px; el footer global no se deforma.

---

## 4. Riesgos y puntos de atención

- **Enums del backend**: no tocar `plataforma: 'SITIO_WEB'`, `tipoReportante`, `categoria` ni los `motivo` de reclamo. Un valor distinto rompe el filtrado del backoffice sin fallar visiblemente.
- **`goHelp` deja de llevar al perfil**: revisar los 4 consumidores (`Header.jsx:235`, `Header.jsx:443`, `Footer.jsx:87`, `Footer.jsx:95`) tras la fase 1.
- **Orden de rutas**: `contacto` antes de `:categoria`.
- **`ScrollToTop`** ya está montado en `AppRoutes`, aplica a las subrutas nuevas sin trabajo extra.
- **`MEDIATION_STATUS_LABELS`** sigue exportándose desde `ProfileSupportPanel` (import circular con `MediationChatModal`); este plan no lo toca, pero la fase 5 es buena oportunidad si se quiere mover a un archivo propio.
- **Contenido**: las FAQ actuales son 12 en total (4 por rol). La fase 2 requiere redactar ~25-30. Si el contenido no está listo, la fase 2 puede entregar categorías con las FAQ existentes redistribuidas y ampliarse después sin tocar código.

---

## 5. Orden de commits sugerido

1. `feat(ayuda): rutas propias del centro de ayuda y layout con header dedicado`
2. `feat(ayuda): header contextual y dataset de categorias de ayuda`
3. `feat(ayuda): home y vistas por categoria con sidebar de casos reales`
4. `feat(ayuda): formulario de consulta y reclamo en ruta dedicada`
5. `refactor(ayuda): centralizar accesos al centro de ayuda y retirar panel del perfil`
6. `style(ayuda): estilos de la vista standalone del centro de ayuda`
