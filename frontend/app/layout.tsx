import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { ThemeProvider } from "@/components/theme-provider";
import { SpeedInsights } from "@vercel/speed-insights/next"

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
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased h-screen bg-gradient-to-br from-slate-100 via-purple-50 to-slate-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 transition-colors duration-300`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* ✅ Wrap whole app with AuthProvider */}
            <div className="h-full flex flex-col">
              {children}
              <SpeedInsights/>
            </div>
        </ThemeProvider>
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}