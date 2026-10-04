import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { isGenericProductImage } from '../services/adapters';
import { productReferenceImage } from '../utils/productImage';

/**
 * Foto de producto con respaldo. Antes solo la tarjeta del catálogo reaccionaba cuando la foto
 * no cargaba (archivo borrado del almacenamiento, URL vieja): mostraba la referencial y el
 * producto parecía tener foto, pero al abrir la ficha o el carrito la imagen desaparecía.
 * Aquí la cadena es la misma en todas partes: foto propia -> referencial -> ícono.
 */
export default function ProductPhoto({ src, product, alt = '', className, iconSize = 20, loading }) {
  const own = src && !isGenericProductImage(src) ? src : null;
  const fallback = productReferenceImage(product);
  const [current, setCurrent] = useState(own || fallback);

  useEffect(() => {
    setCurrent(own || fallback);
  }, [own, fallback]);

  if (!current) return <Package size={iconSize} className={className ? `${className}-icon` : undefined} />;

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setCurrent((failed) => (fallback && failed !== fallback ? fallback : null))}
    />
  );
}
