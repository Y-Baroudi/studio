
'use client';

import type { ChangeEvent, SyntheticEvent } from 'react';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Reciter, QuranMeta } from '@/services/alquran-cloud';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Settings, Minus, Plus, BookCopy, BookOpenCheck, Gauge, Timer } from 'lucide-react'; // Added Gauge, Timer
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ThemeToggle } from '@/components/theme-toggle';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings'; // Import mappings
import { formatTime } from '@/lib/utils'; // Import time formatting utility

const MAX_VERSE_NUMBER_DEFAULT = 6236; // Default total verses
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

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
  onVerseInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onVerseInputBlur: (e: ChangeEvent<HTMLInputElement>) => void;
  onVerseSliderChange: (value: number[]) => void;
  onJuzChange: (juz: number) => void;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  quranMeta: QuranMeta | null;
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
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false); // Track seeking state

  const MAX_VERSE_NUMBER = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? MAX_VERSE_NUMBER_DEFAULT;

  // --- Play/Pause & Repeat Logic ---
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
        let errorMsg = "Could not play audio.";
        if (audioError) {
          errorMsg = `Audio Error Code ${audioError.code}: ${audioError.message || 'Could not load audio.'}`;
        }
        setPlaybackError(errorMsg);
        setIsPlaying(false);
        setIsAudioLoading(false);
      });
    }
  }, [isPlaying, isLoading, audioUrl, isAudioLoading]);

  const toggleRepeat = () => {
    const newRepeatState = !isRepeating;
    setIsRepeating(newRepeatState);
    if (audioRef.current) { audioRef.current.loop = newRepeatState; }
  };

  // --- Volume & Mute Logic ---
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0); // Mute if volume is 0
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      audioRef.current.muted = newMuteState;
      // If unmuting and volume was 0, set to a default (e.g., 0.5)
      if (!newMuteState && volume === 0) {
        handleVolumeChange([0.5]);
      } else if (newMuteState) {
        // Store current volume before muting if needed, or just rely on slider
      }
    }
  };

  // --- Playback Speed Logic ---
  const handlePlaybackSpeedChange = (speed: string) => {
    const newSpeed = parseFloat(speed);
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // --- Progress & Seeking Logic ---
   const handleTimeUpdate = (event: SyntheticEvent<HTMLAudioElement>) => {
     if (!isSeeking && !isLoading && !isAudioLoading) { // Only update if not currently seeking or loading
        setCurrentTime(event.currentTarget.currentTime);
     }
   };

   const handleLoadedMetadata = (event: SyntheticEvent<HTMLAudioElement>) => {
       const targetDuration = event.currentTarget.duration;
       if (!isNaN(targetDuration)) {
         setDuration(targetDuration);
       } else {
         // Handle cases where duration might be Infinity or NaN initially
         console.warn("Received invalid duration:", targetDuration);
         setDuration(0); // Reset or handle appropriately
       }
       setCurrentTime(0); // Reset time on new load
   };

   const handleProgressSliderChange = (value: number[]) => {
      const seekTime = value[0];
      setCurrentTime(seekTime); // Update visual state immediately
      // Seeking handled in onSeekCommit/PointerUp
   };

   const handleSeekCommit = (value: number[]) => {
       const seekTime = value[0];
       if (audioRef.current) {
           audioRef.current.currentTime = seekTime;
       }
       setIsSeeking(false); // End seeking state
   };

   const handlePointerDown = () => {
       setIsSeeking(true); // Start seeking state
   };


  // --- Audio Event Listeners ---
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handlePlay = () => { setIsPlaying(true); setIsAudioLoading(false); setPlaybackError(null); }
    const handlePause = () => { setIsPlaying(false); setIsAudioLoading(false); }
    const handleEnded = () => {
        setIsPlaying(false);
        setIsAudioLoading(false);
        if (!isRepeating && !audioElement.loop && audioElement.currentTime >= duration - 0.1 && duration > 0) { // Ensure ended near duration
            setCurrentTime(0); // Reset time visually
            onNextVerse();
        } else if (isRepeating) {
           // If repeating, reset time and play again
           setCurrentTime(0);
           audioElement.currentTime = 0;
           audioElement.play().catch(err => console.error("Repeat play error:", err));
        }
    };
    const handleError = (e: Event) => {
      const audioError = audioElement.error;
      console.error("Audio Error Event:", e); // Log the event object itself
      console.error("Audio Element Error:", audioError); // Log the error property
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
      } else {
        // If audioElement.error is null, check the event target if possible
        if (e.target instanceof HTMLMediaElement && e.target.error) {
            errorMsg = `Media Element Error (Code: ${e.target.error.code}): ${e.target.error.message}`;
        } else {
            errorMsg += ` No specific error code available. Event type: ${e.type}.`;
        }
      }
      setPlaybackError(errorMsg);
      setIsPlaying(false);
      setIsAudioLoading(false);
      setCurrentTime(0);
      setDuration(0);
    };
    const handleWaiting = () => setIsAudioLoading(true);
    const handleCanPlay = () => setIsAudioLoading(false);


    // Add event listeners
    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('error', handleError);
    audioElement.addEventListener('waiting', handleWaiting);
    audioElement.addEventListener('canplay', handleCanPlay);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Set initial playback rate and volume
    audioElement.playbackRate = playbackSpeed;
    audioElement.volume = volume;
    audioElement.muted = isMuted;
    audioElement.loop = isRepeating;


    // Cleanup
    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
      audioElement.removeEventListener('waiting', handleWaiting);
      audioElement.removeEventListener('canplay', handleCanPlay);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [isRepeating, onNextVerse, playbackSpeed, volume, isMuted, duration, isSeeking, isLoading, isAudioLoading]); // Added dependencies

  // --- Handle Audio Source Change ---
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && audioUrl) {
        if (!audioElement.paused) { audioElement.pause(); }
        audioElement.src = audioUrl;
        audioElement.load(); // Important: load the new source
        setPlaybackError(null);
        setIsPlaying(false);
        setIsAudioLoading(true);
        setCurrentTime(0); // Reset time for new source
        setDuration(0); // Reset duration for new source
        audioElement.playbackRate = playbackSpeed; // Ensure speed is set on new source
        audioElement.volume = volume; // Ensure volume is set
        audioElement.muted = isMuted; // Ensure mute state is set
        audioElement.loop = isRepeating; // Ensure loop state is set
    } else if (audioElement) {
        if (!audioElement.paused) { audioElement.pause(); }
        audioElement.removeAttribute('src');
        audioElement.load(); // Load with no source
        setIsPlaying(false);
        setPlaybackError(audioUrl === null ? "Audio not available for this reciter/verse." : null);
        setIsAudioLoading(false);
        setCurrentTime(0);
        setDuration(0);
    }
}, [audioUrl, playbackSpeed, volume, isMuted, isRepeating]); // Dependencies controlling audio state


  // --- Font Size Controls ---
  const increaseFontSize = () => onFontSizeChange([Math.min(fontSize + 2, 48)]);
  const decreaseFontSize = () => onFontSizeChange([Math.max(fontSize - 2, 10)]);

  const controlsDisabled = isLoading || isAudioLoading;
  const audioActionDisabled = controlsDisabled || !audioUrl || !!playbackError;

  // --- Jump To Handlers ---
   const handleJuzSelect = (value: string) => {
       const juzNumber = parseInt(value, 10);
       if (!isNaN(juzNumber)) { onJuzChange(juzNumber); }
   };

   const handlePageSelect = (value: string) => {
       const pageNumber = parseInt(value, 10);
       if (!isNaN(pageNumber)) { onPageChange(pageNumber); }
   };


  return (
    <Card className="shadow-md rounded-lg overflow-hidden sticky bottom-4 backdrop-blur-sm bg-background/80 dark:bg-background/70 border">
      <CardContent className="p-4 flex flex-col gap-4">
        <audio ref={audioRef} preload="metadata" />

        {/* Top Row: Verse Navigation (Slider & Input) */}
        <div className="flex items-center gap-4 w-full">
            {/* Prev Button */}
            <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onPreviousVerse} disabled={isLoading || verseNumber <= 1} aria-label="Previous Verse">
                    <SkipBack className="h-5 w-5" />
                </Button>
            </TooltipTrigger> <TooltipContent><p>Previous Verse</p></TooltipContent> </Tooltip> </TooltipProvider>
            {/* Verse Slider */}
            <Slider value={[verseNumber]} onValueChange={onVerseSliderChange} min={1} max={MAX_VERSE_NUMBER} step={1} className="flex-1" aria-label="Navigate Verses" disabled={isLoading} />
            {/* Verse Input */}
            <Input type="number" min="1" max={MAX_VERSE_NUMBER} value={verseNumber} onChange={onVerseInputChange} onBlur={onVerseInputBlur} className="w-20 text-center h-10 border-input rounded-md text-sm" aria-label="Current Verse Number" disabled={isLoading}/>
            {/* Next Button */}
             <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onNextVerse} disabled={isLoading || verseNumber >= MAX_VERSE_NUMBER} aria-label="Next Verse">
                    <SkipForward className="h-5 w-5" />
                </Button>
            </TooltipTrigger> <TooltipContent><p>Next Verse</p></TooltipContent> </Tooltip> </TooltipProvider>
        </div>

         {/* Middle Row: Audio Progress */}
         <div className="flex items-center gap-2 w-full">
             <span className="text-xs text-muted-foreground w-10 text-center">{formatTime(currentTime)}</span>
             <Slider
                 value={[currentTime]}
                 onValueChange={handleProgressSliderChange}
                 onPointerDown={handlePointerDown} // Use pointer down to detect start of seek
                 onValueCommit={handleSeekCommit} // Use value commit for final seek
                 min={0}
                 max={duration > 0 ? duration : 1} // Ensure max is at least 1 to prevent issues
                 step={0.1} // Finer step for seeking
                 className="flex-1"
                 aria-label="Audio Progress"
                 disabled={audioActionDisabled || duration <= 0}
             />
             <span className="text-xs text-muted-foreground w-10 text-center">{formatTime(duration)}</span>
         </div>

        {/* Bottom Row: Playback, Jumps, Settings */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">

            {/* Playback Controls (Left Group) */}
            <div className="flex items-center gap-2">
                {/* Repeat Button */}
                <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" onClick={toggleRepeat} className={isRepeating ? 'text-primary' : ''} aria-pressed={isRepeating} aria-label="Repeat Verse" disabled={audioActionDisabled}>
                         <Repeat className="h-5 w-5" />
                     </Button>
                 </TooltipTrigger> <TooltipContent><p>{isRepeating ? 'Disable Repeat' : 'Repeat Verse'}</p></TooltipContent> </Tooltip> </TooltipProvider>
                {/* Play/Pause Button */}
                <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                    <Button variant="default" size="icon" onClick={togglePlayPause} disabled={audioActionDisabled} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-12 h-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 relative">
                        {isAudioLoading && ( /* Loading Spinner */
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                                <svg className="animate-spin h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg>
                            </div>
                        )}
                        {!isAudioLoading && (isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />)}
                    </Button>
                 </TooltipTrigger> <TooltipContent><p>{isPlaying ? 'Pause' : 'Play'}</p></TooltipContent> </Tooltip> </TooltipProvider>
                 {/* Mute Button */}
                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleMute} aria-pressed={isMuted} aria-label={isMuted ? 'Unmute' : 'Mute'} disabled={audioActionDisabled}>
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                 </TooltipTrigger> <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent> </Tooltip> </TooltipProvider>
                 {/* Volume Slider */}
                 <Slider
                    value={[volume]}
                    onValueChange={handleVolumeChange}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-20 hidden sm:flex" // Hide on small screens if needed
                    aria-label="Volume"
                    disabled={audioActionDisabled}
                 />
            </div>

            {/* Jump To Controls (Center Group) */}
             <div className="flex items-center gap-2">
                 {/* Jump to Juz */}
                 <Select onValueChange={handleJuzSelect} disabled={isLoading}>
                    <SelectTrigger className="w-[120px] h-10 text-sm" aria-label="Jump to Juz"> <BookCopy className="mr-1 h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Jump to Juz" /> </SelectTrigger>
                    <SelectContent> <SelectGroup> <SelectLabel>Juz</SelectLabel> {Object.entries(JUZ_STARTS).map(([juz, startVerse]) => ( <SelectItem key={juz} value={juz}> Juz {juz} (Verse {startVerse}) </SelectItem> ))} </SelectGroup> </SelectContent>
                 </Select>
                  {/* Jump to Page */}
                  <Select onValueChange={handlePageSelect} disabled={isLoading}>
                    <SelectTrigger className="w-[130px] h-10 text-sm" aria-label="Jump to Page"> <BookOpenCheck className="mr-1 h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Jump to Page" /> </SelectTrigger>
                    <SelectContent> <SelectGroup> <SelectLabel>Page (Mushaf)</SelectLabel> {Object.entries(PAGE_STARTS).map(([page, startVerse]) => ( <SelectItem key={page} value={page}> Page {page} (Verse {startVerse}) </SelectItem> ))} </SelectGroup> </SelectContent>
                  </Select>
             </div>


            {/* Settings Popover (Right Group) */}
            <Popover>
            <PopoverTrigger asChild>
            <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Settings" disabled={isLoading}> <Settings className="h-5 w-5" /> </Button>
            </TooltipTrigger> <TooltipContent><p>Settings</p></TooltipContent> </Tooltip> </TooltipProvider>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 space-y-4" align="end">
                {/* Reciter Selection */}
                <div className="space-y-2">
                <Label htmlFor="reciter-select">Reciter</Label>
                <Select value={selectedReciter} onValueChange={onReciterChange} disabled={reciters.length === 0 || isLoading}>
                    <SelectTrigger id="reciter-select" className="w-full"> <SelectValue placeholder="Select Reciter" /> </SelectTrigger>
                    <SelectContent> {reciters.map((reciter) => ( <SelectItem key={reciter.id} value={reciter.id}> {reciter.name} ({reciter.language.toUpperCase()}) </SelectItem> ))} </SelectContent>
                </Select>
                </div>

                {/* Playback Speed */}
                <div className="space-y-2">
                <Label htmlFor="speed-select">Playback Speed</Label>
                    <Select value={playbackSpeed.toString()} onValueChange={handlePlaybackSpeedChange} disabled={audioActionDisabled}>
                         <SelectTrigger id="speed-select" className="w-full">
                             <Gauge className="mr-2 h-4 w-4 text-muted-foreground" /> {/* Icon */}
                             <SelectValue placeholder="Speed" />
                         </SelectTrigger>
                         <SelectContent>
                             <SelectGroup>
                                 <SelectLabel>Speed</SelectLabel>
                                 {PLAYBACK_SPEEDS.map((speed) => (
                                    <SelectItem key={speed} value={speed.toString()}> {speed}x </SelectItem>
                                 ))}
                             </SelectGroup>
                         </SelectContent>
                    </Select>
                </div>

                {/* Font Size Adjustment */}
                <div className="space-y-2">
                <Label htmlFor="font-size-slider">Font Size ({fontSize}px)</Label>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={decreaseFontSize} disabled={fontSize <= 10 || isLoading}> <Minus className="h-4 w-4" /> </Button>
                    <Slider id="font-size-slider" min={10} max={48} step={2} value={[fontSize]} onValueChange={onFontSizeChange} className="flex-1" aria-label="Adjust font size" disabled={isLoading} />
                    <Button variant="outline" size="icon" onClick={increaseFontSize} disabled={fontSize >= 48 || isLoading}> <Plus className="h-4 w-4" /> </Button>
                </div>
                </div>

                 {/* Volume Slider (Inside Popover for smaller screens) */}
                 <div className="space-y-2 sm:hidden">
                    <Label htmlFor="volume-slider-popover">Volume</Label>
                    <Slider
                        id="volume-slider-popover"
                        value={[volume]}
                        onValueChange={handleVolumeChange}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                        aria-label="Volume"
                        disabled={audioActionDisabled}
                     />
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

/* Removed duplicate formatTime function */

    