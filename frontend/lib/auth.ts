import { AuthTokenResponse, AuthHeaders } from "@/types/auth";

const SUPABASE_AUTH_URL = process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL || "https://sb.stack-ai.com";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const AUTH_TOKEN_KEY = "stack_ai_auth_token";
const AUTH_EXPIRY_KEY = "stack_ai_auth_expiry"
const DEFAULT_EMAIL = process.env.NEXT_PUBLIC_DEFAULT_EMAIL;
const DEFAULT_PASSWORD = process.env.NEXT_PUBLIC_DEFAULT_PASSWORD;

export async function getAuthToken(
  email: string = DEFAULT_EMAIL || "",
  password: string = DEFAULT_PASSWORD || ""
): Promise<string> {
  try {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
      
      if (storedToken && expiry && Date.now() < parseInt(expiry, 10)) {
        return storedToken;
      }
    }

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const response = await fetch(`${SUPABASE_AUTH_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Apikey': ANON_KEY || "",
      },
      body: JSON.stringify({
        email,
        password,
        gotrue_meta_security: {},
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json() as AuthTokenResponse;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
      const expiryTime = Date.now() + (data.expires_in * 1000) - 300000;
      localStorage.setItem(AUTH_EXPIRY_KEY, expiryTime.toString());
    }
    
    return data.access_token;
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
}

export async function getAuthHeaders(): Promise<AuthHeaders> {
  const token = await getAuthToken();
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
  
  return !!token && !!expiry && Date.now() < parseInt(expiry, 10);
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRY_KEY);
  }
}
