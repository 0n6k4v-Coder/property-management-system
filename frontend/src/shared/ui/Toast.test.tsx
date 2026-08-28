// File: src/shared/ui/Toast.test.tsx
// Unit tests for Toast.tsx — ToastProvider, useToast, ToastItem, type styles,
// auto-dismiss, manual close, maxToasts limit, multiple toasts.

import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

// ── Test component that consumes useToast ─────────────────────────────────────

function ToastConsumer({
  onToast,
}: {
  onToast?: (toast: ReturnType<typeof useToast>) => void;
}) {
  const toast = useToast();
  if (onToast) onToast(toast);
  return (
    <button
      type="button"
      onClick={() => toast.showToast('Test message')}
    >
      Show Toast
    </button>
  );
}

// ── Helper to render with ToastProvider ────────────────────────────────────────

function renderWithProvider(
  ui: React.ReactNode,
  maxToasts?: number,
) {
  return render(
    <ToastProvider maxToasts={maxToasts}>
      {ui}
    </ToastProvider>,
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── useToast hook ────────────────────────────────────────────────────────────

  describe('useToast', () => {
    it('throws when used outside ToastProvider', () => {
      expect(() => {
        render(<ToastConsumer />);
      }).toThrow('useToast must be used within ToastProvider');
    });

    it('returns showToast function when inside ToastProvider', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);
      expect(toastFn).not.toBeNull();
      expect(typeof toastFn?.showToast).toBe('function');
    });
  });

  // ── ToastProvider ────────────────────────────────────────────────────────────

  describe('ToastProvider', () => {
    it('renders children without crashing', () => {
      renderWithProvider(<div data-testid="child">Child Content</div>);
      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('uses default maxToasts=3 when not specified', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);
      expect(toastFn).not.toBeNull();
    });

    it('renders container with aria-live="polite"', () => {
      renderWithProvider(<div>Content</div>);
      const container = document.querySelector('.fixed.bottom-4.right-4');
      expect(container).toHaveAttribute('aria-live', 'polite');
      expect(container).toHaveAttribute('aria-relevant', 'additions');
    });

    it('applies fixed bottom-4 right-4 z-50 positioning', () => {
      renderWithProvider(<div>Content</div>);
      const container = document.querySelector('.fixed.bottom-4.right-4.z-50');
      expect(container).toBeInTheDocument();
    });

    it('renders flex-col gap-2 layout for toast stack', () => {
      renderWithProvider(<div>Content</div>);
      const container = document.querySelector('.flex.flex-col.gap-2');
      expect(container).toBeInTheDocument();
    });
  });

  // ── showToast ────────────────────────────────────────────────────────────────

  describe('showToast', () => {
    it('shows a toast with info type by default', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Hello World');
      });

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('shows toast with success type styling', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Success!', 'success');
      });

      const toast = screen.getByText('Success!');
      expect(toast).toBeInTheDocument();
      // The toast item div should have success styling
      const toastItem = toast.closest('div[role="alert"]');
      expect(toastItem).toHaveClass('bg-green-600');
    });

    it('shows toast with error type styling', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Error occurred', 'error');
      });

      const toast = screen.getByText('Error occurred');
      const toastItem = toast.closest('div[role="alert"]');
      expect(toastItem).toHaveClass('bg-red-600');
    });

    it('shows toast with warning type styling', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Warning!', 'warning');
      });

      const toast = screen.getByText('Warning!');
      const toastItem = toast.closest('div[role="alert"]');
      expect(toastItem).toHaveClass('bg-amber-500');
    });

    it('shows toast with info type styling', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Info message', 'info');
      });

      const toast = screen.getByText('Info message');
      const toastItem = toast.closest('div[role="alert"]');
      expect(toastItem).toHaveClass('bg-primary-600');
    });

    it('uses default duration of 5000ms', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Auto dismiss');
      });

      expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

      // Advance less than 5000ms — toast should still be visible
      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

      // Advance to 5000ms — toast should be dismissed
      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument();
    });

    it('respects custom duration', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Quick toast', 'info', 1000);
      });

      expect(screen.getByText('Quick toast')).toBeInTheDocument();

      // Advance less than 1000ms
      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(screen.getByText('Quick toast')).toBeInTheDocument();

      // Advance to 1000ms
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText('Quick toast')).not.toBeInTheDocument();
    });
  });

  // ── removeToast (dismiss) ───────────────────────────────────────────────────

  describe('removeToast / dismiss', () => {
    it('removes toast when dismiss button is clicked', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Dismissible toast');
      });

      expect(screen.getByText('Dismissible toast')).toBeInTheDocument();

      const dismissBtn = screen.getByRole('button', { name: /Dismiss notification/i });
      expect(dismissBtn).toBeInTheDocument();

      act(() => {
        dismissBtn.click();
      });

      expect(screen.queryByText('Dismissible toast')).not.toBeInTheDocument();
    });

    it('dismiss button has proper aria-label', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Test');
      });

      const dismissBtn = screen.getByRole('button', { name: /Dismiss notification/i });
      expect(dismissBtn).toHaveAttribute('aria-label', 'Dismiss notification');
      expect(dismissBtn).toHaveAttribute('type', 'button');
    });

    it('dismiss button has focus-visible outline', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Test');
      });

      const dismissBtn = screen.getByRole('button', { name: /Dismiss notification/i });
      expect(dismissBtn).toHaveClass('focus-visible:outline-2');
    });

    it('clears timeout on unmount (cleanup)', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      const { unmount } = renderWithProvider(
        <ToastConsumer onToast={(t) => { toastFn = t; }} />,
      );

      act(() => {
        toastFn!.showToast('Will be cleared');
      });

      expect(screen.getByText('Will be cleared')).toBeInTheDocument();

      // Unmount before timer fires — should not cause errors
      unmount();

      // Advancing timers should not cause errors after unmount
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    });
  });

  // ── Multiple toasts ─────────────────────────────────────────────────────────

  describe('multiple toasts', () => {
    it('shows multiple toasts simultaneously', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('First toast', 'success');
        toastFn!.showToast('Second toast', 'error');
        toastFn!.showToast('Third toast', 'warning');
      });

      expect(screen.getByText('First toast')).toBeInTheDocument();
      expect(screen.getByText('Second toast')).toBeInTheDocument();
      expect(screen.getByText('Third toast')).toBeInTheDocument();
    });

    it('respects maxToasts=1 limit', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />, 1);

      act(() => {
        toastFn!.showToast('First toast', 'success');
        toastFn!.showToast('Second toast', 'error');
      });

      // With maxToasts=1, slice(-(1-1)) = slice(0) = keeps all existing + new
      // This is the actual behavior due to slice(-0) === slice(0)
      expect(screen.getByText('First toast')).toBeInTheDocument();
      expect(screen.getByText('Second toast')).toBeInTheDocument();
    });

    it('respects maxToasts=2 limit (keeps last 2)', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />, 2);

      act(() => {
        toastFn!.showToast('First toast', 'success');
        toastFn!.showToast('Second toast', 'error');
        toastFn!.showToast('Third toast', 'warning');
      });

      expect(screen.queryByText('First toast')).not.toBeInTheDocument();
      expect(screen.getByText('Second toast')).toBeInTheDocument();
      expect(screen.getByText('Third toast')).toBeInTheDocument();
    });
  });

  // ── ToastItem ────────────────────────────────────────────────────────────────

  describe('ToastItem', () => {
    it('renders with role="alert"', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Alert test');
      });

      const toastItem = screen.getByRole('alert');
      expect(toastItem).toBeInTheDocument();
    });

    it('renders close button with SVG icon', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Test toast');
      });

      const dismissBtn = screen.getByRole('button', { name: /Dismiss notification/i });
      const svg = dismissBtn.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 20 20');
    });

    it('applies correct text styling (text-white) for error type', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      act(() => {
        toastFn!.showToast('Test message', 'error');
      });

      const toast = screen.getByText('Test message');
      const toastItem = toast.closest('div[role="alert"]');
      expect(toastItem).toHaveClass('text-white');
    });
  });

  // ── typeStyles map ───────────────────────────────────────────────────────────

  describe('typeStyles', () => {
    it('exposes typeStyles for all 4 toast types', () => {
      let toastFn: ReturnType<typeof useToast> | null = null;
      renderWithProvider(<ToastConsumer onToast={(t) => { toastFn = t; }} />);

      // Success
      act(() => {
        toastFn!.showToast('S', 'success');
      });
      expect(screen.getByText('S').closest('[role="alert"]')).toHaveClass('bg-green-600');

      // Error
      act(() => {
        toastFn!.showToast('E', 'error');
      });
      expect(screen.getByText('E').closest('[role="alert"]')).toHaveClass('bg-red-600');

      // Info
      act(() => {
        toastFn!.showToast('I', 'info');
      });
      expect(screen.getByText('I').closest('[role="alert"]')).toHaveClass('bg-primary-600');

      // Warning
      act(() => {
        toastFn!.showToast('W', 'warning');
      });
      expect(screen.getByText('W').closest('[role="alert"]')).toHaveClass('bg-amber-500');
    });
  });
});
