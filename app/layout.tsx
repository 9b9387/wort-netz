import type { Metadata } from "next";
import "./globals.css";
import {
  Hanken_Grotesk,
  JetBrains_Mono,
  Newsreader,
} from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600"],
});
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "WortNetz",
  description: "结构化德语词汇追踪与网状知识库",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh"
      className={cn(
        "h-full antialiased",
        "font-sans",
        hankenGrotesk.variable,
        newsreader.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="min-h-svh">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
