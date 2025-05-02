

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
  isHighlighted: boolean; // Is this verse currently focused/selected?
  isPlaying: boolean; // Is audio currently playing for this verse?
}

export function VerseDisplay({
    verse,
    fontSize,
    arabicFontSize,
    lineHeight,
    onContextMenu,
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
    return () => {
        if (synth && synth.speaking) { synth.cancel(); setIsSpeaking(false); }
    };
   }, [synth]);


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
  const ayahNumberDisplay = verse.verseReference ? verse.verseReference.split(':')[1] : '?';

  // --- Event Handlers ---
  const handleVerseClick = () => {
    // Clicking a verse could set it as the 'current' verse for playback/notes
    // This might be handled in the parent (ReaderView) now to update the main currentVerseNumber state
    console.log(`Verse ${verse.verseNumber} clicked/tapped.`);
    // Optionally trigger context menu or specific action on simple click
    // For now, highlight is driven by isHighlighted prop from parent
  };

  // --- Context Menu Action Handlers ---
  const handleAddNote = () => {
    console.log(`Add Note clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber); // Propagate event to open sidebar/modal
    toast({ title: "Note", description: `Add note for Surah ${verse.surah?.englishName}, Ayah ${ayahNumberDisplay}.` });
  };

  const handleTagVerse = () => {
    console.log(`Tag Verse clicked for verse ${verse.verseNumber}`);
    toast({ title: "Tag", description: `Tagging functionality for verse ${verse.verseNumber} (coming soon).` });
  };

  const handleShareVerse = async () => {
    console.log(`Share clicked for verse ${verse.verseNumber}`);
    const shareData = {
        title: `Quran Verse: ${verse.surah?.englishName} ${verse.verseReference}`,
        text: `"${verse.englishTranslation}"\n\n${verse.arabicText}\n\n(Quran ${verse.verseReference})`,
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
            toast({ title: "Shared", description: `Verse ${verse.verseReference} shared.` });
        } else {
            await navigator.clipboard.writeText(shareData.text);
            toast({ title: "Copied", description: `Verse ${verse.verseReference} copied to clipboard.` });
        }
    } catch (err) {
        console.error("Share failed:", err);
        toast({ title: "Share Error", description: "Could not share or copy the verse.", variant: "destructive" });
    }
  };

  const handleBookmarkToggle = () => {
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    // Save bookmark state persistence logic here
    console.log(`Bookmark ${newState ? 'added' : 'removed'} for verse ${verse.verseNumber}`);
    toast({ title: newState ? "Bookmarked" : "Bookmark Removed", description: `Verse ${verse.verseReference} ${newState ? 'bookmarked' : 'bookmark removed'}.` });
  };

    // --- Text-to-Speech Handler ---
    const handleSpeakTranslation = () => {
        if (!synth) {
            toast({ title: "Speech Error", description: "Text-to-speech is not available.", variant: "destructive" });
            return;
        }
        if (synth.speaking) {
            synth.cancel();
            setIsSpeaking(false);
            if (isSpeaking) return;
        }

        if (verse.englishTranslation) {
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
        {/* Use a standard div as trigger for better layout control within ScrollArea */}
        <div
          className={cn(
            "border border-border rounded-lg shadow-sm transition-colors duration-200 overflow-hidden",
             isHighlighted && "ring-2 ring-primary/80", // Highlight focused verse
             isPlaying && "bg-accent/5 dark:bg-accent/10" // Subtle background for playing verse
          )}
          onClick={handleVerseClick}
          aria-label={`Verse ${verse.verseReference}. Arabic: ${displayArabicText}. Translation: ${displayEnglishTranslation}`}
        >
          <CardHeader className="pb-2 pt-4 px-4 md:px-6 relative bg-card"> {/* Header background */}
            {/* Bismillah */}
            {showBismillah && (
              <p className="font-bismillah text-center text-foreground mb-4" aria-hidden="true">
                {bismillahText}
              </p>
            )}
            <div className="flex justify-between items-start gap-4">
              {/* English Info */}
              <div className="text-left">
                <CardTitle className="text-lg font-semibold text-foreground">
                   {verse.surah?.number}. {verse.surah?.englishName ?? 'Surah'}
                </CardTitle>
                <CardDescription className="text-left text-foreground/70 text-sm">
                  {verse.surah?.englishNameTranslation ?? 'Translation'} ({verse.surah?.numberOfAyahs ?? '?'} Ayahs)
                </CardDescription>
              </div>
              {/* Arabic Info */}
              <div className="text-right">
                <CardTitle className="text-lg font-amiri font-normal text-foreground">
                   {verse.surah?.name ? `${verse.surah.name}` : ''}
                </CardTitle>
                <CardDescription className="text-right text-[0.6rem] italic text-foreground/60">
                   {verse.surah?.revelationType ?? ''}
                 </CardDescription>
              </div>
            </div>
             {/* Play/Pause Indicator */}
             {isPlaying && (
                 <div className="absolute bottom-2 left-2 text-primary animate-pulse" title="Playing">
                     <PlayCircle size={18} fill="currentColor" />
                     <span className="sr-only">Playing</span>
                 </div>
             )}
             {/* Bookmark Indicator */}
             {isBookmarked && (
                 <div className="absolute top-3 right-3 text-primary" title="Bookmarked">
                     <Bookmark size={16} fill="currentColor" />
                     <span className="sr-only">Bookmarked</span>
                 </div>
             )}
          </CardHeader>
          <Separator className="mx-4 md:mx-6" />
          <CardContent className="p-4 md:p-6 flex-grow bg-card"> {/* Content background */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-x-6 gap-y-4">
              {/* English Translation (Left) */}
              <div className="order-2 md:order-1">
                <p className="text-foreground text-left tracking-wide" style={englishStyle}>
                  <span className="text-xs font-semibold opacity-70 mr-1">{ayahNumberDisplay}.</span>
                  {displayEnglishTranslation}
                </p>
              </div>
              {/* Vertical Separator */}
              <Separator orientation="vertical" className="h-auto hidden md:block order-2" />
              {/* Arabic Text (Right) */}
              <div dir="rtl" className="order-1 md:order-3">
                <p className="font-amiri text-foreground text-right tracking-normal" style={arabicStyle}>
                   {displayArabicText}
                   <span className="text-sm font-normal opacity-70 mx-1 font-sans inline-block" aria-hidden="true">﴿{ayahNumberDisplay}﴾</span>
                </p>
              </div>
            </div>
          </CardContent>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleAddNote}>
          <StickyNote className="mr-2 h-4 w-4" />
          <span>Add/View Note</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleTagVerse}>
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
         <ContextMenuItem onClick={handleSpeakTranslation} disabled={!synth || isSpeaking || !verse.englishTranslation}>
           <Volume2 className="mr-2 h-4 w-4" />
           <span>{isSpeaking ? 'Stop Speaking' : 'Speak Translation'}</span>
         </ContextMenuItem>
         {/* Add option to Play/Pause audio directly from context menu? */}
         {/* <ContextMenuItem onClick={() => console.log('Play/Pause from context')}>
             {isPlaying ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
             <span>{isPlaying ? 'Pause Audio' : 'Play Audio'}</span>
         </ContextMenuItem> */}
      </ContextMenuContent>
    </ContextMenu>
  );
}
