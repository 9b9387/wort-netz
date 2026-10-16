import Link from "next/link";
import { Suspense } from "react";
import { NetworkIcon } from "lucide-react";
import { AiAssistantWorkspace } from "@/components/ai-assistant-workspace";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { UserNav } from "@/components/user-nav";
import { getDictionary } from "@/lib/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = getDictionary("zh");

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/dashboard" />}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <NetworkIcon />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{t.appName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t.tagline}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t.dashboard}</SidebarGroupLabel>
            <SidebarGroupContent>
              <Suspense fallback={<SidebarNavFallback />}>
                <AppSidebarNav
                  labels={{
                    dashboard: t.dashboard,
                    wordBook: t.wordBook,
                    reader: t.reader,
                    review: t.review,
                    aiSettings: t.aiSettings,
                  }}
                />
              </Suspense>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="ml-auto flex items-center gap-2">
            <Suspense fallback={<Skeleton className="h-8 w-36" />}>
              <UserNav />
            </Suspense>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6 md:p-8">
            {children}
          </div>
          <Suspense fallback={null}>
            <AiAssistantWorkspace />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SidebarNavFallback() {
  return (
    <SidebarMenu>
      {[0, 1, 2, 3, 4].map((index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuButton disabled>
            <Skeleton className="size-4" />
            <Skeleton className="h-4 w-20" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
