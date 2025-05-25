
import type { Metadata, Viewport } from 'next';
import { GeistSans, GeistMono } from 'geist/font';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppNav } from '@/components/layout/AppNav';
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration';
import { cn } from '@/lib/utils';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Qur'an Meezan",
  description: "Dual-core Quranic reader and AI reflection platform.",
  manifest: '/manifest.json',
  applicationName: "Qur'an Meezan",
  appleWebAppCapable: "yes",
  appleWebAppStatusBarStyle: "default",
  appleWebAppTitle: "Qur'an Meezan",
  formatDetection: { telephone: false },
  mobileWebAppCapable: "yes",
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5DC' },
    { media: '(prefers-color-scheme: dark)', color: '#3A3A3A' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* The <head> tag is automatically managed by Next.js via the metadata export.
          Do not add a <head> tag here manually. */}
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          geistSans.variable,
          geistMono.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ServiceWorkerRegistration />
            <div className="relative flex min-h-screen flex-col">
              <AppHeader />
              <AppNav />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
