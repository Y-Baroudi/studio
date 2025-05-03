
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
import { NotesSidebar } from './NotesSidebar'; // Corrected import
import { SettingsPanel } from './SettingsPanel';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Settings, ChevronDown, ChevronsDown, Loader2, AlertCircle, Info, Notebook } from 'lucide-react'; // Added Notebook icon
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'; // Import ScrollBar as well
import { useInView } from 'react-intersection-observer'; // For detecting when to load more
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION_ID = SUPPORTED_TRANSLATIONS[0]?.id ?? 'en.clearquran';
const DEFAULT_RECITER_ID = 'ar.alafasy';
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_ARABIC_FONT_SIZE = 24;
const DEFAULT_LINE_HEIGHT = 1.8;
const DEFAULT_TRANSLATION_LINE_HEIGHT = 1.6;
const SWIPE_THRESHOLD = 50;
const VERSES_TO_LOAD_AT_ONCE = 10;
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

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0.1,
    root: scrollContainerRef.current,
    rootMargin: '0px 0px 100px 0px',
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

      const startVerseIndex = startAyahNum - 1;
      const endVerseIndex = Math.min(startVerseIndex + VERSES_TO_LOAD_AT_ONCE - 1, surahMeta.numberOfAyahs - 1);
      const numberOfVersesToFetch = endVerseIndex - startVerseIndex + 1;

      if (numberOfVersesToFetch <= 0 && !replace) {
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
       if (replace && startAyahNum === 1) {
           console.log(`Using getSurahData for Surah ${surahNum}`);
           const surahVerses = await getSurahData(surahNum, selectedTranslation, selectedReciter, quranMeta);
           if (surahVerses) {
               console.log(`Loaded ${surahVerses.length} verses via getSurahData.`);
               setDisplayedVerses(surahVerses);
               setCanLoadMore(false);
           } else {
                console.error(`getSurahData failed for Surah ${surahNum}.`);
                throw new Error(`Failed to fetch complete data for Surah ${surahNum}.`);
           }
       } else {
            console.log(`Using getVerse loop for Surah ${surahNum}, Ayah ${startAyahNum}`);
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
           const newVerses = fetchedVersesNullable.filter(v => v !== null) as Verse[];

            console.log(`Fetched ${newVerses.length} individual verses.`);

           if (newVerses.length === 0 && numberOfVersesToFetch > 0) {
               console.warn(`Failed to fetch any verses in range ${startAyahNum}-${endVerseIndex + 1} for Surah ${surahNum}.`);
               if(replace) setError(`Failed to load verses for Surah ${surahNum}. Please try again.`);
               setCanLoadMore(false);
           } else {
               setDisplayedVerses(prev => replace ? newVerses : [...prev, ...newVerses]);
               const lastLoadedAyah = newVerses[newVerses.length - 1]?.ayahNumberInSurah;
               setCanLoadMore(lastLoadedAyah < surahMeta.numberOfAyahs);
                console.log(`Can load more: ${lastLoadedAyah < surahMeta.numberOfAyahs}`);
           }
       }
       setError(null);

     } catch (err) {
       console.error(`Error loading verses for Surah ${surahNum} starting from ayah ${startAyahNum}:`, err);
       setError(`Failed to load verses. ${err instanceof Error ? err.message : ''}. Please check your connection or settings.`);
       setCanLoadMore(false);
       if (replace) setDisplayedVerses([]);
     } finally {
       setIsLoadingVerses(false);
       console.log("Finished loading verses attempt.");
     }
   }, [quranMeta, selectedTranslation, selectedReciter, isLoadingVerses, isLoadingMeta]);

   useEffect(() => {
     const canLoadInitial = quranMeta && selectedTranslation && currentSurahNumber !== null && displayedVerses.length === 0 && !isLoadingVerses && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations && !error;

     if (canLoadInitial) {
       console.log(`Initial load triggered for Surah ${currentSurahNumber}`);
       loadVerses(currentSurahNumber, 1, true);
     } else {
        if (displayedVerses.length === 0 && !isLoadingVerses && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations) {
            console.log(`Initial load condition not met: quranMeta=${!!quranMeta}, selectedTranslation=${!!selectedTranslation}, currentSurahNumber=${currentSurahNumber}, isLoadingVerses=${isLoadingVerses}, isLoadingMeta=${isLoadingMeta}, error=${!!error}`);
        }
     }
   }, [quranMeta, selectedTranslation, currentSurahNumber, isLoadingVerses, isLoadingMeta, isLoadingReciters, isLoadingTranslations, error, loadVerses]);

   useEffect(() => {
       if (loadMoreInView && canLoadMore && !isLoadingVerses && currentSurahNumber && displayedVerses.length > 0) {
           const nextAyahToLoad = displayedVerses[displayedVerses.length - 1].ayahNumberInSurah + 1;
           console.log(`Load more triggered: Loading from Ayah ${nextAyahToLoad} in Surah ${currentSurahNumber}`);
           loadVerses(currentSurahNumber, nextAyahToLoad, false);
       }
   }, [loadMoreInView, canLoadMore, isLoadingVerses, currentSurahNumber, displayedVerses, loadVerses]);

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
     }, behavior === 'smooth' ? 1000 : 50);
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
       setPlayingVerseNumber(null);
       setCurrentSurahNumber(targetSurahNum);
       setDisplayedVerses([]);
       setCanLoadMore(true);
        setIsLoadingVerses(true);
        getSurahData(targetSurahNum, selectedTranslation, selectedReciter, quranMeta)
           .then(verses => {
               if (verses) {
                   console.log(`Loaded ${verses.length} verses for new Surah ${targetSurahNum}.`);
                   setDisplayedVerses(verses);
                   setCanLoadMore(false);
                   if(scroll) {
                       setTimeout(() => scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth'), 150);
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
        const isVerseLoaded = displayedVerses.some(v => v.verseNumber === absoluteVerseNum);
        console.log(`Target surah ${targetSurahNum} is current. Verse ${absoluteVerseNum} loaded: ${isVerseLoaded}`);
        if (!isVerseLoaded) {
            console.warn(`Verse ${absoluteVerseNum} in Surah ${targetSurahNum} not loaded. Re-loading surah.`);
            setPlayingVerseNumber(null);
            setDisplayedVerses([]);
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
          console.log(`Verse ${absoluteVerseNum} already loaded, scrolling.`);
          scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth');
        }
     }
   }, [quranMeta, currentSurahNumber, displayedVerses, scrollToVerse, toast, selectedTranslation, selectedReciter]);

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

  const handleReciterChange = (reciterId: string) => {
    if (reciterId !== selectedReciter) {
        console.log("Reciter changed to:", reciterId);
        setSelectedReciter(reciterId);
        setPlayingVerseNumber(null);
        const audioElement = document.querySelector('audio');
        if (audioElement && !audioElement.paused) {
           audioElement.pause();
        }
        if (currentSurahNumber && quranMeta) {
             setIsLoadingVerses(true);
             getSurahData(currentSurahNumber, selectedTranslation, reciterId, quranMeta)
               .then(verses => {
                 if (verses) {
                   setDisplayedVerses(verses);
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
       if (currentSurahNumber && quranMeta) {
          setDisplayedVerses([]);
          setCanLoadMore(true);
           setIsLoadingVerses(true);
           getSurahData(currentSurahNumber, translationId, selectedReciter, quranMeta)
             .then(verses => {
                 if (verses) {
                     setDisplayedVerses(verses);
                     setCanLoadMore(false);
                     setTimeout(() => scrollToVerse(currentAbsoluteVerse, 'instant'), 100);
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
        e.target.value = currentAbsoluteVerse.toString();
    }
  };

   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
       // Handled by Controls component
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
    setCurrentAbsoluteVerse(verseNumber);
    setIsNotesSidebarOpen(true);
  };

  const handleVerseClick = (verseNumber: number) => {
      if (verseNumber !== currentAbsoluteVerse) {
          setCurrentAbsoluteVerse(verseNumber);
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

  const toggleNotesSidebar = () => setIsNotesSidebarOpen(prev => !prev);
  const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);

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
                 const tolerance = 50;
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

  const currentVerseDataForAudio = displayedVerses.find(v => v.verseNumber === currentAbsoluteVerse);
  const currentVerseDataForSidebars = currentVerseDataForAudio;

  const isAnythingLoading = isLoadingMeta || isLoadingReciters || isLoadingTranslations || isLoadingVerses;
  const isEssentialLoading = isLoadingMeta || (isLoadingVerses && displayedVerses.length === 0 && !error);
  const displayError = error && !isEssentialLoading;

  const currentSurahMetaData = quranMeta?.surahs.references.find(s => s?.number === currentSurahNumber) ?? null;
  const showBismillah = currentSurahMetaData && currentSurahMetaData.number !== 1 && currentSurahMetaData.number !== 9;
  const getCleanArabicName = (name: string | undefined): string => {
    if (!name) return '';
    return name.replace(/^سُورَةُ\s+/, '');
  };

  return (
    <div className="flex flex-col h-screen bg-background" dir="ltr">
        <Header
           quranMeta={quranMeta}
           navigateToVerse={navigateToVerse}
           isLoading={isAnythingLoading}
           onOpenSettings={toggleSettingsPanel}
        />

        <div className="flex-grow overflow-hidden relative flex flex-col">
             <div className="sticky-header flex-shrink-0">
                {currentSurahMetaData ? (
                    <div className="flex justify-between items-start gap-4">
                        <div className="text-left">
                            <h2 className="text-lg md:text-xl font-semibold text-foreground flex items-center gap-2">
                                {currentSurahMetaData.englishName}
                            </h2>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                {currentSurahMetaData.englishNameTranslation} ({currentSurahMetaData.numberOfAyahs} Ayahs)
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <div className="flex items-center gap-2">
                               <h2 className="text-xl md:text-2xl font-amiri font-semibold text-foreground" lang="ar" dir="rtl">
                                 {getCleanArabicName(currentSurahMetaData.name)}
                               </h2>
                               <span className="inline-flex items-center justify-center bg-primary text-primary-foreground w-7 h-7 rounded-full text-sm flex-shrink-0">
                                   {currentSurahMetaData.number}
                               </span>
                            </div>
                            <p className="text-[0.6rem] md:text-xs italic text-muted-foreground mt-0.5">
                                {currentSurahMetaData.revelationType}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center gap-4">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-6 w-1/4" />
                    </div>
                )}
            </div>

           <div
                className="flex-grow overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: isMobile ? 'pan-y pinch-zoom' : 'auto' }}
            >
                <ScrollArea
                    className="h-full"
                    viewportRef={scrollContainerRef}
                >
                    <div className="reader-verses-scroll-container">
                        {showBismillah && (
                        <p className="font-bismillah text-center text-foreground my-4 text-2xl md:text-3xl" aria-label="Bismillah">
                            {BISMILLAH_TEXT}
                        </p>
                        )}

                        {isEssentialLoading && (
                        <div className="space-y-6 p-4">
                            {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex flex-col gap-4 border-b border-border/30 pb-4">
                                <Skeleton className="h-20 w-full mb-2" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                            ))}
                            <p className="text-center text-muted-foreground mt-4 text-sm">
                            {isLoadingMeta ? 'Initializing reader...' : 'Loading verses...'}
                            </p>
                        </div>
                        )}

                        {displayError && (
                        <div className="flex flex-col justify-center items-center h-full p-6 text-center">
                            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                            <p className="text-destructive font-semibold mb-2">Loading Error</p>
                            <p className="text-sm text-muted-foreground mb-4">{error}</p>
                            <Button onClick={() => {
                                setError(null);
                                if (!quranMeta) {
                                    fetchInitialData();
                                } else if (currentSurahNumber && displayedVerses.length === 0) {
                                    loadVerses(currentSurahNumber, 1, true);
                                } else {
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

                        {!isEssentialLoading && !displayError && displayedVerses.length === 0 && (
                        <div className="flex justify-center items-center h-full p-6">
                            <p className="text-center text-muted-foreground text-sm">No verses loaded. Select a Surah or navigate.</p>
                        </div>
                        )}

                        {!isEssentialLoading && !displayError && displayedVerses.map((verse) => (
                        <div key={verse.verseNumber} ref={el => verseRefs.current.set(verse.verseNumber, el)}>
                            <VerseDisplay
                                verse={verse}
                                isHighlighted={verse.verseNumber === currentAbsoluteVerse}
                                isPlaying={verse.verseNumber === playingVerseNumber}
                                onContextMenu={handleVerseContextMenu}
                                onClick={handleVerseClick}
                            />
                        </div>
                        ))}

                        <div ref={loadMoreRef} className={cn(
                            "flex justify-center items-center py-6 text-center min-h-[60px]",
                            (isEssentialLoading || displayError) && "hidden"
                            )}>
                            {isLoadingVerses && displayedVerses.length > 0 && (
                            <Button variant="ghost" disabled>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading More...
                            </Button>
                            )}
                            {canLoadMore && !isLoadingVerses && (
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
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </div>
        </div>

       <div ref={controlsRef} className="sticky bottom-0 z-10 w-full flex-shrink-0 bg-background">
         <Controls
           verseNumber={currentAbsoluteVerse}
           audioUrl={currentVerseDataForAudio?.audioUrl ?? null}
           reciters={reciters}
           selectedReciter={selectedReciter}
           onNextVerse={handleNextVerseFocus}
           onPreviousVerse={handlePreviousVerseFocus}
           onReciterChange={handleReciterChange}
           onVerseInputChange={handleVerseInputChange}
           onVerseInputBlur={handleVerseInputBlur}
           onJuzChange={handleJuzChange}
           onPageChange={handlePageChange}
           isLoading={isAnythingLoading}
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
         />
       </div>

       {/* Notes Sidebar */}
       <NotesSidebar
           currentAbsoluteVerseNumber={currentAbsoluteVerse} // Pass absolute verse number
           quranMeta={quranMeta} // Pass Quran metadata
           isOpen={isNotesSidebarOpen}
           onOpenChange={setIsNotesSidebarOpen}
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
