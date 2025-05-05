'use client';

import type { ChangeEvent, SyntheticEvent, RefObject } from 'react'; // Added RefObject
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Reciter, QuranMeta } from '@/services/alquran-cloud';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'; // For reciter select alternative

import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Gauge, BookCopy, BookOpenCheck, Loader2, ChevronDown, Settings, MicVocal, ListMusic, CheckIcon, Repeat1 } from 'lucide-react'; // Added Repeat1
import { formatTime } from '@/lib/utils';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';
import { cn } from '@/lib/utils'; // Import cn

const MAX_VERSE_NUMBER_DEFAULT = 6236;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

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
  audioRef: RefObject<HTMLAudioElement>; // Accept audioRef from parent
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
  // --- Repeat props ---
  isRepeatingVerse: boolean; // Is the current verse actively repeating?
  onRepeatVerseToggle: (verseNum: number, shouldRepeat: boolean) => void; // Toggle repeat for a verse
}

export function Controls({
  audioRef, // Use the passed ref
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
  isRepeatingVerse, // Receive repeat state
  onRepeatVerseToggle, // Receive repeat toggle handler
}: ControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Keep mute state
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false); // Specific to audio element loading state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localVerseNumber, setLocalVerseNumber] = useState<number>(verseNumber); // Local state for input/slider value


   // Sync local verse number with prop
   useEffect(() => {
     setLocalVerseNumber(verseNumber);
   }, [verseNumber]);


  const MAX_VERSE_NUMBER = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? MAX_VERSE_NUMBER_DEFAULT;

  // --- Play/Pause Logic ---
  const togglePlayPause = useCallback(() => {
    console.log("togglePlayPause called");
    const audioElement = audioRef.current; // Use the passed ref
    if (!audioElement) {
      console.error("Audio ref is null, cannot toggle play/pause.");
      setPlaybackError("Audio player not initialized.");
      onError("Audio player not initialized.");
      return;
    }
    setPlaybackError(null); // Clear previous errors

    if (isLoading || isAudioLoading || !audioUrl) {
        console.warn("Play/Pause blocked:", { isLoading, isAudioLoading, audioUrl: !!audioUrl });
        if (!audioUrl && !isLoading && !isAudioLoading) {
            const msg = "Audio not available for this verse or reciter.";
            console.log(msg);
            setPlaybackError(msg);
            onError(msg);
        } else if(isAudioLoading) {
            console.log("Audio is still loading, cannot play yet.");
        } else if (isLoading) {
            console.log("App data is loading, cannot play yet.");
        }
        return;
    }

    if (isPlaying) {
        console.log("Attempting to pause audio");
        audioElement.pause();
        // If paused manually, tell the parent to stop repeating (if it was repeating)
        if (isRepeatingVerse) {
             console.log("Manual pause during repeat, toggling repeat off via parent.");
             onRepeatVerseToggle(verseNumber, false); // Tell parent to stop repeating
        }
    } else {
        console.log("Attempting to play audio with URL:", audioUrl);
        setIsAudioLoading(true); // Set loading true before play attempt
        audioElement.play()
            .then(() => {
                console.log("Audio playback started successfully via play().");
                // State updates (isPlaying=true) are handled by the 'play' event listener
            })
            .catch(err => {
                console.error("Audio playback error on play():", err);
                const audioError = audioElement?.error;
                let errorMsg = "Could not play audio.";
                if (audioError) {
                    errorMsg = `Audio Error Code ${audioError.code}: ${audioError.message || 'Could not load audio.'}`;
                    if (audioError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || audioError.code === MediaError.MEDIA_ERR_NETWORK) {
                        errorMsg += ` Please check the selected reciter or your network connection. URL: ${audioElement?.currentSrc}`;
                    }
                } else if (err instanceof Error) {
                    errorMsg = `Playback initiation failed: ${err.message}`;
                }
                console.log("Setting playback error:", errorMsg);
                setPlaybackError(errorMsg);
                setIsPlaying(false); // Ensure playing state is false on error
                setIsAudioLoading(false); // Ensure loading state is false on error
                onError(errorMsg);
                updatePlayingVerse(null);
                // If play fails, tell the parent to stop repeating
                if (isRepeatingVerse) {
                    console.log("Play failed, toggling repeat off via parent.");
                    onRepeatVerseToggle(verseNumber, false); // Tell parent to stop repeating
                }
            });
    }
  }, [
    isPlaying, isLoading, audioUrl, isAudioLoading, onError, audioRef,
    updatePlayingVerse, isRepeatingVerse, onRepeatVerseToggle, verseNumber
  ]);


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
         console.log(`Loaded metadata, duration: ${targetDuration}`);
         setDuration(targetDuration);
       } else {
         console.warn("Received invalid or infinite duration:", targetDuration, "Resetting to 0.");
         setDuration(0);
       }
       setCurrentTime(0); // Reset time on new metadata
       setIsAudioLoading(false); // Metadata loaded, no longer loading
       setPlaybackError(null); // Clear errors on successful load
   };


  // --- Audio Event Listeners ---
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    console.log("Setting up audio event listeners");

    // Define handlers within useEffect to capture current state/props
    const handlePlay = () => {
        console.log("Audio 'play' event triggered.");
        setIsPlaying(true);
        setIsAudioLoading(false);
        setPlaybackError(null);
        onPlay(); // Notify parent
    };
    const handlePause = () => {
        console.log("Audio 'pause' event triggered.");
        setIsPlaying(false);
        onPause(); // Notify parent
    };
    const handleEnded = () => {
        console.log("Audio 'ended' event triggered.");
        setIsPlaying(false);
        setIsAudioLoading(false);
        setCurrentTime(0); // Reset time visually
        onEnded(); // Notify parent that the track finished
        // Parent (ReaderView) handles repeat logic via onEnded
    };
     const handleError = (e: Event) => {
        const target = e.target as HTMLAudioElement;
        const audioError = target.error;
        console.error("Audio 'error' event triggered:", e);
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
        // If error occurs, tell parent to stop repeating
        if (isRepeatingVerse) {
             console.log("Audio error during repeat, toggling repeat off via parent.");
             onRepeatVerseToggle(verseNumber, false);
        }
    };
     const handleWaiting = () => { console.log("Audio 'waiting'..."); setIsAudioLoading(true); }
    const handleCanPlay = () => {
        console.log("Audio 'canplay'...");
        setIsAudioLoading(false);
        if (playbackError?.includes("Network error") || playbackError?.includes("Audio format not supported")) {
            setPlaybackError(null); // Clear network/format errors if it can now play
        }
    }
     const handleCanPlayThrough = () => { console.log("Audio 'canplaythrough'..."); setIsAudioLoading(false); }
      const handleSuspend = () => { console.log("Audio 'suspend'..."); }
     const handleStalled = () => { console.log("Audio 'stalled'..."); setIsAudioLoading(true); }


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

    // Cleanup function
    return () => {
      console.log("Cleaning up audio event listeners");
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
      verseNumber, isMuted, onPlay, onPause, onEnded, onError, updatePlayingVerse,
      isAudioLoading, playbackError, audioRef, isRepeatingVerse, onRepeatVerseToggle, isLoading // Added isLoading
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
           setIsPlaying(false); setIsAudioLoading(true); // Set loading true when changing src

           audioElement.src = audioUrl;
           audioElement.load(); // Important: Trigger load for new source
           audioElement.muted = isMuted;

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
            // Check if loading state needs adjustment based on readyState
            if (audioElement.readyState < 3 && audioUrl && !audioElement.error) {
                // console.log("Audio source unchanged, but readyState is low, setting loading true.");
                // Only set loading if there's no error and audio URL is present
                setIsAudioLoading(true);
            } else if (audioElement.readyState >= 3 || audioElement.error) {
                // console.log("Audio source unchanged, readyState sufficient or error exists, setting loading false.");
                setIsAudioLoading(false);
            }
            // Clear playback error if audioUrl is valid and was previously set
            if (audioUrl && !audioElement.error && playbackError) {
                 console.log("Clearing playback error as audio URL is now valid and no error present.");
                 setPlaybackError(null);
            } else if (!audioUrl && !playbackError) {
                // Set specific error if URL becomes null/undefined
                 setPlaybackError("Audio not available for this selection.");
            }
       }
   }, [audioUrl, isMuted, updatePlayingVerse, playbackError, audioRef]);


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
  // Disable play/pause if app is loading, audio is loading, or if there's no URL or an error
  const audioActionDisabled = isLoading || isAudioLoading || !audioUrl || !!playbackError;

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
    <Card className="shadow-lg rounded-lg overflow-hidden sticky bottom-4 left-0 right-0 w-full max-w-4xl mx-auto z-10 backdrop-blur-sm bg-background/80 dark:bg-background/70 border">
      <CardContent className="p-3 flex flex-col gap-3">
        {/* Row 1: Navigation & Reciter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full flex-wrap">
           {/* Jump To (Left side on larger screens) */}
           <div className="flex items-center gap-2 flex-wrap justify-start w-full sm:w-auto">
                <Select onValueChange={handleJuzSelect} disabled={navDisabled}>
                   <SelectTrigger className="w-auto sm:w-[130px] h-9 text-sm shrink-0 flex-grow sm:flex-grow-0" aria-label="Jump to Juz"> <BookCopy className="mr-1 h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Jump to Juz" /> </SelectTrigger>
                   <SelectContent> <SelectGroup> <SelectLabel>Juz</SelectLabel> {Object.entries(JUZ_STARTS).map(([juz, startVerse]) => ( <SelectItem key={juz} value={juz}> Juz {juz} (V:{startVerse}) </SelectItem> ))} </SelectGroup> </SelectContent>
                </Select>
                <Select onValueChange={handlePageSelect} disabled={navDisabled}>
                   <SelectTrigger className="w-auto sm:w-[130px] h-9 text-sm shrink-0 flex-grow sm:flex-grow-0" aria-label="Jump to Page"> <BookOpenCheck className="mr-1 h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Jump to Page" /> </SelectTrigger>
                   <SelectContent> <SelectGroup> <SelectLabel>Page (Mushaf)</SelectLabel> {Object.entries(PAGE_STARTS).map(([page, startVerse]) => ( <SelectItem key={page} value={page}> Page {page} (V:{startVerse}) </SelectItem> ))} </SelectGroup> </SelectContent>
                </Select>
                {/* Reciter Selection Moved Here */}
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button
                       variant="ghost"
                       size="sm"
                       className="flex items-center gap-1.5 px-2 h-9 text-sm w-full sm:w-auto flex-grow sm:flex-grow-0" // Full width on small screens
                       disabled={isLoadingReciters || reciters.length === 0 || navDisabled}
                       aria-label="Select Reciter"
                     >
                       {isLoadingReciters ? (
                         <> <Loader2 className="h-4 w-4 animate-spin" /> Loading... </>
                       ) : (
                         <> <MicVocal className="h-4 w-4 text-muted-foreground"/> <span className="truncate max-w-[120px]">{selectedReciterName}</span> <ChevronDown className="h-4 w-4 opacity-50 ml-auto sm:ml-1"/> </> // Truncate text
                       )}
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] max-h-[60vh] overflow-y-auto">
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
           </div>
        </div>


        {/* Row 2: Audio Player Controls */}
        <div className="flex flex-col gap-2 w-full bg-card/50 dark:bg-card/30 p-2 rounded-md border">

            {/* Top Part: Simplified Time Display */}
            <div className="flex items-center justify-between gap-2 w-full px-1">
                 <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(currentTime)}</span>
                 <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(duration)}</span>
            </div>

            {/* Bottom Part: Main Buttons & Secondary Options */}
            <div className="flex items-center justify-center gap-3 w-full"> {/* Centered main buttons */}
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
                            disabled={audioActionDisabled} // Use combined disabled logic
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
                 {/* Right Side: Repeat Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Button
                           variant={isRepeatingVerse ? "secondary" : "ghost"}
                           size="icon"
                           onClick={() => onRepeatVerseToggle(verseNumber, !isRepeatingVerse)}
                           disabled={navDisabled || !audioUrl} // Disable if no audio or loading
                           aria-label={isRepeatingVerse ? "Stop Repeating Verse" : "Repeat Verse"}
                           className={cn(isRepeatingVerse && "ring-2 ring-primary/50")}
                         >
                           <Repeat1 className={cn("h-5 w-5", isRepeatingVerse && "text-primary")} />
                         </Button>
                      </TooltipTrigger>
                       <TooltipContent><p>{isRepeatingVerse ? "Stop Repeating" : "Repeat Verse"}</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
