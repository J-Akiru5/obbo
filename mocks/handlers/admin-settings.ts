import { http, HttpResponse } from 'msw';

const mockSettings: Record<string, unknown> = {};

export const adminSettingHandlers = [
  http.get('*/rest/v1/admin_settings', ({ request }) => {
    const url = new URL(request.url);
    const key = url.searchParams.get('key')?.replace('eq.', '');
    if (key && mockSettings[key]) {
      return HttpResponse.json([{ key, value: mockSettings[key] }]);
    }
    return HttpResponse.json([]);
  }),

  http.post('*/rest/v1/admin_settings', async ({ request }) => {
    const body = (await request.json()) as { key: string; value: unknown };
    mockSettings[body.key] = body.value;
    return HttpResponse.json([body]);
  }),
];
