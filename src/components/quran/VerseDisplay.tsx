import React, { useState, useEffect } from 'react'; // Added useEffect
import type { Verse } from '@/services/alquran-cloud';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Bookmark, Tag, Share2, StickyNote, Volume2, PlayCircle, PauseCircle } from 'lucide-react'; // Added Play/Pause icons
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator, // Added separator
} from "@/components/ui/context-menu";
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface VerseDisplayProps {
  verse: Verse;
  fontSize: number; // Base font size for English text in pixels
  arabicFontSize: number; // Font size for Arabic text in pixels
  lineHeight: number; // Line height multiplier for both texts
  onContextMenu: (verseNumber: number) => void; // Handler for context menu actions
  onClick: (verseNumber: number) => void; // Handler for click/tap actions
  isHighlighted: boolean; // Is this verse currently focused/selected?
  isPlaying: boolean; // Is audio currently playing for this verse?
}

export function VerseDisplay({
    verse,
    fontSize,
    arabicFontSize,
    lineHeight,
    onContextMenu,
    onClick, // Receive onClick handler
    isHighlighted,
    isPlaying
}: VerseDisplayProps) {
  // --- State ---
  const [isBookmarked, setIsBookmarked] = useState(false); // Example state for bookmark
  const [synth, setSynth] = useState<SpeechSynthesis | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { toast } = useToast();

   // --- Speech Synthesis Setup ---
   useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setSynth(window.speechSynthesis);
    } else {
        console.warn("Speech synthesis not supported in this browser.");
    }
    // Cleanup function to cancel speech if component unmounts while speaking
    return () => {
        if (synth && synth.speaking) {
             console.log("Cancelling speech synthesis on unmount");
             synth.cancel();
             setIsSpeaking(false);
         }
    };
   }, [synth]); // Run only when synth object changes


  // --- Styles ---
  const englishStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeight}`, // Apply line height
    letterSpacing: '0.01em',
  };

  const arabicStyle = {
    fontSize: `${arabicFontSize}px`, // Use arabicFontSize prop
    lineHeight: `${lineHeight}`, // Apply line height
    letterSpacing: '0.005em',
  };

  // --- Bismillah Logic ---
  const ayahNumberInSurah = verse.ayahNumberInSurah;
  const showBismillah = ayahNumberInSurah === 1 && verse.surah?.number !== 1 && verse.surah?.number !== 9;
  const bismillahText = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

  // --- Verse Number ---
  // Ensure verseReference exists and split safely
  const ayahNumberDisplay = verse.verseReference?.split(':')[1] ?? '?';


  // --- Context Menu Action Handlers ---
  const handleAddNote = () => {
    console.log(`Add Note clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber); // Propagate event to open sidebar/modal
    // Toast is now handled in the sidebar potentially
    // toast({ title: "Note", description: `Add note for Surah ${verse.surah?.englishName}, Ayah ${ayahNumberDisplay}.` });
  };

  const handleTagVerse = () => {
    console.log(`Tag Verse clicked for verse ${verse.verseNumber}`);
    toast({ title: "Tag", description: `Tagging functionality for verse ${verse.verseNumber} (coming soon).` });
  };

  const handleShareVerse = async () => {
    console.log(`Share clicked for verse ${verse.verseNumber}`);
    const shareData = {
        title: `Quran Verse: ${verse.surah?.englishName ?? 'Surah'} ${verse.verseReference ?? ''}`,
        text: `"${verse.englishTranslation ?? 'Translation not available.'}"\n\n${verse.arabicText ?? ''}\n\n(Quran ${verse.verseReference ?? ''})`,
        url: window.location.href // Optional: share the current URL
    };
    try {
        if (navigator.share && navigator.canShare(shareData)) {
            await navigator.share(shareData);
            toast({ title: "Shared", description: `Verse ${verse.verseReference} shared.` });
        } else if (navigator.clipboard) {
            // Fallback to copy for desktop or if navigator.share is not supported
            await navigator.clipboard.writeText(shareData.text);
            toast({ title: "Copied", description: `Verse ${verse.verseReference} copied to clipboard.` });
        } else {
             toast({ title: "Share Error", description: "Sharing/Copying not supported on this browser.", variant: "destructive" });
        }
    } catch (err) {
        // Handle specific errors like AbortError if user cancels share
        if (err instanceof Error && err.name === 'AbortError') {
             console.log("Share cancelled by user.");
         } else {
            console.error("Share failed:", err);
            toast({ title: "Share Error", description: "Could not share or copy the verse.", variant: "destructive" });
        }
    }
  };

  const handleBookmarkToggle = () => {
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    // TODO: Implement actual bookmark persistence logic (e.g., using localStorage or backend)
    console.log(`Bookmark ${newState ? 'added' : 'removed'} for verse ${verse.verseNumber}`);
    toast({ title: newState ? "Bookmarked" : "Bookmark Removed", description: `Verse ${verse.verseReference} ${newState ? 'bookmarked' : 'bookmark removed'}.` });
  };

    // --- Text-to-Speech Handler ---
    const handleSpeakTranslation = () => {
        if (!synth) {
            toast({ title: "Speech Error", description: "Text-to-speech is not available.", variant: "destructive" });
            return;
        }

         // If speaking, stop it. If not speaking, start it.
        if (isSpeaking) {
            console.log("Cancelling ongoing speech.");
            synth.cancel(); // Stop current speech
             setIsSpeaking(false);
        } else if (verse.englishTranslation) {
             console.log("Starting speech for:", verse.englishTranslation);
            const utterance = new SpeechSynthesisUtterance(verse.englishTranslation);
            // Optional: Configure voice, rate, pitch
            // const voices = synth.getVoices();
            // utterance.voice = voices.find(v => v.lang === 'en-US'); // Example voice selection
            utterance.rate = 0.9;
            utterance.pitch = 1.0;

            // Event listeners for the utterance lifecycle
            utterance.onstart = () => {
                console.log("Speech started.");
                setIsSpeaking(true);
            };
             utterance.onend = () => {
                console.log("Speech ended.");
                setIsSpeaking(false);
            };
             utterance.onerror = (event) => {
                 console.error('Speech synthesis error:', event.error);
                 toast({ title: "Speech Error", description: `Could not speak text: ${event.error}`, variant: "destructive" });
                 setIsSpeaking(false);
            };
             utterance.onboundary = (event) => {
                 // You could potentially highlight words as they are spoken
                 // console.log(`Speech boundary: ${event.name} at char ${event.charIndex}`);
             };

             // Clear queue before speaking new utterance
             synth.cancel();
             synth.speak(utterance);
        } else {
             toast({ title: "Speech Error", description: "No translation available to speak.", variant: "destructive" });
        }
    };


  // --- Render Logic ---
  // Provide default values if parts of the verse object are missing
  const surahName = verse.surah?.englishName ?? 'Surah';
  const surahNameArabic = verse.surah?.name ?? '';
  const surahTranslation = verse.surah?.englishNameTranslation ?? 'Translation';
  const surahAyahCount = verse.surah?.numberOfAyahs ?? '?';
  const revelationType = verse.surah?.revelationType ?? '';
  const displayArabicText = verse.arabicText ?? "Arabic text not available.";
  const displayEnglishTranslation = verse.englishTranslation ?? "Translation not available.";


  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* Use a standard div as trigger, add onClick handler */}
        <div
          className={cn(
            "border border-border rounded-lg shadow-sm transition-colors duration-200 overflow-hidden cursor-pointer hover:border-primary/50", // Add hover effect
             isHighlighted && "ring-2 ring-primary/80 border-primary/80", // Highlight focused verse
             isPlaying && "bg-accent/5 dark:bg-accent/10", // Subtle background for playing verse
             "bg-card" // Ensure background color is applied
          )}
          onClick={() => onClick(verse.verseNumber)} // Call passed onClick handler
          aria-current={isHighlighted ? "true" : "false"}
          aria-label={`Verse ${verse.verseReference}. Arabic: ${displayArabicText}. Translation: ${displayEnglishTranslation}`}
          role="article" // Semantically a piece of content
          tabIndex={0} // Make it focusable
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(verse.verseNumber); }} // Allow activation with keyboard
        >
          {/* Header Section */}
          <CardHeader className="pb-2 pt-4 px-4 md:px-6 relative bg-card/50 dark:bg-card/70"> {/* Slightly different header background */}
            {/* Bismillah (conditionally rendered) */}
            {showBismillah && (
              <p className="font-bismillah text-center text-foreground mb-4 text-2xl md:text-3xl" aria-hidden="true">
                {bismillahText}
              </p>
            )}
            {/* Surah Info */}
            <div className="flex justify-between items-start gap-4">
              {/* English Info */}
              <div className="text-left">
                <CardTitle className="text-base md:text-lg font-semibold text-foreground">
                   {verse.surah?.number}. {surahName}
                </CardTitle>
                <CardDescription className="text-left text-foreground/70 text-xs md:text-sm">
                  {surahTranslation} ({surahAyahCount} Ayahs)
                </CardDescription>
              </div>
              {/* Arabic Info */}
              <div className="text-right">
                 {/* Use CardTitle for semantic heading, but style appropriately */}
                <CardTitle className="text-xl md:text-2xl font-amiri font-semibold text-foreground" lang="ar" dir="rtl">
                   {surahNameArabic}
                </CardTitle>
                <CardDescription className="text-right text-[0.6rem] md:text-xs italic text-foreground/60">
                   {revelationType}
                 </CardDescription>
              </div>
            </div>
             {/* Indicators */}
             <div className="absolute bottom-1 left-1 flex items-center gap-2">
                 {isPlaying && (
                     <div className="text-primary animate-pulse" title="Playing">
                         <PlayCircle size={16} fill="currentColor" />
                         <span className="sr-only">Playing</span>
                     </div>
                 )}
             </div>
             <div className="absolute top-2 right-2 flex items-center gap-2">
                  {isBookmarked && (
                     <div className="text-primary" title="Bookmarked">
                         <Bookmark size={14} fill="currentColor" />
                         <span className="sr-only">Bookmarked</span>
                     </div>
                 )}
                 {/* Add other indicators like notes icon here */}
             </div>
          </CardHeader>

           <Separator className="mx-4 md:mx-6 my-0" /> {/* Reduce separator margin */}

           {/* Content Section (Arabic and Translation) */}
           <CardContent className="p-4 md:p-6 flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-x-6 gap-y-4">
               {/* Arabic Text (Right for LTR context, but RTL content) */}
               <div dir="rtl" className="order-1 md:order-3 flex flex-col items-end">
                  <p className="font-amiri text-foreground text-right tracking-normal" style={arabicStyle} lang="ar">
                    {displayArabicText}
                    {/* Ayah number marker - stylize as needed */}
                    <span className="text-sm font-normal text-primary opacity-90 mx-1 font-sans inline-block select-none" aria-hidden="true">
                        ﴿{ayahNumberDisplay}﴾
                    </span>
                  </p>
               </div>

              {/* Vertical Separator (Hidden on mobile) */}
              <Separator orientation="vertical" className="h-auto hidden md:block order-2 border-border/50" />

              {/* English Translation (Left for LTR context) */}
               <div className="order-2 md:order-1 flex flex-col items-start">
                  <p className="text-foreground text-left tracking-wide" style={englishStyle} lang="en">
                    {/* Verse number marker */}
                    <span className="text-xs font-semibold text-primary opacity-80 mr-1 select-none">{ayahNumberDisplay}.</span>
                    {displayEnglishTranslation}
                  </p>
               </div>

            </div>
          </CardContent>
        </div>
      </ContextMenuTrigger>

      {/* Context Menu Definition */}
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleAddNote} disabled={!onContextMenu}>
          <StickyNote className="mr-2 h-4 w-4" />
          <span>Add/View Note</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleTagVerse} disabled> {/* Disable tagging for now */}
          <Tag className="mr-2 h-4 w-4" />
          <span>Tag Verse (Soon)</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleShareVerse}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>Share / Copy</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleBookmarkToggle}>
          <Bookmark className="mr-2 h-4 w-4" />
          <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Verse'}</span>
        </ContextMenuItem>
         <ContextMenuSeparator />
         <ContextMenuItem onClick={handleSpeakTranslation} disabled={!synth || !verse.englishTranslation}>
           <Volume2 className="mr-2 h-4 w-4" />
           <span>{isSpeaking ? 'Stop Speaking' : 'Speak Translation'}</span>
         </ContextMenuItem>
         {/* Future: Add direct play/pause from context menu? */}
         {/* <ContextMenuItem onClick={() => console.log('Play/Pause from context')} disabled={!verse.audioUrl}>
             {isPlaying ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
             <span>{isPlaying ? 'Pause Audio' : 'Play Audio'}</span>
         </ContextMenuItem> */}
      </ContextMenuContent>
    </ContextMenu>
  );
}
