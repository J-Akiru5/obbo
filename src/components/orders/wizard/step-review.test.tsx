import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepOrderReview } from './step-review';
import type { Product } from '@/lib/types/database';

// Regression test for §3.1: the per-line JB/SB price used to multiply price
// by the raw JB/SB UNIT count (form.jb_qty/sb_qty) instead of the individual
// bag count, undercharging the displayed line item by 25x/50x while the
// grand total above it (computed separately via getSubtotalByBagType) stayed
// correct — so the two numbers didn't add up.

const jbProduct: Product = {
  id: 'jb-1',
  name: 'Portland Cement Type 1',
  description: '',
  bag_type: 'JB',
  price_per_bag: 210,
  price_port: 210,
  price_warehouse: 200,
  image_url: null,
  is_active: true,
  created_at: '',
};

const sbProduct: Product = {
  ...jbProduct,
  id: 'sb-1',
  bag_type: 'SB',
  price_port: 185,
  price_warehouse: 180,
};

const baseForm = {
  jb_qty: 4, // 4 JB units = 100 individual bags
  sb_qty: 10, // 10 SB units = 500 individual bags
  source: 'port',
  service_type: 'deliver',
  driver_name: '',
  plate_number: '',
  preferred_pickup_date: '',
  po_number: '',
  payment_method: 'cash',
  wants_split: false,
  deliver_now_jb_bags: 0,
  deliver_now_sb_bags: 0,
};

describe('StepOrderReview (regression: §3.1 25x/50x undercharge on review lines)', () => {
  it('prices the JB/SB review lines by individual bag count, not raw unit count', () => {
    render(
      <StepOrderReview
        form={baseForm}
        files={{ po_file: null }}
        products={[jbProduct, sbProduct]}
        onEditStep={vi.fn()}
        onSubmit={vi.fn()}
        onSaveDraft={vi.fn()}
        loading={false}
        draftLoading={false}
      />,
    );

    // 4 JB units * 25 bags/unit * ₱210 = ₱21,000 (buggy math would show ₱840: 4 * 210)
    expect(screen.getByText(/₱210\/bag × 100 bags = ₱21,000/)).toBeInTheDocument();
    // 10 SB units * 50 bags/unit * ₱185 = ₱92,500 (buggy math would show ₱1,850: 10 * 185)
    expect(screen.getByText(/₱185\/bag × 500 bags = ₱92,500/)).toBeInTheDocument();

    // The grand total was always correct (computed via getSubtotalByBagType) —
    // the bug was the two line items above it not summing to it. Assert they
    // now do: 21,000 + 92,500 = 113,500.
    expect(screen.getByText('₱113,500')).toBeInTheDocument();
  });

  it('omits a bag type entirely when its quantity is zero', () => {
    render(
      <StepOrderReview
        form={{ ...baseForm, sb_qty: 0 }}
        files={{ po_file: null }}
        products={[jbProduct, sbProduct]}
        onEditStep={vi.fn()}
        onSubmit={vi.fn()}
        onSaveDraft={vi.fn()}
        loading={false}
        draftLoading={false}
      />,
    );
    expect(screen.queryByText('SB price')).not.toBeInTheDocument();
  });
});
