import React, { useState, useEffect } from 'react';
import { getBrandColor, getBrandInitials, getBrandLogoUrl } from '../data/brandGuidance';

export default function ProductBrandMark({ brand = '', logoUrl = '', size = 28, className = '' }) {
  const cleanBrand = String(brand || '').trim();
  const initials = getBrandInitials(cleanBrand);
  const brandColor = getBrandColor(cleanBrand);

  const initialLogo = logoUrl || getBrandLogoUrl(cleanBrand);
  const [currentSrc, setCurrentSrc] = useState(initialLogo);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const next = logoUrl || getBrandLogoUrl(cleanBrand);
    setCurrentSrc(next);
    setImageFailed(false);
  }, [cleanBrand, logoUrl]);

  const handleImageError = () => {
    // Si la imagen externa falló, intentar con el logo local de repuesto automotriz
    if (currentSrc && currentSrc !== '/brand-logos/autopart.svg') {
      setCurrentSrc('/brand-logos/autopart.svg');
    } else {
      setImageFailed(true);
    }
  };

  const containerStyle = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    borderRadius: `${Math.max(6, Math.round(size * 0.28))}px`,
    backgroundColor: `${brandColor}12`,
    borderColor: `${brandColor}35`,
  };

  const fontSize = Math.max(9, Math.round(size * 0.4));

  return (
    <span
      className={`product-brand-mark ${className}`}
      style={containerStyle}
      aria-label={`Marca ${cleanBrand || 'desconocida'}`}
    >
      {currentSrc && !imageFailed ? (
        <img
          src={currentSrc}
          alt={`Logo de ${cleanBrand}`}
          className="product-brand-mark-img"
          onError={handleImageError}
          loading="eager"
        />
      ) : (
        <span
          className="product-brand-mark-initials"
          style={{ color: brandColor, fontSize: `${fontSize}px` }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
