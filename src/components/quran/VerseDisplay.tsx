
import React, { useState, useEffect } from 'react'; // Added useEffect
import type { Verse } from '@/services/alquran-cloud';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Bookmark, Tag, Share2, StickyNote, Volume2 } from 'lucide-react'; // Import icons
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
}

export function VerseDisplay({ verse, fontSize, arabicFontSize, lineHeight, onContextMenu }: VerseDisplayProps) {
  // --- State ---
  const [isBookmarked, setIsBookmarked] = useState(false); // Example state for bookmark
  const [isHighlighted, setIsHighlighted] = useState(false); // Example state for highlight
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
    // Cleanup function to stop speaking if component unmounts
    return () => {
        if (synth && synth.speaking) {
            synth.cancel();
            setIsSpeaking(false);
        }
    };
}, [synth]); // Re-run only if synth changes (which it shouldn't often)


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
  const ayahNumberInSurah = verse.verseReference ? parseInt(verse.verseReference.split(':')[1], 10) : 0;
  const showBismillah = ayahNumberInSurah === 1 && verse.surah?.number !== 1 && verse.surah?.number !== 9;
  const bismillahText = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

  // --- Verse Number ---
  const ayahNumber = verse.verseReference ? verse.verseReference.split(':')[1] : '?';

  // --- Event Handlers ---
  const handleVerseClick = () => {
    // Toggle highlight on click/tap
    setIsHighlighted(!isHighlighted);
    console.log(`Verse ${verse.verseNumber} clicked/tapped. Highlight: ${!isHighlighted}`);
  };

  // --- Context Menu Action Handlers ---
  const handleAddNote = () => {
    console.log(`Add Note clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber); // Propagate event to open sidebar/modal
    toast({ title: "Note", description: `Add note for Surah ${verse.surah?.englishName}, Ayah ${ayahNumber}.` });
  };

  const handleTagVerse = () => {
    console.log(`Tag Verse clicked for verse ${verse.verseNumber}`);
    // onContextMenu(verse.verseNumber); // Might not need propagation for this
    toast({ title: "Tag", description: `Tagging functionality for verse ${verse.verseNumber} (coming soon).` });
    // Implement tagging logic here
  };

  const handleShareVerse = async () => {
    console.log(`Share clicked for verse ${verse.verseNumber}`);
    const shareData = {
        title: `Quran Verse: ${verse.surah?.englishName} ${verse.verseReference}`,
        text: `"${verse.englishTranslation}"\n\n${verse.arabicText}\n\n(Quran ${verse.verseReference})`,
        // url: window.location.href // Optional: share the current page URL
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
            toast({ title: "Shared", description: `Verse ${verse.verseReference} shared.` });
        } else {
            // Fallback for browsers that don't support navigator.share
            await navigator.clipboard.writeText(shareData.text);
            toast({ title: "Copied", description: `Verse ${verse.verseReference} copied to clipboard.` });
        }
    } catch (err) {
        console.error("Share failed:", err);
        toast({ title: "Share Error", description: "Could not share or copy the verse.", variant: "destructive" });
    }
    // onContextMenu(verse.verseNumber); // Might not need propagation
  };

  const handleBookmarkToggle = () => {
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    // Save bookmark state persistence logic here (e.g., localStorage, database)
    console.log(`Bookmark ${newState ? 'added' : 'removed'} for verse ${verse.verseNumber}`);
    toast({ title: newState ? "Bookmarked" : "Bookmark Removed", description: `Verse ${verse.verseReference} ${newState ? 'bookmarked' : 'bookmark removed'}.` });
    // onContextMenu(verse.verseNumber); // Might not need propagation
  };

    // --- Text-to-Speech Handler ---
    const handleSpeakTranslation = () => {
        if (!synth) {
            toast({ title: "Speech Error", description: "Text-to-speech is not available.", variant: "destructive" });
            return;
        }
        if (synth.speaking) {
            synth.cancel(); // Stop current speech if any
            setIsSpeaking(false);
            if (isSpeaking) return; // If we just stopped it, don't immediately restart
        }

        if (verse.englishTranslation) {
            const utterance = new SpeechSynthesisUtterance(verse.englishTranslation);
            // Optional: Configure voice, rate, pitch etc.
            // const voices = synth.getVoices();
            // utterance.voice = voices.find(v => v.lang === 'en-US') || voices[0];
            utterance.rate = 0.9; // Slightly slower for clarity
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
  // Handle cases where verse data might be partially missing
  const displayArabicText = verse.arabicText ?? "Arabic text not available.";
  const displayEnglishTranslation = verse.englishTranslation ?? "Translation not available.";


  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          className={cn(
            "bg-card border border-border shadow-md flex flex-col transition-colors duration-200 cursor-pointer", // Added cursor-pointer
            isHighlighted && "bg-accent/10 border-primary/50 ring-1 ring-primary/50" // Enhanced highlight style
          )}
          onClick={handleVerseClick} // Use onClick for tap/click highlight
          aria-label={`Verse ${verse.verseReference}. Arabic: ${displayArabicText}. Translation: ${displayEnglishTranslation}`}
        >
          <CardHeader className="pb-2 pt-4 px-4 md:px-6 relative">
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
                   {verse.surah?.name ? `${verse.surah.name}` : ''} {/* Display only Arabic name */}
                </CardTitle>
                <CardDescription className="text-right text-[0.6rem] italic text-foreground/60">
                   {verse.surah?.revelationType ?? ''}
                 </CardDescription>
              </div>
            </div>
             {/* Bookmark Indicator */}
             {isBookmarked && (
                 <div className="absolute top-3 right-3 text-primary animate-pulse" title="Bookmarked">
                     <Bookmark size={16} fill="currentColor" />
                     <span className="sr-only">Bookmarked</span>
                 </div>
             )}
          </CardHeader>
          <Separator className="mx-4 md:mx-6" />
          <CardContent className="p-4 md:p-6 flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-x-6 gap-y-4">
              {/* English Translation (Left) */}
              <div className="order-2 md:order-1">
                <p className="text-foreground text-left tracking-wide" style={englishStyle}>
                  <span className="text-xs font-semibold opacity-70 mr-1">{ayahNumber}.</span>
                  {displayEnglishTranslation}
                </p>
              </div>
              {/* Vertical Separator */}
              <Separator orientation="vertical" className="h-auto hidden md:block order-2" />
              {/* Arabic Text (Right) */}
              <div dir="rtl" className="order-1 md:order-3">
                <p className="font-amiri text-foreground text-right tracking-normal" style={arabicStyle}>
                   {displayArabicText}
                   <span className="text-sm font-normal opacity-70 mx-1 font-sans inline-block" aria-hidden="true">﴿{ayahNumber}﴾</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56"> {/* Increased width */}
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
      </ContextMenuContent>
    </ContextMenu>
  );
}
