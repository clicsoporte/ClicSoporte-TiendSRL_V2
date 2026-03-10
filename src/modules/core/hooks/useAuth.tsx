/**
 * @fileoverview Centralized Authentication and Global State Provider.
 */
'use client';

import React, { createContext, useState, useContext, ReactNode, FC, useEffect, useCallback } from "react";
import type { User, Role, Company, Product, Customer, StockInfo, Exemption, ExemptionLaw } from "../types";
import { getCurrentUser, logout as logoutServer } from '../lib/auth-client';
import { getInitialAuthData } from '../lib/auth';
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: User | null;
  userRole: Role | null;
  companyData: Company | null;
  customers: Customer[];
  products: Product[];
  users: User[];
  stockLevels: StockInfo[];
  allExemptions: Exemption[];
  exemptionLaws: ExemptionLaw[];
  isAuthReady: boolean;
  isLoading: boolean;
  unreadSuggestionsCount: number;
  exchangeRateData: { rate: number | null; date: string | null };
  refreshAuth: () => Promise<void>;
  logout: () => void;
  setCompanyData: (data: Company) => void;
  updateUnreadSuggestionsCount: () => Promise<void>;
  refreshExchangeRate: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stockLevels, setStockLevels] = useState<StockInfo[]>([]);
  const [allExemptions, setAllExemptions] = useState<Exemption[]>([]);
  const [exemptionLaws, setExemptionLaws] = useState<ExemptionLaw[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [unreadSuggestionsCount, setUnreadSuggestionsCount] = useState(0);
  const [exchangeRateData, setExchangeRateData] = useState<{ rate: number | null; date: string | null }>({ rate: null, date: null });
  
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

      const data = await getInitialAuthData();
      setUser(currentUser);
      setCompanyData(data.companySettings);
      setCustomers(data.customers);
      setProducts(data.products);
      setUsers(data.users);
      setStockLevels(data.stock);
      setAllExemptions(data.exemptions);
      setExemptionLaws(data.exemptionLaws);
      setUnreadSuggestionsCount(data.unreadSuggestions);
      setExchangeRateData(data.exchangeRate);
      
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

  const hasPermission = useCallback((permission: string): boolean => {
    if (!userRole) return false;
    if (userRole.id === 'admin') return true;
    return userRole.permissions.includes(permission) || userRole.permissions.includes('admin:all');
  }, [userRole]);

  const contextValue: AuthContextType = {
    user,
    userRole,
    companyData,
    customers,
    products,
    users,
    stockLevels,
    allExemptions,
    exemptionLaws,
    isAuthReady,
    isLoading: !isAuthReady,
    unreadSuggestionsCount,
    exchangeRateData,
    refreshAuth: loadAuthData,
    logout: handleLogout,
    setCompanyData,
    updateUnreadSuggestionsCount: async () => { /* count updates automatically on refreshAuth */ },
    refreshExchangeRate: async () => { /* rate updates automatically on refreshAuth */ },
    hasPermission
  };

  if (!isAuthReady && pathname.startsWith('/dashboard')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
