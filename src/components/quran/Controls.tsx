
'use client';

import type { ChangeEvent } from 'react';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Reciter } from '@/services/alquran-cloud';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Settings, Minus, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ThemeToggle } from '@/components/theme-toggle'; // Import ThemeToggle

const MAX_VERSE_NUMBER = 6236; // Total verses in the Quran

interface ControlsProps {
  verseNumber: number;
  audioUrl: string | undefined;
  reciters: Reciter[];
  selectedReciter: string;
  fontSize: number;
  onNextVerse: () => void;
  onPreviousVerse: () => void;
  onReciterChange: (reciterId: string) => void;
  onFontSizeChange: (value: number[]) => void;
  onVerseInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
   onVerseInputBlur: (e: ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean; // Consolidated loading state
}

export function Controls({
  verseNumber,
  audioUrl,
  reciters,
  selectedReciter,
  fontSize,
  onNextVerse,
  onPreviousVerse,
  onReciterChange,
  onFontSizeChange,
  onVerseInputChange,
  onVerseInputBlur,
  isLoading,
}: ControlsProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
   const [isAudioLoading, setIsAudioLoading] = useState(false); // Separate state for audio element loading

  // Play/Pause functionality
  const togglePlayPause = useCallback(() => {
     if (isLoading || !audioRef.current || !audioUrl || isAudioLoading) return; // Don't allow play if loading or no audio

    setPlaybackError(null); // Clear previous errors
    if (isPlaying) {
      audioRef.current.pause();
    } else {
       setIsAudioLoading(true); // Indicate attempt to load/play
       audioRef.current.play().catch(err => {
         console.error("Audio playback error:", err);
         setPlaybackError("Could not play audio. Please check the reciter or try again.");
         setIsPlaying(false); // Ensure state reflects reality if play fails immediately
         setIsAudioLoading(false);
      });
    }
    // isPlaying state will be updated by the 'play'/'pause' event listeners
  }, [isPlaying, isLoading, audioUrl, isAudioLoading]);

  // Update state when audio play/pause events occur
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handlePlay = () => {
        setIsPlaying(true);
        setIsAudioLoading(false); // Play started, no longer loading
    }
    const handlePause = () => {
        setIsPlaying(false);
        setIsAudioLoading(false); // Paused, no longer loading
    }
    const handleEnded = () => {
       setIsPlaying(false);
       setIsAudioLoading(false);
       if (!isRepeating && !audioElement.loop) {
         onNextVerse(); // Move to next verse if not repeating
       }
    };
    const handleError = (e: Event) => {
       console.error("Audio Error:", e);
       setPlaybackError("An error occurred during playback.");
       setIsPlaying(false);
       setIsAudioLoading(false);
    };
     const handleWaiting = () => setIsAudioLoading(true); // Audio is buffering/waiting
     const handleCanPlay = () => setIsAudioLoading(false); // Audio has enough data to start playing

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('error', handleError);
     audioElement.addEventListener('waiting', handleWaiting);
     audioElement.addEventListener('canplay', handleCanPlay); // Or 'canplaythrough'

    // Cleanup listeners
    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
       audioElement.removeEventListener('waiting', handleWaiting);
       audioElement.removeEventListener('canplay', handleCanPlay);
    };
  }, [isRepeating, onNextVerse]);

  // Handle audio source change
   useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && audioUrl) {
      const wasPlaying = !audioElement.paused && !audioElement.ended && audioElement.readyState > 0;

       if (!audioElement.paused) {
          audioElement.pause();
       }

       audioElement.src = audioUrl;
       audioElement.load(); // Important: load the new source
       setPlaybackError(null);
       setIsAudioLoading(true); // Assume loading will start

      if (wasPlaying && !isLoading) { // Check overall isLoading as well
            // We don't auto-play here. Let the user press play again for the new verse.
            // This avoids potential issues with autoplay restrictions and provides clearer UX.
            setIsPlaying(false); // Ensure UI reflects paused state initially
            // Auto-play attempt removed:
            // audioElement.play().catch(...)
      } else {
          setIsPlaying(false);
      }

    } else if (audioElement) {
        if (!audioElement.paused) {
          audioElement.pause();
        }
        audioElement.removeAttribute('src');
        audioElement.load();
        setIsPlaying(false);
        setPlaybackError(null);
        setIsAudioLoading(false);
    }
   // Dependency array: Only re-run when the audio URL changes or the *overall* loading state changes.
   // isPlaying is managed internally by event listeners, not needed here.
  }, [audioUrl, isLoading]);


  // Toggle repeat
  const toggleRepeat = () => {
    const newRepeatState = !isRepeating;
    setIsRepeating(newRepeatState);
    if (audioRef.current) {
      audioRef.current.loop = newRepeatState;
    }
  };

  // Toggle mute
   const toggleMute = () => {
     if (audioRef.current) {
       const newMuteState = !isMuted;
       audioRef.current.muted = newMuteState;
       setIsMuted(newMuteState);
     }
   };

   const increaseFontSize = () => onFontSizeChange([Math.min(fontSize + 2, 48)]);
   const decreaseFontSize = () => onFontSizeChange([Math.max(fontSize - 2, 10)]);

   // Disable controls if overall data is loading OR if the audio element itself is loading/buffering
   const controlsDisabled = isLoading || isAudioLoading;

  return (
    <Card className="shadow-md rounded-lg overflow-hidden sticky bottom-4 backdrop-blur-sm bg-background/80 dark:bg-background/70 border">
      <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <audio ref={audioRef} preload="metadata" />

         {/* Verse Navigation & Input */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
         <TooltipProvider>
           <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onPreviousVerse}
                  disabled={isLoading || verseNumber <= 1} // Only disable based on overall load or verse num
                  aria-label="Previous Verse"
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Previous Verse</p>
              </TooltipContent>
            </Tooltip>
         </TooltipProvider>

           {/* Use controlled input approach: value reflects state, onChange updates visually */}
           <Input
            type="number"
            min="1"
            max={MAX_VERSE_NUMBER}
            value={verseNumber} // Bind value to state
            onChange={onVerseInputChange} // Handle visual change during typing
            onBlur={onVerseInputBlur} // Handle actual state change on blur
            className="w-20 text-center h-10"
            aria-label="Current Verse Number"
            disabled={isLoading} // Disable input field during general loading
          />


          <TooltipProvider>
             <Tooltip>
              <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onNextVerse}
                    disabled={isLoading || verseNumber >= MAX_VERSE_NUMBER} // Check max verse
                    aria-label="Next Verse"
                  >
                    <SkipForward className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
              <TooltipContent>
                <p>Next Verse</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>


        {/* Playback Controls */}
        <div className="flex items-center gap-2">
         <TooltipProvider>

           <Tooltip>
             <TooltipTrigger asChild>
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={toggleRepeat}
                 className={isRepeating ? 'text-primary' : ''}
                 aria-pressed={isRepeating}
                 aria-label="Repeat Verse"
                 disabled={controlsDisabled || !audioUrl} // Disable if general loading or audio loading/no URL
               >
                 <Repeat className="h-5 w-5" />
               </Button>
             </TooltipTrigger>
             <TooltipContent>
               <p>{isRepeating ? 'Disable Repeat' : 'Repeat Verse'}</p>
             </TooltipContent>
           </Tooltip>

           <Tooltip>
             <TooltipTrigger asChild>
                 <Button
                  variant="default"
                  size="icon"
                  onClick={togglePlayPause}
                  disabled={controlsDisabled || !audioUrl || !!playbackError} // Disable if general/audio loading, no URL, or error
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-12 h-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 relative"
                 >
                   {/* Show loading spinner overlay */}
                    {isAudioLoading && (
                       <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                         <svg className="animate-spin h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                       </div>
                     )}
                  {/* Show Play/Pause icon when not loading */}
                   {!isAudioLoading && (isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />)}
                 </Button>
               </TooltipTrigger>
             <TooltipContent>
               <p>{isPlaying ? 'Pause' : 'Play'}</p>
             </TooltipContent>
           </Tooltip>

           <Tooltip>
              <TooltipTrigger asChild>
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={toggleMute}
                 aria-pressed={isMuted}
                 aria-label={isMuted ? 'Unmute' : 'Mute'}
                 disabled={controlsDisabled || !audioUrl} // Disable if general/audio loading or no URL
               >
                 {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
               </Button>
             </TooltipTrigger>
             <TooltipContent>
               <p>{isMuted ? 'Unmute' : 'Mute'}</p>
             </TooltipContent>
           </Tooltip>
         </TooltipProvider>
        </div>


        {/* Settings Popover */}
        <Popover>
          <PopoverTrigger asChild>
           <TooltipProvider>
              <Tooltip>
                 <TooltipTrigger asChild>
                   <Button variant="outline" size="icon" aria-label="Settings" disabled={isLoading}>
                     <Settings className="h-5 w-5" />
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent>
                   <p>Settings</p>
                 </TooltipContent>
               </Tooltip>
            </TooltipProvider>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 space-y-4" align="end">
             {/* Reciter Selection */}
            <div className="space-y-2">
              <Label htmlFor="reciter-select">Reciter</Label>
              <Select
                value={selectedReciter}
                onValueChange={onReciterChange}
                disabled={reciters.length === 0 || isLoading} // Disable during general load
              >
                <SelectTrigger id="reciter-select" className="w-full">
                  <SelectValue placeholder="Select Reciter" />
                </SelectTrigger>
                <SelectContent>
                  {reciters.map((reciter) => (
                    <SelectItem key={reciter.id} value={reciter.id}>
                      {reciter.name} ({reciter.language.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             {/* Font Size Adjustment */}
            <div className="space-y-2">
              <Label htmlFor="font-size-slider">Font Size ({fontSize}px)</Label>
               <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={decreaseFontSize} disabled={fontSize <= 10 || isLoading}>
                     <Minus className="h-4 w-4" />
                   </Button>
                   <Slider
                     id="font-size-slider"
                     min={10}
                     max={48}
                     step={2}
                     value={[fontSize]}
                     onValueChange={onFontSizeChange}
                     className="flex-1"
                     aria-label="Adjust font size"
                     disabled={isLoading}
                   />
                   <Button variant="outline" size="icon" onClick={increaseFontSize} disabled={fontSize >= 48 || isLoading}>
                     <Plus className="h-4 w-4" />
                   </Button>
               </div>
            </div>

             {/* Theme Toggle */}
            <div className="flex items-center justify-between">
               <Label>Theme</Label>
               <ThemeToggle />
             </div>
          </PopoverContent>
        </Popover>
      </CardContent>
       {playbackError && (
        <div className="px-4 pb-2 text-center text-xs text-destructive">
          {playbackError}
        </div>
      )}
    </Card>
  );
}
