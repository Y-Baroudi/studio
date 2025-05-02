'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Verse, Reciter, QuranMeta, Translation, SurahMeta } from '@/services/alquran-cloud';
import {
  getVerse, // Keep for potential single verse context actions, but prefer getSurahData for reading
  getReciters,
  getQuranMeta,
  getTranslations,
  SUPPORTED_TRANSLATIONS,
  getSurahData, // Primary function for loading verse blocks
  surahAyahToAbsoluteVerse,
  absoluteVerseToSurahAyah
} from '@/services/alquran-cloud';
import { VerseDisplay } from './VerseDisplay';
import { Controls } from './Controls';
import { NotesSidebar } from './NotesSidebar';
import { SettingsPanel } from './SettingsPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Settings, ChevronDown, ChevronsDown, Loader2, AlertCircle } from 'lucide-react'; // Added AlertCircle icon
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInView } from 'react-intersection-observer';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils'; // Import cn for conditional classes

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION_ID = SUPPORTED_TRANSLATIONS[0]?.id ?? 'en.clearquran'; // Default to clearquran
const DEFAULT_RECITER_ID = 'ar.alafasy';
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_ARABIC_FONT_SIZE = 24;
const DEFAULT_LINE_HEIGHT = 1.6;
const SWIPE_THRESHOLD = 50;
const VERSES_TO_LOAD_AT_ONCE = 10; // Adjust number of verses per batch

