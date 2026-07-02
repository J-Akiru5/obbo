import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { fetchProducts, createProduct, updateProduct } from './products-actions';
import { mockProducts } from '../../../mocks/fixtures/products';

// These tests validate the full round-trip through MSW-mocked Supabase REST API.
// No real database calls — MSW intercepts every Supabase HTTP request.

describe('Products Server Actions', () => {
  describe('fetchProducts', () => {
    it('returns filtered products (only JB/SB Portland Cement Type 1)', async () => {
      const products = await fetchProducts();
      expect(products.length).toBeGreaterThan(0);
      for (const p of products) {
        expect(p.name?.toLowerCase()).toContain('portland cement type 1');
        expect(['JB', 'SB']).toContain(p.bag_type);
      }
    });

    it('excludes non-matching products', async () => {
      server.use(
        http.get('*/rest/v1/products', () =>
          HttpResponse.json([
            ...mockProducts,
            {
              id: 'other-001',
              name: 'Fly Ash',
              description: 'Mineral admixture',
              bag_type: 'JB',
              price_per_bag: 100,
              price_port: null,
              price_warehouse: null,
              image_url: null,
              is_active: true,
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ]),
        ),
      );

      const products = await fetchProducts();
      const names = products.map((p) => p.name);
      expect(names).not.toContain('Fly Ash');
    });
  });

  describe('createProduct', () => {
    it('creates a product and returns it with an id', async () => {
      const newProduct = {
        name: 'Portland Cement Type 1',
        description: 'Bulk cement',
        bag_type: 'SB' as const,
        price_per_bag: 270,
        price_port: 260,
        price_warehouse: 275,
        is_active: true,
        image_url: undefined,
      };

      const result = await createProduct(newProduct);
      // The MSW Supabase mock returns an array; verify the first element
      const product = Array.isArray(result) ? result[0] : result;
      expect(product).toHaveProperty('id');
      expect(product.name).toBe('Portland Cement Type 1');
      expect(product.bag_type).toBe('SB');
    });

    it('throws when Supabase insert fails', async () => {
      server.use(
        http.post('*/rest/v1/products', () =>
          HttpResponse.json({ message: 'Database constraint violation' }, { status: 409 }),
        ),
      );

      await expect(
        createProduct({
          name: 'Portland Cement Type 1',
          description: 'Should fail',
          bag_type: 'JB',
          price_per_bag: 250,
          price_port: 0,
          price_warehouse: 0,
          is_active: true,
          image_url: undefined,
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateProduct', () => {
    it('updates product fields successfully', async () => {
      const result = await updateProduct(mockProducts[0].id, {
        price_per_bag: 300,
        is_active: false,
      });
      expect(result).toEqual({ success: true });
    });
  });
});
