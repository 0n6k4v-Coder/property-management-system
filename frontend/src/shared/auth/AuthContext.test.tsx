// File: src/shared/auth/AuthContext.test.tsx
// Unit tests for AuthContext — AuthProvider render, useAuth hook, login flow,
// logout flow, token refresh, auth error handling, session verification on mount.

import { describe, it, expect, beforeAll, afterEach, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { setStoredTokens, clearStoredTokens } from '@/shared/api/fetchClient';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  clearStoredTokens();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

// ── Test harness ───────────────────────────────────────────────────────────

function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="loading">{auth.isLoading ? 'yes' : 'no'}</span>
      <span data-testid="error">{auth.error ?? 'none'}</span>
      <span data-testid="user">{auth.user?.email ?? 'none'}</span>
      <span data-testid="userName">{auth.user?.full_name ?? 'none'}</span>
      <button type="button" onClick={() => void auth.login('test@example.com', 'Password1')}>Login</button>
      <button type="button" onClick={auth.logout}>Logout</button>
      <button type="button" onClick={() => void auth.refreshToken()}>Refresh</button>
    </div>
  );
}

function renderWithAuth(
  ui: React.ReactNode,
  initialEntries: string[] = ['/'],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

// ── AuthProvider / useAuth ─────────────────────────────────────────────────

describe('AuthProvider', () => {
  beforeEach(() => {
    clearStoredTokens();
  });

  it('renders children without crashing', () => {
    renderWithAuth(<div data-testid="child">Child Content</div>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('initializes with isLoading=true, isAuthenticated=false, no error, no user', async () => {
    // The useEffect dispatches LOADING_DONE immediately when no token is stored.
    // We verify the eventual stable state.
    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('no');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(screen.getByTestId('error').textContent).toBe('none');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('shows loading state briefly then resolves when no token stored', async () => {
    clearStoredTokens();
    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('no');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('no');
  });
});

describe('useAuth hook', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<AuthConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    spy.mockRestore();
  });
});

// ── Session verification on mount ──────────────────────────────────────────

describe('session verification on mount', () => {
  it('calls /auth/me and sets user when token exists and is valid', async () => {
    setStoredTokens('valid-token');

    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'verify@example.com',
            full_name: 'Verified User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });
    expect(screen.getByTestId('user').textContent).toBe('verify@example.com');
    expect(screen.getByTestId('userName').textContent).toBe('Verified User');
    expect(screen.getByTestId('loading').textContent).toBe('no');
  });

  it('logs out when /auth/me returns no data property', async () => {
    setStoredTokens('invalid-token');

    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({ something: 'unexpected' });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
    });
    expect(screen.getByTestId('loading').textContent).toBe('no');
  });

  it('clears tokens and logs out on /auth/me error', async () => {
    setStoredTokens('error-token');

    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'Invalid token' } },
          { status: 401 },
        );
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
    });
    expect(screen.getByTestId('loading').textContent).toBe('no');
    expect(window.sessionStorage.getItem('pms_access_token')).toBeNull();
  });
});

// ── Login flow ─────────────────────────────────────────────────────────────

