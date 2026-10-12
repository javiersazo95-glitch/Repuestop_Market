import React, { useState } from 'react';
import { ChevronRight, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import HelpFaqAccordion from './help/HelpFaqAccordion';
import { InfoSheet } from './InfoHint';
import { orderSupportFaqs } from '../data/orderSupportFaqs';
import { helpContactPath } from '../routes/paths';

/**
 * 12-oct: Soporte desde el detalle del pedido (paridad con la app). Las preguntas dependen del
 * estado: los plazos que antes iban como avisos en el bloque de cada tienda ("Se cierra en 3
 * dias", "Puedes retractarte por 10 dias", "Daremos por recibido en...") son respuestas aqui.
 */
export default function OrderSupportButton({ order, mode = 'buyer', orderCode, proveedorId = null }) {
  const [open, setOpen] = useState(false);
  const isSeller = mode === 'seller';
  const support = open ? orderSupportFaqs(order, { role: isSeller ? 'seller' : 'buyer', proveedorId }) : null;

  return (
    <>
      <button type="button" className="order-support-icon" onClick={() => setOpen(true)}
        aria-label="Soporte con este pedido" title="Soporte con este pedido">
        <Headphones size={18} />
      </button>
      <InfoSheet open={open} title="Dudas sobre tu pedido" onClose={() => setOpen(false)}>
        {support && (
          <>
            <p className="order-support-context">
              <span>Pedido {orderCode}{support.storeName ? ` · ${support.storeName}` : ''}</span>
              <em>{support.statusLabel}</em>
            </p>
            <HelpFaqAccordion faqs={support.faqs} defaultOpen={-1} />
            <Link className="order-support-contact" to={helpContactPath(isSeller ? 'seller-orders' : 'buyer-orders')} onClick={() => setOpen(false)}>
              Contactar soporte <ChevronRight size={15} />
            </Link>
          </>
        )}
      </InfoSheet>
    </>
  );
}
