'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchReciters,
  fetchTranslations,
  fetchQuranMeta,
  fetchSurahData,
  type VerseData,
  type Translation,
  type Reciter,
  type SurahMeta,
  type QuranMeta,
} from '@/services/alquran-cloud'; // Verified path
import { VerseDisplay } from '@/components/quran/VerseDisplay';
import { Controls } from '@/components/quran/Controls';
import { SurahList } from '@/components/quran/SurahList';
import { SettingsPanel } from '@/components/quran/SettingsPanel'; // Corrected import path
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';
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
import { saveNote, getNoteForVerse, checkNoteExists, deleteNoteForVerse as serviceDeleteNote } from '@/services/notes';
import { getAllConcepts, getConceptsForVerse, tagVerseWithConcepts, untagVerseConcepts as serviceUntagVerseConcepts } from '@/services/concepts';
import { NotesSidebar } from '@/components/quran/NotesSidebar';
import { ConceptExplorer } from '@/components/quran/ConceptExplorer';
import { ChatPanel } from '@/components/chat/ChatPanel';


// Default values
const DEFAULT_SURAH_NUMBER = 1;
const VERSES_TO_LOAD_AT_ONCE = 20;

interface ReaderViewState {
  quranMeta: QuranMeta | null;
  surahData: Map<number, SurahMeta>;
  displayedVerses: VerseData[];
  currentSurahNumber: number;
  currentVerseNumber: number;
  reciters: Reciter[];
  selectedReciter: string;
  translations: Translation[];
  selectedTranslation: string;
  fontSize: number;
  arabicFontSize: number;
  lineHeight: number;
  isLoading: boolean;
  isDisplayLoading: boolean;
  displayError: string | null;
  isSurahListOpen: boolean;
  isSettingsOpen: boolean;
  isNotesSidebarOpen: boolean;
  isConceptExplorerOpen: boolean;
  isChatPanelOpen: boolean;
  noteTakingVerse: { surah: number; verse: number } | null;
  currentPlayingVerse: { surah: number; verse: number } | null;
  activeVerseForChat: VerseData | null;
}

