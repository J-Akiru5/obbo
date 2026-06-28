'use client';

import React, { useState, useEffect } from 'react';

export default function CostConfigurationPage() {
  const [landedCost, setLandedCost] = useState<number>(147.64); // Default panel criteria [cite: 32]
  const [localExpenses, setLocalExpenses] = useState<number>(20.0); // Default panel criteria [cite: 33]
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  // Base sample data para sa live calculation preview mockup (1,200 bags, selling at 185) [cite: 105]
  const sampleQty = 1200;
  const sampleSellingPrice = 185.0; // [cite: 35]

  // Dynamic formulas base sa inyong document guidelines [cite: 92, 98, 99]
  const totalSales = sampleQty * sampleSellingPrice; // eslint-disable-line @typescript-eslint/no-unused-vars
  const grossProfitPerBag = sampleSellingPrice - landedCost; // [cite: 36]
  const netProfitPerBag = sampleSellingPrice - (landedCost + localExpenses); // [cite: 37]
  const totalCostPerBag = landedCost + localExpenses; // [cite: 34]

  // Kukunin ang active saved values mula sa Supabase pagka-load ng page [cite: 123]
  useEffect(() => {
    fetch('/api/cost-configuration')
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setLandedCost(Number(data.landedCost));
          setLocalExpenses(Number(data.localExpenses));
        }
      })
      .catch((err) => console.error('Error loading values:', err));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/cost-configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landedCost, localExpenses }), // [cite: 122]
      });
      const result = await response.json();
      if (response.ok) {
        setMessage('✅ ' + result.message);
      } else {
        setMessage('❌ ' + (result.error || 'Failed to save configuration'));
      }
    } catch (_error) {
      setMessage('❌ Network error saving configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0', color: '#1e293b' }}>
          Cost Configuration (per 40 kg bag)
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px 0' }}>
          These values drive Sales, Gross Profit, and Net Profit across the ledger, dashboard, and
          reports. Changes only affect new dispatches/orders — past records keep their snapshotched
          values. [cite: 96, 97]
        </p>

        {message && (
          <div
            style={{
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {message}
          </div>
        )}

        {/* Inputs Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Landed Cost (₱/bag)
            </label>
            <input
              type="number"
              step="0.01"
              value={landedCost}
              onChange={(e) => setLandedCost(parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '16px',
              }}
            />
            <span
              style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '4px' }}
            >
              Base 85.80 + Freight 27.84 + Duties 22.00 + Port Handling 12.00 = 147.64. [cite: 44,
              45, 46, 47, 48]
            </span>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Local Expenses (₱/bag)
            </label>
            <input
              type="number"
              step="0.01"
              value={localExpenses}
              onChange={(e) => setLocalExpenses(parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '16px',
              }}
            />
            <span
              style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '4px' }}
            >
              Local delivery, rent, labor, taxes, etc. [cite: 95]
            </span>
          </div>
        </div>

        {/* Real-time Math Analysis Preview Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              Gross Profit / bag
            </span>
            <div
              style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}
            >
              ₱{grossProfitPerBag.toFixed(2)}
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              Net Profit / bag
            </span>
            <div
              style={{ fontSize: '20px', fontWeight: '700', color: '#ea580c', marginTop: '4px' }}
            >
              ₱{netProfitPerBag.toFixed(2)}
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              Total Cost / bag
            </span>
            <div
              style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}
            >
              ₱{totalCostPerBag.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Formula Box */}
        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #ffedd5',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#c2410c',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '6px' }}>
            ℹ️ Formulas Applied dynamically:
          </strong>
          <div>• Total Sales = qty × selling_price_at_order [cite: 92]</div>
          <div>• Gross Profit = Total Sales − (qty × landed_cost_at_dispatch) [cite: 98]</div>
          <div>
            • Net Profit = Total Sales − (qty × (landed_cost + local_expenses)_at_dispatch) [cite:
            99]
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            background: '#f97316',
            color: '#fff',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {loading ? 'Saving...' : '✓ Save Cost Configuration'}
        </button>
      </div>
    </div>
  );
}
