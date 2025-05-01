
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
    // Arabic text (quran-uthmani) is now considered mandatory by getVerse, translation and audio are optional
    // if (!reciterId && !translationId) {
    //   setError("Cannot load verse: No reciter or translation selected.");
    //   setIsLoadingVerse(false);
    //   setCurrentVerseData(null);
    //   return;
    // }

    setIsLoadingVerse(true);
    setError(null);
    try {
      // Ensure reciterId and translationId are passed, even if null
      const verse = await getVerse(verseNum, translationId, reciterId, meta);

      if (verse) {
        // Basic validation - check if requested optional data is present
        if (translationId && !verse.englishTranslation) {
          console.warn(`Translation ${translationId} requested but not found in response for verse ${verseNum}.`);
        }
        // Arabic text is now handled by getVerse throwing an error if missing mandatory 'quran-uthmani'
        // if (!verse.arabicText) {
        //     console.error(`Critical Error: Arabic text missing for verse ${verseNum}.`);
        //     setError(`Failed to load core Arabic text for verse ${verseNum}.`);
        //     setCurrentVerseData(null); // Ensure UI doesn't show incomplete data
        //     return; // Stop further processing for this verse fetch
        // }
        if (reciterId && !verse.audioUrl) {
          console.warn(`Reciter ${reciterId} requested but audio URL not found in response for verse ${verseNum}.`);
        }
        setCurrentVerseData(verse);
      } else {
        // Handle case where getVerse returns null (e.g., 404, critical error fetching, empty data)
        setError(`Failed to load data for verse ${verseNum}. It might be invalid or unavailable.`);
        setCurrentVerseData(null); // Clear previous data on failure
      }
    } catch (err) {
      console.error('Error fetching verse in ReaderView:', err);
      const errorMessage = (err instanceof Error) ? err.message : 'An unexpected error occurred.';
      setError(`Error loading verse ${verseNum}: ${errorMessage}. Please try again.`);
      setCurrentVerseData(null); // Clear previous data on error
    } finally {
      setIsLoadingVerse(false);
    }
  // Include all dependencies that affect the fetch
  }, []);


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
        setError("No English translations available.");
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
     // Fetch verse data only when metadata and lists are ready, and identifiers are set.
     if (quranMeta && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations) {
       // Pass null for reciter/translation if they are empty strings (meaning none available/selected)
       const reciterToFetch = selectedReciter || null;
       const translationToFetch = selectedTranslation || null;
       fetchVerseData(currentVerseNumber, reciterToFetch, translationToFetch, quranMeta);
     } else if (!quranMeta && !isLoadingMeta) {
        setError("Quran metadata failed to load, cannot fetch verse.");
        setCurrentVerseData(null);
        setIsLoadingVerse(false); // Ensure loading stops if meta fails
     } else {
        // Handle cases where lists are still loading or identifiers are missing
        setIsLoadingVerse(true); // Keep loading indicator on if prerequisites aren't met
     }
  // Trigger fetch when verse number, selected reciter/translation, or metadata changes, or when loading states resolve
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

   // Combine all loading states
   const isLoading = isLoadingMeta || isLoadingVerse || isLoadingReciters || isLoadingTranslations;

   // Determine if verse data is truly unavailable (after loading attempt)
   const isVerseUnavailable = !isLoadingVerse && !currentVerseData;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 pb-24"> {/* Added padding-bottom */}
       <Card
         className="shadow-md rounded-lg overflow-hidden border border-border" // Use theme border
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
         style={{ touchAction: 'pan-y' }}
        >
        <CardContent className="p-0 relative"> {/* Remove default padding */}
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
                isLoading={isLoadingTranslations || isLoading} // Disable if translations or anything else is loading
             />
         </div>
         {/* Loading and Error States */}
         {isLoadingMeta && !error && (
             <div className="flex justify-center items-center h-60">
                 <p className="text-center text-muted-foreground">Loading Quran structure...</p>
             </div>
         )}
         {error && (
            <div className="flex justify-center items-center h-60">
                 <p className="text-destructive text-center p-6">{error}</p>
             </div>
          )}
          {/* Display Skeleton or Verse */}
         {!isLoadingMeta && !error && (
            isLoadingVerse ? (
                // Skeleton Loading State for VerseDisplay
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 p-6">
                    <div className="flex flex-col gap-4">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-20 w-full mt-4" />
                    </div>
                     <Skeleton className="h-px w-full md:h-full md:w-px bg-border" />
                     <div dir="rtl" className="flex flex-col gap-4 items-end">
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-24 w-full mt-4" />
                    </div>
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
                // State when loading is finished but verse data is null (e.g., fetch failed)
                <div className="flex justify-center items-center h-60">
                    <p className="text-center text-muted-foreground p-6">
                        Verse data could not be loaded. Please try changing verse or selections.
                    </p>
                </div>
            )
         )}
         </CardContent>
       </Card>

      <Controls
        verseNumber={currentVerseNumber}
        // Use nullish coalescing for potentially null verse data
        audioUrl={currentVerseData?.audioUrl ?? null}
        reciters={reciters}
        selectedReciter={selectedReciter}
        // fontSize={fontSize} // Pass english font size to controls (for popover) - REMOVED, handled in Settings
        onNextVerse={handleNextVerse}
        onPreviousVerse={handlePreviousVerse}
        onReciterChange={handleReciterChange}
        // onFontSizeChange={handleFontSizeChange} // REMOVED, handled in Settings
        onVerseInputChange={handleVerseInputChange}
        onVerseInputBlur={handleVerseInputBlur}
        onVerseSliderChange={handleVerseSliderChange}
        onJuzChange={handleJuzChange}
        onPageChange={handlePageChange}
        isLoading={isLoading || isVerseUnavailable} // Controls disabled if loading OR if verse is definitively unavailable
        quranMeta={quranMeta}
      />
    </div>
  );
}

