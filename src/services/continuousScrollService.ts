// src/services/continuousScrollService.ts
'use client';

/**
 * @fileoverview Service potentially responsible for managing data loading
 *               and state related to continuous scrolling of Quran verses.
 *               (Note: DOM manipulation and event listeners from original JS
 *               example are removed as they are handled by React components.)
 */

import { getSurahData, type QuranMeta, type Verse } from './alquran-cloud';

class ContinuousScrollService {
  // Cache for loaded surah data (verses)
  private surahCache: { [key: number]: Verse[] } = {};
  // Set to track which surah numbers have their data loaded
  private loadedSurahs: Set<number> = new Set();
  // Currently visible surah (might be updated by UI interaction)
  public currentVisibleSurah: number = 1;
  // Loading state for fetching data
  public isLoading: boolean = false;
  // Quran metadata needed for calculations
  private quranMeta: QuranMeta | null = null;

  constructor(meta: QuranMeta | null) {
    this.quranMeta = meta;
    console.log("ContinuousScrollService initialized.");
    // Note: setupScrollContainer, setupScrollListeners, and initialize
    // from the original JS are handled within React components (e.g., ReaderView)
  }

  public updateMeta(meta: QuranMeta | null) {
    this.quranMeta = meta;
  }

  /**
   * Checks if a specific surah's data is already loaded.
   * @param surahNumber The surah number to check.
   * @returns True if the surah data is loaded, false otherwise.
   */
  isSurahLoaded(surahNumber: number): boolean {
    return this.loadedSurahs.has(surahNumber);
  }

  /**
   * Gets the cached verses for a surah.
   * @param surahNumber The surah number.
   * @returns An array of Verse objects or undefined if not cached.
   */
  getSurahVerses(surahNumber: number): Verse[] | undefined {
    return this.surahCache[surahNumber];
  }

  /**
   * Loads data for a specific surah, caches it, and marks it as loaded.
   * Handles potential fallback for short surahs.
   * @param surahNumber The surah number to load.
   * @param translationIdentifier The selected translation ID.
   * @param reciterIdentifier The selected reciter ID.
   * @returns A promise resolving to the Verse array for the surah, or null on error.
   */
  async loadSurah(
    surahNumber: number,
    translationIdentifier: string | null,
    reciterIdentifier: string | null
  ): Promise<Verse[] | null> {
    if (this.isLoading || !this.quranMeta) {
        console.warn(`Skipping loadSurah(${surahNumber}): Already loading or no metadata.`);
        return this.surahCache[surahNumber] || null; // Return cached if available
    }
    if (this.isSurahLoaded(surahNumber)) {
        // console.log(`Surah ${surahNumber} already loaded, returning cached data.`);
        return this.surahCache[surahNumber];
    }

    this.isLoading = true;
    console.log(`Loading data for Surah ${surahNumber}...`);

    try {
      // Fetch surah data (using existing service)
      const verses = await getSurahData(
        surahNumber,
        translationIdentifier,
        reciterIdentifier,
        this.quranMeta
      );

      if (verses) {
        this.surahCache[surahNumber] = verses;
        this.loadedSurahs.add(surahNumber);
        console.log(`Successfully loaded and cached Surah ${surahNumber}.`);
        return verses;
      } else {
        // getSurahData handles fallback internally now
        console.error(`Failed to load Surah ${surahNumber} data (getSurahData returned null).`);
        return null;
      }
    } catch (error) {
      console.error(`Error loading Surah ${surahNumber}:`, error);
      return null; // Indicate error
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Placeholder for loading initial surahs. The actual implementation
   * will depend on how the UI decides which surahs to load initially.
   * @param initialSurahs Array of surah numbers to load.
   * @param translationIdentifier The selected translation ID.
   * @param reciterIdentifier The selected reciter ID.
   */
  async loadInitialSurahs(
    initialSurahs: number[] = [1, 2], // Default to loading Surah 1 & 2
    translationIdentifier: string | null,
    reciterIdentifier: string | null
  ): Promise<void> {
     if (!this.quranMeta) {
       console.error("Cannot load initial surahs without Quran metadata.");
       return;
     }
    console.log(`Loading initial surahs: ${initialSurahs.join(', ')}`);
    this.isLoading = true;
    try {
        const loadPromises = initialSurahs.map(num =>
            this.loadSurah(num, translationIdentifier, reciterIdentifier)
        );
        await Promise.all(loadPromises);
        console.log("Initial surahs loaded.");
    } catch (error) {
        console.error('Failed to load initial surahs:', error);
    } finally {
         this.isLoading = false;
    }
  }

  // --- Methods related to UI rendering and event listeners are removed ---
  // renderSurahs(), setupScrollListeners(), etc., belong in React components.
}

// Export the class. Instance management will happen in the consuming component (ReaderView).
export default ContinuousScrollService;
