'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import type { Verse, Reciter } from '@/services/alquran-cloud';
import { getVerse, getReciters } from '@/services/alquran-cloud';
import { VerseDisplay } from './VerseDisplay';
import { Controls } from './Controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

// Default values - replace with actual logic if needed
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION = 'en.clearquran'; // Using "The Clear Quran" translation identifier
const DEFAULT_RECITER_ID = 'ar.alafasy'; // Mishary Rashid Al-Afasy identifier

export function ReaderView() {
  const [currentVerseData, setCurrentVerseData] = useState<Verse | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [selectedReciter, setSelectedReciter] = useState<string>(DEFAULT_RECITER_ID);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(DEFAULT_VERSE_NUMBER);
  const [fontSize, setFontSize] = useState<number>(16); // Default font size in pixels
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVerseData = useCallback(async (verseNum: number, reciterId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Simulate fetching verse data - replace with actual API call
      // const verse = await getVerse(verseNum, DEFAULT_TRANSLATION, reciterId);
      // Placeholder data for now
      const verse: Verse = {
        verseNumber: verseNum,
        arabicText: verseNum === 1 ? 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ' : `Sample Arabic text for verse ${verseNum}`,
        englishTranslation: verseNum === 1 ? 'In the name of God, the Most Gracious, the Most Merciful.' : `Sample English translation for verse ${verseNum}.`,
        audioUrl: `https://cdn.islamic.network/quran/audio/128/${reciterId}/${verseNum}.mp3` // Example URL structure
      };
      setCurrentVerseData(verse);
    } catch (err) {
      console.error('Error fetching verse:', err);
      setError('Failed to load verse data. Please try again.');
      setCurrentVerseData(null); // Clear stale data on error
    } finally {
      setIsLoading(false);
    }
  }, []);


  const fetchReciterList = useCallback(async () => {
    try {
       // Simulate fetching reciter data - replace with actual API call
      // const fetchedReciters = await getReciters();
      // Placeholder data
      const fetchedReciters: Reciter[] = [
         { id: 'ar.alafasy', name: 'Mishary Rashid Al-Afasy' },
         { id: 'ar.saoodshuraym', name: 'Sa`ud ash-Shuraym' },
         { id: 'en.walk', name: 'Ibrahim Walk (English)'}
      ];
      setReciters(fetchedReciters);
       if (fetchedReciters.length > 0 && !selectedReciter) {
         setSelectedReciter(fetchedReciters[0].id); // Set default if not already set
       }
    } catch (err) {
      console.error('Error fetching reciters:', err);
      setError('Failed to load reciter list.');
    }
  }, [selectedReciter]);

  useEffect(() => {
    fetchReciterList();
  }, [fetchReciterList]);

  useEffect(() => {
     if (selectedReciter) { // Only fetch verse if a reciter is selected
       fetchVerseData(currentVerseNumber, selectedReciter);
     }
  }, [currentVerseNumber, selectedReciter, fetchVerseData]);

  const handleNextVerse = () => {
    // Add logic to handle max verse number (e.g., 6236 for Quran)
    setCurrentVerseNumber((prev) => prev + 1);
  };

  const handlePreviousVerse = () => {
    setCurrentVerseNumber((prev) => Math.max(1, prev - 1)); // Ensure verse number doesn't go below 1
  };

  const handleReciterChange = (reciterId: string) => {
    setSelectedReciter(reciterId);
    // Fetch verse data again with the new reciter
     fetchVerseData(currentVerseNumber, reciterId);
  };

   const handleFontSizeChange = (value: number[]) => {
     setFontSize(value[0]);
   };

   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
     const value = parseInt(e.target.value, 10);
     if (!isNaN(value) && value >= 1 && value <= 6236) { // Assuming 6236 verses in Quran
       setCurrentVerseNumber(value);
     } else if (e.target.value === '') {
       // Allow clearing the input, maybe show currentVerseNumber as placeholder
     }
   };

   const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
     const value = parseInt(e.target.value, 10);
      if (isNaN(value) || value < 1 || value > 6236) {
        // Reset to current verse number if input is invalid or empty on blur
        e.target.value = currentVerseNumber.toString();
      }
   }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
       <Card className="shadow-md rounded-lg overflow-hidden">
        <CardContent className="p-6">
         {error && <p className="text-destructive text-center mb-4">{error}</p>}
         {isLoading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Skeleton className="h-40 w-full" />
             <Skeleton className="h-40 w-full" />
           </div>
         ) : currentVerseData ? (
           <VerseDisplay verse={currentVerseData} fontSize={fontSize} />
         ) : (
           !error && <p className="text-center text-muted-foreground">Loading verse...</p>
         )}
         </CardContent>
       </Card>

      <Controls
        verseNumber={currentVerseNumber}
        audioUrl={currentVerseData?.audioUrl}
        reciters={reciters}
        selectedReciter={selectedReciter}
        fontSize={fontSize}
        onNextVerse={handleNextVerse}
        onPreviousVerse={handlePreviousVerse}
        onReciterChange={handleReciterChange}
        onFontSizeChange={handleFontSizeChange}
        onVerseInputChange={handleVerseInputChange}
        onVerseInputBlur={handleVerseInputBlur}
        isLoading={isLoading}
      />
    </div>
  );
}
