// File: src/features/auth/RegisterPage.tsx
// Invite registration form — SCR-REGISTER: full_name, phone, password, confirm, token from URL.
// SDD §02-screen-specs/02-register.md

import { useReducer, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

type FormState = 'validating-token' | 'idle' | 'submitting' | 'error' | 'success';

interface RegisterFormState {
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  fieldErrors: Record<string, string>;
  formState: FormState;
}

type RegisterFormAction =
  | { type: 'SET_FIELD'; field: 'fullName' | 'phone' | 'password' | 'confirmPassword'; value: string }
  | { type: 'SET_FORM_STATE'; state: FormState }
  | { type: 'TOGGLE_PASSWORD' }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string> }
  | { type: 'CLEAR_FIELD_ERROR'; field: string };

function registerFormReducer(state: RegisterFormState, action: RegisterFormAction): RegisterFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_FORM_STATE':
      return { ...state, formState: action.state };
    case 'TOGGLE_PASSWORD':
      return { ...state, showPassword: !state.showPassword };
    case 'SET_FIELD_ERRORS':
      return { ...state, fieldErrors: action.errors };
    case 'CLEAR_FIELD_ERROR':
      return { ...state, fieldErrors: { ...state.fieldErrors, [action.field]: '' } };
    default:
      return state;
  }
}

const initialRegisterState: RegisterFormState = {
  fullName: '',
  phone: '',
  password: '',
  confirmPassword: '',
  showPassword: false,
  fieldErrors: {},
  formState: 'idle',
};

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') ?? '';
  const { register, error: authError } = useAuth();
  const [
    { fullName, phone, password, confirmPassword, showPassword, fieldErrors, formState },
    dispatch,
  ] = useReducer(registerFormReducer, {
    ...initialRegisterState,
    formState: inviteToken ? ('idle' as FormState) : ('validating-token' as FormState),
  });

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!inviteToken) {
      errors.invite = 'Missing invitation token';
    }

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }

    if (!phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (phone.trim().length < 10) {
      errors.phone = 'Phone number must be at least 10 digits';
    } else if (!/^[+]?[\d\s\-()]{10,15}$/.test(phone.trim())) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      errors.password = 'Password must contain at least one uppercase letter';
    } else if (!/\d/.test(password)) {
      errors.password = 'Password must contain at least one digit';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    dispatch({ type: 'SET_FIELD_ERRORS', errors });
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    dispatch({ type: 'SET_FORM_STATE', state: 'submitting' });
    try {
      await register({
        invite_token: inviteToken,
        full_name: fullName.trim(),
        password,
        phone: phone.trim(),
      });
      dispatch({ type: 'SET_FORM_STATE', state: 'success' });
    } catch {
      dispatch({ type: 'SET_FORM_STATE', state: 'error' });
    }
  }

  // Missing token state
  if (formState === 'validating-token') {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100">
          <svg className="size-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-surface-900">
          Invalid Invitation
        </h2>
        <p className="mt-2 text-sm text-surface-500">
          No invitation token found. Please use the link from your invitation email.
        </p>
        <div className="mt-6">
          <Link
            to="/login"
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-surface-900">
        Complete Registration
      </h2>
      <p className="mt-1 text-sm text-surface-500">
        Set up your account to get started
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          label="Full Name"
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'fullName', value: e.target.value })}
          error={fieldErrors.fullName}
          autoComplete="name"
          autoFocus
          required
          aria-label="Full name"
        />

        <Input
          label="Phone Number"
          type="tel"
          placeholder="081-234-5678"
          value={phone}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'phone', value: e.target.value })}
          error={fieldErrors.phone}
          autoComplete="tel"
          required
          aria-label="Phone number"
        />

        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 8 characters, 1 uppercase, 1 digit"
            value={password}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'password', value: e.target.value })}
            error={fieldErrors.password}
            autoComplete="new-password"
            required
            aria-label="Password"
          />
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_PASSWORD' })}
            className="mt-1 text-xs text-primary-600 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'} password
          </button>
        </div>

        <Input
          label="Confirm Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'confirmPassword', value: e.target.value })}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          required
          aria-label="Confirm password"
        />

        {/* API Error */}
        {authError && (
          <div
            className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {authError}
          </div>
        )}

        {/* Field error for missing token */}
        {fieldErrors.invite && (
          <div
            className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {fieldErrors.invite}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={formState === 'submitting'}
          disabled={formState === 'submitting'}
        >
          Create Account
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-surface-500">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}