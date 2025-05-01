import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { BookOpen } from 'lucide-react'; // Keep existing icon

// Enhanced Header Component
export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 max-w-screen-2xl items-center"> {/* Increased height */}
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
             <BookOpen className="h-7 w-7 text-primary" /> {/* Slightly larger icon */}
            <span className="text-lg font-bold sm:inline-block"> {/* Larger title */}
              Quran Companion
            </span>
          </Link>
          {/* Optional Nav Links can go here */}
          {/* <nav className="flex items-center gap-6 text-sm">
             <Link href="/about" className="transition-colors hover:text-foreground/80 text-foreground/60">About</Link>
           </nav> */}
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2"> {/* Adjusted spacing */}
             {/* Actions like Login/User button could go here */}
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
