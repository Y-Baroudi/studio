// src/data/quranMappings.ts

import type { QuranMeta } from '@/services/alquran-cloud';

// Juz starts (absolute verse number) - Simplified for this example
// In a real app, this would be a complete mapping
export const JUZ_STARTS: number[] = [
  1,    // Juz 1 starts at 1:1 (absolute verse 1)
  149,  // Juz 2 starts at 2:142 (absolute verse 149)
  258,  // Juz 3 starts at 2:253
  390,  // Juz 4 starts at 3:93
  520,  // Juz 5 starts at 4:24
  641,  // Juz 6 starts at 4:148
  760,  // Juz 7 starts at 5:82
  881,  // Juz 8 starts at 6:111
  1003, // Juz 9 starts at 7:88
  1129, // Juz 10 starts at 8:41
  1251, // Juz 11 starts at 9:93
  1381, // Juz 12 starts at 11:6
  1510, // Juz 13 starts at 12:53
  1640, // Juz 14 starts at 15:1
  1770, // Juz 15 starts at 17:1
  1902, // Juz 16 starts at 18:75
  2030, // Juz 17 starts at 21:1
  2160, // Juz 18 starts at 23:1
  2288, // Juz 19 starts at 25:21
  2418, // Juz 20 starts at 27:56
  2549, // Juz 21 starts at 29:46
  2675, // Juz 22 starts at 33:31
  2805, // Juz 23 starts at 36:28
  2938, // Juz 24 starts at 39:32
  3069, // Juz 25 starts at 41:47
  3199, // Juz 26 starts at 45:1
  3329, // Juz 27 starts at 48:1
  3459, // Juz 28 starts at 51:31
  3589, // Juz 29 starts at 58:1
  4902, // Juz 30 starts at 78:1
];

// Page starts (absolute verse number) - Simplified for this example
// This would typically map to standard Mushaf pages
export const PAGE_STARTS: number[] = [
  1,    // Page 1 (Surah 1, Ayah 1)
  8,    // Page 2 (Surah 2, Ayah 1)
  26,   // Page 3 (Surah 2, Ayah 20)
  // ... and so on for all 604 pages
  // This is a very simplified version. A full mapping is extensive.
  // For the sake of this example, let's add a few more plausible ones.
  50,
  75,
  100,
  5848, // Approx start of Page 600 (Juz 30)
  6230, // Approx start of Page 604 (Surah 114)
];


/**
 * Converts an absolute verse number (1-6236) to Surah and Ayah number.
 * @param absoluteVerseNumber The absolute verse number.
 * @param quranMeta Quran metadata containing surah information.
 * @returns An object with { surah: number, ayah: number } or null if not found.
 */
export function getSurahAndVerseFromAbsolute(
  absoluteVerseNumber: number,
  quranMeta: QuranMeta | null
): { surah: number; ayah: number } | null {
  if (!quranMeta || !quranMeta.surahs || quranMeta.surahs.length === 0) {
    console.error("Quran metadata is not available for getSurahAndVerseFromAbsolute.");
    return null;
  }

  if (absoluteVerseNumber < 1 || absoluteVerseNumber > quranMeta.totalVerses) {
    console.warn(`Absolute verse number ${absoluteVerseNumber} is out of range.`);
    return null;
  }

  let cumulativeVerses = 0;
  for (const surahInfo of quranMeta.surahs) {
    if (absoluteVerseNumber <= cumulativeVerses + surahInfo.numberOfAyahs) {
      const ayahInSurah = absoluteVerseNumber - cumulativeVerses;
      return { surah: surahInfo.number, ayah: ayahInSurah };
    }
    cumulativeVerses += surahInfo.numberOfAyahs;
  }

  console.warn(`Could not map absolute verse ${absoluteVerseNumber} to Surah/Ayah.`);
  return null; // Should not be reached if absoluteVerseNumber is valid
}
