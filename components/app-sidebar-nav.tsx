"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenTextIcon,
  LibraryIcon,
  LayoutDashboardIcon,
  RepeatIcon,
  SettingsIcon,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebarNav({
  labels,
}: {
  labels: {
    dashboard: string;
    wordBook: string;
    reader: string;
    review: string;
    aiSettings: string;
  };
}) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: labels.dashboard, icon: LayoutDashboardIcon },
    { href: "/words", label: labels.wordBook, icon: LibraryIcon },
    { href: "/reader", label: labels.reader, icon: BookOpenTextIcon },
    { href: "/review", label: labels.review, icon: RepeatIcon },
    { href: "/settings/ai", label: labels.aiSettings, icon: SettingsIcon },
  ];

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              isActive={isActive}
            >
              <Icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
