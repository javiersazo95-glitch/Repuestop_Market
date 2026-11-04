import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { storePath } from '../routes/paths';
import '../styles/store-profile-link.css';

/**
 * Enlace al perfil público de una casa de repuestos desde los comentarios y las ofertas de Encargar repuesto. Lo puede abrir
 * cualquier perfil (comprador, taller, otra tienda o quien no ha iniciado sesión): el perfil de la tienda es público.
 * Sin `storeId` (comentario antiguo que no trae la tienda) muestra el contenido sin enlace.
 *
 * `showLabel` agrega el rótulo "Ver perfil" junto al nombre, como la app.
 */
export default function StoreProfileLink({ storeId, name, children, className = '', showLabel = false }) {
  if (!storeId) return <span className={className}>{children}</span>;
  const label = `Ver perfil de ${name || 'la tienda'}`;
  return (
    <Link
      to={storePath({ id: storeId, nombre: name })}
      className={`spl ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
      {showLabel && <span className="spl-label">Ver perfil <ChevronRight size={12} aria-hidden="true" /></span>}
    </Link>
  );
}

/**
 * Id de la tienda que escribió un comentario: el que trae el comentario o, en los antiguos, la oferta de la misma tienda
 * (se busca por nombre, igual que la app).
 */
export function commentStoreId(comment, quotes = []) {
  if (!comment?.autorEsTienda) return null;
  if (comment.proveedorId) return comment.proveedorId;
  const author = String(comment.autor || '').trim().toLocaleLowerCase('es-CL');
  return quotes.find((quote) => String(quote.nombreTienda || '').trim().toLocaleLowerCase('es-CL') === author)?.proveedorId ?? null;
}
