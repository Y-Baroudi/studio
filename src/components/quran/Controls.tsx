'use client';

import type { ChangeEvent, SyntheticEvent } from 'react';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Reciter, QuranMeta } from '@/services/alquran-cloud';
import { Button } from '@/components/ui/button';
// import { Slider } from '@/components/ui/slider'; // Removed Slider import
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Import Popover
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'; // For reciter select alternative
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Import RadioGroup for Popover
import { Separator } from '@/components/ui/separator'; // Import Separator

import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Gauge, BookCopy, BookOpenCheck, Loader2, ChevronDown, Settings, MicVocal, ListMusic, CheckIcon } from 'lucide-react'; // Added icons
import { formatTime } from '@/lib/utils';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { cn } from '@/lib/utils'; // Import cn

const MAX_VERSE_NUMBER_DEFAULT = 6236;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];
type RepeatMode = 'none' | 'verse' | 'selection' | 'surah'; // Define repeat modes
type RepeatCount = 1 | 3 | 5 | 10 | typeof Infinity; // Use typeof Infinity

// List of identifiers for popular reciters to show first
const POPULAR_RECITERS = [
  'ar.alafasy',             // Mishary Rashid Alafasy
  'ar.abdulsamad',          // Abdul Samad (Murattal)
  'ar.hudhaify',            // Ali Al-Hudhaify
  'ar.saoodshuraym',        // Saud Ash-Shuraim
  'ar.abdurrahmaansudais',  // Abdul Rahman Al-Sudais
  'ar.mahermuaiqly',        // Maher Al Muaqli
];


interface ControlsProps {
  verseNumber: number; // Currently focused verse number
  audioUrl: string | null | undefined; // Audio URL for the *focused* verse
  reciters: Reciter[];
  selectedReciter: string;
  onNextVerse: () => void; // Handler to advance focus to the next verse
  onPreviousVerse: () => void; // Handler to move focus to the previous verse
  onReciterChange: (reciterId: string) => void;
  onVerseInputChange: (e: ChangeEvent<HTMLInputElement>) => void; // Keep for direct input sync
  onVerseInputBlur: (e: ChangeEvent<HTMLInputElement>) => void;
  onVerseSliderChange: (value: number[]) => void; // Update visual slider value
  onVerseSliderCommit: (value: number[]) => void; // Trigger navigation on release
  onJuzChange: (juz: number) => void;
  onPageChange: (page: number) => void;
  isLoading: boolean; // General loading state from parent (metadata, verses)
  isLoadingReciters: boolean; // Specific loading state for reciters
  quranMeta: QuranMeta | null;
  // Audio Event Handlers for parent synchronization
  onPlay: () => void; // Notify parent when playback starts
  onPause: () => void; // Notify parent when playback pauses
  onEnded: () => void; // Notify parent when playback ends naturally
  onError: (errorMessage: string) => void; // Notify parent of playback errors
  updatePlayingVerse: (verseNum: number | null) => void; // Allow controls to tell parent which verse is playing/stopped
  // --- Removed onOpenSettings prop ---
}

