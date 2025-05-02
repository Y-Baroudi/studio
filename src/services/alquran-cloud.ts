

/**
 * @fileoverview Service functions for interacting with the alquran.cloud API v1.
 * Provides functions to fetch Quran metadata, reciters, translations, and verse/surah data.
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
   * The number of the ayah within the surah (e.g., 1 for 1:1).
   */
  ayahNumberInSurah: number;
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

// Default Arabic edition identifier
const ARABIC_EDITION_ID = 'quran-uthmani';

// List of commonly used English translations as a fallback
export const SUPPORTED_TRANSLATIONS: Translation[] = [
    { id: 'en.clearquran', name: 'The Clear Quran', language: 'en', translator: 'Dr. Mustafa Khattab' },
    { id: 'en.sahih', name: 'Sahih International', language: 'en', translator: 'Sahih International' },
    { id: 'en.asad', name: 'Muhammad Asad', language: 'en', translator: 'Muhammad Asad' },
    { id: 'en.pickthall', name: 'Pickthall', language: 'en', translator: 'Mohammed Marmaduke William Pickthall'},
    { id: 'en.yusufali', name: 'Yusuf Ali', language: 'en', translator: 'Abdullah Yusuf Ali'},
    // Add more translations as needed
].filter(t => t.language === 'en'); // Ensure only English


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
): { surahNumber: number; ayahNumber: number; reference: string; surahMeta: SurahMeta | null } | null {
  if (!metaData || absoluteVerseNumber < 1 || absoluteVerseNumber > 6236) {
    return null; // Invalid input
  }

  let verseCount = 0;
  for (const surah of metaData.surahs.references) {
    if (absoluteVerseNumber <= verseCount + surah.numberOfAyahs) {
      const ayahNumber = absoluteVerseNumber - verseCount;
      return {
        surahNumber: surah.number,
        ayahNumber: ayahNumber,
        reference: `${surah.number}:${ayahNumber}`,
        surahMeta: surah,
      };
    }
    verseCount += surah.numberOfAyahs;
  }

  return null; // Should not happen if absoluteVerseNumber <= 6236
}

/**
 * Converts a Surah:Ayah reference to its absolute verse number (1-6236).
 *
 * @param surahNumber The surah number.
 * @param ayahNumber The ayah number within the surah.
 * @param metaData The Quran metadata object.
 * @returns The absolute verse number or null if invalid.
 */
