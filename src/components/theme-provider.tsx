'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Ensure the component only runs on the client
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Render nothing or a placeholder on the server
    // to avoid hydration mismatch caused by system theme detection
    return null;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
