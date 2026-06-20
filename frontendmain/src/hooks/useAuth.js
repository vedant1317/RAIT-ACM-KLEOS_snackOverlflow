import { useCallback, useState } from 'react';
import { caApi, clientApi, getToken, setToken } from '../api/client';

/**
 * Manages one auth scope ("ca" or "client"). Each scope keeps its own
 * bearer token in localStorage (see api/client.js) so the two login flows
 * never interfere with each other.
 */
export function useAuth(scope) {
  const api = scope === 'ca' ? caApi : clientApi;
  const [identity, setIdentity] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setError('');
      try {
        const data = await api.login(email, password);
        setToken(scope, data.token);
        setIdentity(
          scope === 'ca'
            ? { name: data.name, role: data.role, email: data.email }
            : { id: data.client_id, name: data.client_name }
        );
        return true;
      } catch (err) {
        setError(err.message || 'Login failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [api, scope]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* token may already be invalid/expired — clear it locally regardless */
    }
    setToken(scope, null);
    setIdentity(null);
  }, [api, scope]);

  return { identity, error, loading, login, logout, isAuthenticated: !!getToken(scope) };
}
