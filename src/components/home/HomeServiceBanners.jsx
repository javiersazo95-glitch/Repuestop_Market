import React from 'react';
import { ArrowRight, Check, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EngineIcon from '../EngineIcon';
import { ROUTES } from '../../routes/paths';
import Feature from '../../remoteConfig/Feature';

/** Inicio · dos banners lado a lado: Fallas automotrices (oscuro) y Talleres mecánicos (claro). */
export default function HomeServiceBanners({ showWorkshops = true }) {
  const navigate = useNavigate();
  return (
    <div className={`hb-duo container ${showWorkshops ? '' : 'is-single'}`}>
      <Feature flag="market.home.fallas">
        <section className="hb-banner hb-banner-fallas" aria-labelledby="home-fallas-title">
          <span className="hb-new">Nuevo</span>
          <div className="hb-banner-copy">
            <div className="hb-banner-head">
              <span className="hb-banner-icon"><EngineIcon size={30} /></span>
              <div>
                <h2 id="home-fallas-title">Diagnóstico de fallas</h2>
                <p>Registra la falla de tu vehículo y recibe diagnósticos de talleres.</p>
              </div>
            </div>
            <ul>
              <li><Check size={15} aria-hidden="true" /> Diagnóstico orientativo sin costo</li>
              <li><Check size={15} aria-hidden="true" /> Rango de precio antes de ir al taller</li>
            </ul>
            <button type="button" className="hb-btn hb-btn-white" onClick={() => navigate(ROUTES.faults)}>
              Diagnosticar ahora <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      </Feature>
      {showWorkshops && (
        <Feature flag="market.home.talleres">
          <section className="hb-banner hb-banner-talleres" aria-labelledby="home-talleres-title">
            <span className="hb-new">Nuevo</span>
            <div className="hb-banner-copy">
              <div className="hb-banner-head">
                <span className="hb-banner-icon"><Wrench size={30} /></span>
                <div>
                  <h2 id="home-talleres-title">Talleres mecánicos de confianza</h2>
                  <p>Encuentra talleres verificados, compara servicios y agenda tu atención.</p>
                </div>
              </div>
              <ul>
                <li><Check size={15} aria-hidden="true" /> Talleres verificados</li>
                <li><Check size={15} aria-hidden="true" /> Agenda en línea</li>
              </ul>
              <button type="button" className="hb-btn hb-btn-blue" onClick={() => navigate(ROUTES.talleres)}>
                Ver talleres <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        </Feature>
      )}
    </div>
  );
}
