
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Play, Pause, SkipBack, SkipForward, Volume1, Volume2, VolumeX, Repeat, Repeat1, Settings2, ChevronDown, ChevronsDown, FastForward, Rewind, ListMusic, BookCopy, BookMarked, Check
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Reciter, QuranMeta } from '@/services/alquran-cloud';
import { JUZ_STARTS, PAGE_STARTS, getSurahAndVerseFromAbsolute } from '@/data/quranMappings';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ControlsProps {
  currentSurah: number;
  currentVerse: number;
  totalVersesInSurah: number;
  totalAbsoluteVerses: number;
  absoluteVerseNumber: number;
  selectedReciter: string;
  reciters: Reciter[];
  quranMeta: QuranMeta | null;
  onReciterChange: (identifier: string) => void;
  onVerseChange: (verseNumber: number) => void;
  onSurahChange: (surahNumber: number) => void;
  onPlayStateChange: (isPlaying: boolean, surah: number, verse: number) => void; // Callback for play/pause state
}

type RepeatMode = 'none' | 'verse' | 'surah' | 'selection';

export function Controls({
  currentSurah,
  currentVerse,
  totalVersesInSurah,
  totalAbsoluteVerses,
  absoluteVerseNumber,
  selectedReciter,
  reciters,
  quranMeta,
  onReciterChange,
  onVerseChange,
  onSurahChange,
  onPlayStateChange,
}: ControlsProps) {
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [repeatCount, setRepeatCount] = useState(1); // Number of times to repeat (used with 'verse' or 'selection')
  const [currentRepeatIteration, setCurrentRepeatIteration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const isSeekingRef = useRef(false); // Ref to track if user is actively seeking

  // Create or get audio element on mount
  useEffect(() => {
    // Ensure this runs only client-side
    if (typeof window !== 'undefined') {
      let audio = document.getElementById('quran-audio-player') as HTMLAudioElement | null;
      if (!audio) {
        audio = new Audio();
        audio.id = 'quran-audio-player';
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      setAudioElement(audio);
    }
  }, []);

  // Audio event listeners
  useEffect(() => {
    if (!audioElement) return;

    const handlePlay = () => {
        setIsPlaying(true);
        setIsAudioLoading(false);
        setPlaybackError(null);
        onPlayStateChange(true, currentSurah, currentVerse);
    };
    const handlePause = () => {
        setIsPlaying(false);
        setIsAudioLoading(false);
        onPlayStateChange(false, currentSurah, currentVerse);
    };
    const handleEnded = () => {
        console.log("Audio ended. Repeat mode:", repeatMode, "Iteration:", currentRepeatIteration, "Count:", repeatCount);
        setIsPlaying(false);
        setCurrentTime(0);
        onPlayStateChange(false, currentSurah, currentVerse);

         if (repeatMode === 'verse' && (repeatCount === Infinity || currentRepeatIteration < repeatCount -1)) {
             console.log("Repeating verse...");
             setCurrentRepeatIteration(prev => prev + 1);
             setTimeout(() => playAudio(), 100); // Short delay before restart
         } else if (repeatMode === 'surah' || repeatMode === 'selection') {
             // Reset iteration count if verse repeat finished
             if (repeatMode === 'verse') setCurrentRepeatIteration(0);
             // Play next verse automatically if not verse repeat or verse repeat finished
             console.log("Moving to next verse...");
              handleNextVerse();
         } else {
             // No repeat or finished repeating verse
             setCurrentRepeatIteration(0);
             // Consider stopping or just updating UI state
         }
    };
    const handleTimeUpdate = () => {
       if (!isSeekingRef.current) { // Only update if user is not seeking
           setCurrentTime(audioElement.currentTime);
       }
    };
    const handleLoadedMetadata = () => {
        setDuration(audioElement.duration);
        setIsAudioLoading(false); // Loading finished
    };
    const handleLoading = () => setIsAudioLoading(true);
    const handleVolumeChange = () => {
        setVolume(audioElement.volume);
        setIsMuted(audioElement.muted);
    };
     const handleError = (e: Event | string) => { // Accept string for manual errors
         let errorMsg = "An unknown audio error occurred.";
         if (e instanceof Event && (e.target as HTMLAudioElement).error) {
             const mediaError = (e.target as HTMLAudioElement).error;
             errorMsg = `Audio Error: Code ${mediaError?.code || 'N/A'}. ${mediaError?.message || 'Check network or audio source.'}`;
             console.error("Audio Error Event:", mediaError);
         } else if (typeof e === 'string') {
            errorMsg = e;
         }
         console.error("Handling Audio Error:", errorMsg);
         setPlaybackError(errorMsg);
         setIsPlaying(false);
         setIsAudioLoading(false);
         onPlayStateChange(false, currentSurah, currentVerse); // Update parent state
     };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioElement.addEventListener('loadstart', handleLoading); // Indicate loading start
    audioElement.addEventListener('waiting', handleLoading); // Indicate buffering/waiting
    audioElement.addEventListener('canplay', handlePlay); // Or canplaythrough
    audioElement.addEventListener('volumechange', handleVolumeChange);
    audioElement.addEventListener('error', handleError);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.removeEventListener('loadstart', handleLoading);
      audioElement.removeEventListener('waiting', handleLoading);
       audioElement.removeEventListener('canplay', handlePlay);
      audioElement.removeEventListener('volumechange', handleVolumeChange);
      audioElement.removeEventListener('error', handleError);
    };
  }, [audioElement, repeatMode, repeatCount, currentRepeatIteration, onPlayStateChange, currentSurah, currentVerse]); // Added dependencies

    // Update audio source when verse or reciter changes
     useEffect(() => {
         if (audioElement && currentSurah && currentVerse) {
             console.log(`Verse/Reciter change detected: ${currentSurah}:${currentVerse}, Reciter: ${selectedReciter}`);
             const absoluteVerseForAudio = calculateAbsoluteVerseNumber(currentSurah, currentVerse, quranMeta);
              if (!absoluteVerseForAudio) {
                  console.error("Could not calculate absolute verse number for audio.");
                  setPlaybackError("Error: Could not determine verse for audio playback.");
                  return;
              }

             const audioUrl = `https://cdn.alquran.cloud/media/audio/ayah/${selectedReciter}/${absoluteVerseForAudio}`;
             console.log("Setting audio source:", audioUrl);

             // Stop current playback before changing source
             if (isPlaying) {
                  audioElement.pause();
                  setIsPlaying(false);
                   onPlayStateChange(false, currentSurah, currentVerse);
             }

             audioElement.src = audioUrl;
             audioElement.load(); // Load the new source
             setPlaybackError(null); // Clear previous errors
             setCurrentTime(0); // Reset time
             setDuration(0); // Reset duration until new metadata loads
              setIsAudioLoading(true); // Set loading state
              setCurrentRepeatIteration(0); // Reset repeat iteration

              // Optional: Auto-play the new verse if it was playing before change?
              // if (wasPlayingBeforeChange) {
              //     playAudio();
              // }
         }
     }, [currentSurah, currentVerse, selectedReciter, audioElement, quranMeta]); // Include quranMeta


  // --- Playback Control Functions ---
  const playAudio = useCallback(() => {
    if (!audioElement) return;
     setPlaybackError(null); // Clear previous errors
    setIsAudioLoading(true);
    setCurrentRepeatIteration(0); // Start repeat count from 0 when play is initiated
    audioElement.play().catch(e => {
      console.error("Error playing audio:", e);
      setPlaybackError(`Play Error: ${e.message}. Check permissions or audio source.`);
      setIsPlaying(false);
      setIsAudioLoading(false);
        onPlayStateChange(false, currentSurah, currentVerse);
    });
  }, [audioElement, onPlayStateChange, currentSurah, currentVerse]);

  const pauseAudio = useCallback(() => {
    if (audioElement) {
      audioElement.pause();
    }
  }, [audioElement]);

  const togglePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  };

  // --- Navigation ---
  const handlePreviousVerse = () => {
    if (currentVerse > 1) {
      onVerseChange(currentVerse - 1);
    } else if (currentSurah > 1) {
      // Find number of verses in the previous surah
      const prevSurahMeta = quranMeta?.surahs?.find(s => s.number === currentSurah - 1);
      if (prevSurahMeta) {
        onSurahChange(currentSurah - 1);
        // Wait briefly for state update, then change verse
        setTimeout(() => onVerseChange(prevSurahMeta.numberOfAyahs), 50);
      }
    }
  };

  const handleNextVerse = () => {
    if (currentVerse < totalVersesInSurah) {
      onVerseChange(currentVerse + 1);
    } else if (currentSurah < 114) {
      onSurahChange(currentSurah + 1);
       // Wait briefly for state update, then change verse
       setTimeout(() => onVerseChange(1), 50);
    }
  };

  // --- Seek/Progress ---
  const handleSeek = (value: number[]) => {
    if (!audioElement || !duration) return;
     const newTime = value[0];
     if (!isNaN(newTime)) {
         isSeekingRef.current = true; // Indicate user is seeking
         setCurrentTime(newTime); // Update UI immediately
         // Update audio time only when seeking stops (in handleSeekEnd)
     }
  };

  const handleSeekEnd = (value: number[]) => {
      if (!audioElement || !duration) return;
      const newTime = value[0];
      if (!isNaN(newTime)) {
          audioElement.currentTime = newTime;
      }
       isSeekingRef.current = false; // Seeking finished
  };

  // --- Volume ---
  const handleVolumeChange = (value: number[]) => {
    if (audioElement) {
      const newVolume = value[0];
      audioElement.volume = newVolume;
      audioElement.muted = newVolume === 0;
    }
  };

  const toggleMute = () => {
    if (audioElement) {
      audioElement.muted = !audioElement.muted;
    }
  };

  // --- Playback Rate ---
  const handlePlaybackRateChange = (rate: string) => {
    if (audioElement) {
      const newRate = parseFloat(rate);
      audioElement.playbackRate = newRate;
      setPlaybackRate(newRate);
    }
  };

  // --- Repeat ---
  const handleRepeatModeChange = (mode: RepeatMode) => {
    setRepeatMode(mode);
    console.log("Repeat mode set to:", mode);
    if (mode !== 'verse') {
        setCurrentRepeatIteration(0); // Reset iteration if not repeating verse
    }
  };

   const handleRepeatCountChange = (countStr: string) => {
       const count = countStr === '∞' ? Infinity : parseInt(countStr, 10);
       setRepeatCount(count);
       setCurrentRepeatIteration(0); // Reset iteration count on change
        console.log("Repeat count set to:", count);
   };

  // --- Navigation Popovers ---
  const handleJuzSelect = (juz: number) => {
      const startVerse = JUZ_STARTS[juz - 1];
      if (startVerse && quranMeta) {
          const { surah, ayah } = getSurahAndVerseFromAbsolute(startVerse, quranMeta);
          if (surah) {
              onSurahChange(surah);
               setTimeout(() => onVerseChange(ayah), 50); // Select verse after surah potentially changes
          }
      }
  };

  const handlePageSelect = (page: number) => {
       const startVerse = PAGE_STARTS[page - 1];
       if (startVerse && quranMeta) {
           const { surah, ayah } = getSurahAndVerseFromAbsolute(startVerse, quranMeta);
           if (surah) {
               onSurahChange(surah);
                setTimeout(() => onVerseChange(ayah), 50);
           }
       }
  };

  // --- Helper ---
   const calculateAbsoluteVerseNumber = (surah: number, verse: number, meta: QuranMeta | null): number | null => {
        if (!meta || !meta.surahs || meta.surahs.length === 0) return null;
        let absoluteVerse = 0;
        for (let i = 0; i < surah - 1; i++) {
            if (!meta.surahs[i]) return null;
            absoluteVerse += meta.surahs[i].numberOfAyahs;
        }
        return absoluteVerse + verse;
   };

  return (
    <TooltipProvider>
      <div className="flex flex-col space-y-2 px-4 py-2 bg-background border-t">

       {/* Error Display */}
       {playbackError && (
           <div className="text-center text-xs text-destructive p-1 bg-destructive/10 border border-destructive/30 rounded">
             {playbackError}
           </div>
       )}

        {/* Progress Bar / Slider */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            max={duration || 1} // Use 1 as max if duration is 0 to prevent errors
            step={1}
            onValueChange={handleSeek}
            onValueCommit={handleSeekEnd} // Use onValueCommit for final seek
            className="flex-1 h-2"
            disabled={!duration || isAudioLoading}
          />
          <span>{formatTime(duration)}</span>
        </div>

        {/* Main Controls Row */}
        <div className="flex items-center justify-between gap-2">

           {/* Left Side: Reciter Selection */}
            <div className="w-1/4 flex justify-start">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs justify-start px-2 truncate">
                             <ListMusic className="mr-1.5 h-3.5 w-3.5 flex-shrink-0"/>
                             <span className="truncate">{reciters.find(r => r.identifier === selectedReciter)?.englishName || selectedReciter}</span>
                             <ChevronDown className="ml-1 h-3 w-3" />
                         </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-1 max-h-60 overflow-y-auto">
                         <Select
                           value={selectedReciter}
                           onValueChange={onReciterChange}
                         >
                             <SelectTrigger className="h-8 text-xs mb-1 focus:ring-0 focus:ring-offset-0 border-0 px-2">
                                <SelectValue placeholder="Select Reciter" />
                              </SelectTrigger>
                             <SelectContent>
                                 {reciters.map((reciter) => (
                                   <SelectItem key={reciter.identifier} value={reciter.identifier} className="text-xs">
                                     {reciter.englishName}
                                   </SelectItem>
                                 ))}
                              </SelectContent>
                         </Select>
                    </PopoverContent>
                 </Popover>
            </div>

            {/* Center: Playback Controls */}
            <div className="flex items-center justify-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={handlePreviousVerse} disabled={currentSurah === 1 && currentVerse === 1} className="h-9 w-9">
                    <SkipBack className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous Verse</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" size="icon" onClick={togglePlayPause} disabled={isAudioLoading || !audioElement} className="h-10 w-10">
                     {isAudioLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                 <TooltipContent>{isPlaying ? 'Pause' : 'Play'}</TooltipContent>
              </Tooltip>

               <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={handleNextVerse} disabled={currentSurah === 114 && currentVerse === totalVersesInSurah} className="h-9 w-9">
                    <SkipForward className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                 <TooltipContent>Next Verse</TooltipContent>
              </Tooltip>
            </div>

            {/* Right Side: Secondary Controls */}
             <div className="w-1/4 flex justify-end items-center gap-1">
                 {/* Playback Speed */}
                 <Popover>
                    <PopoverTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-xs font-mono" aria-label="Playback Speed">
                              {playbackRate.toFixed(1)}x
                         </Button>
                     </PopoverTrigger>
                    <PopoverContent className="w-32 p-1">
                         <Select
                           value={playbackRate.toString()}
                           onValueChange={handlePlaybackRateChange}
                         >
                             <SelectTrigger className="h-8 text-xs mb-1 focus:ring-0 focus:ring-offset-0 border-0 px-2">
                                <SelectValue placeholder="Speed" />
                              </SelectTrigger>
                             <SelectContent>
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                     <SelectItem key={rate} value={rate.toString()} className="text-xs">
                                         {rate.toFixed(1)}x
                                     </SelectItem>
                                ))}
                              </SelectContent>
                         </Select>
                    </PopoverContent>
                 </Popover>

                 {/* Repeat Mode */}
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className={cn("h-8 w-8", repeatMode !== 'none' && 'text-primary')} aria-label="Repeat Settings">
                             {repeatMode === 'verse' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                         </Button>
                    </PopoverTrigger>
                     <PopoverContent className="w-48 p-2">
                         <div className="space-y-2">
                            <Label className="text-xs font-medium">Repeat Mode</Label>
                            <Select value={repeatMode} onValueChange={(value) => handleRepeatModeChange(value as RepeatMode)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select Repeat Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="text-xs">None</SelectItem>
                                    <SelectItem value="verse" className="text-xs">Repeat Verse</SelectItem>
                                     <SelectItem value="surah" className="text-xs">Repeat Surah</SelectItem>
                                     {/* <SelectItem value="selection" className="text-xs">Repeat Selection</SelectItem> */}
                                </SelectContent>
                             </Select>
                            {(repeatMode === 'verse' || repeatMode === 'selection') && (
                                <>
                                     <Label className="text-xs font-medium">Repeat Count</Label>
                                     <Select value={repeatCount === Infinity ? '∞' : repeatCount.toString()} onValueChange={handleRepeatCountChange}>
                                         <SelectTrigger className="h-8 text-xs">
                                             <SelectValue placeholder="Times" />
                                         </SelectTrigger>
                                         <SelectContent>
                                             {[1, 2, 3, 5, 10, '∞'].map(count => (
                                                <SelectItem key={count} value={count.toString()} className="text-xs">
                                                     {count === '∞' ? 'Infinity' : `${count} times`}
                                                 </SelectItem>
                                            ))}
                                         </SelectContent>
                                     </Select>
                                </>
                            )}
                         </div>
                    </PopoverContent>
                 </Popover>


                {/* Volume Control */}
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Volume Control">
                            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : volume < 0.5 ? <Volume1 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                     </PopoverTrigger>
                    <PopoverContent className="w-40 p-2">
                         <Slider
                            value={[isMuted ? 0 : volume]}
                            max={1}
                            step={0.05}
                            onValueChange={handleVolumeChange}
                             className="h-2"
                         />
                    </PopoverContent>
                 </Popover>

            </div>

        </div>

         {/* Navigation Row */}
          <div className="flex items-center justify-center gap-2 text-xs">
              <Popover>
                 <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                          <BookCopy className="mr-1.5 h-3 w-3"/> Juz
                      </Button>
                 </PopoverTrigger>
                  <PopoverContent className="w-56 max-h-60 overflow-y-auto p-1">
                      <div className="grid grid-cols-3 gap-1">
                         {Array.from({ length: 30 }, (_, i) => i + 1).map(juz => (
                             <Button
                                key={juz}
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs justify-center"
                                onClick={() => handleJuzSelect(juz)}
                             >
                                 Juz {juz}
                             </Button>
                         ))}
                      </div>
                  </PopoverContent>
              </Popover>
              <Popover>
                 <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                          <BookMarked className="mr-1.5 h-3 w-3"/> Page
                      </Button>
                 </PopoverTrigger>
                  <PopoverContent className="w-72 max-h-60 overflow-y-auto p-1">
                       <div className="grid grid-cols-5 gap-1">
                          {Array.from({ length: 604 }, (_, i) => i + 1).map(page => (
                              <Button
                                 key={page}
                                 variant="ghost"
                                 size="sm"
                                 className="h-7 text-xs justify-center"
                                 onClick={() => handlePageSelect(page)}
                              >
                                  {page}
                              </Button>
                          ))}
                       </div>
                  </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">Verse: {absoluteVerseNumber} / {totalAbsoluteVerses}</span>
          </div>

      </div>
    </TooltipProvider>
  );
}

// Loader component
const Loader2 = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  (props, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
);
Loader2.displayName = "Loader2";
```></content>
  </change>
  <change>
    <file>src/components/quran/ReaderView.tsx</file>
    <description>Import Controls component and remove redundant audio/navigation logic from ReaderView.</description>
    <content><![CDATA[
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
    <description>Delete Controls.jsx as it was replaced by Controls.tsx</description>
    <content><![CDATA[