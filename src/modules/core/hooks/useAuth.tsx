/**
 * @fileoverview Optimized authentication context provider.
 */
'use client';

import React, { createContext, useState, useContext, ReactNode, FC, useEffect, useCallback } from "react";
import type { User, Role, Company } from "../types";
import { getCurrentUser, logout as logoutServer } from '../lib/auth-client';
import { getInitialAuthData } from '../lib/auth';
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: User | null;
  userRole: Role | null;
  companyData: Company | null;
  isAuthReady: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const loadAuthData = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setUser(null);
        setIsAuthReady(true);
        if (pathname.startsWith('/dashboard')) router.push('/');
        return;
      }

      // Single server-side call to get everything
      const data = await getInitialAuthData();
      setUser(currentUser);
      setCompanyData(data.companySettings);
      
      const role = data.roles.find((r: Role) => r.id === currentUser.role);
      setUserRole(role || null);
      setIsAuthReady(true);
    } catch (error) {
      console.error("Auth init failed", error);
      setIsAuthReady(true);
    }
  }, [pathname, router]);

  useEffect(() => {
    loadAuthData();
  }, [loadAuthData]);

  const handleLogout = async () => {
    await logoutServer();
    setUser(null);
    setUserRole(null);
    window.location.href = '/';
  };

  if (!isAuthReady && pathname.startsWith('/dashboard')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userRole, companyData, isAuthReady, refreshAuth: loadAuthData, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
