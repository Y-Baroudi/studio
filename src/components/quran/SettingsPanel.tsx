
'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Settings, Minus, Plus, TextQuote, Baseline, Palette, View, Bell } from 'lucide-react';
import type { Translation } from '@/services/alquran-cloud';
import { ThemeToggle } from '@/components/theme-toggle';
import { useToast } from '@/hooks/use-toast';


interface SettingsPanelProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  fontSize: number;
  arabicFontSize: number;
  lineHeight: number;
  translationLineHeight: number;
  translations: Translation[];
  selectedTranslation: string;
  onFontSizeChange: (value: number[]) => void;
  onArabicFontSizeChange: (value: number[]) => void;
  onLineHeightChange: (value: number[]) => void;
  onTranslationLineHeightChange: (value: number[]) => void;
  onTranslationChange: (translationId: string) => void;
  isLoading: boolean;
}

export function SettingsPanel({
  isOpen,
  onOpenChange,
  fontSize,
  arabicFontSize,
  lineHeight,
  translationLineHeight,
  translations = [],
  selectedTranslation,
  onFontSizeChange,
  onArabicFontSizeChange,
  onLineHeightChange,
  onTranslationLineHeightChange,
  onTranslationChange,
  isLoading,
}: SettingsPanelProps) {
  const { toast } = useToast();

  const increaseFontSize = () => onFontSizeChange([Math.min(fontSize + 1, 32)]);
  const decreaseFontSize = () => onFontSizeChange([Math.max(fontSize - 1, 12)]);
  const increaseArabicFontSize = () => onArabicFontSizeChange([Math.min(arabicFontSize + 1, 48)]);
  const decreaseArabicFontSize = () => onArabicFontSizeChange([Math.max(arabicFontSize - 1, 16)]);

  const increaseLineHeight = () => onLineHeightChange([Number((lineHeight + 0.1).toFixed(1)), 2.5]);
  const decreaseLineHeight = () => onLineHeightChange([Number((lineHeight - 0.1).toFixed(1)), 1.2]);
  const increaseTranslationLineHeight = () => onTranslationLineHeightChange([Number((translationLineHeight + 0.1).toFixed(1)), 2.5]);
  const decreaseTranslationLineHeight = () => onTranslationLineHeightChange([Number((translationLineHeight - 0.1).toFixed(1)), 1.2]);

  const selectedTranslationName = translations.find(t => t.id === selectedTranslation)?.name ?? "Select Translation";

  const handleRequestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast({ title: "Notifications Not Supported", description: "This browser does not support desktop notifications.", variant: "destructive" });
      return;
    }
    if (Notification.permission === "granted") {
      toast({ title: "Permissions Granted", description: "Notification permissions already granted." });
      // Optionally, show a test notification
      // new Notification("Qur'an Meezan", { body: "Test notification!", icon: "/icons/icon-192x192.png" });
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast({ title: "Permissions Granted", description: "Notifications enabled!" });
        // new Notification("Qur'an Meezan", { body: "You will now receive reminders.", icon: "/icons/icon-192x192.png" });
      } else {
        toast({ title: "Permissions Denied", description: "Notifications were not enabled.", variant: "destructive" });
      }
    } else {
       toast({ title: "Permissions Denied", description: "Notification permissions were previously denied. Please check your browser settings.", variant: "destructive" });
    }
  };


  return (
     <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Display Settings
            </SheetTitle>
          <SheetDescription>
            Adjust reading preferences for a comfortable experience.
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-6 overflow-y-auto pr-2">
           <div className="space-y-2">
             <Label htmlFor="translation-select" className="flex items-center gap-1.5">
                <TextQuote className="h-4 w-4 text-muted-foreground"/> Translation
             </Label>
             <Select
                value={selectedTranslation || ""}
                onValueChange={onTranslationChange}
                disabled={isLoading || translations.length === 0}
              >
               <SelectTrigger id="translation-select" className="w-full">
                  <SelectValue placeholder="Select Translation">{selectedTranslationName}</SelectValue>
               </SelectTrigger>
               <SelectContent>
                 <SelectGroup>
                    <SelectLabel>English Translations</SelectLabel>
                     {Array.isArray(translations) && translations.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                           {t.name} <span className="text-xs text-muted-foreground ml-1">({t.translator})</span>
                        </SelectItem>
                     ))}
                     {isLoading && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                     {!isLoading && translations.length === 0 && <SelectItem value="none" disabled>No translations available</SelectItem>}
                 </SelectGroup>
               </SelectContent>
             </Select>
           </div>

          <div className="space-y-2">
            <Label htmlFor="font-size-slider">English Font Size ({fontSize}px)</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={decreaseFontSize} disabled={fontSize <= 12 || isLoading} aria-label="Decrease English font size"> <Minus className="h-4 w-4" /> </Button>
              <Slider id="font-size-slider" min={12} max={32} step={1} value={[fontSize]} onValueChange={onFontSizeChange} className="flex-1" aria-label="Adjust English font size" disabled={isLoading} />
              <Button variant="outline" size="icon" onClick={increaseFontSize} disabled={fontSize >= 32 || isLoading} aria-label="Increase English font size"> <Plus className="h-4 w-4" /> </Button>
            </div>
          </div>

           <div className="space-y-2">
            <Label htmlFor="arabic-font-size-slider">Arabic Font Size ({arabicFontSize}px)</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={decreaseArabicFontSize} disabled={arabicFontSize <= 16 || isLoading} aria-label="Decrease Arabic font size"> <Minus className="h-4 w-4" /> </Button>
              <Slider id="arabic-font-size-slider" min={16} max={48} step={1} value={[arabicFontSize]} onValueChange={onArabicFontSizeChange} className="flex-1" aria-label="Adjust Arabic font size" disabled={isLoading} />
              <Button variant="outline" size="icon" onClick={increaseArabicFontSize} disabled={arabicFontSize >= 48 || isLoading} aria-label="Increase Arabic font size"> <Plus className="h-4 w-4" /> </Button>
            </div>
          </div>

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

          <div className="flex items-center justify-between pt-4 border-t">
             <Label className="flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-muted-foreground"/> Theme
             </Label>
             <ThemeToggle />
           </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Label className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-muted-foreground" /> Reflection Reminders
            </Label>
            <Button variant="outline" size="sm" onClick={handleRequestNotificationPermission}>
                Enable Notifications
            </Button>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
