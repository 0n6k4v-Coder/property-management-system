// File: src/shared/auth/AuthContext.tsx
// Auth state management via React Context + useReducer — token in memory only.
// SDD §5.1 — Client state uses Context + useReducer, NOT localStorage.

import {
  createContext,
  use,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
  useEffect,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiFetch,
  setStoredTokens,
  clearStoredTokens,
  getStoredAccessToken,
  registerAuthCallbacks,
} from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

// ── Types ───────────────────────────────────────────────────────────

interface AuthState {
  user: API.UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; user: API.UserResponse }
  | { type: 'LOGIN_FAILURE'; error: string }
  | { type: 'LOGOUT' }
  | { type: 'LOADING_DONE' };

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: API.RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
}

// ── Reducer ─────────────────────────────────────────────────────────

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        user: action.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.error,
      };
    case 'LOGOUT':
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'LOADING_DONE':
      return { ...state, isLoading: false };
    default:
      return state;
  }
}

// ── Initial State ──────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// ── Context ─────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const navigate = useNavigate();

  // Check existing session on mount
  useEffect(() => {
    const token = getStoredAccessToken();
    if (token) {
      // Verify session with /auth/me
      apiFetch<API.SuccessResponse<API.UserResponse>>('/auth/me')
        .then((res) => {
          if ('data' in res) {
            dispatch({ type: 'LOGIN_SUCCESS', user: res.data });
          } else {
            dispatch({ type: 'LOGOUT' });
          }
        })
        .catch(() => {
          clearStoredTokens();
          dispatch({ type: 'LOGOUT' });
        })
        .finally(() => {
          dispatch({ type: 'LOADING_DONE' });
        });
    } else {
      dispatch({ type: 'LOADING_DONE' });
    }
  }, []);

  // Wrap a navigation in a View Transition (React Router v7) when supported;
  // otherwise navigate normally. Focus routing handled by route target (ADR 004 v1.2).
  const navigateWithTransition = useCallback(
    (to: string, replace = false) => {
      navigate(to, { replace, viewTransition: true });
    },
    [navigate],
  );

  const logout = useCallback(() => {
    clearStoredTokens();
    dispatch({ type: 'LOGOUT' });
    navigateWithTransition('/login', true);
  }, [navigateWithTransition]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    const token = getStoredAccessToken();
    if (!token) return null;
    try {
      const res = await apiFetch<API.SuccessResponse<API.RefreshData>>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: getStoredAccessToken() }),
        skipAuth: true,
      });
      if ('data' in res) {
        setStoredTokens(res.data.access_token);
        return res.data.access_token;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      dispatch({ type: 'LOGIN_START' });
      try {
        const res = await apiFetch<API.SuccessResponse<API.TokenData>>(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            skipAuth: true,
          },
        );
        if ('error' in res) {
          const errRes = res as unknown as API.ErrorResponse;
          dispatch({
            type: 'LOGIN_FAILURE',
            error: errRes.error.message ?? 'Login failed',
          });
          return;
        }
        if ('data' in res) {
          setStoredTokens(res.data.access_token, res.data.refresh_token);
          dispatch({ type: 'LOGIN_SUCCESS', user: res.data.user });
          // React Router v7 drives the View Transition; focus routed by target (ADR 004 v1.2)
          navigate('/', { replace: true, viewTransition: true });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        dispatch({ type: 'LOGIN_FAILURE', error: message });
      }
    },
    [navigate],
  );

  const register = useCallback(
    async (data: API.RegisterRequest): Promise<void> => {
      dispatch({ type: 'LOGIN_START' });
      try {
        const res = await apiFetch<API.SuccessResponse<API.UserResponse>>(
          '/auth/register',
          {
            method: 'POST',
            body: JSON.stringify(data),
            skipAuth: true,
          },
        );
        if ('error' in res) {
          const errRes = res as unknown as API.ErrorResponse;
          dispatch({
            type: 'LOGIN_FAILURE',
            error: errRes.error.message ?? 'Registration failed',
          });
          return;
        }
        dispatch({ type: 'LOADING_DONE' });
        void navigate('/login', { replace: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        dispatch({ type: 'LOGIN_FAILURE', error: message });
      }
    },
    [navigate],
  );

  useEffect(() => {
    registerAuthCallbacks(logout, refreshToken);
  }, [logout, refreshToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      register,
      refreshToken,
    }),
    [state, login, logout, register, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Re-export for convenience
export type { AuthContextValue };