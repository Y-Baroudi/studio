import React, { useState } from 'react'; // Added useState
import type { Verse } from '@/services/alquran-cloud';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Bookmark, Tag, Share2, StickyNote } from 'lucide-react'; // Import icons
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"; // Import ContextMenu components

interface VerseDisplayProps {
  verse: Verse;
  fontSize: number; // Base font size for English text in pixels
  onContextMenu: (verseNumber: number) => void; // Handler for context menu actions
}

export function VerseDisplay({ verse, fontSize, onContextMenu }: VerseDisplayProps) {
  // --- State ---
  const [isBookmarked, setIsBookmarked] = useState(false); // Example state for bookmark
  const [isHighlighted, setIsHighlighted] = useState(false); // Example state for highlight

  // --- Styles ---
  const englishStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: '1.6',
    letterSpacing: '0.01em',
  };

  const arabicStyle = {
    fontSize: '24px', // Increased size
    lineHeight: '1.8', // Adjusted line height
    letterSpacing: '0.005em',
  };

  // --- Bismillah Logic ---
  const ayahNumberInSurah = parseInt(verse.verseReference.split(':')[1], 10);
  const showBismillah = ayahNumberInSurah === 1 && verse.surah?.number !== 1 && verse.surah?.number !== 9;
  const bismillahText = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

  // --- Verse Number ---
  const ayahNumber = verse.verseReference.split(':')[1];

  // --- Event Handlers ---
  const handleVerseClick = () => {
    // Placeholder for click/tap action (e.g., toggle highlight)
    setIsHighlighted(!isHighlighted);
    console.log(`Verse ${verse.verseNumber} clicked/tapped.`);
  };

  // --- Context Menu Action Handlers (Placeholders) ---
  const handleAddNote = () => {
    console.log(`Add Note clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber); // Propagate event if needed
    // Open Notes Sidebar or a modal here
  };

  const handleTagVerse = () => {
    console.log(`Tag Verse clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber);
    // Implement tagging logic here
  };

  const handleShareVerse = () => {
    console.log(`Share clicked for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber);
    // Implement sharing logic (e.g., using navigator.share)
  };

  const handleBookmarkToggle = () => {
    setIsBookmarked(!isBookmarked);
    console.log(`Bookmark ${!isBookmarked ? 'added' : 'removed'} for verse ${verse.verseNumber}`);
    onContextMenu(verse.verseNumber);
    // Save bookmark state persistence logic here
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* Added border directly here */}
        <Card
          className={cn(
            "bg-card border border-border shadow-md flex flex-col transition-colors duration-200",
            isHighlighted && "bg-accent/10 border-accent" // Apply highlight style conditionally
          )}
          onClick={handleVerseClick} // Add click handler for interaction
        >
          <CardHeader className="pb-2 pt-4 px-4 md:px-6 relative"> {/* Added relative for bookmark */}
            {/* Optional Bismillah */}
            {showBismillah && (
              <p className="font-bismillah text-center text-foreground mb-4">
                {bismillahText}
              </p>
            )}
            <div className="flex justify-between items-start gap-4">
              {/* English Title */}
              <div className="text-left">
                <CardTitle className="text-lg font-semibold text-foreground">
                   {verse.surah?.number}. {verse.surah?.englishName ?? 'The Quran'}
                </CardTitle>
                <CardDescription className="text-left text-foreground/70">
                  {verse.surah?.englishNameTranslation} ({verse.surah?.numberOfAyahs} Ayahs)
                </CardDescription>
              </div>
              {/* Arabic Title */}
              <div className="text-right">
                {/* Use font-amiri for the Arabic title */}
                <CardTitle className="text-lg font-amiri font-normal text-foreground">
                   {verse.surah?.name ? `${verse.surah.name} - ${verse.surah.number}` : 'القرآن'}
                </CardTitle>
                 {/* Make revelation type smaller and italic */}
                <CardDescription className="text-right text-[0.6rem] italic text-foreground/60"> {/* Reduced font size */}
                   {verse.surah?.revelationType}
                 </CardDescription>
              </div>
            </div>
             {/* Bookmark Indicator */}
             {isBookmarked && (
                 <div className="absolute top-3 right-3 text-primary animate-pulse"> {/* Positioned top-right */}
                     <Bookmark size={16} fill="currentColor" />
                 </div>
             )}
          </CardHeader>
          <Separator className="mx-4 md:mx-6" />
          <CardContent className="p-4 md:p-6 flex-grow">
            {/* Two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-x-6 gap-y-4">

              {/* English Translation Section (Left) */}
              <div className="order-2 md:order-1">
                <p className="text-foreground text-left tracking-wide" style={englishStyle}>
                  <span className="text-xs font-semibold opacity-70 mr-1">{ayahNumber}.</span>
                  {verse.englishTranslation}
                </p>
              </div>

              {/* Vertical Separator */}
              <Separator orientation="vertical" className="h-auto hidden md:block order-2" />

              {/* Arabic Text Section (Right) */}
              <div dir="rtl" className="order-1 md:order-3">
                {/* Use font-amiri and apply specific Arabic styles */}
                <p className="font-amiri text-foreground text-right tracking-normal" style={arabicStyle}>
                   {verse.arabicText}
                   {/* Styling for the Arabic verse number indicator */}
                   <span className="text-sm font-normal opacity-70 mx-1 font-sans">﴿{ayahNumber}﴾</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleAddNote}>
          <StickyNote className="mr-2 h-4 w-4" />
          <span>Add Note</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleTagVerse}>
          <Tag className="mr-2 h-4 w-4" />
          <span>Tag Verse</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleShareVerse}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>Share</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleBookmarkToggle}>
          <Bookmark className="mr-2 h-4 w-4" />
          <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Verse'}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}