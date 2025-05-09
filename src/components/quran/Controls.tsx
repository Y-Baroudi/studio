
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from "@/components/ui/label"
import {
  Play, Pause, SkipBack, SkipForward, Volume1, Volume2, VolumeX, Repeat, Repeat1, Settings2, ChevronDown, ChevronsDown, FastForward, Rewind, ListMusic, BookCopy, BookMarked, Check, Loader2 as LucideLoader
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
        audio.style.display = 'none'; // Keep it hidden
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
    audioElement.addEventListener('canplay', handleLoadedMetadata); // Use loadedmetadata or canplaythrough
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
      audioElement.removeEventListener('canplay', handleLoadedMetadata);
      audioElement.removeEventListener('volumechange', handleVolumeChange);
      audioElement.removeEventListener('error', handleError);
    };
  }, [audioElement, repeatMode, repeatCount, currentRepeatIteration, onPlayStateChange, currentSurah, currentVerse]); // Added dependencies

    // Update audio source when verse or reciter changes
     useEffect(() => {
         if (audioElement && currentSurah && currentVerse && selectedReciter && quranMeta) {
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
     }, [currentSurah, currentVerse, selectedReciter, audioElement, quranMeta, isPlaying, onPlayStateChange]); // Include quranMeta and isPlaying


  // --- Playback Control Functions ---
  const playAudio = useCallback(() => {
    if (!audioElement) return;
     setPlaybackError(null); // Clear previous errors
    setIsAudioLoading(true);
    setCurrentRepeatIteration(0); // Start repeat count from 0 when play is initiated
    audioElement.play().catch(e => {
      console.error("Error playing audio:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setPlaybackError(`Play Error: ${errorMessage}. Check permissions or audio source.`);
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
        <div className="time-display flex items-center gap-2 text-xs text-muted-foreground">
          <span className="current-time">{formatTime(currentTime)}</span>
          {/* Removed Slider component and related elements */}
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"> {/* Simple visual track */}
            <div
              className="h-full bg-primary transition-all duration-150 ease-linear"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span className="total-time">{formatTime(duration)}</span>
        </div>


        {/* Main Controls Row */}
        <div className="play-controls flex items-center justify-between gap-2">

           {/* Left Side: Reciter Selection */}
            <div className="w-1/3 flex justify-start">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="reciter-button text-xs justify-start px-2 truncate">
                             <ListMusic className="mr-1.5 h-3.5 w-3.5 flex-shrink-0"/>
                             <span className="current-reciter-name truncate">{reciters.find(r => r.identifier === selectedReciter)?.englishName || selectedReciter}</span>
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
                   <Button variant="ghost" size="icon" onClick={handlePreviousVerse} disabled={currentSurah === 1 && currentVerse === 1} className="previous-button h-9 w-9">
                    <SkipBack className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous Verse</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" size="icon" onClick={togglePlayPause} disabled={isAudioLoading || !audioElement} className="play-button main-play-button h-10 w-10">
                     {isAudioLoading ? <LucideLoader className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="play-icon h-5 w-5" /> : <Play className="pause-icon h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                 <TooltipContent>{isPlaying ? 'Pause' : 'Play'}</TooltipContent>
              </Tooltip>

               <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={handleNextVerse} disabled={currentSurah === 114 && currentVerse === totalVersesInSurah} className="next-button h-9 w-9">
                    <SkipForward className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                 <TooltipContent>Next Verse</TooltipContent>
              </Tooltip>
            </div>

            {/* Right Side: Secondary Controls */}
             <div className="secondary-controls w-1/3 flex justify-end items-center gap-1">
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
                        <Button variant="ghost" size="icon" className={cn("repeat-button h-8 w-8", repeatMode !== 'none' && 'text-primary')} aria-label="Repeat Settings">
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
                        <Button variant="ghost" size="icon" className="audio-settings h-8 w-8" aria-label="Volume Control">
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

// Removed inline Loader2 component as it's not used here and LucideLoader is imported.
// If a generic Loader2 is needed elsewhere, it should be in its own component file.

