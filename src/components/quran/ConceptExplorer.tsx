
'use client';

import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Concept } from '@/services/concepts';
import { getAllConcepts, getVersesForConcept } from '@/services/concepts';
import { ChatPanel } from '@/components/chat/ChatPanel'; // Import ChatPanel
import type { Verse } from '@/services/alquran-cloud'; // Assuming this type exists
import { useToast } from '@/hooks/use-toast';

interface ConceptExplorerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onVerseSelect?: (verseNumber: number) => void;
}

export function ConceptExplorer({ isOpen, onOpenChange, onVerseSelect }: ConceptExplorerProps) {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [relatedVerses, setRelatedVerses] = useState<{ surahNumber: number; ayahNumberInSurah: number; absoluteVerseNumber: number }[]>([]);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [chatContext, setChatContext] = useState<Verse | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      try {
        const fetchedConcepts = getAllConcepts();
        setConcepts(fetchedConcepts);
        if (fetchedConcepts.length > 0 && !selectedConcept) {
        //   setSelectedConcept(fetchedConcepts[0]); // Optionally select the first concept by default
        }
      } catch (error) {
        console.error("Error fetching concepts:", error);
        toast({ title: "Error", description: "Could not load concepts.", variant: "destructive" });
      }
    } else {
        // Reset when closing
        setSelectedConcept(null);
        setRelatedVerses([]);
    }
  }, [isOpen, selectedConcept, toast]);

  useEffect(() => {
    if (selectedConcept) {
        try {
            const verses = getVersesForConcept(selectedConcept.id);
            setRelatedVerses(verses);
        } catch (error) {
            console.error("Error fetching related verses:", error);
            toast({ title: "Error", description: `Could not load verses for ${selectedConcept.name}.`, variant: "destructive" });
        }
    } else {
        setRelatedVerses([]);
    }
  }, [selectedConcept, toast]);

  const handleConceptSelect = (concept: Concept) => {
    setSelectedConcept(concept);
  };

  const handleDiscussConcept = (concept: Concept | null) => {
    if (!concept) return;

    // Create a context for the ChatPanel. This might be a simplified representation
    // or you might fetch specific Quranic context if the concept is tied to one primary verse.
    const discussionContext: Verse = {
      verseNumber: 0, // Indicates general concept discussion, not a specific verse
      verseReference: `Concept: ${concept.name}`,
      ayahNumberInSurah: 0,
      arabicText: `Discussion about the Islamic concept: ${concept.name}`,
      englishTranslation: concept.description,
      audioUrl: null,
      surah: { // Placeholder SurahMeta
        number: 0,
        name: 'Concept Discussion',
        englishName: concept.name,
        englishNameTranslation: 'Discussion Topic',
        revelationType: 'Meccan', // Generic placeholder
        numberOfAyahs: 0,
      },
    };
    setChatContext(discussionContext);
    setIsChatPanelOpen(true);
  };
  
  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
            setSelectedConcept(null); // Reset selection when main panel closes
        }
      }}>
        <SheetContent className="sm:max-w-2xl w-full flex flex-col p-0" side="bottom">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Concept Explorer</SheetTitle>
            <SheetDescription>Explore Islamic concepts and their related verses.</SheetDescription>
          </SheetHeader>
          <div className="flex-grow overflow-hidden flex flex-col md:flex-row gap-0">
            <ScrollArea className="w-full md:w-1/3 h-[40vh] md:h-auto md:border-r overflow-y-auto">
              <div className="p-3">
                <h3 className="text-md font-semibold mb-2 px-1">Concepts</h3>
                {concepts.length === 0 && <p className="text-sm text-muted-foreground p-1">No concepts found.</p>}
                {concepts.map((concept) => (
                  <Button
                    key={concept.id}
                    variant={selectedConcept?.id === concept.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start mb-1 text-left h-auto py-2"
                    onClick={() => handleConceptSelect(concept)}
                    style={{ backgroundColor: selectedConcept?.id === concept.id ? concept.color+'33' : undefined, borderColor: selectedConcept?.id === concept.id ? concept.color : undefined, borderWidth: selectedConcept?.id === concept.id ? '1px' : '0px' }}
                  >
                    <span style={{ color: concept.color, marginRight: '8px', fontSize: '1.2em' }}>●</span>
                    {concept.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
            <ScrollArea className="w-full md:w-2/3 h-[calc(60vh - 60px)] md:h-auto p-4 overflow-y-auto"> {/* Adjusted height for mobile */}
              {selectedConcept ? (
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-semibold mb-1" style={{color: selectedConcept.color}}>{selectedConcept.name}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{selectedConcept.description}</p>
                    </div>
                    <Button onClick={() => handleDiscussConcept(selectedConcept)} size="sm" variant="outline" className="ml-auto shrink-0">
                        Discuss Concept
                    </Button>
                  </div>
                  <h4 className="text-md font-semibold mb-2 mt-4">Related Verses:</h4>
                  {relatedVerses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No verses directly linked to this concept yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {relatedVerses.map((verseRef) => (
                        <li key={verseRef.absoluteVerseNumber}>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-left"
                            onClick={() => {
                              if (onVerseSelect) {
                                  onVerseSelect(verseRef.absoluteVerseNumber);
                                  onOpenChange(false); 
                              }
                            }}
                          >
                            Surah {verseRef.surahNumber}, Ayah {verseRef.ayahNumberInSurah} (Verse {verseRef.absoluteVerseNumber})
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground mt-10">Select a concept to see details and related verses.</p>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Chat Panel for discussing the selected concept */}
      {isChatPanelOpen && selectedConcept && (
        <ChatPanel
          isOpen={isChatPanelOpen}
          onOpenChange={setIsChatPanelOpen}
          verseContext={chatContext} 
        />
      )}
    </>
  );
}
