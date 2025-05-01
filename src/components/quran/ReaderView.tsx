
'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import type { Verse, Reciter, QuranMeta, Translation } from '@/services/alquran-cloud'; // Added Translation
import { getVerse, getReciters, getQuranMeta, getTranslations, SUPPORTED_TRANSLATIONS } from '@/services/alquran-cloud'; // Added getTranslations, SUPPORTED_TRANSLATIONS
import { VerseDisplay } from './VerseDisplay';
import { Controls } from './Controls';
import { NotesSidebar } from './NotesSidebar';
import { SettingsPanel } from './SettingsPanel'; // Import SettingsPanel
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button'; // For settings toggle
import { Settings } from 'lucide-react'; // Icon for settings

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION_ID = SUPPORTED_TRANSLATIONS[0].id; // 'en.clearquran'
const DEFAULT_RECITER_ID = 'ar.alafasy';
const DEFAULT_FONT_SIZE = 16; // Default English font size
const DEFAULT_ARABIC_FONT_SIZE = 24; // Default Arabic font size
const DEFAULT_LINE_HEIGHT = 1.6; // Default line height
const SWIPE_THRESHOLD = 50; // Minimum pixels for a swipe gesture

export function ReaderView() {
  const [quranMeta, setQuranMeta] = useState<QuranMeta | null>(null);
  const [currentVerseData, setCurrentVerseData] = useState<Verse | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [translations, setTranslations] = useState<Translation[]>(SUPPORTED_TRANSLATIONS); // Initialize with supported
  const [selectedReciter, setSelectedReciter] = useState<string>(DEFAULT_RECITER_ID);
  const [selectedTranslation, setSelectedTranslation] = useState<string>(DEFAULT_TRANSLATION_ID);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(DEFAULT_VERSE_NUMBER);
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [arabicFontSize, setArabicFontSize] = useState<number>(DEFAULT_ARABIC_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState<number>(DEFAULT_LINE_HEIGHT);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [isLoadingVerse, setIsLoadingVerse] = useState<boolean>(true);
  const [isLoadingReciters, setIsLoadingReciters] = useState<boolean>(true);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false); // State for settings panel
  const { toast } = useToast();

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
  const fetchVerseData = useCallback(async (verseNum: number, reciterId: string | null, translationId: string | null, meta: QuranMeta | null) => {
    if (!meta) {
       setError("Cannot load verse: Quran metadata is missing.");
       setIsLoadingVerse(false);
       setCurrentVerseData(null);
       return;
    }
    if (!reciterId && !translationId) {
      setError("Cannot load verse: No reciter or translation selected.");
      setIsLoadingVerse(false);
      setCurrentVerseData(null);
      return;
    }

    setIsLoadingVerse(true);
    setError(null);
    try {
      const verse = await getVerse(verseNum, translationId, reciterId, meta);
       if (verse) {
          // Basic validation
          if (translationId && !verse.englishTranslation) {
            console.warn(`Translation ${translationId} requested but not found in response for verse ${verseNum}.`);
          }
          if (reciterId && !verse.arabicText) {
            console.warn(`Reciter ${reciterId} requested but Arabic text not found in response for verse ${verseNum}.`);
          }
          if (reciterId && !verse.audioUrl) {
            console.warn(`Reciter ${reciterId} requested but audio URL not found in response for verse ${verseNum}.`);
          }
          setCurrentVerseData(verse);

       } else {
           // This case implies the API call succeeded but returned null/empty or failed validation inside getVerse
           setError(`Failed to load data for verse ${verseNum}. The verse might be invalid or unavailable for the selected editions.`);
           setCurrentVerseData(null);
           // Optionally attempt fallback (though getVerse might already do this)
           // Example: If fallback is needed here:
           // const fallbackVerse = await getVerse(verseNum, DEFAULT_TRANSLATION_ID, DEFAULT_RECITER_ID, meta);
           // if (fallbackVerse) { ... }
       }
    } catch (err) {
      console.error('Error fetching verse in ReaderView:', err);
      // Check if error is an object with a message property
      const errorMessage = (err instanceof Error) ? err.message : 'An unexpected error occurred.';
      setError(`Error loading verse ${verseNum}: ${errorMessage}. Please try again.`);
      setCurrentVerseData(null);
    } finally {
      setIsLoadingVerse(false);
    }
  }, []); // Dependencies managed in the main useEffect


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
             const newReciter = defaultExists ? DEFAULT_RECITER_ID : fetchedReciters[0].id;
             setSelectedReciter(newReciter);
             console.log(`Selected reciter was invalid, changed to ${newReciter}`);
         }
       } else {
         setError("No audio reciters available.");
         setSelectedReciter(''); // Clear selected reciter if none available
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

   // Fetch Translation List
  const fetchTranslationList = useCallback(async () => {
    setIsLoadingTranslations(true);
    setError(null);
    try {
      const fetchedTranslations = await getTranslations();
      setTranslations(fetchedTranslations);
      // Ensure selected translation is valid
      if (fetchedTranslations.length > 0) {
         const isValidSelected = fetchedTranslations.some(t => t.id === selectedTranslation);
         if (!isValidSelected) {
             const defaultExists = fetchedTranslations.some(t => t.id === DEFAULT_TRANSLATION_ID);
             const newTranslation = defaultExists ? DEFAULT_TRANSLATION_ID : fetchedTranslations[0].id;
             setSelectedTranslation(newTranslation);
             console.log(`Selected translation was invalid, changed to ${newTranslation}`);
         }
      } else {
        setError("No translations available.");
        setSelectedTranslation(''); // Clear if none available
      }
    } catch (err) {
      console.error('Error fetching translations:', err);
      setError('Failed to load translation list.');
      setTranslations(SUPPORTED_TRANSLATIONS); // Fallback to hardcoded list
       // Ensure selected translation is valid against fallback list
       const isValidSelectedFallback = SUPPORTED_TRANSLATIONS.some(t => t.id === selectedTranslation);
        if (!isValidSelectedFallback && SUPPORTED_TRANSLATIONS.length > 0) {
             setSelectedTranslation(SUPPORTED_TRANSLATIONS[0].id);
        } else if (SUPPORTED_TRANSLATIONS.length === 0) {
            setSelectedTranslation(''); // Clear if fallback is empty too
        }
    } finally {
        setIsLoadingTranslations(false);
    }
  }, [selectedTranslation]); // Depend on selectedTranslation

  useEffect(() => {
    fetchTranslationList();
  }, [fetchTranslationList]);


  useEffect(() => {
     // Only fetch verse data if metadata is loaded and identifiers are set
     if (quranMeta && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations) {
       fetchVerseData(currentVerseNumber, selectedReciter, selectedTranslation, quranMeta);
     } else if (!quranMeta && !isLoadingMeta) {
        setError("Quran metadata failed to load, cannot fetch verse.");
        setCurrentVerseData(null);
     }
  }, [currentVerseNumber, selectedReciter, selectedTranslation, quranMeta, fetchVerseData, isLoadingMeta, isLoadingReciters, isLoadingTranslations]);

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

   const handleTranslationChange = (translationId: string) => {
     setSelectedTranslation(translationId);
   };

   const handleFontSizeChange = (value: number[]) => {
     setFontSize(value[0]);
   };

   const handleArabicFontSizeChange = (value: number[]) => {
     setArabicFontSize(value[0]);
   };

    const handleLineHeightChange = (value: number[]) => {
     setLineHeight(value[0]);
   };


   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      // Input controlled externally, validation on blur
    };

   const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
     const value = parseInt(e.target.value, 10);
     const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
      if (!isNaN(value) && value >= 1 && value <= maxVerse) {
        if (value !== currentVerseNumber) {
            setCurrentVerseNumber(value);
        }
      } else {
        e.target.value = currentVerseNumber.toString(); // Reset if invalid
        toast({ title: "Invalid Verse", description: `Please enter a verse number between 1 and ${maxVerse}.`, variant: "destructive"});
      }
   }

   const handleVerseSliderChange = (value: number[]) => {
       if (value[0] !== currentVerseNumber) {
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
        console.log("Context menu triggered for verse:", verseNumber);
        // Example: Trigger note taking
        setIsNotesSidebarOpen(true); // Open notes sidebar on context menu action
        toast({ title: "Action", description: `Context menu for verse ${verseNumber}. Opened Notes panel.` });
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

       if (Math.abs(dx) > SWIPE_THRESHOLD) {
           if (dx > 0) {
               handlePreviousVerse();
           } else {
               handleNextVerse();
           }
       }

       // Reset refs
       touchStartX.current = null;
       touchEndX.current = null;
   };

   // --- Toggle Sidebars/Panels ---
   const toggleNotesSidebar = () => setIsNotesSidebarOpen(prev => !prev);
   const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);

   const isLoading = isLoadingMeta || isLoadingVerse || isLoadingReciters || isLoadingTranslations;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 pb-24"> {/* Added padding-bottom */}
       <Card
         className="shadow-md rounded-lg overflow-hidden"
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
         style={{ touchAction: 'pan-y' }}
        >
        <CardContent className="p-6 relative">
         {/* Buttons positioned top-right */}
         <div className="absolute top-2 right-2 z-10 flex gap-2">
             <NotesSidebar
                currentVerseNumber={currentVerseNumber}
                isOpen={isNotesSidebarOpen}
                onOpenChange={setIsNotesSidebarOpen}
                surahName={currentVerseData?.surah?.englishName ?? ''}
                ayahNumber={currentVerseData?.verseReference?.split(':')[1] ?? ''}
             />
             {/* Settings Panel Trigger */}
             <SettingsPanel
                isOpen={isSettingsPanelOpen}
                onOpenChange={setIsSettingsPanelOpen}
                fontSize={fontSize}
                arabicFontSize={arabicFontSize}
                lineHeight={lineHeight}
                translations={translations}
                selectedTranslation={selectedTranslation}
                onFontSizeChange={handleFontSizeChange}
                onArabicFontSizeChange={handleArabicFontSizeChange}
                onLineHeightChange={handleLineHeightChange}
                onTranslationChange={handleTranslationChange}
                isLoading={isLoadingTranslations}
             />
         </div>
         {isLoadingMeta && <p className="text-center text-muted-foreground pt-10">Loading Quran structure...</p>}
         {error && <p className="text-destructive text-center mb-4 pt-10">{error}</p>}
         {isLoadingVerse && !isLoadingMeta && !error ? (
           <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 pt-10">
             <Skeleton className="h-40 w-full" />
             <Skeleton className="h-px w-full md:h-full md:w-px bg-border" />
             <Skeleton className="h-40 w-full" />
           </div>
         ) : currentVerseData ? (
           <VerseDisplay
               verse={currentVerseData}
               fontSize={fontSize}
               arabicFontSize={arabicFontSize} // Pass arabic font size
               lineHeight={lineHeight} // Pass line height
               onContextMenu={handleVerseContextMenu}
            />
         ) : (
           !error && !isLoadingMeta && <p className="text-center text-muted-foreground pt-10">Select a verse or reciter.</p>
         )}
         </CardContent>
       </Card>

      <Controls
        verseNumber={currentVerseNumber}
        audioUrl={currentVerseData?.audioUrl}
        reciters={reciters}
        selectedReciter={selectedReciter}
        fontSize={fontSize} // Pass english font size to controls (for popover)
        onNextVerse={handleNextVerse}
        onPreviousVerse={handlePreviousVerse}
        onReciterChange={handleReciterChange}
        onFontSizeChange={handleFontSizeChange} // Can be removed if only in settings
        onVerseInputChange={handleVerseInputChange}
        onVerseInputBlur={handleVerseInputBlur}
        onVerseSliderChange={handleVerseSliderChange}
        onJuzChange={handleJuzChange}
        onPageChange={handlePageChange}
        isLoading={isLoading}
        quranMeta={quranMeta}
      />
    </div>
  );
}
