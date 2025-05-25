export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: {
    id: string;
    aud: string;
    role: string;
    email: string;
    email_confirmed_at: string;
    phone: string;
    confirmed_at: string;
    last_sign_in_at: string;
    app_metadata: {
      provider: string;
      providers: string[];
    };
    user_metadata: Record<string, unknown>;
    identities: Array<Record<string, unknown>>;
    created_at: string;
    updated_at: string;
  };
}

export interface AuthHeaders {
  Authorization: string;
  'Content-Type': string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  orgId: string | null;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  orgId: string | null;
  login: (email?: string, password?: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}
