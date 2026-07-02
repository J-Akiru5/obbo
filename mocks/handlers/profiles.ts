import { http, HttpResponse } from 'msw';
import { mockProfiles } from '../fixtures/profiles';

export const profileHandlers = [
  http.get('*/rest/v1/profiles', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const role = url.searchParams.get('role')?.replace('eq.', '');
    const kycStatus = url.searchParams.get('kyc_status')?.replace('eq.', '');
    const email = url.searchParams.get('email')?.replace('eq.', '');

    let result = [...mockProfiles];
    if (id) result = result.filter((p) => p.id === id);
    if (role) result = result.filter((p) => p.role === role);
    if (kycStatus) result = result.filter((p) => p.kyc_status === kycStatus);
    if (email) result = result.filter((p) => p.email === email);

    const prefer = request.headers.get('prefer') || '';
    if (prefer.includes('count=exact')) {
      return HttpResponse.json(result, {
        headers: { 'content-range': `0-${result.length - 1}/${result.length}` },
      });
    }

    return HttpResponse.json(result);
  }),

  http.patch('*/rest/v1/profiles', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockProfiles.findIndex((p) => p.id === id);
    if (idx !== -1) {
      mockProfiles[idx] = {
        ...mockProfiles[idx],
        ...body,
        updated_at: new Date().toISOString(),
      } as (typeof mockProfiles)[0];
    }
    return HttpResponse.json([]);
  }),
];
