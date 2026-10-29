import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Package, Truck, Trophy, ChevronRight, Lock } from 'lucide-react';
import { resolveMediaUrl } from '../services/api';

function formatCLP(value) {
  if (value == null) return '';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(() => calculate(targetDate));

  function calculate(target) {
    if (!target) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { total: diff, days, hours, minutes, seconds, expired: false };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculate(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

export default function AuctionCard({ auction, onOpen }) {
  const {
    id,
    patenteAnonimizada,
    marca,
    modelo,
    anio,
    repuestoSolicitado,
    descripcion,
    cantidad,
    tiempoMaximoEnvio,
    presupuestoMaximo,
    region,
    comuna,
    estado,
    fechaLimite,
    totalCotizaciones = 0,
    fotoPrincipalUrl,
  } = auction;

  const countdown = useCountdown(fechaLimite);
  const isFinalizada = estado === 'FINALIZADA';
  const isExpirada = estado === 'EXPIRADA' || (!isFinalizada && countdown.expired);

  const fallbackPhoto = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80';
  const displayPhoto = fotoPrincipalUrl ? resolveMediaUrl(fotoPrincipalUrl) : fallbackPhoto;

  return (
    <article
      onClick={() => onOpen(id)}
      className="auction-card"
    >
      {/* 1. Imagen / Banner */}
      <div className="auction-card-thumb-wrap">
        <img
          src={displayPhoto}
          alt={repuestoSolicitado}
          className="auction-card-thumb"
          loading="lazy"
        />

        {/* Badge de Estado */}
        {isFinalizada ? (
          <span className="auction-card-badge-status badge-finalizada">
            <Trophy size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            Finalizada
          </span>
        ) : isExpirada ? (
          <span className="auction-card-badge-status badge-expirada">
            Expirada
          </span>
        ) : (
          <span className="auction-card-badge-status badge-activa">
            Activa
          </span>
        )}

        {/* Temporizador */}
        {!isFinalizada && !isExpirada && (
          <span className="auction-card-badge-timer">
            <Clock size={12} className="timer-pulse" />
            <span>
              {countdown.days > 0 ? `${countdown.days}d ` : ''}
              {String(countdown.hours).padStart(2, '0')}:
              {String(countdown.minutes).padStart(2, '0')}:
              {String(countdown.seconds).padStart(2, '0')}
            </span>
          </span>
        )}
      </div>

      {/* 2. Cuerpo */}
      <div className="auction-card-body">
        {/* Vehículo */}
        <div className="auction-card-vehicle-tag">
          <span>{marca || 'Vehículo'} {modelo || ''} {anio ? `(${anio})` : ''}</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span style={{ fontFamily: 'monospace', color: '#475569' }}>{patenteAnonimizada || 'PATENTE'}</span>
        </div>

        {/* Título */}
        <h3 className="auction-card-title">
          {repuestoSolicitado}
        </h3>

        {/* Descripción */}
        {descripcion && (
          <p className="auction-card-desc">
            {descripcion}
          </p>
        )}

        {/* Metadatos */}
        <div className="auction-card-meta-list">
          <div className="auction-card-meta-item">
            <Package size={14} />
            <span>Cant: <strong>{cantidad} un.</strong></span>
          </div>
          <div className="auction-card-meta-item">
            <Truck size={14} />
            <span>Envío: <strong>{tiempoMaximoEnvio || 'A coordinar'}</strong></span>
          </div>
          <div className="auction-card-meta-item">
            <MapPin size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {comuna || region || 'Chile'}
            </span>
          </div>
          <div className="auction-card-meta-item">
            {presupuestoMaximo ? (
              <span style={{ color: '#059669', fontWeight: 800 }}>
                Tope: {formatCLP(presupuestoMaximo)}
              </span>
            ) : (
              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin tope fijado</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Footer */}
      <div className="auction-card-footer">
        <div className="auction-card-quotes-count">
          <Lock size={13} style={{ color: '#d97706' }} />
          <span>{totalCotizaciones} {totalCotizaciones === 1 ? 'oferta' : 'ofertas'}</span>
        </div>

        <span className="auction-card-btn-action">
          Ver detalle <ChevronRight size={14} />
        </span>
      </div>
    </article>
  );
}
