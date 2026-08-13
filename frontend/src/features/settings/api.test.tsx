// File: src/features/settings/api.test.tsx
// Unit tests for settings API hooks — useAuditLogs, useSystemConfig, useUpdateSystemConfig.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import {
  useAuditLogs,
  useSystemConfig,
  useUpdateSystemConfig,
  adminKeys,
} from './api';
import type { API } from '@/types/api.d';

// ── Helper: render hook with isolated QueryClient ──────────────────────
function renderHookWithClient(hook: () => unknown) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(hook, { wrapper });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── adminKeys ──────────────────────────────────────────────────────────

describe('adminKeys', () => {
  it('exports expected query key structure', () => {
    expect(adminKeys.all).toEqual(['admin']);
    expect(adminKeys.auditLogs(undefined, 1)).toEqual(['admin', 'audit-logs', undefined, 1]);
    expect(adminKeys.auditLogs('p1', 2)).toEqual(['admin', 'audit-logs', 'p1', 2]);
    expect(adminKeys.systemConfig).toEqual(['admin', 'system-config']);
  });
});

// ── useAuditLogs ───────────────────────────────────────────────────────

describe('useAuditLogs', () => {
  it('fetches and returns audit log list with pagination', async () => {
    const { result } = renderHookWithClient(() => useAuditLogs(undefined, 1));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.AuditLogListResponse = result.current.data as API.AuditLogListResponse;
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data).toHaveLength(3);
    expect(data.data[0]!.action).toBe('contract.created');
    expect(data.data[0]!.resource_type).toBe('contract');
    expect(data.data[1]!.action).toBe('maintenance.requested');
    expect(data.data[2]!.action).toBe('payment.recorded');
    expect(data.meta).toEqual({ page: 1, limit: 20, total: 3, has_next: false });
  });

  it('passes property_id, page, and limit as query params', async () => {
    let capturedUrl = '';

    server.use(
      http.get('*/api/v1/admin/audit-logs', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: [
            {
              id: 'audit-1',
              user_id: 'user-1',
              action: 'test.action',
              resource_type: 'test',
              resource_id: 'rid',
              property_id: 'p2',
              metadata: {},
              ip_address: '10.0.0.1',
              timestamp: '2026-06-15T10:00:00Z',
            },
          ],
          meta: { page: 1, limit: 10, total: 1, has_next: false },
        });
      }),
    );

    const { result } = renderHookWithClient(() => useAuditLogs('p2', 1, 10));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedUrl).toContain('property_id=p2');
    expect(capturedUrl).toContain('page=1');
    expect(capturedUrl).toContain('limit=10');
  });

  it('omits property_id param when undefined', async () => {
    let capturedUrl = '';

    server.use(
      http.get('*/api/v1/admin/audit-logs', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: [], meta: { page: 1, limit: 20, total: 0, has_next: false } });
      }),
    );

    const { result } = renderHookWithClient(() => useAuditLogs(undefined, 1));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedUrl).not.toContain('property_id');
  });

  it('fetches subsequent pages by page param', async () => {
    server.use(
      http.get('*/api/v1/admin/audit-logs', ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '1');
        const allLogs = [
          {
            id: 'audit-1',
            user_id: 'user-1',
            action: 'contract.created',
            resource_type: 'contract',
            resource_id: 'c1',
            property_id: 'p1',
            metadata: {},
            ip_address: '192.168.1.100',
            timestamp: '2026-06-15T10:00:00Z',
          },
          {
            id: 'audit-2',
            user_id: 'user-1',
            action: 'maintenance.requested',
            resource_type: 'maintenance_request',
            resource_id: 'maint-1',
            property_id: 'p1',
            metadata: {},
            ip_address: '192.168.1.100',
            timestamp: '2026-06-15T10:05:00Z',
          },
        ];
        const start = (page - 1) * 1;
        const paginated = allLogs.slice(start, start + 1);
        return HttpResponse.json({
          data: paginated,
          meta: { page, limit: 1, total: 2, has_next: start + 1 < 2 },
        });
      }),
    );

    const { result } = renderHookWithClient(() => useAuditLogs(undefined, 2, 1));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.AuditLogListResponse;
    expect(data.meta.page).toBe(2);
    expect(data.meta.total).toBe(2);
    expect(data.meta.has_next).toBe(false);
    expect(data.data[0]?.id).toBe('audit-2');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/admin/audit-logs', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Internal server error' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useAuditLogs());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Internal server error');
  });

  it('handles empty audit log list', async () => {
    server.use(
      http.get('*/api/v1/admin/audit-logs', () => {
        return HttpResponse.json({
          data: [],
          meta: { page: 1, limit: 20, total: 0, has_next: false },
        });
      }),
    );

    const { result } = renderHookWithClient(() => useAuditLogs());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.AuditLogListResponse;
    expect(data.data).toEqual([]);
    expect(data.meta.total).toBe(0);
  });
});

// ── useSystemConfig ────────────────────────────────────────────────────

describe('useSystemConfig', () => {
  it('fetches and returns system configuration entries', async () => {
    const { result } = renderHookWithClient(() => useSystemConfig());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.SystemConfigListResponse = result.current.data as API.SystemConfigListResponse;
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data).toHaveLength(10);
    expect(data.data[0]?.key).toBe('app.name');
    expect(data.data[0]?.value).toBe('Property Management System');
    expect(data.data[0]?.masked).toBe(false);
    // Masked entries should have masked: true
    const maskedEntries = data.data.filter((c) => c.masked);
    expect(maskedEntries.length).toBe(6);
    expect(maskedEntries[0]?.key).toBe('notification.line.channel_access_token');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/admin/system-config', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Config service unavailable' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useSystemConfig());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Config service unavailable');
  });

  it('handles empty config list', async () => {
    server.use(
      http.get('*/api/v1/admin/system-config', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    const { result } = renderHookWithClient(() => useSystemConfig());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.SystemConfigListResponse;
    expect(data.data).toEqual([]);
  });
});

// ── useUpdateSystemConfig ──────────────────────────────────────────────

describe('useUpdateSystemConfig', () => {
  const validPayload = { key: 'app.name', value: 'Updated App Name' };

  function getMutationResult() {
    const { result } = renderHookWithClient(() => useUpdateSystemConfig());
    return result;
  }

  it('updates system config successfully', async () => {
    const result = getMutationResult();

    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.SystemConfigResponse = result.current.data as API.SystemConfigResponse;
    expect(data.key).toBe('app.name');
    expect(data.value).toBe('Updated App Name');
    expect(data.masked).toBe(false);
  });

  it('updates a masked config key and returns masked flag', async () => {
    server.use(
      http.patch('*/api/v1/admin/system-config/:key', async ({ params }) => {
        return HttpResponse.json({
          data: {
            key: params.key,
            value: '***',
            masked: true,
          },
        });
      }),
    );

    const result = getMutationResult();

    await result.current.mutateAsync({ key: 'database.url', value: 'new-value' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.SystemConfigResponse;
    expect(data.key).toBe('database.url');
    expect(data.masked).toBe(true);
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.patch('*/api/v1/admin/system-config/:key', () => {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN-403', message: 'Config key is read-only' } },
          { status: 403 },
        );
      }),
    );

    const result = getMutationResult();

    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow(
      'Config key is read-only',
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates system-config cache on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateSystemConfig(), { wrapper });
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.systemConfig });
  });
});
