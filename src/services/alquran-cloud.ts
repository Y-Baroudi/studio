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
const AUDIO_CDN_BASE_URL = 'https://cdn.islamic.network/quran/audio'; // Or cdn.alquran.cloud based on API

/**
 * Fetches the metadata for the Quran (Surah names, verse counts, etc.).
 * @returns A promise that resolves to the QuranMeta object.
 */
export async function getQuranMeta(): Promise<QuranMeta> {
  try {
    const response = await fetch(`${API_BASE_URL}/meta`);
    if (!response.ok) {
      throw new Error(`API error fetching metadata: ${response.statusText}`);
    }
    const data = await response.json();
    // Basic validation
    if (!data.data || !data.data.surahs || !data.data.surahs.references) {
        throw new Error('Invalid metadata format received from API.');
    }
    // Map API response to our QuranMeta interface if needed, or assume it matches
    return data.data as QuranMeta;
  } catch (error) {
    console.error("Failed to fetch Quran metadata:", error);
    throw error; // Re-throw to be handled by the caller
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
 *
 * @returns A promise that resolves to a list of Reciter objects.
 */
export async function getReciters(): Promise<Reciter[]> {
   try {
    // Fetch audio editions that are verse-by-verse
    const response = await fetch(`${API_BASE_URL}/edition?format=audio&type=versebyverse`);
     if (!response.ok) {
      throw new Error(`API error fetching reciters: ${response.statusText}`);
    }
    const data = await response.json();

     // Validate response structure (adjust based on actual API response)
     if (!data || !data.data || !Array.isArray(data.data)) {
       throw new Error('Invalid reciters format received from API.');
     }

    // Map API response to our Reciter interface
    return data.data.map((edition: any) => ({
       id: edition.identifier,
       // Prefer englishName if available, fallback to name
       name: edition.englishName || edition.name || edition.identifier,
       language: edition.language || 'unknown',
    }));
  } catch (error) {
    console.error("Failed to fetch reciters:", error);
    // Return a default or empty list on error? Or rethrow? Rethrowing is usually better.
     // Return placeholder data as fallback for now, remove in production
     console.warn('getReciters() is using placeholder data due to fetch error.');
     return [
       { id: 'ar.alafasy', name: 'Mishary Rashid Al-Afasy', language: 'ar' },
       { id: 'ar.saoodshuraym', name: 'Sa`ud ash-Shuraym', language: 'ar' },
       { id: 'en.walk', name: 'Ibrahim Walk (English)', language: 'en' },
     ];
    // throw error;
  }
}

/**
 * Asynchronously retrieves a specific verse's data including text, translation, and audio URL.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @param translationIdentifier The identifier for the desired translation (e.g., "en.clearquran").
 * @param reciterIdentifier The identifier for the desired audio reciter (e.g., "ar.alafasy").
 * @param metaData The Quran metadata object (needed for verse mapping).
 * @returns A promise that resolves to a Verse object or null if an error occurs.
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

   // Define the editions to fetch. Arabic text comes from the reciter's edition.
   const editions = `${reciterIdentifier},${translationIdentifier}`;

  try {
    const response = await fetch(`${API_BASE_URL}/ayah/${verseReference}/editions/${editions}`);
    if (!response.ok) {
       // Handle common errors like 404 for invalid verses/editions
      if (response.status === 404) {
         console.warn(`Verse ${verseReference} or editions (${editions}) not found.`);
         return null; // Indicate verse data couldn't be found
       }
      throw new Error(`API error fetching verse ${verseReference}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    // Basic validation of response structure
    if (!data.data || !Array.isArray(data.data) || data.data.length < 2) {
        throw new Error(`Invalid verse data format received for ${verseReference}`);
    }

    // Find the correct editions in the response array
    // The order might not be guaranteed, so check identifiers
    const audioEditionData = data.data.find((ed: any) => ed.edition.identifier === reciterIdentifier);
    const translationEditionData = data.data.find((ed: any) => ed.edition.identifier === translationIdentifier);

     if (!audioEditionData || !translationEditionData) {
       console.error(`Required editions not found in API response for verse ${verseReference}. Reciter: ${reciterIdentifier}, Translation: ${translationIdentifier}`);
       // Log the received identifiers for debugging
       console.log("Available identifiers:", data.data.map((ed: any) => ed.edition.identifier));
      throw new Error(`Required editions not found in API response for ${verseReference}.`);
    }

     // Construct audio URL using the standard CDN pattern
     // Note: The API *might* provide an audio URL directly (`audioEditionData.audio`),
     // but often the CDN pattern is more reliable and consistent. Double-check API docs.
     // Using 64kbps audio for smaller size by default, API might default to 128.
     const audioQuality = '64'; // or '128'
     const audioUrl = `${AUDIO_CDN_BASE_URL}/${audioQuality}/${reciterIdentifier}/${absoluteVerseNumber}.mp3`;

     // Use absoluteVerseNumber from input, not calculated from potentially incomplete meta
    return {
      verseNumber: absoluteVerseNumber,
      verseReference: verseReference,
      arabicText: audioEditionData.text, // Get Arabic text from the audio edition
      englishTranslation: translationEditionData.text,
      audioUrl: audioUrl, // Use the constructed CDN URL
      surah: surahMeta,
    };
  } catch (error) {
    console.error(`Failed to fetch verse ${verseReference}:`, error);
    return null; // Return null on error to allow the UI to handle it
  }
}
