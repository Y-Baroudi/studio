// src/components/quran/VerseDisplay.tsx
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
// Removed import of checkNoteExists - status will be passed as prop

interface VerseDisplayProps {
  verse: Verse;
  onContextMenu: (verseNumber: number) => void;
  onClick: (verseNumber: number) => void;
  isHighlighted: boolean;
  isPlaying: boolean; // Indicates if audio for *this* verse is actively playing
  isRepeating: boolean; // Indicates if repeat is active for *this* verse
  hasNoteOrTag: boolean; // NEW PROP: Indicates if a note or concept tag exists for this verse
  // Add callback for repeating a verse
  onRepeatVerse?: () => void; // Simplified toggle handler
}

export function VerseDisplay({
    verse,
    onContextMenu,
    onClick,
    isHighlighted,
    isPlaying,
    isRepeating, // Receive repeat state
    hasNoteOrTag, // Receive note/tag status as prop
    onRepeatVerse, // Add the new prop
}: VerseDisplayProps) {
  // --- State ---
  const [isBookmarked, setIsBookmarked] = useState(false); // Example state for bookmark
  const { toast } = useToast();

   // Note: No need for local state or useEffect to check notes, rely on `hasNoteOrTag` prop

   // --- Speech Synthesis Removed ---


  // --- Verse Number Formatting ---
  const verseReferenceDisplay = `${verse.surah?.number ?? '?'}:${verse.ayahNumberInSurah ?? '?'}`;
  // Inline verse number format
   const verseNumberFormatted = `(${verseReferenceDisplay})`; // Format for inline display with parentheses

  // --- Context Menu Action Handlers ---
  const handleAddNote = () => {
    console.log(`Add/View Note clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber); // Trigger parent's context menu handler (opens NotesSidebar)
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
    const handleRepeatVerseClick = () => {
        if (onRepeatVerse) {
            onRepeatVerse(); // Call the parent's toggle handler
            // Toast is handled in the parent (ReaderView) for consistency
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
            isHighlighted && "highlighted", // Highlight when focused/selected
            isPlaying && "playing" // Highlight differently when playing
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
            )}>
                <span className={cn(
                    "verse-number-badge",
                    // Highlight badge only when focused, not necessarily when playing/repeating
                    isHighlighted && "highlighted-badge"
                 )}>
                    {verseReferenceDisplay}
                    {/* Repeating indicator inside badge */}
                    {isRepeating && <Repeat1 className="ml-1.5 h-3 w-3 text-primary-foreground/80" />}
                     {/* Note Indicator - Uses prop */}
                     {hasNoteOrTag && (
                        <FileText className="note-indicator" />
                    )}
                </span>
            </div>


           {/* Flex container for text */}
            <div className={cn(
              "flex flex-col",
              "min-h-fit" // Use min-h-fit instead of fixed height
              )}>

               {/* Arabic Text */}
                <div className="order-1 py-1 md:py-0">
                  <p
                    className={cn(
                        "font-amiri text-foreground text-arabic-display arabic-text",
                        "mb-0" // Reduced margin
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
                        "mb-0" // Reduced margin
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
         {/* Add Repeat Verse Option */}
          <ContextMenuItem onClick={handleRepeatVerseClick} disabled={!onRepeatVerse}>
           <Repeat1 className={cn("mr-2 h-4 w-4", isRepeating && "text-primary")} /> {/* Use Repeat1 icon, highlight if repeating */}
           <span>{isRepeating ? "Stop Repeating" : "Repeat Verse"}</span>
         </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
