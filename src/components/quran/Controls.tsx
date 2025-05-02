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
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Gauge, BookCopy, BookOpenCheck, Loader2, ChevronDown } from 'lucide-react'; // Added Loader2, ChevronDown
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
  const [isRepeating, setIsRepeating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false); // Specific to audio element loading state
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
   const [localVerseNumber, setLocalVerseNumber] = useState<number>(verseNumber); // Local state for input/slider value

   // Sync local verse number with prop
   useEffect(() => {
     setLocalVerseNumber(verseNumber);
   }, [verseNumber]);


  const MAX_VERSE_NUMBER = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? MAX_VERSE_NUMBER_DEFAULT;

  // --- Play/Pause & Repeat Logic ---
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return; // Guard against null ref
    setPlaybackError(null); // Clear previous errors

    if (isLoading || isAudioLoading || !audioUrl) {
        console.log("Play/Pause blocked: isLoading", isLoading, "isAudioLoading", isAudioLoading, "audioUrl", !!audioUrl);
        // Optionally provide feedback to the user why it's blocked
        if (!audioUrl && !isLoading && !isAudioLoading) { // Added !isAudioLoading check
            setPlaybackError("Audio not available for this verse or reciter.");
            onError("Audio not available for this verse or reciter.");
        }
        return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      // Parent notified via 'pause' event listener
    } else {
      setIsAudioLoading(true); // Indicate loading start
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
        onError(errorMsg); // Notify parent of the error
        updatePlayingVerse(null); // Ensure parent knows nothing is playing
      });
       // Parent notified via 'play' event listener if successful
    }
  }, [isPlaying, isLoading, audioUrl, isAudioLoading, onError, updatePlayingVerse]); // Added dependencies

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
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      audioRef.current.muted = newMuteState;
      if (!newMuteState && volume === 0) {
        // If unmuting and volume was 0, set to a audible level
        handleVolumeChange([0.5]);
      } else if (newMuteState) {
          // If muting, ensure volume visually reflects this if slider is visible
          // This depends on how you want the UI to behave.
          // Option 1: Keep slider position, just mute audio (current behavior)
          // Option 2: Move slider to 0 when muted (add setVolume(0) here)
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
     if (!isSeeking && !isLoading && !isAudioLoading && isFinite(event.currentTarget.currentTime)) {
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

   const handleProgressSliderChange = (value: number[]) => {
      const seekTime = value[0];
      // Update visual time immediately while dragging
       setCurrentTime(seekTime);
   };

   const handleSeekCommit = (value: number[]) => {
       const seekTime = value[0];
       if (audioRef.current && isFinite(seekTime) && duration > 0) {
           audioRef.current.currentTime = Math.min(seekTime, duration); // Ensure seek is within bounds
       }
       setIsSeeking(false);
   };

   const handlePointerDown = () => {
       if (!audioActionDisabled && duration > 0) {
           setIsSeeking(true);
       }
   };


  // --- Audio Event Listeners ---
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    // Define handlers within useEffect to capture current state/props
    const handlePlay = () => {
        console.log("Audio 'play' event triggered for verse:", verseNumber);
        setIsPlaying(true);
        setIsAudioLoading(false);
        setPlaybackError(null);
        onPlay(); // Notify parent
        updatePlayingVerse(verseNumber); // Tell parent which verse is playing
    };
    const handlePause = () => {
        console.log("Audio 'pause' event triggered");
        setIsPlaying(false);
        // Don't set isAudioLoading false here, might be buffering
        onPause(); // Notify parent
        updatePlayingVerse(null); // Tell parent nothing is playing
    };
    const handleEnded = () => {
        console.log("Audio 'ended' event triggered");
        setIsPlaying(false);
        setIsAudioLoading(false);
        updatePlayingVerse(null); // Tell parent nothing is playing
        onEnded(); // Notify parent

         // More robust check for end of audio
         // Use a small buffer to account for potential timing inaccuracies
         const timeNearEnd = duration > 0 && audioElement.currentTime >= duration - 0.2;

         if (!isRepeating && !audioElement.loop && timeNearEnd) {
             console.log("Audio ended naturally, moving to next verse focus.");
            setCurrentTime(0); // Reset time visually
            onNextVerse(); // Trigger parent's next verse *focus* logic
             // Playback for the next verse will be initiated by the user or potentially auto-play logic in parent
         } else if (isRepeating && timeNearEnd) {
            console.log("Audio ended, repeating verse.");
            setCurrentTime(0);
            audioElement.currentTime = 0; // Go to start
            // Explicitly play again
            audioElement.play().catch(err => {
                console.error("Repeat play error:", err);
                onError(`Failed to repeat audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
            });
             // 'play' event will handle state updates (onPlay, updatePlayingVerse)
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
     const handleWaiting = () => {
         // Only set loading if not seeking and actually waiting for data
         if (!isSeeking) {
            console.log("Audio 'waiting' event (buffering)...");
            setIsAudioLoading(true);
         }
     }
    const handleCanPlay = () => {
        console.log("Audio 'canplay' event");
        setIsAudioLoading(false); // Ready to play or resumed playing
        // Clear network/loading related errors if we reach canplay
        if (playbackError?.includes("Network error") || playbackError?.includes("Could not load audio")) {
             setPlaybackError(null);
        }
    }
     const handleCanPlayThrough = () => {
         console.log("Audio 'canplaythrough' event");
         setIsAudioLoading(false); // Likely ready to play till end
     }
      const handleSuspend = () => {
         console.log("Audio 'suspend' event (loading suspended)");
         // Might happen if loading is paused by browser, don't necessarily set loading state
     }
     const handleStalled = () => {
         console.log("Audio 'stalled' event (network stalled)");
         // Consider setting loading or showing a warning if stalled for too long
         setIsAudioLoading(true); // Indicate potential loading issue
     }


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
    audioElement.playbackRate = playbackSpeed;
    audioElement.volume = volume;
    audioElement.muted = isMuted;
    audioElement.loop = isRepeating;


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
  // Ensure all relevant state and props are included in dependency array
  }, [
      verseNumber, isRepeating, playbackSpeed, volume, isMuted, duration, isSeeking,
      onPlay, onPause, onEnded, onError, updatePlayingVerse, onNextVerse, // Include navigation callback if used in effect
      isAudioLoading, // Include to re-evaluate handlers if loading state changes externally
      playbackError // Include to clear certain errors on canplay
    ]);

  // --- Handle Audio Source Change ---
   useEffect(() => {
       const audioElement = audioRef.current;
       if (!audioElement) return;

       const currentSrc = audioElement.currentSrc;
       const shouldUpdateSrc = audioUrl && currentSrc !== audioUrl;
       const shouldClearSrc = !audioUrl && currentSrc;

       if (shouldUpdateSrc) {
           console.log(`Updating audio source from "${currentSrc}" to "${audioUrl}"`);
           // Pause current playback before changing source
           if (!audioElement.paused) {
               audioElement.pause(); // This will trigger 'pause' event listeners
           }
            // Reset state related to the *previous* audio
           setCurrentTime(0);
           setDuration(0);
           setPlaybackError(null); // Clear previous errors
           setIsPlaying(false); // Assume not playing until new source loads and plays
           setIsAudioLoading(true); // Start loading indicator for the new source

           audioElement.src = audioUrl;
           audioElement.load(); // Explicitly call load() after setting new src
           // Reset other properties for the new source
           audioElement.loop = isRepeating;
           audioElement.muted = isMuted;
           audioElement.volume = volume;
           audioElement.playbackRate = playbackSpeed;
           // Don't auto-play here; let user initiate or parent decide

       } else if (shouldClearSrc) {
           console.log(`Clearing audio source from "${currentSrc}"`);
           if (!audioElement.paused) {
               audioElement.pause();
           }
           audioElement.removeAttribute('src');
           audioElement.load(); // Required after removing src attribute
           // Reset state
           setCurrentTime(0);
           setDuration(0);
           setPlaybackError(audioUrl === null ? "Audio not available for this selection." : null); // Inform user if explicitly null
           setIsPlaying(false);
           setIsAudioLoading(false);
           updatePlayingVerse(null); // Ensure parent knows nothing is playing
       } else {
           // Source is the same, or was already null/undefined
           // Ensure loading state is accurate if src hasn't changed
           if (!audioElement.seeking && audioElement.readyState < 3 && audioUrl) { // HAVE_NOTHING, HAVE_METADATA, HAVE_CURRENT_DATA
              setIsAudioLoading(true); // Still loading metadata or data
           } else if (audioElement.readyState >= 3) {
              setIsAudioLoading(false); // Ready or playing
           }
           // Clear error if URL is now valid and was previously errored
            if (audioUrl && playbackError) {
                setPlaybackError(null);
            }
       }

   // Dependencies: Trigger effect when audioUrl changes, or when settings affecting playback change.
   // Avoid including `isPlaying` here as it can cause loops when combined with event listeners setting it.
   }, [audioUrl, isRepeating, isMuted, volume, playbackSpeed, updatePlayingVerse]); // Removed verseNumber, already handled via audioUrl


  // --- Input/Slider Sync for Verse Number ---
   const handleLocalVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Allow empty input or valid numbers within range
        if (value === '' || (/^\d+$/.test(value) && +value >= 1 && +value <= MAX_VERSE_NUMBER)) {
            setLocalVerseNumber(+value); // Update local state for input control
             onVerseInputChange(e); // Notify parent for potential external sync
        } else if (/^\d+$/.test(value) && (+value < 1 || +value > MAX_VERSE_NUMBER)) {
           // Handle out-of-range case if needed (e.g., show temporary warning)
        }
   };

   const handleLocalVerseSliderChange = (value: number[]) => {
       setLocalVerseNumber(value[0]); // Update local state for slider control
       onVerseSliderChange(value); // Notify parent for visual sync/updates
   };


  // --- Combined Disabled Logic ---
  const navDisabled = isLoading; // Disable navigation if parent indicates general loading
  const audioActionDisabled = isLoading || !audioUrl || !!playbackError || isAudioLoading; // Disable audio actions if parent loading, no URL, error, or audio element loading


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
      .sort((a, b) => POPULAR_RECITERS.indexOf(a.id) - POPULAR_RECITERS.indexOf(b.id)) // Maintain popular order
      .map(reciter => (
        <SelectItem key={reciter.id} value={reciter.id}>
          {reciter.name}
        </SelectItem>
      ));

    const otherReciterOptions = reciters
      .filter(r => !POPULAR_RECITERS.includes(r.id))
      .sort((a, b) => a.name.localeCompare(b.name)) // Sort others alphabetically
      .map(reciter => (
        <SelectItem key={reciter.id} value={reciter.id}>
          {reciter.name}
        </SelectItem>
      ));


  return (
    <Card className="shadow-lg rounded-lg overflow-hidden sticky bottom-4 left-0 right-0 w-full max-w-5xl mx-auto z-10 backdrop-blur-sm bg-background/80 dark:bg-background/70 border">
      <CardContent className="p-3 flex flex-col gap-2"> {/* Reduced padding and gap */}
        <audio ref={audioRef} preload="metadata" />

        {/* Top Row: Verse Navigation (Slider & Input) */}
        <div className="flex items-center gap-2 w-full">
          <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onPreviousVerse} disabled={navDisabled || verseNumber <= 1} aria-label="Previous Verse">
              <SkipBack className="h-5 w-5" />
            </Button>
          </TooltipTrigger> <TooltipContent><p>Previous Verse</p></TooltipContent> </Tooltip> </TooltipProvider>

          {/* Verse Slider */}
          <Slider
            value={[localVerseNumber]}
            onValueChange={handleLocalVerseSliderChange}
            onValueCommit={onVerseSliderCommit}
            min={1}
            max={MAX_VERSE_NUMBER}
            step={1}
            className="flex-1"
            aria-label="Navigate Verses"
            disabled={navDisabled}
          />

          {/* Verse Input */}
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

          <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onNextVerse} disabled={navDisabled || verseNumber >= MAX_VERSE_NUMBER} aria-label="Next Verse">
              <SkipForward className="h-5 w-5" />
            </Button>
          </TooltipTrigger> <TooltipContent><p>Next Verse</p></TooltipContent> </Tooltip> </TooltipProvider>
        </div>

        {/* Middle Row: Audio Progress & Main Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
           {/* Audio Progress Bar */}
           <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 order-2 sm:order-1">
             <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(currentTime)}</span>
             <Slider
                 value={duration > 0 && isFinite(currentTime) ? [currentTime] : [0]}
                 onValueChange={handleProgressSliderChange}
                 onPointerDown={handlePointerDown}
                 onValueCommit={handleSeekCommit}
                 min={0}
                 max={duration > 0 && isFinite(duration) ? duration : 1}
                 step={0.1}
                 className={cn("flex-1 cursor-pointer", (audioActionDisabled || duration <= 0) && "opacity-50 cursor-not-allowed")}
                 aria-label="Audio Progress"
                 disabled={audioActionDisabled || duration <= 0}
             />
             <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(duration)}</span>
           </div>

           {/* Main Audio Control Buttons */}
           <div className="flex items-center gap-1 md:gap-2 order-1 sm:order-2">
             <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleRepeat}
                    className={cn(isRepeating && 'text-primary')}
                    aria-pressed={isRepeating}
                    aria-label="Repeat Verse"
                    disabled={audioActionDisabled}
                 >
                     <Repeat className="h-5 w-5" />
                 </Button>
             </TooltipTrigger> <TooltipContent><p>{isRepeating ? 'Disable Repeat' : 'Repeat Verse'}</p></TooltipContent> </Tooltip> </TooltipProvider>

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

        {/* Bottom Row: Jump To, Reciter, Speed, Volume */}
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
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

            {/* Reciter, Speed, Volume */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
                 {/* Reciter Select */}
                 <Select
                    value={selectedReciter}
                    onValueChange={onReciterChange}
                    disabled={isLoadingReciters || reciters.length === 0 || navDisabled}
                  >
                      <SelectTrigger
                         className="w-[180px] h-9 text-sm shrink-0"
                         aria-label="Select Reciter"
                       >
                          {isLoadingReciters ? (
                              <span className="flex items-center gap-1 text-muted-foreground"> <Loader2 className="h-4 w-4 animate-spin" /> Loading... </span>
                          ) : ( <SelectValue placeholder="Select Reciter" /> )}
                      </SelectTrigger>
                      <SelectContent>
                         {isLoadingReciters && (<SelectItem value="loading" disabled> <span className="flex items-center gap-1"> <Loader2 className="h-4 w-4 animate-spin" /> Loading... </span> </SelectItem> )}
                         {!isLoadingReciters && popularReciterOptions.length > 0 && ( <SelectGroup> <SelectLabel>Popular</SelectLabel> {popularReciterOptions} </SelectGroup> )}
                         {!isLoadingReciters && otherReciterOptions.length > 0 && ( <SelectGroup> <SelectLabel>All</SelectLabel> {otherReciterOptions} </SelectGroup> )}
                         {!isLoadingReciters && reciters.length === 0 && ( <SelectItem value="none" disabled>No reciters</SelectItem> )}
                       </SelectContent>
                  </Select>

                  {/* Playback Speed Select */}
                  <Select value={playbackSpeed.toString()} onValueChange={handlePlaybackSpeedChange} disabled={audioActionDisabled}>
                       <SelectTrigger className="w-[80px] h-9 text-sm shrink-0" aria-label="Playback Speed">
                            <Gauge className="h-4 w-4 text-muted-foreground mr-1"/>
                            <SelectValue placeholder="Speed" />
                       </SelectTrigger>
                       <SelectContent>
                           <SelectGroup> <SelectLabel>Speed</SelectLabel> {PLAYBACK_SPEEDS.map((speed) => ( <SelectItem key={speed} value={speed.toString()}> {speed}x </SelectItem> ))} </SelectGroup>
                       </SelectContent>
                  </Select>

                  {/* Volume Slider */}
                  <Slider
                    value={[volume]}
                    onValueChange={handleVolumeChange}
                    min={0}
                    max={1}
                    step={0.05}
                    className={cn("w-20 hidden md:flex h-9 items-center", audioActionDisabled && "opacity-50 cursor-not-allowed")}
                    aria-label="Volume"
                    disabled={audioActionDisabled}
                 />
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
