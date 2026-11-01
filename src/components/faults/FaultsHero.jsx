import React from 'react';
import { AlertTriangle, CarFront, MessagesSquare, Wrench } from 'lucide-react';
import SectionHero, { HeroChip } from '../ui/SectionHero';

/** Cabecera de Fallas automotrices en el celular (`FallasBanner.tsx` de la app): cálida, con el auto y la alerta. */
export default function FaultsHero({ isWorkshop = false, mine = false }) {
  return (
    <SectionHero
      gradient={['#9A3412', '#EA580C', '#F59E0B']}
      eyebrow={{ icon: isWorkshop ? <Wrench /> : <CarFront />, label: mine ? 'SEGUIMIENTO' : isWorkshop ? 'DIAGNOSTICA' : 'MI AUTO' }}
      title={mine ? 'Mis fallas' : 'Fallas automotrices'}
      subtitle={mine ? (isWorkshop ? 'Sigue las fallas que comentaste y los diagnósticos que enviaste.' : 'Sigue tus fallas y los diagnósticos que recibiste de talleres.') : isWorkshop ? 'Revisa las fallas de los clientes y diagnostica para ganar trabajos.' : 'Registra la falla de tu vehículo y recibe diagnósticos de talleres.'}
      art={(
        <>
          <span className="ak-hero-halo" />
          <span className="ak-hero-disc"><CarFront /></span>
          <span className="ak-hero-lens" style={{ color: '#B45309', background: '#FDE68A', width: 26, height: 26, right: 26, bottom: 'auto', top: 30 }}><AlertTriangle style={{ width: 16, height: 16 }} /></span>
          <HeroChip className="is-top" icon={<Wrench />} label="Diagnóstico" color="#C2410C" />
          <HeroChip className="is-bottom" icon={<MessagesSquare />} label="2 talleres" color="#7C3AED" />
        </>
      )}
    />
  );
}
