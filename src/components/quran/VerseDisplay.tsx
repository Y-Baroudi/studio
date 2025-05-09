// src/components/quran/VerseDisplay.tsx
'use client';

import React from 'react';
import type { VerseData } from '@/services/alquran-cloud';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Notebook, Tag, Share2, MessageSquare, Bookmark } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Badge } from '@/components/ui/badge';
import type { Concept } from '@/services/concepts'; // Import Concept type
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface VerseDisplayProps {
  verseData: VerseData;
  fontSize: number;
  arabicFontSize: number;
  lineHeight: number;
  onVerseSelect: (surah: number, verse: number) => void;
  onContextMenuAction: (action: string, verseData: VerseData) => void;
  isSelected: boolean;
  isPlaying: boolean;
  noteExists: boolean;
  conceptIds: string[]; // IDs of concepts tagged to this verse
  allConcepts: Concept[]; // All available concepts for color lookup
}

export function VerseDisplay({
  verseData,
  fontSize,
  arabicFontSize,
  lineHeight,
  onVerseSelect,
  onContextMenuAction,
  isSelected,
  isPlaying,
  noteExists,
  conceptIds,
  allConcepts,
}: VerseDisplayProps) {
  const verseReference = `${verseData.surah}:${verseData.numberInSurah}`;

  const handleAction = (action: string) => {
    onContextMenuAction(action, verseData);
  };

  const taggedConcepts = conceptIds.map(id => allConcepts.find(c => c.id === id)).filter(Boolean) as Concept[];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          className={cn(
            "verse-container mb-2 md:mb-3 rounded-lg shadow-sm transition-all duration-200 ease-in-out cursor-pointer border",
            isSelected ? "border-primary/60 ring-1 ring-primary/40 bg-primary/5" : "border-border hover:border-primary/20",
            isPlaying ? "bg-accent/50 border-accent ring-1 ring-accent/70" : "",
            "p-3 md:p-4" // Add padding to the card itself
          )}
          onClick={() => onVerseSelect(verseData.surah, verseData.numberInSurah)}
          data-surah={verseData.surah}
          data-verse={verseData.numberInSurah}
        >
          <CardContent className="p-0 flex flex-col gap-2 md:gap-3"> {/* Reduced gap */}
            <div className="arabic-column flex-1 text-right" dir="rtl">
              <p
                className="arabic-text font-amiri leading-relaxed md:leading-loose" // Adjusted line-height
                style={{
                  fontSize: `${arabicFontSize}px`,
                  lineHeight: lineHeight,
                }}
              >
                {verseData.arabicText}
                <span
                  className="verse-number-arabic text-muted-foreground/70 mr-1.5" // Added margin for spacing
                  style={{ fontSize: `${arabicFontSize * 0.5}px` }}
                >
                  ({verseReference})
                </span>
              </p>
            </div>

            <div className="translation-column flex-1 text-left" dir="ltr">
              <p
                className="translation-text"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.6, // Keep specific line height for translation
                }}
              >
                {verseData.translation}
                <span
                  className="verse-number-translation text-muted-foreground/70 ml-1"
                  style={{ fontSize: `${fontSize * 0.7}px` }}
                >
                  ({verseReference})
                </span>
              </p>
            </div>
          </CardContent>
          { (noteExists || taggedConcepts.length > 0) && (
            <div className="verse-indicators-footer px-1 pt-2 flex justify-end items-center gap-1.5">
                {noteExists && (
                     <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary/80 hover:text-primary" onClick={(e) => { e.stopPropagation(); handleAction('add_note'); }}>
                                     <Notebook className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>View/Edit Note</p></TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                )}
                 {taggedConcepts.map(concept => (
                     <TooltipProvider key={concept.id} delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="outline"
                                    className="h-5 px-1.5 py-0.5 border-none cursor-pointer"
                                    style={{ backgroundColor: `${concept.color}4D` }} // Use concept color with 30% opacity (4D in hex)
                                    onClick={(e) => { e.stopPropagation(); handleAction('tag_verse'); }}
                                >
                                     <span style={{ color: concept.color }} className="font-semibold text-xs">{concept.name.substring(0,3)}</span>
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>{concept.name}</p></TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                ))}
            </div>
          )}
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52"> {/* Increased width for better readability */}
        <ContextMenuItem onClick={() => handleAction('add_note')} className="gap-2 text-sm">
          <Notebook className="h-4 w-4 text-muted-foreground" />
          <span>Add/Edit Note</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleAction('tag_verse')} className="gap-2 text-sm">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span>Tag Concepts</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleAction('chat_about')} className="gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span>Chat about this</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => handleAction('share')} className="gap-2 text-sm">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          <span>Share Verse</span>
        </ContextMenuItem>
        <ContextMenuItem disabled className="gap-2 text-sm">
          <Bookmark className="h-4 w-4 text-muted-foreground" />
          <span>Bookmark (Soon)</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
