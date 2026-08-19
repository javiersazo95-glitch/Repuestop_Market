# Expediente de disputa — chat de mediación en el perfil

Estado: **listo** (2026-08-19). Build y lint en verde.
Alcance: `src/components/MediationCaseView.jsx` (nuevo), `src/data/mediationStatus.js`
(nuevo), `src/components/ProfileSupportPanel.jsx`, `src/index.css`.
`src/components/MediationChatModal.jsx` se eliminó. Sin cambios de backend.

## 1. Qué había antes

El chat de mediación era `MediationChatModal`, montado con `createPortal` sobre
`document.body` como workspace a pantalla completa reusando las clases
`.quote-ws-*` del chat de cotizaciones. Traía barra superior propia con logo y
tarjeta de cuenta, o sea duplicaba la navegación del perfil; el área de mensajes
tenía alto libre y quedaba casi vacía; y el código del caso
(`MED-ML-1-PED-000003`) se partía en cuatro líneas en la columna lateral.

## 2. Qué quedó

**Ubicación — maestro/detalle dentro de `/perfil/consultas`.** Al abrir una
disputa, `ProfileSupportPanel` deja de renderizar la bandeja y renderiza:

- `.dispute-rail` (232px): lista de las disputas con chat, la activa marcada, y
  el enlace "Todos mis casos" que vuelve a la bandeja completa.
- `MediationCaseView`: el expediente.

El caso abierto vive en la URL como `?caso=<pedidoIdReal>` (`useSearchParams`),
así que el botón atrás del navegador cierra el expediente y el enlace es
compartible. No hay portal ni barra superior propia: el topbar y el sidebar del
perfil siguen visibles.

**Diseño — lenguaje de expediente, no de tarjetas.** Sección
`EXPEDIENTE DE DISPUTA` en `index.css`: cabecera tipo folio con el código en
monoespaciada y en una sola línea, sello de estado con borde (`.dispute-seal`,
tonos `wait` / `alert` / `done`), metadatos en cuatro celdas separadas por
filetes de 1px, esquinas de 3px y sin sombras flotantes. Los mensajes de sistema
(`message.tipo === 'system'`) se pintan como nota centrada entre reglas, no como
burbuja. El hilo está acotado a `max-height: 360px` con scroll propio.

**Un solo botón de volver.** En escritorio manda el del riel; `.dispute-back`
("Casos") está oculto y solo aparece bajo 760px, donde el riel se esconde.

**Datos del backend que la web ignoraba.** El expediente ahora muestra
`evidenciasEscalacion`, `evidenciasComprador` y `evidenciasVendedor` como
miniaturas con enlace al original, más `motivoEscalacion` y
`descripcionEscalacion`. Antes la evidencia se subía y no se veía en ninguna
pantalla de la web (la app móvil sí la pintaba).

## 3. Bugs corregidos en el diálogo de "Solicitar mediador"

1. **La imagen elegida nunca llegaba al estado.** El `onChange` hacía
   `onAdd(event.target.files)` y a continuación `event.target.value = ''`.
   `event.target.files` es una `FileList` viva: limpiar el value la deja en cero,
   y como la validación corría dentro del updater de `setState` —que React
   ejecuta después del handler— al recorrerla ya no quedaba ningún archivo. Por
   eso no aparecía la miniatura *ni* el aviso de tamaño: el límite nunca llegaba
   a evaluarse. Se corrigió copiando con `Array.from` dentro del propio
   `onChange`, antes de limpiar el input, y validando en el handler en vez de
   dentro del updater (React puede invocarlo dos veces y duplicaría el error).
   Comprobado en el navegador con dos archivos (1 KB y 6 MB): patrón anterior 0
   aceptadas y 0 errores; patrón nuevo 1 aceptada y 1 error de tamaño.
2. **El botón se veía siempre activo.** `.btn-auth-primary:disabled` solo bajaba
   la opacidad a `.7` sobre azul. `.dispute-btn:disabled` ahora es gris plano.
3. **Los errores eran invisibles.** Iban a `setStatusMessage`, que se pintaba en
   el toast del workspace *detrás* del modal. Ahora salen dentro del diálogo
   (`.dispute-dialog-error`).
4. **El detalle decía "(opcional)" pero el backend lo exige.**
   `MediacionChatService.escalarAMediador` hace `validarTexto(descripcion)`:
   enviarlo vacío devolvía error. Ahora se pide y se valida antes de enviar.
5. **El compositor seguía abierto con el caso escalado.** Al escalar, el backend
   pone la conversación en `CERRADA` y rechaza mensajes nuevos ("la conversacion
   directa esta pausada por intervencion de un mediador"). Ahora el hilo se
   bloquea con ese aviso en vez de dejar escribir algo que va a fallar.

Además el picker muestra miniatura con el peso de cada archivo, contador
"N de 5 imágenes", la regla "JPG o PNG · hasta 5 MB cada una" y contadores de
caracteres en motivo (150) y detalle (500).

## 4. Contrato verificado contra el backend

`backend/.../controller/MediacionChatController.java` y `MediacionChatService.java`:

| Punto | Confirmado |
|---|---|
| `POST /pedidos/{id}/mediacion-escalar` | `motivo`, `descripcion` (ambos obligatorios) e `imagenes` (lista, opcional) |
| `POST /pedidos/{id}/mediacion-resolver` | `motivoResolucion` y `evidencias` (lista); también acepta `evidencia` singular |
| Nombres del `FormData` en `api.js` | correctos — cierra el pendiente que estaba anotado en `CLAUDE.md` |
| Tamaño por archivo | el backend permite 10 MB (`spring.servlet.multipart.max-file-size`); la web corta en 5 MB a propósito |
| `escalado` en el DTO | es `estado == EN_MEDIACION`, no el estado `ESCALADO` |
| Evidencia | la de escalación y la de resolución caen ambas en `urlDocumento` (separadas por `|`) → llegan juntas en `evidenciasEscalacion` |

## 5. Pendiente (no entra en este cambio)

El backend expone y la app móvil ya usa dos capacidades que la web sigue sin
tener:

- **Hilo con el mediador**: `POST /pedidos/{id}/mediacion-mensajes` y los campos
  `mensajesMediador`, `mensajesMediadorComprador`, `mensajesMediadorVendedor`.
  Hoy, con el caso escalado, la web solo informa que está pausado; no deja
  responderle al mediador. Cabe como una pestaña dentro del expediente.
- **Carga de evidencia posterior**: `POST /pedidos/{id}/mediacion-evidencias`,
  para adjuntar durante la mediación y no solo al escalar.

Referencia de implementación: `mobile/app/mediation-chat.tsx` en el monorepo.

## 6. Verificación hecha

- `npm run build` en verde; `npm run lint` sin errores nuevos.
- No se pudo tomar screenshot (el panel del navegador integrado no se muestra) ni
  entrar al perfil desde ahí (sin sesión), así que se midió el layout con estilos
  computados sobre el CSS real: workspace 921px = riel 232 + expediente 669,
  código del expediente en una línea, metadatos en 4 columnas, hilo 360px con
  scroll, botón deshabilitado `#f1f3f6` sobre `#a3adba`, sin desborde horizontal.
- Breakpoints comprobados en vivo: a 1280px riel visible y `.dispute-back`
  oculto; a 750px riel oculto y `.dispute-back` visible; a 1080px los metadatos
  bajan a 2 columnas.
