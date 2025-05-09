// src/components/quran/SettingsPanel.tsx
'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Settings, Minus, Plus, TextQuote, Baseline, Palette, View, PilcrowLeft, PilcrowRight } from 'lucide-react'; // Replaced LineHeight with PilcrowLeft/Right or similar
import type { Translation } from '@/services/alquran-cloud';
import { ThemeToggle } from '@/components/theme-toggle';
import { Separator } from '../ui/separator';

interface SettingsPanelProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  fontSize: number;
  arabicFontSize: number;
  lineHeight: number;
  selectedTranslation: string;
  translations: Translation[];
  onFontSizeChange: (size: number) => void;
  onArabicFontSizeChange: (size: number) => void;
  onLineHeightChange: (height: number) => void;
  onTranslationChange: (identifier: string) => void;
}

export function SettingsPanel({
  isOpen,
  onOpenChange,
  fontSize,
  arabicFontSize,
  lineHeight,
  selectedTranslation,
  translations,
  onFontSizeChange,
  onArabicFontSizeChange,
  onLineHeightChange,
  onTranslationChange,
}: SettingsPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-[90vw] flex flex-col" side="right">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Display Settings
          </SheetTitle>
          <SheetDescription>
            Customize your reading experience. Changes are applied live.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-grow overflow-y-auto p-4 space-y-6">
          {/* Font Size Controls */}
          <div className="space-y-3 p-4 border rounded-lg shadow-sm bg-card">
            <Label htmlFor="font-size-slider" className="flex items-center gap-2 text-base font-medium">
              <TextQuote className="h-5 w-5 text-muted-foreground" />
              Translation Font Size: {fontSize}px
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => onFontSizeChange(fontSize - 1)} disabled={fontSize <= 10}>
                <Minus className="h-4 w-4" />
              </Button>
              <Slider
                id="font-size-slider"
                min={10}
                max={32}
                step={1}
                value={[fontSize]}
                onValueChange={(value) => onFontSizeChange(value[0])}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => onFontSizeChange(fontSize + 1)} disabled={fontSize >= 32}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 p-4 border rounded-lg shadow-sm bg-card">
            <Label htmlFor="arabic-font-size-slider" className="flex items-center gap-2 text-base font-medium">
              <TextQuote className="h-5 w-5 text-muted-foreground" />
               Arabic Font Size: {arabicFontSize}px
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => onArabicFontSizeChange(arabicFontSize - 1)} disabled={arabicFontSize <= 16}>
                <Minus className="h-4 w-4" />
              </Button>
              <Slider
                id="arabic-font-size-slider"
                min={16}
                max={60} // Increased max Arabic font size
                step={1}
                value={[arabicFontSize]}
                onValueChange={(value) => onArabicFontSizeChange(value[0])}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => onArabicFontSizeChange(arabicFontSize + 1)} disabled={arabicFontSize >= 60}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Line Height Control */}
          <div className="space-y-3 p-4 border rounded-lg shadow-sm bg-card">
            <Label htmlFor="line-height-slider" className="flex items-center gap-2 text-base font-medium">
               <Baseline className="h-5 w-5 text-muted-foreground" /> {/* Using Baseline as a proxy for LineHeight */}
              Line Height: {lineHeight.toFixed(1)}
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => onLineHeightChange(Number((lineHeight - 0.1).toFixed(1)))} disabled={lineHeight <= 1.2}>
                 <PilcrowLeft className="h-4 w-4" />
              </Button>
              <Slider
                id="line-height-slider"
                min={1.2}
                max={3.0} // Increased max line height
                step={0.1}
                value={[lineHeight]}
                onValueChange={(value) => onLineHeightChange(value[0])}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={() => onLineHeightChange(Number((lineHeight + 0.1).toFixed(1)))} disabled={lineHeight >= 3.0}>
                 <PilcrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Translation Selection */}
          <div className="space-y-3 p-4 border rounded-lg shadow-sm bg-card">
            <Label htmlFor="translation-select" className="flex items-center gap-2 text-base font-medium">
              <View className="h-5 w-5 text-muted-foreground" />
              Translation
            </Label>
            <Select value={selectedTranslation} onValueChange={onTranslationChange}>
              <SelectTrigger id="translation-select" className="w-full">
                <SelectValue placeholder="Select a translation" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>English Translations</SelectLabel>
                  {translations.filter(t => t.language === "en").map((translation) => (
                    <SelectItem key={translation.identifier} value={translation.identifier}>
                      {translation.englishName}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {/* Optionally add groups for other languages if needed */}
              </SelectContent>
            </Select>
          </div>
          
          <Separator />

          {/* Theme Toggle */}
          <div className="space-y-3 p-4 border rounded-lg shadow-sm bg-card">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Palette className="h-5 w-5 text-muted-foreground" />
              Appearance
            </Label>
            <div className="flex justify-between items-center">
                <span>Theme</span>
                <ThemeToggle />
            </div>
          </div>

        </div>

        <SheetFooter className="p-4 border-t">
          <SheetClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
