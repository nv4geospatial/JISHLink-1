import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export interface EmployeeProfile {
  id: string;
  employee_code: string;
  name: string;
  mobile: string;
  email?: string | null;
  site_id?: string | null;
  client_id?: string | null;
  shift_id?: string | null;
  status: "active" | "inactive";
  photo_url?: string | null;
}

interface AuthState {
  token: string | null;
  employee: EmployeeProfile | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  setAuth: (token: string, employee: EmployeeProfile) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  employee: null,
  isLoading: true,
  setAuth: () => {},
  clearAuth: () => {},
});

const TOKEN_KEY = "jishlink_employee_token";
const EMPLOYEE_KEY = "jishlink_employee";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    employee: null,
    isLoading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const employeeRaw = localStorage.getItem(EMPLOYEE_KEY);
    if (token && employeeRaw) {
      try {
        setState({
          token,
          employee: JSON.parse(employeeRaw),
          isLoading: false,
        });
        return;
      } catch {
        // corrupted storage
      }
    }
    setState((s) => ({ ...s, isLoading: false }));
  }, []);

  const setAuth = useCallback(
    (token: string, employee: EmployeeProfile) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(employee));
      setState({ token, employee, isLoading: false });
    },
    [],
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMPLOYEE_KEY);
    setState({ token: null, employee: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
