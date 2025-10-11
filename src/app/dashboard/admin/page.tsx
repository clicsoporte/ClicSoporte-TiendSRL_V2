
/**
 * @fileoverview The main dashboard page for the admin section.
 * It dynamically displays a grid of available administration tools.
 */
'use client';
import { adminTools } from "@/modules/admin/lib/data";
import { ToolCard } from "../../../components/dashboard/tool-card";
import { useEffect } from "react";
import { usePageTitle } from "../../../modules/core/hooks/usePageTitle";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/modules/core/hooks/useAuth";
import type { Tool } from "@/modules/core/types";

export default function AdminDashboardPage() {
    const { setTitle } = usePageTitle();
    const { hasPermission } = useAuthorization(['admin:settings:general']); // Broad permission for admin access
    const { unreadSuggestionsCount } = useAuth();

    useEffect(() => {
        setTitle("Administración");
    }, [setTitle]);

    const isAuthorized = hasPermission('admin:settings:general'); // Example check

    if (isAuthorized === false) {
        return null; // Or a more specific "Access Denied" component
    }

    if (isAuthorized === null) {
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
    
    // Filter tools based on user permissions
    const visibleAdminTools = adminTools.filter((tool: Tool) => {
        // A tool might require one of several permissions to be visible
        switch (tool.id) {
            case 'user-management':
            case 'role-management':
                return hasPermission('users:read') || hasPermission('roles:read');
            case 'general-settings':
                return hasPermission('admin:settings:general');
            case 'suggestions-viewer':
                return hasPermission('admin:suggestions:read');
            case 'quoter-settings':
                return hasPermission('admin:settings:general'); // Typically linked
            case 'import-data':
                return hasPermission('admin:import:run') || hasPermission('admin:import:files') || hasPermission('admin:import:sql');
            case 'maintenance':
                return hasPermission('admin:maintenance:backup') || hasPermission('admin:maintenance:restore') || hasPermission('admin:maintenance:reset');
            case 'api-settings':
                return hasPermission('admin:settings:api');
            case 'planner-settings':
                return hasPermission('admin:settings:planner');
            case 'requests-settings':
                return hasPermission('admin:settings:requests');
            case 'warehouse-settings':
                return hasPermission('admin:settings:warehouse');
            case 'stock-settings':
                return hasPermission('admin:settings:stock');
            case 'tickets-settings':
                return hasPermission('tickets:admin:settings');
            case 'licenses-settings':
                return hasPermission('licenses:admin:keys');
            case 'log-viewer':
                return hasPermission('admin:logs:read');
            default:
                return true; // Show by default if no specific permission is needed
        }
    });

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Centro de Administración
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
