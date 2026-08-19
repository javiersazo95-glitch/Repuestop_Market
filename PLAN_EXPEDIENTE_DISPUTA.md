# Expediente de disputa — chat de mediación en el perfil

Estado: **listo** (2026-08-19). Build y lint en verde.
Alcance: `src/components/MediationCaseView.jsx` (nuevo), `src/data/mediationStatus.js`
(nuevo), `src/components/ProfileSupportPanel.jsx`, `src/services/api.js`, `src/index.css`.
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

## 5. Hilo con el mediador (agregado el 2026-08-19)

**Presentación.** Solapas de legajo **sobre el bloque del hilo**, no sobre todo
el expediente: la cabecera, los metadatos y la evidencia son comunes a las dos
conversaciones, así que poner pestañas arriba obligaría a repetirlas. Cada
solapa lleva el número de mensajes; la del mediador solo existe si el caso está
escalado (`chat.escalado`, que en el DTO es `estado == EN_MEDIACION`). Es una
diferencia deliberada con la app, que sí usa pestañas globales.

**Lectura.** No hay `GET` propio: el hilo viene dentro de
`GET /pedidos/{id}/mediacion-chat`. Cada parte ve **su** array —
`mensajesMediadorComprador` o `mensajesMediadorVendedor` según el rol—, nunca
`mensajesMediador`, que trae los de ambas partes y filtraría mal: le mostraría
al comprador lo que el vendedor le escribió al mediador. La query del backend
(`findChatThreadByParty`) ya excluye las notas internas del backoffice.

**Escritura.** `POST /pedidos/{id}/mediacion-mensajes` con `mensaje` como
`@RequestParam` (va en `FormData`). Devuelve solo el mensaje creado, y el hilo
por parte lo arma el backend filtrando por rol, así que después de enviar se
relee el expediente en silencio en vez de insertar a mano.

**Evidencia durante la mediación.** `POST /pedidos/{id}/mediacion-evidencias`
(`imagenes`, al menos una) es un envío **aparte del mensaje**: el backend lo
registra como aporte al expediente y deja una nota automática en el hilo. Por
eso en la UI tiene su propia bandeja y su propio botón, reutilizando el
`EvidencePicker` con miniaturas, contador y límite de 5 MB. La respuesta trae el
expediente completo, con lo que se refresca todo de una.

**Bitácora.** Las entradas con `tipo` `solicitud_mediador`, `evidencia`,
`system` o `nota` no son mensajes de nadie: se pintan como asiento de bitácora
(`.dispute-log-entry`, filete a la izquierda y fecha en versalitas), no como
burbuja. El resto (`seguimiento`) son mensajes, y son míos si
`senderRole` coincide con mi rol.

**Nombres del JSON, ojo.** `MensajeMediacionRespuestaDTO` serializa con
`@JsonProperty` distintos a sus campos Java: el texto llega como `text` (no
`mensaje`), el autor como `author` (no `remitente`), el tipo como `noteType` (no
`tipo`) y la fecha como `createdAt` (no `fecha`). Leer los nombres del Java hacía
que todas las burbujas salieran vacías y que la nota de la escalación se pintara
como mensaje. Se normaliza en `normalizeMediatorEntry`, con los mismos respaldos
que usa la app (`author ?? remitente ?? sender`, etc.).

**Evidencia sin repetir.** `evidenciasEscalacion` es el acumulado de
`urlDocumento`, así que contiene también los archivos que ya llegan atribuidos en
`evidenciasComprador` / `evidenciasVendedor`: mostrar las tres tiras pintaba la
misma foto tres veces. Ahora "Adjuntos del caso" solo lista lo que no está en
ninguna de las dos tiras (cruce por nombre de archivo), y las tiras son
compactas —etiqueta a la izquierda, miniaturas de 44px al lado— en vez de
bloques apilados: la sección bajó de ~305px a ~152px de alto.

**Refresco.** Manual y tras cada acción: al abrir el expediente, al entrar a la
solapa del mediador, después de enviar mensaje o evidencia, y con el botón
"Actualizar". Sin sondeo en segundo plano. `load({ quiet: true })` recarga sin
desmontar la vista.

**Cierre.** Si `chat.chatCerrado` es true, el hilo no admite mensajes ni
evidencia (el backend lanza "El chat con el mediador esta cerrado") y se muestra
el aviso en vez del compositor.

La sección de evidencia del expediente pasó a distinguir "Mis evidencias" de las
de la otra parte, como hace la app: con la carga durante la mediación esa
distinción empieza a importar.

## 6. Pendiente

- `POST /conversaciones/{id}/mediacion-imagenes` (adjuntar una imagen al chat
  directo con la otra parte) sigue sin usarse en la web; hoy solo se pueden
  mandar imágenes por el expediente.
- No hay aviso de mensajes nuevos del mediador fuera del expediente: para
  enterarse hay que abrirlo. Si se quiere, el contador de la solapa podría
  alimentarse desde la campana de notificaciones.

Referencia de implementación: `mobile/app/mediation-chat.tsx` en el monorepo.

## 7. Verificación hecha

- `npm run build` en verde; `npm run lint` sin errores nuevos.
- No se pudo tomar screenshot (el panel del navegador integrado no se muestra) ni
  entrar al perfil desde ahí (sin sesión), así que se midió el layout con estilos
  computados sobre el CSS real: workspace 921px = riel 232 + expediente 669,
  código del expediente en una línea, metadatos en 4 columnas, hilo 360px con
  scroll, botón deshabilitado `#f1f3f6` sobre `#a3adba`, sin desborde horizontal.
- Breakpoints comprobados en vivo: a 1280px riel visible y `.dispute-back`
  oculto; a 750px riel oculto y `.dispute-back` visible; a 1080px los metadatos
  bajan a 2 columnas.
- Solapas medidas con el CSS real: la activa queda en blanco con filete azul
  superior (`inset 0 2px 0 #0b5fd0`) y la inactiva plana; bitácora con filete
  izquierdo de 2px sobre `#f4f6f9`; bandeja de evidencia separada por línea
  punteada; sin desborde horizontal.
