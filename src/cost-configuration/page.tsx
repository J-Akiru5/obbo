'use client';

import React, { useState, useEffect } from 'react';
import { getCostConfig, saveCostConfiguration } from '@/lib/actions/admin-actions';

export default function CostConfigurationPage() {
  const [landedCost, setLandedCost] = useState<number>(147.64);
  const [localExpenses, setLocalExpenses] = useState<number>(20.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  const sampleQty = 1200;
  const sampleSellingPrice = 185.0;

  const _totalSales = sampleQty * sampleSellingPrice;
  const grossProfitPerBag = sampleSellingPrice - landedCost;
  const netProfitPerBag = sampleSellingPrice - (landedCost + localExpenses);
  const totalCostPerBag = landedCost + localExpenses;

  useEffect(() => {
    getCostConfig()
      .then((config) => {
        setLandedCost(config.landed_cost_per_bag);
        setLocalExpenses(config.local_expenses_per_bag);
      })
      .catch((err) => console.error('Error loading values:', err));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      await saveCostConfiguration(landedCost, localExpenses);
      setMessage('✅ Cost configuration saved successfully.');
    } catch (_error) {
      setMessage('❌ Failed to save configuration.');
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