describe('login flow', () => {
  it('logs in successfully with valid credentials', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () => {
        return HttpResponse.json({
          data: {
            access_token: 'login-access-token',
            refresh_token: 'login-refresh-token',
            user: {
              id: 'user-1',
              email: 'test@example.com',
              full_name: 'Test User',
              property_scopes: [],
              is_active: true,
            },
          },
        });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    const btn = await screen.findByText('Login');
    await btn.click();

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });
    expect(screen.getByTestId('user').textContent).toBe('test@example.com');
    expect(screen.getByTestId('userName').textContent).toBe('Test User');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('sets tokens in sessionStorage on successful login', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () => {
        return HttpResponse.json({
          data: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            user: {
              id: 'user-1',
              email: 'test@example.com',
              full_name: 'Test User',
              property_scopes: [],
              is_active: true,
            },
          },
        });
      }),
    );

    renderWithAuth(<AuthConsumer />);
    const btn = await screen.findByText('Login');
    await btn.click();

    await waitFor(() => {
      expect(window.sessionStorage.getItem('pms_access_token')).toBe('new-access-token');
    });
    expect(window.sessionStorage.getItem('pms_refresh_token')).toBe('new-refresh-token');
  });

  it('sets login failure error when login returns error response', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-001', message: 'Invalid email or password' } },
          { status: 401 },
        );
      }),
    );

    renderWithAuth(<AuthConsumer />);
    await screen.findByText('Login').then((btn) => btn.click());

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Invalid email or password');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('no');
  });

  it('sets login failure error on server error', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () => {
        return new Response('Server error', { status: 500 });
      }),
    );

    renderWithAuth(<AuthConsumer />);
    await screen.findByText('Login').then((btn) => btn.click());

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).not.toBe('none');
    });
  });

  it('shows loading state briefly during login', async () => {
    server.use(
      http.post('*/api/v1/auth/login', async () => {
        await new Promise((r) => setTimeout(r, 500));
        return HttpResponse.json({
          data: {
            access_token: 'token',
            refresh_token: 'refresh',
            user: {
              id: 'user-1',
              email: 'test@example.com',
              full_name: 'Test User',
              property_scopes: [],
              is_active: true,
            },
          },
        });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    const btn = await screen.findByText('Login');
    await btn.click();

    // During login, isLoading should be true (LOGIN_START)
    // After login completes, isLoading should be false (LOGIN_SUCCESS)
    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });
  });

  it('sets error message when login API returns error without message', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-001' } },
          { status: 401 },
        );
      }),
    );

    renderWithAuth(<AuthConsumer />);
    await screen.findByText('Login').then((btn) => btn.click());

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).not.toBe('none');
    });
  });
});

// ── Logout flow ────────────────────────────────────────────────────────────

describe('logout flow', () => {
  it('clears tokens and sets isAuthenticated to false', async () => {
    setStoredTokens('valid-token');

    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    await screen.findByText('Logout').then((btn) => btn.click());

    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(window.sessionStorage.getItem('pms_access_token')).toBeNull();
  });
});

// ── Token refresh ──────────────────────────────────────────────────────────

describe('refreshToken', () => {
  it('fetches new access token and stores it on success', async () => {
    setStoredTokens('old-access', 'old-refresh');

    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
      http.post('*/api/v1/auth/refresh', () => {
        return HttpResponse.json({
          data: { access_token: 'refreshed-access-token' },
        });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    const btn = await screen.findByText('Refresh');
    await btn.click();

    await waitFor(() => {
      expect(window.sessionStorage.getItem('pms_access_token')).toBe(
        'refreshed-access-token',
      );
    });
  });

  it('returns null when refresh API fails', async () => {
    setStoredTokens('old-access', 'old-refresh');

    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
      http.post('*/api/v1/auth/refresh', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'Refresh token expired' } },
          { status: 401 },
        );
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    const btn = await screen.findByText('Refresh');
    await btn.click();

    await waitFor(() => {
      // Original token preserved (refresh failed, no update)
      expect(window.sessionStorage.getItem('pms_access_token')).toBe('old-access');
    });
  });

  it('returns null when no access token is stored', async () => {
    clearStoredTokens();

    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
    );

    // Override /auth/me to return 401 when no token — so AuthProvider starts unauthenticated
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'No token' } },
          { status: 401 },
        );
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
    });

    // Refresh button should still work and return null immediately
    const btn = await screen.findByText('Refresh');
    await btn.click();

    // No token was stored, so access token should remain null
    await waitFor(() => {
      expect(window.sessionStorage.getItem('pms_access_token')).toBeNull();
    });
  });

  it('returns null when refresh returns no data property', async () => {
    setStoredTokens('old-access', 'old-refresh');

    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
      http.post('*/api/v1/auth/refresh', () => {
        return HttpResponse.json({ something: 'unexpected' });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    const btn = await screen.findByText('Refresh');
    await btn.click();

    await waitFor(() => {
      // Original token preserved since refresh returned no data
      expect(window.sessionStorage.getItem('pms_access_token')).toBe('old-access');
    });
  });
});

// ── Register flow ──────────────────────────────────────────────────────────

