
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchReciters,
  fetchTranslations,
  fetchQuranMeta,
  fetchSurahData,
  VerseData,
  Translation,
  Reciter,
  SurahMeta,
  QuranMeta,
} from '@/services/alquran-cloud';
import { VerseDisplay } from '@/components/quran/VerseDisplay';
import { Controls } from '@/components/quran/Controls';
import { SurahList } from '@/components/quran/SurahList';
import { SettingsPanel } from '@/components/quran/SettingsPanel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Settings,
  ChevronDown,
  Loader2,
  AlertCircle,
  Notebook,
  BookOpen,
  Tags,
  MessageSquare,
  Menu
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInView } from 'react-intersection-observer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { JUZ_STARTS, PAGE_STARTS, getSurahAndVerseFromAbsolute } from '@/data/quranMappings';
import { saveNote, getNoteForVerse, checkNoteExists } from '@/services/notes';
import { getAllConcepts, getConceptsForVerse, tagVerseWithConcepts, untagVerseConcepts } from '@/services/concepts';
import { NotesSidebar } from '@/components/quran/NotesSidebar';
import { ConceptExplorer } from '@/components/quran/ConceptExplorer';
import { ChatPanel } from '@/components/chat/ChatPanel';


// Default values
const DEFAULT_SURAH_NUMBER = 1;
const VERSES_TO_LOAD_AT_ONCE = 20; // Number of verses to fetch/render at a time

// Component State Interface
interface ReaderViewState {
  quranMeta: QuranMeta | null;
  surahData: Map<number, SurahMeta>; // Cache for surah metadata
  displayedVerses: VerseData[];
  currentSurahNumber: number;
  currentVerseNumber: number; // Highlighted/selected verse number within the current surah
  reciters: Reciter[];
  selectedReciter: string;
  translations: Translation[];
  selectedTranslation: string;
  fontSize: number;
  arabicFontSize: number;
  lineHeight: number;
  isLoading: boolean; // Loading entire surah
  isDisplayLoading: boolean; // Loading next batch of verses
  displayError: string | null;
  isSurahListOpen: boolean;
  isSettingsOpen: boolean;
  isNotesSidebarOpen: boolean;
  isConceptExplorerOpen: boolean; // State for concept explorer visibility
  isChatPanelOpen: boolean; // State for chat panel visibility
  noteTakingVerse: { surah: number; verse: number } | null; // Verse for which notes are being taken
  currentPlayingVerse: { surah: number; verse: number } | null; // Tracks which verse is playing audio
  activeVerseForChat: VerseData | null; // Verse context for chat panel
}

// Helper to calculate absolute verse number
const calculateAbsoluteVerseNumber = (surahNumber: number, verseNumberInSurah: number, quranMeta: QuranMeta | null): number | null => {
    if (!quranMeta || !quranMeta.surahs || quranMeta.surahs.length === 0) return null;
    let absoluteVerse = 0;
    for (let i = 0; i < surahNumber - 1; i++) {
        if (!quranMeta.surahs[i]) return null; // Safety check
        absoluteVerse += quranMeta.surahs[i].numberOfAyahs;
    }
    return absoluteVerse + verseNumberInSurah;
};


