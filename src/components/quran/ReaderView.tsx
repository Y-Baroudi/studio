
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
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Settings, ChevronDown, ChevronsDown, Loader2, AlertCircle, Info, Notebook } from 'lucide-react'; // Added Notebook icon
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useInView } from 'react-intersection-observer';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { checkNoteExists } from '@/services/notes'; // Import checkNoteExists

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION_ID = SUPPORTED_TRANSLATIONS[0]?.id ?? 'en.clearquran';
const DEFAULT_RECITER_ID = 'ar.alafasy';
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_ARABIC_FONT_SIZE = 24;
const DEFAULT_LINE_HEIGHT = 1.8;
const DEFAULT_TRANSLATION_LINE_HEIGHT = 1.6;
const SWIPE_THRESHOLD = 50;
const VERSES_TO_LOAD_AT_ONCE = 10; // Load fewer verses for surah data
const BISMILLAH_TEXT = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export function ReaderView() {
  const [quranMeta, setQuranMeta] = useState<QuranMeta | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedReciter, setSelectedReciter] = useState<string>(DEFAULT_RECITER_ID);
  const [selectedTranslation, setSelectedTranslation] = useState<string>(DEFAULT_TRANSLATION_ID);

  const [currentAbsoluteVerse, setCurrentAbsoluteVerse] = useState<number>(DEFAULT_VERSE_NUMBER);
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number | null>(null);
  const [displayedVerses, setDisplayedVerses] = useState<Verse[]>([]);
  const [playingVerseNumber, setPlayingVerseNumber] = useState<number | null>(null);
  const [versesWithNotes, setVersesWithNotes] = useState<Set<number>>(new Set()); // Track verses with notes/tags
  const [isRepeatingVerse, setIsRepeatingVerse] = useState<number | null>(null); // State for repeating verse

  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [arabicFontSize, setArabicFontSize] = useState<number>(DEFAULT_ARABIC_FONT_SIZE);
  const [lineHeight, setLineHeight] = useState<number>(DEFAULT_LINE_HEIGHT);
  const [translationLineHeight, setTranslationLineHeight] = useState<number>(DEFAULT_TRANSLATION_LINE_HEIGHT);

  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [isLoadingReciters, setIsLoadingReciters] = useState<boolean>(true);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState<boolean>(true);
  const [isLoadingVerses, setIsLoadingVerses] = useState<boolean>(false);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

  const { toast } = useToast();
  const isMobile = useIsMobile();

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const verseRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const isProgrammaticScroll = useRef<boolean>(false);
  const programmaticScrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null); // Ref for the audio element in Controls

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0.1,
    // root: scrollContainerRef.current, // Removed as it causes issues when ref is null initially
    rootMargin: '0px 0px 200px 0px', // Load when 200px from bottom
  });

   useEffect(() => {
     if (typeof window !== 'undefined' && typeof document !== 'undefined') {
       const root = document.documentElement;
        if (root) {
            root.style.setProperty('--arabic-font-size', `${arabicFontSize}px`);
            root.style.setProperty('--translation-font-size', `${fontSize}px`);
            root.style.setProperty('--verse-line-height', `${lineHeight}`);
            root.style.setProperty('--translation-line-height', `${translationLineHeight}`);
        } else {
            console.warn('Could not find document root element to apply styles.');
        }
     }
   }, [arabicFontSize, fontSize, lineHeight, translationLineHeight]);

   // Function to update the set of verses with notes
   const updateNoteStatusForVerse = useCallback((absoluteVerseNumber: number, hasNote: boolean) => {
     setVersesWithNotes(prev => {
       const newSet = new Set(prev);
       if (hasNote) {
         newSet.add(absoluteVerseNumber);
       } else {
         newSet.delete(absoluteVerseNumber);
       }
       console.log(`Note status updated for verse ${absoluteVerseNumber}. Has Note/Tag: ${hasNote}. Current set:`, newSet);
       return newSet;
     });
   }, []);

   // Pre-check notes status when displayed verses change
   useEffect(() => {
      if (typeof window !== 'undefined' && displayedVerses.length > 0) {
          const notesExistSet = new Set<number>();
          displayedVerses.forEach(verse => {
              // Use the imported checkNoteExists function
              if (checkNoteExists(verse.verseNumber)) {
                  notesExistSet.add(verse.verseNumber);
              }
          });
          setVersesWithNotes(notesExistSet);
          // console.log("Checked notes status for displayed verses:", notesExistSet); // Less verbose logging
      }
   }, [displayedVerses]);


  const fetchInitialData = useCallback(async () => {
    console.log("Fetching initial data...");
    setIsLoadingMeta(true);
    setIsLoadingReciters(true);
    setIsLoadingTranslations(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        getQuranMeta(),
        getReciters(),
        getTranslations(),
      ]);

      const [metaResult, recitersResult, translationsResult] = results;

      if (metaResult.status === 'fulfilled') {
        const meta = metaResult.value;
        setQuranMeta(meta);
        const initialLocation = absoluteVerseToSurahAyah(DEFAULT_VERSE_NUMBER, meta);
        if (initialLocation) {
          setCurrentSurahNumber(initialLocation.surahNumber);
          console.log("Initial surah set to:", initialLocation.surahNumber);
        } else {
          console.error("Could not determine initial surah from metadata.");
          setCurrentSurahNumber(1);
          setError("Failed to determine starting surah.");
        }
      } else {
        console.error('Error fetching Quran metadata:', metaResult.reason);
        setError('Failed to load essential Quran data. Please refresh.');
        setQuranMeta(null);
        setCurrentSurahNumber(null);
        setIsLoadingMeta(false);
        setIsLoadingReciters(false);
        setIsLoadingTranslations(false);
        return;
      }

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
        setReciters([]);
        setSelectedReciter('');
        toast({ title: "Reciter Loading Failed", description: "Using fallback reciters.", variant: "destructive" });
      }
      setIsLoadingReciters(false);

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
                 if (selectedTranslation) {
                     toast({ title: "Translation Reset", description: `Switched to ${newTranslation}.` });
                 }
             } else {
                 setSelectedTranslation('');
                 toast({ title: "No Translations Available", description: "Could not load text translations.", variant: "destructive" });
             }
        }
      } else {
        console.error('Error fetching translations:', translationsResult.reason);
        setTranslations(SUPPORTED_TRANSLATIONS);
        toast({ title: "Translation Loading Failed", description: "Using default translations.", variant: "destructive" });
      }
      setIsLoadingTranslations(false);

    } catch (err) {
      console.error('Unexpected error during initial data fetch:', err);
      setError('An unexpected error occurred while loading data. Please refresh.');
      setQuranMeta(null);
      setReciters([]);
      setTranslations(SUPPORTED_TRANSLATIONS);
    } finally {
        console.log("Finished fetching initial data attempt.");
        setIsLoadingMeta(false);
        setIsLoadingReciters(false);
        setIsLoadingTranslations(false);
    }
  }, [selectedReciter, selectedTranslation, toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

   const loadVerses = useCallback(async (surahNum: number, startAyahNum: number = 1, replace: boolean = false) => {
     if (!quranMeta || isLoadingVerses || isLoadingMeta) {
        console.log(`Verse loading skipped: Meta: ${!!quranMeta}, LoadingVerses: ${isLoadingVerses}, LoadingMeta: ${isLoadingMeta}`);
        return;
     }

     console.log(`loadVerses called: Surah ${surahNum}, Start Ayah ${startAyahNum}, Replace: ${replace}`);
     setIsLoadingVerses(true);
     if (replace) {
        setError(null);
        verseRefs.current.clear();
        setDisplayedVerses([]); // Clear immediately on replace
     }

     const surahMeta = quranMeta.surahs.references.find(s => s.number === surahNum);
     if (!surahMeta) {
        console.error(`Metadata for Surah ${surahNum} not found.`);
        setError(`Metadata for Surah ${surahNum} not found.`);
        setIsLoadingVerses(false);
        setCanLoadMore(false);
        setDisplayedVerses([]);
        return;
     }

     // Use getSurahData which fetches all verses at once
     console.log(`Using getSurahData for Surah ${surahNum}`);

     try {
         const surahVerses = await getSurahData(surahNum, selectedTranslation, selectedReciter, quranMeta);
         if (surahVerses) {
             console.log(`Loaded ${surahVerses.length} verses via getSurahData.`);
             setDisplayedVerses(surahVerses);
             setCanLoadMore(false); // Since we load the whole surah
             setError(null);
         } else {
             console.error(`getSurahData failed for Surah ${surahNum}.`);
             throw new Error(`Failed to fetch complete data for Surah ${surahNum}.`);
         }
     } catch (err) {
         console.error(`Error loading surah data for Surah ${surahNum}:`, err);
         setError(`Failed to load verses. ${err instanceof Error ? err.message : ''}. Please check your connection or settings.`);
         setCanLoadMore(false);
         setDisplayedVerses([]);
     } finally {
         setIsLoadingVerses(false);
         console.log("Finished loading surah data attempt.");
     }
   }, [quranMeta, selectedTranslation, selectedReciter, isLoadingVerses, isLoadingMeta]);

   // Effect to load verses when surah changes or initial load is ready
   useEffect(() => {
     const canLoadInitial = quranMeta && selectedTranslation && currentSurahNumber !== null && displayedVerses.length === 0 && !isLoadingVerses && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations && !error;

     if (canLoadInitial) {
       console.log(`Initial load triggered for Surah ${currentSurahNumber}`);
       loadVerses(currentSurahNumber, 1, true);
     } else {
        if (displayedVerses.length === 0 && !isLoadingVerses && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations) {
            // console.log(`Initial load condition not met: quranMeta=${!!quranMeta}, selectedTranslation=${!!selectedTranslation}, currentSurahNumber=${currentSurahNumber}, isLoadingVerses=${isLoadingVerses}, isLoadingMeta=${isLoadingMeta}, error=${!!error}`); // Less verbose
        }
     }
   }, [quranMeta, selectedTranslation, currentSurahNumber, isLoadingVerses, isLoadingMeta, isLoadingReciters, isLoadingTranslations, error, loadVerses, displayedVerses.length]); // Added displayedVerses.length dependency


   // Removed the infinite scroll effect based on useInView as we load the whole surah now
   // useEffect(() => { ... loadMoreInView logic ... }, [...]);


   const scrollToVerse = useCallback((absoluteVerseNum: number, behavior: ScrollBehavior = 'smooth') => {
     if (programmaticScrollTimeout.current) {
       clearTimeout(programmaticScrollTimeout.current);
     }
     isProgrammaticScroll.current = true;

     const verseElement = verseRefs.current.get(absoluteVerseNum);
     console.log(`Scrolling to verse ${absoluteVerseNum}. Element found: ${!!verseElement}`);
     verseElement?.scrollIntoView({ behavior: behavior, block: 'center' });

     programmaticScrollTimeout.current = setTimeout(() => {
       isProgrammaticScroll.current = false;
     }, behavior === 'smooth' ? 1000 : 100); // Shortened timeout
   }, []);

   const navigateToVerse = useCallback((absoluteVerseNum: number, scroll: boolean = true, immediateScroll: boolean = false) => {
     console.log(`Navigating to verse ${absoluteVerseNum}`);
     if (!quranMeta) {
        console.warn("Navigation skipped: Quran Meta not loaded.");
        setError("Cannot navigate: Quran data not loaded.");
        return;
     }

     const targetLocation = absoluteVerseToSurahAyah(absoluteVerseNum, quranMeta);
     if (!targetLocation) {
       toast({ title: "Navigation Error", description: `Verse ${absoluteVerseNum} is invalid.`, variant: "destructive" });
       console.error(`Invalid target location for verse ${absoluteVerseNum}`);
       return;
     }

     const { surahNumber: targetSurahNum } = targetLocation;

     console.log(`Setting currentAbsoluteVerse to ${absoluteVerseNum}`);
     setCurrentAbsoluteVerse(absoluteVerseNum);

     if (targetSurahNum !== currentSurahNumber) {
       console.log(`Navigating to new Surah: ${targetSurahNum}`);
       setPlayingVerseNumber(null); // Stop playback when changing surah
       setIsRepeatingVerse(null); // Stop repeating when changing surah
       setCurrentSurahNumber(targetSurahNum);
       // Load the new surah's data - loadVerses handles this now
       loadVerses(targetSurahNum, 1, true).then(() => {
            if (scroll) {
                // Ensure the DOM has updated before scrolling
                setTimeout(() => scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth'), 150);
            }
       });

     } else {
        // Already in the correct surah, just update focus and scroll
        console.log(`Target surah ${targetSurahNum} is current. Scrolling to verse ${absoluteVerseNum}.`);
        if (scroll) {
          scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth');
        }
     }
   }, [quranMeta, currentSurahNumber, scrollToVerse, toast, loadVerses]); // Added loadVerses dependency

    const handleNextVerseFocus = useCallback(() => {
        if (!quranMeta) return;
        const maxVerse = quranMeta.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0);
        const nextVerse = Math.min(currentAbsoluteVerse + 1, maxVerse);
        if (nextVerse !== currentAbsoluteVerse) {
           navigateToVerse(nextVerse);
        } else {
            console.log("Already at the last verse.");
        }
    }, [quranMeta, currentAbsoluteVerse, navigateToVerse]);

    const handlePreviousVerseFocus = useCallback(() => {
        const prevVerse = Math.max(1, currentAbsoluteVerse - 1);
         if (prevVerse !== currentAbsoluteVerse) {
            navigateToVerse(prevVerse);
         } else {
             console.log("Already at the first verse.");
         }
    }, [currentAbsoluteVerse, navigateToVerse]);

  const handleReciterChange = (reciterId: string) => {
    if (reciterId !== selectedReciter) {
        console.log("Reciter changed to:", reciterId);
        setSelectedReciter(reciterId);
        setPlayingVerseNumber(null); // Stop playback
        setIsRepeatingVerse(null); // Stop repeating
        const audioElement = audioRef.current; // Access audio element via ref from Controls
        if (audioElement && !audioElement.paused) {
           audioElement.pause();
        }
        // Reload current surah data with new reciter
        if (currentSurahNumber) {
            loadVerses(currentSurahNumber, 1, true); // Reload surah with new audio URLs
        }
    }
  };

   const handleTranslationChange = (translationId: string) => {
     if (translationId !== selectedTranslation) {
       console.log("Translation changed to:", translationId);
       setSelectedTranslation(translationId);
        // Reload current surah data with new translation
       if (currentSurahNumber) {
           loadVerses(currentSurahNumber, 1, true).then(() => {
                // Scroll to the current verse after reload
                setTimeout(() => scrollToVerse(currentAbsoluteVerse, 'instant'), 150);
           });
           toast({
             title: "Translation Changed",
             description: `Loading verses with ${translations.find(t => t.id === translationId)?.name ?? translationId}.`,
           });
       }
     }
   };

  const handleFontSizeChange = useCallback((value: number[]) => {
      console.log("Setting Font Size (Translation):", value[0]);
      setFontSize(value[0]);
  }, []);

  const handleArabicFontSizeChange = useCallback((value: number[]) => {
      console.log("Setting Font Size (Arabic):", value[0]);
      setArabicFontSize(value[0]);
  }, []);

  const handleLineHeightChange = useCallback((value: number[]) => {
      console.log("Setting Line Height (Arabic):", value[0]);
      setLineHeight(value[0]);
  }, []);

  const handleTranslationLineHeightChange = useCallback((value: number[]) => {
      console.log("Setting Line Height (Translation):", value[0]);
      setTranslationLineHeight(value[0]);
  }, []);

  const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
    if (!quranMeta) return;
    const value = parseInt(e.target.value, 10);
    const maxVerse = quranMeta.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0);
    if (!isNaN(value) && value >= 1 && value <= maxVerse) {
      if (value !== currentAbsoluteVerse) {
        navigateToVerse(value, true, true);
      }
    } else if (e.target.value !== '') {
       toast({ title: "Invalid Verse", description: `Please enter a verse number between 1 and ${maxVerse}.`, variant: "destructive" });
        // Reset input to current verse if invalid entry
        e.target.value = currentAbsoluteVerse.toString();
    }
  };

   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
       // Handled by Controls component local state for responsiveness
   };

  const handleJuzChange = (juz: number) => {
    const startVerse = JUZ_STARTS[juz];
    if (startVerse && startVerse !== currentAbsoluteVerse) {
      navigateToVerse(startVerse, true, true);
      toast({ title: "Navigated", description: `Jumped to Juz ${juz} (Verse ${startVerse}).` });
    }
  };

  const handlePageChange = (page: number) => {
    const startVerse = PAGE_STARTS[page];
    if (startVerse && startVerse !== currentAbsoluteVerse) {
      navigateToVerse(startVerse, true, true);
      toast({ title: "Navigated", description: `Jumped to Page ${page} (Verse ${startVerse}).` });
    }
  };

  const handleVerseContextMenu = (verseNumber: number) => {
    console.log(`Context menu triggered for verse ${verseNumber}`);
    setCurrentAbsoluteVerse(verseNumber); // Set focus immediately
    setIsNotesSidebarOpen(true);
  };

  const handleVerseClick = (verseNumber: number) => {
      if (verseNumber !== currentAbsoluteVerse) {
          setCurrentAbsoluteVerse(verseNumber);
          // Optionally stop audio if a different verse is clicked while playing
          const audioElement = audioRef.current; // Access audio element via ref from Controls
          if (audioElement && !audioElement.paused && playingVerseNumber !== verseNumber) {
              console.log(`Verse clicked (${verseNumber}), pausing current audio.`);
              audioElement.pause();
              setPlayingVerseNumber(null);
              setIsRepeatingVerse(null); // Stop repeating if another verse is clicked
          }
      } else {
         // If clicking the currently focused verse, maybe open notes?
         setIsNotesSidebarOpen(true);
      }
  };

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

  const toggleNotesSidebar = () => {
      setIsNotesSidebarOpen(prev => !prev);
      if (!isNotesSidebarOpen) {
         // Optionally ensure the current verse is set when opening
         setCurrentAbsoluteVerse(currentAbsoluteVerse);
      }
  };
  const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);

   const handleAudioPlay = () => {
      console.log("handleAudioPlay called, verse:", currentAbsoluteVerse);
      // isRepeatingVerse state is managed by the repeat toggle/handler now
      setPlayingVerseNumber(currentAbsoluteVerse);
      // Scroll to verse if needed, but only if not currently scrolling manually
      if (!isProgrammaticScroll.current) {
          const verseElement = verseRefs.current.get(currentAbsoluteVerse);
          if (verseElement) {
                const rect = verseElement.getBoundingClientRect();
                const container = scrollContainerRef.current;
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                     // Check if verse is fully or partially outside the viewport bounds
                    if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
                        scrollToVerse(currentAbsoluteVerse);
                    }
                }
          } else {
                // Verse element might not be rendered yet if just loaded
                setTimeout(() => scrollToVerse(currentAbsoluteVerse), 100);
          }
      }
   };
   const handleAudioPause = () => {
        console.log("handleAudioPause called");
        setPlayingVerseNumber(null);
        // Don't clear isRepeatingVerse here, pause might be temporary
   };
   const handleAudioEnd = useCallback(() => {
        console.log(`handleAudioEnd called for verse: ${playingVerseNumber}. Repeating: ${isRepeatingVerse === playingVerseNumber}`);
        setPlayingVerseNumber(null); // Indicate playback stopped visually

        if (isRepeatingVerse === currentAbsoluteVerse) { // Check against the *currently focused* verse
             console.log(`Looping verse ${currentAbsoluteVerse}`);
             // We don't set isRepeatingVerse to null here, it persists until explicitly toggled off
             setTimeout(() => { // Use timeout to ensure state update cycle completes
                const audioElement = audioRef.current;
                if (audioElement) {
                    audioElement.currentTime = 0;
                    audioElement.play().catch(err => handleAudioError(`Failed to loop audio: ${err instanceof Error ? err.message : 'Unknown error'}`));
                }
             }, 50); // Small delay
        } else {
            // If not repeating, move focus to the next verse (handled by Controls component)
            console.log("Audio ended naturally (not repeating), Controls will handle next focus.");
        }
   }, [playingVerseNumber, isRepeatingVerse, currentAbsoluteVerse]); // Add dependencies

   const handleAudioError = (errorMsg: string) => {
        console.error("Received audio error:", errorMsg);
        setPlayingVerseNumber(null);
        setIsRepeatingVerse(null); // Stop repeating on error
         // Avoid spamming toasts for the same error
         if (!error || !error.includes(errorMsg.substring(0, 30))) {
             toast({ title: "Audio Playback Error", description: errorMsg, variant: "destructive" });
             // setError(errorMsg); // Optionally set the main error state
         }
   };
    const updatePlayingVerseCallback = useCallback((verseNum: number | null) => {
       console.log("updatePlayingVerseCallback received:", verseNum);
       setPlayingVerseNumber(verseNum);
       // Only update *focused* verse if playback moved automatically *and* we are not repeating
       if (verseNum !== null && verseNum !== currentAbsoluteVerse && isRepeatingVerse !== verseNum) {
          console.log(`Updating focused verse to ${verseNum} due to automatic playback`);
          setCurrentAbsoluteVerse(verseNum);
       } else if (verseNum !== null && verseNum !== currentAbsoluteVerse) {
          console.log(`Playback moved to ${verseNum}, but not changing focus due to repeat or mismatch with currentAbsoluteVerse (${currentAbsoluteVerse})`);
       }
    }, [currentAbsoluteVerse, isRepeatingVerse]);

  // Handler for the "Repeat Verse" context menu option OR toggle button in Controls
  const handleRepeatVerseToggle = useCallback((verseNumber: number, shouldRepeat: boolean) => {
        console.log(`handleRepeatVerseToggle called for verse ${verseNumber}, shouldRepeat: ${shouldRepeat}`);
        const audioElement = audioRef.current;
        if (!audioElement) {
            toast({ title: "Audio Error", description: "Audio player not ready.", variant: "destructive" });
            return;
        }

        if (shouldRepeat) {
            // If starting repeat
            setIsRepeatingVerse(verseNumber); // Set the verse to repeat
            // If the verse to repeat is not the current one, navigate first
            if (verseNumber !== currentAbsoluteVerse) {
                 console.log(`Repeating verse ${verseNumber}, navigating first.`);
                 navigateToVerse(verseNumber, true, true); // Navigate and scroll immediately
                 // Delay playback until navigation and potential data load complete
                 setTimeout(() => {
                     console.log("Attempting to play verse after navigation for repeat.");
                     audioElement.play().catch(err => handleAudioError(`Failed to play repeat audio: ${err instanceof Error ? err.message : 'Unknown error'}`));
                 }, 250); // Increased delay slightly
            } else {
                // Already on the verse, restart and play if not already playing
                console.log(`Repeating verse ${verseNumber}, already focused. Restarting playback.`);
                if (audioElement.paused) {
                    audioElement.currentTime = 0;
                    audioElement.play().catch(err => handleAudioError(`Failed to play repeat audio: ${err instanceof Error ? err.message : 'Unknown error'}`));
                } else {
                    // If already playing, just ensure it loops on end (handled by handleAudioEnd)
                    audioElement.currentTime = 0; // Restart immediately
                }
            }
            toast({ title: "Repeat Verse", description: `Repeating verse ${verseNumber}.` });
        } else {
            // If stopping repeat
            console.log(`Stopping repeat for verse ${verseNumber}`);
            setIsRepeatingVerse(null); // Clear the repeat flag
            // Don't stop playback, just let it finish normally
            // If the audio was paused when repeat was toggled off, it stays paused.
             toast({ title: "Repeat Off", description: `Stopped repeating verse ${verseNumber}.` });
        }

    }, [currentAbsoluteVerse, navigateToVerse, toast, audioRef, handleAudioError]);


  // Find verse data for the *currently focused* verse to pass to controls/sidebars
  const currentVerseDataForControls = displayedVerses.find(v => v.verseNumber === currentAbsoluteVerse);

  const isAnythingLoading = isLoadingMeta || isLoadingReciters || isLoadingTranslations; // Removed isLoadingVerses as it's handled differently
  const isDisplayLoading = isLoadingMeta || (isLoadingVerses && displayedVerses.length === 0 && !error); // Show loading only when surah is actively loading
  const displayError = error && !isDisplayLoading;

  const currentSurahMetaData = quranMeta?.surahs.references.find(s => s?.number === currentSurahNumber) ?? null;
  const showBismillah = currentSurahMetaData && currentSurahMetaData.number !== 1 && currentSurahMetaData.number !== 9;

  const getCleanArabicName = (name: string | undefined): string => {
    if (!name) return '';
    // Basic cleaning, might need more robust logic depending on API variations
    return name.replace(/^سُورَةُ\s+/i, '').trim();
  };

  return (
    <div className="flex flex-col h-screen bg-background" dir="ltr">
        <Header
           quranMeta={quranMeta}
           navigateToVerse={navigateToVerse}
           isLoading={isAnythingLoading}
           onOpenSettings={toggleSettingsPanel}
           // Add callback for All Notes later: onOpenAllNotes={() => {}}
        />

       <div className="flex-grow overflow-hidden relative flex flex-col">
           {/* Fixed Header Area */}
            <div className="sticky-header flex-shrink-0">
                {currentSurahMetaData ? (
                    <div className="flex justify-between items-start gap-4">
                        {/* Left Side: English Info */}
                        <div className="text-left flex-1 min-w-0">
                            <h2 className="text-lg md:text-xl font-semibold text-foreground truncate">
                                {currentSurahMetaData.englishName}
                            </h2>
                            <p className="text-xs md:text-sm text-muted-foreground truncate">
                                {currentSurahMetaData.englishNameTranslation} ({currentSurahMetaData.numberOfAyahs} Ayahs)
                            </p>
                        </div>
                        {/* Right Side: Arabic Info & Number */}
                        <div className="text-right flex flex-col items-end flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl md:text-2xl font-amiri font-semibold text-foreground" lang="ar" dir="rtl">
                                    {getCleanArabicName(currentSurahMetaData.name)}
                                </h2>
                                <span className="inline-flex items-center justify-center bg-primary text-primary-foreground w-7 h-7 rounded-full text-sm font-medium flex-shrink-0">
                                    {currentSurahMetaData.number}
                                </span>
                            </div>
                            <p className="text-[0.6rem] md:text-xs italic text-muted-foreground mt-0.5">
                                {currentSurahMetaData.revelationType}
                            </p>
                        </div>
                    </div>
                ) : (
                     // Skeleton Loader for Header
                    <div className="flex justify-between items-center gap-4 h-[52px]"> {/* Match approximate height */}
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-5 w-3/5" />
                            <Skeleton className="h-3 w-2/5" />
                        </div>
                         <div className="flex items-center gap-2">
                             <Skeleton className="h-6 w-20" />
                             <Skeleton className="h-7 w-7 rounded-full" />
                         </div>
                    </div>
                )}
            </div>

           {/* Scrollable Verses Area */}
           <div
                className="flex-grow overflow-hidden" // Takes remaining height
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: isMobile ? 'pan-y pinch-zoom' : 'auto' }}
            >
                <ScrollArea
                    className="h-full" // ScrollArea takes full height of its container
                    viewportRef={scrollContainerRef} // Pass the ref here
                >
                    {/* Add a div inside ScrollArea's viewport for padding/styling */}
                    <div className="reader-verses-scroll-container">
                        {showBismillah && (
                        <p className="font-bismillah text-center text-foreground my-4 text-2xl md:text-3xl" aria-label="Bismillah">
                            {BISMILLAH_TEXT}
                        </p>
                        )}

                         {/* Loading State for Verses */}
                        {isDisplayLoading && (
                        <div className="space-y-6 p-4">
                            {[...Array(5)].map((_, i) => ( // Show more skeletons
                            <div key={i} className="flex flex-col gap-3 border-b border-border/30 pb-4 min-h-[80px]">
                                <Skeleton className="h-6 w-11/12 self-end" />
                                <Skeleton className="h-5 w-full" />
                            </div>
                            ))}
                            <p className="text-center text-muted-foreground mt-4 text-sm flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {isLoadingMeta ? 'Initializing...' : 'Loading Surah...'}
                            </p>
                        </div>
                        )}

                        {/* Error State */}
                        {displayError && (
                        <div className="flex flex-col justify-center items-center h-full p-6 text-center min-h-[200px]">
                            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                            <p className="text-destructive font-semibold mb-2">Loading Error</p>
                            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">{error}</p>
                            <Button onClick={() => {
                                setError(null);
                                if (!quranMeta) fetchInitialData();
                                else if (currentSurahNumber) loadVerses(currentSurahNumber, 1, true);
                                else fetchInitialData(); // Fallback retry
                            }}
                            variant="outline"
                            size="sm"
                            >
                            Retry
                            </Button>
                        </div>
                        )}

                         {/* Empty State */}
                        {!isDisplayLoading && !displayError && displayedVerses.length === 0 && (
                        <div className="flex justify-center items-center h-full p-6 min-h-[200px]">
                            <p className="text-center text-muted-foreground text-sm">No verses loaded. Select a Surah.</p>
                        </div>
                        )}

                        {/* Display Verses */}
                        {!isDisplayLoading && !displayError && displayedVerses.map((verse) => (
                            <div key={verse.verseNumber} ref={el => verseRefs.current.set(verse.verseNumber, el)}>
                                <VerseDisplay
                                    verse={verse}
                                    isHighlighted={verse.verseNumber === currentAbsoluteVerse}
                                    isPlaying={verse.verseNumber === playingVerseNumber} // Simplified playing check
                                    onContextMenu={handleVerseContextMenu}
                                    onClick={handleVerseClick}
                                    onRepeatVerse={() => handleRepeatVerseToggle(verse.verseNumber, isRepeatingVerse !== verse.verseNumber)} // Pass simple toggle
                                    // Removed hasNote prop - VerseDisplay now checks internally
                                    isRepeating={isRepeatingVerse === verse.verseNumber} // Pass repeat state for visual indication
                                />
                            </div>
                        ))}

                        {/* End of Surah Marker (No Load More needed) */}
                         <div ref={loadMoreRef} className={cn(
                            "flex justify-center items-center py-6 text-center min-h-[60px]",
                            (isDisplayLoading || displayError || displayedVerses.length === 0) && "hidden" // Hide if loading/error/empty
                            )}>
                             {!isLoadingVerses && !canLoadMore && !isDisplayLoading && !displayError && displayedVerses.length > 0 && (
                                <div className="text-center text-muted-foreground text-sm italic">End of Surah</div>
                            )}
                         </div>
                    </div>
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </div>
        </div>

       {/* Fixed Controls Area */}
       <div ref={controlsRef} className="sticky bottom-0 z-10 w-full flex-shrink-0 bg-background/90 backdrop-blur-sm border-t border-border/50">
         <Controls
           audioRef={audioRef} // Pass the audio ref to Controls
           verseNumber={currentAbsoluteVerse}
           audioUrl={currentVerseDataForControls?.audioUrl ?? null} // Use focused verse data
           reciters={reciters}
           selectedReciter={selectedReciter}
           onNextVerse={handleNextVerseFocus}
           onPreviousVerse={handlePreviousVerseFocus}
           onReciterChange={handleReciterChange}
           onVerseInputChange={handleVerseInputChange} // Still needed for direct input sync
           onVerseInputBlur={handleVerseInputBlur} // Still needed for commit
           onJuzChange={handleJuzChange}
           onPageChange={handlePageChange}
           isLoading={isAnythingLoading || isDisplayLoading} // Disable controls during initial load too
           isLoadingReciters={isLoadingReciters}
           quranMeta={quranMeta}
           onPlay={handleAudioPlay}
           onPause={handleAudioPause}
           onEnded={handleAudioEnd}
           onError={handleAudioError}
           updatePlayingVerse={updatePlayingVerseCallback}
           // Removed verse slider props
           onVerseSliderChange={() => {}}
           onVerseSliderCommit={() => {}}
           // Pass repeat state and handler
           isRepeatingVerse={isRepeatingVerse === currentAbsoluteVerse} // Tell controls if *this* verse is repeating
           onRepeatVerseToggle={handleRepeatVerseToggle} // Pass the consolidated toggle handler
         />
       </div>

       {/* Notes Sidebar */}
       <NotesSidebar
           currentAbsoluteVerseNumber={currentAbsoluteVerse}
           quranMeta={quranMeta}
           isOpen={isNotesSidebarOpen}
           onOpenChange={setIsNotesSidebarOpen}
           onNoteUpdated={updateNoteStatusForVerse} // Pass callback
       />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onOpenChange={setIsSettingsPanelOpen}
        fontSize={fontSize}
        arabicFontSize={arabicFontSize}
        lineHeight={lineHeight}
        translationLineHeight={translationLineHeight}
        translations={translations}
        selectedTranslation={selectedTranslation}
        onFontSizeChange={handleFontSizeChange}
        onArabicFontSizeChange={handleArabicFontSizeChange}
        onLineHeightChange={handleLineHeightChange}
        onTranslationLineHeightChange={handleTranslationLineHeightChange}
        onTranslationChange={handleTranslationChange}
        isLoading={isLoadingTranslations || isLoadingMeta}
      />
    </div>
  );
}
