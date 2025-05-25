
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
import { Settings, ChevronDown, ChevronsDown, Loader2, AlertCircle, Info, Notebook } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useInView } from 'react-intersection-observer';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { checkNoteExists } from '@/services/notes';
import { ConceptExplorer } from '@/components/quran/ConceptExplorer'; // Assuming this will be created
import { ChatPanel } from '@/components/chat/ChatPanel'; // Assuming this will be created


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
  const [versesWithNotes, setVersesWithNotes] = useState<Set<number>>(new Set());
  const [isRepeatingVerse, setIsRepeatingVerse] = useState<number | null>(null);

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
  const [isConceptExplorerOpen, setIsConceptExplorerOpen] = useState(false); // State for ConceptExplorer
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false); // State for ChatPanel
  const [chatPanelContext, setChatPanelContext] = useState<Verse | null>(null);


  const { toast } = useToast();
  const isMobile = useIsMobile();

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const verseRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const isProgrammaticScroll = useRef<boolean>(false);
  const programmaticScrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0.1,
    rootMargin: '0px 0px 200px 0px',
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

   const updateNoteStatusForVerse = useCallback((absoluteVerseNumber: number, hasNote: boolean) => {
     setVersesWithNotes(prev => {
       const newSet = new Set(prev);
       if (hasNote) {
         newSet.add(absoluteVerseNumber);
       } else {
         newSet.delete(absoluteVerseNumber);
       }
       return newSet;
     });
   }, []);

   useEffect(() => {
      if (typeof window !== 'undefined' && displayedVerses.length > 0) {
          const notesExistSet = new Set<number>();
          displayedVerses.forEach(verse => {
              if (checkNoteExists(verse.verseNumber)) {
                  notesExistSet.add(verse.verseNumber);
              }
          });
          setVersesWithNotes(notesExistSet);
      }
   }, [displayedVerses]);


  const fetchInitialData = useCallback(async () => {
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
        } else {
          setCurrentSurahNumber(1);
          setError("Failed to determine starting surah.");
        }
      } else {
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
                 if (selectedTranslation) { // Check if selectedTranslation was previously set
                     toast({ title: "Translation Reset", description: `Switched to ${newTranslation}.` });
                 }
             } else {
                 setSelectedTranslation('');
                 toast({ title: "No Translations Available", description: "Could not load text translations.", variant: "destructive" });
             }
        }
      } else {
        setTranslations(SUPPORTED_TRANSLATIONS); // Fallback
        toast({ title: "Translation Loading Failed", description: "Using default translations.", variant: "destructive" });
      }
      setIsLoadingTranslations(false);

    } catch (err) {
      setError('An unexpected error occurred while loading data. Please refresh.');
      setQuranMeta(null);
      setReciters([]);
      setTranslations(SUPPORTED_TRANSLATIONS);
    } finally {
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
        return;
     }
     setIsLoadingVerses(true);
     if (replace) {
        setError(null);
        verseRefs.current.clear();
        setDisplayedVerses([]);
     }

     const surahMeta = quranMeta.surahs.references.find(s => s.number === surahNum);
     if (!surahMeta) {
        setError(`Metadata for Surah ${surahNum} not found.`);
        setIsLoadingVerses(false);
        setCanLoadMore(false);
        setDisplayedVerses([]);
        return;
     }

     try {
         const surahVerses = await getSurahData(surahNum, selectedTranslation, selectedReciter, quranMeta);
         if (surahVerses) {
             setDisplayedVerses(surahVerses);
             setCanLoadMore(false);
             setError(null);
         } else {
             throw new Error(`Failed to fetch complete data for Surah ${surahNum}.`);
         }
     } catch (err) {
         setError(`Failed to load verses. ${err instanceof Error ? err.message : ''}. Please check your connection or settings.`);
         setCanLoadMore(false);
         setDisplayedVerses([]);
     } finally {
         setIsLoadingVerses(false);
     }
   }, [quranMeta, selectedTranslation, selectedReciter, isLoadingVerses, isLoadingMeta]);

   useEffect(() => {
     const canLoadInitial = quranMeta && selectedTranslation && currentSurahNumber !== null && displayedVerses.length === 0 && !isLoadingVerses && !isLoadingMeta && !isLoadingReciters && !isLoadingTranslations && !error;

     if (canLoadInitial) {
       loadVerses(currentSurahNumber, 1, true);
     }
   }, [quranMeta, selectedTranslation, currentSurahNumber, isLoadingVerses, isLoadingMeta, isLoadingReciters, isLoadingTranslations, error, loadVerses, displayedVerses.length]);


   const scrollToVerse = useCallback((absoluteVerseNum: number, behavior: ScrollBehavior = 'smooth') => {
     if (programmaticScrollTimeout.current) {
       clearTimeout(programmaticScrollTimeout.current);
     }
     isProgrammaticScroll.current = true;

     const verseElement = verseRefs.current.get(absoluteVerseNum);
     verseElement?.scrollIntoView({ behavior: behavior, block: 'center' });

     programmaticScrollTimeout.current = setTimeout(() => {
       isProgrammaticScroll.current = false;
     }, behavior === 'smooth' ? 1000 : 100);
   }, []);

   const navigateToVerse = useCallback((absoluteVerseNum: number, scroll: boolean = true, immediateScroll: boolean = false) => {
     if (!quranMeta) {
        setError("Cannot navigate: Quran data not loaded.");
        return;
     }

     const targetLocation = absoluteVerseToSurahAyah(absoluteVerseNum, quranMeta);
     if (!targetLocation) {
       toast({ title: "Navigation Error", description: `Verse ${absoluteVerseNum} is invalid.`, variant: "destructive" });
       return;
     }

     const { surahNumber: targetSurahNum } = targetLocation;
     setCurrentAbsoluteVerse(absoluteVerseNum);

     if (targetSurahNum !== currentSurahNumber) {
       setPlayingVerseNumber(null);
       setIsRepeatingVerse(null);
       setCurrentSurahNumber(targetSurahNum);
       loadVerses(targetSurahNum, 1, true).then(() => {
            if (scroll) {
                setTimeout(() => scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth'), 150);
            }
       });

     } else {
        if (scroll) {
          scrollToVerse(absoluteVerseNum, immediateScroll ? 'instant' : 'smooth');
        }
     }
   }, [quranMeta, currentSurahNumber, scrollToVerse, toast, loadVerses]);

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

  const handleReciterChange = useCallback((reciterId: string) => {
    if (reciterId !== selectedReciter) {
        setSelectedReciter(reciterId);
        setPlayingVerseNumber(null);
        setIsRepeatingVerse(null);
        const audioElement = audioRef.current;
        if (audioElement && !audioElement.paused) {
           audioElement.pause();
        }
        if (currentSurahNumber) {
            loadVerses(currentSurahNumber, 1, true).then(() => {
                 setTimeout(() => scrollToVerse(currentAbsoluteVerse, 'instant'), 150);
            });
        }
    }
  }, [selectedReciter, currentSurahNumber, loadVerses, scrollToVerse, currentAbsoluteVerse]);

   const handleTranslationChange = useCallback((translationId: string) => {
     if (translationId !== selectedTranslation) {
       setSelectedTranslation(translationId);
       if (currentSurahNumber) {
           loadVerses(currentSurahNumber, 1, true).then(() => {
                setTimeout(() => scrollToVerse(currentAbsoluteVerse, 'instant'), 150);
           });
           toast({
             title: "Translation Changed",
             description: `Loading verses with ${translations.find(t => t.id === translationId)?.name ?? translationId}.`,
           });
       }
     }
   }, [selectedTranslation, currentSurahNumber, loadVerses, scrollToVerse, currentAbsoluteVerse, toast, translations]);

  const handleFontSizeChange = useCallback((value: number[]) => {
      setFontSize(value[0]);
  }, []);

  const handleArabicFontSizeChange = useCallback((value: number[]) => {
      setArabicFontSize(value[0]);
  }, []);

  const handleLineHeightChange = useCallback((value: number[]) => {
      setLineHeight(value[0]);
  }, []);

  const handleTranslationLineHeightChange = useCallback((value: number[]) => {
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

   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {};

  const handleJuzChange = useCallback((juz: number) => {
    const startVerse = JUZ_STARTS[juz];
    if (startVerse && startVerse !== currentAbsoluteVerse) {
      navigateToVerse(startVerse, true, true);
      toast({ title: "Navigated", description: `Jumped to Juz ${juz} (Verse ${startVerse}).` });
    }
  }, [currentAbsoluteVerse, navigateToVerse, toast]);

  const handlePageChange = useCallback((page: number) => {
    const startVerse = PAGE_STARTS[page];
    if (startVerse && startVerse !== currentAbsoluteVerse) {
      navigateToVerse(startVerse, true, true);
      toast({ title: "Navigated", description: `Jumped to Page ${page} (Verse ${startVerse}).` });
    }
  }, [currentAbsoluteVerse, navigateToVerse, toast]);

  const handleVerseContextMenu = useCallback((verseNumber: number) => {
    setCurrentAbsoluteVerse(verseNumber);
    setIsNotesSidebarOpen(true);
  }, []);

  const handleVerseClick = useCallback((verseNumber: number) => {
      if (verseNumber !== currentAbsoluteVerse) {
          setCurrentAbsoluteVerse(verseNumber);
          const audioElement = audioRef.current;
          if (audioElement && !audioElement.paused && playingVerseNumber !== verseNumber) {
              audioElement.pause();
              setPlayingVerseNumber(null);
              setIsRepeatingVerse(null);
          }
      } else {
         setIsNotesSidebarOpen(true);
      }
  }, [currentAbsoluteVerse, playingVerseNumber]);

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
    const handleTouchEnd = useCallback(() => {
        if (!isMobile || touchStartX.current === null || touchEndX.current === null) return;
        const dx = touchEndX.current - touchStartX.current;
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx > 0) { handlePreviousVerseFocus(); }
            else { handleNextVerseFocus(); }
        }
        touchStartX.current = null;
        touchEndX.current = null;
    }, [isMobile, handlePreviousVerseFocus, handleNextVerseFocus]);


  const toggleNotesSidebar = () => {
      setIsNotesSidebarOpen(prev => !prev);
  };
  const toggleSettingsPanel = () => setIsSettingsPanelOpen(prev => !prev);
  const toggleConceptExplorer = () => setIsConceptExplorerOpen(prev => !prev);
  const toggleChatPanel = (verseData?: Verse | null) => {
    if (verseData) setChatPanelContext(verseData);
    else if (isChatPanelOpen) setChatPanelContext(null); // Clear context if closing
    setIsChatPanelOpen(prev => !prev);
  };


   const handleAudioPlay = useCallback(() => {
      setPlayingVerseNumber(currentAbsoluteVerse);
      if (!isProgrammaticScroll.current) {
          const verseElement = verseRefs.current.get(currentAbsoluteVerse);
          if (verseElement) {
                const rect = verseElement.getBoundingClientRect();
                const container = scrollContainerRef.current;
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
                        scrollToVerse(currentAbsoluteVerse);
                    }
                }
          } else {
                setTimeout(() => scrollToVerse(currentAbsoluteVerse), 100);
          }
      }
   }, [currentAbsoluteVerse, scrollToVerse]);

   const handleAudioPause = useCallback(() => {
        setPlayingVerseNumber(null);
   }, []);

   const handleAudioEnd = useCallback(() => {
        setPlayingVerseNumber(null);
        if (isRepeatingVerse === currentAbsoluteVerse) {
             setTimeout(() => {
                const audioElement = audioRef.current;
                if (audioElement) {
                    audioElement.currentTime = 0;
                    audioElement.play().catch(err => handleAudioError(`Failed to loop audio: ${err instanceof Error ? err.message : 'Unknown error'}`));
                }
             }, 50);
        } else {
            handleNextVerseFocus();
        }
   }, [playingVerseNumber, isRepeatingVerse, currentAbsoluteVerse, handleNextVerseFocus, handleAudioError]); // Added handleAudioError


   const handleAudioError = useCallback((errorMsg: string) => {
        setPlayingVerseNumber(null);
        setIsRepeatingVerse(null);
         if (!error || !error.includes(errorMsg.substring(0, 30))) {
             toast({ title: "Audio Playback Error", description: errorMsg, variant: "destructive" });
             setError(errorMsg);
         }
   }, [toast, error, setError]); // Added setError to dependencies

    const updatePlayingVerseCallback = useCallback((verseNum: number | null) => {
       setPlayingVerseNumber(verseNum);
       if (verseNum !== null && verseNum !== currentAbsoluteVerse && isRepeatingVerse !== verseNum) {
          setCurrentAbsoluteVerse(verseNum);
       }
    }, [currentAbsoluteVerse, isRepeatingVerse]);

  const handleRepeatVerseToggle = useCallback((verseNumber: number, shouldRepeat: boolean) => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            toast({ title: "Audio Error", description: "Audio player not ready.", variant: "destructive" });
            return;
        }

        if (shouldRepeat) {
            setIsRepeatingVerse(verseNumber);
            if (verseNumber !== currentAbsoluteVerse) {
                 navigateToVerse(verseNumber, true, true);
                 setTimeout(() => {
                     audioElement.play().catch(err => handleAudioError(`Failed to play repeat audio: ${err instanceof Error ? err.message : 'Unknown error'}`));
                 }, 250);
            } else {
                if (audioElement.paused) {
                    audioElement.currentTime = 0;
                    audioElement.play().catch(err => handleAudioError(`Failed to play repeat audio: ${err instanceof Error ? err.message : 'Unknown error'}`));
                } else {
                    audioElement.currentTime = 0;
                }
            }
            toast({ title: "Repeat Verse", description: `Repeating verse ${absoluteVerseToSurahAyah(verseNumber, quranMeta)?.reference}.` });
        } else {
            setIsRepeatingVerse(null);
            toast({ title: "Repeat Off", description: `Stopped repeating verse ${absoluteVerseToSurahAyah(verseNumber, quranMeta)?.reference}.` });
        }
    }, [currentAbsoluteVerse, navigateToVerse, toast, audioRef, handleAudioError, quranMeta]);


  const currentVerseData = displayedVerses.find(v => v.verseNumber === currentAbsoluteVerse);
  const currentAudioUrl = currentVerseData?.audioUrl ?? null;

  const isAnythingLoading = isLoadingMeta || isLoadingReciters || isLoadingTranslations;
  const isDisplayLoading = isLoadingMeta || (isLoadingVerses && displayedVerses.length === 0 && !error);
  const displayError = error && !isDisplayLoading;

  const currentSurahMetaData = quranMeta?.surahs.references.find(s => s?.number === currentSurahNumber) ?? null;
  const showBismillah = currentSurahMetaData && currentSurahMetaData.number !== 1 && currentSurahMetaData.number !== 9;

  const getCleanArabicName = (name: string | undefined): string => {
    if (!name) return '';
    return name.replace(/^سُورَةُ\s+/i, '').trim();
  };

  return (
    <div className="flex flex-col h-screen bg-background" dir="ltr">
        <audio ref={audioRef} preload="metadata" />

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
                        <div className="text-left flex-1 min-w-0">
                            <h2 className="text-lg md:text-xl font-semibold text-foreground truncate">
                                {currentSurahMetaData.englishName}
                            </h2>
                            <p className="text-xs md:text-sm text-muted-foreground truncate">
                                {currentSurahMetaData.englishNameTranslation} ({currentSurahMetaData.numberOfAyahs} Ayahs)
                            </p>
                        </div>
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
                    <div className="flex justify-between items-center gap-4 h-[52px]">
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

                        {isDisplayLoading && (
                        <div className="space-y-6 p-4">
                            {[...Array(5)].map((_, i) => (
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

                        {displayError && (
                        <div className="flex flex-col justify-center items-center h-full p-6 text-center min-h-[200px]">
                            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                            <p className="text-destructive font-semibold mb-2">Loading Error</p>
                            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">{error}</p>
                            <Button onClick={() => {
                                setError(null);
                                if (!quranMeta) fetchInitialData();
                                else if (currentSurahNumber) loadVerses(currentSurahNumber, 1, true);
                                else fetchInitialData();
                            }}
                            variant="outline"
                            size="sm"
                            >
                            Retry
                            </Button>
                        </div>
                        )}

                        {!isDisplayLoading && !displayError && displayedVerses.length === 0 && (
                        <div className="flex justify-center items-center h-full p-6 min-h-[200px]">
                            <p className="text-center text-muted-foreground text-sm">No verses loaded. Select a Surah.</p>
                        </div>
                        )}

                        {!isDisplayLoading && !displayError && displayedVerses.map((verse) => (
                            <div key={verse.verseNumber} ref={el => verseRefs.current.set(verse.verseNumber, el)}>
                                <VerseDisplay
                                    verse={verse}
                                    isHighlighted={verse.verseNumber === currentAbsoluteVerse}
                                    isPlaying={verse.verseNumber === playingVerseNumber}
                                    onContextMenu={handleVerseContextMenu}
                                    onClick={handleVerseClick}
                                    onRepeatVerse={() => handleRepeatVerseToggle(verse.verseNumber, isRepeatingVerse !== verse.verseNumber)}
                                    isRepeating={isRepeatingVerse === verse.verseNumber}
                                    hasNoteOrTag={versesWithNotes.has(verse.verseNumber)}
                                    onDiscussVerse={() => toggleChatPanel(verse)}
                                />
                            </div>
                        ))}

                         <div ref={loadMoreRef} className={cn(
                            "flex justify-center items-center py-6 text-center min-h-[60px]",
                            (isDisplayLoading || displayError || displayedVerses.length === 0) && "hidden"
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

       <div ref={controlsRef} className="sticky bottom-0 z-10 w-full flex-shrink-0 bg-background/90 backdrop-blur-sm border-t border-border/50">
         <Controls
           audioRef={audioRef}
           verseNumber={currentAbsoluteVerse}
           audioUrl={currentAudioUrl}
           reciters={reciters}
           selectedReciter={selectedReciter}
           onNextVerse={handleNextVerseFocus}
           onPreviousVerse={handlePreviousVerseFocus}
           onReciterChange={handleReciterChange}
           onVerseInputChange={handleVerseInputChange}
           onVerseInputBlur={handleVerseInputBlur}
           onJuzChange={handleJuzChange}
           onPageChange={handlePageChange}
           isLoading={isAnythingLoading || isDisplayLoading}
           isLoadingReciters={isLoadingReciters}
           quranMeta={quranMeta}
           onPlay={handleAudioPlay}
           onPause={handleAudioPause}
           onEnded={handleAudioEnd}
           onError={handleAudioError}
           updatePlayingVerse={updatePlayingVerseCallback}
           onVerseSliderChange={() => {}}
           onVerseSliderCommit={() => {}}
           isRepeatingVerse={isRepeatingVerse === currentAbsoluteVerse}
           onRepeatVerseToggle={handleRepeatVerseToggle}
           onOpenConceptExplorer={toggleConceptExplorer} // Pass handler for concept explorer
         />
       </div>

       <NotesSidebar
           currentAbsoluteVerseNumber={currentAbsoluteVerse}
           quranMeta={quranMeta}
           isOpen={isNotesSidebarOpen}
           onOpenChange={setIsNotesSidebarOpen}
           onNoteUpdated={updateNoteStatusForVerse}
       />

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

      <ConceptExplorer
        isOpen={isConceptExplorerOpen}
        onOpenChange={setIsConceptExplorerOpen}
        onVerseSelect={(verseNum) => navigateToVerse(verseNum, true, true)}
      />

      <ChatPanel
        isOpen={isChatPanelOpen}
        onOpenChange={setIsChatPanelOpen}
        verseContext={chatPanelContext}
      />

    </div>
  );
}
