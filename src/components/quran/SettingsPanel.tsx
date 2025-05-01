
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
import { Settings, Minus, Plus, TextQuote, Baseline, Palette, View } from 'lucide-react'; // Added icons
import type { Translation } from '@/services/alquran-cloud';
import { ThemeToggle } from '@/components/theme-toggle'; // Re-use ThemeToggle

interface SettingsPanelProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  fontSize: number;
  arabicFontSize: number;
  lineHeight: number;
  translations: Translation[];
  selectedTranslation: string;
  onFontSizeChange: (value: number[]) => void;
  onArabicFontSizeChange: (value: number[]) => void;
  onLineHeightChange: (value: number[]) => void;
  onTranslationChange: (translationId: string) => void;
  isLoading: boolean; // For disabling controls while loading
  // Add props for background color and UI toggles later
}

export function SettingsPanel({
  isOpen,
  onOpenChange,
  fontSize,
  arabicFontSize,
  lineHeight,
  translations,
  selectedTranslation,
  onFontSizeChange,
  onArabicFontSizeChange,
  onLineHeightChange,
  onTranslationChange,
  isLoading,
}: SettingsPanelProps) {

  // Font Size Controls
  const increaseFontSize = () => onFontSizeChange([Math.min(fontSize + 1, 32)]);
  const decreaseFontSize = () => onFontSizeChange([Math.max(fontSize - 1, 12)]);
  const increaseArabicFontSize = () => onArabicFontSizeChange([Math.min(arabicFontSize + 1, 48)]);
  const decreaseArabicFontSize = () => onArabicFontSizeChange([Math.max(arabicFontSize - 1, 16)]);

  // Line Height Controls
  const increaseLineHeight = () => onLineHeightChange([Math.min(lineHeight + 0.1, 2.5)]);
  const decreaseLineHeight = () => onLineHeightChange([Math.max(lineHeight - 0.1, 1.2)]);

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
                value={selectedTranslation}
                onValueChange={onTranslationChange}
                disabled={isLoading || translations.length === 0}
              >
               <SelectTrigger id="translation-select" className="w-full">
                  <SelectValue placeholder="Select Translation" />
               </SelectTrigger>
               <SelectContent>
                 <SelectGroup>
                    <SelectLabel>English Translations</SelectLabel>
                     {translations.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                           {t.name} <span className="text-xs text-muted-foreground ml-1">({t.translator})</span>
                        </SelectItem>
                     ))}
                     {translations.length === 0 && <SelectItem value="loading" disabled>Loading...</SelectItem>}
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

          {/* Line Height */}
           <div className="space-y-2">
            <Label htmlFor="line-height-slider" className="flex items-center gap-1.5">
                <Baseline className="h-4 w-4 text-muted-foreground"/> Line Height ({lineHeight.toFixed(1)})
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={decreaseLineHeight} disabled={lineHeight <= 1.2 || isLoading} aria-label="Decrease line height"> <Minus className="h-4 w-4" /> </Button>
              <Slider id="line-height-slider" min={1.2} max={2.5} step={0.1} value={[lineHeight]} onValueChange={onLineHeightChange} className="flex-1" aria-label="Adjust line height" disabled={isLoading} />
              <Button variant="outline" size="icon" onClick={increaseLineHeight} disabled={lineHeight >= 2.5 || isLoading} aria-label="Increase line height"> <Plus className="h-4 w-4" /> </Button>
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
