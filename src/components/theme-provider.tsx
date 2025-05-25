
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // The [mounted, setMounted] state and useEffect was used to prevent hydration
  // mismatch by returning null on the server or initial client render.
  // However, next-themes is designed to handle this.
  // The suppressHydrationWarning on the <html> tag in RootLayout is also key.
  // Always rendering the NextThemesProvider should be safe.
  // const [mounted, setMounted] = React.useState(false);
  // React.useEffect(() => setMounted(true), []);

  // if (!mounted) {
  //   return null;
  // }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
