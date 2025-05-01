'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Notebook } from 'lucide-react';

interface NotesSidebarProps {
  currentVerseNumber: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// Updated NotesSidebar to be controlled externally
export function NotesSidebar({ currentVerseNumber, isOpen, onOpenChange }: NotesSidebarProps) {
  return (
     <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
         <Button variant="outline" size="icon" aria-label="Open Notes">
            <Notebook className="h-5 w-5" />
          </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notes for Verse {currentVerseNumber}</SheetTitle>
          <SheetDescription>
            Manage your notes and tags for this verse. (Feature coming soon!)
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          {/* Placeholder content */}
          <p className="text-muted-foreground text-sm">Note-taking functionality will be added here.</p>
          {/* Add form for new notes, display existing notes, tag management etc. */}
        </div>
      </SheetContent>
    </Sheet>
  );
}