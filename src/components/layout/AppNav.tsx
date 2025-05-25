
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BookOpen, MessageSquare } from 'lucide-react'; // Icons for links

const navItems = [
  { href: '/reader', label: 'Quran Reader', icon: <BookOpen className="mr-2 h-4 w-4" /> },
  { href: '/conversation', label: 'AI Conversations', icon: <MessageSquare className="mr-2 h-4 w-4" /> },
];

export function AppNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder or null on the server and initial client render
    // to avoid hydration mismatch due to pathname potentially differing.
    // A placeholder div can maintain structure if needed.
    return <nav className="border-b bg-background h-12"></nav>; // Placeholder with same height
  }

  return (
    <nav className="border-b bg-background">
      <div className="container flex h-12 max-w-screen-2xl items-center justify-center gap-4 px-4 md:px-6">
        {navItems.map((item) => (
          <Button
            key={item.href}
            variant={pathname === item.href ? 'secondary' : 'ghost'}
            size="sm"
            asChild
          >
            <Link href={item.href} className="flex items-center">
              {item.icon}
              {item.label}
            </Link>
          </Button>
        ))}
      </div>
    </nav>
  );
}
