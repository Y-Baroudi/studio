import React, { useState, useEffect } from 'react'; // Added useEffect
import type { Verse } from '@/services/alquran-cloud';
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
    fontSize, // Prop is currently unused, Tailwind classes define size
    arabicFontSize, // Prop is currently unused, Tailwind classes define size
    lineHeight, // Prop is currently unused, Tailwind classes define size
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
    // Ensure this runs only on the client
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
   }, [synth]); // Dependency on synth

  // --- Verse Number ---
  // Ensure verseReference exists and split safely
  const ayahNumberDisplay = verse.ayahNumberInSurah?.toString() ?? '?'; // Use ayahNumberInSurah directly
  const surahNumberDisplay = verse.surah?.number?.toString() ?? '?';
  const verseReferenceDisplay = `${surahNumberDisplay}:${ayahNumberDisplay}`;


  // --- Context Menu Action Handlers ---
  const handleAddNote = () => {
    console.log(`Add Note clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber); // Propagate event to open sidebar/modal
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

             // Clear queue before speaking new utterance
             synth.cancel();
             synth.speak(utterance);
        } else {
             toast({ title: "Speech Error", description: "No translation available to speak.", variant: "destructive" });
        }
    };


  // --- Render Logic ---
  // Provide default values if parts of the verse object are missing
  const displayArabicText = verse.arabicText ?? "Arabic text not available.";
  const displayEnglishTranslation = verse.englishTranslation ?? "Translation not available.";


  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* Main Verse Container */}
        <div
          className={cn(
            "relative border-b border-border/30 py-4 px-2 md:px-4 mb-6 pb-10", // Increased bottom padding for verse numbers
            "transition-colors duration-200 cursor-pointer",
            "hover:bg-accent/5 dark:hover:bg-accent/10",
            isHighlighted && "bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/50 border-l-2 border-primary pl-3",
            isPlaying && "bg-accent/10 dark:bg-accent/15 rounded-md"
          )}
          onClick={() => onClick(verse.verseNumber)}
          aria-current={isHighlighted ? "true" : "false"}
          aria-label={`Verse ${verse.verseReference}. Arabic: ${displayArabicText}. Translation: ${displayEnglishTranslation}`}
          role="article"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(verse.verseNumber); }}
        >
           {/* Indicators (optional placement within verse) */}
           <div className="absolute top-1 right-1 flex items-center gap-1 pointer-events-none">
                 {isPlaying && (
                     <div className="text-primary animate-pulse" title="Playing">
                         <PlayCircle size={12} fill="currentColor" />
                         <span className="sr-only">Playing</span>
                     </div>
                 )}
                 {isBookmarked && (
                     <div className="text-primary" title="Bookmarked">
                         <Bookmark size={10} fill="currentColor" />
                         <span className="sr-only">Bookmarked</span>
                     </div>
                 )}
           </div>


           {/* Grid layout for Arabic and Translation */}
            <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] gap-x-6 gap-y-4">

               {/* Arabic Text Column (Right for LTR context, but RTL content) */}
                <div dir="rtl" className="order-1 flex flex-col items-end relative"> {/* Add relative positioning */}
                  {/* Arabic Text Paragraph */}
                  <p
                    className={cn(
                        "font-amiri text-foreground text-right! mb-2 text-arabic-display", // Use new class, force alignment
                        // Using CSS variables now for font size / line height: text-2xl leading-loose tracking-normal
                    )}
                    lang="ar"
                  >
                    {displayArabicText}
                  </p>
                  {/* Arabic Verse Number Indicator (absolute positioned) */}
                  <span
                    className={cn(
                      "verse-number-arabic text-foreground/60 font-sans", // Use new class
                      "absolute bottom-0 right-2" // Position bottom-right
                    )}
                    dir="ltr" // Ensure number renders LTR
                    aria-hidden="true"
                  >
                    ﴿{verseReferenceDisplay}﴾
                  </span>
               </div>

              {/* Vertical Separator (Hidden on mobile) */}
              <Separator orientation="vertical" className="h-auto hidden md:block order-2 border-border/50" />

              {/* English Translation Column (Left for LTR context) */}
                <div dir="ltr" className="order-2 md:order-1 flex flex-col items-start relative"> {/* Add relative positioning */}
                   {/* English Translation Paragraph */}
                  <p
                    className={cn(
                        "text-foreground text-left! text-translation-display", // Use new class, force alignment
                        // Using CSS variables now for font size / line height: text-base leading-relaxed tracking-wide
                    )}
                    lang="en"
                  >
                     {displayEnglishTranslation}
                  </p>
                  {/* English Verse Number Indicator (absolute positioned) */}
                  <span
                    className={cn(
                      "verse-number-translation text-foreground/60 font-sans", // Use new class
                       "absolute bottom-0 left-2" // Position bottom-left
                    )}
                    aria-hidden="true"
                  >
                    ({verseReferenceDisplay})
                  </span>
                </div>
            </div>
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
      </ContextMenuContent>
    </ContextMenu>
  );
}