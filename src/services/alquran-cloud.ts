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
   * The audio URL for the verse.
   */
  audioUrl: string;
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
const AUDIO_CDN_BASE_URL = 'https://cdn.alquran.cloud/media/audio/ayah'; // New base URL structure

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
 * Fetches audio/Arabic and translation in separate calls for robustness.
 * Uses `fetch` with caching options.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @param translationIdentifier The identifier for the desired translation (e.g., "en.clearquran").
 * @param reciterIdentifier The identifier for the desired audio reciter (e.g., "ar.alafasy").
 * @param metaData The Quran metadata object (needed for verse mapping).
 * @returns A promise that resolves to a Verse object or null if a critical error occurs (e.g., cannot fetch Arabic text).
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
    // --- Fetch Audio/Arabic data ---
    // Cache verse data, revalidate based on expectation of changes (e.g., daily)
    const audioResponse = await fetch(`${API_BASE_URL}/ayah/${verseReference}/${reciterIdentifier}`, {
        next: { revalidate: 86400 } // Revalidate after 1 day
    });

    if (!audioResponse.ok) {
        if (audioResponse.status === 404) {
            console.warn(`Ayah ${verseReference} not found for reciter ${reciterIdentifier}.`);
            return null; // Arabic text is essential, return null if not found
        }
        throw new Error(`API error fetching audio/Arabic for ${verseReference} (${reciterIdentifier}): ${audioResponse.status} ${audioResponse.statusText}`);
    }
    const audioData = await audioResponse.json();
    // Use optional chaining and nullish coalescing for safer access
    const arabicText = audioData?.data?.text;
     if (!arabicText) {
        console.error(`Arabic text missing in response for ${verseReference} (${reciterIdentifier}). Response:`, JSON.stringify(audioData));
        throw new Error(`Arabic text missing for ${verseReference} (${reciterIdentifier})`);
     }

    // Construct audio URL using the standard CDN pattern
    const audioUrl = `${AUDIO_CDN_BASE_URL}/${reciterIdentifier}/${verseReference}`;

    // --- Fetch Translation data ---
    let englishTranslation = "Translation not available."; // Default text
    try {
      const translationResponse = await fetch(`${API_BASE_URL}/ayah/${verseReference}/${translationIdentifier}`, {
          next: { revalidate: 86400 } // Revalidate after 1 day
      });

      if (translationResponse.ok) {
        const translationData = await translationResponse.json();
        // Use optional chaining and nullish coalescing
        englishTranslation = translationData?.data?.text ?? englishTranslation;
      } else if (translationResponse.status === 404) {
          console.warn(`Translation '${translationIdentifier}' not found for verse ${verseReference}.`);
          // Keep the default "Translation not available." message
      } else {
         // Log non-404 errors for translation but don't fail the whole verse load
         console.error(`API error fetching translation for ${verseReference} (${translationIdentifier}): ${translationResponse.status} ${translationResponse.statusText}`);
      }
    } catch (translationError) {
       // Catch fetch errors specifically for translation
       console.error(`Failed to fetch translation ${translationIdentifier} for verse ${verseReference}:`, translationError);
    }

    // --- Combine and Return ---
    return {
      verseNumber: absoluteVerseNumber,
      verseReference: verseReference,
      arabicText: arabicText,
      englishTranslation: englishTranslation,
      audioUrl: audioUrl,
      surah: surahMeta,
    };

  } catch (error) {
    // Catch errors primarily from the audio/Arabic fetch or critical data processing
    console.error(`Failed to fetch critical verse data for ${verseReference} (Reciter: ${reciterIdentifier}):`, error);
    return null; // Return null on critical errors
  }
}
