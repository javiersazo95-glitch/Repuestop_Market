// El WhatsApp de un aviso se guarda como "+56 9XXXXXXXX" (ver AdForm), pero
// puede llegar con o sin espacios/símbolos según el origen del dato. Este
// helper solo formatea para mostrar el número en el aviso de confirmación
// antes de abrir WhatsApp (ver AdCard.jsx / AdDetailView.jsx).
export function formatWhatsappDisplay(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const local = digits.length > 9 ? digits.slice(-9) : digits;
  if (local.length !== 9) return `+56 ${local}`;
  return `+56 ${local.slice(0, 1)} ${local.slice(1, 5)} ${local.slice(5)}`;
}

// Confirmación previa a abrir WhatsApp: el taller declara este número al
// crear el anuncio y no siempre está verificado. Si WhatsApp no lo
// reconoce, muestra su propio aviso y deja al usuario libre para elegir
// cualquier contacto de su agenda; este paso evita que el mensaje termine
// yéndole a un contacto personal por error.
export function confirmWhatsappContact(companyName, whatsappRaw) {
  const message = `Se abrirá WhatsApp para escribirle a ${companyName || 'el taller'} al número ${formatWhatsappDisplay(whatsappRaw)}.\n\nSi WhatsApp avisa que el número no existe, cierra la pestaña sin elegir ningún contacto: ese número no es de nadie en tu agenda.\n\n¿Continuar?`;
  return window.confirm(message);
}
