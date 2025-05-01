
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
   * The Arabic text of the verse. Null if not available.
   */
  arabicText: string | null;
  /**
   * The English translation of the verse. Null if not available.
   */
  englishTranslation: string | null;
  /**
   * The audio URL for the verse. Can be null if not found or reciter is null.
   */
  audioUrl: string | null;
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
 * Represents a translation edition available from alquran.cloud API.
 */
export interface Translation {
   /**
   * The translation's identifier used in the API (e.g., "en.clearquran").
   */
   id: string;
   /**
   * The translation's display name.
   */
   name: string;
   /**
   * Language of the translation (e.g., "en").
   */
   language: string;
   /**
    * Name of the translator.
    */
   translator: string;
}

/**
 * Base URL for the alquran.cloud API v1.
 */
const API_BASE_URL = 'https://api.alquran.cloud/v1';

// List of commonly used translations
export const SUPPORTED_TRANSLATIONS: Translation[] = [
    { id: 'en.clearquran', name: 'The Clear Quran', language: 'en', translator: 'Dr. Mustafa Khattab' },
    { id: 'en.sahih', name: 'Sahih International', language: 'en', translator: 'Sahih International' },
    { id: 'en.asad', name: 'Muhammad Asad', language: 'en', translator: 'Muhammad Asad' },
    { id: 'en.pickthall', name: 'Pickthall', language: 'en', translator: 'Mohammed Marmaduke William Pickthall'},
    { id: 'en.yusufali', name: 'Yusuf Ali', language: 'en', translator: 'Abdullah Yusuf Ali'},
    // Add more translations as needed
];


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
       { id: 'ar.abdulsamad', name: 'Abdul Samad', language: 'ar' },
       { id: 'ar.hudhaify', name: 'Ali Al-Hudhaify', language: 'ar' },
     ];
    // throw error; // Or rethrow if a fallback isn't suitable
  }
}

/**
 * Asynchronously retrieves a specific verse's data including text, translation, and audio URL.
 * Fetches multiple editions (Arabic/Audio + Translation) in a single API call if both identifiers are provided.
 * If only translationIdentifier is provided, it fetches only the translation.
 * If only reciterIdentifier is provided, it fetches only the Arabic text and audio.
 * Uses `fetch` with caching options.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @param translationIdentifier The identifier for the desired translation (e.g., "en.clearquran") or null.
 * @param reciterIdentifier The identifier for the desired audio reciter (e.g., "ar.alafasy") or null.
 * @param metaData The Quran metadata object (needed for verse mapping).
 * @returns A promise that resolves to a Verse object or null if a critical error occurs or no data is found.
 */
