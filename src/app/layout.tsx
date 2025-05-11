
import type { Metadata, Viewport } from 'next';
import { GeistSans, GeistMono } from 'geist/font';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider
import { AppHeader } from '@/components/layout/AppHeader'; // Import AppHeader
import { AppNav } from '@/components/layout/AppNav'; // Import AppNav
import { cn } from '@/lib/utils';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Qur'an Meezan", // Updated title
  description: "Dual-core Quranic reader and AI reflection platform.", // Updated description
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#F5F5DC', // Updated to Light Beige
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
