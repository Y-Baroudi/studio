import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { BookOpen, Menu, Search, Tags } from 'lucide-react'; // Import new icons
import { Button } from '@/components/ui/button'; // Import Button
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'; // Import Sheet for drawer
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'; // Import Dropdown for Surah selection placeholder

// Enhanced Header Component
export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between"> {/* Use justify-between */}

        {/* Left Section: Drawer Menu & Title */}
        <div className="flex items-center gap-2">
           {/* Drawer Menu Trigger */}
           <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden"> {/* Show only on mobile */}
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>
                  Select a Surah or explore concepts. (Drawer content placeholder)
                </SheetDescription>
              </SheetHeader>
              {/* Add actual drawer navigation links here */}
               <nav className="flex flex-col gap-4 py-4">
                 {/* Placeholder for Surah Selection in Drawer */}
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="outline" className="w-full justify-start">Select Surah</Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent>
                     <DropdownMenuLabel>Select Surah</DropdownMenuLabel>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem disabled>Loading Surahs...</DropdownMenuItem>
                     {/* Surah list will be populated here */}
                   </DropdownMenuContent>
                 </DropdownMenu>
                  {/* Other drawer links */}
                  <Button variant="ghost" className="justify-start">Search</Button>
                  <Button variant="ghost" className="justify-start">Concepts/Tags</Button>
               </nav>
            </SheetContent>
          </Sheet>

           {/* App Title/Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <BookOpen className="h-7 w-7 text-primary" />
            <span className="text-lg font-bold sm:inline-block">
              Qu'ran Meezan
            </span>
          </Link>
        </div>

         {/* Center Section (Optional): Placeholder for Surah Selection on Desktop */}
         <div className="hidden md:flex items-center gap-4">
             {/* Surah Selection Dropdown Placeholder */}
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button variant="outline" size="sm">Select Surah</Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent>
               <DropdownMenuLabel>Select Surah</DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem disabled>Loading Surahs...</DropdownMenuItem>
               {/* Surah list will be populated here */}
             </DropdownMenuContent>
           </DropdownMenu>
         </div>


        {/* Right Section: Icons & Theme Toggle */}
        <div className="flex items-center gap-2">
           {/* Search Icon */}
           <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>

           {/* Concept/Tag Browsing Icon */}
           <Button variant="ghost" size="icon" aria-label="Browse Concepts/Tags">
            <Tags className="h-5 w-5" />
          </Button>

           {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