export function Controls({
  verseNumber,
  audioUrl,
  reciters,
  selectedReciter,
  onNextVerse,
  onPreviousVerse,
  onReciterChange,
  onVerseInputChange,
  onVerseInputBlur,
  onVerseSliderCommit, // Use commit handler for navigation
  onVerseSliderChange, // Use change handler for visual update
  onJuzChange,
  onPageChange,
  isLoading, // Parent loading state
  isLoadingReciters, // Reciter loading state
  quranMeta,
  onPlay,
  onPause,
  onEnded,
  onError,
  updatePlayingVerse,
}: ControlsProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Keep mute state
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false); // Specific to audio element loading state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // const [isSeeking, setIsSeeking] = useState(false); // Removed, no slider
  const [localVerseNumber, setLocalVerseNumber] = useState<number>(verseNumber); // Local state for input/slider value

  // --- New State for Repeat Logic ---
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [repeatCount, setRepeatCount] = useState<RepeatCount>(1); // Default count, only relevant for some modes
  const [showRepeatPopover, setShowRepeatPopover] = useState(false);

   // Sync local verse number with prop
   useEffect(() => {
     setLocalVerseNumber(verseNumber);
   }, [verseNumber]);


  const MAX_VERSE_NUMBER = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? MAX_VERSE_NUMBER_DEFAULT;

  // --- Play/Pause Logic ---
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return; // Guard against null ref
    setPlaybackError(null); // Clear previous errors

    if (isLoading || isAudioLoading || !audioUrl) {
        console.log("Play/Pause blocked: isLoading", isLoading, "isAudioLoading", isAudioLoading, "audioUrl", !!audioUrl);
        if (!audioUrl && !isLoading && !isAudioLoading) {
            setPlaybackError("Audio not available for this verse or reciter.");
            onError("Audio not available for this verse or reciter.");
        }
        return;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setIsAudioLoading(true);
      audioRef.current.play().catch(err => {
        console.error("Audio playback error on play():", err);
        const audioError = audioRef.current?.error;
        let errorMsg = "Could not play audio.";
        if (audioError) {
           errorMsg = `Audio Error Code ${audioError.code}: ${audioError.message || 'Could not load audio.'}`;
           if (audioError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || audioError.code === MediaError.MEDIA_ERR_NETWORK) {
               errorMsg += ` Please check the selected reciter or your network connection. URL: ${audioRef.current?.currentSrc}`;
           }
        } else if (err instanceof Error) {
            errorMsg = `Playback initiation failed: ${err.message}`;
        }
        setPlaybackError(errorMsg);
        setIsPlaying(false);
        setIsAudioLoading(false);
        onError(errorMsg);
        updatePlayingVerse(null);
      });
    }
  }, [isPlaying, isLoading, audioUrl, isAudioLoading, onError, updatePlayingVerse]);

  // --- Repeat Logic ---
  const handleRepeatModeChange = (newMode: RepeatMode) => {
    setRepeatMode(newMode);
    // Update audio element loop property based on simple verse repeat
    if (audioRef.current) {
        audioRef.current.loop = newMode === 'verse' && repeatCount === Infinity; // Only native loop for infinite verse repeat
    }
    // Close the popover after selection (optional)
    // setShowRepeatPopover(false);
    // Add logic here to handle 'selection' and 'surah' repeat modes if needed
    console.log("Repeat mode set to:", newMode);
  };

  const handleRepeatCountChange = (newCountString: string) => {
    const newCount = newCountString === 'Infinity' ? Infinity : parseInt(newCountString, 10) as RepeatCount;
    setRepeatCount(newCount);
     if (audioRef.current) {
        audioRef.current.loop = repeatMode === 'verse' && newCount === Infinity; // Update native loop status
    }
    console.log("Repeat count set to:", newCount);
     // Optionally close popover, or keep it open for mode change
     // setShowRepeatPopover(false);
  };


  // --- Volume & Mute Logic (simplified for mute only in controls) ---
  const toggleMute = () => {
    if (audioRef.current) {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      audioRef.current.muted = newMuteState;
      // Volume slider is now in the main settings panel
    }
  };


  // --- Progress & Time Update Logic ---
   const handleTimeUpdate = (event: SyntheticEvent<HTMLAudioElement>) => {
     // Update time display only, no seeking involved here
     if (!isLoading && !isAudioLoading && isFinite(event.currentTarget.currentTime)) {
        setCurrentTime(event.currentTarget.currentTime);
     }
   };

   const handleLoadedMetadata = (event: SyntheticEvent<HTMLAudioElement>) => {
       const targetDuration = event.currentTarget.duration;
       if (!isNaN(targetDuration) && isFinite(targetDuration)) {
         setDuration(targetDuration);
       } else {
         console.warn("Received invalid or infinite duration:", targetDuration, "Resetting to 0.");
         setDuration(0);
       }
       setCurrentTime(0); // Reset time on new metadata
       setIsAudioLoading(false); // Metadata loaded, no longer loading
       setPlaybackError(null); // Clear errors on successful load
   };

   // --- Removed Seeking Logic ---
   // handleSeekCommit, handlePointerDown, handleProgressSliderChange are removed

  // --- Audio Event Listeners ---
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    // Define handlers within useEffect to capture current state/props
    const handlePlay = () => { /* console.log("Audio 'play'..."); */ setIsPlaying(true); setIsAudioLoading(false); setPlaybackError(null); onPlay(); updatePlayingVerse(verseNumber); };
    const handlePause = () => { /* console.log("Audio 'pause'..."); */ setIsPlaying(false); onPause(); updatePlayingVerse(null); };
    const handleEnded = () => {
        /* console.log("Audio 'ended'..."); */
        setIsPlaying(false);
        setIsAudioLoading(false);
        updatePlayingVerse(null);
        onEnded(); // Notify parent first

        const isSimpleRepeat = repeatMode === 'verse' && repeatCount !== Infinity;
        let currentRepeatIteration = Number(audioElement.dataset.repeatIteration || '0');

        if (repeatMode === 'verse' && repeatCount === Infinity) {
            // Native loop handled by audio element, just reset time visually
             setCurrentTime(0);
            // No need to call play() again, native loop handles it
        } else if (isSimpleRepeat && currentRepeatIteration < repeatCount -1) {
            currentRepeatIteration++;
            audioElement.dataset.repeatIteration = String(currentRepeatIteration);
            console.log(`Repeating verse ${verseNumber}, iteration ${currentRepeatIteration + 1}/${repeatCount}`);
            audioElement.currentTime = 0;
            audioElement.play().catch(err => {
                console.error("Repeat play error:", err);
                onError(`Failed to repeat audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
            });
             // 'play' event will update state
        } else {
             // Reset repeat count for next time
            audioElement.dataset.repeatIteration = '0';
            // Not repeating or finished repeats, move to next verse focus
            if (repeatMode !== 'none' && repeatMode !== 'verse' /* TODO: Add selection/surah checks */) {
                 console.log(`Repeat mode ${repeatMode} finished or unsupported, stopping.`);
                 // Handle end of selection/surah logic if implemented
            } else {
                console.log("Audio ended naturally or finished repeats, moving to next verse focus.");
                setCurrentTime(0); // Reset time visually
                onNextVerse(); // Trigger parent's next verse *focus* logic
            }
        }
    };
     const handleError = (e: Event) => {
        const target = e.target as HTMLAudioElement;
        const audioError = target.error;
        console.error("Audio Error Event:", e);
        console.error("Audio Element Error Object:", audioError);

        let errorMsg = "An error occurred during playback.";
        if (audioError) {
            switch (audioError.code) {
            case MediaError.MEDIA_ERR_ABORTED: errorMsg = "Audio playback was aborted."; break;
            case MediaError.MEDIA_ERR_NETWORK: errorMsg = "Network error: Could not fetch audio."; break;
            case MediaError.MEDIA_ERR_DECODE: errorMsg = "Audio decoding error."; break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = "Audio format not supported or source unavailable."; break;
            default: errorMsg = `Unknown audio error (Code: ${audioError.code}).`;
            }
             errorMsg += ` URL: ${target.currentSrc || 'N/A'}`;
        } else {
             errorMsg += ` No specific error code. Event type: ${e.type}.`;
        }

        console.error("Detailed Audio Error Message:", errorMsg); // Log the detailed message

        setPlaybackError(errorMsg); // Show error to user
        setIsPlaying(false);
        setIsAudioLoading(false); // Stop loading indicator on error
        setCurrentTime(0); // Reset time
        setDuration(0); // Reset duration as it might be invalid
        onError(errorMsg); // Notify parent
        updatePlayingVerse(null); // Tell parent nothing is playing
    };
     const handleWaiting = () => { /* console.log("Audio 'waiting'..."); */ setIsAudioLoading(true); } // Removed isSeeking check
    const handleCanPlay = () => { /* console.log("Audio 'canplay'..."); */ setIsAudioLoading(false); if (playbackError?.includes("Network error")) { setPlaybackError(null); } }
     const handleCanPlayThrough = () => { /* console.log("Audio 'canplaythrough'..."); */ setIsAudioLoading(false); }
      const handleSuspend = () => { /* console.log("Audio 'suspend'..."); */ }
     const handleStalled = () => { /* console.log("Audio 'stalled'..."); */ setIsAudioLoading(true); }


    // Add listeners
    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('error', handleError);
    audioElement.addEventListener('waiting', handleWaiting);
    audioElement.addEventListener('canplay', handleCanPlay);
     audioElement.addEventListener('canplaythrough', handleCanPlayThrough);
     audioElement.addEventListener('suspend', handleSuspend);
     audioElement.addEventListener('stalled', handleStalled);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Set initial properties
    audioElement.muted = isMuted;
    audioElement.loop = repeatMode === 'verse' && repeatCount === Infinity; // Only native loop for infinite verse repeat


    // Cleanup function
    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
      audioElement.removeEventListener('waiting', handleWaiting);
      audioElement.removeEventListener('canplay', handleCanPlay);
      audioElement.removeEventListener('canplaythrough', handleCanPlayThrough);
      audioElement.removeEventListener('suspend', handleSuspend);
      audioElement.removeEventListener('stalled', handleStalled);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  // Ensure all relevant state and props are included
  }, [
      verseNumber, repeatMode, repeatCount, isMuted, duration, // Removed isSeeking
      onPlay, onPause, onEnded, onError, updatePlayingVerse, onNextVerse,
      isAudioLoading, playbackError
    ]);

  // --- Handle Audio Source Change ---
   useEffect(() => {
       const audioElement = audioRef.current;
       if (!audioElement) return;

       const currentSrc = audioElement.currentSrc;
       const shouldUpdateSrc = audioUrl && currentSrc !== audioUrl;
       const shouldClearSrc = !audioUrl && currentSrc;

       if (shouldUpdateSrc) {
           console.log(`Updating audio source to "${audioUrl}"`);
           if (!audioElement.paused) audioElement.pause();
           setCurrentTime(0); setDuration(0); setPlaybackError(null);
           setIsPlaying(false); setIsAudioLoading(true);

           audioElement.src = audioUrl;
           audioElement.load();
           audioElement.loop = repeatMode === 'verse' && repeatCount === Infinity;
           audioElement.muted = isMuted;
           // Reset repeat count state when source changes
           audioElement.dataset.repeatIteration = '0';

       } else if (shouldClearSrc) {
           console.log(`Clearing audio source`);
           if (!audioElement.paused) audioElement.pause();
           audioElement.removeAttribute('src');
           audioElement.load();
           setCurrentTime(0); setDuration(0);
           setPlaybackError(audioUrl === null ? "Audio not available for this selection." : null);
           setIsPlaying(false); setIsAudioLoading(false);
           updatePlayingVerse(null);
       } else {
            // Source is same or was already null/undefined
            // Removed seeking check
            if (audioElement.readyState < 3 && audioUrl) setIsAudioLoading(true);
            else if (audioElement.readyState >= 3) setIsAudioLoading(false);
            if (audioUrl && playbackError) setPlaybackError(null);
       }
   }, [audioUrl, repeatMode, repeatCount, isMuted, updatePlayingVerse, playbackError]);


  // --- Input/Slider Sync for Verse Number ---
   const handleLocalVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || (/^\d+$/.test(value) && +value >= 1 && +value <= MAX_VERSE_NUMBER)) {
            setLocalVerseNumber(+value);
             onVerseInputChange(e);
        }
   };

   const handleLocalVerseSliderChange = (value: number[]) => {
       setLocalVerseNumber(value[0]);
       onVerseSliderChange(value);
   };


  // --- Combined Disabled Logic ---
  const navDisabled = isLoading;
  const audioActionDisabled = isLoading || !audioUrl || !!playbackError || isAudioLoading;

  // --- Jump To Handlers ---
   const handleJuzSelect = (value: string) => {
       const juzNumber = parseInt(value, 10);
       if (!isNaN(juzNumber)) { onJuzChange(juzNumber); }
   };

   const handlePageSelect = (value: string) => {
       const pageNumber = parseInt(value, 10);
       if (!isNaN(pageNumber)) { onPageChange(pageNumber); }
   };

   // --- Prepare Reciter Options ---
    const popularReciterOptions = reciters
      .filter(r => POPULAR_RECITERS.includes(r.id))
      .sort((a, b) => POPULAR_RECITERS.indexOf(a.id) - POPULAR_RECITERS.indexOf(b.id))
      .map(reciter => (
        <DropdownMenuRadioItem key={reciter.id} value={reciter.id}>
          {reciter.name}
        </DropdownMenuRadioItem>
      ));

    const otherReciterOptions = reciters
      .filter(r => !POPULAR_RECITERS.includes(r.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(reciter => (
        <DropdownMenuRadioItem key={reciter.id} value={reciter.id}>
          {reciter.name}
        </DropdownMenuRadioItem>
      ));

    const selectedReciterName = reciters.find(r => r.id === selectedReciter)?.name ?? "Select Reciter";

  return (
    // Adjusted Card Styling for Compact Controls
    <Card className="shadow-lg rounded-lg overflow-hidden sticky bottom-4 left-0 right-0 w-full max-w-4xl mx-auto z-10 backdrop-blur-sm bg-background/80 dark:bg-background/70 border">
      <CardContent className="p-3 flex flex-col gap-3">
        <audio ref={audioRef} preload="metadata" data-repeat-iteration="0" />

        {/* Row 1: Navigation & Verse Input */}
        <div className="flex items-center justify-between gap-3 w-full">
           {/* Jump To */}
           <div className="flex items-center gap-2 flex-wrap justify-start">
                <Select onValueChange={handleJuzSelect} disabled={navDisabled}>
                   <SelectTrigger className="w-[130px] h-9 text-sm shrink-0" aria-label="Jump to Juz"> <BookCopy className="mr-1 h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Jump to Juz" /> </SelectTrigger>
                   <SelectContent> <SelectGroup> <SelectLabel>Juz</SelectLabel> {Object.entries(JUZ_STARTS).map(([juz, startVerse]) => ( <SelectItem key={juz} value={juz}> Juz {juz} (V:{startVerse}) </SelectItem> ))} </SelectGroup> </SelectContent>
                </Select>
                <Select onValueChange={handlePageSelect} disabled={navDisabled}>
                   <SelectTrigger className="w-[130px] h-9 text-sm shrink-0" aria-label="Jump to Page"> <BookOpenCheck className="mr-1 h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Jump to Page" /> </SelectTrigger>
                   <SelectContent> <SelectGroup> <SelectLabel>Page (Mushaf)</SelectLabel> {Object.entries(PAGE_STARTS).map(([page, startVerse]) => ( <SelectItem key={page} value={page}> Page {page} (V:{startVerse}) </SelectItem> ))} </SelectGroup> </SelectContent>
                </Select>
           </div>

          {/* Verse Input */}
           <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">Verse:</span>
                <Input
                  type="number"
                  min="1"
                  max={MAX_VERSE_NUMBER}
                  value={localVerseNumber > 0 ? localVerseNumber : ''}
                  onChange={handleLocalVerseInputChange}
                  onBlur={onVerseInputBlur}
                  className="w-20 h-9 text-center border-input rounded-md text-sm shrink-0"
                  aria-label="Current Verse Number"
                  disabled={navDisabled}
                />
                <span className="text-sm text-muted-foreground">/ {MAX_VERSE_NUMBER}</span>
           </div>
        </div>


        {/* Row 2: Audio Player Controls */}
        <div className="flex flex-col gap-2 w-full bg-card/50 dark:bg-card/30 p-2 rounded-md border">

            {/* Top Part: Simplified Time Display */}
            <div className="flex items-center justify-between gap-2 w-full px-1">
                 <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(currentTime)}</span>
                 {/* Removed Slider */}
                 <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(duration)}</span>
            </div>

            {/* Bottom Part: Main Buttons & Secondary Options */}
            <div className="flex items-center justify-between gap-3 w-full">
                 {/* Left Side: Reciter Selection */}
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button
                       variant="ghost"
                       size="sm"
                       className="flex items-center gap-1.5 px-2 text-sm"
                       disabled={isLoadingReciters || reciters.length === 0 || navDisabled}
                       aria-label="Select Reciter"
                     >
                       {isLoadingReciters ? (
                         <> <Loader2 className="h-4 w-4 animate-spin" /> Loading... </>
                       ) : (
                         <> <MicVocal className="h-4 w-4 text-muted-foreground"/> {selectedReciterName} <ChevronDown className="h-4 w-4 opacity-50"/> </>
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start">
                     <DropdownMenuLabel>Select Reciter</DropdownMenuLabel>
                     <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={selectedReciter} onValueChange={onReciterChange}>
                         {isLoadingReciters && (<DropdownMenuItem disabled> <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading... </DropdownMenuItem> )}
                         {!isLoadingReciters && popularReciterOptions.length > 0 && ( <> <DropdownMenuLabel className="text-xs text-muted-foreground px-2 pt-1.5">Popular</DropdownMenuLabel> {popularReciterOptions} </> )}
                         {!isLoadingReciters && otherReciterOptions.length > 0 && ( <> <DropdownMenuSeparator/> <DropdownMenuLabel className="text-xs text-muted-foreground px-2 pt-1.5">All</DropdownMenuLabel> {otherReciterOptions} </> )}
                         {!isLoadingReciters && reciters.length === 0 && ( <DropdownMenuItem disabled>No reciters</DropdownMenuItem> )}
                       </DropdownMenuRadioGroup>
                   </DropdownMenuContent>
                 </DropdownMenu>

                 {/* Center: Main Playback Buttons */}
                 <div className="flex items-center gap-2">
                     <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onPreviousVerse} disabled={navDisabled || verseNumber <= 1} aria-label="Previous Verse">
                            <SkipBack className="h-5 w-5" />
                        </Button>
                     </TooltipTrigger> <TooltipContent><p>Previous Verse</p></TooltipContent> </Tooltip> </TooltipProvider>

                    <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                        <Button
                            variant="default"
                            size="icon"
                            onClick={togglePlayPause}
                            disabled={audioActionDisabled}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                            className="w-10 h-10 rounded-full shadow-lg bg-primary hover:bg-primary/90 relative"
                        >
                            {isAudioLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                                   <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
                                </div>
                            )}
                            {!isAudioLoading && (isPlaying ? <Pause className="h-5 w-5 text-primary-foreground" /> : <Play className="h-5 w-5 text-primary-foreground" />)}
                        </Button>
                     </TooltipTrigger> <TooltipContent><p>{isPlaying ? 'Pause' : 'Play'}</p></TooltipContent> </Tooltip> </TooltipProvider>

                    <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onNextVerse} disabled={navDisabled || verseNumber >= MAX_VERSE_NUMBER} aria-label="Next Verse">
                           <SkipForward className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger> <TooltipContent><p>Next Verse</p></TooltipContent> </Tooltip> </TooltipProvider>
                 </div>

                 {/* Right Side: Repeat, Mute */}
                 <div className="flex items-center gap-1">
                     {/* Repeat Popover */}
                     <Popover open={showRepeatPopover} onOpenChange={setShowRepeatPopover}>
                       <PopoverTrigger asChild>
                         <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                             <Button
                                variant="ghost"
                                size="icon"
                                className={cn(repeatMode !== 'none' && 'text-primary')}
                                aria-label="Repeat Options"
                                disabled={audioActionDisabled}
                                onClick={() => setShowRepeatPopover(prev => !prev)}
                             >
                                 <Repeat className="h-5 w-5" />
                             </Button>
                         </TooltipTrigger> <TooltipContent><p>Repeat Options</p></TooltipContent> </Tooltip> </TooltipProvider>
                       </PopoverTrigger>
                       <PopoverContent className="w-auto p-0" align="end">
                          <div className="p-2 space-y-2">
                             <Label className="text-xs px-2 font-semibold">Repeat Mode</Label>
                             <RadioGroup value={repeatMode} onValueChange={(val) => handleRepeatModeChange(val as RepeatMode)} className="flex flex-col gap-1">
                                <div className="flex items-center space-x-2 px-2 py-1">
                                  <RadioGroupItem value="none" id="r-none" />
                                  <Label htmlFor="r-none" className="text-sm font-normal">No Repeat</Label>
                                </div>
                                <div className="flex items-center space-x-2 px-2 py-1">
                                  <RadioGroupItem value="verse" id="r-verse" />
                                  <Label htmlFor="r-verse" className="text-sm font-normal">Repeat Verse</Label>
                                </div>
                                {/* Placeholder for future modes
                                <div className="flex items-center space-x-2 px-2 py-1 opacity-50">
                                  <RadioGroupItem value="selection" id="r-selection" disabled />
                                  <Label htmlFor="r-selection" className="text-sm font-normal">Repeat Selection (Soon)</Label>
                                </div>
                                <div className="flex items-center space-x-2 px-2 py-1 opacity-50">
                                  <RadioGroupItem value="surah" id="r-surah" disabled />
                                  <Label htmlFor="r-surah" className="text-sm font-normal">Repeat Surah (Soon)</Label>
                                </div>
                                */}
                              </RadioGroup>

                             {repeatMode === 'verse' && (
                                <>
                                 <Separator className="my-1"/>
                                 <Label className="text-xs px-2 font-semibold">Repeat Count</Label>
                                 {/* Use RadioGroup for counts as well for consistency, styled like buttons */}
                                 <RadioGroup
                                     value={repeatCount === Infinity ? 'Infinity' : repeatCount.toString()}
                                     onValueChange={handleRepeatCountChange}
                                     className="flex flex-row gap-1 justify-around p-1"
                                 >
                                     {([1, 3, 5, 10, Infinity] as RepeatCount[]).map((count) => (
                                         <div key={count} className="flex-1">
                                             <RadioGroupItem
                                                 value={count === Infinity ? 'Infinity' : count.toString()}
                                                 id={`rc-${count}`}
                                                 className="sr-only peer" // Hide default radio button
                                             />
                                             <Label
                                                 htmlFor={`rc-${count}`}
                                                 className={cn(
                                                     "text-xs px-2 py-1 block text-center border rounded-md cursor-pointer",
                                                     "peer-data-[state=unchecked]:hover:bg-accent/50",
                                                     "peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary peer-data-[state=checked]:border-primary/30"
                                                 )}
                                             >
                                                 {count === Infinity ? '∞' : `${count}x`}
                                             </Label>
                                         </div>
                                     ))}
                                 </RadioGroup>
                                </>
                             )}
                           </div>
                       </PopoverContent>
                     </Popover>

                     {/* Mute Button */}
                     <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleMute}
                            aria-pressed={isMuted}
                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                            disabled={audioActionDisabled}
                        >
                            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </Button>
                     </TooltipTrigger> <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent> </Tooltip> </TooltipProvider>
                 </div>
            </div>
        </div>

        {/* Error Message Area */}
        {playbackError && (
            <div className="mt-1 px-3 py-1 text-center text-xs text-destructive bg-destructive/10 rounded-md border border-destructive/30">
            {playbackError}
            </div>
        )}
      </CardContent>
    </Card>
  );
}

    