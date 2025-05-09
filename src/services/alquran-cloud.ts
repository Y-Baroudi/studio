
// src/services/alquran-cloud.ts

/**
 * @fileoverview Service functions for interacting with the Al Quran Cloud API.
 * Provides functions to fetch Quran text, translations, reciters, and metadata.
 * Implements caching to minimize API calls.
 */

// --- Interfaces ---
export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: 'Meccan' | 'Medinan';
  numberOfAyahs: number;
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
  audio?: string; // Audio URL for the primary reciter (uthmani response)
  audioSecondary?: string[]; // URLs for other reciters if fetched
  translationText?: string; // Added for combined verse data
}

export interface SurahDataResponse {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: 'Meccan' | 'Medinan';
  numberOfAyahs: number;
  ayahs: Ayah[];
  edition: Edition;
}

export interface Translation {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
  direction: string;
}

export interface Reciter {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
  direction: string; // Though typically null for audio
}

export interface Edition {
    identifier: string;
    language: string;
    name: string;
    englishName: string;
    format: 'text' | 'audio';
    type: 'translation' | 'quran' | 'tafsir' | 'transliteration' | 'versebyverse';
    direction: 'ltr' | 'rtl' | null;
}

export interface QuranMeta {
    surahs: Surah[];
    totalVerses: number;
    // Add other meta fields if needed from the API
}

export interface VerseData {
    surah: number;
    numberInSurah: number;
    absoluteVerseNumber: number;
    arabicText: string;
    translation: string;
    audio?: string; // Optional audio URL
    juz?: number;
    page?: number;
    hizbQuarter?: number;
}


// --- Constants ---
const API_BASE_URL = 'https://api.alquran.cloud/v1';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days cache

// --- Helper Functions ---

/**
 * Fetches data from the API with caching.
 * @param url - The API endpoint URL.
 * @param cacheKey - The key to use for localStorage caching.
 * @returns The fetched data (typically JSON).
 */