export function ReaderView() {
  const [quranMeta, setQuranMeta] = useState<QuranMeta | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [translations, setTranslations] = useState<Translation[]>(SUPPORTED_TRANSLATIONS);
  const [selectedReciter, setSelectedReciter] = useState<string>(DEFAULT_RECITER_ID);
  const [selectedTranslation, setSelectedTranslation] = useState<string>(DEFAULT_TRANSLATION_ID);

  const [currentAbsoluteVerse, setCurrentAbsoluteVerse] = useState<number>(DEFAULT_VERSE_NUMBER); // Focused verse
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number | null>(null); // Track the *primary* loaded surah for display
  const [displayedVerses, setDisplayedVerses] = useState<Verse[]>([]); // Holds all loaded verses
  const [playingVerseNumber, setPlayingVerseNumber] = useState<number | null>(null); // Track playing audio

  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [arabicFontSize, setArabicFontSize] = useState<number>(DEFAULT_ARABIC_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState<number>(DEFAULT_LINE_HEIGHT);

  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [isLoadingReciters, setIsLoadingReciters] = useState<boolean>(true);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState<boolean>(true);
  const [isLoadingVerses, setIsLoadingVerses] = useState<boolean>(false); // Combined loading state for verses
  const [canLoadMore, setCanLoadMore] = useState<boolean>(false); // Flag if more verses can be loaded
  const [error, setError] = useState<string | null>(null);

  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Refs and Intersection Observer
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container viewport
  const verseRefs = useRef<Map<number, HTMLDivElement | null>>(new Map()); // Refs for individual verse elements
  const isProgrammaticScroll = useRef<boolean>(false); // Flag to prevent scroll events during programmatic scroll
  const programmaticScrollTimeout = useRef<NodeJS.Timeout | null>(null); // Timeout for programmatic scroll flag

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0.1,
    root: scrollContainerRef.current, // Observe within the scrollable container
  });

  // --- Fetch Metadata, Reciters, Translations ---
  const fetchInitialData = useCallback(async () => {
    setIsLoadingMeta(true);
    setIsLoadingReciters(true);
    setIsLoadingTranslations(true);
    setError(null);
    try {
      const [meta, fetchedReciters, fetchedTranslations] = await Promise.all([
        getQuranMeta(),
        getReciters(),
        getTranslations(),
      ]);

      setQuranMeta(meta);
      setReciters(fetchedReciters);
      setTranslations(fetchedTranslations);

      // Validate selected reciter/translation against fetched lists
      const isValidReciter = fetchedReciters.some(r => r.id === selectedReciter);
      if (!isValidReciter && fetchedReciters.length > 0) {
        setSelectedReciter(fetchedReciters[0].id);
      } else if (fetchedReciters.length === 0) {
        setSelectedReciter('');
      }

      const isValidTranslation = fetchedTranslations.some(t => t.id === selectedTranslation);
       if (!isValidTranslation && fetchedTranslations.length > 0) {
            const defaultExists = fetchedTranslations.some(t => t.id === DEFAULT_TRANSLATION_ID);
            const newTranslation = defaultExists ? DEFAULT_TRANSLATION_ID : fetchedTranslations[0].id;
            setSelectedTranslation(newTranslation);
            if (!isValidTranslation && selectedTranslation) {
                toast({ title: "Translation Reset", description: `Switched to ${newTranslation}.` });
            }
       } else if (fetchedTranslations.length === 0) {
         setSelectedTranslation('');
       }


      // Set initial surah based on default verse
      const initialLocation = absoluteVerseToSurahAyah(DEFAULT_VERSE_NUMBER, meta);
      if (initialLocation) {
        setCurrentSurahNumber(initialLocation.surahNumber);
      } else {
        setError("Could not determine initial surah.");
      }

    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError('Failed to load essential Quran data. Please refresh.');
      setQuranMeta(null);
      setReciters([]);
      setTranslations([]);
    } finally {
      setIsLoadingMeta(false);
      setIsLoadingReciters(false);
      setIsLoadingTranslations(false);
    }
  }, [selectedReciter, selectedTranslation, toast]); // Add dependencies

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);


   // --- Verse Loading Logic ---
   const loadVerses = useCallback(async (surahNum: number, startAyahNum: number = 1, replace: boolean = false) => {
     if (!quranMeta || !selectedTranslation || isLoadingVerses) return;

     console.log(`loadVerses called: Surah ${surahNum}, Start Ayah ${startAyahNum}, Replace: ${replace}`);
     setIsLoadingVerses(true);
     if (replace) setError(null); // Clear previous errors only on replace/navigate

     const surahMeta = quranMeta.surahs.references.find(s => s.number === surahNum);
     if (!surahMeta) {
        setError(`Metadata for Surah ${surahNum} not found.`);
        setIsLoadingVerses(false);
        setCanLoadMore(false);
        return;
     }

      // Calculate the range of verses to fetch based on AYAH number within the surah
      const startVerseIndex = startAyahNum - 1; // API/arrays are often 0-indexed
      const endVerseIndex = Math.min(startVerseIndex + VERSES_TO_LOAD_AT_ONCE - 1, surahMeta.numberOfAyahs - 1);
      const numberOfVersesToFetch = endVerseIndex - startVerseIndex + 1;

      console.log(`Fetching ${numberOfVersesToFetch} verses (Ayah ${startAyahNum} to ${endVerseIndex + 1}) for Surah ${surahNum}`);

     try {
       // Use getSurahData to fetch a block. Assuming it fetches the whole surah, we'll filter later.
       // A more optimized API would allow fetching ranges.
       // For now, let's simulate fetching a range using getVerse for demonstration if getSurahData is too heavy.
       // **Correction:** Let's trust getSurahData to fetch the whole surah efficiently and we manage display.
       // This avoids multiple API calls but uses more memory.

       // **Revised approach:** Fetch only the *required* block using getVerse for simplicity and to avoid huge initial loads
       const versesToFetchPromises: Promise<Verse | null>[] = [];
       const firstAbsoluteVerse = surahAyahToAbsoluteVerse(surahNum, startAyahNum, quranMeta);

       if (firstAbsoluteVerse === null) {
          throw new Error(`Could not calculate absolute verse for ${surahNum}:${startAyahNum}`);
       }

       for (let i = 0; i < numberOfVersesToFetch; i++) {
           const absoluteVerseNum = firstAbsoluteVerse + i;
           versesToFetchPromises.push(getVerse(absoluteVerseNum, selectedTranslation, selectedReciter, quranMeta));
       }

       const fetchedVersesNullable = await Promise.all(versesToFetchPromises);
       const newVerses = fetchedVersesNullable.filter(v => v !== null) as Verse[]; // Filter out nulls

       if (newVerses.length === 0 && numberOfVersesToFetch > 0) {
          // This means fetching failed for all verses in the range
           console.warn(`Failed to fetch any verses in range ${startAyahNum}-${endVerseIndex + 1} for Surah ${surahNum}.`);
           if(replace) setError(`Failed to load verses for Surah ${surahNum}. Please try again.`);
           setCanLoadMore(false); // Stop trying if fetching fails
       } else {
           // Update displayed verses
           setDisplayedVerses(prev => replace ? newVerses : [...prev, ...newVerses]);
           // Determine if more verses can be loaded
           const lastLoadedAyah = newVerses[newVerses.length - 1]?.ayahNumberInSurah;
           setCanLoadMore(lastLoadedAyah < surahMeta.numberOfAyahs);
       }

     } catch (err) {
       console.error(`Error loading verses for Surah ${surahNum} starting from ayah ${startAyahNum}:`, err);
       setError(`Failed to load verses. ${err instanceof Error ? err.message : ''}. Please check your connection or settings.`);
       setCanLoadMore(false);
     } finally {
       setIsLoadingVerses(false);
     }
   }, [quranMeta, selectedTranslation, selectedReciter, isLoadingVerses]);


  // Trigger initial verse load when essential data is ready
   useEffect(() => {
     // Load initial block only when metadata, editions are selected, and no verses are loaded yet
     if (quranMeta && selectedTranslation && currentSurahNumber && displayedVerses.length === 0 && !isLoadingVerses) {
       console.log(`Initial load triggered for Surah ${currentSurahNumber}`);
       loadVerses(currentSurahNumber, 1, true); // Load first block, replace existing
     }
   }, [quranMeta, selectedTranslation, selectedReciter, currentSurahNumber, displayedVerses.length, loadVerses, isLoadingVerses]);


   // Trigger loading more verses when the trigger element is in view
   useEffect(() => {
       if (loadMoreInView && canLoadMore && !isLoadingVerses && currentSurahNumber && displayedVerses.length > 0) {
           const nextAyahToLoad = displayedVerses[displayedVerses.length - 1].ayahNumberInSurah + 1;
           console.log(`Load more triggered: Loading from Ayah ${nextAyahToLoad} in Surah ${currentSurahNumber}`);
           loadVerses(currentSurahNumber, nextAyahToLoad, false); // Append new verses
       }
   }, [loadMoreInView, canLoadMore, isLoadingVerses, currentSurahNumber, displayedVerses, loadVerses]);


  // --- Navigation Logic ---
   const scrollToVerse = useCallback((absoluteVerseNum: number) => {
     if (programmaticScrollTimeout.current) {
       clearTimeout(programmaticScrollTimeout.current);
     }
     isProgrammaticScroll.current = true;

     const verseElement = verseRefs.current.get(absoluteVerseNum);
     verseElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });

     // Reset the flag after scrolling animation likely completes
     programmaticScrollTimeout.current = setTimeout(() => {
       isProgrammaticScroll.current = false;
     }, 1000); // Adjust timeout as needed
   }, []);


   const navigateToVerse = useCallback((absoluteVerseNum: number, scroll: boolean = true) => {
     if (!quranMeta) return;

     const targetLocation = absoluteVerseToSurahAyah(absoluteVerseNum, quranMeta);
     if (!targetLocation) {
       toast({ title: "Navigation Error", description: `Verse ${absoluteVerseNum} is invalid.`, variant: "destructive" });
       return;
     }

     const { surahNumber: targetSurahNum, ayahNumber: targetAyahNum } = targetLocation;

     // Update the focused verse state immediately
     setCurrentAbsoluteVerse(absoluteVerseNum);

     // Check if the target verse's surah is different from the *currently displayed primary* surah
     if (targetSurahNum !== currentSurahNumber) {
       console.log(`Navigating to new Surah: ${targetSurahNum}`);
       // Stop any playing audio
       setPlayingVerseNumber(null);
       // Update the primary surah number
       setCurrentSurahNumber(targetSurahNum);
       // Clear existing verses and initiate loading the new surah's first block
       setDisplayedVerses([]); // Clear immediately
       setCanLoadMore(true); // Reset load more flag
       // loadVerses will be triggered by the useEffect watching currentSurahNumber change
     } else {
        // Surah is the same, check if the verse is already loaded
        const isVerseLoaded = displayedVerses.some(v => v.verseNumber === absoluteVerseNum);
        if (!isVerseLoaded) {
            // Verse is in the same surah but not loaded yet (e.g., jumped far ahead)
            console.warn(`Verse ${absoluteVerseNum} in Surah ${targetSurahNum} not loaded. Re-loading surah from this verse.`);
            // Stop any playing audio
            setPlayingVerseNumber(null);
            setDisplayedVerses([]); // Clear potentially incomplete list
            setCanLoadMore(true);
            loadVerses(targetSurahNum, targetAyahNum, true); // Load starting from the target ayah
            // Optionally, scroll after loading completes (might need another mechanism)
        } else if (scroll) {
          // Verse is loaded, just scroll to it
          scrollToVerse(absoluteVerseNum);
        }
     }
   }, [quranMeta, currentSurahNumber, displayedVerses, loadVerses, scrollToVerse, toast]); // Added dependencies


    const handleNextVerseFocus = useCallback(() => {
        const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
        const nextVerse = Math.min(currentAbsoluteVerse + 1, maxVerse);
        navigateToVerse(nextVerse);
    }, [quranMeta, currentAbsoluteVerse, navigateToVerse]);

    const handlePreviousVerseFocus = useCallback(() => {
        const prevVerse = Math.max(1, currentAbsoluteVerse - 1);
        navigateToVerse(prevVerse);
    }, [currentAbsoluteVerse, navigateToVerse]);

  // --- Control Event Handlers ---
  const handleReciterChange = (reciterId: string) => {
    if (reciterId !== selectedReciter) {
        console.log("Reciter changed to:", reciterId);
        setSelectedReciter(reciterId);
         // When reciter changes, we *don't* need to reload all verse text/translation.
         // We only need to update the audioUrl for the *currently focused* verse in the Controls.
         // The Controls component will fetch the new URL when its `audioUrl` prop updates.
         // Let's refetch the *current* verse data to get the new audio URL.
         refetchCurrentVerseData();
    }
  };

   const handleTranslationChange = (translationId: string) => {
     if (translationId !== selectedTranslation) {
       console.log("Translation changed to:", translationId);
       setSelectedTranslation(translationId);
       // Reload verses from the beginning of the current surah with the new translation
       if (currentSurahNumber) {
          setDisplayedVerses([]); // Clear old translation
          setCanLoadMore(true);
          loadVerses(currentSurahNumber, 1, true); // Start reload
       }
       toast({
         title: "Translation Changed",
         description: `Loading verse with ${translations.find(t => t.id === translationId)?.name ?? translationId}.`,
       });
     }
   };

    // Helper to refetch data for the currently focused verse (e.g., after reciter change)
    const refetchCurrentVerseData = useCallback(async () => {
        if (!quranMeta || currentAbsoluteVerse === null) return;

        console.log(`Refetching data for verse ${currentAbsoluteVerse}`);
        setIsLoadingVerses(true); // Indicate loading briefly
        try {
            const verseData = await getVerse(currentAbsoluteVerse, selectedTranslation, selectedReciter, quranMeta);
            if (verseData) {
                // Update the specific verse in the displayedVerses array
                setDisplayedVerses(prev => {
                    const index = prev.findIndex(v => v.verseNumber === currentAbsoluteVerse);
                    if (index !== -1) {
                        const updatedVerses = [...prev];
                        updatedVerses[index] = verseData;
                        return updatedVerses;
                    }
                    // If not found (shouldn't happen often here), just return previous state
                    return prev;
                });
            } else {
                 console.warn(`Failed to refetch data for verse ${currentAbsoluteVerse}`);
                 // Handle error? Maybe show toast?
            }
        } catch (err) {
            console.error(`Error refetching verse ${currentAbsoluteVerse}:`, err);
        } finally {
            setIsLoadingVerses(false);
        }
    }, [currentAbsoluteVerse, quranMeta, selectedReciter, selectedTranslation]);


  // --- Settings Panel Handlers ---
  const handleFontSizeChange = (value: number[]) => setFontSize(value[0]);
  const handleArabicFontSizeChange = (value: number[]) => setArabicFontSize(value[0]);
  const handleLineHeightChange = (value: number[]) => setLineHeight(value[0]);

  // --- Verse Input/Slider Handlers ---
  const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
    if (!isNaN(value) && value >= 1 && value <= maxVerse) {
      if (value !== currentAbsoluteVerse) {
        navigateToVerse(value);
      }
    } else {
       toast({ title: "Invalid Verse", description: `Please enter a verse number between 1 and ${maxVerse}.`, variant: "destructive" });
        // Reset input to the current focused verse number
        e.target.value = currentAbsoluteVerse.toString();
    }
  };

   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
       // Update visual state immediately for responsiveness, but navigation happens onBlur or slider commit
       const value = parseInt(e.target.value, 10);
        const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
        if (!isNaN(value) && value >= 1 && value <= maxVerse) {
           // Temporarily update the displayed number in the input if needed,
           // but don't trigger navigation yet.
           // setCurrentAbsoluteVerse(value); // NO! This focuses immediately.
        } else if (e.target.value === '') {
            // Allow empty input while typing
        } else {
            // Maybe provide immediate feedback for invalid input?
        }
   };


  const handleVerseSliderChange = (value: number[]) => {
    // Update the focused verse number visually as the slider moves
    setCurrentAbsoluteVerse(value[0]);
  };

  const handleVerseSliderCommit = (value: number[]) => {
     // Navigate only when the user releases the slider
     console.log("Slider commit:", value[0]);
     navigateToVerse(value[0], true); // Navigate and scroll
  };

  // --- Jump To Handlers ---
  const handleJuzChange = (juz: number) => {
    const startVerse = JUZ_STARTS[juz];
    if (startVerse && startVerse !== currentAbsoluteVerse) {
      navigateToVerse(startVerse);
      toast({ title: "Navigated", description: `Jumped to Juz ${juz} (Verse ${startVerse}).` });
    }
  };

  const handlePageChange = (page: number) => {
    const startVerse = PAGE_STARTS[page];
    if (startVerse && startVerse !== currentAbsoluteVerse) {
      navigateToVerse(startVerse);
      toast({ title: "Navigated", description: `Jumped to Page ${page} (Verse ${startVerse}).` });
    }
  };

  // --- Context Menu & Interaction ---
  const handleVerseContextMenu = (verseNumber: number) => {
    setCurrentAbsoluteVerse(verseNumber); // Focus the verse for context actions
    setIsNotesSidebarOpen(true);
  };

  const handleVerseClick = (verseNumber: number) => {
      setCurrentAbsoluteVerse(verseNumber); // Focus verse on click
       // Maybe scroll to center it?
       // scrollToVerse(verseNumber); // Optional: scroll on click
  };


  // --- Swipe Gestures ---
   const handleTouchStart = (e: React.TouchEvent) => {
        // Prevent swipe if scrolling vertically
       if (e.touches.length === 1) {
           touchStartX.current = e.targetTouches[0].clientX;
           touchEndX.current = e.targetTouches[0].clientX; // Initialize endX
       }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && touchStartX.current !== null) {
            touchEndX.current = e.targetTouches[0].clientX;
        }
    };
    const handleTouchEnd = () => {
        if (!isMobile || touchStartX.current === null || touchEndX.current === null) return;
        const dx = touchEndX.current - touchStartX.current;

        // Add a threshold for vertical scroll detection if needed
        // const dy = touchEndY.current - touchStartY.current;
        // if (Math.abs(dy) > Math.abs(dx)) { /* Vertical scroll, ignore */ return; }

        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx > 0) { // Swipe right (previous)
                handlePreviousVerseFocus();
            } else { // Swipe left (next)
                handleNextVerseFocus();
            }
        }
        // Reset touch coordinates
        touchStartX.current = null;
        touchEndX.current = null;
    };

  // --- Toggle Sidebars/Panels ---
  const toggleNotesSidebar = () => setIsNotesSidebarOpen(prev => !prev);
  const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);

  // --- Audio Playback Sync ---
   const handleAudioPlay = () => {
      console.log("handleAudioPlay called, verse:", currentAbsoluteVerse);
      setPlayingVerseNumber(currentAbsoluteVerse);
      // Scroll to the playing verse only if it's not currently visible
      const verseElement = verseRefs.current.get(currentAbsoluteVerse);
       if (verseElement) {
            const rect = verseElement.getBoundingClientRect();
            const containerRect = scrollContainerRef.current?.getBoundingClientRect();
            if (containerRect && (rect.top < containerRect.top || rect.bottom > containerRect.bottom)) {
                 scrollToVerse(currentAbsoluteVerse);
            }
       } else {
            // If element isn't rendered, try scrolling after a short delay
            setTimeout(() => scrollToVerse(currentAbsoluteVerse), 100);
       }
   };
   const handleAudioPause = () => setPlayingVerseNumber(null);
   const handleAudioEnd = () => { // Called when audio for a verse naturally ends
        console.log("handleAudioEnd called for verse:", playingVerseNumber);
        // Check if it was the currently focused verse that ended
        if (playingVerseNumber === currentAbsoluteVerse) {
            setPlayingVerseNumber(null);
            // Auto-advance handled by Controls using onNextVerse
        } else {
            // Audio for a different verse ended (e.g., due to rapid navigation)
             setPlayingVerseNumber(null);
        }
   };
   const handleAudioError = (errorMsg: string) => {
        setPlayingVerseNumber(null);
        toast({ title: "Audio Playback Error", description: errorMsg, variant: "destructive" });
   };
    const updatePlayingVerseCallback = useCallback((verseNum: number | null) => {
       setPlayingVerseNumber(verseNum);
       if (verseNum !== null) {
          // If controls report a verse started playing, ensure it's the focused one
          setCurrentAbsoluteVerse(verseNum);
       }
    }, []);


  // --- Data for Child Components ---
  const currentVerseDataForAudio = displayedVerses.find(v => v.verseNumber === currentAbsoluteVerse);
  const currentVerseDataForSidebars = currentVerseDataForAudio; // Use the same data

  const isAppLoading = isLoadingMeta || isLoadingReciters || isLoadingTranslations;
  const displayError = error && !isLoadingVerses; // Show error if not currently loading verses

  // Get current Surah metadata for header/sidebar
   const currentSurahMetaData = quranMeta?.surahs.references.find(s => s.number === currentSurahNumber) ?? null;


  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 pb-32 relative"> {/* Reduced gap, adjusted bottom padding */}

      {/* Main Scrollable Content Area */}
      <div
        className="flex-grow overflow-hidden rounded-lg border border-border shadow-md relative bg-card" // Use card bg for consistency
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: isMobile ? 'pan-y pinch-zoom' : 'auto' }} // Allow vertical pan
      >
          {/* Wrap content in ScrollArea */}
          <ScrollArea
            className="h-[calc(100vh-230px)]" // Adjust height dynamically
            viewportRef={scrollContainerRef} // Assign ref to the viewport
          >
            <div className="p-1 md:p-2"> {/* Minimal padding inside scroll area */}
              {/* Loading Skeletons */}
               {(isAppLoading || (isLoadingVerses && displayedVerses.length === 0)) && (
                 <div className="p-4 md:p-6 space-y-6">
                   {[...Array(3)].map((_, i) => (
                     <div key={i} className="flex flex-col md:flex-row gap-4 border-b pb-4">
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-1/4" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                        <div className="flex-1 space-y-2">
                           <Skeleton className="h-5 w-1/4 ml-auto" />
                           <Skeleton className="h-20 w-full" />
                        </div>
                     </div>
                   ))}
                   <p className="text-center text-muted-foreground mt-4">
                     {isAppLoading ? 'Initializing...' : 'Loading Verses...'}
                   </p>
                 </div>
               )}

              {/* Error Display */}
              {displayError && (
                <div className="flex flex-col justify-center items-center h-60 p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                  <p className="text-destructive font-semibold mb-2">Loading Error</p>
                  <p className="text-sm text-muted-foreground mb-4">{error}</p>
                  <Button onClick={() => {
                      setError(null); // Clear error
                      if (currentSurahNumber) {
                         setDisplayedVerses([]); // Clear potentially broken list
                         loadVerses(currentSurahNumber, 1, true); // Retry loading current surah
                      } else {
                         fetchInitialData(); // Retry initial load if no surah is set
                      }
                  }}
                  variant="destructive"
                  size="sm"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Verse Display Area */}
              {!isAppLoading && !displayError && displayedVerses.length === 0 && !isLoadingVerses && (
                <div className="flex justify-center items-center h-60 p-6">
                  <p className="text-center text-muted-foreground">No verses loaded. Select a Surah or navigate.</p>
                </div>
              )}

              {/* Render Displayed Verses */}
              {displayedVerses.map((verse) => (
                <div key={verse.verseNumber} ref={el => verseRefs.current.set(verse.verseNumber, el)} className="mb-1 md:mb-2">
                    <VerseDisplay
                        verse={verse}
                        fontSize={fontSize}
                        arabicFontSize={arabicFontSize}
                        lineHeight={lineHeight}
                        onContextMenu={handleVerseContextMenu}
                        onClick={() => handleVerseClick(verse.verseNumber)} // Handle click for focus
                        isHighlighted={verse.verseNumber === currentAbsoluteVerse}
                        isPlaying={verse.verseNumber === playingVerseNumber}
                    />
                </div>
              ))}

              {/* Load More Trigger/Indicator */}
              <div ref={loadMoreRef} className={cn(
                  "flex justify-center items-center py-6 text-center",
                  !canLoadMore && "invisible" // Hide if no more to load
                  )}>
                 {isLoadingVerses && displayedVerses.length > 0 ? ( // Show spinner only when loading *more*
                    <Button variant="ghost" disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading More...
                    </Button>
                  ) : canLoadMore ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => {
                                if (currentSurahNumber && displayedVerses.length > 0) {
                                  const nextAyah = displayedVerses[displayedVerses.length - 1].ayahNumberInSurah + 1;
                                  loadVerses(currentSurahNumber, nextAyah, false);
                                }
                              }}
                             disabled={isLoadingVerses}
                           >
                             <ChevronsDown className="h-4 w-4" />
                             <span className="ml-1 hidden sm:inline">Load More</span>
                             <span className="sr-only">Load More Verses</span>
                           </Button>
                        </TooltipTrigger>
                        <TooltipContent>Load Next {VERSES_TO_LOAD_AT_ONCE} Verses</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
              </div>

              {/* End of Surah Marker */}
              {!isLoadingVerses && !canLoadMore && displayedVerses.length > 0 && !displayError && (
                  <div className="text-center text-muted-foreground py-6 text-sm border-t mt-4">End of Surah</div>
              )}
            </div>
          </ScrollArea>
      </div>


      {/* Controls fixed at the bottom */}
      <Controls
        verseNumber={currentAbsoluteVerse}
        audioUrl={currentVerseDataForAudio?.audioUrl ?? null} // Pass audio URL for the *focused* verse
        reciters={reciters}
        selectedReciter={selectedReciter}
        onNextVerse={handleNextVerseFocus} // Changed to focus control
        onPreviousVerse={handlePreviousVerseFocus} // Changed to focus control
        onReciterChange={handleReciterChange}
        onVerseInputChange={handleVerseInputChange}
        onVerseInputBlur={handleVerseInputBlur}
        onVerseSliderChange={handleVerseSliderChange} // Visual update only
        onVerseSliderCommit={handleVerseSliderCommit} // Navigation on release
        onJuzChange={handleJuzChange}
        onPageChange={handlePageChange}
        isLoading={isLoadingVerses || isAppLoading} // Combined loading state for controls
        quranMeta={quranMeta}
        onPlay={handleAudioPlay} // Renamed for clarity
        onPause={handleAudioPause}
        onEnded={handleAudioEnd}
        onError={handleAudioError}
        updatePlayingVerse={updatePlayingVerseCallback} // Use the memoized callback
      />

       {/* Floating Action Buttons (FAB) Area */}
       <div className="fixed bottom-24 right-4 md:right-6 z-20 flex flex-col gap-3">
           <TooltipProvider>
               <Tooltip>
                   <TooltipTrigger asChild>
                       <Button
                           variant="default"
                           size="icon"
                           className="h-14 w-14 rounded-full shadow-lg"
                           aria-label="Open Settings"
                           onClick={toggleSettingsPanel}
                           disabled={isAppLoading} // Disable if essential meta is loading
                       >
                           <Settings className="h-6 w-6" />
                       </Button>
                   </TooltipTrigger>
                   <TooltipContent side="left"><p>Display Settings</p></TooltipContent>
               </Tooltip>
           </TooltipProvider>
           <NotesSidebar
               currentVerseNumber={currentAbsoluteVerse}
               isOpen={isNotesSidebarOpen}
               onOpenChange={setIsNotesSidebarOpen}
               surahName={currentSurahMetaData?.englishName ?? ''}
               ayahNumber={currentVerseDataForSidebars?.verseReference?.split(':')[1] ?? ''}
               // Pass trigger as child for positioning if needed, or handle trigger internally
           />
           {/* Add other FABs here if needed */}
       </div>


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
        isLoading={isLoadingTranslations || isAppLoading} // Disable translation select if loading
      />
    </div>
  );
}
