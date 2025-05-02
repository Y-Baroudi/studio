

'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Verse, Reciter, QuranMeta, Translation } from '@/services/alquran-cloud';
import { getVerse, getReciters, getQuranMeta, getTranslations, SUPPORTED_TRANSLATIONS, getSurahData, surahAyahToAbsoluteVerse, absoluteVerseToSurahAyah } from '@/services/alquran-cloud';
import { VerseDisplay } from './VerseDisplay';
import { Controls } from './Controls';
import { NotesSidebar } from './NotesSidebar';
import { SettingsPanel } from './SettingsPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Settings, ChevronDown, ChevronsDown, Loader2 } from 'lucide-react'; // Added loading/more icons
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area'; // For scrollable container
import { useInView } from 'react-intersection-observer'; // For detecting when to load more

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION_ID = SUPPORTED_TRANSLATIONS[0]?.id ?? '';
const DEFAULT_RECITER_ID = 'ar.alafasy';
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_ARABIC_FONT_SIZE = 24;
const DEFAULT_LINE_HEIGHT = 1.6;
const SWIPE_THRESHOLD = 50;
const VERSES_TO_LOAD_AT_ONCE = 15; // Number of verses to load initially/incrementally

export function ReaderView() {
  const [quranMeta, setQuranMeta] = useState<QuranMeta | null>(null);
  // --- State for Continuous Scrolling ---
  const [displayedVerses, setDisplayedVerses] = useState<Verse[]>([]); // Array to hold currently shown verses
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number | null>(null); // Track the currently loaded surah
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false); // Loading state for fetching more verses
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true); // Flag if more verses can be loaded for the current surah
  const [initialVerseLoadComplete, setInitialVerseLoadComplete] = useState<boolean>(false); // Track initial load

  // --- Existing State ---
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [translations, setTranslations] = useState<Translation[]>(SUPPORTED_TRANSLATIONS);
  const [selectedReciter, setSelectedReciter] = useState<string>(DEFAULT_RECITER_ID);
  const [selectedTranslation, setSelectedTranslation] = useState<string>(DEFAULT_TRANSLATION_ID);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(DEFAULT_VERSE_NUMBER); // The *focused* verse number
  const [playingVerseNumber, setPlayingVerseNumber] = useState<number | null>(null); // Track which verse is currently playing audio
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [arabicFontSize, setArabicFontSize] = useState<number>(DEFAULT_ARABIC_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState<number>(DEFAULT_LINE_HEIGHT);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [isLoadingVerse, setIsLoadingVerse] = useState<boolean>(true); // Now represents loading the *initial* block or navigating
  const [isLoadingReciters, setIsLoadingReciters] = useState<boolean>(true);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Refs and Intersection Observer
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null); // Ref for the scrollable container
  const verseRefs = useRef<Map<number, HTMLDivElement | null>>(new Map()); // Refs for individual verse elements

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0.1, // Trigger when 10% of the element is visible
    // triggerOnce: true, // Don't trigger multiple times while visible
  });

  // --- Fetch Metadata, Reciters, Translations (Mostly unchanged) ---
  const fetchMetaData = useCallback(async () => {
    setIsLoadingMeta(true);
    setError(null);
    try {
      const meta = await getQuranMeta();
      setQuranMeta(meta);
      // Trigger initial verse load once meta is available
      const initialVerseLocation = absoluteVerseToSurahAyah(DEFAULT_VERSE_NUMBER, meta);
      if (initialVerseLocation) {
        setCurrentSurahNumber(initialVerseLocation.surahNumber);
      }
    } catch (err) {
      console.error('Error fetching Quran metadata:', err);
      setError('Failed to load Quran structure. Please refresh.');
      setQuranMeta(null);
    } finally {
      setIsLoadingMeta(false);
    }
  }, []); // Removed dependency on DEFAULT_VERSE_NUMBER

  useEffect(() => {
    fetchMetaData();
  }, [fetchMetaData]);

   // --- Fetch Verse/Surah Data Logic (Adapted for Continuous Scroll) ---
   const loadSurahVerses = useCallback(async (surahNum: number, startVerseIndex: number = 0, count: number = VERSES_TO_LOAD_AT_ONCE) => {
     if (!quranMeta || !translationIdentifier || !reciterIdentifier) {
       console.warn("Cannot load verses: Missing metadata or edition selection.");
       setError("Required data missing to load verses.");
       setCanLoadMore(false); // Prevent further loading attempts
       return;
     }
     if (isLoadingMore || isLoadingVerse) return; // Prevent concurrent loads

     const surahMeta = quranMeta.surahs.references.find(s => s.number === surahNum);
     if (!surahMeta) {
         setError(`Metadata for Surah ${surahNum} not found.`);
         setCanLoadMore(false);
         return;
     }

     const isInitialLoad = startVerseIndex === 0;
     if (isInitialLoad) {
         setIsLoadingVerse(true); // Indicate initial loading for the surah/block
         setDisplayedVerses([]); // Clear previous surah's verses
         setInitialVerseLoadComplete(false);
     } else {
         setIsLoadingMore(true); // Indicate loading *more* verses
     }
     setError(null);

     try {
          // Fetch a chunk of verses using getSurahData if efficient, or fallback to getVerse loop
          // NOTE: getSurahData might be more efficient for full surah loads.
          // For incremental loading, looping getVerse might be necessary if getSurahData doesn't support offsets well.
          // Let's assume getSurahData fetches the whole surah for now and we slice it.
          // A more optimized approach would involve an API that supports pagination or specific ranges.

          // We will simulate incremental loading using getVerse for now
          const versesToFetch: number[] = [];
          const startAbsoluteVerse = surahAyahToAbsoluteVerse(surahNum, startVerseIndex + 1, quranMeta); // +1 because index is 0-based
          if (startAbsoluteVerse === null) throw new Error("Invalid start verse calculation.");

          for (let i = 0; i < count; i++) {
              const currentAyahIndex = startVerseIndex + i;
              if (currentAyahIndex >= surahMeta.numberOfAyahs) break; // Stop if we exceed surah length
              const absoluteVerse = startAbsoluteVerse + i;
              versesToFetch.push(absoluteVerse);
          }

          if (versesToFetch.length === 0) {
              setCanLoadMore(false); // No more verses to fetch for this surah
              if (isInitialLoad) setIsLoadingVerse(false);
              else setIsLoadingMore(false);
              return;
          }

          const fetchedVersePromises = versesToFetch.map(verseNum =>
               getVerse(verseNum, selectedTranslation, selectedReciter, quranMeta)
          );
          const newVerses = (await Promise.all(fetchedVersePromises)).filter(v => v !== null) as Verse[];


         if (newVerses.length > 0) {
              setDisplayedVerses(prev => [...prev, ...newVerses]);
              setCanLoadMore(newVerses[newVerses.length - 1].ayahNumberInSurah < surahMeta.numberOfAyahs);
         } else {
             // Handle case where fetching returned no valid verses (e.g., all failed)
             if (isInitialLoad) setError(`Failed to load initial verses for Surah ${surahNum}.`);
              setCanLoadMore(false); // Stop trying to load more if fetch failed
         }

     } catch (err) {
         console.error(`Error loading verses for Surah ${surahNum}:`, err);
         setError(`Failed to load verses. ${err instanceof Error ? err.message : ''}`);
         setCanLoadMore(false); // Stop loading on error
     } finally {
          if (isInitialLoad) {
            setIsLoadingVerse(false);
            setInitialVerseLoadComplete(true); // Mark initial load as done
          } else {
             setIsLoadingMore(false);
          }
     }
   }, [quranMeta, selectedTranslation, selectedReciter, isLoadingMore, isLoadingVerse, error]); // Added error dependency


   // Trigger initial load when surah changes or metadata/editions are ready
   useEffect(() => {
       if (currentSurahNumber && quranMeta && selectedTranslation && selectedReciter && !initialVerseLoadComplete && !isLoadingVerse) {
           loadSurahVerses(currentSurahNumber);
       }
       // Reset initial load completion flag if dependencies change (e.g., surah, translation)
       // This ensures we reload if the user navigates or changes settings.
       if (currentSurahNumber && quranMeta && selectedTranslation && selectedReciter) {
           setInitialVerseLoadComplete(false);
           setCanLoadMore(true); // Assume we can load more initially
       }
   }, [currentSurahNumber, quranMeta, selectedTranslation, selectedReciter, loadSurahVerses, initialVerseLoadComplete, isLoadingVerse]);


   // Trigger loading more verses when the trigger element is in view
   useEffect(() => {
       if (loadMoreInView && canLoadMore && !isLoadingMore && currentSurahNumber && displayedVerses.length > 0) {
           console.log("Load more triggered...");
           loadSurahVerses(currentSurahNumber, displayedVerses.length); // Load next batch starting from the current count
       }
   }, [loadMoreInView, canLoadMore, isLoadingMore, currentSurahNumber, displayedVerses.length, loadSurahVerses]);


   // Existing fetch functions for reciters and translations (unchanged)
    const fetchReciterList = useCallback(async () => {
        setIsLoadingReciters(true);
        // ... (rest of the function is the same)
         try {
          const fetchedReciters = await getReciters();
          setReciters(fetchedReciters);
          if (fetchedReciters.length > 0) {
             const isValidSelected = fetchedReciters.some(r => r.id === selectedReciter);
             if (!isValidSelected) {
                 const defaultExists = fetchedReciters.some(r => r.id === DEFAULT_RECITER_ID);
                 const newReciter = defaultExists ? DEFAULT_RECITER_ID : fetchedReciters[0].id;
                 setSelectedReciter(newReciter);
             }
           } else {
             setSelectedReciter('');
           }
        } catch (err) { /* ... */ } finally { setIsLoadingReciters(false); }
    }, [selectedReciter]);

    useEffect(() => { fetchReciterList(); }, [fetchReciterList]);

    const fetchTranslationList = useCallback(async () => {
        setIsLoadingTranslations(true);
        // ... (rest of the function is the same)
        try {
            const fetchedTranslations = await getTranslations();
            setTranslations(fetchedTranslations);
            if (fetchedTranslations.length > 0) {
                const isValidSelected = fetchedTranslations.some(t => t.id === selectedTranslation);
                if (!isValidSelected) {
                    const defaultExists = fetchedTranslations.some(t => t.id === DEFAULT_TRANSLATION_ID);
                    const newTranslation = defaultExists ? DEFAULT_TRANSLATION_ID : fetchedTranslations[0].id;
                    setSelectedTranslation(newTranslation);
                    if (!isValidSelected && selectedTranslation) {
                        toast({ title: "Translation Reset", description: `Switched to ${newTranslation}.` });
                    }
                }
            } else {
                setSelectedTranslation('');
            }
        } catch (err) { /* ... */ } finally { setIsLoadingTranslations(false); }
    }, [selectedTranslation, toast]);

    useEffect(() => { fetchTranslationList(); }, [fetchTranslationList]);

   // --- Navigation and Interaction Handlers ---

    const navigateToVerse = useCallback((absoluteVerseNum: number, scroll: boolean = true) => {
        if (!quranMeta) return;
        const targetLocation = absoluteVerseToSurahAyah(absoluteVerseNum, quranMeta);
        if (!targetLocation) {
            toast({ title: "Navigation Error", description: `Verse ${absoluteVerseNum} is invalid.`, variant: "destructive" });
            return;
        }

        setCurrentVerseNumber(absoluteVerseNum); // Set the focused verse

        // Check if the target verse's surah is already loaded
        if (targetLocation.surahNumber !== currentSurahNumber) {
            console.log(`Navigating to new Surah: ${targetLocation.surahNumber}`);
            setCurrentSurahNumber(targetLocation.surahNumber); // This will trigger useEffect to load the new surah
            setDisplayedVerses([]); // Clear old verses immediately
            setInitialVerseLoadComplete(false); // Reset load state
            setCanLoadMore(true); // Reset load more state
            setIsLoadingVerse(true); // Set loading state for the new surah
        } else {
            // Surah is already loaded, just scroll to the verse if needed
            if (scroll) {
                const verseElement = verseRefs.current.get(absoluteVerseNum);
                verseElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [quranMeta, currentSurahNumber, toast]);


    const handleNextVerse = useCallback(() => {
        const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
        const nextVerse = Math.min(currentVerseNumber + 1, maxVerse);
        navigateToVerse(nextVerse);
    }, [quranMeta, currentVerseNumber, navigateToVerse]);

    const handlePreviousVerse = useCallback(() => {
        const prevVerse = Math.max(1, currentVerseNumber - 1);
        navigateToVerse(prevVerse);
    }, [currentVerseNumber, navigateToVerse]);

    // --- Handlers for Controls Component ---
    const handleReciterChange = (reciterId: string) => {
        setSelectedReciter(reciterId);
        setInitialVerseLoadComplete(false); // Force reload on reciter change
    };

    const handleTranslationChange = (translationId: string) => {
        if (translationId !== selectedTranslation) {
            setSelectedTranslation(translationId);
            setInitialVerseLoadComplete(false); // Force reload on translation change
            toast({
                title: "Translation Changed",
                description: `Loading verse with ${translations.find(t => t.id === translationId)?.name ?? translationId}.`,
            });
        }
    };

    const handleFontSizeChange = (value: number[]) => setFontSize(value[0]);
    const handleArabicFontSizeChange = (value: number[]) => setArabicFontSize(value[0]);
    const handleLineHeightChange = (value: number[]) => setLineHeight(value[0]);

    const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
        if (!isNaN(value) && value >= 1 && value <= maxVerse) {
            if (value !== currentVerseNumber) {
                navigateToVerse(value);
            }
        } else {
            e.target.value = currentVerseNumber.toString();
            toast({ title: "Invalid Verse", description: `Enter verse 1-${maxVerse}.`, variant: "destructive" });
        }
    };

    const handleVerseSliderChange = (value: number[]) => {
        // Update slider visually but only navigate on commit (or debounce)
        // For simplicity, let's navigate immediately for now
        if (value[0] !== currentVerseNumber) {
            navigateToVerse(value[0], false); // Navigate without immediate scroll, rely on user interaction
        }
    };

     const handleJuzChange = (juz: number) => {
         const startVerse = JUZ_STARTS[juz];
         if (startVerse && startVerse !== currentVerseNumber) {
             navigateToVerse(startVerse);
             toast({ title: "Navigated", description: `Jumped to Juz ${juz} (Verse ${startVerse}).` });
         }
     };

     const handlePageChange = (page: number) => {
         const startVerse = PAGE_STARTS[page];
         if (startVerse && startVerse !== currentVerseNumber) {
             navigateToVerse(startVerse);
             toast({ title: "Navigated", description: `Jumped to Page ${page} (Verse ${startVerse}).` });
         }
     };

    // --- Context Menu ---
    const handleVerseContextMenu = (verseNumber: number) => {
        setCurrentVerseNumber(verseNumber); // Focus the verse for context actions
        setIsNotesSidebarOpen(true);
    };

    // --- Swipe Gestures ---
    const handleTouchStart = (e: React.TouchEvent) => {
        if (isMobile) { touchStartX.current = e.targetTouches[0].clientX; touchEndX.current = null; }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (isMobile && touchStartX.current !== null) { touchEndX.current = e.targetTouches[0].clientX; }
    };
    const handleTouchEnd = () => {
        if (!isMobile || touchStartX.current === null || touchEndX.current === null) return;
        const dx = touchEndX.current - touchStartX.current;
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx > 0) handlePreviousVerse(); else handleNextVerse();
        }
        touchStartX.current = null; touchEndX.current = null;
    };

    // --- Toggle Sidebars/Panels ---
    const toggleNotesSidebar = () => setIsNotesSidebarOpen(prev => !prev);
    const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);

    // --- Audio Playback Sync ---
    const handleAudioPlay = (verseNum: number) => {
        setPlayingVerseNumber(verseNum);
        setCurrentVerseNumber(verseNum); // Also focus the verse when it starts playing
        // Scroll to playing verse
        const verseElement = verseRefs.current.get(verseNum);
        verseElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const handleAudioPause = () => setPlayingVerseNumber(null);
    const handleAudioEnd = () => { // Called when audio for a verse naturally ends
        setPlayingVerseNumber(null);
        // Auto-advance to next verse logic handled in Controls component
        // handleNextVerse(); // Let Controls handle auto-advance via onNextVerse prop
    };
    const handleAudioError = (errorMsg: string) => {
         setPlayingVerseNumber(null);
         toast({ title: "Audio Error", description: errorMsg, variant: "destructive" });
    };


    // Combine relevant loading states
    const isAppLoading = isLoadingMeta || isLoadingReciters || isLoadingTranslations;
    const displayError = error && !isLoadingVerse && !isLoadingMore;

    const currentVerseDataForSidebars = displayedVerses.find(v => v.verseNumber === currentVerseNumber);


    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 pb-36 relative"> {/* Increased bottom padding */}

            {/* Main Content Area with Scroll */}
            <ScrollArea
                ref={scrollContainerRef}
                className="h-[calc(100vh-250px)] w-full rounded-lg border border-border shadow-md" // Adjust height calculation as needed
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: isMobile ? 'pan-y' : 'auto' }}
            >
                 <div className="p-1 md:p-2 relative"> {/* Add slight padding */}
                    {/* Top Buttons (Notes/Settings FAB is outside now) */}
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                         <NotesSidebar
                             currentVerseNumber={currentVerseNumber}
                             isOpen={isNotesSidebarOpen}
                             onOpenChange={setIsNotesSidebarOpen}
                             surahName={currentVerseDataForSidebars?.surah?.englishName ?? ''}
                             ayahNumber={currentVerseDataForSidebars?.verseReference?.split(':')[1] ?? ''}
                         />
                    </div>

                    {/* Loading States */}
                    {isAppLoading && !initialVerseLoadComplete && (
                        <div className="flex flex-col justify-center items-center h-60 gap-4 p-6">
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-20 w-full mt-4" />
                            <p className="text-center text-muted-foreground mt-2">Initializing...</p>
                        </div>
                    )}
                     {isLoadingVerse && displayedVerses.length === 0 && ( // Initial verse loading
                        <div className="p-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="mb-6 p-4 border rounded-lg animate-pulse">
                                     <Skeleton className="h-6 w-1/4 mb-2" />
                                    <Skeleton className="h-4 w-1/3 mb-4" />
                                    <Skeleton className="h-20 w-full mb-4" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ))}
                        </div>
                    )}
                    {displayError && (
                        <div className="flex justify-center items-center h-60 p-6">
                            <p className="text-destructive text-center">{error}</p>
                            {/* Optional: Add a retry button */}
                            <Button onClick={() => loadSurahVerses(currentSurahNumber ?? 1)} className="mt-4">Retry</Button>
                        </div>
                    )}

                    {/* Verse Display Area */}
                     {!isAppLoading && !isLoadingVerse && displayedVerses.length === 0 && !error && (
                         <div className="flex justify-center items-center h-60 p-6">
                             <p className="text-center text-muted-foreground">No verses to display. Select a surah or verse.</p>
                         </div>
                     )}

                     {/* Render Displayed Verses */}
                     {displayedVerses.map((verse) => (
                        <div key={verse.verseNumber} ref={el => verseRefs.current.set(verse.verseNumber, el)} className="mb-4">
                            <VerseDisplay
                                verse={verse}
                                fontSize={fontSize}
                                arabicFontSize={arabicFontSize}
                                lineHeight={lineHeight}
                                onContextMenu={handleVerseContextMenu}
                                isHighlighted={verse.verseNumber === currentVerseNumber} // Highlight focused verse
                                isPlaying={verse.verseNumber === playingVerseNumber} // Indicate playing verse
                            />
                        </div>
                    ))}

                    {/* Load More Trigger/Indicator */}
                     {canLoadMore && !error && (
                        <div ref={loadMoreRef} className="flex justify-center items-center py-6 text-center">
                           {isLoadingMore ? (
                             <Button variant="ghost" disabled>
                               <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading More...
                             </Button>
                           ) : (
                             <TooltipProvider>
                               <Tooltip>
                                  <TooltipTrigger asChild>
                                     <Button
                                         variant="outline"
                                         onClick={() => loadSurahVerses(currentSurahNumber!, displayedVerses.length)}
                                         disabled={isLoadingMore}
                                     >
                                         <ChevronsDown className="h-5 w-5" />
                                         <span className="sr-only">Load More Verses</span>
                                     </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Load Next {VERSES_TO_LOAD_AT_ONCE} Verses</TooltipContent>
                               </Tooltip>
                             </TooltipProvider>
                           )}
                         </div>
                     )}
                     {!canLoadMore && initialVerseLoadComplete && !error && (
                         <div className="text-center text-muted-foreground py-6 text-sm">End of Surah</div>
                     )}
                </div>
            </ScrollArea>

            {/* Controls fixed at the bottom */}
            <Controls
                verseNumber={currentVerseNumber} // Controls use the *focused* verse number
                audioUrl={displayedVerses.find(v => v.verseNumber === currentVerseNumber)?.audioUrl ?? null} // Audio URL for the focused verse
                reciters={reciters}
                selectedReciter={selectedReciter}
                onNextVerse={handleNextVerse} // Let Controls handle advancing focus
                onPreviousVerse={handlePreviousVerse}
                onReciterChange={handleReciterChange}
                onVerseInputChange={()=>{}} // Input change handled by blur
                onVerseInputBlur={handleVerseInputBlur}
                onVerseSliderChange={handleVerseSliderChange}
                onJuzChange={handleJuzChange}
                onPageChange={handlePageChange}
                isLoading={isLoadingVerse || isLoadingMore || isAppLoading} // Controls disabled during any loading
                quranMeta={quranMeta}
                 // Add audio event handlers
                onPlay={() => handleAudioPlay(currentVerseNumber)} // Play the focused verse
                onPause={handleAudioPause}
                onEnded={handleAudioEnd}
                onError={handleAudioError}
                updatePlayingVerse={setPlayingVerseNumber} // Allow Controls to update playing state directly for sync
            />

            {/* Floating Action Button (FAB) for Settings */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="default"
                            size="icon"
                            className="fixed bottom-28 right-4 md:right-6 z-20 h-14 w-14 rounded-full shadow-lg"
                            aria-label="Open Settings"
                            onClick={toggleSettingsPanel}
                            disabled={isAppLoading}
                        >
                            <Settings className="h-6 w-6" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p>Display Settings</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Settings Panel Component */}
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
                isLoading={isLoadingTranslations || isAppLoading}
            />
        </div>
    );
}
