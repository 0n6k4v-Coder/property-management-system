// File: src/shared/components/Dialog.tsx
// Reusable wrapper for native <dialog> element.
// Encapsulates imperative showModal/close API to satisfy eslint react-doctor/no-event-handler.

import { useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync open prop with dialog state using callback ref pattern
  // This avoids useEffect with props dependency that triggers react-doctor/no-event-handler
  const setDialogRef = (dialog: HTMLDialogElement | null) => {
    dialogRef.current = dialog;
    if (dialog) {
      if (open && !dialog.open) {
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
      }
    }
  };

  // Handle cancel event (Escape key) — native <dialog> fires 'cancel' on Escape
  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    onClose?.();
  };

  return (
    <dialog
      ref={setDialogRef}
      onCancel={handleCancel}
      className={className}
    >
      {children}
    </dialog>
  );
}

Dialog.displayName = 'Dialog';