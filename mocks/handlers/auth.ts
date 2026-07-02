import { http, HttpResponse } from 'msw';

export const authHandlers = [
  http.post('*/auth/v1/otp', () => {
    return HttpResponse.json({});
  }),

  http.post('*/auth/v1/verify', () => {
    return HttpResponse.json({});
  }),

  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'admin-001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@obbo.com',
      email_confirmed_at: new Date().toISOString(),
    });
  }),
];
