
import type { Metadata, Viewport } from 'next';
import { GeistSans, GeistMono } from 'geist/font';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider
import { AppHeader } from '@/components/layout/AppHeader';
import { AppNav } from '@/components/layout/AppNav';
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration';
import { cn } from '@/lib/utils';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Qur'an Meezan",
  description: "Dual-core Quranic reader and AI reflection platform.",
  manifest: '/manifest.json', // For PWA
  applicationName: "Qur'an Meezan",
  appleWebAppCapable: "yes",
  appleWebAppStatusBarStyle: "default",
  appleWebAppTitle: "Qur'an Meezan",
  formatDetection: { telephone: false },
  mobileWebAppCapable: "yes",
  icons: {
    apple: "/icons/icon-192x192.png", // Example for apple-touch-icon
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5DC' }, // Light Beige
    { media: '(prefers-color-scheme: dark)', color: '#3A3A3A' }, // Darker, less saturated Beige
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          <AuthProvider> {/* Wrap with AuthProvider */}
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
