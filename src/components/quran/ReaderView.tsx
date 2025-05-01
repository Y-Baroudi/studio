'use client';

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import type { Verse, Reciter, QuranMeta } from '@/services/alquran-cloud';
import { getVerse, getReciters, getQuranMeta } from '@/services/alquran-cloud';
import { VerseDisplay } from './VerseDisplay';
import { Controls } from './Controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

// Default values
const DEFAULT_VERSE_NUMBER = 1;
const DEFAULT_TRANSLATION = 'en.clearquran'; // Using "The Clear Quran" translation identifier
const DEFAULT_RECITER_ID = 'ar.alafasy'; // Mishary Rashid Al-Afasy identifier

export function ReaderView() {
  const [quranMeta, setQuranMeta] = useState<QuranMeta | null>(null);
  const [currentVerseData, setCurrentVerseData] = useState<Verse | null>(null);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [selectedReciter, setSelectedReciter] = useState<string>(DEFAULT_RECITER_ID);
  const [currentVerseNumber, setCurrentVerseNumber] = useState<number>(DEFAULT_VERSE_NUMBER);
  const [fontSize, setFontSize] = useState<number>(16); // Default font size in pixels
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [isLoadingVerse, setIsLoadingVerse] = useState<boolean>(true);
  const [isLoadingReciters, setIsLoadingReciters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Quran Metadata once on mount
  const fetchMetaData = useCallback(async () => {
    setIsLoadingMeta(true);
    setError(null);
    try {
      const meta = await getQuranMeta();
      setQuranMeta(meta);
    } catch (err) {
      console.error('Error fetching Quran metadata:', err);
      setError('Failed to load Quran structure. Please refresh.');
      setQuranMeta(null);
    } finally {
      setIsLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    fetchMetaData();
  }, [fetchMetaData]);


  const fetchVerseData = useCallback(async (verseNum: number, reciterId: string, meta: QuranMeta | null) => {
    if (!meta) {
       setError("Cannot load verse: Quran metadata is missing.");
       setIsLoadingVerse(false);
       return; // Don't proceed without metadata
    }
    setIsLoadingVerse(true);
    setError(null);
    try {
      // Fetch verse data using the service function
      const verse = await getVerse(verseNum, DEFAULT_TRANSLATION, reciterId, meta);
       if (verse) {
          setCurrentVerseData(verse);
        } else {
           // Handle case where getVerse returns null (e.g., 404 or other fetch error)
           setError(`Failed to load verse ${verseNum}. It might be invalid or unavailable.`);
           setCurrentVerseData(null); // Clear stale data
        }

    } catch (err) {
      console.error('Error fetching verse:', err);
      setError('Failed to load verse data. Please try again.');
      setCurrentVerseData(null); // Clear stale data on error
    } finally {
      setIsLoadingVerse(false);
    }
  }, []);


  const fetchReciterList = useCallback(async () => {
    setIsLoadingReciters(true);
    setError(null); // Clear previous errors related to reciters
    try {
      const fetchedReciters = await getReciters();
      setReciters(fetchedReciters);
      // Set default reciter only if the list is not empty and no reciter is currently selected
      if (fetchedReciters.length > 0 && !reciters.some(r => r.id === selectedReciter)) {
         // Check if the DEFAULT_RECITER_ID exists in the fetched list
         const defaultExists = fetchedReciters.some(r => r.id === DEFAULT_RECITER_ID);
         setSelectedReciter(defaultExists ? DEFAULT_RECITER_ID : fetchedReciters[0].id);
       } else if (fetchedReciters.length === 0) {
         setError("No audio reciters available.");
         setSelectedReciter(''); // Clear selection if list is empty
       }
    } catch (err) {
      console.error('Error fetching reciters:', err);
      setError('Failed to load reciter list.');
      setReciters([]); // Clear reciters on error
      setSelectedReciter('');
    } finally {
        setIsLoadingReciters(false);
    }
  }, [selectedReciter, reciters]); // Dependency on selectedReciter to ensure default is set correctly

  useEffect(() => {
    fetchReciterList();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Fetch reciters only once initially

  useEffect(() => {
     // Fetch verse data only when metadata is loaded, a reciter is selected, and verse number changes
     if (quranMeta && selectedReciter && !isLoadingMeta) {
       fetchVerseData(currentVerseNumber, selectedReciter, quranMeta);
     }
     // If metadata or reciter is missing/loading, the fetchVerseData callback handles it.
  }, [currentVerseNumber, selectedReciter, quranMeta, fetchVerseData, isLoadingMeta]);

  const handleNextVerse = () => {
    // Use Quran metadata to determine the max verse number if available
    const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;
    setCurrentVerseNumber((prev) => Math.min(prev + 1, maxVerse));
  };

  const handlePreviousVerse = () => {
    setCurrentVerseNumber((prev) => Math.max(1, prev - 1)); // Ensure verse number doesn't go below 1
  };

  const handleReciterChange = (reciterId: string) => {
    setSelectedReciter(reciterId);
    // Verse data will be fetched automatically by the useEffect hook watching selectedReciter
  };

   const handleFontSizeChange = (value: number[]) => {
     setFontSize(value[0]);
   };

   const handleVerseInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      // This function only updates the input value visually *while typing*
      // It doesn't trigger the actual verse change until onBlur or Enter key (implicitly handled by blur)
      // No need to call setCurrentVerseNumber here, prevents fetching on every keystroke
    };

   const handleVerseInputBlur = (e: ChangeEvent<HTMLInputElement>) => {
     const value = parseInt(e.target.value, 10);
     const maxVerse = quranMeta?.surahs.references.reduce((sum, s) => sum + s.numberOfAyahs, 0) ?? 6236;

      if (!isNaN(value) && value >= 1 && value <= maxVerse) {
        setCurrentVerseNumber(value); // Change verse number only on blur with valid input
      } else {
        // Reset input visually to the current verse number if input is invalid or empty on blur
        e.target.value = currentVerseNumber.toString();
      }
   }

   const isLoading = isLoadingMeta || isLoadingVerse || isLoadingReciters;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
       <Card className="shadow-md rounded-lg overflow-hidden">
        <CardContent className="p-6">
         {/* Display specific loading states or a general one */}
         {isLoadingMeta && <p className="text-center text-muted-foreground">Loading Quran structure...</p>}
         {error && <p className="text-destructive text-center mb-4">{error}</p>}
         {isLoadingVerse && !isLoadingMeta ? ( // Show verse skeleton only if meta is loaded but verse isn't
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Skeleton className="h-40 w-full" />
             <Skeleton className="h-40 w-full" />
           </div>
         ) : currentVerseData ? (
           <VerseDisplay verse={currentVerseData} fontSize={fontSize} />
         ) : (
           !error && !isLoadingMeta && <p className="text-center text-muted-foreground">Select a verse or reciter.</p> // Show if not loading and no data/error
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
        onVerseInputChange={handleVerseInputChange} // Pass the temporary input change handler
        onVerseInputBlur={handleVerseInputBlur} // Pass the final change handler
        isLoading={isLoading} // Pass combined loading state
      />
    </div>
  );
}
