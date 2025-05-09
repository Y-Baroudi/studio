
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
import { Controls } from '@/components/quran/Controls'; // Import the new Controls component
import { SurahList } from '@/components/quran/SurahList';
import { SettingsPanel } from '@/components/quran/SettingsPanel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import {
  Settings,
  ChevronDown,
  ChevronsDown,
  Loader2,
  AlertCircle,
  Info,
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
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
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
  });

  const { toast } = useToast();
  const scrollViewportRef = useRef<HTMLDivElement>(null); // Ref for the ScrollArea viewport
  const versesEndRef = useRef<HTMLDivElement>(null); // Ref for the end-of-verses marker
  const surahLoadingRef = useRef(false); // Ref to prevent concurrent surah loads
  const verseLoadingRef = useRef(false); // Ref to prevent concurrent verse loads

   // Ref for the infinite scroll trigger div
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
      threshold: 0.1, // Trigger when 10% visible
      // root: scrollViewportRef.current, // Use viewport as root
      // rootMargin: '0px 0px 200px 0px', // Trigger 200px before end
  });

  // --- Data Fetching ---
  const fetchInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, displayError: null }));
    try {
      const [meta, recitersData, translationsData] = await Promise.all([
        fetchQuranMeta(),
        fetchReciters(),
        fetchTranslations(),
      ]);

       // Filter translations to keep only English ones for simplicity initially
       const englishTranslations = translationsData.filter(t => t.language === 'en');


      setState(prev => ({
        ...prev,
        quranMeta: meta,
        reciters: recitersData,
        translations: englishTranslations, // Store filtered translations
        // isLoading: false, // Don't set loading false until surah is loaded
      }));

      // Load the default surah after metadata is loaded
      await loadSurah(DEFAULT_SURAH_NUMBER, true); // Load initial surah data (overwrite)

    } catch (error) {
      console.error("Error fetching initial data:", error);
      setState(prev => ({
        ...prev,
        displayError: "Failed to load essential Quran data. Please check your connection and refresh.",
        isLoading: false,
        isDisplayLoading: false,
      }));
      toast({
        title: "Error Loading Data",
        description: "Could not fetch necessary Quran data. Please try again later.",
        variant: "destructive",
      });
    } finally {
       // Setting loading to false here might be premature if loadSurah is async
       // setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [toast]); // Added toast dependency

  const loadSurah = useCallback(async (surahNumber: number, overwrite = false) => {
      if (surahLoadingRef.current && !overwrite) { // Allow overwrite even if loading
          console.log("Surah loading already in progress for:", surahNumber);
          return; // Prevent concurrent loads of the *same* surah
      }
      surahLoadingRef.current = true;
      console.log(`Loading Surah ${surahNumber}... Overwrite: ${overwrite}`);
      setState(prev => ({
          ...prev,
          isLoading: true,
          displayError: null,
          ...(overwrite ? { displayedVerses: [], currentSurahNumber: surahNumber, currentVerseNumber: 1 } : {})
      }));

      try {
          const data = await fetchSurahData(surahNumber, state.selectedTranslation);
          setState(prev => ({
              ...prev,
              surahData: prev.surahData.set(surahNumber, data.meta), // Update cache
              displayedVerses: overwrite ? data.verses.slice(0, VERSES_TO_LOAD_AT_ONCE) : [...prev.displayedVerses, ...data.verses], // Initial batch or append
               currentSurahNumber: surahNumber, // Ensure currentSurah is updated
               // isLoading should remain true until rendering/scrolling completes?
              // isLoading: false, // Set loading false after successful fetch
          }));

          // Scroll to top if overwriting
          if (overwrite && scrollViewportRef.current) {
              scrollViewportRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }

      } catch (error) {
          console.error(`Error loading Surah ${surahNumber}:`, error);
          setState(prev => ({
              ...prev,
              displayError: `Failed to load Surah ${surahNumber}. Please try again.`,
              // isLoading: false,
          }));
           toast({
               title: `Error Loading Surah ${surahNumber}`,
               description: error instanceof Error ? error.message : "An unknown error occurred.",
               variant: "destructive",
           });
      } finally {
          setState(prev => ({ ...prev, isLoading: false })); // Ensure loading is set to false
           surahLoadingRef.current = false;
      }
  }, [state.selectedTranslation, toast]); // Dependencies

  // Load more verses when scrolling near the end
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
           setState(prev => ({ ...prev, displayError: "Failed to load more verses." }));
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
      if (surahNumber === state.currentSurahNumber) {
           setState(prev => ({ ...prev, isSurahListOpen: false })); // Close if same surah selected
          return;
      }
      console.log("Surah changed to:", surahNumber);
      loadSurah(surahNumber, true); // Load new surah and overwrite existing verses
      setState(prev => ({ ...prev, isSurahListOpen: false })); // Close sidebar
  };

   // Handle verse selection (e.g., from VerseDisplay click or Controls)
   const handleVerseSelectAndScroll = useCallback((surah: number, verse: number) => {
       console.log(`Selecting verse: ${surah}:${verse}`);
       setState(prev => ({
           ...prev,
           currentVerseNumber: verse, // Update the selected verse number
           // currentPlayingVerse: { surah, verse } // Keep track if needed for auto-play etc.
       }));

       // Scroll the selected verse into view
       const targetVerseElement = document.querySelector(`.verse-container[data-surah="${surah}"][data-verse="${verse}"]`);
       if (targetVerseElement && scrollViewportRef.current) {
            const headerHeight = document.querySelector('header')?.clientHeight || 64; // Get header height
            const verseRect = targetVerseElement.getBoundingClientRect();
            const viewportRect = scrollViewportRef.current.getBoundingClientRect();

             // Calculate the desired scroll position to center the verse, considering the header
            const scrollTop = scrollViewportRef.current.scrollTop + verseRect.top - viewportRect.top - (viewportRect.height / 2) + (verseRect.height / 2) - headerHeight;

           scrollViewportRef.current.scrollTo({
               top: scrollTop,
               behavior: 'smooth'
           });
       } else {
            console.warn(`Verse element ${surah}:${verse} not found for scrolling.`);
            // If verse isn't rendered, load the surah first (handleSurahChange does this)
            if (surah !== state.currentSurahNumber) {
                handleSurahChange(surah);
                // Need a way to scroll AFTER the surah loads, potentially using useEffect
            }
       }
   }, [state.currentSurahNumber]); // Added dependency


  const handleReciterChange = (identifier: string) => {
    setState(prev => ({ ...prev, selectedReciter: identifier }));
     // Optionally, stop/reset audio player when reciter changes
     setState(prev => ({ ...prev, currentPlayingVerse: null })); // Reset playing verse
     const audioEl = document.getElementById('quran-audio-player') as HTMLAudioElement | null;
     if (audioEl) {
         audioEl.pause();
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
          toast({ title: "Translation Error", description: "Could not load the selected translation.", variant: "destructive" });
         // Optionally revert to previous translation
         // setState(prev => ({ ...prev, selectedTranslation: state.selectedTranslation }));
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

   // Toggle Notes Sidebar
    const toggleNotesSidebar = (surah?: number, verse?: number) => {
        setState(prev => ({
            ...prev,
            isNotesSidebarOpen: !prev.isNotesSidebarOpen,
            // Set the target verse only when opening
            noteTakingVerse: !prev.isNotesSidebarOpen && surah && verse ? { surah, verse } : null
        }));
    };

   // Toggle Concept Explorer
    const toggleConceptExplorer = () => {
        setState(prev => ({ ...prev, isConceptExplorerOpen: !prev.isConceptExplorerOpen }));
    };

    // Toggle Chat Panel
    const toggleChatPanel = (contextVerse?: VerseData) => {
        setState(prev => ({
            ...prev,
            isChatPanelOpen: !prev.isChatPanelOpen,
            // Optionally pass context when opening
            // chatContextVerse: !prev.isChatPanelOpen ? contextVerse : null
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
                 // Open concept tagging UI (could be part of notes or separate)
                 console.log("Tag Verse action triggered");
                 // Example: openConceptTaggingModal(verseData.surah, verseData.numberInSurah);
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
                 toggleChatPanel(verseData); // Pass verse data to chat panel
                 break;
             default:
                 console.warn(`Unknown context menu action: ${action}`);
         }
     };

     // Callback from Controls to update playing state
     const handlePlayStateChange = useCallback((isPlaying: boolean, surah: number, verse: number) => {
         setState(prev => ({
             ...prev,
             currentPlayingVerse: isPlaying ? { surah, verse } : null,
             currentVerseNumber: verse, // Also update the currently selected verse number
         }));
         // If playing, highlight the verse
         if (isPlaying) {
             handleVerseSelectAndScroll(surah, verse);
         }
     }, [handleVerseSelectAndScroll]); // Dependency


   // Calculate current absolute verse number for controls
   const absoluteVerseNum = state.quranMeta ? calculateAbsoluteVerseNumber(state.currentSurahNumber, state.currentVerseNumber, state.quranMeta) : 0;
   const totalAbsoluteVerses = state.quranMeta?.totalVerses || 6236;

   // Get metadata for the current surah
   const currentSurahMeta = state.surahData.get(state.currentSurahNumber);


  return (
      <TooltipProvider>
         <div className="flex h-screen flex-col bg-background text-foreground">
              {/* Header - Remains Fixed */}
               <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                 <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
                   {/* Left Side: Drawer Menu & Title */}
                   <div className="flex items-center gap-4">
                       {/* Mobile Drawer Trigger */}
                       <Sheet open={state.isSurahListOpen} onOpenChange={(isOpen) => setState(prev => ({ ...prev, isSurahListOpen: isOpen }))}>
                          <SheetTrigger asChild>
                              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle Surah List">
                                   <Menu className="h-5 w-5" />
                              </Button>
                          </SheetTrigger>
                          <SheetContent side="left" className="w-72 p-0">
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
                        <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => loadSurah(Math.max(1, state.currentSurahNumber - 1), true)}
                                  disabled={state.currentSurahNumber <= 1 || state.isLoading}
                                  aria-label="Previous Surah"
                                >
                                  <ChevronDown className="h-4 w-4 rotate-90" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>Previous Surah</TooltipContent>
                        </Tooltip>

                        <Sheet open={state.isSurahListOpen} onOpenChange={(isOpen) => setState(prev => ({ ...prev, isSurahListOpen: isOpen }))}>
                            <SheetTrigger asChild>
                               <Button variant="outline" size="sm" className="min-w-[200px] justify-between">
                                 <span>
                                     {state.currentSurahNumber}. {currentSurahMeta?.englishName || `Surah ${state.currentSurahNumber}`}
                                  </span>
                                 <ChevronDown className="h-4 w-4 opacity-50" />
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
                                  onClick={() => loadSurah(Math.min(114, state.currentSurahNumber + 1), true)}
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
                    <div className="flex items-center gap-2">
                         {/* Notes Button */}
                          <Tooltip>
                              <TooltipTrigger asChild>
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


              {/* Main Content Area - Scrollable */}
               <main className="flex-1 overflow-hidden flex flex-col"> {/* Use flex-col */}

                 {/* Scrollable Verses Area */}
                 {/* Use h-0 and flex-grow to make it take remaining space */}
                  <ScrollArea className="h-0 flex-grow" viewportRef={scrollViewportRef}>
                     {state.isLoading && state.displayedVerses.length === 0 && (
                          <div className="flex justify-center items-center h-full">
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
                          {/* Surah Header - Now part of the scrollable content */}
                         {currentSurahMeta && (
                             <div className="mb-6 border-b pb-4">
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                      <div className="flex items-center gap-3">
                                          <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                                              {state.currentSurahNumber}
                                          </div>
                                          <div>
                                               <h2 className="text-xl font-semibold font-amiri">{currentSurahMeta.name}</h2>
                                               <h3 className="text-base font-medium">{currentSurahMeta.englishName}</h3>
                                          </div>
                                      </div>
                                      <div className="text-right text-xs text-muted-foreground flex flex-col items-end sm:items-start">
                                           <p>{currentSurahMeta.revelationType}</p>
                                           <p>{currentSurahMeta.numberOfAyahs} Ayahs</p>
                                      </div>
                                  </div>
                                  {/* Bismillah */}
                                  {state.currentSurahNumber !== 1 && state.currentSurahNumber !== 9 && (
                                       <p className="text-center font-amiri text-xl mt-3 text-foreground">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
                                  )}
                             </div>
                         )}

                          {/* Verses */}
                          {state.displayedVerses.map((verse) => (
                             <VerseDisplay
                                  key={`${verse.surah}-${verse.numberInSurah}`}
                                  verseData={verse}
                                  fontSize={state.fontSize}
                                  arabicFontSize={state.arabicFontSize}
                                  lineHeight={state.lineHeight}
                                  onVerseSelect={() => handleVerseSelectAndScroll(verse.surah, verse.numberInSurah)} // Use the combined handler
                                  onContextMenuAction={handleContextMenuAction}
                                  isSelected={state.currentVerseNumber === verse.numberInSurah && state.currentSurahNumber === verse.surah} // Highlight based on currentVerseNumber
                                  isPlaying={state.currentPlayingVerse?.surah === verse.surah && state.currentPlayingVerse?.verse === verse.numberInSurah}
                                  noteExists={checkNoteExists(calculateAbsoluteVerseNumber(verse.surah, verse.numberInSurah, state.quranMeta) ?? 0)}
                                  conceptIds={getConceptsForVerse(calculateAbsoluteVerseNumber(verse.surah, verse.numberInSurah, state.quranMeta) ?? 0)}
                                  allConcepts={getAllConcepts()}
                              />
                         ))}

                         {/* End of Surah Marker / Loading Indicator */}
                          <div ref={loadMoreRef} className={cn(
                             "flex justify-center items-center py-6 text-center min-h-[60px]",
                             (state.isDisplayLoading || state.displayError || state.displayedVerses.length === 0) && "hidden"
                             )}>
                             {state.isDisplayLoading ? (
                                 <Loader2 className="h-6 w-6 animate-spin text-primary" />
                             ) : currentSurahMeta && state.displayedVerses.length >= currentSurahMeta.numberOfAyahs ? (
                                 <span className="text-muted-foreground text-sm">End of Surah {state.currentSurahNumber}</span>
                             ) : (
                                  <span className="text-muted-foreground/50 text-xs">Loading more...</span>
                             )}
                          </div>
                     </div>
                  </ScrollArea>
              </main>

              {/* Audio Controls Footer - Remains Fixed */}
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
                      onVerseChange={(verseNum) => handleVerseSelectAndScroll(state.currentSurahNumber, verseNum)} // Use combined handler
                      onSurahChange={handleSurahChange}
                      onPlayStateChange={handlePlayStateChange} // Pass callback
                  />
              </footer>

               {/* Settings Panel */}
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

               {/* Notes Sidebar */}
               <NotesSidebar
                 isOpen={state.isNotesSidebarOpen}
                 onOpenChange={toggleNotesSidebar}
                 verseRef={state.noteTakingVerse}
                 onNoteSave={(surah, verse, text, tags) => {
                     saveNote(calculateAbsoluteVerseNumber(surah, verse, state.quranMeta) ?? 0, surah, verse, text, tags);
                     if (tags.length > 0) {
                          tagVerseWithConcepts(calculateAbsoluteVerseNumber(surah, verse, state.quranMeta) ?? 0, surah, verse, tags);
                     }
                 }}
                 onConceptUntag={(surah, verse, conceptId) => {
                     untagVerseConcepts(calculateAbsoluteVerseNumber(surah, verse, state.quranMeta) ?? 0, conceptId);
                 }}
                 getNoteForVerse={(s, v) => getNoteForVerse(calculateAbsoluteVerseNumber(s, v, state.quranMeta) ?? 0)}
                 getConceptsForVerse={(s, v) => getConceptsForVerse(calculateAbsoluteVerseNumber(s, v, state.quranMeta) ?? 0)}
                 allConcepts={getAllConcepts()}
               />

               {/* Concept Explorer Modal/Sheet */}
                <ConceptExplorer
                   isOpen={state.isConceptExplorerOpen}
                   onOpenChange={toggleConceptExplorer}
                   onVerseNavigate={(surah, verse) => {
                      handleSurahChange(surah);
                      setTimeout(() => {
                          handleVerseSelectAndScroll(surah, verse); // Use combined handler
                      }, 500);
                      toggleConceptExplorer();
                   }}
                />

                 {/* Chat Panel */}
                 <ChatPanel
                     isOpen={state.isChatPanelOpen}
                     onOpenChange={toggleChatPanel}
                     verseContext={ // Pass the currently *selected* verse data for context
                         state.quranMeta && state.surahData.get(state.currentSurahNumber)
                         ? state.displayedVerses.find(v => v.surah === state.currentSurahNumber && v.numberInSurah === state.currentVerseNumber) || null
                         : null
                     }
                 />

          </div>
       </TooltipProvider>
  );
}
```></content>
  </change>
  <change>
    <file>src/components/quran/Controls.jsx</file>
    <description>Delete Controls.jsx as it