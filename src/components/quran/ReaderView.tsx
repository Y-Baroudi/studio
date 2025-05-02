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
import { ScrollArea } from '@/components/ui/scroll-area'; // For scrollable container
import { useInView } from 'react-intersection-observer'; // For detecting when to load more
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils'; // Import cn for conditional classes

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION_ID = SUPPORTED_TRANSLATIONS[0]?.id ?? 'en.clearquran'; // Default to clearquran
const DEFAULT_RECITER_ID = 'ar.alafasy';
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_ARABIC_FONT_SIZE = 24;
const DEFAULT_LINE_HEIGHT = 1.8; // Adjusted based on previous request
const SWIPE_THRESHOLD = 50;
const VERSES_TO_LOAD_AT_ONCE = 10; // Adjust number of verses per batch

export function ReaderView() {
  const [quranMeta, setQuranMeta] = useState<QuranMeta | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]); // Initialize empty, fetch later
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

  // useInView setup requires the root element to exist when initialized.
  // We need to ensure scrollContainerRef.current is available.
  // Option 1: Defer initialization (might be complex)
  // Option 2: Initialize normally, but handle potential null root initially.
  // We'll go with Option 2 and rely on the fact that the ScrollArea renders quickly.
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0.1,
    root: scrollContainerRef.current, // Pass the ref here
    rootMargin: '0px 0px 100px 0px', // Trigger loading a bit before the element is fully in view
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
        getTranslations(), // Fetch translations from API
      ]);

      setQuranMeta(meta);
      setReciters(fetchedReciters);
      setTranslations(fetchedTranslations); // Set fetched translations

      // Validate selected reciter/translation against fetched lists
      const isValidReciter = fetchedReciters.some(r => r.id === selectedReciter);
      if (!isValidReciter && fetchedReciters.length > 0) {
        setSelectedReciter(fetchedReciters[0].id);
      } else if (fetchedReciters.length === 0) {
        setSelectedReciter(''); // No reciters available
         toast({ title: "No Reciters Available", description: "Could not load audio reciters.", variant: "destructive" });
      }

      const isValidTranslation = fetchedTranslations.some(t => t.id === selectedTranslation);
       if (!isValidTranslation) {
            const defaultExists = fetchedTranslations.some(t => t.id === DEFAULT_TRANSLATION_ID);
            const fallbackTranslation = fetchedTranslations[0]?.id; // Use first available if default not found
            const newTranslation = defaultExists ? DEFAULT_TRANSLATION_ID : fallbackTranslation;

            if (newTranslation) {
                setSelectedTranslation(newTranslation);
                if (selectedTranslation) { // Only toast if a previous (invalid) selection existed
                    toast({ title: "Translation Reset", description: `Switched to ${newTranslation}.` });
                }
            } else {
                setSelectedTranslation(''); // No translations available
                toast({ title: "No Translations Available", description: "Could not load text translations.", variant: "destructive" });
            }
       }

      // Set initial surah based on default verse
      const initialLocation = absoluteVerseToSurahAyah(DEFAULT_VERSE_NUMBER, meta);
      if (initialLocation) {
        setCurrentSurahNumber(initialLocation.surahNumber);
      } else {
        setError("Could not determine initial surah.");
        setCurrentSurahNumber(1); // Fallback to Surah 1
      }

    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError('Failed to load essential Quran data. Please refresh.');
      setQuranMeta(null);
      setReciters([]);
      setTranslations(SUPPORTED_TRANSLATIONS); // Fallback to hardcoded on error
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
     if (replace) {
        setError(null); // Clear previous errors only on replace/navigate
        verseRefs.current.clear(); // Clear refs when replacing verses
     }

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

      if (numberOfVersesToFetch <= 0) {
        console.log(`No more verses to fetch for Surah ${surahNum} starting from ${startAyahNum}.`);
        setIsLoadingVerses(false);
        setCanLoadMore(false);
        return;
      }

      console.log(`Fetching ${numberOfVersesToFetch} verses (Ayah ${startAyahNum} to ${endVerseIndex + 1}) for Surah ${surahNum}`);

     try {
       // Revised approach: Fetch only the *required* block using getVerse
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
     if (quranMeta && selectedTranslation && currentSurahNumber && displayedVerses.length === 0 && !isLoadingVerses && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations) {
       console.log(`Initial load triggered for Surah ${currentSurahNumber}`);
       loadVerses(currentSurahNumber, 1, true); // Load first block, replace existing
     }
   }, [quranMeta, selectedTranslation, selectedReciter, currentSurahNumber, displayedVerses.length, loadVerses, isLoadingVerses, isLoadingMeta, isLoadingReciters, isLoadingTranslations]);


   // Trigger loading more verses when the trigger element is in view
   useEffect(() => {
       if (loadMoreInView && canLoadMore && !isLoadingVerses && currentSurahNumber && displayedVerses.length > 0) {
           const nextAyahToLoad = displayedVerses[displayedVerses.length - 1].ayahNumberInSurah + 1;
           console.log(`Load more triggered: Loading from Ayah ${nextAyahToLoad} in Surah ${currentSurahNumber}`);
           loadVerses(currentSurahNumber, nextAyahToLoad, false); // Append new verses
       }
   }, [loadMoreInView, canLoadMore, isLoadingVerses, currentSurahNumber, displayedVerses, loadVerses]);


  // --- Navigation Logic ---
   const scrollToVerse = useCallback((absoluteVerseNum: number, behavior: ScrollBehavior = 'smooth') => {
     if (programmaticScrollTimeout.current) {
       clearTimeout(programmaticScrollTimeout.current);
     }
     isProgrammaticScroll.current = true;

     const verseElement = verseRefs.current.get(absoluteVerseNum);
     verseElement?.scrollIntoView({ behavior: behavior, block: 'center' });

     // Reset the flag after scrolling animation likely completes
     programmaticScrollTimeout.current = setTimeout(() => {
       isProgrammaticScroll.current = false;
     }, behavior === 'smooth' ? 1000 : 50); // Shorter timeout for instant scroll
   }, []);


   const navigateToVerse = useCallback((absoluteVerseNum: number, scroll: boolean = true, immediateScroll: boolean = false) => {
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
       // We need to scroll to the top or the target verse *after* load
       setTimeout(() => scrollToVerse(absoluteVerseNum, 'instant'), 100); // Scroll after a delay
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
            // Scroll after loading completes
             setTimeout(() => scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth'), 100);
        } else if (scroll) {
          // Verse is loaded, just scroll to it
          scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth');
        }
     }
   }, [quranMeta, currentSurahNumber, displayedVerses, loadVerses, scrollToVerse, toast]); // Added dependencies


    const handleNextVerseFocus = useCallback(() => {
        const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
        const nextVerse = Math.min(currentAbsoluteVerse + 1, maxVerse);
        if (nextVerse !== currentAbsoluteVerse) {
           navigateToVerse(nextVerse);
        }
    }, [quranMeta, currentAbsoluteVerse, navigateToVerse]);

    const handlePreviousVerseFocus = useCallback(() => {
        const prevVerse = Math.max(1, currentAbsoluteVerse - 1);
         if (prevVerse !== currentAbsoluteVerse) {
            navigateToVerse(prevVerse);
         }
    }, [currentAbsoluteVerse, navigateToVerse]);

  // --- Control Event Handlers ---
  const handleReciterChange = (reciterId: string) => {
    if (reciterId !== selectedReciter) {
        console.log("Reciter changed to:", reciterId);
        setSelectedReciter(reciterId);
        // Refetch current verse data to get the new audio URL
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
          // Scroll to the currently focused verse (which might now be the start of the surah)
          setTimeout(() => scrollToVerse(currentAbsoluteVerse, 'instant'), 100);
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
        // No need to set isLoadingVerses here as it's a background update
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
                    // If not found, maybe it scrolled out of view during refetch? Return prev state.
                    return prev;
                });
            } else {
                 console.warn(`Failed to refetch data for verse ${currentAbsoluteVerse}`);
                 toast({ title: "Update Failed", description: "Could not refresh verse audio/text.", variant: "destructive" });
            }
        } catch (err) {
            console.error(`Error refetching verse ${currentAbsoluteVerse}:`, err);
             toast({ title: "Network Error", description: "Failed to update verse data.", variant: "destructive" });
        }
    }, [currentAbsoluteVerse, quranMeta, selectedReciter, selectedTranslation, toast]);


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
        navigateToVerse(value, true, true); // Navigate and scroll instantly
      }
    } else if (e.target.value !== '') { // Only show error if input is not empty but invalid
       toast({ title: "Invalid Verse", description: `Please enter a verse number between 1 and ${maxVerse}.`, variant: "destructive" });
        // Reset input to the current focused verse number
        e.target.value = currentAbsoluteVerse.toString();
    }
  };

   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
       // This function primarily syncs the local state in Controls.
       // We don't need to do anything here in ReaderView.
   };


  const handleVerseSliderChange = (value: number[]) => {
    // Update the focused verse number visually as the slider moves
    // No navigation here, just visual update handled by Controls internal state
     setCurrentAbsoluteVerse(value[0]); // Keep this to update context for Notes/Settings panels
  };

  const handleVerseSliderCommit = (value: number[]) => {
     // Navigate only when the user releases the slider
     console.log("Slider commit:", value[0]);
     navigateToVerse(value[0], true, false); // Navigate and scroll smoothly
  };

  // --- Jump To Handlers ---
  const handleJuzChange = (juz: number) => {
    const startVerse = JUZ_STARTS[juz];
    if (startVerse && startVerse !== currentAbsoluteVerse) {
      navigateToVerse(startVerse, true, true); // Jump instantly
      toast({ title: "Navigated", description: `Jumped to Juz ${juz} (Verse ${startVerse}).` });
    }
  };

  const handlePageChange = (page: number) => {
    const startVerse = PAGE_STARTS[page];
    if (startVerse && startVerse !== currentAbsoluteVerse) {
      navigateToVerse(startVerse, true, true); // Jump instantly
      toast({ title: "Navigated", description: `Jumped to Page ${page} (Verse ${startVerse}).` });
    }
  };

  // --- Context Menu & Interaction ---
  const handleVerseContextMenu = (verseNumber: number) => {
    setCurrentAbsoluteVerse(verseNumber); // Focus the verse for context actions
    setIsNotesSidebarOpen(true);
  };

  const handleVerseClick = (verseNumber: number) => {
      if (verseNumber !== currentAbsoluteVerse) {
          setCurrentAbsoluteVerse(verseNumber); // Focus verse on click
          // Optional: Smooth scroll to center it? Consider if this is desired UX.
          // scrollToVerse(verseNumber);
      }
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

        // Ignore minor horizontal movements
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
      // Scroll to the playing verse only if it's not currently centered
      const verseElement = verseRefs.current.get(currentAbsoluteVerse);
       if (verseElement) {
            const rect = verseElement.getBoundingClientRect();
            const containerRect = scrollContainerRef.current?.getBoundingClientRect();
            if (containerRect) {
                 const elementCenter = rect.top + rect.height / 2;
                 const containerCenter = containerRect.top + containerRect.height / 2;
                 // Check if element center is outside a tolerance range around the container center
                 const tolerance = 50; // Pixels
                 if (Math.abs(elementCenter - containerCenter) > tolerance) {
                     scrollToVerse(currentAbsoluteVerse);
                 }
            }
       } else {
            // If element isn't rendered, try scrolling after a short delay
            setTimeout(() => scrollToVerse(currentAbsoluteVerse), 100);
       }
   };
   const handleAudioPause = () => {
        console.log("handleAudioPause called");
        setPlayingVerseNumber(null);
   };
   const handleAudioEnd = () => { // Called when audio for a verse naturally ends
        console.log("handleAudioEnd called for verse:", playingVerseNumber);
        const endedVerse = playingVerseNumber; // Capture the verse number that ended
        setPlayingVerseNumber(null); // Update state immediately

        // Logic moved to Controls component via onEnded -> onNextVerse call
        // if (endedVerse === currentAbsoluteVerse) {
        //     // Auto-advance focus if the ended verse was the focused one
        //     handleNextVerseFocus();
        // }
   };
   const handleAudioError = (errorMsg: string) => {
        console.error("Received audio error:", errorMsg);
        setPlayingVerseNumber(null);
        // Prevent spamming toasts for the same error potentially
        if (!error || !error.includes(errorMsg.substring(0, 50))) { // Basic check
            setError(errorMsg); // Store error message
            toast({ title: "Audio Playback Error", description: errorMsg, variant: "destructive" });
        }
   };
    const updatePlayingVerseCallback = useCallback((verseNum: number | null) => {
       setPlayingVerseNumber(verseNum);
       // If controls report a verse started playing, ensure UI focus matches
       if (verseNum !== null && verseNum !== currentAbsoluteVerse) {
          setCurrentAbsoluteVerse(verseNum);
           // Optionally scroll to the newly playing verse if focus changed programmatically
           // scrollToVerse(verseNum);
       }
    }, [currentAbsoluteVerse]);


  // --- Data for Child Components ---
  // Find the verse data for the *currently focused* verse to pass to Controls
  const currentVerseDataForAudio = displayedVerses.find(v => v.verseNumber === currentAbsoluteVerse);
  const currentVerseDataForSidebars = currentVerseDataForAudio; // Use the same data

  const isAppLoading = isLoadingMeta || isLoadingReciters || isLoadingTranslations;
  const displayError = error && !isLoadingVerses && !isLoadingMeta; // Show error if not currently loading anything critical

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
            viewportRef={scrollContainerRef} // Pass the ref here
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
                   <p className="text-center text-muted-foreground mt-4 text-sm">
                     {isAppLoading ? 'Initializing reader...' : 'Loading verses...'}
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
                      if (!quranMeta || reciters.length === 0 || translations.length === 0) {
                         fetchInitialData(); // Retry initial load if essential meta failed
                      } else if (currentSurahNumber) {
                         setDisplayedVerses([]); // Clear potentially broken list
                         loadVerses(currentSurahNumber, 1, true); // Retry loading current surah
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
                  <p className="text-center text-muted-foreground text-sm">No verses loaded. Select a Surah or navigate.</p>
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
                        onClick={handleVerseClick} // Pass click handler
                        isHighlighted={verse.verseNumber === currentAbsoluteVerse}
                        isPlaying={verse.verseNumber === playingVerseNumber}
                    />
                </div>
              ))}

              {/* Load More Trigger/Indicator */}
              <div ref={loadMoreRef} className={cn(
                  "flex justify-center items-center py-6 text-center min-h-[60px]", // Ensure it has height to be observed
                   // Always render the div, but control visibility/content inside
                  )}>
                  {isLoadingVerses && displayedVerses.length > 0 && ( // Show spinner only when loading *more*
                    <Button variant="ghost" disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading More...
                    </Button>
                  )}
                 {canLoadMore && !isLoadingVerses && ( // Show button only if more can be loaded and not currently loading
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
                  )}
                   {!canLoadMore && displayedVerses.length > 0 && !isLoadingVerses && !displayError && (
                      <div className="text-center text-muted-foreground text-sm">End of Surah</div>
                   )}
              </div>
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
        onVerseInputChange={handleVerseInputChange} // Sync local state in Controls
        onVerseInputBlur={handleVerseInputBlur} // Trigger navigation
        onVerseSliderChange={handleVerseSliderChange} // Visual update only (updates currentAbsoluteVerse)
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
               ayahNumber={currentVerseDataForSidebars?.ayahNumberInSurah?.toString() ?? ''} // Use ayahNumberInSurah
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
