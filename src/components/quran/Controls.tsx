

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
import { Play, Pause, SkipBack, SkipForward, Repeat, Volume2, VolumeX, Gauge, BookCopy, BookOpenCheck } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { JUZ_STARTS, PAGE_STARTS } from '@/data/quranMappings';

const MAX_VERSE_NUMBER_DEFAULT = 6236;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

interface ControlsProps {
  verseNumber: number; // Currently focused verse number
  audioUrl: string | null | undefined; // Audio URL for the *focused* verse
  reciters: Reciter[];
  selectedReciter: string;
  onNextVerse: () => void; // Handler to advance focus to the next verse
  onPreviousVerse: () => void; // Handler to move focus to the previous verse
  onReciterChange: (reciterId: string) => void;
  onVerseInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onVerseInputBlur: (e: ChangeEvent<HTMLInputElement>) => void;
  onVerseSliderChange: (value: number[]) => void;
  onJuzChange: (juz: number) => void;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  quranMeta: QuranMeta | null;
  // Audio Event Handlers for parent synchronization
  onPlay: () => void; // Notify parent when playback starts
  onPause: () => void; // Notify parent when playback pauses
  onEnded: () => void; // Notify parent when playback ends naturally
  onError: (errorMessage: string) => void; // Notify parent of playback errors
  updatePlayingVerse: (verseNum: number | null) => void; // Allow controls to tell parent which verse is playing/stopped
}

export function Controls({
  verseNumber, // This is the *focused* verse number
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
      // Parent notified via 'pause' event listener
    } else {
      setIsAudioLoading(true);
      audioRef.current.play().catch(err => {
        console.error("Audio playback error:", err);
        const audioError = audioRef.current?.error;
        let errorMsg = "Could not play audio.";
        if (audioError) {
           errorMsg = `Audio Error Code ${audioError.code}: ${audioError.message || 'Could not load audio.'}`;
           if (audioError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || audioError.code === MediaError.MEDIA_ERR_NETWORK) {
               errorMsg += ` Please check the selected reciter or your network connection. URL: ${audioRef.current?.currentSrc}`;
           }
        }
        setPlaybackError(errorMsg);
        setIsPlaying(false);
        setIsAudioLoading(false);
        onError(errorMsg); // Notify parent of the error
        updatePlayingVerse(null); // Ensure parent knows nothing is playing
      });
       // Parent notified via 'play' event listener
    }
  }, [isPlaying, isLoading, audioUrl, isAudioLoading, onError, updatePlayingVerse]);

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
       if (!isNaN(targetDuration) && isFinite(targetDuration)) {
         setDuration(targetDuration);
       } else {
         console.warn("Received invalid or infinite duration:", targetDuration, "Resetting to 0.");
         setDuration(0);
       }
       setCurrentTime(0);
       setIsAudioLoading(false);
   };

   const handleProgressSliderChange = (value: number[]) => {
      const seekTime = value[0];
      setCurrentTime(seekTime);
   };

   const handleSeekCommit = (value: number[]) => {
       const seekTime = value[0];
       if (audioRef.current && isFinite(seekTime)) {
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

    const handlePlay = () => {
        setIsPlaying(true);
        setIsAudioLoading(false);
        setPlaybackError(null);
        onPlay(); // Notify parent
        updatePlayingVerse(verseNumber); // Tell parent which verse is playing
    }
    const handlePause = () => {
        setIsPlaying(false);
        setIsAudioLoading(false);
        onPause(); // Notify parent
        updatePlayingVerse(null); // Tell parent nothing is playing
    }
    const handleEnded = () => {
        setIsPlaying(false);
        setIsAudioLoading(false);
        updatePlayingVerse(null); // Tell parent nothing is playing
        onEnded(); // Notify parent

         const timeNearEnd = duration > 0 && audioElement.currentTime >= duration - 0.5;

         if (!isRepeating && !audioElement.loop && timeNearEnd) {
             console.log("Audio ended naturally, moving to next verse.");
            setCurrentTime(0);
            onNextVerse(); // Trigger parent's next verse logic
         } else if (isRepeating && timeNearEnd) {
            console.log("Audio ended, repeating verse.");
            setCurrentTime(0);
            audioElement.currentTime = 0;
            audioElement.play().catch(err => console.error("Repeat play error:", err));
             // onPlay and updatePlayingVerse will be called by the 'play' event
         }
    };
    const handleError = (e: Event) => {
        const audioError = audioElement.error;
        console.error("Audio Error Event:", e);
        console.error("Audio Element Error:", audioError);

        let errorMsg = "An error occurred during playback.";
        // ... [error message generation logic remains the same] ...
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
        onError(errorMsg); // Notify parent
        updatePlayingVerse(null); // Tell parent nothing is playing
    };
    const handleWaiting = () => { !isSeeking && setIsAudioLoading(true); }
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
  // Added dependencies for parent callbacks and verseNumber
  }, [isRepeating, onNextVerse, playbackSpeed, volume, isMuted, duration, isSeeking, isLoading, isAudioLoading, onPlay, onPause, onEnded, onError, updatePlayingVerse, verseNumber]);

  // --- Handle Audio Source Change ---
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && audioUrl) {
        // Pause current playback before changing source ONLY IF it's actually playing
        if (isPlaying) { audioElement.pause(); }

        if (audioElement.currentSrc !== audioUrl) {
            console.log("Setting new audio source:", audioUrl);
            audioElement.src = audioUrl;
            audioElement.load();
            setPlaybackError(null);
            // Don't auto-reset playing state here; let user initiate play for the new source
            // setIsPlaying(false); // Remove this auto-reset
            setIsAudioLoading(true);
            setCurrentTime(0);
            setDuration(0);
        } else {
            console.log("Audio source URL is the same.");
             // Ensure loading is false if src hasn't changed and we aren't actually loading
             if (!audioElement.seeking && audioElement.readyState >= 3) { // HAVE_FUTURE_DATA or more
                setIsAudioLoading(false);
             }
        }
        // Always ensure these properties are set
        audioElement.playbackRate = playbackSpeed;
        audioElement.volume = volume;
        audioElement.muted = isMuted;
        audioElement.loop = isRepeating;

    } else if (audioElement) {
        // Handle case where audioUrl becomes null/undefined
        if (isPlaying) { audioElement.pause(); }
        if (audioElement.currentSrc) {
            audioElement.removeAttribute('src');
            audioElement.load();
        }
        // Don't auto-reset playing state here either
        // setIsPlaying(false); // Remove this
        setPlaybackError(audioUrl === null ? "Audio not available for this selection." : null);
        setIsAudioLoading(false);
        setCurrentTime(0);
        setDuration(0);
        // If audio became null, ensure parent knows nothing is playing
        if (audioUrl === null) {
             updatePlayingVerse(null);
        }
    }
