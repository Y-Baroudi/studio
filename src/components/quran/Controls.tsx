
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
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Gauge, BookCopy, BookOpenCheck } from 'lucide-react'; // Removed Settings icon
import { formatTime } from '@/lib/utils'; // Import time formatting utility
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings'; // Import mappings

const MAX_VERSE_NUMBER_DEFAULT = 6236; // Default total verses
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

interface ControlsProps {
  verseNumber: number;
  audioUrl: string | null | undefined;
  reciters: Reciter[];
  selectedReciter: string;
  onNextVerse: () => void;
  onPreviousVerse: () => void;
  onReciterChange: (reciterId: string) => void;
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
  onNextVerse,
  onPreviousVerse,
  onReciterChange,
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
  const [isSeeking, setIsSeeking] = useState(false);

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
           // Additional check for common network/source errors
           if (audioError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || audioError.code === MediaError.MEDIA_ERR_NETWORK) {
               errorMsg += ` Please check the selected reciter or your network connection. URL: ${audioRef.current?.currentSrc}`;
           }
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
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      audioRef.current.muted = newMuteState;
      if (!newMuteState && volume === 0) {
        handleVolumeChange([0.5]);
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
     if (!isSeeking && !isLoading && !isAudioLoading) {
        setCurrentTime(event.currentTarget.currentTime);
     }
   };

   const handleLoadedMetadata = (event: SyntheticEvent<HTMLAudioElement>) => {
       const targetDuration = event.currentTarget.duration;
       if (!isNaN(targetDuration) && isFinite(targetDuration)) { // Check for finite duration
         setDuration(targetDuration);
       } else {
         console.warn("Received invalid or infinite duration:", targetDuration, "Resetting to 0.");
         setDuration(0);
       }
       setCurrentTime(0);
       setIsAudioLoading(false); // Ensure loading stops once metadata is loaded
   };

   const handleProgressSliderChange = (value: number[]) => {
      const seekTime = value[0];
      setCurrentTime(seekTime);
   };

   const handleSeekCommit = (value: number[]) => {
       const seekTime = value[0];
       if (audioRef.current && isFinite(seekTime)) { // Ensure seekTime is valid
           audioRef.current.currentTime = seekTime;
       }
       setIsSeeking(false);
   };