async function fetchWithCache<T>(url: string, cacheKey: string): Promise<T | null> {
  if (typeof window === 'undefined') {
    // Skip caching on server-side
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data.code !== 200) {
          throw new Error(`API returned error code ${data.code}: ${data.status}`);
      }
      return data.data as T;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      return null;
    }
  }

  // Client-side caching logic
  const cachedItem = localStorage.getItem(cacheKey);
  const cachedTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);

  if (cachedItem && cachedTimestamp) {
    const now = new Date().getTime();
    const cacheTime = parseInt(cachedTimestamp, 10);
    if (now - cacheTime < CACHE_DURATION_MS) {
      console.log(`Using cached data for ${cacheKey}`);
      try {
        return JSON.parse(cachedItem) as T;
      } catch (e) {
        console.error(`Error parsing cached data for ${cacheKey}:`, e);
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}_timestamp`);
      }
    } else {
        console.log(`Cache expired for ${cacheKey}`);
    }
  }

  console.log(`Fetching fresh data for ${cacheKey} from ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText} for ${url}`);
    }
    const data = await response.json();
     if (data.code !== 200) {
          throw new Error(`API returned error code ${data.code}: ${data.status} for ${url}. Response: ${JSON.stringify(data)}`);
      }

    localStorage.setItem(cacheKey, JSON.stringify(data.data));
    localStorage.setItem(`${cacheKey}_timestamp`, new Date().getTime().toString());
    return data.data as T;
  } catch (error) {
    console.error(`Error fetching or caching ${url}:`, error);
    // Attempt to return stale cache if fetch fails
    if (cachedItem) {
        console.warn(`Returning stale cache for ${cacheKey} due to fetch error.`);
        try {
            return JSON.parse(cachedItem) as T;
        } catch (e) {
             console.error(`Error parsing stale cached data for ${cacheKey}:`, e);
        }
    }
    return null; // Return null if fetch fails and no cache is available
  }
}

// --- Public API Functions ---

/**
 * Fetches the list of available translations.
 * @returns A promise resolving to an array of Translation objects or null.
 */
export async function fetchTranslations(): Promise<Translation[] | null> {
  const url = `${API_BASE_URL}/edition/type/translation`;
  const cacheKey = 'quran_translations';
  const data = await fetchWithCache<{ editions: Translation[] }>(url, cacheKey);
   // The API nests the editions array inside a property named 'editions' apparently
   return data ? data.editions || data as unknown as Translation[] : null; // Adjust based on actual structure if needed
}

/**
 * Fetches the list of available reciters (audio editions).
 * @returns A promise resolving to an array of Reciter objects or null.
 */
export async function fetchReciters(): Promise<Reciter[] | null> {
  const url = `${API_BASE_URL}/edition/format/audio`;
  const cacheKey = 'quran_reciters';
   const data = await fetchWithCache<{ editions: Reciter[] }>(url, cacheKey);
   // API might nest the editions array
   return data ? data.editions || data as unknown as Reciter[] : null;
}

/**
 * Fetches the metadata for all Surahs in the Quran.
 * Includes total verse count.
 * @returns A promise resolving to QuranMeta object or null.
 */
export async function fetchQuranMeta(): Promise<QuranMeta | null> {
    const url = `${API_BASE_URL}/meta`;
    const cacheKey = 'quran_meta';
    const data = await fetchWithCache<{ surahs: { references: Surah[] }, ayahs: { count: number } }>(url, cacheKey);
    if (!data || !data.surahs || !data.surahs.references || !data.ayahs) {
        console.error("Invalid metadata structure received:", data);
        return null;
    }
    return {
        surahs: data.surahs.references,
        totalVerses: data.ayahs.count,
    };
}


/**
 * Fetches the complete data for a specific Surah, including Arabic text and a translation.
 *
 * @param surahNumber - The number of the Surah (1-114).
 * @param translationIdentifier - The identifier for the desired translation (e.g., 'en.clearquran').
 * @returns A promise resolving to an object containing Surah metadata and combined verse data, or null.
 */
export async function fetchSurahData(
  surahNumber: number,
  translationIdentifier: string = 'en.clearquran'
): Promise<{ meta: SurahMeta; verses: VerseData[] } | null> {
  // Validate input
  if (surahNumber < 1 || surahNumber > 114) {
    console.error(`Invalid surah number: ${surahNumber}`);
    return null;
  }

  const arabicEdition = 'quran-uthmani'; // Use standard Uthmani script for Arabic
  const arabicUrl = `${API_BASE_URL}/surah/${surahNumber}/${arabicEdition}`;
  const translationUrl = `${API_BASE_URL}/surah/${surahNumber}/${translationIdentifier}`;

  // Use combined cache key based on surah and translation
  const cacheKey = `surah_${surahNumber}_${arabicEdition}_${translationIdentifier}`;

   if (typeof window !== 'undefined') {
      const cachedItem = localStorage.getItem(cacheKey);
      const cachedTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
      if (cachedItem && cachedTimestamp) {
          const now = new Date().getTime();
          const cacheTime = parseInt(cachedTimestamp, 10);
          if (now - cacheTime < CACHE_DURATION_MS) {
              console.log(`Using cached data for ${cacheKey}`);
              try {
                  return JSON.parse(cachedItem);
              } catch (e) {
                  console.error(`Error parsing cached data for ${cacheKey}:`, e);
                  localStorage.removeItem(cacheKey);
                  localStorage.removeItem(`${cacheKey}_timestamp`);
              }
          } else {
               console.log(`Cache expired for ${cacheKey}`);
          }
      }
   }


  console.log(`Fetching fresh data for ${cacheKey}`);
  try {
    // Fetch both editions concurrently
    const [arabicRes, translationRes] = await Promise.all([
      fetch(arabicUrl),
      fetch(translationUrl)
    ]);

    if (!arabicRes.ok) throw new Error(`Failed to fetch Arabic text (${arabicEdition}) for Surah ${surahNumber}. Status: ${arabicRes.status}`);
    if (!translationRes.ok) throw new Error(`Failed to fetch translation (${translationIdentifier}) for Surah ${surahNumber}. Status: ${translationRes.status}`);

    const [arabicJson, translationJson] = await Promise.all([
      arabicRes.json(),
      translationRes.json()
    ]);

    if (arabicJson.code !== 200) throw new Error(`API error for Arabic text: ${arabicJson.status}`);
    if (translationJson.code !== 200) throw new Error(`API error for translation: ${translationJson.status}`);

    const arabicData: SurahDataResponse = arabicJson.data;
    const translationData: SurahDataResponse = translationJson.data;

    if (!arabicData || !Array.isArray(arabicData.ayahs) || !translationData || !Array.isArray(translationData.ayahs)) {
        throw new Error("Invalid data structure in API response.");
    }

    // Get metadata from the primary (Arabic) response
    const meta: SurahMeta = {
      number: arabicData.number,
      name: arabicData.name,
      englishName: arabicData.englishName,
      englishNameTranslation: arabicData.englishNameTranslation,
      revelationType: arabicData.revelationType,
      numberOfAyahs: arabicData.numberOfAyahs,
    };

    // Combine verse data
    const verses: VerseData[] = arabicData.ayahs.map((ayah, index) => {
      const translationAyah = translationData.ayahs.find(tAyah => tAyah.numberInSurah === ayah.numberInSurah);
      // Calculate absolute verse number (requires meta - fetchQuranMeta should be called before this ideally)
      // For simplicity here, we'll calculate it based on known structure if meta isn't passed
      // This calculation might be slightly off if meta isn't available/accurate globally
      let absoluteVerseNumber = ayah.number; // Use ayah.number which is absolute verse number

      return {
        surah: meta.number,
        numberInSurah: ayah.numberInSurah,
        absoluteVerseNumber: absoluteVerseNumber, // Absolute verse number
        arabicText: ayah.text,
        translation: translationAyah?.text ?? "Translation not available",
        audio: ayah.audio, // Audio URL often included in text editions
        juz: ayah.juz,
        page: ayah.page,
        hizbQuarter: ayah.hizbQuarter,
      };
    });

     const result = { meta, verses };

     if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(result));
        localStorage.setItem(`${cacheKey}_timestamp`, new Date().getTime().toString());
     }

    return result;

  } catch (error) {
    console.error(`Error fetching data for Surah ${surahNumber} (${translationIdentifier}):`, error);
      // Attempt to return stale cache if fetch fails (client-side only)
     if (typeof window !== 'undefined') {
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
            console.warn(`Returning stale cache for ${cacheKey} due to fetch error.`);
             try {
                 return JSON.parse(cachedItem);
             } catch (e) {
                  console.error(`Error parsing stale cached data for ${cacheKey}:`, e);
             }
        }
     }
    return null; // Return null if fetch fails and no cache is available
  }
}

// --- Helper Type: Surah Metadata (Derived from SurahDataResponse) ---
export type SurahMeta = Omit<SurahDataResponse, 'ayahs' | 'edition'>;

// --- Additional Functions (Example) ---

/**
 * Fetches data for a single verse including Arabic text, translation, and audio URL.
 * Note: This might be less efficient than fetching a full Surah if multiple verses are needed.
 *
 * @param surahNumber - The surah number (1-114).
 * @param verseNumberInSurah - The verse number within the surah.
 * @param translationIdentifier - Identifier for the translation (e.g., 'en.clearquran').
 * @param reciterIdentifier - Identifier for the reciter (e.g., 'ar.alafasy').
 * @returns A promise resolving to VerseData object or null.
 */
export async function getVerse(
    surahNumber: number,
    verseNumberInSurah: number,
    translationIdentifier: string = 'en.clearquran',
    reciterIdentifier: string = 'ar.alafasy'
): Promise<VerseData | null> {
    // Example: Fetching multiple editions for a single verse
    // Format: {surah}:{verse}/editions/{edition1},{edition2},...
    const verseReference = `${surahNumber}:${verseNumberInSurah}`;
    const editions = `quran-uthmani,${translationIdentifier},${reciterIdentifier}`;
    const url = `${API_BASE_URL}/ayah/${verseReference}/editions/${editions}`;
    const cacheKey = `verse_${verseReference}_${editions}`;

    try {
        const data = await fetchWithCache<any>(url, cacheKey); // Use 'any' for flexible structure

        if (!data || !Array.isArray(data) || data.length === 0) {
             throw new Error(`No data returned for verse ${verseReference} with editions ${editions}. Response: ${JSON.stringify(data)}`);
        }

        // Find the data for each requested edition
        const arabicEditionData = data.find((ed: any) => ed.edition.identifier === 'quran-uthmani');
        const translationEditionData = data.find((ed: any) => ed.edition.identifier === translationIdentifier);
        const audioEditionData = data.find((ed: any) => ed.edition.identifier === reciterIdentifier);

        if (!arabicEditionData || !translationEditionData) { // Audio might not always be returned directly this way
            console.error(`Required text editions not found in API response for verse ${verseReference}.`);
            console.log("Available identifiers:", data.map((ed: any) => ed.edition.identifier));
           throw new Error(`Required text editions not found for ${verseReference}.`);
        }

        // Construct audio URL using the standard CDN pattern as it's more reliable
        const absoluteVerseNumber = arabicEditionData.number; // API response for ayah includes absolute number
        const audioUrl = `https://cdn.alquran.cloud/media/audio/ayah/${reciterIdentifier}/${absoluteVerseNumber}`;

        const verseData: VerseData = {
            surah: surahNumber,
            numberInSurah: verseNumberInSurah,
            absoluteVerseNumber: absoluteVerseNumber,
            arabicText: arabicEditionData.text,
            translation: translationEditionData.text ?? "Translation not available",
            audio: audioUrl, // Use the constructed URL
            juz: arabicEditionData.juz,
            page: arabicEditionData.page,
            hizbQuarter: arabicEditionData.hizbQuarter,
        };

        return verseData;

    } catch (error) {
        console.error(`Error fetching verse ${verseReference}:`, error);
        return null;
    }
}
