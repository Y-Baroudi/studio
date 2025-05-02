
'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  // SheetTrigger, // Removed SheetTrigger import
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Settings, Minus, Plus, TextQuote, Baseline, Palette, View } from 'lucide-react'; // Use Baseline for Line Height
import type { Translation } from '@/services/alquran-cloud';
import { ThemeToggle } from '@/components/theme-toggle'; // Re-use ThemeToggle

interface SettingsPanelProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  fontSize: number; // Translation font size
  arabicFontSize: number; // Arabic font size
  lineHeight: number; // Arabic line height
  translationLineHeight: number; // Translation line height (NEW)
  translations: Translation[]; // Expecting array of Translation objects
  selectedTranslation: string; // Expecting the ID string
  onFontSizeChange: (value: number[]) => void; // Handler for translation font size
  onArabicFontSizeChange: (value: number[]) => void; // Handler for Arabic font size
  onLineHeightChange: (value: number[]) => void; // Handler for Arabic line height
  onTranslationLineHeightChange: (value: number[]) => void; // Handler for translation line height (NEW)
  onTranslationChange: (translationId: string) => void; // Handler takes the ID string
  isLoading: boolean; // For disabling controls while loading
  // Add props for background color and UI toggles later
}

export function SettingsPanel({
  isOpen,
  onOpenChange,
  fontSize, // Translation font size
  arabicFontSize, // Arabic font size
  lineHeight, // Arabic line height
  translationLineHeight, // Translation line height
  translations = [], // Default to empty array
  selectedTranslation,
  onFontSizeChange, // Handler for translation font size
  onArabicFontSizeChange, // Handler for Arabic font size
  onLineHeightChange, // Handler for Arabic line height
  onTranslationLineHeightChange, // Handler for translation line height
  onTranslationChange,
  isLoading,
}: SettingsPanelProps) {

  // Font Size Controls
  const increaseFontSize = () => onFontSizeChange([Math.min(fontSize + 1, 32)]);
  const decreaseFontSize = () => onFontSizeChange([Math.max(fontSize - 1, 12)]);
  const increaseArabicFontSize = () => onArabicFontSizeChange([Math.min(arabicFontSize + 1, 48)]);
  const decreaseArabicFontSize = () => onArabicFontSizeChange([Math.max(arabicFontSize - 1, 16)]);

  // Line Height Controls
  const increaseLineHeight = () => onLineHeightChange([Number((lineHeight + 0.1).toFixed(1)), 2.5]); // Arabic
  const decreaseLineHeight = () => onLineHeightChange([Number((lineHeight - 0.1).toFixed(1)), 1.2]); // Arabic
  const increaseTranslationLineHeight = () => onTranslationLineHeightChange([Number((translationLineHeight + 0.1).toFixed(1)), 2.5]); // Translation
  const decreaseTranslationLineHeight = () => onTranslationLineHeightChange([Number((translationLineHeight - 0.1).toFixed(1)), 1.2]); // Translation


  // Find the name of the selected translation for display
  const selectedTranslationName = translations.find(t => t.id === selectedTranslation)?.name ?? "Select Translation";

  return (
     // The Sheet component itself is still used, but it's controlled by the isOpen prop
     <Sheet open={isOpen} onOpenChange={onOpenChange}>
       {/* The SheetTrigger is removed from here. The button in ReaderView now controls the 'isOpen' state. */}
      <SheetContent className="sm:max-w-sm"> {/* Standard width */}
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Display Settings
            </SheetTitle>
          <SheetDescription>
            Adjust reading preferences for a comfortable experience.
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-6 overflow-y-auto pr-2"> {/* Add scroll and padding */}
           {/* Translation Selection */}
           <div className="space-y-2">
             <Label htmlFor="translation-select" className="flex items-center gap-1.5">
                <TextQuote className="h-4 w-4 text-muted-foreground"/> Translation
             </Label>
             <Select
                value={selectedTranslation || ""} // Use selected ID or empty string if null/undefined
                onValueChange={onTranslationChange} // Calls handler with the selected ID (string)
                disabled={isLoading || translations.length === 0}
              >
               <SelectTrigger id="translation-select" className="w-full">
                 {/* Display the name of the selected translation */}
                  <SelectValue placeholder="Select Translation">{selectedTranslationName}</SelectValue>
               </SelectTrigger>
               <SelectContent>
                 <SelectGroup>
                    <SelectLabel>English Translations</SelectLabel>
                     {/* Ensure translations is an array before mapping */}
                     {Array.isArray(translations) && translations.map((t) => (
                        <SelectItem key={t.id} value={t.id}> {/* Value is the ID */}
                           {t.name} <span className="text-xs text-muted-foreground ml-1">({t.translator})</span>
                        </SelectItem>
                     ))}
                     {/* Show loading/empty state */}
                     {isLoading && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                     {!isLoading && translations.length === 0 && <SelectItem value="none" disabled>No translations available</SelectItem>}
                 </SelectGroup>
               </SelectContent>
             </Select>
           </div>

          {/* English Font Size */}
          <div className="space-y-2">
            <Label htmlFor="font-size-slider">English Font Size ({fontSize}px)</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={decreaseFontSize} disabled={fontSize <= 12 || isLoading} aria-label="Decrease English font size"> <Minus className="h-4 w-4" /> </Button>
              <Slider id="font-size-slider" min={12} max={32} step={1} value={[fontSize]} onValueChange={onFontSizeChange} className="flex-1" aria-label="Adjust English font size" disabled={isLoading} />
              <Button variant="outline" size="icon" onClick={increaseFontSize} disabled={fontSize >= 32 || isLoading} aria-label="Increase English font size"> <Plus className="h-4 w-4" /> </Button>
            </div>
          </div>

           {/* Arabic Font Size */}
           <div className="space-y-2">
            <Label htmlFor="arabic-font-size-slider">Arabic Font Size ({arabicFontSize}px)</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={decreaseArabicFontSize} disabled={arabicFontSize <= 16 || isLoading} aria-label="Decrease Arabic font size"> <Minus className="h-4 w-4" /> </Button>
              <Slider id="arabic-font-size-slider" min={16} max={48} step={1} value={[arabicFontSize]} onValueChange={onArabicFontSizeChange} className="flex-1" aria-label="Adjust Arabic font size" disabled={isLoading} />
              <Button variant="outline" size="icon" onClick={increaseArabicFontSize} disabled={arabicFontSize >= 48 || isLoading} aria-label="Increase Arabic font size"> <Plus className="h-4 w-4" /> </Button>
            </div>
          </div>

          {/* Arabic Line Height */}
           <div className="space-y-2">
            <Label htmlFor="line-height-slider" className="flex items-center gap-1.5">
                <Baseline className="h-4 w-4 text-muted-foreground"/> Arabic Line Height ({lineHeight.toFixed(1)})
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={decreaseLineHeight} disabled={lineHeight <= 1.2 || isLoading} aria-label="Decrease Arabic line height"> <Minus className="h-4 w-4" /> </Button>
              <Slider id="line-height-slider" min={1.2} max={2.5} step={0.1} value={[lineHeight]} onValueChange={onLineHeightChange} className="flex-1" aria-label="Adjust Arabic line height" disabled={isLoading} />
              <Button variant="outline" size="icon" onClick={increaseLineHeight} disabled={lineHeight >= 2.5 || isLoading} aria-label="Increase Arabic line height"> <Plus className="h-4 w-4" /> </Button>
            </div>
          </div>

           {/* Translation Line Height */}
           <div className="space-y-2">
            <Label htmlFor="translation-line-height-slider" className="flex items-center gap-1.5">
                <Baseline className="h-4 w-4 text-muted-foreground"/> English Line Height ({translationLineHeight.toFixed(1)})
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={decreaseTranslationLineHeight} disabled={translationLineHeight <= 1.2 || isLoading} aria-label="Decrease English line height"> <Minus className="h-4 w-4" /> </Button>
              <Slider id="translation-line-height-slider" min={1.2} max={2.5} step={0.1} value={[translationLineHeight]} onValueChange={onTranslationLineHeightChange} className="flex-1" aria-label="Adjust English line height" disabled={isLoading} />
              <Button variant="outline" size="icon" onClick={increaseTranslationLineHeight} disabled={translationLineHeight >= 2.5 || isLoading} aria-label="Increase English line height"> <Plus className="h-4 w-4" /> </Button>
            </div>
          </div>


          {/* Theme Toggle */}
          <div className="flex items-center justify-between pt-4 border-t">
             <Label className="flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-muted-foreground"/> Theme
             </Label>
             <ThemeToggle />
           </div>

           {/* Placeholder for UI Element Toggles */}
           {/* <div className="space-y-2 pt-4 border-t">
                <Label className="flex items-center gap-1.5"><View className="h-4 w-4 text-muted-foreground"/> Show Elements</Label>
                <div className="flex items-center justify-between text-sm">
                    <Label htmlFor="show-bismillah">Show Bismillah</Label>
                    <Switch id="show-bismillah" />
                </div>
                 <div className="flex items-center justify-between text-sm">
                    <Label htmlFor="show-verse-numbers">Show Verse Numbers</Label>
                    <Switch id="show-verse-numbers" defaultChecked />
                </div>
                 <div className="flex items-center justify-between text-sm">
                    <Label htmlFor="show-surah-header">Show Surah Header</Label>
                    <Switch id="show-surah-header" defaultChecked />
                </div>
           </div> */}

           {/* Placeholder for Background Color */}
           {/* <div className="space-y-2 pt-4 border-t">
               <Label className="flex items-center gap-1.5"><Palette className="h-4 w-4 text-muted-foreground"/> Background Color (Soon)</Label>
               <p className="text-xs text-muted-foreground">More background options coming soon.</p>
           </div> */}

        </div>
      </SheetContent>
    </Sheet>
  );
}
