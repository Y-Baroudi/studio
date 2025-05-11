
import Link from 'next/link';
import React from 'react';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { BookText } from 'lucide-react'; // Using a relevant icon

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Qur'an Meezan Home">
          <BookText className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold">
            Qur'an Meezan <span lang="ar" dir="rtl">(ميزان القرآن)</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