   const handlePointerDown = () => {
       setIsSeeking(true);
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
         // Check if ended naturally (not due to seeking or source change) and near the end
         const timeNearEnd = duration > 0 && audioElement.currentTime >= duration - 0.5;

         if (!isRepeating && !audioElement.loop && timeNearEnd) {
             console.log("Audio ended naturally, moving to next verse.");
            setCurrentTime(0); // Reset time visually
            onNextVerse();
         } else if (isRepeating && timeNearEnd) {
            console.log("Audio ended, repeating verse.");
            setCurrentTime(0);
            audioElement.currentTime = 0;
            audioElement.play().catch(err => console.error("Repeat play error:", err));
         } else {
              // Handles cases like pause before end, seek before end, etc.
              // We might reset currentTime here if pause is intended to reset progress,
              // but current behavior keeps the progress on pause.
              // If paused near the end but not exactly, keep current time.
              if (audioElement.paused && !timeNearEnd) {
                 // Keep currentTime as is
              } else if (!timeNearEnd) {
                 // If ended unexpectedly far from the end (e.g., error, source change)
                 // Resetting time might be appropriate depending on the cause.
                 // Handled by 'error' and source change logic mostly.
              }
         }
    };
    const handleError = (e: Event) => {
        const audioError = audioElement.error;
        console.error("Audio Error Event:", e);
        console.error("Audio Element Error:", audioError); // Log the error property

        let errorMsg = "An error occurred during playback.";
        if (audioError) {
            switch (audioError.code) {
            case MediaError.MEDIA_ERR_ABORTED: errorMsg = "Audio playback aborted."; break;
            case MediaError.MEDIA_ERR_NETWORK: errorMsg = "Network error fetching audio."; break;
            case MediaError.MEDIA_ERR_DECODE: errorMsg = "Audio could not be decoded."; break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = "Audio source not supported or unavailable."; break;
            default: errorMsg = `Unknown audio error (Code: ${audioError.code}).`;
            }
            errorMsg += ` URL: ${audioElement.currentSrc || 'N/A'}`;
        } else if (e.target instanceof HTMLMediaElement && e.target.error) {
             errorMsg = `Media Element Error (Code: ${e.target.error.code}): ${e.target.error.message}`;
        } else {
            errorMsg += ` No specific error code available. Event type: ${e.type}.`;
        }

        setPlaybackError(errorMsg);
        setIsPlaying(false);
        setIsAudioLoading(false);
        setCurrentTime(0);
        setDuration(0);
        // Consider if we should try fetching the next verse on error, or just stop.
        // For now, just stopping.
    };
    const handleWaiting = () => { !isSeeking && setIsAudioLoading(true); } // Don't show loading if seeking
    const handleCanPlay = () => { setIsAudioLoading(false); }


    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('error', handleError);
    audioElement.addEventListener('waiting', handleWaiting);
    audioElement.addEventListener('canplay', handleCanPlay);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    audioElement.playbackRate = playbackSpeed;
    audioElement.volume = volume;
    audioElement.muted = isMuted;
    audioElement.loop = isRepeating;


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
  }, [isRepeating, onNextVerse, playbackSpeed, volume, isMuted, duration, isSeeking, isLoading, isAudioLoading]);

  // --- Handle Audio Source Change ---
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && audioUrl) {
        // Pause current playback before changing source
        if (!audioElement.paused) { audioElement.pause(); }

        // Check if the new URL is the same as the current one
        if (audioElement.currentSrc !== audioUrl) {
            console.log("Setting new audio source:", audioUrl);
            audioElement.src = audioUrl;
            audioElement.load(); // Load the new source
            setPlaybackError(null);
            setIsPlaying(false); // Reset playing state
            setIsAudioLoading(true); // Set loading state
            setCurrentTime(0); // Reset time for new source
            setDuration(0); // Reset duration for new source
        } else {
            // If URL is the same, maybe just ensure state is correct (e.g., reset time if needed)
            // This might happen if reciter is changed back and forth quickly or on re-renders
            console.log("Audio source URL is the same, ensuring state consistency.");
            if (audioElement.currentTime > 0) {
                 // Optionally reset time, or keep it if intended
                 // setCurrentTime(0);
                 // setDuration(audioElement.duration || 0); // Ensure duration is updated
            }
            setIsAudioLoading(false); // Ensure loading indicator is off if source hasn't changed
        }
        // Always ensure these properties are set, even if src hasn't changed
        audioElement.playbackRate = playbackSpeed;
        audioElement.volume = volume;
        audioElement.muted = isMuted;
        audioElement.loop = isRepeating;

    } else if (audioElement) {
        // Handle case where audioUrl becomes null/undefined
        if (!audioElement.paused) { audioElement.pause(); }
        if (audioElement.currentSrc) { // Only remove/load if there's a source currently
            audioElement.removeAttribute('src');
            audioElement.load();
        }
        setIsPlaying(false);
        setPlaybackError(audioUrl === null ? "Audio not available for this selection." : null);
        setIsAudioLoading(false);
        setCurrentTime(0);
        setDuration(0);
    }
}, [audioUrl, playbackSpeed, volume, isMuted, isRepeating]);


  const controlsDisabled = isLoading; // Base loading state
  const audioActionDisabled = controlsDisabled || isAudioLoading || !audioUrl || !!playbackError; // More specific for audio actions

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
    <Card className="shadow-md rounded-lg overflow-hidden sticky bottom-4 backdrop-blur-sm bg-background/80 dark:bg-background/70 border w-full max-w-5xl mx-auto"> {/* Ensure card takes width */}
      <CardContent className="p-4 flex flex-col gap-3"> {/* Reduced gap */}
        {/* Audio element should be outside the visible content usually */}
        <audio ref={audioRef} preload="metadata" />

        {/* Top Row: Verse Navigation (Slider & Input) & Jump To */}
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4 w-full">
             {/* Verse Slider & Number Input */}
            <div className="flex items-center gap-2 flex-grow min-w-[200px]">
                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" onClick={onPreviousVerse} disabled={isLoading || verseNumber <= 1} aria-label="Previous Verse">
                        <SkipBack className="h-5 w-5" />
                     </Button>
                 </TooltipTrigger> <TooltipContent><p>Previous Verse</p></TooltipContent> </Tooltip> </TooltipProvider>

                 <Slider value={[verseNumber]} onValueChange={onVerseSliderChange} min={1} max={MAX_VERSE_NUMBER} step={1} className="flex-1" aria-label="Navigate Verses" disabled={isLoading} />

                 <Input type="number" min="1" max={MAX_VERSE_NUMBER} value={verseNumber} onChange={onVerseInputChange} onBlur={onVerseInputBlur} className="w-20 h-9 text-center border-input rounded-md text-sm shrink-0" aria-label="Current Verse Number" disabled={isLoading}/>

                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={onNextVerse} disabled={isLoading || verseNumber >= MAX_VERSE_NUMBER} aria-label="Next Verse">
                        <SkipForward className="h-5 w-5" />
                    </Button>
                 </TooltipTrigger> <TooltipContent><p>Next Verse</p></TooltipContent> </Tooltip> </TooltipProvider>
            </div>

             {/* Jump To Controls */}
             <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
                 <Select onValueChange={handleJuzSelect} disabled={isLoading}>
                    <SelectTrigger className="w-[130px] h-9 text-sm shrink-0" aria-label="Jump to Juz"> <BookCopy className="mr-1 h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Jump to Juz" /> </SelectTrigger>
                    <SelectContent> <SelectGroup> <SelectLabel>Juz</SelectLabel> {Object.entries(JUZ_STARTS).map(([juz, startVerse]) => ( <SelectItem key={juz} value={juz}> Juz {juz} (V:{startVerse}) </SelectItem> ))} </SelectGroup> </SelectContent>
                 </Select>
                  <Select onValueChange={handlePageSelect} disabled={isLoading}>
                    <SelectTrigger className="w-[130px] h-9 text-sm shrink-0" aria-label="Jump to Page"> <BookOpenCheck className="mr-1 h-4 w-4 text-muted-foreground" /> <SelectValue placeholder="Jump to Page" /> </SelectTrigger>
                    <SelectContent> <SelectGroup> <SelectLabel>Page (Mushaf)</SelectLabel> {Object.entries(PAGE_STARTS).map(([page, startVerse]) => ( <SelectItem key={page} value={page}> Page {page} (V:{startVerse}) </SelectItem> ))} </SelectGroup> </SelectContent>
                  </Select>
             </div>
        </div>


         {/* Middle Row: Audio Progress, Main Controls, Reciter/Speed */}
         <div className="flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4 w-full">
            {/* Progress Bar and Timestamps */}
            <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 order-2 sm:order-1">
                <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(currentTime)}</span>
                <Slider
                    value={duration > 0 ? [currentTime] : [0]}
                    onValueChange={handleProgressSliderChange}
                    onPointerDown={handlePointerDown}
                    onValueCommit={handleSeekCommit}
                    min={0}
                    max={duration > 0 ? duration : 1}
                    step={0.1}
                    className="flex-1 cursor-pointer"
                    aria-label="Audio Progress"
                    disabled={audioActionDisabled || duration <= 0}
                />
                <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">{formatTime(duration)}</span>
            </div>

             {/* Main Playback Controls (Centered) */}
             <div className="flex items-center gap-1 md:gap-2 order-1 sm:order-2">
                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" onClick={toggleRepeat} className={isRepeating ? 'text-primary' : ''} aria-pressed={isRepeating} aria-label="Repeat Verse" disabled={audioActionDisabled}>
                         <Repeat className="h-5 w-5" />
                     </Button>
                 </TooltipTrigger> <TooltipContent><p>{isRepeating ? 'Disable Repeat' : 'Repeat Verse'}</p></TooltipContent> </Tooltip> </TooltipProvider>

                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                    <Button variant="default" size="icon" onClick={togglePlayPause} disabled={audioActionDisabled} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-11 h-11 rounded-full shadow-lg bg-primary hover:bg-primary/90 relative">
                        {isAudioLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                                <svg className="animate-spin h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg>
                            </div>
                        )}
                        {!isAudioLoading && (isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />)}
                    </Button>
                 </TooltipTrigger> <TooltipContent><p>{isPlaying ? 'Pause' : 'Play'}</p></TooltipContent> </Tooltip> </TooltipProvider>

                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleMute} aria-pressed={isMuted} aria-label={isMuted ? 'Unmute' : 'Mute'} disabled={audioActionDisabled}>
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                 </TooltipTrigger> <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent> </Tooltip> </TooltipProvider>
             </div>


              {/* Reciter, Speed, Volume (Right Aligned) */}
            <div className="flex items-center gap-2 order-3 sm:order-3 justify-end">
                 {/* Reciter Selection */}
                 <Select value={selectedReciter} onValueChange={onReciterChange} disabled={reciters.length === 0 || isLoading}>
                      <SelectTrigger className="w-[150px] h-9 text-sm shrink-0" aria-label="Select Reciter">
                          <SelectValue placeholder="Select Reciter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Reciter</SelectLabel>
                            {reciters.map((reciter) => ( <SelectItem key={reciter.id} value={reciter.id}> {reciter.name} </SelectItem> ))}
                             {reciters.length === 0 && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                        </SelectGroup>
                       </SelectContent>
                  </Select>

                  {/* Playback Speed */}
                  <Select value={playbackSpeed.toString()} onValueChange={handlePlaybackSpeedChange} disabled={audioActionDisabled}>
                       <SelectTrigger className="w-[70px] h-9 text-sm shrink-0" aria-label="Playback Speed">
                            <Gauge className="h-4 w-4 text-muted-foreground mr-1"/>
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

                  {/* Volume Slider (Inline) */}
                  <Slider
                    value={[volume]}
                    onValueChange={handleVolumeChange}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-20 hidden md:flex h-9 items-center" // Only show on medium screens and up
                    aria-label="Volume"
                    disabled={audioActionDisabled}
                 />
             </div>
        </div>

        {/* Error Message Area */}
        {playbackError && (
            <div className="mt-2 px-3 py-1.5 text-center text-xs text-destructive bg-destructive/10 rounded-md border border-destructive/30">
            {playbackError}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
