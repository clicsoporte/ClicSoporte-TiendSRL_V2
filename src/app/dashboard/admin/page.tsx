/**
 * @fileoverview The main dashboard page for the admin section.
 * Enhanced visibility logic to handle specific module permissions.
 */
'use client';
import { adminTools } from "@/modules/admin/lib/data";
import { ToolCard } from "../../../components/dashboard/tool-card";
import { useEffect, useCallback } from "react";
import { usePageTitle } from "../../../modules/core/hooks/usePageTitle";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/modules/core/hooks/useAuth";
import type { Tool } from "@/modules/core/types";

export default function AdminDashboardPage() {
    const { setTitle } = usePageTitle();
    const { hasPermission } = useAuthorization();
    const { unreadSuggestionsCount, userRole } = useAuth();

    useEffect(() => {
        setTitle("Administración");
    }, [setTitle]);

    // Authorized if has any admin permission or is super admin
    const isAuthorized = userRole?.permissions.some(p => p.startsWith('admin:')) || userRole?.id === 'admin';

    const isToolVisible = useCallback((tool: Tool) => {
        switch (tool.id) {
            case 'user-management':
            case 'role-management':
                return hasPermission('users:read') || hasPermission('roles:read');
            case 'general-settings':
                return hasPermission('admin:settings:general');
            case 'suggestions-viewer':
                return hasPermission('admin:suggestions:read');
            case 'quoter-settings':
                return hasPermission('admin:settings:general');
            case 'import-data':
                return hasPermission('admin:import:run') || hasPermission('admin:import:files') || hasPermission('admin:import:sql');
            case 'maintenance':
                return hasPermission('admin:maintenance:backup') || hasPermission('admin:maintenance:restore') || hasPermission('admin:maintenance:reset');
            case 'api-settings':
                return hasPermission('admin:settings:api');
            case 'planner-settings':
                return hasPermission('admin:settings:planner');
            case 'stock-settings':
                return hasPermission('admin:settings:stock');
            case 'tickets-settings':
                return hasPermission('tickets:admin:settings');
            case 'licenses-settings':
                return hasPermission('licenses:admin:keys');
            case 'log-viewer':
                return hasPermission('admin:logs:read');
            case 'provider-management':
                return hasPermission('tickets:admin:settings');
            case 'marketing-center':
                return hasPermission('admin:marketing:manage');
            default:
                return true;
        }
    }, [hasPermission]);

    if (!userRole) {
        return (
             <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="grid gap-8">
                <div>
                    <Skeleton className="h-8 w-80 mb-4" />
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    </div>
                </div>
                </div>
            </main>
        );
    }

    if (!isAuthorized) {
        return (
            <main className="flex-1 p-10 text-center">
                <p className="text-muted-foreground">No tienes permisos para acceder a las herramientas administrativas.</p>
            </main>
        );
    }
    
    const visibleAdminTools = adminTools.filter(isToolVisible);

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Centro de Administración
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-6">
              {visibleAdminTools.map((tool: Tool) => {
                const isSuggestionsTool = tool.id === "suggestions-viewer";
                const badgeCount = isSuggestionsTool ? unreadSuggestionsCount : 0;
                return <ToolCard key={tool.id} tool={tool} badgeCount={badgeCount}/>
              })}
            </div>
          </div>
        </div>
      </main>
  );
}
