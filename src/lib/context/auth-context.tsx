"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Organization } from "@/types";
import { getMeApi, getMyOrgApi, loginApi, logoutApi, registerApi, RegisterPayload } from "../api/auth";

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  setAuthSession: (user: User, organization: Organization) => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshAuth = async () => {
    try {
      const me = await getMeApi();
      setUser(me);
      const org = await getMyOrgApi();
      setOrganization(org);
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setOrganization(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const setAuthSession = (u: User, o: Organization) => {
    setUser(u);
    setOrganization(o);
    setIsAuthenticated(true);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await loginApi({ email, password });
      setUser(res.user);
      setOrganization(res.organization);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await registerApi(payload);
      setUser(res.user);
      setOrganization(res.organization);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutApi();
    } catch {
      // ignore network errors on logout
    } finally {
      setUser(null);
      setOrganization(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        setAuthSession,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