export function surahAyahToAbsoluteVerse(
  surahNumber: number,
  ayahNumber: number,
  metaData: QuranMeta | null
): number | null {
  if (!metaData || surahNumber < 1 || surahNumber > 114) {
    return null;
  }

  let absoluteVerse = 0;
  for (let i = 0; i < surahNumber - 1; i++) {
    if (i >= metaData.surahs.references.length) return null; // Should not happen
    absoluteVerse += metaData.surahs.references[i].numberOfAyahs;
  }

  const targetSurah = metaData.surahs.references[surahNumber - 1];
  if (!targetSurah || ayahNumber < 1 || ayahNumber > targetSurah.numberOfAyahs) {
    return null; // Invalid ayah number for the surah
  }

  absoluteVerse += ayahNumber;
  return absoluteVerse;
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
    })).filter((r: Reciter) => r.language === 'ar'); // Keep only Arabic reciters for now
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
 * Fetches Arabic text (quran-uthmani), selected translation, and selected audio edition.
 * Uses `fetch` with built-in caching options.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @param translationIdentifier The identifier for the desired translation (e.g., "en.clearquran"). Pass null if no translation is needed.
 * @param reciterIdentifier The identifier for the desired audio reciter (e.g., "ar.alafasy"). Pass null if no audio is needed.
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

  const { reference: verseReference, surahMeta, ayahNumber } = verseLocation;

  // Construct editions string for API call
  // Always include ARABIC_EDITION_ID for Arabic text
  const editions = [ARABIC_EDITION_ID, translationIdentifier, reciterIdentifier]
    .filter(Boolean) // Remove null/undefined values
    .join(',');

  if (!editions) {
      console.error("No valid editions (Arabic, translation, or reciter) specified.");
       return { // Return minimal verse object if somehow no editions are requested
        verseNumber: absoluteVerseNumber,
        verseReference: verseReference,
        ayahNumberInSurah: ayahNumber,
        arabicText: null,
        englishTranslation: null,
        audioUrl: null,
        surah: surahMeta,
      };
  }

  try {
    const apiUrl = `${API_BASE_URL}/ayah/${verseReference}/editions/${editions}`;
    // console.log("Fetching verse from:", apiUrl); // Debugging URL
    const response = await fetch(apiUrl, { next: { revalidate: 86400 } }); // Revalidate daily

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Ayah ${verseReference} not found for editions ${editions}.`);
        // Return a partial object with nulls instead of throwing error or returning null completely
        return {
            verseNumber: absoluteVerseNumber,
            verseReference: verseReference,
            ayahNumberInSurah: ayahNumber,
            arabicText: null, // Indicate failure to get text
            englishTranslation: null,
            audioUrl: null,
            surah: surahMeta,
        };
      }
      const errorBody = await response.text();
       console.error(`API error fetching editions for ${verseReference} (${editions}): ${response.status} ${response.statusText}. Body: ${errorBody}`);
       // Throw a more specific error or return null based on desired handling
       throw new Error(`API error ${response.status} for ${verseReference}/${editions}`);
    }

    const result = await response.json();
    // console.log("API Response for", verseReference, editions, ":", result); // Debugging response

    if (result.code !== 200 || !Array.isArray(result.data)) {
      console.error(`Invalid data format or non-200 code received for ${verseReference} (${editions}). Response:`, JSON.stringify(result));
       // Return null or a partial object if data format is wrong
       return null;
    }

    // Handle cases where the API returns 200 OK but an empty data array (can happen)
    if (result.data.length === 0 && editions) {
        console.warn(`API returned empty data array for ${verseReference} (${editions}). Verse might be missing in requested editions.`);
        return {
            verseNumber: absoluteVerseNumber,
            verseReference: verseReference,
            ayahNumberInSurah: ayahNumber,
            arabicText: null,
            englishTranslation: null,
            audioUrl: null,
            surah: surahMeta,
        };
    }

    let arabicText: string | null = null;
    let englishTranslation: string | null = null;
    let audioUrl: string | null = null;

    // Find data for each requested edition type
    const arabicEditionData = result.data.find((ed: any) => ed?.edition?.identifier === ARABIC_EDITION_ID);
    const translationEditionData = translationIdentifier ? result.data.find((ed: any) => ed?.edition?.identifier === translationIdentifier) : null;
    const audioEditionData = reciterIdentifier ? result.data.find((ed: any) => ed?.edition?.identifier === reciterIdentifier) : null;

    // Extract data safely
    if (arabicEditionData) {
      arabicText = arabicEditionData.text ?? null;
      if (!arabicText) console.warn(`Arabic text missing for ${ARABIC_EDITION_ID} in verse ${verseReference}.`);
    } else {
        // This is critical - if quran-uthmani wasn't returned, log an error.
        console.error(`Required Arabic edition '${ARABIC_EDITION_ID}' not found in response for verse ${verseReference}. Available:`, result.data.map((ed:any) => ed?.edition?.identifier));
        // Return a partial response indicating the missing Arabic text
         return {
            verseNumber: absoluteVerseNumber,
            verseReference: verseReference,
            ayahNumberInSurah: ayahNumber,
            arabicText: null, // Indicate failure
            englishTranslation: translationEditionData?.text ?? null,
            audioUrl: audioEditionData?.audio ?? null,
            surah: surahMeta,
         };
    }

    if (translationIdentifier) {
        if (translationEditionData) {
          englishTranslation = translationEditionData.text ?? null;
          if (!englishTranslation) console.warn(`English translation text missing for ${translationIdentifier} in verse ${verseReference}.`);
        } else {
          console.warn(`Requested translation edition ${translationIdentifier} not found in response for verse ${verseReference}. Available:`, result.data.map((ed:any) => ed?.edition?.identifier));
        }
    }

    if (reciterIdentifier) {
        if (audioEditionData) {
            audioUrl = audioEditionData.audio ?? null;
            if (!audioUrl) console.warn(`Audio URL missing for reciter ${reciterIdentifier} in verse ${verseReference}.`);
        } else {
          console.warn(`Requested reciter edition ${reciterIdentifier} not found in response for verse ${verseReference}. Available:`, result.data.map((ed:any) => ed?.edition?.identifier));
        }
    }

    // Construct the final Verse object
    return {
      verseNumber: absoluteVerseNumber,
      verseReference: verseReference,
      ayahNumberInSurah: ayahNumber,
      arabicText: arabicText,
      englishTranslation: englishTranslation,
      audioUrl: audioUrl,
      surah: surahMeta,
    };

  } catch (error) {
    console.error(`Failed to process verse data for ${verseReference} (Editions: ${editions}):`, error);
    // Return null in case of fetch or processing errors
    return null;
  }
}


/**
 * Asynchronously retrieves a list of available English translation editions.
 * Uses `fetch` with caching options. Falls back to a hardcoded list on error.
 *
 * @returns A promise that resolves to a list of Translation objects.
 */
export async function getTranslations(): Promise<Translation[]> {
  try {
    // Cache translation list, revalidate periodically (e.g., daily)
    // Fetch English translations specifically
    const response = await fetch(`${API_BASE_URL}/edition?format=text&language=en&type=translation`, {
      next: { revalidate: 86400 } // Revalidate after 1 day
    });
    if (!response.ok) {
       console.warn(`API error fetching translations (${response.status}), using fallback.`);
       return SUPPORTED_TRANSLATIONS; // Fallback on API error status
    }
    const data = await response.json();

    if (!data || !data.data || !Array.isArray(data.data)) {
      console.warn('Invalid translations format received from API, using fallback.');
      return SUPPORTED_TRANSLATIONS; // Fallback on invalid format
    }

    const availableTranslations: Translation[] = data.data
      .map((edition: any) => ({
          id: edition.identifier,
          // Prioritize englishName, then name, then identifier
          name: edition.englishName || edition.name || edition.identifier,
          language: edition.language || 'unknown',
          // Use englishName for translator if available, fallback gracefully
          translator: edition.englishName || (edition.name && edition.name !== edition.identifier ? edition.name : 'N/A'),
      }))
      .filter((t: Translation) => t.language === 'en'); // Ensure only English translations

    // Return API results if available and non-empty, otherwise fallback
    return availableTranslations.length > 0 ? availableTranslations : SUPPORTED_TRANSLATIONS;

  } catch (error) {
    console.error("Failed to fetch translations:", error);
    console.warn('getTranslations() returning hardcoded list due to fetch error.');
    return SUPPORTED_TRANSLATIONS; // Fallback on fetch/processing error
  }
}


/**
 * Fetches all verses for a given Surah number and specified editions.
 * Primarily used for continuous scrolling where fetching individual verses would be inefficient.
 *
 * @param surahNumber The number of the Surah (1-114).
 * @param translationIdentifier The identifier for the desired translation edition.
 * @param reciterIdentifier The identifier for the desired audio reciter edition.
 * @param metaData Quran metadata for surah information.
 * @returns A promise resolving to an array of Verse objects for the Surah, or null on error.
 */
export async function getSurahData(
  surahNumber: number,
  translationIdentifier: string | null,
  reciterIdentifier: string | null,
  metaData: QuranMeta | null
): Promise<Verse[] | null> {
    if (!metaData) {
        console.error("Cannot fetch surah data without Quran metadata.");
        return null;
    }

    const targetSurahMeta = metaData.surahs.references.find(s => s.number === surahNumber);
    if (!targetSurahMeta) {
        console.error(`Surah metadata not found for surah number ${surahNumber}.`);
        return null;
    }

    // Construct editions string, always including Arabic
    const editions = [ARABIC_EDITION_ID, translationIdentifier, reciterIdentifier]
        .filter(Boolean) // Remove nulls
        .join(',');

     if (!editions) {
        console.error("No valid editions specified for fetching surah data.");
        return null; // Or potentially return only Arabic if that's a valid fallback
    }

    try {
        const apiUrl = `${API_BASE_URL}/surah/${surahNumber}/editions/${editions}`;
        console.log(`Fetching Surah ${surahNumber} data from: ${apiUrl}`); // Debugging URL
        const response = await fetch(apiUrl, { next: { revalidate: 86400 } }); // Cache daily

        if (!response.ok) {
            throw new Error(`API error fetching surah ${surahNumber} (${editions}): ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        if (result.code !== 200 || !result.data || !Array.isArray(result.data)) {
            throw new Error(`Invalid data format received for Surah ${surahNumber} (${editions}).`);
        }

        // Process the response to structure it into Verse objects
        const numberOfEditions = editions.split(',').length;
        const apiAyahs = result.data[0]?.ayahs; // Assuming Arabic is always first and contains all ayahs

        if (!apiAyahs || !Array.isArray(apiAyahs)) {
            console.error(`Ayahs array not found or invalid in response for Surah ${surahNumber}, edition ${result.data[0]?.edition?.identifier}.`);
             return null;
        }

         // Prepare data maps for efficient lookup
         const textMap: { [ayahNum: number]: { [editionId: string]: string | null } } = {};
         const audioMap: { [ayahNum: number]: { [editionId: string]: string | null } } = {};

         result.data.forEach((editionData: any) => {
            const editionId = editionData?.edition?.identifier;
            if (!editionId || !Array.isArray(editionData.ayahs)) return;

            editionData.ayahs.forEach((ayah: any) => {
                const ayahNum = ayah?.numberInSurah;
                if (typeof ayahNum !== 'number') return;

                if (!textMap[ayahNum]) textMap[ayahNum] = {};
                if (!audioMap[ayahNum]) audioMap[ayahNum] = {};

                if (ayah.text) {
                    textMap[ayahNum][editionId] = ayah.text;
                }
                if (ayah.audio) {
                    audioMap[ayahNum][editionId] = ayah.audio;
                }
            });
         });

        // Construct Verse objects
        const verses: Verse[] = [];
        for (let i = 0; i < targetSurahMeta.numberOfAyahs; i++) {
             const ayahNumberInSurah = i + 1; // Ayah numbers are 1-based
             const absoluteVerse = surahAyahToAbsoluteVerse(surahNumber, ayahNumberInSurah, metaData);

             if (absoluteVerse === null) {
                 console.warn(`Could not calculate absolute verse number for Surah ${surahNumber}, Ayah ${ayahNumberInSurah}. Skipping.`);
                 continue;
             }

             const verseReference = `${surahNumber}:${ayahNumberInSurah}`;

             const arabicText = textMap[ayahNumberInSurah]?.[ARABIC_EDITION_ID] ?? null;
             const englishTranslation = translationIdentifier ? (textMap[ayahNumberInSurah]?.[translationIdentifier] ?? null) : null;
             const audioUrl = reciterIdentifier ? (audioMap[ayahNumberInSurah]?.[reciterIdentifier] ?? null) : null;

            // Ensure we at least have Arabic text for a valid verse
            if (arabicText === null) {
                 console.warn(`Missing Arabic text for ${verseReference}. Skipping.`);
                 continue;
            }

             verses.push({
                 verseNumber: absoluteVerse,
                 verseReference: verseReference,
                 ayahNumberInSurah: ayahNumberInSurah,
                 arabicText: arabicText,
                 englishTranslation: englishTranslation,
                 audioUrl: audioUrl,
                 surah: targetSurahMeta,
             });
        }

         // Sanity check
        if (verses.length !== targetSurahMeta.numberOfAyahs) {
             console.warn(`Mismatch in expected (${targetSurahMeta.numberOfAyahs}) and parsed (${verses.length}) verses for Surah ${surahNumber}.`);
        }

        return verses;

    } catch (error) {
        console.error(`Failed to fetch or process data for Surah ${surahNumber} (${editions}):`, error);
        return null;
    }
}