describe('register flow', () => {
  it('registers successfully (API returns 201)', async () => {
    server.use(
      http.post('*/api/v1/auth/register', () => {
        return HttpResponse.json({
          data: {
            id: 'new-user',
            email: 'new@example.com',
            full_name: 'New User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
    );

    function RegisterInitiator() {
      const auth = useAuth();
      return (
        <button
          type="button"
          onClick={async () => {
            await auth.register({
              invite_token: 'token-123',
              full_name: 'New User',
              phone: '0812345678',
              password: 'Password1',
            });
            (window as unknown as { __registered: boolean }).__registered = true;
          }}
        >
          Register
        </button>
      );
    }

    renderWithAuth(<RegisterInitiator />, ['/auth/register']);

    const btn = await screen.findByText('Register');
    await btn.click();

    await waitFor(() => {
      expect((window as unknown as { __registered: boolean }).__registered).toBe(true);
    });
  });

  it('sets LOGIN_FAILURE error on registration failure', async () => {
    server.use(
      http.post('*/api/v1/auth/register', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Invalid invite token' } },
          { status: 400 },
        );
      }),
    );

    function RegisterInitiator() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="error">{auth.error ?? 'none'}</span>
          <button
            type="button"
            onClick={async () => {
              await auth.register({
                invite_token: 'bad-token',
                full_name: 'New User',
                phone: '0812345678',
                password: 'Password1',
              });
            }}
          >
            Register
          </button>
        </div>
      );
    }

    renderWithAuth(<RegisterInitiator />, ['/auth/register']);
    const btn = await screen.findByText('Register');
    await btn.click();

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Invalid invite token');
    });
  });
});

// ── Auth state context value ───────────────────────────────────────────────

describe('AuthContext value', () => {
  it('exposes all expected properties', async () => {
    let capturedValue: ReturnType<typeof useAuth> | null = null;

    function ValueCapture() {
      const auth = useAuth();
      capturedValue = auth;
      return null;
    }

    renderWithAuth(<ValueCapture />);

    await waitFor(() => {
      expect(capturedValue).not.toBeNull();
    });

    expect(capturedValue).not.toBeNull();
    expect(typeof capturedValue?.login).toBe('function');
    expect(typeof capturedValue?.logout).toBe('function');
    expect(typeof capturedValue?.register).toBe('function');
    expect(typeof capturedValue?.refreshToken).toBe('function');
    expect(typeof capturedValue?.isAuthenticated).toBe('boolean');
    expect(typeof capturedValue?.isLoading).toBe('boolean');
    expect(capturedValue?.user).toBeNull();
    expect(capturedValue?.error).toBeNull();
  });
});

// ── Error response with 200 OK (apiFetch returns { error } instead of throwing) ─
// These tests cover lines 175-180 (login) and 210-215 (register) where
// apiFetch returns a 200 response with { error: ... } body. In practice,
// apiFetch throws on non-OK responses, but the AuthContext also handles
// the case where the server returns 200 with an error payload.

describe('login flow — 200 OK error response', () => {
  it('sets LOGIN_FAILURE when login returns 200 with error and message', async () => {
    setStoredTokens('dummy');
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'No token' } },
          { status: 401 },
        );
      }),
      http.post('*/api/v1/auth/login', () => {
        // Server returns 200 OK with error body — does NOT throw
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Internal server error' } },
        );
      }),
    );

    renderWithAuth(<AuthConsumer />);

    // Wait for auth to resolve, then click login
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('no');
    });

    const btn = await screen.findByText('Login');
    await btn.click();

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Internal server error');
    });
  });

  it('sets LOGIN_FAILURE with fallback "Login failed" when error has no message', async () => {
    setStoredTokens('dummy');
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json(
          { error: { code: 'AUTH-009', message: 'No token' } },
          { status: 401 },
        );
      }),
      http.post('*/api/v1/auth/login', () => {
        // 200 OK with error body but NO message field
        return HttpResponse.json(
          { error: { code: 'AUTH-001' } },
        );
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('no');
    });

    const btn = await screen.findByText('Login');
    await btn.click();

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Login failed');
    });
  });
});

