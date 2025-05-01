'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import type { Verse, Reciter, QuranMeta } from '@/services/alquran-cloud';
import { getVerse, getReciters, getQuranMeta } from '@/services/alquran-cloud';
import { VerseDisplay } from './VerseDisplay';
import { Controls } from './Controls';
import { NotesSidebar } from './NotesSidebar'; // Import NotesSidebar
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings'; // Import mappings
import { useToast } from '@/hooks/use-toast'; // Import useToast

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION = 'en.clearquran';
const DEFAULT_RECITER_ID = 'ar.alafasy';
const DEFAULT_FONT_SIZE = 16; // Default English font size
const SWIPE_THRESHOLD = 50; // Minimum pixels for a swipe gesture

export function ReaderView() {
  const [quranMeta, setQuranMeta] = useState<QuranMeta | null>(null);
  const [currentVerseData, setCurrentVerseData] = useState<Verse | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [selectedReciter, setSelectedReciter] = useState<string>(DEFAULT_RECITER_ID);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(DEFAULT_VERSE_NUMBER);
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [isLoadingVerse, setIsLoadingVerse] = useState<boolean>(true);
  const [isLoadingReciters, setIsLoadingReciters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(false); // State for notes sidebar
  const { toast } = useToast(); // Toast hook

  // Refs for swipe gesture
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Fetch Quran Metadata once on mount
  const fetchMetaData = useCallback(async () => {
    setIsLoadingMeta(true);
    setError(null);
    try {
      const meta = await getQuranMeta();
      setQuranMeta(meta);
    } catch (err) {
      console.error('Error fetching Quran metadata:', err);
      setError('Failed to load Quran structure. Please refresh.');
      setQuranMeta(null);
    } finally {
      setIsLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    fetchMetaData();
  }, [fetchMetaData]);

  // Fetch Verse Data
  const fetchVerseData = useCallback(async (verseNum: number, reciterId: string, meta: QuranMeta | null) => {
    if (!meta) {
       setError("Cannot load verse: Quran metadata is missing.");
       setIsLoadingVerse(false);
       setCurrentVerseData(null);
       return;
    }
    setIsLoadingVerse(true);
    setError(null);
    try {
      const verse = await getVerse(verseNum, DEFAULT_TRANSLATION, reciterId, meta);
       if (verse) {
          setCurrentVerseData(verse);
        } else {
           console.warn(`Failed to load data for verse ${verseNum}. Trying with default reciter.`);
           // Attempt fallback to default reciter if current one fails
           const fallbackVerse = await getVerse(verseNum, DEFAULT_TRANSLATION, DEFAULT_RECITER_ID, meta);
           if (fallbackVerse) {
                setCurrentVerseData(fallbackVerse);
                setSelectedReciter(DEFAULT_RECITER_ID); // Update state to reflect fallback
                toast({ title: "Reciter Changed", description: `Switched to default reciter (${DEFAULT_RECITER_ID}) for verse ${verseNum}.`, variant: "default"});
           } else {
               setError(`Failed to load essential data for verse ${verseNum}, even with fallback. It might be invalid or unavailable.`);
               setCurrentVerseData(null);
           }
        }
    } catch (err) {
      console.error('Error fetching verse in ReaderView:', err);
      setError('An unexpected error occurred while loading verse data. Please try again.');
      setCurrentVerseData(null);
    } finally {
      setIsLoadingVerse(false);
    }
  }, [toast]); // Added toast dependency

  // Fetch Reciter List
  const fetchReciterList = useCallback(async () => {
    setIsLoadingReciters(true);
    setError(null);
    try {
      const fetchedReciters = await getReciters();
      setReciters(fetchedReciters);
      // Ensure the currently selected or default reciter is valid
      if (fetchedReciters.length > 0) {
         const isValidSelected = fetchedReciters.some(r => r.id === selectedReciter);
         if (!isValidSelected) {
             const defaultExists = fetchedReciters.some(r => r.id === DEFAULT_RECITER_ID);
             setSelectedReciter(defaultExists ? DEFAULT_RECITER_ID : fetchedReciters[0].id);
         }
       } else {
         setError("No audio reciters available.");
         setSelectedReciter('');
       }
    } catch (err) {
      console.error('Error fetching reciters:', err);
      setError('Failed to load reciter list.');
      setReciters([]);
      setSelectedReciter('');
    } finally {
        setIsLoadingReciters(false);
    }
  }, [selectedReciter]); // Depend on selectedReciter to potentially correct it

  useEffect(() => {
    fetchReciterList();
  }, [fetchReciterList]); // Fetch reciters when component mounts

  useEffect(() => {
     if (quranMeta && selectedReciter && !isLoadingMeta && !isLoadingReciters) { // Ensure reciters are loaded too
       fetchVerseData(currentVerseNumber, selectedReciter, quranMeta);
     } else if (!quranMeta && !isLoadingMeta) {
        setError("Quran metadata failed to load, cannot fetch verse.");
        setCurrentVerseData(null);
     }
  }, [currentVerseNumber, selectedReciter, quranMeta, fetchVerseData, isLoadingMeta, isLoadingReciters]); // Added isLoadingReciters

  // --- Navigation Handlers ---

  const handleNextVerse = useCallback(() => {
    const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
    setCurrentVerseNumber((prev) => Math.min(prev + 1, maxVerse));
  }, [quranMeta]);

  const handlePreviousVerse = useCallback(() => {
    setCurrentVerseNumber((prev) => Math.max(1, prev - 1));
  }, []);

  const handleReciterChange = (reciterId: string) => {
    setSelectedReciter(reciterId);
  };

   const handleFontSizeChange = (value: number[]) => {
     setFontSize(value[0]);
   };

   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      // Only updates visual, validation on blur (or potentially directly update state if preferred)
      // setCurrentVerseNumber(parseInt(e.target.value, 10) || currentVerseNumber); // Example: Immediate update
    };

   const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
     const value = parseInt(e.target.value, 10);
     const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
      if (!isNaN(value) && value >= 1 && value <= maxVerse) {
        if (value !== currentVerseNumber) { // Only update if value changed
            setCurrentVerseNumber(value);
        }
      } else {
        e.target.value = currentVerseNumber.toString(); // Reset if invalid
        toast({ title: "Invalid Verse", description: `Please enter a verse number between 1 and ${maxVerse}.`, variant: "destructive"});
      }
   }

   const handleVerseSliderChange = (value: number[]) => {
       if (value[0] !== currentVerseNumber) { // Only update if value changed
           setCurrentVerseNumber(value[0]);
       }
   };

   const handleJuzChange = (juz: number) => {
       const startVerse = JUZ_STARTS[juz];
       if (startVerse && startVerse !== currentVerseNumber) {
           setCurrentVerseNumber(startVerse);
       }
   };

   const handlePageChange = (page: number) => {
       const startVerse = PAGE_STARTS[page];
       if (startVerse && startVerse !== currentVerseNumber) {
           setCurrentVerseNumber(startVerse);
       }
   };

   // --- Interaction Handlers ---

   const handleVerseContextMenu = (verseNumber: number) => {
        // Placeholder for context menu logic
        console.log("Context menu triggered for verse:", verseNumber);
        toast({ title: "Action", description: `Context menu for verse ${verseNumber}. Options: Add Note, Tag, Share, Bookmark (coming soon).` });
   };

   // --- Swipe Gesture Handlers ---
   const handleTouchStart = (e: React.TouchEvent) => {
       touchStartX.current = e.targetTouches[0].clientX;
       touchEndX.current = null; // Reset end position on new touch
   };

   const handleTouchMove = (e: React.TouchEvent) => {
       touchEndX.current = e.targetTouches[0].clientX;
   };

   const handleTouchEnd = () => {
       if (touchStartX.current === null || touchEndX.current === null) return;

       const dx = touchEndX.current - touchStartX.current;

       if (Math.abs(dx) > SWIPE_THRESHOLD) { // Ensure it's a significant swipe
           if (dx > 0) {
               // Swiped Right (Previous Verse)
               handlePreviousVerse();
           } else {
               // Swiped Left (Next Verse)
               handleNextVerse();
           }
       }

       // Reset refs
       touchStartX.current = null;
       touchEndX.current = null;
   };

   // --- Toggle Notes Sidebar ---
   const toggleNotesSidebar = () => {
       setIsNotesSidebarOpen(prev => !prev);
   };

   const isLoading = isLoadingMeta || isLoadingVerse || isLoadingReciters;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
       <Card
         className="shadow-md rounded-lg overflow-hidden"
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
         style={{ touchAction: 'pan-y' }} // Allow vertical scrolling while capturing horizontal swipes
        >
        <CardContent className="p-6 relative"> {/* Added relative positioning */}
         {/* Notes Sidebar Trigger Button (Positioned top-right) */}
         <div className="absolute top-2 right-2 z-10">
             <NotesSidebar
                currentVerseNumber={currentVerseNumber}
                isOpen={isNotesSidebarOpen}
                onOpenChange={setIsNotesSidebarOpen}
             />
         </div>
         {isLoadingMeta && <p className="text-center text-muted-foreground">Loading Quran structure...</p>}
         {error && <p className="text-destructive text-center mb-4">{error}</p>}
         {isLoadingVerse && !isLoadingMeta && !error ? (
           <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6">
             <Skeleton className="h-40 w-full" />
             <Skeleton className="h-px w-full md:h-full md:w-px bg-border" />
             <Skeleton className="h-40 w-full" />
           </div>
         ) : currentVerseData ? (
           <VerseDisplay
               verse={currentVerseData}
               fontSize={fontSize}
               onContextMenu={handleVerseContextMenu} // Pass context menu handler
            />
         ) : (
           !error && !isLoadingMeta && <p className="text-center text-muted-foreground">Select a verse or reciter.</p>
         )}
         </CardContent>
       </Card>

      <Controls
        verseNumber={currentVerseNumber}
        audioUrl={currentVerseData?.audioUrl}
        reciters={reciters}
        selectedReciter={selectedReciter}
        fontSize={fontSize}
        onNextVerse={handleNextVerse}
        onPreviousVerse={handlePreviousVerse}
        onReciterChange={handleReciterChange}
        onFontSizeChange={handleFontSizeChange}
        onVerseInputChange={handleVerseInputChange}
        onVerseInputBlur={handleVerseInputBlur}
        onVerseSliderChange={handleVerseSliderChange} // Pass slider handler
        onJuzChange={handleJuzChange} // Pass Juz handler
        onPageChange={handlePageChange} // Pass Page handler
        isLoading={isLoading}
        quranMeta={quranMeta} // Pass meta to controls
      />
    </div>
  );
}