
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
import React from 'react';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Qur'an Meezan",
  description: "Dual-core Quranic reader and AI reflection platform.",
  manifest: '/manifest.json',
  // PWA meta tags moved here
  applicationName: "Qur'an Meezan",
  appleWebAppCapable: "yes",
  appleWebAppStatusBarStyle: "default", // Or 'black-translucent' or 'black'
  appleWebAppTitle: "Qur'an Meezan",
  formatDetection: { telephone: false },
  mobileWebAppCapable: "yes",
  msapplicationTileColor: "#F5F5DC", // Light Beige
  msapplicationTapHighlight: "no",
  icons: {
    apple: "/icons/icon-192x192.png", // Example for apple-touch-icon
    // You can add other icon sizes/types here if needed, e.g.,
    // icon: [
    //   { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    //   { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
    // ],
    // shortcut: '/icons/favicon.ico', // For favicon
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5DC' }, // Light Beige for light theme
    { media: '(prefers-color-scheme: dark)', color: '#3A3A3A' }, // A darker beige/gray for dark theme
  ],
  // You can add other viewport properties here, like width, initialScale, etc.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        The <head> tag is no longer explicitly rendered here.
        Next.js automatically generates the <head> content based on:
        1. The `metadata` and `viewport` exports from this file.
        2. Metadata exports from child layouts and pages.
        3. Default Next.js head elements (like scripts, styles).
        This approach is idiomatic for the App Router and helps avoid hydration errors.
      */}
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