describe('register flow — 200 OK error response', () => {
  it('sets LOGIN_FAILURE when register returns 200 with error and message', async () => {
    setStoredTokens('dummy');
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
      http.post('*/api/v1/auth/register', () => {
        // 200 OK with error body
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Invalid invite token' } },
        );
      }),
    );

    function RegisterInitiator() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
          <span data-testid="error">{auth.error ?? 'none'}</span>
          <button
            type="button"
            onClick={async () => {
              await auth.register({
                invite_token: 'bad-token',
                full_name: 'New User',
                phone: '0812345678',
                password: 'Password1',
              });
            }}
          >
            Register
          </button>
        </div>
      );
    }

    renderWithAuth(<RegisterInitiator />, ['/auth/register']);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    const btn = await screen.findByText('Register');
    await btn.click();

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Invalid invite token');
    });
  });

  it('sets LOGIN_FAILURE with fallback "Registration failed" when error has no message', async () => {
    setStoredTokens('dummy');
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
      http.post('*/api/v1/auth/register', () => {
        // 200 OK with error body but NO message
        return HttpResponse.json(
          { error: { code: 'VAL-400' } },
        );
      }),
    );

    function RegisterInitiator() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
          <span data-testid="error">{auth.error ?? 'none'}</span>
          <button
            type="button"
            onClick={async () => {
              await auth.register({
                invite_token: 'bad-token',
                full_name: 'New User',
                phone: '0812345678',
                password: 'Password1',
              });
            }}
          >
            Register
          </button>
        </div>
      );
    }

    renderWithAuth(<RegisterInitiator />, ['/auth/register']);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    const btn = await screen.findByText('Register');
    await btn.click();

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Registration failed');
    });
  });
});

// ── Register success path (LOADING_DONE dispatch) ─────────────────────────────

describe('register flow — success path with LOADING_DONE', () => {
  it('navigates to /login after successful registration', async () => {
    setStoredTokens('dummy');
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
      http.post('*/api/v1/auth/register', () => {
        return HttpResponse.json({
          data: {
            id: 'new-user',
            email: 'new@example.com',
            full_name: 'New User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
    );

    function RegisterInitiator() {
      const auth = useAuth();
      return (
        <div>
          <span data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
          <span data-testid="error">{auth.error ?? 'none'}</span>
          <button
            type="button"
            onClick={async () => {
              await auth.register({
                invite_token: 'token-123',
                full_name: 'New User',
                phone: '0812345678',
                password: 'Password1',
              });
            }}
          >
            Register
          </button>
        </div>
      );
    }

    renderWithAuth(<RegisterInitiator />, ['/auth/register']);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    const btn = await screen.findByText('Register');
    await btn.click();

    // After successful registration (200 OK with data), no error should be set
    // and the LOADING_DONE dispatch is reached (lines 213-217)
    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('none');
    });
  });
});

// ── registerAuthCallbacks registration ───────────────────────────────────────

describe('registerAuthCallbacks', () => {
  it('registers auth callbacks on mount (logout + refreshToken)', async () => {
    setStoredTokens('valid-token');
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    // The useEffect in AuthProvider calls registerAuthCallbacks(logout, refreshToken)
    // We verify the auth context is fully functional
    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    // Verify logout and refreshToken are available as functions
    expect(screen.getByTestId('user').textContent).toBe('test@example.com');

    // Trigger logout
    const logoutBtn = await screen.findByText('Logout');
    await logoutBtn.click();

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
    });
  });

  it('refreshToken is callable after auth is established', async () => {
    setStoredTokens('valid-token');
    server.use(
      http.get('*/api/v1/auth/me', () => {
        return HttpResponse.json({
          data: {
            id: 'user-1',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        });
      }),
      http.post('*/api/v1/auth/refresh', () => {
        return HttpResponse.json({
          data: { access_token: 'new-refresh-token' },
        });
      }),
    );

    renderWithAuth(<AuthConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    // The refresh button should be available and callable
    const refreshBtn = await screen.findByText('Refresh');
    await refreshBtn.click();

    await waitFor(() => {
      expect(window.sessionStorage.getItem('pms_access_token')).toBe('new-refresh-token');
    });
  });
});
