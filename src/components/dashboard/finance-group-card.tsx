/**
 * @fileoverview A grouped card for financial tools.
 */
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { financeTools } from "../../modules/core/lib/data";
import { cn } from "../../lib/utils";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { Wallet } from "lucide-react";

export function FinanceGroupCard() {
  const { hasPermission } = useAuthorization();

  const visibleSubTools = financeTools.filter(tool => hasPermission(tool.permission));

  if (visibleSubTools.length === 0) return null;

  return (
    <Card className="h-full border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm">
      <div className="h-1 w-full bg-emerald-600"></div>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Wallet className="h-5 w-5" />
            </div>
            <div>
                <CardTitle className="text-lg">Módulo Financiero</CardTitle>
                <CardDescription className="text-xs">Ventas, costos y facturación</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {visibleSubTools.map((tool) => (
          <Link 
            key={tool.id} 
            href={tool.href} 
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100 group"
          >
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-md shrink-0 transition-transform group-hover:scale-110", tool.bgColor)}>
                <tool.icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-bold truncate group-hover:text-emerald-700">{tool.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