const calculateAbsoluteVerseNumber = (surahNumber: number, verseNumberInSurah: number, quranMeta: QuranMeta | null): number | null => {
    if (!quranMeta || !quranMeta.surahs || quranMeta.surahs.length === 0) return null;
    let absoluteVerse = 0;
    for (let i = 0; i < surahNumber - 1; i++) {
        const surahInfo = quranMeta.surahs[i];
        if (!surahInfo) return null;
        absoluteVerse += surahInfo.numberOfAyahs;
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
    arabicFontSize: 28, // Increased default Arabic font size
    lineHeight: 1.8, // Default line height for Arabic
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
  const mainScrollContainerRef = useRef<HTMLDivElement>(null);


  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
      threshold: 0.1,
      // root: scrollViewportRef.current, // Use viewport as root
      // rootMargin: '0px 0px 200px 0px', // Trigger 200px before end
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
  }, [toast]);

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
          const surahMetaFromData = data.meta || state.quranMeta?.surahs.find(s => s.number === surahNumber);

          if (!surahMetaFromData) {
            throw new Error(`Metadata not found for Surah ${surahNumber}`);
          }


          setState(prev => ({
              ...prev,
              surahData: prev.surahData.set(surahNumber, surahMetaFromData),
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
  }, [state.selectedTranslation, toast, state.quranMeta]);

  const loadMoreVerses = useCallback(async () => {
      if (verseLoadingRef.current || state.isLoading || state.isDisplayLoading) return; // Prevent concurrent loads

       const currentSurahMeta = state.surahData.get(state.currentSurahNumber);
       if (!currentSurahMeta) return; // No metadata

       const currentVerseCount = state.displayedVerses.length;
       if (currentVerseCount >= currentSurahMeta.numberOfAyahs) return; // All verses loaded

       verseLoadingRef.current = true;
       setState(prev => ({ ...prev, isDisplayLoading: true }));
       console.log(`Loading more verses for Surah ${state.currentSurahNumber}, starting from ${currentVerseCount + 1}`);

       try {
           // Fetch the *entire* surah data if not fully cached yet (API doesn't support ranges easily)
           // This is inefficient but simpler given the API structure
           const fullSurahData = await fetchSurahData(state.currentSurahNumber, state.selectedTranslation);
           const nextBatch = fullSurahData.verses.slice(currentVerseCount, currentVerseCount + VERSES_TO_LOAD_AT_ONCE);

           if (nextBatch.length > 0) {
                setState(prev => ({
                   ...prev,
                    // Append only the *next* batch of verses
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
  }, [state.isLoading, state.isDisplayLoading, state.currentSurahNumber, state.displayedVerses, state.surahData, state.selectedTranslation]); // Dependencies

   // Effect for initial data load
   useEffect(() => {
       fetchInitialData();
   }, [fetchInitialData]);

   // Effect for infinite scrolling - trigger loadMoreVerses when loadMoreRef is in view
   useEffect(() => {
        if (loadMoreInView && !state.isLoading && !state.isDisplayLoading) {
            console.log("Load More Triggered by InView");
           loadMoreVerses();
       }
   }, [loadMoreInView, state.isLoading, state.isDisplayLoading, loadMoreVerses]);


  // --- Event Handlers ---
  const handleSurahChange = (surahNumber: number) => {
      if (surahNumber === state.currentSurahNumber && !state.isLoading) {
           setState(prev => ({ ...prev, isSurahListOpen: false })); // Close if same surah selected
          return;
      }
      console.log("Surah changed to:", surahNumber);
      loadSurah(surahNumber, true); // Load new surah and overwrite existing verses
      setState(prev => ({ ...prev, isSurahListOpen: false })); // Close sidebar
  };

   // Handle verse selection (e.g., from VerseDisplay click or Controls)
   // Handles both selecting a verse and scrolling it into view
   const handleVerseSelectAndScroll = useCallback((surah: number, verse: number, options: { highlightOnly?: boolean, center?: boolean } = {}) => {
       console.log(`Selecting verse: ${surah}:${verse}, Options:`, options);
       // Update the current verse number in the state
       setState(prev => ({
           ...prev,
           currentVerseNumber: verse,
           // Reset playing verse unless only highlighting
           ...(options.highlightOnly ? {} : { currentPlayingVerse: null })
       }));

        // Don't scroll if we are only highlighting (e.g., audio playing)
       // and the verse is likely already visible due to previous scroll.
       if (options.highlightOnly && state.currentPlayingVerse) return;


       // Scroll the selected verse into view
       // Need a slight delay to ensure the DOM has updated if the surah just changed
       setTimeout(() => {
           const targetVerseElement = document.querySelector(`.verse-container[data-surah="${surah}"][data-verse="${verse}"]`);
           if (targetVerseElement && scrollViewportRef.current) {
                // Get heights/positions *after* potential DOM updates
                const headerHeight = (document.querySelector('header.app-main-header')?.clientHeight || 0) + (document.querySelector('.surah-display-header')?.clientHeight || 0);
                const verseRect = targetVerseElement.getBoundingClientRect();
                const viewportRect = scrollViewportRef.current.getBoundingClientRect();

                let scrollTop;
                // Center if explicitly requested or if it's the currently playing verse being scrolled to
                if (options.center || (state.currentPlayingVerse && state.currentPlayingVerse.surah === surah && state.currentPlayingVerse.verse === verse)) {
                    scrollTop = scrollViewportRef.current.scrollTop + verseRect.top - viewportRect.top - (viewportRect.height / 2) + (verseRect.height / 2) - headerHeight;
                } else {
                    // Otherwise, bring into view if needed (minimal scroll)
                    const offsetTop = verseRect.top - viewportRect.top - headerHeight; // Position relative to top of viewport (minus header)
                    const offsetBottom = verseRect.bottom - viewportRect.bottom; // Position relative to bottom

                    if (offsetTop < 0) { // If top is above viewport
                        scrollTop = scrollViewportRef.current.scrollTop + offsetTop - 10; // Scroll up slightly more than needed
                    } else if (offsetBottom > 0) { // If bottom is below viewport
                        scrollTop = scrollViewportRef.current.scrollTop + offsetBottom + 10; // Scroll down slightly more than needed
                    } else {
                        // Already fully visible, no scroll needed
                        return;
                    }
                }

               scrollViewportRef.current.scrollTo({
                   top: scrollTop,
                   behavior: 'smooth'
               });
           } else {
                console.warn(`Verse element ${surah}:${verse} not found for scrolling.`);
                // If verse isn't rendered because the surah changed, handleSurahChange already initiated load
                if (surah !== state.currentSurahNumber) {
                    // loadSurah was called by handleSurahChange, we just need to wait.
                    // Scrolling will happen automatically if called again after load,
                    // or we can implement a post-load scroll mechanism.
                    console.log("Surah changed, waiting for load before scrolling.");
                }
           }
       }, 100); // 100ms delay, adjust if needed

   }, [state.currentSurahNumber, state.currentPlayingVerse]); // Added dependency


  const handleReciterChange = (identifier: string) => {
    setState(prev => ({ ...prev, selectedReciter: identifier, currentPlayingVerse: null })); // Reset playing verse
     // Optionally, stop/reset audio player when reciter changes
     const audioEl = document.getElementById('quran-audio-player') as HTMLAudioElement | null;
     if (audioEl) {
         audioEl.pause();
         audioEl.src = ''; // Clear src to force reload with new reciter
         audioEl.currentTime = 0;
     }
  };

  const handleTranslationChange = async (identifier: string) => {
    if (identifier === state.selectedTranslation) return;
    console.log("Changing translation to:", identifier);
    setState(prev => ({ ...prev, selectedTranslation: identifier, isLoading: true }));
     try {
        // Refetch the current surah with the new translation
        await loadSurah(state.currentSurahNumber, true); // Overwrite with new translation
     } catch (error) {
         console.error("Failed to reload surah with new translation", error);
         const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          toast({ title: "Translation Error", description: `Could not load the selected translation. ${errorMessage}`, variant: "destructive" });
         // Optionally revert to previous translation
         // setState(prev => ({ ...prev, selectedTranslation: state.selectedTranslation }));
     } finally {
          setState(prev => ({ ...prev, isLoading: false }));
     }
  };

   const handleFontSizeChange = (newSize: number) => {
       setState(prev => ({ ...prev, fontSize: Math.max(10, Math.min(48, newSize)) }));
   };
   const handleArabicFontSizeChange = (newSize: number) => {
       setState(prev => ({ ...prev, arabicFontSize: Math.max(16, Math.min(60, newSize)) }));
   };
   const handleLineHeightChange = (newSize: number) => {
       setState(prev => ({ ...prev, lineHeight: Math.max(1.2, Math.min(3.0, newSize)) }));
   };

   // Toggle Notes Sidebar
    const toggleNotesSidebar = (surah?: number, verse?: number) => {
        // Determine the verse reference to open notes for
        const verseRef = surah && verse
            ? { surah, verse }
            : state.noteTakingVerse // Use existing if reopening without context
            || { surah: state.currentSurahNumber, verse: state.currentVerseNumber }; // Default to current selected

        setState(prev => ({
            ...prev,
            isNotesSidebarOpen: !prev.isNotesSidebarOpen,
            // Set the target verse only when opening the sidebar
            noteTakingVerse: !prev.isNotesSidebarOpen ? verseRef : null
        }));
    };

   // Toggle Concept Explorer
    const toggleConceptExplorer = () => {
        setState(prev => ({ ...prev, isConceptExplorerOpen: !prev.isConceptExplorerOpen }));
    };

    // Toggle Chat Panel
    const toggleChatPanel = (verseData?: VerseData) => {
        // Determine context: use provided verseData, or find the currently selected verse
        const contextVerse = verseData || state.displayedVerses.find(v => v.surah === state.currentSurahNumber && v.numberInSurah === state.currentVerseNumber) || null;
        console.log("Toggling chat panel. Context verse:", contextVerse); // Debug log
        setState(prev => ({
            ...prev,
            isChatPanelOpen: !prev.isChatPanelOpen,
            // Set context only when opening, clear when closing
            activeVerseForChat: !prev.isChatPanelOpen ? contextVerse : null,
        }));
    };

    // Handle verse context menu actions
     const handleContextMenuAction = (action: string, verseData: VerseData) => {
         console.log(`Context Action: ${action} for ${verseData.surah}:${verseData.numberInSurah}`);
         switch (action) {
             case 'add_note':
                 toggleNotesSidebar(verseData.surah, verseData.numberInSurah);
                 break;
             case 'tag_verse':
                 // Open concept tagging UI (currently part of notes)
                 console.log("Tag Verse action triggered - opening Notes panel");
                 toggleNotesSidebar(verseData.surah, verseData.numberInSurah); // Open notes which includes tagging
                 break;
             case 'share':
                 // Implement sharing functionality
                  const shareText = `"${verseData.translation}" - Quran ${verseData.surah}:${verseData.numberInSurah}`;
                  if (navigator.share) {
                      navigator.share({
                          title: `Quran ${verseData.surah}:${verseData.numberInSurah}`,
                          text: shareText,
                          url: window.location.href, // Or a specific URL for the verse
                      }).catch(error => console.error('Error sharing:', error));
                  } else {
                      // Fallback for browsers that don't support navigator.share
                      navigator.clipboard.writeText(shareText)
                          .then(() => toast({ title: "Verse Copied", description: "Verse text copied to clipboard." }))
                          .catch(err => toast({ title: "Copy Failed", description: "Could not copy verse text.", variant: "destructive" }));
                  }
                 break;
              case 'chat_about':
                 toggleChatPanel(verseData); // Pass specific verse data to chat panel
                 break;
             default:
                 console.warn(`Unknown context menu action: ${action}`);
         }
     };

     // Callback from Controls to update playing state and current verse
     const handlePlayStateChange = useCallback((isPlaying: boolean, surah: number, verse: number) => {
         setState(prev => ({
             ...prev,
             currentPlayingVerse: isPlaying ? { surah, verse } : null,
             currentVerseNumber: verse, // Ensure current verse number is synced
         }));
         // Scroll the playing verse into view if it's playing
         if (isPlaying) {
             // Use highlightOnly: false to ensure it scrolls, center: true for better view
             handleVerseSelectAndScroll(surah, verse, { highlightOnly: false, center: true });
         }
     }, [handleVerseSelectAndScroll]); // Dependency


    // --- Note and Concept Handling ---
    const handleNoteSave = (surah: number, verse: number, text: string, tags: string[]) => {
        const absVerseNum = calculateAbsoluteVerseNumber(surah, verse, state.quranMeta);
        if (absVerseNum === null) {
            toast({ title: "Error", description: "Could not save note. Invalid verse reference.", variant: "destructive"});
            return;
        }
        saveNote(absVerseNum, surah, verse, text, tags);
        if (tags.length > 0) {
            tagVerseWithConcepts(surah, verse, absVerseNum, tags);
        }
        // Force re-render may not be needed if VerseDisplay correctly uses state/props
        // Consider alternative update methods if needed, like forcing a state update:
        setState(prev => ({...prev}));
        toast({ title: "Note Saved", description: `Note for ${surah}:${verse} saved.`});
    };

    const handleNoteDelete = (surah: number, verse: number) => {
        const absVerseNum = calculateAbsoluteVerseNumber(surah, verse, state.quranMeta);
        if (absVerseNum === null) {
            toast({ title: "Error", description: "Could not delete note. Invalid verse reference.", variant: "destructive"});
            return;
        }
        serviceDeleteNote(absVerseNum);
        // Concepts are managed separately from notes, so untagging is explicit via handleConceptUntag
        // Force re-render may not be needed
        setState(prev => ({...prev}));
        toast({ title: "Note Deleted", description: `Note for ${surah}:${verse} deleted.`});
    };

    const handleConceptUntag = (surah: number, verse: number, conceptId: string) => {
        const absVerseNum = calculateAbsoluteVerseNumber(surah, verse, state.quranMeta);
         if (absVerseNum === null) {
            toast({ title: "Error", description: "Could not untag concept. Invalid verse reference.", variant: "destructive"});
            return;
        }
        serviceUntagVerseConcepts(surah, verse, [conceptId]); // Pass as array
        // Force re-render may not be needed
        setState(prev => ({...prev}));
        toast({ title: "Concept Untagged", description: `Concept removed from ${surah}:${verse}.`});
    };


   // --- Calculated Values ---
   const absoluteVerseNum = state.quranMeta ? calculateAbsoluteVerseNumber(state.currentSurahNumber, state.currentVerseNumber, state.quranMeta) : 0;
   const totalAbsoluteVerses = state.quranMeta?.totalVerses || 6236;
   // Get metadata for the current surah reliably
   const currentSurahMeta = state.quranMeta?.surahs.find(s => s.number === state.currentSurahNumber);


  return (
      <TooltipProvider>
         {/* Main container with flex column layout */}
         <div className="flex h-screen flex-col bg-background text-foreground" ref={mainScrollContainerRef}>
               {/* Fixed Header */}
               <header className="app-main-header sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                 {/* Header Content */}
                 <div className="container flex h-16 items-center space-x-1 sm:space-x-4 sm:justify-between">
                   {/* Left Side: Menu (Mobile) & Title */}
                   <div className="flex items-center gap-1 md:gap-4">
                       {/* Mobile Drawer Trigger for Surah List */}
                       <Sheet open={state.isSurahListOpen} onOpenChange={(isOpen) => setState(prev => ({ ...prev, isSurahListOpen: isOpen }))}>
                          <SheetTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="Toggle Surah List">
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
                      {/* App Title */}
                     <span className="text-lg font-bold hidden sm:inline-block">Qur'an Meezan</span>
                   </div>

                   {/* Center: Surah Navigation (Desktop) */}
                   <div className="hidden md:flex flex-1 items-center justify-center gap-2">
                        {/* Previous Surah Button */}
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

                        {/* Surah Selector Trigger (Desktop) */}
                        <Sheet>
                            <SheetTrigger asChild>
                               <Button variant="outline" size="sm" className="min-w-[180px] sm:min-w-[220px] justify-between text-sm sm:text-base">
                                 <span className="truncate">
                                     {state.currentSurahNumber}. {currentSurahMeta?.englishName || `Surah ${state.currentSurahNumber}`}
                                  </span>
                                 <ChevronDown className="h-4 w-4 opacity-50 ml-1 shrink-0" />
                               </Button>
                            </SheetTrigger>
                           {/* Surah List Sheet (Opens from Bottom on Desktop) */}
                           <SheetContent side="bottom" className="h-[75vh] p-0 flex flex-col">
                               <SheetHeader className="p-4 border-b text-center">
                                   <SheetTitle>Select Surah</SheetTitle>
                               </SheetHeader>
                               {state.quranMeta ? (
                                   <SurahList
                                       surahs={state.quranMeta.surahs}
                                       currentSurah={state.currentSurahNumber}
                                       onSurahSelect={handleSurahChange} // This correctly calls loadSurah
                                   />
                               ) : (
                                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Surahs...
                                   </div>
                               )}
                                <SheetClose asChild><Button variant="outline" className="m-4">Close</Button></SheetClose>
                           </SheetContent>
                       </Sheet>

                        {/* Next Surah Button */}
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

                   {/* Right Side: Action Icons */}
                    <div className="flex items-center gap-1 sm:gap-2">
                         {/* Notes Button */}
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  {/* Pass current selected verse as default context */}
                                  <Button variant="ghost" size="icon" onClick={() => toggleNotesSidebar()} aria-label="Notes">
                                      <Notebook className="h-5 w-5" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent>Notes</TooltipContent>
                          </Tooltip>
                         {/* Concept Explorer Button */}
                           <Tooltip>
                               <TooltipTrigger asChild>
                                   <Button variant="ghost" size="icon" onClick={toggleConceptExplorer} aria-label="Explore Concepts">
                                       <Tags className="h-5 w-5" />
                                   </Button>
                               </TooltipTrigger>
                               <TooltipContent>Explore Concepts</TooltipContent>
                           </Tooltip>
                         {/* Chat Button */}
                           <Tooltip>
                               <TooltipTrigger asChild>
                                  {/* Pass current selected verse as default context */}
                                   <Button variant="ghost" size="icon" onClick={() => toggleChatPanel()} aria-label="Chat with AI">
                                       <MessageSquare className="h-5 w-5" />
                                   </Button>
                               </TooltipTrigger>
                               <TooltipContent>Chat about Quran</TooltipContent>
                           </Tooltip>
                         {/* Settings Button */}
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

              {/* Main Content Area */}
              <main className="flex-1 overflow-hidden flex flex-col relative">
                 {/* Fixed Surah Header (Displayed below main header) */}
                 {currentSurahMeta && (
                     <div className="surah-display-header sticky top-16 z-30 w-full border-b bg-background/80 backdrop-blur p-4 shadow-sm">
                          {/* Surah Header Content */}
                          <div className="container flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                              {/* Left Side: Surah Number and Names */}
                              <div className="flex items-center gap-3">
                                  <div className={cn(
                                      "bg-primary text-primary-foreground w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0",
                                      "shadow-md border-2 border-primary-foreground/50" // Example styling
                                      )}>
                                      {state.currentSurahNumber}
                                  </div>
                                  <div>
                                       <h2 className="text-xl sm:text-2xl font-semibold font-amiri">{currentSurahMeta.name}</h2>
                                       <h3 className="text-base sm:text-lg font-medium">{currentSurahMeta.englishName}</h3>
                                  </div>
                              </div>
                              {/* Right Side: Metadata */}
                              <div className="text-right text-xs text-muted-foreground flex flex-col items-end mt-1 sm:mt-0">
                                   <p className="italic">{currentSurahMeta.revelationType}</p>
                                   <p>{currentSurahMeta.numberOfAyahs} Ayahs</p>
                              </div>
                          </div>
                          {/* Bismillah - Shown conditionally */}
                          {state.currentSurahNumber !== 1 && state.currentSurahNumber !== 9 && (
                               <p className="text-center font-amiri text-xl sm:text-2xl mt-3 text-foreground">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
                          )}
                     </div>
                 )}

                 {/* Scrollable Verses Area */}
                  <ScrollArea className="h-0 flex-grow" viewportRef={scrollViewportRef}>
                     {/* Loading State */}
                     {state.isLoading && state.displayedVerses.length === 0 && (
                          <div className="flex justify-center items-center h-full p-8">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                     )}
                     {/* Error State */}
                     {state.displayError && (
                          <div className="p-4 text-center text-destructive flex flex-col items-center gap-2">
                             <AlertCircle className="h-6 w-6" />
                             <span>{state.displayError}</span>
                             <Button onClick={fetchInitialData} size="sm">Retry</Button>
                          </div>
                     )}
                     {/* Empty State */}
                     {!state.isLoading && state.displayedVerses.length === 0 && !state.displayError && (
                         <div className="p-4 text-center text-muted-foreground">No verses to display.</div>
                     )}

                     {/* Verses Content */}
                     <div className="container py-4 px-2 sm:px-4 md:px-6">
                          {/* Render Displayed Verses */}
                          {state.displayedVerses.map((verse) => {
                            const absVerseNum = calculateAbsoluteVerseNumber(verse.surah, verse.numberInSurah, state.quranMeta);
                            // Check if note exists or concepts are tagged for this verse
                            const noteExistsCheck = absVerseNum !== null && checkNoteExists(absVerseNum);
                            const conceptIdsCheck = absVerseNum !== null ? getConceptsForVerse(absVerseNum) : [];

                            return (
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
                                    noteExists={noteExistsCheck} // Pass check result
                                    conceptIds={conceptIdsCheck} // Pass check result
                                    allConcepts={getAllConcepts()} // Pass all concepts for lookup
                                />
                            );
                          })}

                          {/* Infinite Scroll Trigger / End of Surah Marker */}
                          <div ref={loadMoreRef} className={cn(
                             "flex justify-center items-center py-6 text-center min-h-[60px]",
                             // Add padding at the end only when all verses are loaded
                             (currentSurahMeta && state.displayedVerses.length >= currentSurahMeta.numberOfAyahs) && "pb-10",
                             // Hide the trigger itself if loading, error, or empty (and not end of surah)
                             (state.isDisplayLoading || state.isLoading || state.displayError || (state.displayedVerses.length === 0 && !(currentSurahMeta && state.displayedVerses.length >= currentSurahMeta.numberOfAyahs))) && "hidden"
                             )}>
                             {state.isDisplayLoading ? (
                                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
                             ) : currentSurahMeta && state.displayedVerses.length >= currentSurahMeta.numberOfAyahs ? (
                                 <span className="text-muted-foreground text-sm">End of Surah {state.currentSurahNumber}</span>
                             ) : (
                                  // Optionally show a subtle loading indicator or nothing while waiting for trigger
                                  null
                             )}
                          </div>
                     </div>
                  </ScrollArea>
              </main>

              {/* Fixed Footer: Audio Controls */}
              <footer className="sticky bottom-0 z-40 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  {/* Controls Component */}
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
                      onVerseChange={(verseNum) => handleVerseSelectAndScroll(state.currentSurahNumber, verseNum)} // Use combined handler
                      onSurahChange={handleSurahChange}
                      onPlayStateChange={handlePlayStateChange} // Pass callback
                      isAudioLoading={state.isLoading && state.currentPlayingVerse !== null} // Indicate loading if relevant
                  />
              </footer>

               {/* --- Modals & Sidebars --- */}

               {/* Settings Panel (Sheet) */}
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

               {/* Notes Sidebar (Sheet) */}
               <NotesSidebar
                 isOpen={state.isNotesSidebarOpen}
                 onOpenChange={toggleNotesSidebar} // Use the toggle function
                 verseRef={state.noteTakingVerse} // Pass the specific verse ref for notes
                 onNoteSave={handleNoteSave}
                 onNoteDelete={handleNoteDelete}
                 onConceptUntag={handleConceptUntag}
                 getNoteForVerse={(s, v) => {
                     const absVerse = calculateAbsoluteVerseNumber(s, v, state.quranMeta);
                     return absVerse !== null ? getNoteForVerse(absVerse) : null;
                 }}
                 getConceptsForVerse={(s, v) => {
                     const absVerse = calculateAbsoluteVerseNumber(s, v, state.quranMeta);
                     return absVerse !== null ? getConceptsForVerse(absVerse) : [];
                 }}
                 allConcepts={getAllConcepts()} // Pass all concepts for tagging UI
               />

               {/* Concept Explorer (Modal/Sheet) */}
                <ConceptExplorer
                   isOpen={state.isConceptExplorerOpen}
                   onOpenChange={toggleConceptExplorer} // Use the toggle function
                   onVerseNavigate={(surah, verse) => {
                      handleSurahChange(surah); // Navigate to the surah
                      setTimeout(() => {
                          handleVerseSelectAndScroll(surah, verse, {center: true}); // Scroll to the specific verse after delay
                      }, 500); // Adjust delay if needed
                      toggleConceptExplorer(); // Close explorer after navigation
                   }}
                />

                 {/* Chat Panel (Sheet) */}
                 <ChatPanel
                     isOpen={state.isChatPanelOpen}
                     onOpenChange={toggleChatPanel} // Use the toggle function
                     verseContext={state.activeVerseForChat} // Pass the active verse for chat context
                 />

          </div>
       </TooltipProvider>
  );
}
