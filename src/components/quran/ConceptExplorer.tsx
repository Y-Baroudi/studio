// src/components/quran/ConceptExplorer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Loader2, Tags, X } from 'lucide-react';
import { getAllConcepts, getVersesForConcept, type Concept } from '@/services/concepts'; // Ensure types are imported

interface ConceptExplorerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onVerseNavigate: (surah: number, verse: number) => void; // Callback to navigate to a verse
}

export function ConceptExplorer({ isOpen, onOpenChange, onVerseNavigate }: ConceptExplorerProps) {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [connectedVerses, setConnectedVerses] = useState<{ surahNumber: number; ayahNumberInSurah: number; absoluteVerseNumber: number }[]>([]);
  const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);
  const [isLoadingVerses, setIsLoadingVerses] = useState(false);

  // Load all concepts when the explorer opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingConcepts(true);
      const allConcepts = getAllConcepts(); // Fetch concepts from service
      setConcepts(allConcepts);
      setIsLoadingConcepts(false);
      // Reset selected concept when opening
      setSelectedConcept(null);
      setConnectedVerses([]);
    }
  }, [isOpen]);

  // Load verses when a concept is selected
  useEffect(() => {
    if (selectedConcept) {
      setIsLoadingVerses(true);
      const verses = getVersesForConcept(selectedConcept.id);
      setConnectedVerses(verses);
      setIsLoadingVerses(false);
    } else {
      setConnectedVerses([]); // Clear verses if no concept is selected
    }
  }, [selectedConcept]);

  const handleConceptSelect = (concept: Concept) => {
    setSelectedConcept(concept);
  };

  const handleVerseClick = (surah: number, verse: number) => {
    onVerseNavigate(surah, verse);
    // Optionally close the explorer after navigation
    // onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw] sm:w-[500px] flex flex-col p-0" side="left">
        <SheetHeader className="p-4 border-b flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            <SheetTitle>Concept Explorer</SheetTitle>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close Concept Explorer">
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
          {/* Concept List (Left Pane or Top on Mobile) */}
          <ScrollArea className="p-4 border-b md:border-r md:border-b-0 md:w-1/3 h-1/3 md:h-full">
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Available Concepts</h4>
            {isLoadingConcepts ? (
              <div className="flex justify-center items-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : concepts.length === 0 ? (
               <p className="text-xs text-muted-foreground text-center">No concepts found.</p>
            ) : (
              <div className="space-y-2">
                {concepts.map(concept => (
                  <Button
                    key={concept.id}
                    variant={selectedConcept?.id === concept.id ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start h-auto py-1.5 px-2 text-left"
                    onClick={() => handleConceptSelect(concept)}
                  >
                     <div className='flex items-center gap-2 w-full'>
                        <span
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: concept.color }}
                            aria-hidden="true"
                         />
                        <span className="flex-grow truncate text-xs">{concept.name}</span>
                         <Badge variant="outline" className='text-xs px-1 py-0'>{getVersesForConcept(concept.id).length}</Badge>
                     </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Concept Details & Verses (Right Pane or Bottom on Mobile) */}
          <ScrollArea className="flex-grow p-4 md:w-2/3">
            {selectedConcept ? (
              <>
                <div className="mb-4">
                     <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                         <span
                            className="h-4 w-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: selectedConcept.color }}
                             aria-hidden="true"
                         />
                        {selectedConcept.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{selectedConcept.description}</p>
                </div>

                <h4 className="text-sm font-medium mb-3 text-muted-foreground">Connected Verses</h4>
                {isLoadingVerses ? (
                  <div className="flex justify-center items-center h-20">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : connectedVerses.length === 0 ? (
                   <p className="text-xs text-muted-foreground">No verses are currently connected to this concept.</p>
                ) : (
                  <div className="space-y-2">
                    {connectedVerses.map(verse => (
                      <Card
                        key={`${verse.surahNumber}:${verse.ayahNumberInSurah}`}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleVerseClick(verse.surahNumber, verse.ayahNumberInSurah)}
                      >
                        <CardContent className="p-3 text-xs">
                          <span className="font-medium">Verse {verse.surahNumber}:{verse.ayahNumberInSurah}</span>
                          {/* Optional: Add a snippet of the verse text here if fetched */}
                          {/* <p className="text-muted-foreground line-clamp-1 mt-1">Snippet...</p> */}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-center items-center h-full text-muted-foreground text-sm">
                Select a concept to see details and connected verses.
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
