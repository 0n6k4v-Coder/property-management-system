// File: src/shared/components/Dialog.test.tsx
// Unit tests for Dialog — renders, open/close sync, cancel (Escape) event, onClose callback.

import { render, screen } from '@testing-library/react';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  // Polyfill showModal/close on HTMLDialogElement for jsdom
  beforeAll(() => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
        this.dispatchEvent(new Event('open', { bubbles: true }));
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function () {
        this.open = false;
      };
    }
  });

  it('renders children when open is true', () => {
    render(
      <Dialog open={true}>
        <p>Dialog content</p>
      </Dialog>,
    );
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('renders a dialog element with role="dialog"', () => {
    render(
      <Dialog open={true}>
        <p>Content</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.tagName).toBe('DIALOG');
  });

  it('applies custom className when provided', () => {
    render(
      <Dialog open={true} className="my-custom-class">
        <p>Content</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('my-custom-class');
  });

  it('calls onClose when cancel event is dispatched (Escape key)', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Content</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prevents default on cancel event', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose}>
        <p>Content</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    const defaultPrevented = !dialog.dispatchEvent(cancelEvent);
    // The handler calls e.preventDefault(), so dispatch returns false
    expect(defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not throw when onClose is not provided and cancel fires', () => {
    render(
      <Dialog open={true}>
        <p>Content</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog') as HTMLDialogElement;
    expect(() => {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    }).not.toThrow();
  });

  it('renders with children content', () => {
    render(
      <Dialog open={true}>
        <span>Child element</span>
      </Dialog>,
    );
    expect(screen.getByText('Child element')).toBeInTheDocument();
  });

  it('has displayName set to Dialog', () => {
    expect(Dialog.displayName).toBe('Dialog');
  });
});
