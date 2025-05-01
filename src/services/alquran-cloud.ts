
/**
 * @fileoverview Service functions for interacting with the alquran.cloud API v1.
 * Provides functions to fetch Quran metadata, reciters, and individual verse data.
 */

/**
 * Represents metadata for a Surah (chapter).
 */
export interface SurahMeta {
  number: number;
  name: string; // Arabic name
  englishName: string;
  englishNameTranslation: string;
  revelationType: 'Meccan' | 'Medinan';
  numberOfAyahs: number;
}

/**
 * Represents the overall Quran metadata structure from the API.
 */
export interface QuranMeta {
  surahs: {
    references: SurahMeta[];
    count: number;
  };
  // Add other meta fields if needed (e.g., juz, manzil, page mappings)
}

/**
 * Represents a verse from the Quran fetched from alquran.cloud API.
 */
export interface Verse {
  /**
   * The absolute verse number (1-6236).
   */
  verseNumber: number;
  /**
   * The reference in Surah:Ayah format (e.g., "1:1").
   */
  verseReference: string;
  /**
   * The Arabic text of the verse.
   */
  arabicText: string;
  /**
   * The English translation of the verse.
   */
  englishTranslation: string;
  /**
   * The audio URL for the verse. Can be null if not found.
   */
  audioUrl: string | null; // Changed from string to allow null
  /**
   * Surah metadata for the verse.
   */
  surah: SurahMeta | null;
}

/**
 * Represents a reciter (audio edition) available from alquran.cloud API.
 */
export interface Reciter {
  /**
   * The reciter's identifier used in the API (e.g., "ar.alafasy").
   */
  id: string; // API identifier is 'identifier'
  /**
   * The reciter's display name.
   */
  name: string; // API name is 'englishName' or 'name'
  /**
   * Language of the recitation (e.g., "ar", "en").
   */
  language: string;
}

/**
 * Base URL for the alquran.cloud API v1.
 */
const API_BASE_URL = 'https://api.alquran.cloud/v1';
// const AUDIO_CDN_BASE_URL = 'https://cdn.alquran.cloud/media/audio/ayah'; // Deprecated - URL is in response now

/**
 * Fetches the metadata for the Quran (Surah names, verse counts, etc.).
 * Uses `fetch` with caching options.
 * @returns A promise that resolves to the QuranMeta object.
 */
