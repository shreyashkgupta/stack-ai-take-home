"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuthToken, isAuthenticated, logout } from '@/lib/auth';
import { AuthContextType } from '@/types/auth';
import { getCurrentOrgId } from '@/lib/api';
import { toast } from "sonner";

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  orgId: null,
  login: async () => {},
  logout: () => {},
  error: null,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState({
    isAuthenticated: false,
    isLoading: true,
    orgId: null as string | null,
    error: null as string | null,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (isAuthenticated()) {
          // Get organization ID if authenticated
          const orgId = await getCurrentOrgId();
          
          setState({
            isAuthenticated: true,
            isLoading: false,
            orgId,
            error: null,
          });
        } else {
          setState({
            isAuthenticated: false,
            isLoading: false,
            orgId: null,
            error: null,
          });
        }
      } catch (error) {
        console.error("Auth check error:", error);
        
        setState({
          isAuthenticated: false,
          isLoading: false,
          orgId: null,
          error: "Failed to verify authentication status",
        });
      }
    };

    checkAuth();
  }, []);

  const login = async (email?: string, password?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await getAuthToken(email, password);
      const orgId = await getCurrentOrgId();
      
      setState({
        isAuthenticated: true,
        isLoading: false,
        orgId,
        error: null,
      });
      
      toast.success("Authentication successful");
    } catch (error) {
      console.error("Login error:", error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Login failed. Please check your credentials.",
      }));
      
      toast.error("Authentication failed");
    }
  };

  const handleLogout = () => {
    logout();
    
    setState({
      isAuthenticated: false,
      isLoading: false,
      orgId: null,
      error: null,
    });
    
    toast.success("Logged out successfully");
  };

  const value = {
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    orgId: state.orgId,
    login,
    logout: handleLogout,
    error: state.error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
