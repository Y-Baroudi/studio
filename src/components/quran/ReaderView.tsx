
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // For FAB tooltip
import { useIsMobile } from '@/hooks/use-mobile'; // Import hook to check for mobile

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION_ID = SUPPORTED_TRANSLATIONS[0]?.id ?? ''; // Use first supported or empty string
const DEFAULT_RECITER_ID = 'ar.alafasy';
const DEFAULT_FONT_SIZE = 16; // Default English font size
const DEFAULT_ARABIC_FONT_SIZE = 24; // Default Arabic font size
const DEFAULT_LINE_HEIGHT = 1.6; // Default line height
const SWIPE_THRESHOLD = 50; // Minimum pixels for a swipe gesture

export function ReaderView() {
  const [quranMeta, setQuranMeta] = useState<QuranMeta | null>(null);
  const [currentVerseData, setCurrentVerseData] = useState<Verse | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [translations, setTranslations] = useState<Translation[]>(SUPPORTED_TRANSLATIONS); // Initialize with supported fallback
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
  const isMobile = useIsMobile(); // Check if mobile view

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
   const fetchVerseData = useCallback(async (verseNum: number, translationId: string | null, reciterId: string | null, meta: QuranMeta | null) => {
    if (!meta) {
       setError("Cannot load verse: Quran metadata is missing.");
       setIsLoadingVerse(false);
       setCurrentVerseData(null);
       return;
    }

    setIsLoadingVerse(true);
    setError(null); // Clear previous verse errors

    try {
        // Ensure IDs passed are not empty strings, convert to null if they are
        const finalTranslationId = translationId || null;
        const finalReciterId = reciterId || null;

        const verse = await getVerse(verseNum, finalTranslationId, finalReciterId, meta);

        // Check if the verse fetch succeeded and returned data (not null)
        if (verse) {
             // Additional check: if translation was requested but is null in response
             if (finalTranslationId && verse.englishTranslation === null) {
                 console.warn(`Translation ${finalTranslationId} requested but not found for verse ${verse.verseReference}.`);
                  toast({
                    title: "Translation Note",
                    description: `The selected translation might not be available for verse ${verse.verseReference}.`,
                    variant: "default",
                  });
             }
             setCurrentVerseData(verse);
        } else {
            // getVerse returned null (e.g., 404 or critical error during fetch)
            setError(`Failed to load data for verse ${verseNum}. It might be invalid or unavailable in the selected editions.`);
            setCurrentVerseData(null); // Set to null to indicate failure
             toast({
               title: "Verse Load Error",
               description: `Could not load verse ${verseNum}.`,
               variant: "destructive",
             });
        }
    } catch (err) {
        // Catch errors thrown by getVerse itself (e.g., API errors 5xx, network issues)
        console.error('Error fetching verse in ReaderView:', err);
        const errorMessage = (err instanceof Error) ? err.message : 'An unexpected error occurred.';
        setError(`Error loading verse ${verseNum}: ${errorMessage}. Please try again.`);
        setCurrentVerseData(null); // Set to null on error
         toast({
            title: "Verse Load Error",
            description: `Could not load verse ${verseNum}. ${errorMessage}`,
            variant: "destructive",
        });
    } finally {
        setIsLoadingVerse(false); // Stop loading indicator regardless of outcome
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
             const newReciter = defaultExists ? DEFAULT_RECITER_ID : fetchedReciters[0].id;
             setSelectedReciter(newReciter);
             console.log(`Selected reciter was invalid or empty, changed to ${newReciter}`);
         }
       } else {
         console.warn("No audio reciters available from API or fallback.");
         // setError("No audio reciters available."); // Maybe don't set a blocking error
         setSelectedReciter(''); // Clear selected reciter if none available
       }
    } catch (err) {
      console.error('Error fetching reciters:', err);
      // setError('Failed to load reciter list.'); // Avoid setting blocking error if fallbacks work
      setReciters([]); // Clear list if fetch fails completely
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
    setError(null); // Clear previous translation errors
    try {
      const fetchedTranslations = await getTranslations(); // This now handles fallbacks internally
      setTranslations(fetchedTranslations); // Update state with fetched/fallback list

      // Ensure the currently selected translation is valid within the fetched/fallback list
      if (fetchedTranslations.length > 0) {
         const isValidSelected = fetchedTranslations.some(t => t.id === selectedTranslation);
         if (!isValidSelected) {
             // If current selection is invalid, try the default, then the first available
             const defaultExists = fetchedTranslations.some(t => t.id === DEFAULT_TRANSLATION_ID);
             const newTranslation = defaultExists ? DEFAULT_TRANSLATION_ID : fetchedTranslations[0].id;
             setSelectedTranslation(newTranslation);
             console.log(`Selected translation was invalid or empty, changed to ${newTranslation}`);
             if (!isValidSelected && selectedTranslation) { // Only toast if a selection existed before
                 toast({ title: "Translation Reset", description: `Selected translation was unavailable, switched to ${newTranslation}.` });
             }
         }
      } else {
        // This case should be less likely now with the fallback in getTranslations
        console.warn("No English translations available from API or fallback.");
        // setError("No English translations available."); // Avoid blocking error
        setSelectedTranslation(''); // Clear selected translation if none available
      }
    } catch (err) {
      // Catch unexpected errors during the process (though getTranslations handles internal errors)
      console.error('Unexpected error during fetchTranslationList:', err);
      setError('Failed to process translation list.');
      setTranslations(SUPPORTED_TRANSLATIONS); // Ensure fallback is set
      setSelectedTranslation(SUPPORTED_TRANSLATIONS[0]?.id ?? ''); // Reset to default/first fallback
    } finally {
        setIsLoadingTranslations(false);
    }
  }, [selectedTranslation, toast]); // Depend on selectedTranslation and toast

  useEffect(() => {
    fetchTranslationList();
  }, [fetchTranslationList]);


  useEffect(() => {
     // Fetch verse data only when metadata is ready and identifiers are set.
     // Loading states for lists are handled inside the list fetching logic.
     if (quranMeta && !isLoadingMeta) {
       // Pass the current selectedTranslation and selectedReciter
       fetchVerseData(currentVerseNumber, selectedTranslation, selectedReciter, quranMeta);
     } else if (!quranMeta && !isLoadingMeta) {
        // Metadata failed to load, cannot fetch verse. Set error if not already set.
        if (!error) setError("Quran metadata failed to load, cannot fetch verse.");
        setCurrentVerseData(null);
        setIsLoadingVerse(false); // Ensure loading stops if meta fails
     } else {
        // Metadata is still loading
        setIsLoadingVerse(true); // Keep loading indicator on if prerequisites aren't met
     }
  // Trigger fetch when verse number, selected reciter/translation, or metadata changes (or resolves)
  }, [currentVerseNumber, selectedReciter, selectedTranslation, quranMeta, fetchVerseData, isLoadingMeta, error]); // Removed list loading states, added error

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
     if (translationId !== selectedTranslation) {
         setSelectedTranslation(translationId);
         // Verse fetch will be triggered by useEffect dependency change
          toast({
             title: "Translation Changed",
             description: `Loading verse with ${translations.find(t=>t.id === translationId)?.name ?? translationId}.`,
           });
     }
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
       // This is handled by the Controls component now, primarily validation on blur
    };

   const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
     const value = parseInt(e.target.value, 10);
     const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
      if (!isNaN(value) && value >= 1 && value <= maxVerse) {
        if (value !== currentVerseNumber) {
            setCurrentVerseNumber(value);
            // Verse fetch will trigger via useEffect
        }
      } else {
        // Reset input visually to current verse if invalid input
        e.target.value = currentVerseNumber.toString();
        toast({ title: "Invalid Verse", description: `Please enter a verse number between 1 and ${maxVerse}.`, variant: "destructive"});
      }
   }

   const handleVerseSliderChange = (value: number[]) => {
       // Update immediately as slider moves
       if (value[0] !== currentVerseNumber) {
           setCurrentVerseNumber(value[0]);
           // Verse fetch will trigger via useEffect
       }
   };

   const handleJuzChange = (juz: number) => {
       const startVerse = JUZ_STARTS[juz];
       if (startVerse && startVerse !== currentVerseNumber) {
           setCurrentVerseNumber(startVerse);
           // Verse fetch will trigger via useEffect
            toast({ title: "Navigated", description: `Jumped to Juz ${juz} (Verse ${startVerse}).` });
       }
   };

   const handlePageChange = (page: number) => {
       const startVerse = PAGE_STARTS[page];
       if (startVerse && startVerse !== currentVerseNumber) {
           setCurrentVerseNumber(startVerse);
            // Verse fetch will trigger via useEffect
            toast({ title: "Navigated", description: `Jumped to Page ${page} (Verse ${startVerse}).` });
       }
   };

   // --- Interaction Handlers ---

   const handleVerseContextMenu = (verseNumber: number) => {
        console.log("Context menu triggered for verse:", verseNumber);
        // Example: Trigger note taking
        setIsNotesSidebarOpen(true); // Open notes sidebar on context menu action
        // Toast handled within VerseDisplay potentially
   };

   // --- Swipe Gesture Handlers ---
   const handleTouchStart = (e: React.TouchEvent) => {
       if (isMobile) { // Only enable swipe on mobile
           touchStartX.current = e.targetTouches[0].clientX;
           touchEndX.current = null; // Reset end position on new touch
       }
   };

   const handleTouchMove = (e: React.TouchEvent) => {
       if (isMobile && touchStartX.current !== null) { // Only track move if started on mobile
           touchEndX.current = e.targetTouches[0].clientX;
       }
   };

   const handleTouchEnd = () => {
       if (!isMobile || touchStartX.current === null || touchEndX.current === null) return; // Only process if mobile and swipe occurred

       const dx = touchEndX.current - touchStartX.current;

       if (Math.abs(dx) > SWIPE_THRESHOLD) {
           if (dx > 0) {
               // Swiped right (previous verse)
               handlePreviousVerse();
           } else {
               // Swiped left (next verse)
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

   // Combine relevant loading states for UI feedback
   const isAppLoading = isLoadingMeta || isLoadingReciters || isLoadingTranslations; // Initial app setup loading
   const isVerseLoading = isLoadingVerse; // Specific verse loading state

   // Determine if verse data is truly unavailable (after loading attempt)
   const isVerseUnavailable = !isVerseLoading && !currentVerseData && !error; // Added !error check
   const displayError = error && !isVerseLoading; // Show error only when not loading

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 pb-24 relative"> {/* Added relative positioning for FAB */}
       <Card
         className="shadow-md rounded-lg overflow-hidden border border-border" // Use theme border
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
         style={{ touchAction: isMobile ? 'pan-y' : 'auto' }} // Enable vertical pan on mobile
        >
        <CardContent className="p-0 relative"> {/* Remove default padding */}
         {/* Notes Button positioned top-right */}
         <div className="absolute top-2 right-2 z-10 flex gap-2">
             <NotesSidebar
                currentVerseNumber={currentVerseNumber}
                isOpen={isNotesSidebarOpen}
                onOpenChange={setIsNotesSidebarOpen}
                surahName={currentVerseData?.surah?.englishName ?? ''}
                ayahNumber={currentVerseData?.verseReference?.split(':')[1] ?? ''}
                // Pass other necessary props like save handlers later
             />
             {/* Settings Panel Trigger Button is now a FAB */}
         </div>

         {/* Loading and Error States */}
         {isAppLoading && ( // Show app loading only during initial setup
             <div className="flex flex-col justify-center items-center h-60 gap-4 p-6">
                 <Skeleton className="h-8 w-3/4" />
                 <Skeleton className="h-4 w-1/2" />
                 <Skeleton className="h-20 w-full mt-4" />
                 <p className="text-center text-muted-foreground mt-2">Initializing Quran Companion...</p>
             </div>
         )}
         {displayError && ( // Show error message if there's an error and not loading verse
            <div className="flex justify-center items-center h-60 p-6">
                 <p className="text-destructive text-center">{error}</p>
             </div>
          )}

          {/* Display Skeleton or Verse (Only if not initial loading and no error) */}
         {!isAppLoading && !displayError && (
            isVerseLoading ? (
                // Skeleton Loading State for VerseDisplay
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 p-6 animate-pulse">
                    {/* Arabic Skeleton */}
                     <div dir="rtl" className="flex flex-col gap-4 items-end order-1 md:order-3">
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-24 w-full mt-4" />
                    </div>
                     {/* Separator Skeleton */}
                     <Skeleton className="h-px w-full md:h-full md:w-px bg-border order-2" />
                    {/* English Skeleton */}
                     <div className="flex flex-col gap-4 order-3 md:order-1">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-20 w-full mt-4" />
                    </div>
                </div>
            ) : currentVerseData ? (
                // Render the actual verse data
                <VerseDisplay
                    verse={currentVerseData}
                    fontSize={fontSize}
                    arabicFontSize={arabicFontSize}
                    lineHeight={lineHeight}
                    onContextMenu={handleVerseContextMenu}
                    // Pass any other required props
                />
            ) : (
                // State when verse loading finished but data is null (e.g., 404, specific error handled by fetchVerseData)
                 <div className="flex justify-center items-center h-60 p-6">
                    <p className="text-center text-muted-foreground">
                        {error ? error : "Verse data could not be loaded. Please try changing verse or selections."}
                    </p>
                </div>
            )
         )}
         </CardContent>
       </Card>

      <Controls
        verseNumber={currentVerseNumber}
        audioUrl={currentVerseData?.audioUrl ?? null}
        reciters={reciters}
        selectedReciter={selectedReciter}
        onNextVerse={handleNextVerse}
        onPreviousVerse={handlePreviousVerse}
        onReciterChange={handleReciterChange}
        onVerseInputChange={handleVerseInputChange} // Pass the handler
        onVerseInputBlur={handleVerseInputBlur}   // Pass the handler
        onVerseSliderChange={handleVerseSliderChange} // Pass the handler
        onJuzChange={handleJuzChange}             // Pass the handler
        onPageChange={handlePageChange}           // Pass the handler
        isLoading={isAppLoading || isVerseLoading} // Combined loading state for controls
        quranMeta={quranMeta}
      />

       {/* Floating Action Button (FAB) for Settings */}
       <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="default" // Use default variant for FAB appearance
                    size="icon"
                    className="fixed bottom-24 right-4 md:right-6 z-20 h-14 w-14 rounded-full shadow-lg" // Adjusted right position
                    aria-label="Open Settings"
                    onClick={toggleSettingsPanel}
                    disabled={isAppLoading} // Disable FAB if app is still initializing
                >
                    <Settings className="h-6 w-6" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
                <p>Display Settings</p>
            </TooltipContent>
        </Tooltip>
       </TooltipProvider>


       {/* Settings Panel Component (managed visibility via state) */}
      <SettingsPanel
          isOpen={isSettingsPanelOpen} // Control visibility with state
          onOpenChange={setIsSettingsPanelOpen} // Allow panel to close itself
          fontSize={fontSize}
          arabicFontSize={arabicFontSize}
          lineHeight={lineHeight}
          translations={translations} // Pass fetched/fallback translations
          selectedTranslation={selectedTranslation} // Pass current selection
          onFontSizeChange={handleFontSizeChange}
          onArabicFontSizeChange={handleArabicFontSizeChange}
          onLineHeightChange={handleLineHeightChange}
          onTranslationChange={handleTranslationChange} // Pass the handler
          isLoading={isLoadingTranslations || isAppLoading} // Disable if translations or app are loading
      />
    </div>
  );
}

