// File: src/shared/ui/Modal.test.tsx
// Unit tests for Modal — renders on canonical Dialog, accessible name, close trigger, children rendering.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders modal dialog with accessible name when open is true', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Test Dialog Title">
        <p>Modal body content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Test Dialog Title' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Test Dialog Title')).toBeInTheDocument();
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
  });

  it('renders nothing when open is false', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Closed Modal">
        <p>Hidden content</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('calls onClose when close button in header is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open={true} onClose={onClose} title="Test Title">
        <p>Content</p>
      </Modal>,
    );
    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel event fires on dialog (Escape key)', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test Title">
        <p>Content</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Test Title' }) as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(
      <Modal open={true} onClose={vi.fn()} title="Small Modal" size="sm">
        <p>Small</p>
      </Modal>,
    );
    let dialog = screen.getByRole('dialog', { name: 'Small Modal' });
    expect(dialog).toHaveClass('max-w-sm');

    rerender(
      <Modal open={true} onClose={vi.fn()} title="Large Modal" size="lg">
        <p>Large</p>
      </Modal>,
    );
    dialog = screen.getByRole('dialog', { name: 'Large Modal' });
    expect(dialog).toHaveClass('max-w-2xl');
  });

  it('unmounts when open transitions from true to false', () => {
    const { rerender } = render(
      <Modal open={true} onClose={vi.fn()} title="Toggle Modal">
        <p>Toggle content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Toggle Modal' })).toBeInTheDocument();

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Toggle Modal">
        <p>Toggle content</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog', { name: 'Toggle Modal' })).not.toBeInTheDocument();
  });
});
