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
  isLoading: boolean;
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

  // Play/Pause functionality
  const togglePlayPause = useCallback(() => {
     if (isLoading || !audioRef.current || !audioUrl) return; // Don't allow play if loading or no audio

    setPlaybackError(null); // Clear previous errors
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
         console.error("Audio playback error:", err);
         setPlaybackError("Could not play audio. Please check the reciter or try again.");
         setIsPlaying(false); // Ensure state reflects reality
      });
    }
  }, [isPlaying, isLoading, audioUrl]);

  // Update state when audio play/pause events occur
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
       setIsPlaying(false);
       if (!isRepeating) {
         onNextVerse(); // Move to next verse if not repeating
       }
    };
    const handleError = (e: Event) => {
       console.error("Audio Error:", e);
       setPlaybackError("An error occurred during playback.");
       setIsPlaying(false);
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('error', handleError);

    // Cleanup listeners
    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
    };
  }, [isRepeating, onNextVerse]);

  // Handle audio source change
   useEffect(() => {
    if (audioRef.current && audioUrl) {
      const wasPlaying = isPlaying;
      audioRef.current.src = audioUrl;
      audioRef.current.load(); // Important to load the new source
       setIsPlaying(false); // Reset playing state
      setPlaybackError(null); // Clear errors on source change

      // Optionally autoplay if it was playing before
       if (wasPlaying && !isLoading) {
         // Delay slightly to ensure the new source is loaded
         setTimeout(() => {
           audioRef.current?.play().catch(err => {
             console.error("Audio playback error after source change:", err);
             setPlaybackError("Could not automatically play new audio.");
           });
         }, 100); // Adjust delay if needed
       }
    }
   }, [audioUrl, isLoading, isPlaying]); // isPlaying added to optionally restart playback

  // Toggle repeat
  const toggleRepeat = () => {
    setIsRepeating(!isRepeating);
    if (audioRef.current) {
      audioRef.current.loop = !isRepeating;
    }
  };

  // Toggle mute
   const toggleMute = () => {
     if (audioRef.current) {
       audioRef.current.muted = !isMuted;
       setIsMuted(!isMuted);
     }
   };

   const increaseFontSize = () => onFontSizeChange([Math.min(fontSize + 2, 48)]); // Max font size 48px
   const decreaseFontSize = () => onFontSizeChange([Math.max(fontSize - 2, 10)]); // Min font size 10px

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
                  disabled={verseNumber <= 1 || isLoading}
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

           <Input
            type="number"
            min="1"
            max="6236" // Assuming 6236 verses
             defaultValue={verseNumber} // Use defaultValue for uncontrolled input that can be updated
             key={verseNumber} // Force re-render when verseNumber changes externally
            onChange={onVerseInputChange}
            onBlur={onVerseInputBlur}
            className="w-20 text-center h-10"
            aria-label="Current Verse Number"
            disabled={isLoading}
          />

          <TooltipProvider>
             <Tooltip>
              <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onNextVerse}
                    disabled={isLoading} // Add check for max verse if needed
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
                 disabled={isLoading || !audioUrl}
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
                  variant="default" // Primary action button
                  size="icon"
                  onClick={togglePlayPause}
                  disabled={isLoading || !audioUrl || !!playbackError}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-12 h-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
                 >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
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
                 disabled={isLoading || !audioUrl}
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
                   <Button variant="outline" size="icon" aria-label="Settings">
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
                disabled={reciters.length === 0 || isLoading}
              >
                <SelectTrigger id="reciter-select" className="w-full">
                  <SelectValue placeholder="Select Reciter" />
                </SelectTrigger>
                <SelectContent>
                  {reciters.map((reciter) => (
                    <SelectItem key={reciter.id} value={reciter.id}>
                      {reciter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             {/* Font Size Adjustment */}
            <div className="space-y-2">
              <Label htmlFor="font-size-slider">Font Size ({fontSize}px)</Label>
               <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={decreaseFontSize} disabled={fontSize <= 10}>
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
                   />
                   <Button variant="outline" size="icon" onClick={increaseFontSize} disabled={fontSize >= 48}>
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
