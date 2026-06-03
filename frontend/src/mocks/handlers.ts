import { http, HttpResponse } from 'msw';
import { mockEvents, mockIPs } from './data';
import type { PaginatedResult } from '@shared/types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const handlers = [
  http.get(`${BASE}/events`, ({ request }) => {
    const url    = new URL(request.url);
    const status = url.searchParams.get('status');
    const ipId   = url.searchParams.get('ipId');
    const page   = Number(url.searchParams.get('page') ?? 1);
    const limit  = Number(url.searchParams.get('limit') ?? 20);

    let items = [...mockEvents];
    if (status) items = items.filter(e => e.status === status);
    if (ipId)   items = items.filter(e => e.ipId === ipId);

    const start  = (page - 1) * limit;
    const result: PaginatedResult<typeof items[0]> = {
      items:  items.slice(start, start + limit),
      total:  items.length,
      page,
      limit,
    };
    return HttpResponse.json(result);
  }),

  http.get(`${BASE}/events/:id`, ({ params }) => {
    const event = mockEvents.find(e => e.id === params.id);
    if (!event) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({ success: true, data: event });
  }),

  http.get(`${BASE}/ips`, () => {
    return HttpResponse.json({ success: true, data: mockIPs });
  }),

  http.post(`${BASE}/ips`, async ({ request }) => {
    const body = await request.json() as { name: string; keywords: string[] };
    const newIP = {
      id:        `ip-${Date.now()}`,
      name:      body.name,
      keywords:  body.keywords,
      createdAt: new Date().toISOString(),
    };
    return HttpResponse.json({ success: true, data: newIP }, { status: 201 });
  }),

  http.delete(`${BASE}/ips/:id`, () => {
    return HttpResponse.json({ success: true });
  }),
];
