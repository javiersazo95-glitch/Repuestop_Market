import React, { useMemo, useState } from 'react';
import { Car, ChevronRight, MapPin, Star, Users } from 'lucide-react';
import SearchToolbar from '../SearchToolbar';
import {
  applyClientQuery, countActiveClientFilters, EMPTY_CLIENT_QUERY,
} from '../../utils/workshopClients';
import '../../styles/appointments-redesign.css';

const SORT_OPTIONS = [
  { key: 'recent', label: 'Última cita más reciente' },
  { key: 'oldest', label: 'Última cita más antigua' },
  { key: 'name', label: 'Nombre (A-Z)' },
  { key: 'most', label: 'Más citas' },
  { key: 'rating', label: 'Mejor calificados' },
];
const STATUS_OPTIONS = [{ key: 'all', label: 'Todos' }, { key: 'returning', label: 'Ya atendidos' }, { key: 'new', label: 'Nuevos' }];
const RATING_OPTIONS = [{ key: 'all', label: 'Todos' }, { key: 'rated', label: 'Con calificación' }, { key: 'unrated', label: 'Sin calificación' }];
const ACTIVITY_OPTIONS = [{ key: 'all', label: 'Todos' }, { key: 'current', label: 'Con citas vigentes' }];

const initials = (name) => name.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
/** AAAA-MM-DD → DD/MM/AA: corto para que entre en la fila de resumen. */
const shortDate = (iso) => {
  const [year, month, day] = String(iso).split('-');
  return year && month && day ? `${day}/${month}/${year.slice(2)}` : iso;
};

/**
 * Pestaña Clientes de "Mi taller": una tarjeta por cliente (identidad, resumen de su historial con el taller y datos
 * para reconocerlo), con buscador, filtro avanzado y orden, y una flecha al historial de sus citas.
 */
export default function WorkshopClientsTab({ clients, highlightKey = null, onOpenHistory }) {
  const [query, setQuery] = useState(EMPTY_CLIENT_QUERY);
  const set = (patch) => setQuery((current) => ({ ...current, ...patch }));

  const visible = useMemo(() => {
    const found = applyClientQuery(clients, query);
    // El cliente al que se llega desde el historial va primero.
    return highlightKey ? [...found].sort((a, b) => Number(b.key === highlightKey) - Number(a.key === highlightKey)) : found;
  }, [clients, query, highlightKey]);

  if (clients.length === 0) {
    return (
      <div className="wc-empty">
        <Users size={24} />
        <p>Aquí aparecerán las personas que te agenden una cita, para que reconozcas rápido si es un cliente nuevo o uno que ya atendiste.</p>
      </div>
    );
  }

  return (
    <div className="wc">
      <SearchToolbar
        text={query.text}
        onTextChange={(text) => set({ text })}
        placeholder="Nombre, patente, comuna…"
        ariaLabel="Buscar entre tus clientes"
        activeFilters={countActiveClientFilters(query)}
        onClearFilters={() => set({ status: 'all', rating: 'all', activity: 'all' })}
        filterSections={[
          { key: 'status', label: 'Tipo de cliente', options: STATUS_OPTIONS, value: query.status, onPick: (status) => set({ status }) },
          { key: 'rating', label: 'Calificación como comprador', options: RATING_OPTIONS, value: query.rating, onPick: (rating) => set({ rating }) },
          { key: 'activity', label: 'Citas', options: ACTIVITY_OPTIONS, value: query.activity, onPick: (activity) => set({ activity }) },
        ]}
        sortOptions={SORT_OPTIONS}
        sortValue={query.sort}
        defaultSort="recent"
        onSort={(sort) => set({ sort })}
        resultLabel={visible.length === 1 ? '1 cliente' : `${visible.length} clientes`}
      />

      {visible.length === 0 && <div className="wc-empty"><p>Ningún cliente coincide con la búsqueda o los filtros.</p></div>}

      {visible.map((client) => {
        const stats = [
          ['Citas', client.totalAppointments],
          ['Atendidas', client.attendedAppointments],
          ['Vigentes', client.currentAppointments],
          ['Última', shortDate(client.lastDate)],
        ];
        return (
          <article key={client.key} className={`wc-card ${client.key === highlightKey ? 'is-highlight' : ''}`}>
            <header className="wc-head">
              <span className="wc-avatar" aria-hidden="true">{initials(client.name)}</span>
              <div className="wc-head-body">
                <div className="wc-name-row">
                  <strong>{client.name}</strong>
                  <span className={`wc-pill ${client.isReturning ? 'is-returning' : 'is-new'}`}>{client.isReturning ? 'Ya atendido' : 'Nuevo'}</span>
                </div>
                {client.rating ? (
                  <span className="wc-rating">
                    <Star size={13} fill="currentColor" /> {`${client.rating.toFixed(1)} como comprador`}
                    {client.ratingCount > 0 ? ` · ${client.ratingCount} ${client.ratingCount === 1 ? 'calificación' : 'calificaciones'}` : ''}
                  </span>
                ) : null}
              </div>
              <button type="button" className="wc-arrow" onClick={() => onOpenHistory(client)} aria-label={`Ver el historial de citas de ${client.name}`}>
                <ChevronRight size={20} />
              </button>
            </header>

            <dl className="wc-stats">
              {stats.map(([label, value]) => (
                <div key={label}><dd>{value}</dd><dt>{label}</dt></div>
              ))}
            </dl>

            <div className="wc-details">
              <div><span className="wc-ic"><Car size={15} /></span><div><small>{client.vehicles.length > 1 ? 'Vehículos' : 'Vehículo'}</small><strong>{client.vehicles.length > 0 ? client.vehicles.join('  |  ') : 'No informado'}</strong></div></div>
              <div><span className="wc-ic"><MapPin size={15} /></span><div><small>Ubicación</small><strong>{client.location || 'No informada'}</strong></div></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
