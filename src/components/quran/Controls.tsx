
'use client';

import type { ChangeEvent } from 'react';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Reciter, QuranMeta } from '@/services/alquran-cloud';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Settings, Minus, Plus, BookCopy, BookOpenCheck } from 'lucide-react'; // Added BookCopy, BookOpenCheck
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ThemeToggle } from '@/components/theme-toggle';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings'; // Import mappings

const MAX_VERSE_NUMBER_DEFAULT = 6236; // Default total verses

interface ControlsProps {
  verseNumber: number;
  audioUrl: string | null | undefined;
  reciters: Reciter[];
  selectedReciter: string;
  fontSize: number;
  onNextVerse: () => void;
  onPreviousVerse: () => void;
  onReciterChange: (reciterId: string) => void;
  onFontSizeChange: (value: number[]) => void;
  onVerseInputChange: (e: ChangeEvent<HTMLInputElement>) => void; // Kept for direct input editing
  onVerseInputBlur: (e: ChangeEvent<HTMLInputElement>) => void; // Kept for direct input validation
  onVerseSliderChange: (value: number[]) => void; // Handler for slider changes
  onJuzChange: (juz: number) => void; // Handler for Juz selection
  onPageChange: (page: number) => void; // Handler for Page selection
  isLoading: boolean;
  quranMeta: QuranMeta | null; // Pass meta for max verse calculation
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
  onVerseSliderChange,
  onJuzChange,
  onPageChange,
  isLoading,
  quranMeta,
}: ControlsProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const MAX_VERSE_NUMBER = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? MAX_VERSE_NUMBER_DEFAULT;

  // Play/Pause functionality (no changes needed here)
  const togglePlayPause = useCallback(() => {
     if (isLoading || !audioRef.current || !audioUrl || isAudioLoading) return;
    setPlaybackError(null);
    if (isPlaying) {
      audioRef.current.pause();
    } else {
       setIsAudioLoading(true);
       audioRef.current.play().catch(err => {
         console.error("Audio playback error:", err);
         const audioError = audioRef.current?.error;
         let errorMsg = "Could not play audio. Please check the reciter or try again.";
         if (audioError) {
           errorMsg = `Audio Error Code ${audioError.code}: ${audioError.message || 'Could not load audio.'} URL: ${audioRef.current?.currentSrc}`;
         }
         setPlaybackError(errorMsg);
         setIsPlaying(false);
         setIsAudioLoading(false);
      });
    }
  }, [isPlaying, isLoading, audioUrl, isAudioLoading]);

  // Update state when audio play/pause events occur (no changes needed here)
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;
    const handlePlay = () => { setIsPlaying(true); setIsAudioLoading(false); setPlaybackError(null); }
    const handlePause = () => { setIsPlaying(false); setIsAudioLoading(false); }
    const handleEnded = () => { setIsPlaying(false); setIsAudioLoading(false); if (!isRepeating && !audioElement.loop) { onNextVerse(); } };
    const handleError = (e: Event) => {
       const audioError = audioElement.error;
       console.error("Audio Error Event:", e);
       console.error("Audio Element Error:", audioError);
       let errorMsg = "An error occurred during playback.";
       if (audioError) {
            switch (audioError.code) {
                case MediaError.MEDIA_ERR_ABORTED: errorMsg = "Audio playback aborted."; break;
                case MediaError.MEDIA_ERR_NETWORK: errorMsg = "A network error occurred while fetching the audio."; break;
                case MediaError.MEDIA_ERR_DECODE: errorMsg = "The audio could not be decoded."; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = "Audio source not supported or unavailable."; break;
                default: errorMsg = `An unknown audio error occurred (Code: ${audioError.code}).`;
            }
            errorMsg += ` Check console for details. URL: ${audioElement.currentSrc}`;
       }
       setPlaybackError(errorMsg);
       setIsPlaying(false);
       setIsAudioLoading(false);
    };
     const handleWaiting = () => setIsAudioLoading(true);
     const handleCanPlay = () => setIsAudioLoading(false);

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('error', handleError);
     audioElement.addEventListener('waiting', handleWaiting);
     audioElement.addEventListener('canplay', handleCanPlay);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
      audioElement.removeEventListener('waiting', handleWaiting);
      audioElement.removeEventListener('canplay', handleCanPlay);
    };
  }, [isRepeating, onNextVerse]);

  // Handle audio source change (no changes needed here)
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && audioUrl) {
      const wasPlaying = !audioElement.paused && !audioElement.ended && audioElement.readyState > 0;
      if (!audioElement.paused) { audioElement.pause(); }
      audioElement.src = audioUrl;
      audioElement.load();
      setPlaybackError(null);
      setIsPlaying(false);
      setIsAudioLoading(true);
    } else if (audioElement) {
      if (!audioElement.paused) { audioElement.pause(); }
      audioElement.removeAttribute('src');
      audioElement.load();
      setIsPlaying(false);
      setPlaybackError(audioUrl === null ? "Audio not available for this reciter/verse." : null);
      setIsAudioLoading(false);
    }
  }, [audioUrl, isLoading]);

  // Toggle repeat (no changes needed here)
  const toggleRepeat = () => {
    const newRepeatState = !isRepeating;
    setIsRepeating(newRepeatState);
    if (audioRef.current) { audioRef.current.loop = newRepeatState; }
  };

  // Toggle mute (no changes needed here)
  const toggleMute = () => {
     if (audioRef.current) {
       const newMuteState = !isMuted;
       audioRef.current.muted = newMuteState;
       setIsMuted(newMuteState);
     }
   };

   // Font size controls (no changes needed here)
   const increaseFontSize = () => onFontSizeChange([Math.min(fontSize + 2, 48)]);
   const decreaseFontSize = () => onFontSizeChange([Math.max(fontSize - 2, 10)]);

   const controlsDisabled = isLoading || isAudioLoading;
   const audioActionDisabled = controlsDisabled || !audioUrl || !!playbackError;

   const handleJuzSelect = (value: string) => {
       const juzNumber = parseInt(value, 10);
       if (!isNaN(juzNumber)) {
           onJuzChange(juzNumber);
       }
   };

   const handlePageSelect = (value: string) => {
       const pageNumber = parseInt(value, 10);
       if (!isNaN(pageNumber)) {
           onPageChange(pageNumber);
       }
   };


  return (
    <Card className="shadow-md rounded-lg overflow-hidden sticky bottom-4 backdrop-blur-sm bg-background/80 dark:bg-background/70 border">
      <CardContent className="p-4 flex flex-col gap-4"> {/* Changed flex direction to column */}
        <audio ref={audioRef} preload="metadata" />

        {/* Top Row: Verse Navigation (Slider & Input) */}
        <div className="flex items-center gap-4 w-full">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                        variant="outline"
                        size="icon"
                        onClick={onPreviousVerse}
                        disabled={isLoading || verseNumber <= 1}
                        aria-label="Previous Verse"
                        >
                        <SkipBack className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Previous Verse</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Verse Slider */}
            <Slider
                value={[verseNumber]}
                onValueChange={onVerseSliderChange} // Use the new handler
                min={1}
                max={MAX_VERSE_NUMBER}
                step={1}
                className="flex-1"
                aria-label="Navigate Verses"
                disabled={isLoading}
            />

            {/* Verse Number Input (Styled) */}
            <Input
                type="number"
                min="1"
                max={MAX_VERSE_NUMBER}
                value={verseNumber}
                onChange={onVerseInputChange}
                onBlur={onVerseInputBlur}
                className="w-20 text-center h-10 border-input rounded-md text-sm" // More elegant styling
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
                        disabled={isLoading || verseNumber >= MAX_VERSE_NUMBER}
                        aria-label="Next Verse"
                        >
                        <SkipForward className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Next Verse</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>

        {/* Bottom Row: Playback, Jumps, Settings */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">

            {/* Playback Controls */}
            <div className="flex items-center gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={toggleRepeat} className={isRepeating ? 'text-primary' : ''} aria-pressed={isRepeating} aria-label="Repeat Verse" disabled={audioActionDisabled}>
                            <Repeat className="h-5 w-5" />
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{isRepeating ? 'Disable Repeat' : 'Repeat Verse'}</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="default" size="icon" onClick={togglePlayPause} disabled={audioActionDisabled} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-12 h-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 relative">
                                {isAudioLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                                    <svg className="animate-spin h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                                )}
                                {!isAudioLoading && (isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />)}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{isPlaying ? 'Pause' : 'Play'}</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={toggleMute} aria-pressed={isMuted} aria-label={isMuted ? 'Unmute' : 'Mute'} disabled={audioActionDisabled}>
                            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Jump To Controls */}
             <div className="flex items-center gap-2">
                 {/* Jump to Juz */}
                 <Select onValueChange={handleJuzSelect} disabled={isLoading}>
                    <SelectTrigger className="w-[120px] h-10 text-sm" aria-label="Jump to Juz">
                         <BookCopy className="mr-1 h-4 w-4 text-muted-foreground" /> {/* Icon */}
                        <SelectValue placeholder="Jump to Juz" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Juz</SelectLabel>
                            {Object.entries(JUZ_STARTS).map(([juz, startVerse]) => (
                                <SelectItem key={juz} value={juz}>
                                    Juz {juz} (Verse {startVerse})
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                 </Select>

                  {/* Jump to Page */}
                  <Select onValueChange={handlePageSelect} disabled={isLoading}>
                    <SelectTrigger className="w-[130px] h-10 text-sm" aria-label="Jump to Page">
                         <BookOpenCheck className="mr-1 h-4 w-4 text-muted-foreground" /> {/* Icon */}
                        <SelectValue placeholder="Jump to Page" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                             <SelectLabel>Page (Mushaf)</SelectLabel>
                             {Object.entries(PAGE_STARTS).map(([page, startVerse]) => (
                                <SelectItem key={page} value={page}>
                                    Page {page} (Verse {startVerse})
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                  </Select>
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
                    <TooltipContent><p>Settings</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 space-y-4" align="end">
                {/* Reciter Selection */}
                <div className="space-y-2">
                <Label htmlFor="reciter-select">Reciter</Label>
                <Select value={selectedReciter} onValueChange={onReciterChange} disabled={reciters.length === 0 || isLoading}>
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
                    <Slider id="font-size-slider" min={10} max={48} step={2} value={[fontSize]} onValueChange={onFontSizeChange} className="flex-1" aria-label="Adjust font size" disabled={isLoading} />
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
        </div>

        {/* Error Message */}
        {playbackError && (
            <div className="px-4 pb-2 text-center text-xs text-destructive">
            {playbackError}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
