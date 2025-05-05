
import React, { useState, useEffect } from 'react';
import type { Verse } from '@/services/alquran-cloud';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Bookmark, Tag, Share2, StickyNote, FileText, Repeat1 } from 'lucide-react'; // Added Repeat1, removed Volume2
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useToast } from '@/hooks/use-toast';
import { checkNoteExists } from '@/services/notes'; // Import function to check if notes or tags exist

interface VerseDisplayProps {
  verse: Verse;
  onContextMenu: (verseNumber: number) => void;
  onClick: (verseNumber: number) => void;
  isHighlighted: boolean;
  isPlaying: boolean;
  // hasNote: boolean; // Prop is now derived internally or via checkNoteExists
  // Add callback for repeating a verse
  onRepeatVerse?: (verseNumber: number) => void;
}

export function VerseDisplay({
    verse,
    onContextMenu,
    onClick,
    isHighlighted,
    isPlaying,
    onRepeatVerse, // Add the new prop
    // hasNote, // No longer passed as prop
}: VerseDisplayProps) {
  // --- State ---
  const [isBookmarked, setIsBookmarked] = useState(false); // Example state for bookmark
  // const [synth, setSynth] = useState<SpeechSynthesis | null>(null); // Removed synth state
  // const [isSpeaking, setIsSpeaking] = useState(false); // Removed speaking state
  const [verseHasNoteOrTag, setVerseHasNoteOrTag] = useState(false); // Local state for indicator
  const { toast } = useToast();

   // --- Check for notes/tags ---
   useEffect(() => {
      // Check note status when component mounts or verse number changes
      const check = checkNoteExists(verse.verseNumber);
      // console.log(`Verse ${verse.verseNumber} has note/tag: ${check}`);
      setVerseHasNoteOrTag(check);
   }, [verse.verseNumber]); // Re-check if the verse prop itself changes (which implies number change)


   // --- Speech Synthesis Removed ---


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

    // --- Repeat Verse Handler ---
    const handleRepeatVerse = () => {
        if (onRepeatVerse) {
            onRepeatVerse(verse.verseNumber);
             toast({ title: "Repeat Verse", description: `Repeating verse ${verseReferenceDisplay}.` });
        } else {
            console.warn("onRepeatVerse handler not provided to VerseDisplay.");
             toast({ title: "Repeat Error", description: "Cannot repeat verse.", variant: "destructive" });
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
                 {/* Note Indicator - Uses local state */}
                 {verseHasNoteOrTag && (
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
                     <span className="verse-number-inline" dir="ltr">
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
                     <span className="verse-number-inline" dir="ltr">
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
         {/* Removed Speak Translation */}
         {/* Add Repeat Verse Option */}
          <ContextMenuItem onClick={handleRepeatVerse} disabled={!onRepeatVerse}>
           <Repeat1 className="mr-2 h-4 w-4" /> {/* Use Repeat1 icon */}
           <span>Repeat Verse</span>
         </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
