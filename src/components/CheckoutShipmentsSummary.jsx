import React from 'react';
import { Bike, Car, MapPin, Package, Store, Truck } from 'lucide-react';

const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const KIND_ICON = { pickup: Store, local: Bike, courier: Truck, other: Package };

/**
 * "Tus envíos" (igual que la app, CartShipmentsSummary): los paquetes de la compra antes de pagar,
 * numerados dentro de cada tienda como en el detalle del pedido. Cada uno dice cómo llega, a
 * dónde, para qué vehículo y cuánto cuesta. Todos se muestran igual, vayan dentro o fuera de la
 * comuna.
 */
export default function CheckoutShipmentsSummary({ packages }) {
  if (!packages?.length) return null;
  const byStore = new Map();
  packages.forEach((pkg) => byStore.set(pkg.storeName, [...(byStore.get(pkg.storeName) || []), pkg]));

  return (
    <section className="checkout-block checkout-shipments" aria-labelledby="checkout-envios-title">
      <h2 id="checkout-envios-title">
        <Package size={16} /> Tus envíos
        <small>{packages.length === 1 ? '1 paquete' : `${packages.length} paquetes`}</small>
      </h2>
      {[...byStore.entries()].map(([storeName, storePackages]) => (
        <div key={storeName} className="checkout-shipments-store">
          <span className="checkout-shipments-store-name"><Store size={14} /> {storeName}</span>
          {storePackages.map((pkg, index) => {
            const Icon = KIND_ICON[pkg.kind] || Package;
            return (
              <div key={pkg.key} className="checkout-shipment">
                <div className="checkout-shipment-head">
                  <span className="checkout-shipment-badge">{storePackages.length > 1 ? `Paquete ${index + 1}` : 'Paquete'}</span>
                  <strong className="checkout-shipment-cost">
                    {pkg.kind === 'pickup' ? 'Gratis' : pkg.kind === 'courier' ? 'Por pagar' : pkg.cost > 0 ? formatCLP(pkg.cost) : 'Gratis'}
                  </strong>
                </div>
                <span className="checkout-shipment-row is-method"><Icon size={14} /> {pkg.method}</span>
                {pkg.address && (
                  <span className="checkout-shipment-row">
                    <MapPin size={14} />
                    <span>
                      {pkg.address.calleYNumero}, <strong>{pkg.address.comunaNombre}</strong>
                    </span>
                  </span>
                )}
                {pkg.vehicles.map((vehicle) => (
                  <span key={vehicle.label} className="checkout-shipment-row">
                    <Car size={14} />
                    <span><strong>{vehicle.label}</strong> · {vehicle.products.join(' · ')}</span>
                  </span>
                ))}
                {pkg.vehicles.length === 0 && (
                  <span className="checkout-shipment-row"><Package size={14} /> {pkg.products.join(' · ')}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
