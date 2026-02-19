import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import NavbarLayout from "@/components/layout/NavbarLayout";
import PageTransition from "@/components/layout/PageTransition";
import { LogoutProvider } from "@/context/LogoutContext";
import LogoutOverlay from "@/components/layout/LogoutOverlay";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "CodeGuard – Secure Python Editor",
  description: "Proctor-based Python editor with login and violation tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 dark:from-slate-950 dark:via-purple-950/30 dark:to-blue-950/30 transition-colors duration-300`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LogoutProvider>
            <LogoutOverlay />
            {/* ✅ Navbar in layout - persists across page navigations */}
            <NavbarLayout />
            <PageTransition>
              <div className="h-full flex flex-col">
                {children}
                <SpeedInsights />
              </div>
            </PageTransition>
          </LogoutProvider>
        </ThemeProvider>
        <Toaster richColors position="top-center" />
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
