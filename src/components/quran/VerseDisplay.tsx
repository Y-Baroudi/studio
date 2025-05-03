
import React, { useState, useEffect } from 'react';
import type { Verse } from '@/services/alquran-cloud';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Bookmark, Tag, Share2, StickyNote, Volume2, FileText } from 'lucide-react'; // Added FileText for note indicator
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useToast } from '@/hooks/use-toast';

interface VerseDisplayProps {
  verse: Verse;
  onContextMenu: (verseNumber: number) => void;
  onClick: (verseNumber: number) => void;
  isHighlighted: boolean;
  isPlaying: boolean;
  hasNote: boolean; // New prop to indicate if note/tags exist
}

export function VerseDisplay({
    verse,
    onContextMenu,
    onClick,
    isHighlighted,
    isPlaying,
    hasNote, // Destructure new prop
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
    return () => {
        if (synth && synth.speaking) {
             console.log("Cancelling speech synthesis on unmount");
             synth.cancel();
             setIsSpeaking(false);
         }
    };
   }, [synth]);

  // --- Verse Number Formatting ---
  const verseReferenceDisplay = `${verse.surah?.number ?? '?'}:${verse.ayahNumberInSurah ?? '?'}`;
  const verseNumberFormatted = `(${verseReferenceDisplay})`; // Format for display

  // --- Context Menu Action Handlers ---
  const handleAddNote = () => {
    console.log(`Add/View Note clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber);
  };

  const handleTagVerse = () => {
    console.log(`Tag Verse clicked for verse ${verse.verseNumber}`);
    // Open the Notes sidebar which now handles tagging
    onContextMenu(verse.verseNumber);
    // toast({ title: "Tag Concepts", description: `Tag concepts for verse ${verseReferenceDisplay} in the notes panel.` });
  };

  const handleShareVerse = async () => {
    console.log(`Share clicked for verse ${verse.verseNumber}`);
    const shareData = {
        title: `Quran Verse: ${verse.surah?.englishName ?? 'Surah'} ${verseReferenceDisplay}`,
        text: `"${verse.englishTranslation ?? 'Translation not available.'}"\n\n${verse.arabicText ?? ''}\n\n(Quran ${verseReferenceDisplay})`,
        url: window.location.href
    };
    try {
        if (navigator.share && navigator.canShare(shareData)) {
            await navigator.share(shareData);
            toast({ title: "Shared", description: `Verse ${verseReferenceDisplay} shared.` });
        } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareData.text);
            toast({ title: "Copied", description: `Verse ${verseReferenceDisplay} copied to clipboard.` });
        } else {
             toast({ title: "Share Error", description: "Sharing/Copying not supported on this browser.", variant: "destructive" });
        }
    } catch (err) {
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
    // TODO: Implement actual bookmark persistence
    console.log(`Bookmark ${newState ? 'added' : 'removed'} for verse ${verse.verseNumber}`);
    toast({ title: newState ? "Bookmarked" : "Bookmark Removed", description: `Verse ${verseReferenceDisplay} ${newState ? 'bookmarked' : 'bookmark removed'}.` });
  };

    // --- Text-to-Speech Handler ---
    const handleSpeakTranslation = () => {
        if (!synth) {
            toast({ title: "Speech Error", description: "Text-to-speech is not available.", variant: "destructive" });
            return;
        }
        if (isSpeaking) {
            console.log("Cancelling ongoing speech.");
            synth.cancel();
             setIsSpeaking(false);
        } else if (verse.englishTranslation) {
             console.log("Starting speech for:", verse.englishTranslation);
            const utterance = new SpeechSynthesisUtterance(verse.englishTranslation);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.onstart = () => setIsSpeaking(true);
             utterance.onend = () => setIsSpeaking(false);
             utterance.onerror = (event) => {
                 console.error('Speech synthesis error:', event.error);
                 toast({ title: "Speech Error", description: `Could not speak text: ${event.error}`, variant: "destructive" });
                 setIsSpeaking(false);
            };
             synth.cancel();
             synth.speak(utterance);
        } else {
             toast({ title: "Speech Error", description: "No translation available to speak.", variant: "destructive" });
        }
    };


  // --- Render Logic ---
  const displayArabicText = verse.arabicText ?? "Arabic text not available.";
  const displayEnglishTranslation = verse.englishTranslation ?? "Translation not available.";


  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "verse-container", // Base class with styling from globals.css
            isHighlighted && "highlighted",
            isPlaying && "playing"
          )}
          onClick={() => onClick(verse.verseNumber)}
          aria-current={isHighlighted ? "true" : "false"}
          aria-label={`Verse ${verseReferenceDisplay}`}
          role="article"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(verse.verseNumber); }}
          data-surah={verse.surah?.number}
          data-verse={verse.ayahNumberInSurah}
          data-verse-abs={verse.verseNumber}
        >

           {/* Verse Number Badge */}
            <div className={cn(
               "verse-number-badge-container", // Wrapper for positioning
               isHighlighted && "highlighted-badge-container" // Optional: Style wrapper on highlight
            )}>
                <span className={cn(
                    "verse-number-badge",
                    isHighlighted && "highlighted-badge"
                 )}>
                    {verseReferenceDisplay}
                </span>
                 {/* Note Indicator */}
                 {hasNote && (
                    <FileText className="h-3 w-3 text-primary absolute -top-1 -right-1 opacity-80" />
                 )}
            </div>


           {/* Flex container for text */}
            <div className={cn(
              "flex flex-col",
              "min-h-fit"
              )}>

               {/* Arabic Text */}
                <div className="order-1 py-1 md:py-0">
                  <p
                    className={cn(
                        "font-amiri text-foreground text-arabic-display arabic-text",
                        "mb-0"
                    )}
                    lang="ar"
                    dir="rtl"
                  >
                    {displayArabicText}
                     {/* Inline Verse Number for Arabic */}
                     <span className="verse-number-inline text-muted-foreground/70" dir="ltr">
                       {verseNumberFormatted}
                     </span>
                  </p>
               </div>

              {/* English Translation */}
                <div className="order-2 py-1 md:py-0">
                  <p
                    className={cn(
                        "text-foreground text-translation-display translation-text",
                        "mb-0"
                    )}
                    lang="en"
                    dir="ltr"
                  >
                     {displayEnglishTranslation}
                      {/* Inline Verse Number for Translation */}
                     <span className="verse-number-inline text-muted-foreground/70" dir="ltr">
                        {verseNumberFormatted}
                     </span>
                  </p>
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
        <ContextMenuItem onClick={handleTagVerse}>
          <Tag className="mr-2 h-4 w-4" />
          <span>Tag Concepts</span>
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
