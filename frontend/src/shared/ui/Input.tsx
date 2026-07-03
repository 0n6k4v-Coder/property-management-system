// File: src/shared/ui/Input.tsx
// Reusable input component with ARIA compliance, error state, focus ring.
// React 19 — ref is a regular prop, no forwardRef needed.

import { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  id,
  className = '',
  ref,
  ...rest
}: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const baseInputStyles =
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-surface-900 placeholder-surface-400 transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-surface-400';
  const errorInputStyles = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-surface-300';

  return (
    <div className="space-y-1">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-surface-700"
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`${baseInputStyles} ${errorInputStyles} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-sm text-surface-500">
          {hint}
        </p>
      )}
    </div>
  );
}