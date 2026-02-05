import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/http';
import { clearSessionToken, neonAuth, readSessionToken } from '../lib/neonAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const url = new URL(window.location.href);
        
        // Skip auth bootstrap on password reset pages only
        const skipPages = ['/forgot-password', '/reset-password'];
        if (skipPages.includes(window.location.pathname)) {
          if (mounted) setLoading(false);
          return;
        }
        
        // Check for OAuth success redirect
        const oauthSuccess = url.searchParams.get('oauth');
        if (oauthSuccess === 'success') {
          sessionStorage.setItem('local_session_hint', '1');
          url.searchParams.delete('oauth');
          window.history.replaceState({}, '', url.toString());
        }
        
        const verifier = url.searchParams.get('neon_auth_session_verifier');
        const verifierHandled = sessionStorage.getItem('neon_verifier_handled');
        console.debug('[AUTH] bootstrap', {
          verifier: verifier || null,
          verifierHandled,
          oauthSuccess,
          localSessionHint: sessionStorage.getItem('local_session_hint'),
          hasNeonToken: Boolean(readSessionToken()),
        });
        if (verifier) {
          if (verifierHandled === verifier) {
            url.searchParams.delete('neon_auth_session_verifier');
            window.history.replaceState({}, '', url.toString());
          } else {
            try {
              console.debug('[AUTH] neon getSession for verifier');
              const session = await neonAuth.getSession();
              const user = session?.data?.user;
              if (!user?.email) throw new Error('No user from Neon session');

              console.debug('[AUTH] sync-oauth to backend');
              const exchanged = await api('/auth/sync-oauth', {
                method: 'POST',
                body: JSON.stringify({
                  email: user.email,
                  name: user.name || '',
                  subject: user.id || null,
                }),
              });
              console.debug('[AUTH] sync-oauth success', exchanged);
              if (mounted) {
                setUser(exchanged.user || null);
                setProfileComplete(Boolean(exchanged.profileComplete));
              }
              sessionStorage.setItem('local_session_hint', '1');
              clearSessionToken();
              sessionStorage.setItem('neon_verifier_handled', verifier);
            } catch (err) {
              console.debug('[AUTH] sync-oauth failed', err);
              clearSessionToken();
              sessionStorage.removeItem('local_session_hint');
            }
            url.searchParams.delete('neon_auth_session_verifier');
            window.history.replaceState({}, '', url.toString());
          }
          // Continue into regular bootstrap path.
        }

        const hasLocalSessionHint = sessionStorage.getItem('local_session_hint') === '1';
        const hasNeonBearer = Boolean(readSessionToken());
        if (!hasLocalSessionHint && !hasNeonBearer) {
          if (mounted) {
            setUser(null);
            setProfileComplete(false);
          }
          console.debug('[AUTH] bootstrap exit: no session hints');
          return;
        }

        console.debug('[AUTH] bootstrap calling /auth/me');
        const data = await api('/auth/me');
        console.debug('[AUTH] bootstrap /auth/me success', data);
        if (mounted) {
          setUser(data.user || null);
          setProfileComplete(Boolean(data.profileComplete));
        }
      } catch (err) {
        console.debug('[AUTH] bootstrap failed', err);
        if (mounted) {
          setUser(null);
          setProfileComplete(false);
        }
        clearSessionToken();
        sessionStorage.removeItem('local_session_hint');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, profileComplete, setProfileComplete }),
    [user, loading, profileComplete]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