export function ReaderView() {
  const [state, setState] = useState<ReaderViewState>({
    quranMeta: null,
    surahData: new Map(),
    displayedVerses: [],
    currentSurahNumber: DEFAULT_SURAH_NUMBER,
    currentVerseNumber: 1,
    reciters: [],
    selectedReciter: 'ar.alafasy',
    translations: [],
    selectedTranslation: 'en.clearquran',
    fontSize: 16,
    arabicFontSize: 24,
    lineHeight: 1.8,
    isLoading: true,
    isDisplayLoading: false,
    displayError: null,
    isSurahListOpen: false,
    isSettingsOpen: false,
    isNotesSidebarOpen: false,
    isConceptExplorerOpen: false,
    isChatPanelOpen: false,
    noteTakingVerse: null,
    currentPlayingVerse: null,
    activeVerseForChat: null,
  });

  const { toast } = useToast();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const surahLoadingRef = useRef(false);
  const verseLoadingRef = useRef(false);

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
      threshold: 0.1,
  });

  const fetchInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, displayError: null }));
    try {
      const [meta, recitersData, translationsData] = await Promise.all([
        fetchQuranMeta(),
        fetchReciters(),
        fetchTranslations(),
      ]);

      const englishTranslations = translationsData.filter(t => t.language === 'en');

      setState(prev => ({
        ...prev,
        quranMeta: meta,
        reciters: recitersData,
        translations: englishTranslations,
      }));

      await loadSurah(DEFAULT_SURAH_NUMBER, true);

    } catch (error) {
      console.error("Error fetching initial data:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setState(prev => ({
        ...prev,
        displayError: `Failed to load essential Quran data. ${errorMessage}`,
        isLoading: false,
        isDisplayLoading: false,
      }));
      toast({
        title: "Error Loading Data",
        description: `Could not fetch necessary Quran data. ${errorMessage}`,
        variant: "destructive",
      });
    }
  }, [toast]); // Removed loadSurah from dependency array as it depends on state updated within fetchInitialData

  const loadSurah = useCallback(async (surahNumber: number, overwrite = false) => {
      if (surahLoadingRef.current && !overwrite) {
          return;
      }
      surahLoadingRef.current = true;
      setState(prev => ({
          ...prev,
          isLoading: true,
          displayError: null,
          ...(overwrite ? { displayedVerses: [], currentSurahNumber: surahNumber, currentVerseNumber: 1, currentPlayingVerse: null } : {})
      }));

      try {
          const data = await fetchSurahData(surahNumber, state.selectedTranslation);
          setState(prev => ({
              ...prev,
              surahData: prev.surahData.set(surahNumber, data.meta),
              displayedVerses: overwrite ? data.verses.slice(0, VERSES_TO_LOAD_AT_ONCE) : [...prev.displayedVerses, ...data.verses],
              currentSurahNumber: surahNumber,
          }));

          if (overwrite && scrollViewportRef.current) {
              scrollViewportRef.current.scrollTo({ top: 0, behavior: 'auto' });
          }
      } catch (error) {
          console.error(`Error loading Surah ${surahNumber}:`, error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          setState(prev => ({
              ...prev,
              displayError: `Failed to load Surah ${surahNumber}. ${errorMessage}`,
          }));
           toast({
               title: `Error Loading Surah ${surahNumber}`,
               description: errorMessage,
               variant: "destructive",
           });
      } finally {
          setState(prev => ({ ...prev, isLoading: false }));
           surahLoadingRef.current = false;
      }
  }, [state.selectedTranslation, toast]);

  const loadMoreVerses = useCallback(async () => {
      if (verseLoadingRef.current || state.isLoading || state.isDisplayLoading) return;

       const currentSurahMeta = state.surahData.get(state.currentSurahNumber);
       if (!currentSurahMeta) return;

       const currentVerseCount = state.displayedVerses.length;
       if (currentVerseCount >= currentSurahMeta.numberOfAyahs) return;

       verseLoadingRef.current = true;
       setState(prev => ({ ...prev, isDisplayLoading: true }));

       try {
           const fullSurahData = await fetchSurahData(state.currentSurahNumber, state.selectedTranslation);
           const nextBatch = fullSurahData.verses.slice(currentVerseCount, currentVerseCount + VERSES_TO_LOAD_AT_ONCE);

           if (nextBatch.length > 0) {
                setState(prev => ({
                   ...prev,
                   displayedVerses: [...prev.displayedVerses, ...nextBatch],
               }));
           }
       } catch (error) {
           console.error("Error loading more verses:", error);
           const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
           setState(prev => ({ ...prev, displayError: `Failed to load more verses. ${errorMessage}` }));
       } finally {
           setState(prev => ({ ...prev, isDisplayLoading: false }));
           verseLoadingRef.current = false;
       }
  }, [state.isLoading, state.isDisplayLoading, state.currentSurahNumber, state.displayedVerses, state.surahData, state.selectedTranslation]);

   useEffect(() => {
       fetchInitialData();
   }, [fetchInitialData]);

   useEffect(() => {
        if (loadMoreInView && !state.isLoading && !state.isDisplayLoading) {
           loadMoreVerses();
       }
   }, [loadMoreInView, state.isLoading, state.isDisplayLoading, loadMoreVerses]);


  const handleSurahChange = (surahNumber: number) => {
      if (surahNumber === state.currentSurahNumber && !state.isLoading) { // Prevent reload if already loading or same surah
           setState(prev => ({ ...prev, isSurahListOpen: false }));
          return;
      }
      loadSurah(surahNumber, true);
      setState(prev => ({ ...prev, isSurahListOpen: false }));
  };

   const handleVerseSelectAndScroll = useCallback((surah: number, verse: number, options: { highlightOnly?: boolean, center?: boolean } = {}) => {
       setState(prev => ({
           ...prev,
           currentVerseNumber: verse,
           ...(options.highlightOnly ? {} : { currentPlayingVerse: null }) // Reset audio if not highlight only
       }));

       if (options.highlightOnly) return; // Skip scrolling if only highlighting

       const targetVerseElement = document.querySelector(`.verse-container[data-surah="${surah}"][data-verse="${verse}"]`);
       if (targetVerseElement && scrollViewportRef.current) {
            const headerHeight = (document.querySelector('header.app-main-header')?.clientHeight || 0) + (document.querySelector('.surah-display-header')?.clientHeight || 0);
            const verseRect = targetVerseElement.getBoundingClientRect();
            const viewportRect = scrollViewportRef.current.getBoundingClientRect();

            let scrollTop;
            if (options.center) {
                scrollTop = scrollViewportRef.current.scrollTop + verseRect.top - viewportRect.top - (viewportRect.height / 2) + (verseRect.height / 2) - headerHeight;
            } else {
                // Scroll just enough to bring it into view, considering the fixed header
                const offset = verseRect.top - viewportRect.top - headerHeight;
                if (offset < 0 || verseRect.bottom > viewportRect.bottom) { // If not fully visible
                     scrollTop = scrollViewportRef.current.scrollTop + offset;
                } else {
                    return; // Already visible, no scroll needed
                }
            }

           scrollViewportRef.current.scrollTo({
               top: scrollTop,
               behavior: 'smooth'
           });
       } else {
            if (surah !== state.currentSurahNumber) {
                handleSurahChange(surah);
                // Defer scrolling until surah loaded, via useEffect perhaps or a callback mechanism
                // For now, it will scroll to top of new surah, then user can click verse.
            }
       }
   }, [state.currentSurahNumber, handleSurahChange]);


  const handleReciterChange = (identifier: string) => {
    setState(prev => ({ ...prev, selectedReciter: identifier, currentPlayingVerse: null }));
     const audioEl = document.getElementById('quran-audio-player') as HTMLAudioElement | null;
     if (audioEl) {
         audioEl.pause();
         audioEl.src = ''; // Clear src to stop current audio
         audioEl.currentTime = 0;
     }
  };

  const handleTranslationChange = async (identifier: string) => {
    if (identifier === state.selectedTranslation) return;
    setState(prev => ({ ...prev, selectedTranslation: identifier, isLoading: true }));
     try {
        await loadSurah(state.currentSurahNumber, true);
     } catch (error) {
         console.error("Failed to reload surah with new translation", error);
         const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          toast({ title: "Translation Error", description: `Could not load the selected translation. ${errorMessage}`, variant: "destructive" });
     } finally {
          setState(prev => ({ ...prev, isLoading: false }));
     }
  };

   const handleFontSizeChange = (newSize: number) => {
       setState(prev => ({ ...prev, fontSize: Math.max(10, Math.min(32, newSize)) }));
   };
   const handleArabicFontSizeChange = (newSize: number) => {
       setState(prev => ({ ...prev, arabicFontSize: Math.max(16, Math.min(48, newSize)) }));
   };
   const handleLineHeightChange = (newSize: number) => {
       setState(prev => ({ ...prev, lineHeight: Math.max(1.2, Math.min(2.5, newSize)) }));
   };

    const toggleNotesSidebar = (surah?: number, verse?: number) => {
        const verseRef = surah && verse ? { surah, verse } : state.noteTakingVerse || { surah: state.currentSurahNumber, verse: state.currentVerseNumber };
        setState(prev => ({
            ...prev,
            isNotesSidebarOpen: !prev.isNotesSidebarOpen,
            noteTakingVerse: !prev.isNotesSidebarOpen && verseRef ? verseRef : null
        }));
    };

    const toggleConceptExplorer = () => {
        setState(prev => ({ ...prev, isConceptExplorerOpen: !prev.isConceptExplorerOpen }));
    };

    const toggleChatPanel = (verseData?: VerseData) => {
        const contextVerse = verseData || state.displayedVerses.find(v => v.surah === state.currentSurahNumber && v.numberInSurah === state.currentVerseNumber) || null;
        setState(prev => ({
            ...prev,
            isChatPanelOpen: !prev.isChatPanelOpen,
            activeVerseForChat: !prev.isChatPanelOpen ? contextVerse : null,
        }));
    };

     const handleContextMenuAction = (action: string, verseData: VerseData) => {
         switch (action) {
             case 'add_note':
                 toggleNotesSidebar(verseData.surah, verseData.numberInSurah);
                 break;
             case 'tag_verse':
                 toggleNotesSidebar(verseData.surah, verseData.numberInSurah);
                 break;
             case 'share':
                  const shareText = `"${verseData.translation}" - Quran ${verseData.surah}:${verseData.numberInSurah}`;
                  if (navigator.share) {
                      navigator.share({
                          title: `Quran ${verseData.surah}:${verseData.numberInSurah}`,
                          text: shareText,
                          url: window.location.href,
                      }).catch(error => console.error('Error sharing:', error));
                  } else {
                      navigator.clipboard.writeText(shareText)
                          .then(() => toast({ title: "Verse Copied", description: "Verse text copied to clipboard." }))
                          .catch(err => toast({ title: "Copy Failed", description: "Could not copy verse text.", variant: "destructive" }));
                  }
                 break;
              case 'chat_about':
                 toggleChatPanel(verseData);
                 break;
             default:
                 console.warn(`Unknown context menu action: ${action}`);
         }
     };

     const handlePlayStateChange = useCallback((isPlaying: boolean, surah: number, verse: number) => {
         setState(prev => ({
             ...prev,
             currentPlayingVerse: isPlaying ? { surah, verse } : null,
             currentVerseNumber: verse,
         }));
         if (isPlaying) {
             handleVerseSelectAndScroll(surah, verse, { highlightOnly: false, center: true });
         }
     }, [handleVerseSelectAndScroll]);


   const absoluteVerseNum = state.quranMeta ? calculateAbsoluteVerseNumber(state.currentSurahNumber, state.currentVerseNumber, state.quranMeta) : 0;
   const totalAbsoluteVerses = state.quranMeta?.totalVerses || 6236;
   const currentSurahMeta = state.quranMeta?.surahs.find(s => s.number === state.currentSurahNumber);


  return (
      <TooltipProvider>
         <div className="flex h-screen flex-col bg-background text-foreground">
               <header className="app-main-header sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                 <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
                   <div className="flex items-center gap-1 md:gap-4">
                       <Sheet open={state.isSurahListOpen} onOpenChange={(isOpen) => setState(prev => ({ ...prev, isSurahListOpen: isOpen }))}>
                          <SheetTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0" aria-label="Toggle Surah List">
                                   <Menu className="h-5 w-5" />
                              </Button>
                          </SheetTrigger>
                          <SheetContent side="left" className="w-72 p-0 sm:w-80">
                               <SheetHeader className="p-4 border-b">
                                   <SheetTitle>Surahs</SheetTitle>
                               </SheetHeader>
                               {state.quranMeta ? (
                                   <SurahList
                                       surahs={state.quranMeta.surahs}
                                       currentSurah={state.currentSurahNumber}
                                       onSurahSelect={handleSurahChange}
                                   />
                               ) : (
                                   <div className="p-4 text-center text-muted-foreground">Loading Surahs...</div>
                               )}
                           </SheetContent>
                      </Sheet>
                     <span className="text-lg font-bold hidden sm:inline-block">Qur'an Meezan</span>
                   </div>

                   <div className="hidden md:flex flex-1 items-center justify-center gap-2">
                        <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSurahChange(Math.max(1, state.currentSurahNumber - 1))}
                                  disabled={state.currentSurahNumber <= 1 || state.isLoading}
                                  aria-label="Previous Surah"
                                >
                                  <ChevronDown className="h-4 w-4 rotate-90" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>Previous Surah</TooltipContent>
                        </Tooltip>

                        <Sheet>
                            <SheetTrigger asChild>
                               <Button variant="outline" size="sm" className="min-w-[180px] sm:min-w-[220px] justify-between text-sm sm:text-base">
                                 <span className="truncate">
                                     {state.currentSurahNumber}. {currentSurahMeta?.englishName || `Surah ${state.currentSurahNumber}`}
                                  </span>
                                 <ChevronDown className="h-4 w-4 opacity-50 ml-1 shrink-0" />
                               </Button>
                            </SheetTrigger>
                           <SheetContent side="bottom" className="h-[75vh] p-0 flex flex-col">
                               <SheetHeader className="p-4 border-b text-center">
                                   <SheetTitle>Select Surah</SheetTitle>
                               </SheetHeader>
                               {state.quranMeta ? (
                                   <SurahList
                                       surahs={state.quranMeta.surahs}
                                       currentSurah={state.currentSurahNumber}
                                       onSurahSelect={handleSurahChange}
                                   />
                               ) : (
                                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Surahs...
                                   </div>
                               )}
                               <SheetClose asChild>
                                    <Button variant="outline" className="m-4">Close</Button>
                               </SheetClose>
                           </SheetContent>
                       </Sheet>

                        <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSurahChange(Math.min(114, state.currentSurahNumber + 1))}
                                  disabled={state.currentSurahNumber >= 114 || state.isLoading}
                                  aria-label="Next Surah"
                                >
                                   <ChevronDown className="h-4 w-4 -rotate-90" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>Next Surah</TooltipContent>
                        </Tooltip>
                   </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => toggleNotesSidebar()} aria-label="Notes">
                                      <Notebook className="h-5 w-5" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent>Notes</TooltipContent>
                          </Tooltip>
                           <Tooltip>
                               <TooltipTrigger asChild>
                                   <Button variant="ghost" size="icon" onClick={toggleConceptExplorer} aria-label="Explore Concepts">
                                       <Tags className="h-5 w-5" />
                                   </Button>
                               </TooltipTrigger>
                               <TooltipContent>Explore Concepts</TooltipContent>
                           </Tooltip>
                           <Tooltip>
                               <TooltipTrigger asChild>
                                   <Button variant="ghost" size="icon" onClick={() => toggleChatPanel()} aria-label="Chat with AI">
                                       <MessageSquare className="h-5 w-5" />
                                   </Button>
                               </TooltipTrigger>
                               <TooltipContent>Chat about Quran</TooltipContent>
                           </Tooltip>
                         <Tooltip>
                              <TooltipTrigger asChild>
                                 <Button variant="ghost" size="icon" onClick={() => setState(prev => ({ ...prev, isSettingsOpen: true }))} aria-label="Settings">
                                     <Settings className="h-5 w-5" />
                                 </Button>
                              </TooltipTrigger>
                             <TooltipContent>Settings</TooltipContent>
                         </Tooltip>
                     </div>
                 </div>
             </header>

              <main className="flex-1 overflow-hidden flex flex-col">
                 {currentSurahMeta && (
                     <div className="surah-display-header sticky top-16 z-30 w-full border-b bg-background/80 backdrop-blur p-4 shadow-sm">
                          <div className="container flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                              <div className="flex items-center gap-3">
                                  <div className={cn(
                                      "bg-primary text-primary-foreground w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0",
                                      "shadow-md border-2 border-primary-foreground/50"
                                      )}>
                                      {state.currentSurahNumber}
                                  </div>
                                  <div>
                                       <h2 className="text-xl sm:text-2xl font-semibold font-amiri">{currentSurahMeta.name}</h2>
                                       <h3 className="text-base sm:text-lg font-medium">{currentSurahMeta.englishName}</h3>
                                  </div>
                              </div>
                              <div className="text-right text-xs text-muted-foreground flex flex-col items-end mt-1 sm:mt-0">
                                   <p>{currentSurahMeta.revelationType}</p>
                                   <p>{currentSurahMeta.numberOfAyahs} Ayahs</p>
                              </div>
                          </div>
                          {state.currentSurahNumber !== 1 && state.currentSurahNumber !== 9 && (
                               <p className="text-center font-amiri text-xl sm:text-2xl mt-3 text-foreground">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
                          )}
                     </div>
                 )}

                  <ScrollArea className="h-0 flex-grow" viewportRef={scrollViewportRef}>
                     {state.isLoading && state.displayedVerses.length === 0 && (
                          <div className="flex justify-center items-center h-full p-8">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                     )}

                     {state.displayError && (
                          <div className="p-4 text-center text-destructive flex flex-col items-center gap-2">
                             <AlertCircle className="h-6 w-6" />
                             <span>{state.displayError}</span>
                             <Button onClick={fetchInitialData} size="sm">Retry</Button>
                          </div>
                     )}

                     {!state.isLoading && state.displayedVerses.length === 0 && !state.displayError && (
                         <div className="p-4 text-center text-muted-foreground">No verses to display.</div>
                     )}

                     <div className="container py-4 px-2 sm:px-4 md:px-6">
                          {state.displayedVerses.map((verse) => (
                             <VerseDisplay
                                  key={`${verse.surah}-${verse.numberInSurah}`}
                                  verseData={verse}
                                  fontSize={state.fontSize}
                                  arabicFontSize={state.arabicFontSize}
                                  lineHeight={state.lineHeight}
                                  onVerseSelect={() => handleVerseSelectAndScroll(verse.surah, verse.numberInSurah)}
                                  onContextMenuAction={handleContextMenuAction}
                                  isSelected={state.currentVerseNumber === verse.numberInSurah && state.currentSurahNumber === verse.surah}
                                  isPlaying={state.currentPlayingVerse?.surah === verse.surah && state.currentPlayingVerse?.verse === verse.numberInSurah}
                                  noteExists={checkNoteExists(calculateAbsoluteVerseNumber(verse.surah, verse.numberInSurah, state.quranMeta) ?? 0)}
                                  conceptIds={getConceptsForVerse(calculateAbsoluteVerseNumber(verse.surah, verse.numberInSurah, state.quranMeta) ?? 0)}
                                  allConcepts={getAllConcepts()}
                              />
                         ))}

                          <div ref={loadMoreRef} className={cn(
                             "flex justify-center items-center py-6 text-center min-h-[60px]",
                             (!state.isDisplayLoading && currentSurahMeta && state.displayedVerses.length >= currentSurahMeta.numberOfAyahs) && "pb-10", // Add more padding at end of surah
                             (state.isDisplayLoading || state.isLoading || state.displayError || (state.displayedVerses.length === 0 && !currentSurahMeta)) && "hidden"
                             )}>
                             {state.isDisplayLoading ? (
                                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
                             ) : currentSurahMeta && state.displayedVerses.length >= currentSurahMeta.numberOfAyahs ? (
                                 <span className="text-muted-foreground text-sm">End of Surah {state.currentSurahNumber}</span>
                             ) : (
                                  null // Hide "Loading more..." text, rely on spinner or end of surah
                             )}
                          </div>
                     </div>
                  </ScrollArea>
              </main>

              <footer className="sticky bottom-0 z-40 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <Controls
                      currentSurah={state.currentSurahNumber}
                      currentVerse={state.currentVerseNumber}
                      totalVersesInSurah={currentSurahMeta?.numberOfAyahs || 0}
                      totalAbsoluteVerses={totalAbsoluteVerses}
                      absoluteVerseNumber={absoluteVerseNum || 0}
                      selectedReciter={state.selectedReciter}
                      reciters={state.reciters}
                      quranMeta={state.quranMeta}
                      onReciterChange={handleReciterChange}
                      onVerseChange={(verseNum) => handleVerseSelectAndScroll(state.currentSurahNumber, verseNum)}
                      onSurahChange={handleSurahChange}
                      onPlayStateChange={handlePlayStateChange}
                      isAudioLoading={state.isLoading} // Pass loading state
                  />
              </footer>

               <SettingsPanel
                 isOpen={state.isSettingsOpen}
                 onOpenChange={(isOpen) => setState(prev => ({ ...prev, isSettingsOpen: isOpen }))}
                 fontSize={state.fontSize}
                 arabicFontSize={state.arabicFontSize}
                 lineHeight={state.lineHeight}
                 selectedTranslation={state.selectedTranslation}
                 translations={state.translations}
                 onFontSizeChange={handleFontSizeChange}
                 onArabicFontSizeChange={handleArabicFontSizeChange}
                 onLineHeightChange={handleLineHeightChange}
                 onTranslationChange={handleTranslationChange}
               />

               <NotesSidebar
                 isOpen={state.isNotesSidebarOpen}
                 onOpenChange={toggleNotesSidebar}
                 verseRef={state.noteTakingVerse}
                 onNoteSave={(surah, verse, text, tags) => {
                     saveNote(calculateAbsoluteVerseNumber(surah, verse, state.quranMeta) ?? 0, surah, verse, text, tags);
                     if (tags.length > 0) {
                          tagVerseWithConcepts(calculateAbsoluteVerseNumber(surah, verse, state.quranMeta) ?? 0, surah, verse, tags);
                     }
                      setState(prev => ({...prev})); // Force re-render to update indicators
                 }}
                 onNoteDelete={(surah, verse) => {
                     // Assuming deleteNoteForVerse handles the deletion logic
                     // And untagVerseConcepts might be needed if concepts are tied to notes
                     setState(prev => ({...prev})); // Force re-render
                 }}
                 onConceptUntag={(surah, verse, conceptId) => {
                     untagVerseConcepts(calculateAbsoluteVerseNumber(surah, verse, state.quranMeta) ?? 0, surah, verse, [conceptId]); // Pass array of conceptId
                     setState(prev => ({...prev})); // Force re-render
                 }}
                 getNoteForVerse={(s, v) => getNoteForVerse(calculateAbsoluteVerseNumber(s, v, state.quranMeta) ?? 0)}
                 getConceptsForVerse={(s, v) => getConceptsForVerse(calculateAbsoluteVerseNumber(s, v, state.quranMeta) ?? 0)}
                 allConcepts={getAllConcepts()}
               />

                <ConceptExplorer
                   isOpen={state.isConceptExplorerOpen}
                   onOpenChange={toggleConceptExplorer}
                   onVerseNavigate={(surah, verse) => {
                      handleSurahChange(surah);
                      setTimeout(() => {
                          handleVerseSelectAndScroll(surah, verse, {center: true});
                      }, 500); // Delay for surah load
                      toggleConceptExplorer(); // Close explorer
                   }}
                />

                 <ChatPanel
                     isOpen={state.isChatPanelOpen}
                     onOpenChange={toggleChatPanel}
                     verseContext={state.activeVerseForChat}
                 />
          </div>
       </TooltipProvider>
  );
}
