import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "WortNetz",
  description: "结构化德语词汇追踪与网状知识库",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-svh">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
