import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearSession,
  getStoredRoles,
  getStoredUsername,
  getToken,
  setSession,
  type LoginResponseDto,
} from '@/config/api';

type AuthUser = { username: string; roles: string[] };

function readUserFromStorage(): AuthUser | null {
  const t = getToken();
  const u = getStoredUsername();
  if (!t || !u) return null;
  return { username: u, roles: getStoredRoles() };
}

type AuthContextValue = {
  user: AuthUser | null;
  isAdmin: boolean;
  login: (dto: LoginResponseDto) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readUserFromStorage());

  const login = useCallback((dto: LoginResponseDto) => {
    setSession(dto);
    setUser({ username: dto.username, roles: dto.roles });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const isAdmin = useMemo(() => user?.roles.some((r) => r === 'ADMIN') ?? false, [user]);

  const value = useMemo(
    () => ({ user, isAdmin, login, logout }),
    [user, isAdmin, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- useAuth is the companion API to AuthProvider
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
