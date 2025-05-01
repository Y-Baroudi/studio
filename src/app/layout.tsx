
import type { Metadata, Viewport } from 'next';
import { GeistSans, GeistMono } from 'geist/font'; // Correct import names
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';

// Using Geist Sans and Mono
const geistSans = GeistSans; // Use the correctly imported variable
const geistMono = GeistMono; // Use the correctly imported variable

export const metadata: Metadata = {
  title: 'Quran Companion',
  description: 'Your personal Quran reading companion.',
  manifest: '/manifest.json', // PWA Manifest
};

export const viewport: Viewport = {
  themeColor: '#FAFAFA', // Updated PWA theme color to soft white
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
       {/* Apply font variables directly to html or body */}
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased", // Use font-sans from tailwind default
          geistSans.variable, // Add Geist Sans variable
          geistMono.variable   // Add Geist Mono variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

// Helper function for conditional classes (already exists in lib/utils)
import { cn } from '@/lib/utils';