// Removed isPlaying from dependency array to avoid potential loops on state change
}, [audioUrl, playbackSpeed, volume, isMuted, isRepeating, updatePlayingVerse]);


  const controlsDisabled = isLoading; // Base loading state
  const audioActionDisabled = controlsDisabled || isAudioLoading || !audioUrl || !!playbackError;

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
     // Stick to the bottom, above the FAB
    <Card className="shadow-lg rounded-lg overflow-hidden sticky bottom-4 left-0 right-0 w-full max-w-5xl mx-auto z-10 backdrop-blur-sm bg-background/80 dark:bg-background/70 border">
      <CardContent className="p-3 flex flex-col gap-2"> {/* Reduced padding and gap */}
        <audio ref={audioRef} preload="metadata" />

        {/* Top Row: Verse Navigation (Slider & Input) & Jump To */}
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4 w-full">
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


         {/* Bottom Row: Audio Progress, Main Controls, Reciter/Speed/Volume */}
         <div className="flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4 w-full">
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

             <div className="flex items-center gap-1 md:gap-2 order-1 sm:order-2">
                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" onClick={toggleRepeat} className={isRepeating ? 'text-primary' : ''} aria-pressed={isRepeating} aria-label="Repeat Verse" disabled={audioActionDisabled}>
                         <Repeat className="h-5 w-5" />
                     </Button>
                 </TooltipTrigger> <TooltipContent><p>{isRepeating ? 'Disable Repeat' : 'Repeat Verse'}</p></TooltipContent> </Tooltip> </TooltipProvider>

                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                    <Button variant="default" size="icon" onClick={togglePlayPause} disabled={audioActionDisabled} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-10 h-10 rounded-full shadow-lg bg-primary hover:bg-primary/90 relative">
                        {isAudioLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                                <svg className="animate-spin h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg>
                            </div>
                        )}
                        {!isAudioLoading && (isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />)}
                    </Button>
                 </TooltipTrigger> <TooltipContent><p>{isPlaying ? 'Pause' : 'Play'}</p></TooltipContent> </Tooltip> </TooltipProvider>

                 <TooltipProvider> <Tooltip> <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleMute} aria-pressed={isMuted} aria-label={isMuted ? 'Unmute' : 'Mute'} disabled={audioActionDisabled}>
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                 </TooltipTrigger> <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent> </Tooltip> </TooltipProvider>
             </div>


            <div className="flex items-center gap-2 order-3 sm:order-3 justify-end">
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

                  <Slider
                    value={[volume]}
                    onValueChange={handleVolumeChange}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-20 hidden md:flex h-9 items-center"
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
