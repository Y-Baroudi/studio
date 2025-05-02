
'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Verse, Reciter, QuranMeta, Translation, SurahMeta } from '@/services/alquran-cloud';
import {
  getVerse,
  getReciters,
  getQuranMeta,
  getTranslations,
  SUPPORTED_TRANSLATIONS,
  getSurahData,
  surahAyahToAbsoluteVerse,
  absoluteVerseToSurahAyah
} from '@/services/alquran-cloud';
import { VerseDisplay } from './VerseDisplay';
import { Controls } from './Controls';
import { NotesSidebar } from './NotesSidebar';
import { SettingsPanel } from './SettingsPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Settings, ChevronDown, ChevronsDown, Loader2, AlertCircle, Info, Notebook } from 'lucide-react'; // Added Notebook icon
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'; // Import ScrollBar as well for explicit scroll handling
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
const DEFAULT_LINE_HEIGHT = 1.8;
const DEFAULT_TRANSLATION_LINE_HEIGHT = 1.6; // Added specific line height for translation
const SWIPE_THRESHOLD = 50;
const VERSES_TO_LOAD_AT_ONCE = 10; // Adjust number of verses per batch
const BISMILLAH_TEXT = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

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

  // State for font sizes and line heights, managed by SettingsPanel
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [arabicFontSize, setArabicFontSize] = useState<number>(DEFAULT_ARABIC_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState<number>(DEFAULT_LINE_HEIGHT); // Primarily for Arabic
  const [translationLineHeight, setTranslationLineHeight] = useState<number>(DEFAULT_TRANSLATION_LINE_HEIGHT); // For English

  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [isLoadingReciters, setIsLoadingReciters] = useState<boolean>(true);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState<boolean>(true);
  const [isLoadingVerses, setIsLoadingVerses] = useState<boolean>(false); // Combined loading state for verses
  const [canLoadMore, setCanLoadMore] = useState<boolean>(false); // Flag if more verses can be loaded
  const [error, setError] = useState<string | null>(null); // Store initialization or verse loading errors

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
  const fixedHeaderRef = useRef<HTMLDivElement>(null); // Ref for the fixed header
  const controlsRef = useRef<HTMLDivElement>(null); // Ref for the controls component


  // useInView setup requires the root element to exist when initialized.
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0.1,
    root: scrollContainerRef.current, // Pass the ref here
    rootMargin: '0px 0px 100px 0px', // Trigger loading a bit before the element is fully in view
  });

   // --- Apply dynamic styles ---
   useEffect(() => {
     // This check ensures we only try to access document on the client side
     if (typeof window !== 'undefined' && typeof document !== 'undefined') {
       const root = document.documentElement;
        if (root) {
            root.style.setProperty('--arabic-font-size', `${arabicFontSize}px`);
            root.style.setProperty('--translation-font-size', `${fontSize}px`);
            root.style.setProperty('--verse-line-height', `${lineHeight}`);
            root.style.setProperty('--translation-line-height', `${translationLineHeight}`);
            console.log('Applied styles:', { arabicFontSize, fontSize, lineHeight, translationLineHeight });
        } else {
            console.warn('Could not find document root element to apply styles.');
        }
     }
   }, [arabicFontSize, fontSize, lineHeight, translationLineHeight]); // Re-run when any of these change


  // --- Fetch Metadata, Reciters, Translations ---
  const fetchInitialData = useCallback(async () => {
    console.log("Fetching initial data...");
    setIsLoadingMeta(true);
    setIsLoadingReciters(true);
    setIsLoadingTranslations(true);
    setError(null); // Clear previous errors

    try {
      // Using Promise.allSettled to ensure all requests complete, even if some fail
      const results = await Promise.allSettled([
        getQuranMeta(),
        getReciters(),
        getTranslations(),
      ]);

      const [metaResult, recitersResult, translationsResult] = results;

      // Process Meta Data
      if (metaResult.status === 'fulfilled') {
        const meta = metaResult.value;
        setQuranMeta(meta);
        // Set initial surah based on default verse
        const initialLocation = absoluteVerseToSurahAyah(DEFAULT_VERSE_NUMBER, meta);
        if (initialLocation) {
          setCurrentSurahNumber(initialLocation.surahNumber);
          console.log("Initial surah set to:", initialLocation.surahNumber);
        } else {
          console.error("Could not determine initial surah from metadata.");
          setCurrentSurahNumber(1); // Fallback
          setError("Failed to determine starting surah.");
        }
      } else {
        console.error('Error fetching Quran metadata:', metaResult.reason);
        setError('Failed to load essential Quran data. Please refresh.');
        setQuranMeta(null); // Ensure meta is null on error
        setCurrentSurahNumber(null); // Don't attempt to load verses without meta
        // Ensure loading state is set to false even if critical data failed
        setIsLoadingMeta(false);
        setIsLoadingReciters(false);
        setIsLoadingTranslations(false);
        return; // Stop further processing if meta fails
      }

      // Process Reciters
      if (recitersResult.status === 'fulfilled') {
        const fetchedReciters = recitersResult.value;
        setReciters(fetchedReciters);
        const isValidReciter = fetchedReciters.some(r => r.id === selectedReciter);
        if (!isValidReciter && fetchedReciters.length > 0) {
          setSelectedReciter(fetchedReciters[0].id);
        } else if (fetchedReciters.length === 0) {
          setSelectedReciter('');
          toast({ title: "No Reciters Available", description: "Could not load audio reciters.", variant: "destructive" });
        }
      } else {
        console.error('Error fetching reciters:', recitersResult.reason);
        setReciters([]); // Use empty array on error
        setSelectedReciter('');
        toast({ title: "Reciter Loading Failed", description: "Using fallback reciters.", variant: "destructive" });
        // Do not set main error state here, fallback might be acceptable
      }
      setIsLoadingReciters(false);


      // Process Translations
      if (translationsResult.status === 'fulfilled') {
        const fetchedTranslations = translationsResult.value;
        setTranslations(fetchedTranslations);
        const isValidTranslation = fetchedTranslations.some(t => t.id === selectedTranslation);
         if (!isValidTranslation) {
             const defaultExists = fetchedTranslations.some(t => t.id === DEFAULT_TRANSLATION_ID);
             const fallbackTranslation = fetchedTranslations[0]?.id;
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
      } else {
        console.error('Error fetching translations:', translationsResult.reason);
        setTranslations(SUPPORTED_TRANSLATIONS); // Use hardcoded fallback on error
        toast({ title: "Translation Loading Failed", description: "Using default translations.", variant: "destructive" });
      }
      setIsLoadingTranslations(false);

    } catch (err) {
      // This catch block might be redundant if Promise.allSettled is used,
      // but kept for safety.
      console.error('Unexpected error during initial data fetch:', err);
      setError('An unexpected error occurred while loading data. Please refresh.');
      setQuranMeta(null);
      setReciters([]);
      setTranslations(SUPPORTED_TRANSLATIONS);
    } finally {
        // Ensure all loading states are false after attempting fetches
        console.log("Finished fetching initial data attempt.");
        setIsLoadingMeta(false);
        setIsLoadingReciters(false);
        setIsLoadingTranslations(false);
    }
  }, [selectedReciter, selectedTranslation, toast]); // Dependencies

  useEffect(() => {
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


   // --- Verse Loading Logic ---
   const loadVerses = useCallback(async (surahNum: number, startAyahNum: number = 1, replace: boolean = false) => {
     // Prevent loading if metadata is missing or already loading
     if (!quranMeta || isLoadingVerses || isLoadingMeta) {
        console.log(`Verse loading skipped: Meta: ${!!quranMeta}, LoadingVerses: ${isLoadingVerses}, LoadingMeta: ${isLoadingMeta}`);
        return;
     }

     console.log(`loadVerses called: Surah ${surahNum}, Start Ayah ${startAyahNum}, Replace: ${replace}`);
     setIsLoadingVerses(true);
     if (replace) {
        setError(null); // Clear previous verse-loading errors only on replace/navigate
        verseRefs.current.clear(); // Clear refs when replacing verses
     }

     const surahMeta = quranMeta.surahs.references.find(s => s.number === surahNum);
     if (!surahMeta) {
        console.error(`Metadata for Surah ${surahNum} not found.`);
        setError(`Metadata for Surah ${surahNum} not found.`);
        setIsLoadingVerses(false);
        setCanLoadMore(false);
        setDisplayedVerses([]); // Clear verses if surah meta is missing
        return;
     }

      // Calculate the range of verses to fetch based on AYAH number within the surah
      const startVerseIndex = startAyahNum - 1; // API/arrays are often 0-indexed
      const endVerseIndex = Math.min(startVerseIndex + VERSES_TO_LOAD_AT_ONCE - 1, surahMeta.numberOfAyahs - 1);
      const numberOfVersesToFetch = endVerseIndex - startVerseIndex + 1;

      if (numberOfVersesToFetch <= 0 && !replace) { // Allow replace even if count is 0 (clears display)
        console.log(`No more verses to fetch for Surah ${surahNum} starting from ${startAyahNum}.`);
        setIsLoadingVerses(false);
        setCanLoadMore(false);
        return;
      } else if (numberOfVersesToFetch <= 0 && replace) {
          console.log(`Replace called with no verses to fetch for Surah ${surahNum} starting from ${startAyahNum}. Clearing display.`);
          setDisplayedVerses([]);
          setIsLoadingVerses(false);
          setCanLoadMore(false);
          return;
      }

      console.log(`Attempting to fetch ${numberOfVersesToFetch} verses (Ayah ${startAyahNum} to ${endVerseIndex + 1}) for Surah ${surahNum}`);

     try {
       // Use getSurahData for efficient full surah loading (often initial or jump)
       if (replace && startAyahNum === 1) {
           console.log(`Using getSurahData for Surah ${surahNum}`);
           const surahVerses = await getSurahData(surahNum, selectedTranslation, selectedReciter, quranMeta);
           if (surahVerses) {
               console.log(`Loaded ${surahVerses.length} verses via getSurahData.`);
               setDisplayedVerses(surahVerses);
               setCanLoadMore(false); // Loaded the whole surah
           } else {
                console.error(`getSurahData failed for Surah ${surahNum}.`);
                throw new Error(`Failed to fetch complete data for Surah ${surahNum}.`);
           }
       } else {
           // Fetch individual verses for subsequent loads or partial loads
            console.log(`Using getVerse loop for Surah ${surahNum}, Ayah ${startAyahNum}`);
           const versesToFetchPromises: Promise<Verse | null>[] = [];
           const firstAbsoluteVerse = surahAyahToAbsoluteVerse(surahNum, startAyahNum, quranMeta);

           if (firstAbsoluteVerse === null) {
              throw new Error(`Could not calculate absolute verse for ${surahNum}:${startAyahNum}`);
           }

           for (let i = 0; i < numberOfVersesToFetch; i++) {
               const absoluteVerseNum = firstAbsoluteVerse + i;
               // console.log(`   Queueing fetch for absolute verse ${absoluteVerseNum}`); // Debugging
               versesToFetchPromises.push(getVerse(absoluteVerseNum, selectedTranslation, selectedReciter, quranMeta));
           }

           const fetchedVersesNullable = await Promise.all(versesToFetchPromises);
           const newVerses = fetchedVersesNullable.filter(v => v !== null) as Verse[]; // Filter out nulls

            console.log(`Fetched ${newVerses.length} individual verses.`);

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
                console.log(`Can load more: ${lastLoadedAyah < surahMeta.numberOfAyahs}`);
           }
       }
       setError(null); // Clear error on successful load

     } catch (err) {
       console.error(`Error loading verses for Surah ${surahNum} starting from ayah ${startAyahNum}:`, err);
       setError(`Failed to load verses. ${err instanceof Error ? err.message : ''}. Please check your connection or settings.`);
       setCanLoadMore(false);
       if (replace) setDisplayedVerses([]); // Clear display on error during replace
     } finally {
       setIsLoadingVerses(false);
       console.log("Finished loading verses attempt.");
     }
   }, [quranMeta, selectedTranslation, selectedReciter, isLoadingVerses, isLoadingMeta]); // Added isLoadingMeta


  // Trigger initial verse load when essential data is ready AND not already loading verses
   useEffect(() => {
     const canLoadInitial = quranMeta && selectedTranslation && currentSurahNumber !== null && displayedVerses.length === 0 && !isLoadingVerses && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations && !error; // Ensure no error blocks initial load

     if (canLoadInitial) {
       console.log(`Initial load triggered for Surah ${currentSurahNumber}`);
       loadVerses(currentSurahNumber, 1, true);
     } else {
        // Log why initial load didn't trigger
        if (displayedVerses.length === 0 && !isLoadingVerses && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations) {
            console.log(`Initial load condition not met: quranMeta=${!!quranMeta}, selectedTranslation=${!!selectedTranslation}, currentSurahNumber=${currentSurahNumber}, isLoadingVerses=${isLoadingVerses}, isLoadingMeta=${isLoadingMeta}, error=${!!error}`);
        }
     }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [quranMeta, selectedTranslation, currentSurahNumber, isLoadingVerses, isLoadingMeta, isLoadingReciters, isLoadingTranslations, error]); // Add error state


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
     console.log(`Scrolling to verse ${absoluteVerseNum}. Element found: ${!!verseElement}`);
     verseElement?.scrollIntoView({ behavior: behavior, block: 'center' });

     // Reset the flag after scrolling animation likely completes
     programmaticScrollTimeout.current = setTimeout(() => {
       isProgrammaticScroll.current = false;
     }, behavior === 'smooth' ? 1000 : 50); // Shorter timeout for instant scroll
   }, []);


   const navigateToVerse = useCallback((absoluteVerseNum: number, scroll: boolean = true, immediateScroll: boolean = false) => {
     console.log(`Navigating to verse ${absoluteVerseNum}`);
     if (!quranMeta) {
        console.warn("Navigation skipped: Quran Meta not loaded.");
        setError("Cannot navigate: Quran data not loaded."); // Inform user
        return;
     }

     const targetLocation = absoluteVerseToSurahAyah(absoluteVerseNum, quranMeta);
     if (!targetLocation) {
       toast({ title: "Navigation Error", description: `Verse ${absoluteVerseNum} is invalid.`, variant: "destructive" });
       console.error(`Invalid target location for verse ${absoluteVerseNum}`);
       return;
     }

     const { surahNumber: targetSurahNum, ayahNumber: targetAyahNum } = targetLocation;

     // Update the focused verse state immediately
     console.log(`Setting currentAbsoluteVerse to ${absoluteVerseNum}`);
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
       // Use getSurahData for efficiency when switching surahs
        setIsLoadingVerses(true); // Indicate loading
        getSurahData(targetSurahNum, selectedTranslation, selectedReciter, quranMeta)
           .then(verses => {
               if (verses) {
                   console.log(`Loaded ${verses.length} verses for new Surah ${targetSurahNum}.`);
                   setDisplayedVerses(verses);
                   setCanLoadMore(false); // Entire surah loaded
                   if(scroll) {
                      // Scroll after loading completes
                       setTimeout(() => scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth'), 150); // Increased delay slightly
                   }
               } else {
                    setError(`Failed to load data for Surah ${targetSurahNum}.`);
                    console.error(`getSurahData failed for Surah ${targetSurahNum}.`);
               }
               setIsLoadingVerses(false);
           })
           .catch(err => {
                console.error(`Error getting Surah ${targetSurahNum} data:`, err);
                setError(`Failed to load data for Surah ${targetSurahNum}. ${err instanceof Error ? err.message : ''}`);
                setIsLoadingVerses(false);
           });

     } else {
        // Surah is the same, check if the verse is already loaded
        const isVerseLoaded = displayedVerses.some(v => v.verseNumber === absoluteVerseNum);
        console.log(`Target surah ${targetSurahNum} is current. Verse ${absoluteVerseNum} loaded: ${isVerseLoaded}`);
        if (!isVerseLoaded) {
            // Verse is in the same surah but not loaded yet (e.g., jumped far ahead)
            console.warn(`Verse ${absoluteVerseNum} in Surah ${targetSurahNum} not loaded. Re-loading surah.`);
            // Stop any playing audio
            setPlayingVerseNumber(null);
            // Reloading the entire surah (simpler approach for now)
            setDisplayedVerses([]); // Clear potentially incomplete list
            setCanLoadMore(true);
            setIsLoadingVerses(true);
            getSurahData(targetSurahNum, selectedTranslation, selectedReciter, quranMeta)
                .then(verses => {
                     if (verses) {
                        console.log(`Re-loaded ${verses.length} verses for Surah ${targetSurahNum}.`);
                        setDisplayedVerses(verses);
                        setCanLoadMore(false);
                        if(scroll) {
                            setTimeout(() => scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth'), 150);
                        }
                     } else {
                        setError(`Failed to reload data for Surah ${targetSurahNum}.`);
                        console.error(`getSurahData failed on reload for Surah ${targetSurahNum}.`);
                    }
                    setIsLoadingVerses(false);
                }).catch(err => {
                    console.error(`Error reloading Surah ${targetSurahNum}:`, err);
                    setError(`Error reloading Surah ${targetSurahNum}. ${err instanceof Error ? err.message : ''}`);
                    setIsLoadingVerses(false);
                });

        } else if (scroll) {
          // Verse is loaded, just scroll to it
          console.log(`Verse ${absoluteVerseNum} already loaded, scrolling.`);
          scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth');
        }
     }
   }, [quranMeta, currentSurahNumber, displayedVerses, scrollToVerse, toast, selectedTranslation, selectedReciter]); // Removed loadVerses, added selectedTranslation, selectedReciter


    const handleNextVerseFocus = useCallback(() => {
        if (!quranMeta) return;
        const maxVerse = quranMeta.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0);
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
        // Stop current playback if any
        setPlayingVerseNumber(null);
        const audioElement = document.querySelector('audio'); // Find the audio element
        if (audioElement && !audioElement.paused) {
           audioElement.pause();
        }
        // Refetch current surah data with the new reciter to update audio URLs
        if (currentSurahNumber && quranMeta) {
             setIsLoadingVerses(true);
             getSurahData(currentSurahNumber, selectedTranslation, reciterId, quranMeta)
               .then(verses => {
                 if (verses) {
                   setDisplayedVerses(verses);
                    // Resync focused verse audio URL (find the verse data again)
                    const currentVerseIndex = verses.findIndex(v => v.verseNumber === currentAbsoluteVerse);
                    if (currentVerseIndex > -1) {
                        // Trigger a state update implicitly if needed, or directly manage audioUrl if controls handle it internally
                    }
                 } else {
                   setError(`Failed to update audio for Surah ${currentSurahNumber}.`);
                 }
                 setIsLoadingVerses(false);
               })
               .catch(err => {
                  setError(`Error updating audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  setIsLoadingVerses(false);
               });
        }
    }
  };

   const handleTranslationChange = (translationId: string) => {
     if (translationId !== selectedTranslation) {
       console.log("Translation changed to:", translationId);
       setSelectedTranslation(translationId);
       // Reload verses from the beginning of the current surah with the new translation
       if (currentSurahNumber && quranMeta) {
          setDisplayedVerses([]); // Clear old translation
          setCanLoadMore(true);
           setIsLoadingVerses(true);
           getSurahData(currentSurahNumber, translationId, selectedReciter, quranMeta)
             .then(verses => {
                 if (verses) {
                     setDisplayedVerses(verses);
                     setCanLoadMore(false);
                     setTimeout(() => scrollToVerse(currentAbsoluteVerse, 'instant'), 100); // Scroll to focused verse
                 } else {
                     setError(`Failed to load translation ${translationId} for Surah ${currentSurahNumber}.`);
                 }
                 setIsLoadingVerses(false);
             })
             .catch(err => {
                  setError(`Error loading translation: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  setIsLoadingVerses(false);
             });

           toast({
             title: "Translation Changed",
             description: `Loading verses with ${translations.find(t => t.id === translationId)?.name ?? translationId}.`,
           });
       }
     }
   };

  // --- Settings Panel Handlers ---
  // Handler for Translation Font Size
  const handleFontSizeChange = useCallback((value: number[]) => {
      console.log("Setting Font Size (Translation):", value[0]);
      setFontSize(value[0]);
  }, []);

  // Handler for Arabic Font Size
  const handleArabicFontSizeChange = useCallback((value: number[]) => {
      console.log("Setting Font Size (Arabic):", value[0]);
      setArabicFontSize(value[0]);
  }, []);

  // Handler for Arabic Line Height
  const handleLineHeightChange = useCallback((value: number[]) => {
      console.log("Setting Line Height (Arabic):", value[0]);
      setLineHeight(value[0]);
  }, []);

  // Handler for Translation Line Height
  const handleTranslationLineHeightChange = useCallback((value: number[]) => {
      console.log("Setting Line Height (Translation):", value[0]);
      setTranslationLineHeight(value[0]);
  }, []);


  // --- Verse Input/Slider Handlers ---
  const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
    if (!quranMeta) return; // Need meta for validation
    const value = parseInt(e.target.value, 10);
    const maxVerse = quranMeta.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0);
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
       // Allows Controls component to manage its internal input state.
   };


  const handleVerseSliderChange = (value: number[]) => {
    // Update the focused verse number visually as the slider moves
    // No navigation here, just visual update handled by Controls internal state
     // OPTIONAL: Update currentAbsoluteVerse immediately for tighter sidebar sync?
     // setCurrentAbsoluteVerse(value[0]);
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
          // Optional: Smooth scroll to center it?
          // scrollToVerse(verseNumber);
      }
  };


  // --- Swipe Gestures ---
   const handleTouchStart = (e: React.TouchEvent) => {
       if (e.touches.length === 1) {
           touchStartX.current = e.targetTouches[0].clientX;
           touchEndX.current = e.targetTouches[0].clientX;
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
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx > 0) { handlePreviousVerseFocus(); }
            else { handleNextVerseFocus(); }
        }
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
      const verseElement = verseRefs.current.get(currentAbsoluteVerse);
       if (verseElement) {
            const rect = verseElement.getBoundingClientRect();
            const containerRect = scrollContainerRef.current?.getBoundingClientRect();
            if (containerRect) {
                 const elementCenter = rect.top + rect.height / 2;
                 const containerCenter = containerRect.top + containerRect.height / 2;
                 const tolerance = 50; // Pixels
                 if (Math.abs(elementCenter - containerCenter) > tolerance) {
                     scrollToVerse(currentAbsoluteVerse);
                 }
            }
       } else {
            setTimeout(() => scrollToVerse(currentAbsoluteVerse), 100);
       }
   };
   const handleAudioPause = () => {
        console.log("handleAudioPause called");
        setPlayingVerseNumber(null);
   };
   const handleAudioEnd = () => {
        console.log("handleAudioEnd called for verse:", playingVerseNumber);
        const endedVerse = playingVerseNumber;
        setPlayingVerseNumber(null);
        // Logic moved to Controls component via onEnded -> onNextVerse call
   };
   const handleAudioError = (errorMsg: string) => {
        console.error("Received audio error:", errorMsg);
        setPlayingVerseNumber(null);
         if (!error || !error.includes(errorMsg.substring(0, 30))) {
             toast({ title: "Audio Playback Error", description: errorMsg, variant: "destructive" });
         }
   };
    const updatePlayingVerseCallback = useCallback((verseNum: number | null) => {
       setPlayingVerseNumber(verseNum);
       if (verseNum !== null && verseNum !== currentAbsoluteVerse) {
          setCurrentAbsoluteVerse(verseNum);
       }
    }, [currentAbsoluteVerse]);


  // --- Data for Child Components ---
  const currentVerseDataForAudio = displayedVerses.find(v => v.verseNumber === currentAbsoluteVerse);
  const currentVerseDataForSidebars = currentVerseDataForAudio;

  const isAnythingLoading = isLoadingMeta || isLoadingReciters || isLoadingTranslations || isLoadingVerses;
  const isEssentialLoading = isLoadingMeta || (isLoadingVerses && displayedVerses.length === 0 && !error);
  const displayError = error && !isEssentialLoading; // Show error only if not critically loading

  const currentSurahMetaData = quranMeta?.surahs.references.find(s => s?.number === currentSurahNumber) ?? null;
  const showBismillah = currentSurahMetaData && currentSurahMetaData.number !== 1 && currentSurahMetaData.number !== 9;

  // Calculate scroll container height dynamically
  const [scrollContainerHeight, setScrollContainerHeight] = useState('calc(100vh - 200px)'); // Default guess

  useEffect(() => {
       // Check if window is defined before accessing window properties
       if (typeof window !== 'undefined') {
          const headerHeight = fixedHeaderRef.current?.offsetHeight ?? 0;
          const controlsHeight = controlsRef.current?.offsetHeight ?? 0;
          // Calculate height ensuring it's not negative
          const calculatedHeight = `calc(100vh - ${Math.max(0, headerHeight)}px - ${Math.max(0, controlsHeight)}px - 1rem)`;
          // console.log(`Calculated Height: ${calculatedHeight} (Header: ${headerHeight}, Controls: ${controlsHeight})`);
          setScrollContainerHeight(calculatedHeight);
       }
  }, [fixedHeaderRef, controlsRef, isMobile]); // Recalculate on mobile toggle too


  return (
    // Add direction based on language for overall layout (useful for LTR/RTL consistency)
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-0 pb-0 relative" dir="ltr">

      {/* Fixed Surah Header */}
      <div
        ref={fixedHeaderRef} // Add ref
        className="sticky-header" // Use class from globals.css for consistent styling
        >
         {currentSurahMetaData ? (
             <div className="flex justify-between items-start gap-4">
               {/* Left: English Info */}
               <div className="text-left">
                 <h2 className="text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
                    <span className="inline-flex items-center justify-center bg-primary text-primary-foreground w-7 h-7 rounded-full text-sm">
                       {currentSurahMetaData.number}
                    </span>
                    {currentSurahMetaData.englishName}
                 </h2>
                 <p className="text-xs md:text-sm text-muted-foreground">
                    {currentSurahMetaData.englishNameTranslation} ({currentSurahMetaData.numberOfAyahs} Ayahs)
                 </p>
               </div>
               {/* Right: Arabic Info */}
               <div className="text-right">
                 <h2 className="text-xl md:text-2xl font-amiri font-semibold text-foreground" lang="ar" dir="rtl">
                    {currentSurahMetaData.name}
                 </h2>
                  <p className="text-[0.6rem] md:text-xs italic text-muted-foreground">
                    {currentSurahMetaData.revelationType}
                  </p>
               </div>
             </div>
         ) : (
             // Placeholder while loading metadata
             <div className="flex justify-between items-center gap-4">
                 <Skeleton className="h-6 w-1/3" />
                 <Skeleton className="h-6 w-1/4" />
             </div>
         )}
      </div>


      {/* Main Scrollable Content Area */}
       {/* Apply Tailwind classes for overflow and height */}
      <div
        className="flex-grow rounded-lg relative bg-card" // Removed fixed height & overflow-hidden
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
            touchAction: isMobile ? 'pan-y pinch-zoom' : 'auto',
             minHeight: scrollContainerHeight // Use minHeight instead of height
            // Removed explicit height style
        }}
      >
          {/* Wrap content in ScrollArea, ensure it fills parent height */}
          <ScrollArea
            className="h-full" // Make ScrollArea fill the parent container's height
            viewportRef={scrollContainerRef} // Pass the ref here
          >
            <div className="verses-scroll-container"> {/* Padding inside scroll area */}
              {/* Bismillah (conditionally rendered inside scroll area) */}
              {showBismillah && (
                <p className="font-bismillah text-center text-foreground my-4 text-2xl md:text-3xl" aria-label="Bismillah">
                   {BISMILLAH_TEXT}
                </p>
              )}

              {/* Loading Skeletons */}
               {isEssentialLoading && (
                 <div className="space-y-6">
                   {[...Array(3)].map((_, i) => (
                     <div key={i} className="flex flex-col gap-4 border-b border-border/30 pb-4">
                        <Skeleton className="h-20 w-full mb-2" /> {/* Arabic Placeholder */}
                        <Skeleton className="h-12 w-full" /> {/* Translation Placeholder */}
                     </div>
                   ))}
                   <p className="text-center text-muted-foreground mt-4 text-sm">
                     {isLoadingMeta ? 'Initializing reader...' : 'Loading verses...'}
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
                      if (!quranMeta) {
                         fetchInitialData(); // Retry initial load if meta failed
                      } else if (currentSurahNumber && displayedVerses.length === 0) {
                         loadVerses(currentSurahNumber, 1, true); // Retry loading current surah if verses failed
                      } else {
                          // Fallback: force reload initial data if state is unclear
                           fetchInitialData();
                      }
                  }}
                  variant="outline"
                  size="sm"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Verse Display Area */}
              {!isEssentialLoading && !displayError && displayedVerses.length === 0 && (
                <div className="flex justify-center items-center h-60 p-6">
                  <p className="text-center text-muted-foreground text-sm">No verses loaded. Select a Surah or navigate.</p>
                </div>
              )}

              {/* Render Displayed Verses */}
              {!isEssentialLoading && !displayError && displayedVerses.map((verse) => (
                <div key={verse.verseNumber} ref={el => verseRefs.current.set(verse.verseNumber, el)}>
                    <VerseDisplay
                        verse={verse}
                        isHighlighted={verse.verseNumber === currentAbsoluteVerse}
                        isPlaying={verse.verseNumber === playingVerseNumber}
                        onContextMenu={handleVerseContextMenu}
                        onClick={handleVerseClick} // Pass click handler
                    />
                </div>
              ))}

              {/* Load More Trigger/Indicator */}
              <div ref={loadMoreRef} className={cn(
                  "flex justify-center items-center py-6 text-center min-h-[60px]",
                  // Render only when not critically loading and no error
                  (isEssentialLoading || displayError) && "hidden"
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
          <ScrollBar orientation="vertical" /> {/* Enable scrollbar explicitly */}
          </ScrollArea>
      </div>


       {/* Controls Area */}
       <div ref={controlsRef} className="sticky bottom-0 z-10 w-full">
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
           // Remove props related to verse slider
           onVerseSliderChange={() => {}} // Provide dummy function or remove if Controls no longer expects it
           onVerseSliderCommit={() => {}} // Provide dummy function or remove if Controls no longer expects it
           onJuzChange={handleJuzChange}
           onPageChange={handlePageChange}
           isLoading={isAnythingLoading} // Disable controls if anything is loading
           isLoadingReciters={isLoadingReciters} // Pass reciter loading state
           quranMeta={quranMeta}
           onPlay={handleAudioPlay}
           onPause={handleAudioPause}
           onEnded={handleAudioEnd}
           onError={handleAudioError}
           updatePlayingVerse={updatePlayingVerseCallback}
           onOpenSettings={toggleSettingsPanel} // Pass the toggle function
         />
       </div>


       {/* Floating Action Buttons (FAB) Area */}
       <div className="fixed bottom-24 right-4 md:right-6 z-20 flex flex-col gap-3">
          {/* Settings Button */}
           <TooltipProvider>
               <Tooltip>
                   <TooltipTrigger asChild>
                       <Button
                           variant="default"
                           size="icon"
                           className="h-12 w-12 rounded-full shadow-lg" // Slightly larger FAB
                           aria-label="Open Settings"
                           onClick={toggleSettingsPanel}
                           disabled={isAnythingLoading} // Disable if anything is loading
                       >
                           <Settings className="h-6 w-6" />
                       </Button>
                   </TooltipTrigger>
                   <TooltipContent side="left"><p>Display Settings</p></TooltipContent>
               </Tooltip>
           </TooltipProvider>
            {/* Notes Button */}
             <TooltipProvider>
               <Tooltip>
                   <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-full shadow-lg border bg-background" // Style as secondary FAB
                        aria-label="Open Notes"
                        onClick={toggleNotesSidebar}
                      >
                        <Notebook className="h-6 w-6" />
                      </Button>
                   </TooltipTrigger>
                   <TooltipContent side="left"><p>Notes</p></TooltipContent>
               </Tooltip>
           </TooltipProvider>

           {/* Placeholder: Keep NotesSidebar component, but trigger it from FAB */}
           <NotesSidebar
               currentVerseNumber={currentAbsoluteVerse}
               isOpen={isNotesSidebarOpen}
               onOpenChange={setIsNotesSidebarOpen}
               surahName={currentSurahMetaData?.englishName ?? ''}
               ayahNumber={currentVerseDataForSidebars?.ayahNumberInSurah?.toString() ?? ''}
               // The trigger is now the FAB, so this component won't render its own trigger button
           />

       </div>


      {/* Settings Panel Component */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onOpenChange={setIsSettingsPanelOpen}
        fontSize={fontSize}
        arabicFontSize={arabicFontSize}
        lineHeight={lineHeight}
        translationLineHeight={translationLineHeight} // Pass translation line height
        translations={translations}
        selectedTranslation={selectedTranslation}
        onFontSizeChange={handleFontSizeChange} // Use useCallback memoized handler
        onArabicFontSizeChange={handleArabicFontSizeChange} // Use useCallback memoized handler
        onLineHeightChange={handleLineHeightChange} // Use useCallback memoized handler
        onTranslationLineHeightChange={handleTranslationLineHeightChange} // Use useCallback memoized handler
        onTranslationChange={handleTranslationChange}
        isLoading={isLoadingTranslations || isLoadingMeta} // Disable relevant controls while loading
      />
    </div>
  );
}
