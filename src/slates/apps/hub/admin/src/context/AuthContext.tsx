import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { adminClient, withAuthRedirect } from '../hooks/client';

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AdminUser | null;
  logout: () => Promise<void>;
}

let AuthContext = createContext<AuthContextValue | null>(null);

export let AuthProvider = ({ children }: { children: ReactNode }) => {
  let [isLoading, setIsLoading] = useState(true);
  let [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    adminClient.auth
      .authEnabled({})
      .then(async ({ enabled }) => {
        if (!enabled) {
          setIsLoading(false);
          return;
        }

        await withAuthRedirect(async () => {
          let { user } = await adminClient.auth.me({});
          setUser(user);
          setIsLoading(false);
        });
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  let logout = async () => {
    await adminClient.auth.logout({});
    setUser(null);
    let { authUrl } = await adminClient.auth.getAuthUrl({
      redirectUri: `${window.location.origin}/auth/callback`
    });
    window.location.href = authUrl;
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, isLoading, user, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export let useAuth = () => {
  let ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
