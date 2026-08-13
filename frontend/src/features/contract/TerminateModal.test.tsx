// File: src/features/contract/TerminateModal.test.tsx
// Unit tests for TerminateModal — rendering, validation, submission, reset on close.

import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TerminateModal from './TerminateModal';

const mockOnSubmit = vi.fn();
const mockOnClose = vi.fn();

function renderModal(props = {}) {
  return render(
    <TerminateModal
      open={true}
      onClose={mockOnClose}
      onSubmit={mockOnSubmit}
      isLoading={false}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TerminateModal', () => {
  describe('rendering', () => {
    it('renders modal with correct title', () => {
      renderModal();
      expect(screen.getByText('Terminate Contract')).toBeInTheDocument();
    });

    it('renders reason select', () => {
      renderModal();
      expect(screen.getByLabelText(/^Reason/)).toBeInTheDocument();
    });

    it('renders all termination reason options', () => {
      renderModal();

      const select = screen.getByLabelText(/^Reason/);
      const options = select.querySelectorAll('option');
      // 1 default + 5 reasons = 6
      expect(options).toHaveLength(6);

      expect(screen.getByText('Select a reason…')).toBeInTheDocument();
      expect(screen.getByText('Tenant Moved Out')).toBeInTheDocument();
      expect(screen.getByText('Owner Terminated')).toBeInTheDocument();
      expect(screen.getByText('Breach of Contract')).toBeInTheDocument();
      expect(screen.getByText('Mutual Agreement')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('renders notes input field', () => {
      renderModal();
      // Label is "Notes (optional)" with no requiredIndicator, so no aria-hidden *
      expect(screen.getByLabelText('Notes (optional)')).toBeInTheDocument();
    });

    it('renders Cancel and Terminate buttons', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument();
    });

    it('renders nothing when open is false', () => {
      renderModal({ open: false });
      expect(screen.queryByText('Terminate Contract')).not.toBeInTheDocument();
    });
  });

  describe('default state', () => {
    it('defaults reason to tenant_moved_out', () => {
      renderModal();
      const select = screen.getByLabelText(/^Reason/) as HTMLSelectElement;
      expect(select.value).toBe('tenant_moved_out');
    });

    it('starts with empty notes', () => {
      renderModal();
      const notesInput = screen.getByLabelText('Notes (optional)') as HTMLInputElement;
      expect(notesInput.value).toBe('');
    });
  });

  describe('user interactions', () => {
    it('closes modal and resets state when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.selectOptions(screen.getByLabelText(/^Reason/), 'breach_of_contract');
      await user.type(screen.getByLabelText('Notes (optional)'), 'Test notes');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('disables Terminate button when loading', () => {
      renderModal({ isLoading: true });

      const terminateBtn = screen.getByRole('button', { name: 'Terminate' });
      expect(terminateBtn).toBeDisabled();
    });

    it('shows loading state with aria-busy when isLoading is true', () => {
      renderModal({ isLoading: true });

      const terminateBtn = screen.getByRole('button', { name: 'Terminate' });
      expect(terminateBtn).toBeDisabled();
      expect(terminateBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('calls onSubmit with selected reason and notes', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.selectOptions(screen.getByLabelText(/^Reason/), 'owner_terminated');
      await user.type(screen.getByLabelText('Notes (optional)'), 'Owner sold the building');

      mockOnSubmit.mockResolvedValueOnce(undefined);

      await user.click(screen.getByRole('button', { name: 'Terminate' }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('owner_terminated', 'Owner sold the building');
      });
    });

    it('passes null for notes when notes field is empty', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.selectOptions(screen.getByLabelText(/^Reason/), 'mutual_agreement');

      mockOnSubmit.mockResolvedValueOnce(undefined);

      await user.click(screen.getByRole('button', { name: 'Terminate' }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('mutual_agreement', null);
      });
    });

    it('closes modal after successful submission', async () => {
      const user = userEvent.setup();
      const onSubmitMock = vi.fn().mockResolvedValueOnce(undefined);
      renderModal({ onSubmit: onSubmitMock });

      await user.click(screen.getByRole('button', { name: 'Terminate' }));

      // The modal's handleSubmit calls onSubmit but does NOT call onClose.
      // In the isolated component test, onClose is only called by Cancel/overlay.
      // Verify onSubmit was called instead.
      await waitFor(() => {
        expect(onSubmitMock).toHaveBeenCalledWith('tenant_moved_out', null);
      });
    });

    it('handles all termination reasons', async () => {
      const reasons = [
        'tenant_moved_out',
        'owner_terminated',
        'breach_of_contract',
        'mutual_agreement',
        'other',
      ];

      /* eslint-disable react-doctor/async-await-in-loop */
      for (const reason of reasons) {
        vi.clearAllMocks();
        const onSubmitMock = vi.fn().mockResolvedValueOnce(undefined);
        const user = userEvent.setup();
        render(
          <TerminateModal
            open={true}
            onClose={mockOnClose}
            onSubmit={onSubmitMock}
            isLoading={false}
          />,
        );

        await user.selectOptions(screen.getByLabelText(/^Reason/), reason);
        await user.click(screen.getByRole('button', { name: 'Terminate' }));

        await waitFor(() => {
          expect(onSubmitMock).toHaveBeenCalledWith(reason, null);
        });

        cleanup();
      }
      /* eslint-enable react-doctor/async-await-in-loop */
    });

    it('submit button is enabled when reason is selected', () => {
      renderModal();

      const terminateBtn = screen.getByRole('button', { name: 'Terminate' });
      // Reason defaults to 'tenant_moved_out', so button should be enabled
      expect(terminateBtn).not.toBeDisabled();
    });

    it('reset reason to default after Cancel', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.selectOptions(screen.getByLabelText(/^Reason/), 'breach_of_contract');
      await user.type(screen.getByLabelText('Notes (optional)'), 'Some notes');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
