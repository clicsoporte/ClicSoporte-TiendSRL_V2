/**
 * @fileoverview Centralized Authentication and Global State Provider.
 */
'use client';

import React, { createContext, useState, useContext, ReactNode, FC, useEffect, useCallback } from "react";
import type { User, Role, Company, Product, Customer, StockInfo, Exemption, ExemptionLaw, Notification } from "../types";
import { getCurrentUser, logout as logoutServer } from '../lib/auth-client';
import { getInitialAuthData } from '../lib/auth';
import { getNotifications, markNotificationsAsRead } from "@/modules/notifications/lib/db";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { checkPermissionInTree } from "../lib/permissions";

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
  notifications: Notification[];
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
  markAsRead: (ids: (number|string)[]) => Promise<void>;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

      const [data, notifs] = await Promise.all([
          getInitialAuthData(),
          getNotifications(currentUser.id)
      ]);

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
      setNotifications(notifs);
      
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

  // Periodic Refresh for notifications
  useEffect(() => {
      if (user && isAuthReady) {
          const interval = setInterval(() => {
              getNotifications(user.id).then(setNotifications);
          }, 30000);
          return () => clearInterval(interval);
      }
  }, [user, isAuthReady]);

  const handleLogout = async () => {
    await logoutServer();
    setUser(null);
    setUserRole(null);
    window.location.href = '/';
  };

  const hasPermission = useCallback((permission: string): boolean => {
    if (!userRole) return false;
    return checkPermissionInTree(userRole.permissions, permission);
  }, [userRole]);

  const markAsRead = async (ids: (number|string)[]) => {
      if (!user) return;
      const numericIds = ids.filter(id => typeof id === 'number') as number[];
      if (numericIds.length > 0) {
          await markNotificationsAsRead(numericIds, user.id);
      }
      // Optimistic UI update
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, isRead: 1 as const } : n));
  };

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
    notifications,
    isAuthReady,
    isLoading: !isAuthReady,
    unreadSuggestionsCount,
    exchangeRateData,
    refreshAuth: loadAuthData,
    logout: handleLogout,
    setCompanyData,
    updateUnreadSuggestionsCount: async () => { /* count updates automatically on refreshAuth */ },
    refreshExchangeRate: async () => { /* rate updates automatically on refreshAuth */ },
    hasPermission,
    markAsRead
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