export async function getVerse(
  absoluteVerseNumber: number,
  translationIdentifier: string | null,
  reciterIdentifier: string | null,
  metaData: QuranMeta | null
): Promise<Verse | null> {
  const verseLocation = absoluteVerseToSurahAyah(absoluteVerseNumber, metaData);

  if (!verseLocation) {
     console.error(`Invalid verse number (${absoluteVerseNumber}) or missing metadata.`);
     return null;
   }

   const { reference: verseReference, surahMeta } = verseLocation;

   // Determine which editions to request
   const editionsToFetch = [reciterIdentifier, translationIdentifier].filter(Boolean).join(',');

   if (!editionsToFetch) {
     console.error("No editions specified (reciter or translation).");
     return { // Return a minimal verse object if needed, or null
        verseNumber: absoluteVerseNumber,
        verseReference: verseReference,
        arabicText: null,
        englishTranslation: null,
        audioUrl: null,
        surah: surahMeta,
      };
   }


  try {
    const apiUrl = `${API_BASE_URL}/ayah/${verseReference}/editions/${editionsToFetch}`;
    // Cache verse data, revalidate based on expectation of changes (e.g., daily)
    const response = await fetch(apiUrl, {
        next: { revalidate: 86400 } // Revalidate after 1 day
    });

    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`Ayah ${verseReference} not found for editions ${editionsToFetch}.`);
            return null; // Verse doesn't exist for these editions
        }
        // Log the full error for better debugging
        const errorBody = await response.text();
        console.error(`API error fetching editions for ${verseReference} (${editionsToFetch}): ${response.status} ${response.statusText}. Body: ${errorBody}`);
        throw new Error(`API error fetching editions for ${verseReference} (${editionsToFetch}): ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code !== 200 || !Array.isArray(result.data) || result.data.length === 0) {
        console.error(`Invalid data format or empty data received for ${verseReference} (${editionsToFetch}). Response:`, JSON.stringify(result));
        // Return null instead of throwing, as the API might sometimes return empty data legitimately (though unlikely for valid requests)
        return null;
    }

    // --- Process the response ---
    let arabicText: string | null = null;
    let englishTranslation: string | null = null;
    let audioUrl: string | null = null;

    // Find the data for each requested edition
    const audioEditionData = reciterIdentifier ? result.data.find((ed: any) => ed?.edition?.identifier === reciterIdentifier) : null;
    const translationEditionData = translationIdentifier ? result.data.find((ed: any) => ed?.edition?.identifier === translationIdentifier) : null;

    if (audioEditionData) {
        arabicText = audioEditionData.text ?? null; // Use nullish coalescing
        audioUrl = audioEditionData.audio ?? null;
        if (!arabicText) {
             console.warn(`Arabic text missing for reciter ${reciterIdentifier} in verse ${verseReference}.`);
        }
        // No warning needed for missing audioUrl, it's optional
    } else if (reciterIdentifier) {
        console.warn(`Reciter edition ${reciterIdentifier} not found in response for verse ${verseReference}. Audio/Arabic text may be unavailable.`);
    }

    if (translationEditionData) {
        englishTranslation = translationEditionData.text ?? null;
         if (!englishTranslation) {
             console.warn(`English translation missing for ${translationIdentifier} in verse ${verseReference}.`);
         }
         // If Arabic text wasn't found in audio edition, check translation edition (some include it)
         if (!arabicText && translationEditionData.text && translationEditionData.edition?.language === 'ar') {
              // This is a fallback, be cautious
              // arabicText = translationEditionData.text;
              // console.log(`Used Arabic text from translation edition ${translationIdentifier} as fallback.`);
         } else if (!arabicText && translationEditionData.ayahs && translationEditionData.ayahs[0]?.text) {
            // Sometimes the structure might differ, check nested properties
             // arabicText = translationEditionData.ayahs[0].text;
             // console.log(`Used nested Arabic text from translation edition ${translationIdentifier} as fallback.`);
         }

    } else if (translationIdentifier) {
         console.warn(`Translation edition ${translationIdentifier} not found in response for verse ${verseReference}.`);
    }

    // If NO data was found at all (e.g., API error didn't catch, but data is empty/wrong)
    if (!arabicText && !englishTranslation && !audioUrl) {
        console.error(`Could not retrieve any usable data for verse ${verseReference}.`);
        return null;
    }


    // --- Combine and Return ---
    return {
      verseNumber: absoluteVerseNumber,
      verseReference: verseReference,
      arabicText: arabicText, // Can be null
      englishTranslation: englishTranslation, // Can be null
      audioUrl: audioUrl, // Can be null
      surah: surahMeta,
    };

  } catch (error) {
    // Catch fetch errors or other processing errors
    console.error(`Failed to process verse data for ${verseReference} (Reciter: ${reciterIdentifier}, Translation: ${translationIdentifier}):`, error);
    return null; // Return null on critical errors
  }
}

/**
 * Asynchronously retrieves a list of available translation editions.
 * Uses `fetch` with caching options.
 *
 * @returns A promise that resolves to a list of Translation objects.
 */
export async function getTranslations(): Promise<Translation[]> {
  try {
    // Cache translation list, revalidate periodically (e.g., daily)
    const response = await fetch(`${API_BASE_URL}/edition?format=text&language=en&type=translation`, {
      next: { revalidate: 86400 } // Revalidate after 1 day
    });
    if (!response.ok) {
      throw new Error(`API error fetching translations: ${response.statusText}`);
    }
    const data = await response.json();

    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid translations format received from API.');
    }

    // Filter using SUPPORTED_TRANSLATIONS for a curated list, or map all results
    const availableTranslations = data.data.map((edition: any) => ({
        id: edition.identifier,
        name: edition.englishName || edition.name || edition.identifier,
        language: edition.language || 'unknown',
        translator: edition.translator || 'N/A', // Assuming translator field exists, provide fallback
    }));

    // Optionally filter based on our supported list:
    // const supportedAvailable = availableTranslations.filter(t =>
    //     SUPPORTED_TRANSLATIONS.some(st => st.id === t.id)
    // );
    // return supportedAvailable.length > 0 ? supportedAvailable : SUPPORTED_TRANSLATIONS; // Fallback to hardcoded if API fails badly

    return availableTranslations.length > 0 ? availableTranslations : SUPPORTED_TRANSLATIONS; // Return API results or hardcoded list

  } catch (error) {
    console.error("Failed to fetch translations:", error);
    console.warn('getTranslations() returning hardcoded list due to error.');
    return SUPPORTED_TRANSLATIONS; // Return hardcoded list as fallback
  }
}
