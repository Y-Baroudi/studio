
'use client'; // Needs to be a client component to use state and interact with dropdowns

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { BookOpen, Menu, Search, Tags, Loader2, ChevronDown } from 'lucide-react'; // Import new icons
import { Button } from '@/components/ui/button'; // Import Button
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'; // Import Sheet for drawer
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'; // Import Dropdown for Surah selection
import type { QuranMeta, SurahMeta } from '@/services/alquran-cloud'; // Import types
import { surahAyahToAbsoluteVerse } from '@/services/alquran-cloud'; // Import helper function
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea for long dropdown list

interface HeaderProps {
  quranMeta: QuranMeta | null;
  navigateToVerse: (absoluteVerseNum: number, scroll?: boolean, immediateScroll?: boolean) => void;
  isLoading: boolean; // Pass general loading state
}

// Function to get the starting verse number for a surah
const getSurahStartVerse = (surahNumber: number, meta: QuranMeta | null): number | null => {
   return surahAyahToAbsoluteVerse(surahNumber, 1, meta);
};


// Enhanced Header Component accepting props
export function Header({ quranMeta, navigateToVerse, isLoading }: HeaderProps) {
   const [isDrawerOpen, setIsDrawerOpen] = useState(false);
   const [isDropdownOpen, setIsDropdownOpen] = useState(false);

   const handleSurahSelect = (surah: SurahMeta) => {
       const startVerse = getSurahStartVerse(surah.number, quranMeta);
       if (startVerse) {
          navigateToVerse(startVerse, true, true); // Navigate immediately
          setIsDrawerOpen(false); // Close drawer if open
          setIsDropdownOpen(false); // Close dropdown if open
       }
   };

   const surahListItems = quranMeta?.surahs.references.map(surah => (
       <DropdownMenuItem
           key={surah.number}
           onSelect={() => handleSurahSelect(surah)}
           className="flex justify-between items-center cursor-pointer"
       >
           <span>{surah.number}. {surah.englishName}</span>
           <span className="text-sm text-muted-foreground" lang="ar" dir="rtl">{surah.name}</span>
       </DropdownMenuItem>
   ));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between"> {/* Use justify-between */}

        {/* Left Section: Drawer Menu & Title */}
        <div className="flex items-center gap-2">
           {/* Drawer Menu Trigger */}
           <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden"> {/* Show only on mobile */}
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80vw] sm:w-[300px]"> {/* Adjust width */}
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>
                   Select a Surah or explore options.
                </SheetDescription>
              </SheetHeader>
               {/* Drawer Navigation */}
               <nav className="flex flex-col gap-2 py-4">
                   {/* Surah Selection Dropdown in Drawer */}
                   <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                      <DropdownMenuTrigger asChild>
                         <Button
                            variant="outline"
                            className="w-full justify-between" // Use justify-between for arrow
                            disabled={isLoading || !quranMeta}
                         >
                            {isLoading ? ( <> <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading... </> ) : "Select Surah"}
                           <ChevronDown className="h-4 w-4 opacity-50" />
                         </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"> {/* Match trigger width */}
                         <DropdownMenuLabel>Select Surah</DropdownMenuLabel>
                         <DropdownMenuSeparator />
                         {isLoading ? (
                            <DropdownMenuItem disabled> <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading Surahs... </DropdownMenuItem>
                         ) : quranMeta && surahListItems && surahListItems.length > 0 ? (
                             <ScrollArea className="h-[60vh] w-full"> {/* Make list scrollable */}
                                 {surahListItems}
                              </ScrollArea>
                         ) : (
                            <DropdownMenuItem disabled>No Surahs available</DropdownMenuItem>
                         )}
                      </DropdownMenuContent>
                   </DropdownMenu>
                  {/* Other drawer links - TODO: Implement functionality */}
                   <Button variant="ghost" className="justify-start" disabled><Search className="mr-2 h-4 w-4" />Search (Soon)</Button>
                   <Button variant="ghost" className="justify-start" disabled><Tags className="mr-2 h-4 w-4" />Concepts (Soon)</Button>
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

         {/* Center Section: Surah Selection on Desktop */}
         <div className="hidden md:flex items-center gap-4">
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
             <DropdownMenuTrigger asChild>
                <Button
                   variant="outline"
                   size="sm"
                   disabled={isLoading || !quranMeta}
                   className="min-w-[150px] justify-between" // Ensure enough width and space for arrow
                >
                   {isLoading ? ( <> <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading... </> ) : "Select Surah"}
                   <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"> {/* Match trigger width */}
               <DropdownMenuLabel>Select Surah</DropdownMenuLabel>
               <DropdownMenuSeparator />
               {isLoading ? (
                  <DropdownMenuItem disabled> <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading Surahs... </DropdownMenuItem>
               ) : quranMeta && surahListItems && surahListItems.length > 0 ? (
                   <ScrollArea className="h-[60vh] w-full"> {/* Make list scrollable */}
                      {surahListItems}
                   </ScrollArea>
               ) : (
                  <DropdownMenuItem disabled>No Surahs available</DropdownMenuItem>
               )}
             </DropdownMenuContent>
           </DropdownMenu>
         </div>


        {/* Right Section: Icons & Theme Toggle */}
        <div className="flex items-center gap-2">
           {/* Search Icon - TODO: Implement functionality */}
           <Button variant="ghost" size="icon" aria-label="Search" disabled>
            <Search className="h-5 w-5" />
          </Button>

           {/* Concept/Tag Browsing Icon - TODO: Implement functionality */}
           <Button variant="ghost" size="icon" aria-label="Browse Concepts/Tags" disabled>
            <Tags className="h-5 w-5" />
          </Button>

           {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
