
import type { Metadata, Viewport } from 'next';
import { GeistSans, GeistMono } from 'geist/font';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider
import { AppHeader } from '@/components/layout/AppHeader'; // Import AppHeader
import { AppNav } from '@/components/layout/AppNav'; // Import AppNav
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration'; // Import the new client component
import { cn } from '@/lib/utils';
import React from 'react'; // useEffect is no longer directly needed here

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Qur'an Meezan", // Updated title
  description: "Dual-core Quranic reader and AI reflection platform.", // Updated description
  manifest: '/manifest.json', // Added manifest link
};

export const viewport: Viewport = {
  themeColor: '#F5F5DC', // From manifest.json, light beige
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Standard PWA meta tags - some are covered by Next.js metadata/viewport */}
        <meta name="application-name" content="Qur'an Meezan" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Qur'an Meezan" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" /> {/* Optional: if you create this file */}
        <meta name="msapplication-TileColor" content="#F5F5DC" />
        <meta name="msapplication-tap-highlight" content="no" />
        {/* Link to icons for older browsers/platforms if needed */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

      </head>
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
            <ServiceWorkerRegistration /> {/* Use the client component */}
            <div className="relative flex min-h-screen flex-col">
              <AppHeader /> {/* Add AppHeader */}
              <AppNav /> {/* Add AppNav */}
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
