// src/components/quran/ConceptExplorer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getAllConcepts, getVersesForConcept, type Concept } from '@/services/concepts'; // Import concept service functions and types
import { Loader2, X } from 'lucide-react';

interface ConceptExplorerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onVerseNavigate: (surah: number, verse: number) => void;
}

interface VerseReference {
  surahNumber: number;
  ayahNumberInSurah: number;
  absoluteVerseNumber: number;
}

export function ConceptExplorer({ isOpen, onOpenChange, onVerseNavigate }: ConceptExplorerProps) {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [relatedVerses, setRelatedVerses] = useState<VerseReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Load concepts when the explorer opens
      const loadedConcepts = getAllConcepts();
      setConcepts(loadedConcepts);
      setSelectedConcept(null); // Reset selection when opening
      setRelatedVerses([]);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleConceptSelect = (concept: Concept) => {
    setSelectedConcept(concept);
    // Fetch verses related to the selected concept
    const verses = getVersesForConcept(concept.id);
    setRelatedVerses(verses);
  };

  const handleVerseClick = (surah: number, verse: number) => {
    onVerseNavigate(surah, verse);
    onOpenChange(false); // Close explorer after navigation
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-[90vw] flex flex-col p-0" side="bottom">
        <SheetHeader className="p-4 border-b flex flex-row justify-between items-center">
          <div className="flex flex-col">
             <SheetTitle className="text-lg font-semibold">Concept Explorer</SheetTitle>
             <SheetDescription className="text-xs">Browse concepts and related verses.</SheetDescription>
          </div>
          <SheetClose asChild>
             <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close Concept Explorer">
               <X className="h-4 w-4" />
             </Button>
          </SheetClose>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Concept List */}
          <ScrollArea className="w-1/3 border-r p-4 overflow-y-auto">
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Concepts</h4>
            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : concepts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center">No concepts found.</p>
            ) : (
              <div className="space-y-2">
                {concepts.map((concept) => (
                  <Button
                    key={concept.id}
                    variant={selectedConcept?.id === concept.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start text-left h-auto py-1.5 px-2"
                    onClick={() => handleConceptSelect(concept)}
                  >
                    <div className='flex items-center gap-2'>
                         <span
                             className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                             style={{ backgroundColor: concept.color || '#ccc' }}
                             title={concept.name}
                         ></span>
                         <span className="text-sm truncate">{concept.name}</span>
                     </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Right Panel: Concept Details and Verses */}
          <ScrollArea className="w-2/3 p-4 overflow-y-auto">
            {selectedConcept ? (
              <>
                <div className='flex items-center gap-2 mb-1'>
                   <span
                       className="inline-block h-4 w-4 rounded-full flex-shrink-0"
                       style={{ backgroundColor: selectedConcept.color || '#ccc' }}
                   ></span>
                   <h3 className="text-base font-semibold">{selectedConcept.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{selectedConcept.description}</p>

                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Connected Verses ({relatedVerses.length})</h4>
                {relatedVerses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No verses connected to this concept yet.</p>
                ) : (
                  <div className="space-y-2">
                    {relatedVerses.map((verseRef) => (
                      <Button
                        key={`${verseRef.surahNumber}:${verseRef.ayahNumberInSurah}`}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left h-auto py-1.5 px-2 text-xs"
                        onClick={() => handleVerseClick(verseRef.surahNumber, verseRef.ayahNumberInSurah)}
                      >
                        Surah {verseRef.surahNumber}, Verse {verseRef.ayahNumberInSurah}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Select a concept to see details.</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
