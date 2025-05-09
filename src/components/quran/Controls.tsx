
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from "@/components/ui/label"
import {
  Play, Pause, SkipBack, SkipForward, Volume1, Volume2, VolumeX, Repeat, Repeat1, Settings2, ChevronDown, ListMusic, BookCopy, BookMarked, Loader2 as LucideLoader
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
  isAudioLoading?: boolean; // Optional prop to indicate audio is loading from parent
  onReciterChange: (identifier: string) => void;
  onVerseChange: (verseNumber: number) => void;
  onSurahChange: (surahNumber: number) => void;
  onPlayStateChange: (isPlaying: boolean, surah: number, verse: number) => void;
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
  isAudioLoading: parentIsAudioLoading = false, // Default to false if not provided
  onReciterChange,
  onVerseChange,
  onSurahChange,
  onPlayStateChange,
}: ControlsProps) {
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Use a combination of parent loading state and internal loading state
  const [internalIsAudioLoading, setInternalIsAudioLoading] = useState(false);
  const isEffectivelyLoading = parentIsAudioLoading || internalIsAudioLoading;

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [repeatCount, setRepeatCount] = useState(1);
  const [currentRepeatIteration, setCurrentRepeatIteration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const isSeekingRef = useRef(false);
  const audioSrcRef = useRef<string | null>(null); // To track current audio source

  useEffect(() => {
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

  useEffect(() => {
    if (!audioElement) return;

    const handlePlay = () => {
        setIsPlaying(true);
        setInternalIsAudioLoading(false);
        setPlaybackError(null);
        onPlayStateChange(true, currentSurah, currentVerse);
    };
    const handlePause = () => {
        setIsPlaying(false);
        setInternalIsAudioLoading(false);
        onPlayStateChange(false, currentSurah, currentVerse);
    };
    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onPlayStateChange(false, currentSurah, currentVerse);

         if (repeatMode === 'verse' && (repeatCount === Infinity || currentRepeatIteration < repeatCount -1)) {
             setCurrentRepeatIteration(prev => prev + 1);
             setTimeout(() => playAudio(), 100);
         } else if (repeatMode === 'surah' || (repeatMode === 'selection' && currentVerse < totalVersesInSurah)) {
             if (repeatMode === 'verse') setCurrentRepeatIteration(0);
             handleNextVerse();
         } else {
             setCurrentRepeatIteration(0);
         }
    };
    const handleTimeUpdate = () => {
       if (!isSeekingRef.current) {
           setCurrentTime(audioElement.currentTime);
       }
    };
    const handleLoadedMetadata = () => {
        setDuration(audioElement.duration);
        setInternalIsAudioLoading(false);
    };
    const handleLoadStart = () => setInternalIsAudioLoading(true);
    const handleWaiting = () => setInternalIsAudioLoading(true);
    const handleCanPlay = () => { // Using canplay as it fires when enough data is loaded to start playing
        setInternalIsAudioLoading(false);
        setDuration(audioElement.duration); // Also update duration here
    };

    const handleVolumeChange = () => {
        setVolume(audioElement.volume);
        setIsMuted(audioElement.muted);
    };
    const handleError = (e: Event | string) => {
         let errorMsg = "An unknown audio error occurred.";
         if (e instanceof Event && (e.target as HTMLAudioElement).error) {
             const mediaError = (e.target as HTMLAudioElement).error;
             errorMsg = `Audio Error: Code ${mediaError?.code || 'N/A'}. ${mediaError?.message || 'Check network or audio source.'}`;
         } else if (typeof e === 'string') {
            errorMsg = e;
         }
         console.error("Audio Error Details:", e);
         setPlaybackError(errorMsg);
         setIsPlaying(false);
         setInternalIsAudioLoading(false);
         onPlayStateChange(false, currentSurah, currentVerse);
     };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioElement.addEventListener('loadstart', handleLoadStart);
    audioElement.addEventListener('waiting', handleWaiting);
    audioElement.addEventListener('canplay', handleCanPlay);
    audioElement.addEventListener('volumechange', handleVolumeChange);
    audioElement.addEventListener('error', handleError);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.removeEventListener('loadstart', handleLoadStart);
      audioElement.removeEventListener('waiting', handleWaiting);
      audioElement.removeEventListener('canplay', handleCanPlay);
      audioElement.removeEventListener('volumechange', handleVolumeChange);
      audioElement.removeEventListener('error', handleError);
    };
  }, [audioElement, repeatMode, repeatCount, currentRepeatIteration, onPlayStateChange, currentSurah, currentVerse, totalVersesInSurah]);

     useEffect(() => {
         if (audioElement && currentSurah && currentVerse && selectedReciter && quranMeta) {
             const absoluteVerseForAudio = calculateAbsoluteVerseNumber(currentSurah, currentVerse, quranMeta);
              if (!absoluteVerseForAudio) {
                  setPlaybackError("Error: Could not determine verse for audio playback.");
                  return;
              }

             const newAudioUrl = `https://cdn.alquran.cloud/media/audio/ayah/${selectedReciter}/${absoluteVerseForAudio}`;

             if (audioSrcRef.current === newAudioUrl && audioElement.src === newAudioUrl && !audioElement.error) {
                 // Source is already set and no error, no need to reload unless forced
                 // console.log("Audio source already set to:", newAudioUrl);
                 // If it was playing, ensure it continues or UI reflects current state
                 if (isPlaying && audioElement.paused) {
                    // This case can happen if parent component forced a re-render or verse selection change
                    // without actual audio source change, and audio was paused.
                    // If auto-play is desired on verse selection, call playAudio() here.
                    // For now, we ensure UI consistency.
                    // playAudio(); // Uncomment if auto-play on selection is desired
                 }
                 setInternalIsAudioLoading(false); // Ensure loading is false if source is same and valid
                 return;
             }

             audioSrcRef.current = newAudioUrl; // Update the ref for the new source

             if (isPlaying) { // If it was playing, pause it before changing source
                  audioElement.pause();
                  // onPlayStateChange(false, currentSurah, currentVerse); // Parent already knows state
             }

             audioElement.src = newAudioUrl;
             audioElement.load();
             setPlaybackError(null);
             setCurrentTime(0);
             setDuration(0);
             setInternalIsAudioLoading(true);
             setCurrentRepeatIteration(0);

             // Auto-play if it was playing before the source change
             if (isPlaying) {
                 playAudio();
             }
         }
     }, [currentSurah, currentVerse, selectedReciter, audioElement, quranMeta]); // Removed isPlaying, onPlayStateChange

  const playAudio = useCallback(() => {
    if (!audioElement || !audioElement.src || audioSrcRef.current !== audioElement.src) {
      // If src is not set or differs from what we expect, this means useEffect for source update hasn't completed
      // or there's an issue. We should wait for the source update effect.
      console.warn("playAudio called before source is ready or with mismatched source.");
      setInternalIsAudioLoading(true); // Indicate we are trying to load/play
      return;
    }
     setPlaybackError(null);
    setInternalIsAudioLoading(true);
    setCurrentRepeatIteration(0);

    audioElement.play().catch(e => {
      console.error("Error playing audio:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setPlaybackError(`Play Error: ${errorMessage}.`);
      setIsPlaying(false);
      setInternalIsAudioLoading(false);
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

  const handlePreviousVerse = () => {
    setInternalIsAudioLoading(true); // Indicate loading for next/prev
    if (currentVerse > 1) {
      onVerseChange(currentVerse - 1);
    } else if (currentSurah > 1) {
      const prevSurahMeta = quranMeta?.surahs?.find(s => s.number === currentSurah - 1);
      if (prevSurahMeta) {
        onSurahChange(currentSurah - 1);
        setTimeout(() => onVerseChange(prevSurahMeta.numberOfAyahs), 50);
      }
    }
  };

  const handleNextVerse = () => {
    setInternalIsAudioLoading(true); // Indicate loading for next/prev
    if (currentVerse < totalVersesInSurah) {
      onVerseChange(currentVerse + 1);
    } else if (currentSurah < 114) {
      onSurahChange(currentSurah + 1);
       setTimeout(() => onVerseChange(1), 50);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!audioElement || !duration) return;
     const newTime = value[0];
     if (!isNaN(newTime)) {
         isSeekingRef.current = true;
         setCurrentTime(newTime);
     }
  };

  const handleSeekEnd = (value: number[]) => {
      if (!audioElement || !duration) return;
      const newTime = value[0];
      if (!isNaN(newTime)) {
          audioElement.currentTime = newTime;
      }
       isSeekingRef.current = false;
  };

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

  const handlePlaybackRateChange = (rate: string) => {
    if (audioElement) {
      const newRate = parseFloat(rate);
      audioElement.playbackRate = newRate;
      setPlaybackRate(newRate);
    }
  };

  const handleRepeatModeChange = (mode: RepeatMode) => {
    setRepeatMode(mode);
    if (mode !== 'verse') {
        setCurrentRepeatIteration(0);
    }
  };

   const handleRepeatCountChange = (countStr: string) => {
       const count = countStr === '∞' ? Infinity : parseInt(countStr, 10);
       setRepeatCount(count);
       setCurrentRepeatIteration(0);
   };

  const handleJuzSelect = (juz: number) => {
      const startVerse = JUZ_STARTS[juz - 1];
      if (startVerse && quranMeta) {
          const target = getSurahAndVerseFromAbsolute(startVerse, quranMeta);
          if (target) {
              onSurahChange(target.surah);
               setTimeout(() => onVerseChange(target.ayah), 100); // Increased timeout slightly
          }
      }
  };

  const handlePageSelect = (page: number) => {
       const startVerse = PAGE_STARTS[page - 1];
       if (startVerse && quranMeta) {
           const target = getSurahAndVerseFromAbsolute(startVerse, quranMeta);
           if (target) {
               onSurahChange(target.surah);
                setTimeout(() => onVerseChange(target.ayah), 100); // Increased timeout slightly
           }
       }
  };

   const calculateAbsoluteVerseNumber = (surah: number, verse: number, meta: QuranMeta | null): number | null => {
        if (!meta || !meta.surahs || meta.surahs.length === 0) return null;
        let absVerse = 0;
        for (let i = 0; i < surah - 1; i++) {
            if (!meta.surahs[i]) return null;
            absVerse += meta.surahs[i].numberOfAyahs;
        }
        return absVerse + verse;
   };

  return (
    <TooltipProvider>
      <div className="flex flex-col space-y-1 px-4 py-2 bg-background border-t">

       {playbackError && (
           <div className="text-center text-xs text-destructive p-1 bg-destructive/10 border border-destructive/30 rounded">
             {playbackError}
           </div>
       )}
        {/* Time display without slider */}
        <div className="time-display flex items-center justify-between gap-2 text-xs text-muted-foreground px-1">
          <span className="current-time">{formatTime(currentTime)}</span>
          <span className="total-time">{formatTime(duration)}</span>
        </div>

        <div className="play-controls flex items-center justify-between gap-2">
            <div className="w-1/3 flex justify-start">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="reciter-button text-xs justify-start px-2 truncate max-w-[120px] sm:max-w-xs">
                             <ListMusic className="mr-1.5 h-3.5 w-3.5 flex-shrink-0"/>
                             <span className="current-reciter-name truncate">{reciters.find(r => r.identifier === selectedReciter)?.englishName || selectedReciter}</span>
                             <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
                         </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 sm:w-64 p-1 max-h-60 overflow-y-auto">
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

            <div className="flex items-center justify-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={handlePreviousVerse} disabled={(currentSurah === 1 && currentVerse === 1) || isEffectivelyLoading} className="previous-button h-9 w-9">
                    <SkipBack className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous Verse</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" size="icon" onClick={togglePlayPause} disabled={isEffectivelyLoading || !audioElement || !audioElement.src} className="play-button main-play-button h-10 w-10">
                     {isEffectivelyLoading ? <LucideLoader className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="play-icon h-5 w-5" /> : <Play className="pause-icon h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                 <TooltipContent>{isPlaying ? 'Pause' : 'Play'}</TooltipContent>
              </Tooltip>

               <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="ghost" size="icon" onClick={handleNextVerse} disabled={(currentSurah === 114 && currentVerse === totalVersesInSurah) || isEffectivelyLoading} className="next-button h-9 w-9">
                    <SkipForward className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                 <TooltipContent>Next Verse</TooltipContent>
              </Tooltip>
            </div>

             <div className="secondary-controls w-1/3 flex justify-end items-center gap-0.5 sm:gap-1">
                 <Popover>
                    <PopoverTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-xs font-mono" aria-label="Playback Speed" disabled={isEffectivelyLoading}>
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

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className={cn("repeat-button h-8 w-8", repeatMode !== 'none' && 'text-primary')} aria-label="Repeat Settings" disabled={isEffectivelyLoading}>
                             {repeatMode === 'verse' && repeatCount > 1 ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
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
                                </SelectContent>
                             </Select>
                            {(repeatMode === 'verse') && (
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

                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Volume Control" disabled={isEffectivelyLoading}>
                            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : volume < 0.5 ? <Volume1 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                     </PopoverTrigger>
                    <PopoverContent className="w-32 sm:w-40 p-2">
                         <Slider
                            value={[isMuted ? 0 : volume]}
                            max={1}
                            step={0.05}
                            onValueChange={handleVolumeChange}
                            className="h-2" // Ensure slider track is visible
                         />
                    </PopoverContent>
                 </Popover>
            </div>
        </div>

          <div className="flex items-center justify-center gap-1 text-xs mt-1">
              <Popover>
                 <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2" disabled={isEffectivelyLoading}>
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
                      <Button variant="outline" size="sm" className="h-6 text-xs px-2" disabled={isEffectivelyLoading}>
                          <BookMarked className="mr-1.5 h-3 w-3"/> Page
                      </Button>
                 </PopoverTrigger>
                  <PopoverContent className="w-72 max-h-60 overflow-y-auto p-1">
                       <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
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
              <span className="text-muted-foreground ml-2">
                Verse: {absoluteVerseNumber > 0 ? absoluteVerseNumber : '-'} / {totalAbsoluteVerses > 0 ? totalAbsoluteVerses : '-'}
              </span>
          </div>
      </div>
    </TooltipProvider>
  );
}
