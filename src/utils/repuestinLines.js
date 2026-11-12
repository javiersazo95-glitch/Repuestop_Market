/**
 * Cómo habla Repuestín: de tú a tú, cercano y chileno, sin sonar a formulario. Cada momento tiene varias formas de
 * decirlo para no repetir siempre la misma frase. Solo texto: el chat decide cuándo decir cada una.
 */
import { pick } from './partUnderstanding';

const lower = (text) => {
  const clean = String(text || '').trim();
  // «Filtro de Aire» → «filtro de aire» dentro de una frase (las siglas como «EGR» o «CVVT» se respetan).
  return clean.split(' ').map((word) => (word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase())).join(' ');
};

/** Repuestín acusa recibo del repuesto con su nombre corto («filtro de aire»), sin repetir el relleno. */
export function partAck(part) {
  const name = lower(part);
  return pick([
    `¡${name[0]?.toUpperCase()}${name.slice(1)}, anotado! ✍️`,
    `Perfecto, ${name} 👌`,
    `¡Dale! Vamos por ese ${name} 🔧`,
    `Buenísimo, ${name} entonces 🙌`,
  ]);
}

/** La pieza tiene un detalle que se lleva a las tiendas («delantero», «izquierdo»). */
export function detailAck(detail) {
  return detail ? ` Les comento a las tiendas que es ${lower(detail)}.` : '';
}

/** La pregunta del vehículo. Si ya dijo algo del vehículo en la misma frase, Repuestín lo recoge. */
const titleCase = (text) => String(text || '').trim().split(/\s+/).map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word)).join(' ');

export function askVehicle(rawHint) {
  const vehicleHint = titleCase(rawHint);
  if (vehicleHint) {
    return pick([
      `Me dijiste que es para ${vehicleHint} 🚗 Para no fallar con la pieza, ¿me pasas la patente? Si no la tienes a mano, confírmame marca y modelo (ya te los dejé anotados).`,
      `Para ${vehicleHint}, ¡bacán! 🚗 Con la patente saco el año y el chasis exactos; si prefieres, revisa la marca y el modelo que te dejé escritos.`,
    ]);
  }
  return pick([
    '¿Para qué auto es? 🚗 Si me pasas la patente saco la marca, el modelo, el año y el chasis al tiro. Si no, dime marca y modelo.',
    '¿Y para qué vehículo? Con la patente lo detecto todo yo 🚗 (o cuéntame marca y modelo, como te acomode).',
    'Ahora cuéntame del auto 🚗 ¿Tienes la patente? Con eso saco marca, modelo, año y chasis. Si no, marca y modelo me bastan.',
  ]);
}

/** El repuesto no existe como subcategoría del catálogo. `reported`: si de verdad se avisó al equipo de soporte. */
export function missingPartLine(part, similar, reported) {
  const name = lower(part);
  const team = reported
    ? 'Ya se lo envié al equipo de soporte para que lo agreguen 🛠️'
    : 'Igual lo voy a buscar tal como me lo dijiste 🛠️';
  const alike = similar?.length ? ` (algo como ${similar.slice(0, 2).map((option) => lower(option.nombre)).join(' o ')})` : '';
  return pick([
    `Uy, «${name}» todavía no lo tenemos registrado como categoría en RepuesTop 😅 ${team} Pero tranqui, no te dejo botado: te busco casas de repuestos que trabajan cosas parecidas${alike} o que son especialistas en la marca de tu auto.`,
    `Mmm, «${name}» aún no existe como categoría en RepuesTop 😅 ${team} Mientras tanto te ayudo igual: te muestro casas que trabajan repuestos parecidos${alike} o que se la saben con tu marca.`,
  ]);
}

/** Respuestas a lo que no es un repuesto: un saludo, un gracias, un «no sé cómo se llama»… */
export function smallTalkReply(kind, { vehicle } = {}) {
  const forCar = vehicle ? ` para tu ${vehicle}` : '';
  switch (kind) {
    case 'greeting':
      return pick([
        `¡Hola! 😄 Cuéntame, ¿qué repuesto andas buscando${forCar}?`,
        `¡Buenas! 👋 Aquí estoy pa ayudarte. ¿Qué pieza necesitas${forCar}?`,
        `¡Holi! 🙌 Escríbeme el repuesto como te salga, yo le entiendo 😉`,
      ]);
    case 'thanks':
      return pick([
        '¡De nada! 🙌 Cuando quieras, dime qué repuesto buscas y lo vemos.',
        '¡Con gusto! 😄 Si necesitas otra pieza, aquí estoy.',
      ]);
    case 'unknownName':
      return 'Tranqui, nos pasa a todos 😅 Descríbemelo con tus palabras (para qué sirve, dónde va o qué ruido hace) o abre la lista y búscalo por categoría. Entre los dos damos con el nombre 💪';
    case 'human':
      return 'Soy Repuestín, el asistente de RepuesTop 🤖🔧 No soy una persona, pero te conecto con casas de repuestos de verdad: dime qué repuesto buscas y les dejo tu mensaje para que te respondan ellas mismas.';
    case 'nothing':
      return pick([
        '¡Dale! Si más rato necesitas algo, aquí estoy 😉',
        'Sin drama 🙌 Cuando necesites un repuesto, me buscas.',
      ]);
    default:
      return '¿Me cuentas qué repuesto necesitas? 🔧';
  }
}

export function checkingLine() {
  return pick([
    '¡Manos a la obra! Déjame revisar el taller… 🔍',
    'Dame un segundo, reviso qué hay en RepuesTop… 🔍',
    'Voy a buscar al tiro… 🔍',
  ]);
}

export function productsFoundLine(count) {
  const found = count === 1 ? '1 repuesto publicado' : `${count} repuestos publicados`;
  return pick([
    `¡Buenas noticias! 🎉 Encontré ${found} que podrían servirte.`,
    `¡Bacán! 🎉 Hay ${found} que calzan con lo que buscas.`,
  ]);
}

/** Introducción de las casas sugeridas. Sin subcategoría, explica que son parecidas o especialistas en la marca. */
export function storesIntroLine({ total, shown, part, marca, missing, similarName }) {
  const name = lower(part);
  const those = shown === 1 ? 'esta es la' : `estas ${shown} son las`;
  if (missing) {
    const alike = similarName ? ` (como ${lower(similarName)})` : '';
    return marca
      ? `Revisé las ${total} casas de repuestos de RepuesTop y ${those} que más se acercan: trabajan repuestos parecidos${alike} o son especialistas en ${marca}. Escríbeles y pregúntales por ${name}, que muchas veces lo consiguen 😉`
      : `Revisé las ${total} casas de repuestos de RepuesTop y ${those} que más se acercan: trabajan repuestos parecidos${alike}. Escríbeles y pregúntales por ${name} 😉`;
  }
  return `Revisé las ${total} casas de repuestos de RepuesTop y ${those} con más probabilidad de tener ${name}${marca ? ` para ${marca}` : ''}. Las ordené de la más a la menos probable: miro especialidad, lo que ya publican de ese rubro y su valoración.`;
}
