import React, { useState } from 'react';
import { Tag, Calculator, ChevronDown, ChevronUp, Award, Sparkles, Check } from 'lucide-react';
import { calculateSimplePricingSummary, calculateSuggestedPrice } from '../utils/pricing';

function formatCLP(amount) {
  const safe = typeof amount === 'number' && !Number.isNaN(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `$${new Intl.NumberFormat('es-CL').format(safe)}`;
}

export default function CommissionSummaryCard({
  basePrice = 0,
  isFounder = false,
  onApplySuggested,
  suggestedContextLabel,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [calculatorMode, setCalculatorMode] = useState('standard');
  const [desiredNetInput, setDesiredNetInput] = useState('');

  const price = Number(basePrice) || 0;
  if (price <= 0 && calculatorMode === 'standard') return null;

  const { totalFees, netEarnings, breakdown } = calculateSimplePricingSummary(price, isFounder);
  const suggestedPriceForCurrentBase = calculateSuggestedPrice(price, isFounder);

  // Inverse calculator
  const desiredNetNumeric = parseInt(String(desiredNetInput).replace(/\D/g, ''), 10) || 0;
  const suggestedSalePriceFromNet = desiredNetNumeric > 0 ? calculateSuggestedPrice(desiredNetNumeric, isFounder) : 0;

  return (
    <div className="commission-summary-card" style={{
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '14px',
      margin: '12px 0',
      fontSize: '13px',
    }}>
      {isFounder && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          padding: '6px 10px',
          borderRadius: '6px',
          marginBottom: '10px',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          <Award size={15} />
          <span>Beneficio Fundador: comisión RepuesTop fija del 5%, sin importar el monto.</span>
        </div>
      )}

      {/* Mode Switcher */}
      <div style={{
        display: 'flex',
        backgroundColor: '#e2e8f0',
        borderRadius: '6px',
        padding: '2px',
        marginBottom: '12px',
      }}>
        <button
          type="button"
          onClick={() => setCalculatorMode('standard')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 10px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: calculatorMode === 'standard' ? '#ffffff' : 'transparent',
            color: calculatorMode === 'standard' ? '#0066ff' : '#64748b',
            fontWeight: calculatorMode === 'standard' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '12.5px',
            boxShadow: calculatorMode === 'standard' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Tag size={13} />
          <span>Desglose por Precio</span>
        </button>

        <button
          type="button"
          onClick={() => setCalculatorMode('inverse')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 10px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: calculatorMode === 'inverse' ? '#ffffff' : 'transparent',
            color: calculatorMode === 'inverse' ? '#0066ff' : '#64748b',
            fontWeight: calculatorMode === 'inverse' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '12.5px',
            boxShadow: calculatorMode === 'inverse' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Calculator size={13} />
          <span>Calculadora Inversa</span>
        </button>
      </div>

      {calculatorMode === 'inverse' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'block', fontWeight: 600, color: '#334155' }}>
            ¿Cuánto dinero deseas recibir líquido en tu cuenta?
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={desiredNetInput}
              onChange={(e) => setDesiredNetInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 45000"
              maxLength={8}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            />
          </div>

          {desiredNetNumeric > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '10px 12px',
              borderRadius: '6px',
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '12px', color: '#166534' }}>
                  Precio sugerido a publicar al comprador:
                </span>
                <strong style={{ display: 'block', fontSize: '16px', color: '#15803d', marginTop: '2px' }}>
                  {formatCLP(suggestedSalePriceFromNet)}
                </strong>
              </div>

              {onApplySuggested && (
                <button
                  type="button"
                  onClick={() => {
                    onApplySuggested(suggestedSalePriceFromNet);
                    setCalculatorMode('standard');
                  }}
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Check size={14} />
                  <span>Fijar Precio</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Row 1: Costo total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '3px 0' }}>
            <span style={{ color: '#64748b' }}>Costo total por venta (Plataforma + Pago):</span>
            <strong style={{ color: '#ef4444' }}>-{formatCLP(totalFees)}</strong>
          </div>

          {/* Row 2: Líquido a recibir */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0', paddingTop: '4px' }}>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>Recibirás en tu cuenta (Líquido):</span>
            <strong style={{ color: '#0066ff', fontSize: '15px' }}>{formatCLP(netEarnings)}</strong>
          </div>

          {/* Toggle Accordion */}
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px 0 0 0',
              marginTop: '6px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#0066ff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showDetails ? 'Ocultar desglose' : 'Ver desglose de comisión e impuestos'}</span>
          </button>

          {/* Expanded details */}
          {showDetails && (
            <div style={{
              marginTop: '8px',
              padding: '8px 10px',
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Comisión RepuesTop ({Math.round(breakdown.rate * 100)}% IVA incl.):</span>
                <strong style={{ color: '#334155' }}>-{formatCLP(breakdown.repuestopWithIva)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', paddingLeft: '8px' }}>
                <span>↳ Neto comisión: {formatCLP(breakdown.repuestopNet)} | IVA (19%): {formatCLP(breakdown.repuestopIva)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Procesamiento Flow (Pasarela + IVA):</span>
                <strong style={{ color: '#334155' }}>-{formatCLP(breakdown.flowWithIva)}</strong>
              </div>
            </div>
          )}

          {/* Sugerencia de Precio si aplica */}
          {suggestedPriceForCurrentBase > price && onApplySuggested && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '8px 12px',
              borderRadius: '6px',
              marginTop: '10px',
            }}>
              <div style={{ flex: 1, marginRight: '8px' }}>
                <span style={{ display: 'block', fontSize: '11.5px', color: '#1e40af' }}>
                  {suggestedContextLabel || `Para recibir al menos ${formatCLP(price)} líquido, te sugerimos cobrar:`}
                </span>
                <strong style={{ display: 'block', color: '#1d4ed8', fontSize: '14px', marginTop: '1px' }}>
                  {formatCLP(suggestedPriceForCurrentBase)}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => onApplySuggested(suggestedPriceForCurrentBase)}
                style={{
                  backgroundColor: '#0066ff',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={13} />
                <span>Aplicar</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
