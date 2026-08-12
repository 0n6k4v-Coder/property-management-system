// File: src/features/reports/utils/export.test.ts
// Unit tests for revenue CSV export utility.

import { exportRevenueToCsv } from './export';
import type { API } from '@/types/api.d';

// Mock URL.createObjectURL and document.createElement
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  });
  mockCreateObjectURL.mockReturnValue('blob:mock-url');
  mockClick.mockClear();

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      return {
        href: '',
        download: '',
        click: mockClick,
        style: {},
      } as unknown as HTMLAnchorElement;
    }
    return document.createElement(tag);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exportRevenueToCsv', () => {
  const mockRevenueData: API.RevenueMetricResponse[] = [
    { period: '2026-01', collected: 380000, outstanding: 45000, total_billed: 425000 },
    { period: '2026-02', collected: 395000, outstanding: 42000, total_billed: 437000 },
  ];

  it('creates a Blob and triggers download', () => {
    exportRevenueToCsv(mockRevenueData);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('generates CSV with headers and data rows', () => {
    let capturedCsv: string | null = null;
    const originalBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class {
      constructor(parts: unknown[]) {
        capturedCsv = parts.join('');
        return { size: 100, type: 'text/csv;charset=utf-8;' } as unknown as Blob;
      }
    });

    exportRevenueToCsv(mockRevenueData);

    expect(capturedCsv).toContain('Period,Collected (THB),Outstanding (THB),Total Billed (THB)');
    expect(capturedCsv).toContain('2026-01');
    expect(capturedCsv).toContain('380000');
    expect(capturedCsv).toContain('425000');
    expect(capturedCsv).toContain('2026-02');

    vi.stubGlobal('Blob', originalBlob);
  });

  it('handles empty data array — still generates headers', () => {
    let capturedCsv: string | null = null;
    const originalBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class {
      constructor(parts: unknown[]) {
        capturedCsv = parts.join('');
        return { size: 0, type: 'text/csv;charset=utf-8;' } as unknown as Blob;
      }
    });

    exportRevenueToCsv([]);

    expect(capturedCsv).toContain('Period,Collected (THB),Outstanding (THB),Total Billed (THB)');
    expect(capturedCsv).not.toContain('2026-01');

    vi.stubGlobal('Blob', originalBlob);
  });

  it('handles values with special characters (commas in period)', () => {
    const dataWithSpecialChars: API.RevenueMetricResponse[] = [
      { period: '2026-01,Special', collected: 100, outstanding: 200, total_billed: 300 },
    ];

    let capturedCsv: string | null = null;
    const originalBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class {
      constructor(parts: unknown[]) {
        capturedCsv = parts.join('');
        return { size: 100, type: 'text/csv;charset=utf-8;' } as unknown as Blob;
      }
    });

    exportRevenueToCsv(dataWithSpecialChars);

    expect(capturedCsv).toContain('"2026-01,Special"');

    vi.stubGlobal('Blob', originalBlob);
  });

  it('handles null values in data', () => {
    const dataWithNulls = [
      { period: null, collected: null, outstanding: null, total_billed: null },
    ];

    let capturedCsv: string | null = null;
    const originalBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class {
      constructor(parts: unknown[]) {
        capturedCsv = parts.join('');
        return { size: 100, type: 'text/csv;charset=utf-8;' } as unknown as Blob;
      }
    });

    exportRevenueToCsv(dataWithNulls as unknown as API.RevenueMetricResponse[]);

    expect(capturedCsv).toContain('Period');
    // null values should become empty strings — 4 fields joined by commas = ",,,"
    const dataRow = capturedCsv!.split('\n')[1];
    expect(dataRow).toBe(',,,');

    vi.stubGlobal('Blob', originalBlob);
  });
});
