// File: src/features/auth/LoginPage.tsx
// Login form — SCR-LOGIN: email + password, validation, API call, error handling.
// SDD §02-screen-specs/01-login.md

import { useReducer, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

type FormState = 'idle' | 'validating' | 'submitting' | 'error';

interface LoginFormState {
  email: string;
  password: string;
  showPassword: boolean;
  fieldErrors: Record<string, string>;
  formState: FormState;
}

type LoginFormAction =
  | { type: 'SET_FIELD'; field: 'email' | 'password'; value: string }
  | { type: 'SET_FORM_STATE'; state: FormState }
  | { type: 'TOGGLE_PASSWORD' }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string> }
  | { type: 'CLEAR_FIELD_ERROR'; field: string };

function loginFormReducer(state: LoginFormState, action: LoginFormAction): LoginFormState {
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

const initialLoginState: LoginFormState = {
  email: '',
  password: '',
  showPassword: false,
  fieldErrors: {},
  formState: 'idle',
};

export default function LoginPage() {
  const { login, error: authError } = useAuth();
  const [{ email, password, showPassword, fieldErrors, formState }, dispatch] = useReducer(
    loginFormReducer,
    initialLoginState,
  );

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    dispatch({ type: 'SET_FIELD_ERRORS', errors });
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: 'SET_FORM_STATE', state: 'validating' });

    if (!validate()) {
      dispatch({ type: 'SET_FORM_STATE', state: 'idle' });
      return;
    }

    dispatch({ type: 'SET_FORM_STATE', state: 'submitting' });
    await login(email.trim(), password);
    dispatch({ type: 'SET_FORM_STATE', state: authError ? 'error' : 'idle' });
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-surface-900">
        Sign in to your account
      </h2>
      <p className="mt-1 text-sm text-surface-500">
        Enter your credentials to access the system
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'email', value: e.target.value })}
          error={fieldErrors.email}
          autoComplete="email"
          autoFocus
          required
          aria-label="Email address"
        />

        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'password', value: e.target.value })}
            error={fieldErrors.password}
            autoComplete="current-password"
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

        {/* API Error */}
        {authError && (
          <div
            className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 login-error-alert"
            role="alert"
          >
            {authError}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full login-submit-btn"
          isLoading={formState === 'submitting'}
          disabled={formState === 'submitting'}
        >
          Sign in
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-surface-500">
        Don't have an account?{' '}
        <Link
          to="/auth/register"
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Register with invite
        </Link>
      </p>
    </div>
  );
}