export async function getQuranMeta(): Promise<QuranMeta> {
  try {
    // Use cache: 'force-cache' for metadata as it changes rarely.
    const response = await fetch(`${API_BASE_URL}/meta`, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`API error fetching metadata: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.data || !data.data.surahs || !data.data.surahs.references) {
        throw new Error('Invalid metadata format received from API.');
    }
    return data.data as QuranMeta;
  } catch (error) {
    console.error("Failed to fetch Quran metadata:", error);
    throw error;
  }
}

/**
 * Converts an absolute verse number (1-6236) to its Surah:Ayah representation.
 * Requires Quran metadata containing verse counts per Surah.
 *
 * @param absoluteVerseNumber The verse number from 1 to 6236.
 * @param metaData The Quran metadata object.
 * @returns An object containing { surah: number, ayah: number, reference: string, surahMeta: SurahMeta | null } or null if invalid.
 */
export function absoluteVerseToSurahAyah(
    absoluteVerseNumber: number,
    metaData: QuranMeta | null
): { surah: number; ayah: number; reference: string; surahMeta: SurahMeta | null } | null {
  if (!metaData || absoluteVerseNumber < 1 || absoluteVerseNumber > 6236) {
    return null; // Invalid input
  }

  let verseCount = 0;
  for (const surah of metaData.surahs.references) {
    if (absoluteVerseNumber <= verseCount + surah.numberOfAyahs) {
      const ayahNumber = absoluteVerseNumber - verseCount;
      return {
        surah: surah.number,
        ayah: ayahNumber,
        reference: `${surah.number}:${ayahNumber}`,
        surahMeta: surah,
      };
    }
    verseCount += surah.numberOfAyahs;
  }

  return null; // Should not happen if absoluteVerseNumber <= 6236
}


/**
 * Asynchronously retrieves a list of available audio reciters (editions).
 * Uses `fetch` with caching options.
 *
 * @returns A promise that resolves to a list of Reciter objects.
 */
export async function getReciters(): Promise<Reciter[]> {
   try {
    // Cache reciter list for a reasonable time (e.g., revalidate after 1 hour)
    const response = await fetch(`${API_BASE_URL}/edition?format=audio&type=versebyverse`, {
        next: { revalidate: 3600 } // Revalidate after 1 hour
    });
     if (!response.ok) {
      throw new Error(`API error fetching reciters: ${response.statusText}`);
    }
    const data = await response.json();

     if (!data || !data.data || !Array.isArray(data.data)) {
       throw new Error('Invalid reciters format received from API.');
     }

    return data.data.map((edition: any) => ({
       id: edition.identifier,
       name: edition.englishName || edition.name || edition.identifier,
       language: edition.language || 'unknown',
    }));
  } catch (error) {
    console.error("Failed to fetch reciters:", error);
    // Provide a minimal fallback or rethrow
    console.warn('getReciters() returning minimal fallback due to error.');
     return [
       { id: 'ar.alafasy', name: 'Mishary Rashid Al-Afasy', language: 'ar' },
       // Add other known essential reciters if desired as fallback
     ];
    // throw error; // Or rethrow if a fallback isn't suitable
  }
}

/**
 * Asynchronously retrieves a specific verse's data including text, translation, and audio URL.
 * Fetches multiple editions (Arabic/Audio + Translation) in a single API call.
 * Uses `fetch` with caching options.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @param translationIdentifier The identifier for the desired translation (e.g., "en.clearquran").
 * @param reciterIdentifier The identifier for the desired audio reciter (e.g., "ar.alafasy").
 * @param metaData The Quran metadata object (needed for verse mapping).
 * @returns A promise that resolves to a Verse object or null if a critical error occurs (e.g., cannot fetch verse data).
 */
export async function getVerse(
  absoluteVerseNumber: number,
  translationIdentifier: string,
  reciterIdentifier: string,
  metaData: QuranMeta | null
): Promise<Verse | null> {
  const verseLocation = absoluteVerseToSurahAyah(absoluteVerseNumber, metaData);

  if (!verseLocation) {
     console.error(`Invalid verse number (${absoluteVerseNumber}) or missing metadata.`);
     return null;
   }

   const { reference: verseReference, surahMeta } = verseLocation;

  try {
    // --- Fetch multiple editions (Audio/Arabic + Translation) in one call ---
    const editions = `${reciterIdentifier},${translationIdentifier}`;
    const apiUrl = `${API_BASE_URL}/ayah/${verseReference}/editions/${editions}`;
    // Cache verse data, revalidate based on expectation of changes (e.g., daily)
    const response = await fetch(apiUrl, {
        next: { revalidate: 86400 } // Revalidate after 1 day
    });

    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`Ayah ${verseReference} not found for editions ${editions}.`);
            return null; // Verse doesn't exist for these editions
        }
        throw new Error(`API error fetching editions for ${verseReference} (${editions}): ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code !== 200 || !Array.isArray(result.data) || result.data.length === 0) {
        console.error(`Invalid data format or empty data received for ${verseReference} (${editions}). Response:`, JSON.stringify(result));
        throw new Error(`Invalid data format received for ${verseReference}.`);
    }

    // --- Process the response ---
    let arabicText: string | null = null;
    let englishTranslation: string | null = null;
    let audioUrl: string | null = null;

    // Find the data for each requested edition
    const audioEditionData = result.data.find((ed: any) => ed?.edition?.identifier === reciterIdentifier);
    const translationEditionData = result.data.find((ed: any) => ed?.edition?.identifier === translationIdentifier);

    if (audioEditionData) {
        arabicText = audioEditionData.text;
        audioUrl = audioEditionData.audio; // Extract audio URL directly
        if (!arabicText) {
             console.warn(`Arabic text missing for reciter ${reciterIdentifier} in verse ${verseReference}.`);
        }
        if (!audioUrl) {
             console.warn(`Audio URL missing for reciter ${reciterIdentifier} in verse ${verseReference}.`);
        }
    } else {
        console.warn(`Reciter edition ${reciterIdentifier} not found in response for verse ${verseReference}.`);
        // Attempt to get Arabic text from translation data if audio is missing
        // This assumes the translation endpoint might also return the Arabic text sometimes
        if (translationEditionData && translationEditionData.text && !arabicText) {
             // Be cautious: Check if translation data actually contains the Arabic text if needed
             // For simplicity, we assume the primary source is the audio edition here.
             // arabicText = translationEditionData.text; // Uncomment if this logic is desired
        }
    }

    if (translationEditionData) {
        englishTranslation = translationEditionData.text;
        if (!englishTranslation) {
             console.warn(`English translation missing for ${translationIdentifier} in verse ${verseReference}.`);
        }
    } else {
         console.warn(`Translation edition ${translationIdentifier} not found in response for verse ${verseReference}.`);
    }


    // If we couldn't get the Arabic text (essential), return null
    if (!arabicText) {
         console.error(`Could not retrieve essential Arabic text for verse ${verseReference}.`);
         return null;
    }

    // --- Combine and Return ---
    return {
      verseNumber: absoluteVerseNumber,
      verseReference: verseReference,
      arabicText: arabicText, // Non-null asserted due to check above
      englishTranslation: englishTranslation ?? "Translation not available.", // Provide default if null
      audioUrl: audioUrl, // Can be null if missing
      surah: surahMeta,
    };

  } catch (error) {
    // Catch fetch errors or other processing errors
    console.error(`Failed to process verse data for ${verseReference} (Reciter: ${reciterIdentifier}, Translation: ${translationIdentifier}):`, error);
    return null; // Return null on critical errors
  }
}
