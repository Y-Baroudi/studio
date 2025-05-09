// Continuous Quran reading implementation

// Global state (consider encapsulating later if needed)
let quranData = {
  surahs: {},          // Holds loaded surah data { number: { metadata + verses } }
  surahMetadata: [],   // Holds array of { number, name, englishName, ... }
  loadedSurahs: new Set(),
  currentSurah: 1,
  isLoading: false,
  apiBase: 'https://api.alquran.cloud/v1',
  selectedReciter: 'ar.alafasy', // Default reciter
  audioElement: null, // Reference to the audio element
  currentAudioVerse: null, // Tracks { surah, verse } for audio
};

// --- Initialization ---

/**
 * Initialize the continuous reading experience.
 */
async function initContinuousReading() {
  console.log("Initializing continuous Quran reading...");

  // Check if UI structure already exists to prevent duplication
  if (!document.getElementById('quran-container')) {
      createContinuousReadingUI();
  } else {
      console.log("Continuous reading UI already exists.");
  }

  // Load metadata first
  const metaLoaded = await loadQuranMetadata();

  if (metaLoaded) {
    // Load initial surahs (e.g., 1-2)
    await loadSurahRange(1, 2);
    // Setup scroll handling and other event listeners *after* initial load
    setupScrollHandling();
    setupAudioPlayerListeners();
    setupHeaderListeners(); // Add listeners for header buttons
  } else {
      // Handle metadata loading failure (e.g., show error message)
      const contentDiv = document.getElementById('quran-content');
      if (contentDiv) {
          contentDiv.innerHTML = `<div class="error-message">Failed to load Quran metadata. Please check your connection and refresh.</div>`;
      }
  }
}

/**
 * Create the main UI structure for the reader.
 */
function createContinuousReadingUI() {
  console.log("Creating continuous reading UI...");
  // Get the main app container
  const appContainer = document.getElementById('app-container') || document.body;

  // Clear existing content if needed (be cautious with this)
  // appContainer.innerHTML = ''; // Clearing everything might break other parts if not careful

  // Create elements if they don't exist
  if (!document.getElementById('continuous-reader-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'continuous-reader-wrapper';
      wrapper.innerHTML = `
        <div class="header">
          <div class="header-content">
            <div class="left-controls">
              <button id="menu-button" class="icon-button">
                <svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/></svg>
              </button>
            </div>
            <div class="title">Qur'an Meezan</div>
            <div class="right-controls">
              <button id="search-button" class="icon-button">
                <svg width="24" height="24" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>
              </button>
              <button id="settings-button" class="icon-button">
                 <svg width="24" height="24" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/></svg>
              </button>
            </div>
          </div>
          <div class="surah-selector">
            <select id="surah-jump" class="surah-jump-select">
              <option value="">Jump to Surah</option>
              <!-- Surah options will be populated here -->
            </select>
          </div>
        </div>

        <div id="quran-container" class="quran-container">
          <div id="quran-content" class="quran-content">
            <div class="loading-indicator">
              <div class="spinner"></div>
              <div>Loading Qur'an...</div>
            </div>
          </div>
        </div>

        <div id="audio-player-bar" class="audio-player">
          <div class="audio-info">No verse selected</div>
          <div class="audio-controls">
             <button id="prev-verse-button" class="player-button" disabled title="Previous Verse">
                <svg width="20" height="20" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" fill="currentColor"/></svg>
             </button>
             <button id="play-button" class="player-button" disabled title="Play">
                <svg class="play-icon" width="24" height="24" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
             </button>
             <button id="pause-button" class="player-button" disabled title="Pause" style="display: none;">
                 <svg class="pause-icon" width="24" height="24" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>
             </button>
             <button id="next-verse-button" class="player-button" disabled title="Next Verse">
                <svg width="20" height="20" viewBox="0 0 24 24"><path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg>
             </button>
             <select id="reciter-select" aria-label="Select Reciter">
                <option value="ar.alafasy">Alafasy</option>
                <option value="ar.minshawi_murattal">Minshawi</option> <!-- Example ID -->
                <option value="ar.husary_mujawwad">Husary</option> <!-- Example ID -->
             </select>
          </div>
        </div>

        <button id="scroll-top-button" class="scroll-top-button" title="Scroll to Top">
           <svg width="24" height="24" viewBox="0 0 24 24"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z" fill="currentColor"/></svg>
        </button>

        <audio id="verse-audio-player" style="display: none;"></audio> <!-- Hidden audio element -->
      `;
      appContainer.appendChild(wrapper);
  }

  // Add global CSS styles if they don't exist
  if (!document.getElementById('continuous-reader-styles')) {
      const style = document.createElement('style');
      style.id = 'continuous-reader-styles';
      style.textContent = `
        html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: var(--background-color, #121212); color: var(--text-color, #ffffff); }
        :root { --background-color: #121212; --text-color: #ffffff; --primary-color: #4CAF50; --secondary-color: #2a2a2a; --border-color: #444; --header-bg: #1a1a1a; --highlight-bg: rgba(76, 175, 80, 0.2); }
        body.light-theme { --background-color: #f0f0f0; --text-color: #121212; --primary-color: #1B5E20; --secondary-color: #ffffff; --border-color: #e0e0e0; --header-bg: #ffffff; --highlight-bg: rgba(27, 94, 32, 0.1); }
        .header { position: sticky; top: 0; background-color: var(--header-bg); box-shadow: 0 2px 4px rgba(0,0,0,0.5); z-index: 100; }
        .header-content { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; }
        .left-controls, .right-controls { display: flex; align-items: center; gap: 8px; }
        .title { font-size: 18px; font-weight: bold; text-align: center; flex-grow: 1; }
        .icon-button { background: none; border: none; color: var(--text-color); font-size: 24px; cursor: pointer; padding: 4px 8px; }
        .surah-selector { padding: 0 16px 12px; }
        #surah-jump { width: 100%; padding: 8px; background-color: var(--secondary-color); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px;}
        .quran-container { height: calc(100vh - 120px); /* Adjust dynamically? */ overflow-y: auto; scroll-behavior: smooth; }
        .quran-content { padding: 16px; }
        .surah-section { margin-bottom: 32px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; }
        .surah-header { background-color: var(--secondary-color); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; position: sticky; top: 60px; /* Adjust based on header height */ z-index: 50; }
        .surah-title { display: flex; align-items: center; gap: 12px; }
        .surah-number-badge { width: 32px; height: 32px; background-color: var(--primary-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 14px; }
        .surah-name-container h2 { margin: 0; font-size: 20px; }
        .surah-name-container h3 { margin: 2px 0 0; font-size: 16px; opacity: 0.8; font-family: ' Amiri', 'Uthmani', serif;}
        .surah-info { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #aaa; }
        .verses-container { padding-top: 8px; }
        .verse { margin-bottom: 16px; padding: 12px; border-radius: 4px; transition: background-color 0.2s; cursor: pointer; border: 1px solid transparent; }
        .verse:hover { background-color: rgba(255, 255, 255, 0.05); }
        .verse.active { background-color: var(--highlight-bg); border-color: var(--primary-color); }
        .verse-number { color: #aaa; font-size: 12px; margin-bottom: 6px; }
        .arabic-text { font-family: 'Amiri', 'Uthmani', serif; font-size: 26px; line-height: 1.8; text-align: right; direction: rtl; margin-bottom: 8px; }
        .translation { font-size: 16px; line-height: 1.6; text-align: left; direction: ltr; opacity: 0.9; }
        .bismillah { font-family: 'Amiri', 'Uthmani', serif; font-size: 28px; text-align: center; margin: 24px 0; }
        .audio-player { position: fixed; bottom: 0; left: 0; right: 0; background-color: var(--header-bg); padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 -2px 4px rgba(0,0,0,0.5); z-index: 100; }
        .audio-info { font-size: 12px; color: #aaa; flex-shrink: 0; min-width: 100px; text-align: left; }
        .audio-controls { display: flex; align-items: center; gap: 8px; flex-grow: 1; justify-content: center; }
        .player-button { background: none; border: none; color: var(--text-color); font-size: 20px; cursor: pointer; padding: 6px; }
        .player-button:disabled { opacity: 0.5; cursor: not-allowed; }
        #reciter-select { padding: 4px 8px; background-color: var(--secondary-color); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 4px; font-size: 12px; }
        .loading-indicator { display: flex; flex-direction: column; align-items: center; padding: 40px; color: #aaa; }
        .spinner { width: 30px; height: 30px; border: 3px solid rgba(76, 175, 80, 0.3); border-top: 3px solid var(--primary-color); border-radius: 50%; margin-bottom: 12px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .scroll-top-button { position: fixed; bottom: 80px; right: 20px; width: 48px; height: 48px; border-radius: 50%; background-color: var(--primary-color); color: white; border: none; font-size: 20px; cursor: pointer; display: none; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.5); z-index: 100; }
        .verse-indicators { display: flex; gap: 6px; margin-top: 8px; justify-content: flex-end; /* Align to right */ }
        .note-indicator, .concept-indicator { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; cursor: pointer; }
        .note-indicator { background-color: var(--primary-color); }
        .concept-indicator { background-color: #2196F3; } /* Example color */
      `;
      document.head.appendChild(style);
  }
}

// --- Data Loading ---

/**
 * Load Quran metadata (list of surahs).
 */
async function loadQuranMetadata() {
  console.log("Loading Quran metadata...");
  try {
    const response = await fetch(`${quranData.apiBase}/meta`); // Use meta endpoint
    const data = await response.json();

    if (data.code !== 200 || !data.data || !data.data.surahs || !data.data.surahs.references) {
      throw new Error(`Failed to load Quran metadata. Code: ${data.code}, Status: ${data.status}`);
    }

    quranData.surahMetadata = data.data.surahs.references; // Store the array of surah objects
    console.log("Quran metadata loaded:", quranData.surahMetadata.length, "surahs");

    populateSurahSelector(quranData.surahMetadata);
    return true;
  } catch (error) {
    console.error('Error loading Quran metadata:', error);
    // Attempt to use hardcoded fallback only if necessary
    if (!quranData.surahMetadata || quranData.surahMetadata.length === 0) {
        quranData.surahMetadata = [ // Minimal fallback
            { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', englishNameTranslation: 'The Opening', revelationType: 'Meccan', numberOfAyahs: 7 },
             // Add more essential surahs if needed for basic functionality
        ];
        populateSurahSelector(quranData.surahMetadata); // Populate with fallback
        console.warn("Using fallback metadata.");
    }
    return false; // Indicate that loading failed
  }
}

/**
 * Populate the surah jump dropdown.
 */
function populateSurahSelector(surahs) {
  const selector = document.getElementById('surah-jump');
  if (!selector || !Array.isArray(surahs)) {
      console.error("Surah selector not found or invalid surah data.");
      return;
  }

  selector.innerHTML = '<option value="">Jump to Surah</option>'; // Reset options

  surahs.forEach(surah => {
    const option = document.createElement('option');
    option.value = surah.number;
    option.textContent = `${surah.number}. ${surah.englishName} (${surah.name})`; // Include Arabic name
    selector.appendChild(option);
  });

  selector.addEventListener('change', (e) => {
    const surahNumber = parseInt(e.target.value, 10);
    if (surahNumber > 0) {
      scrollToSurah(surahNumber);
    }
  });
}


/**
 * Load data for a range of surahs.
 */
async function loadSurahRange(startSurah, endSurah) {
    if (quranData.isLoading) {
        console.log("Already loading surahs, request ignored.");
        return;
    }
    quranData.isLoading = true;
    console.log(`Attempting to load surah range: ${startSurah}-${endSurah}`);

    const loadPromises = [];
    for (let i = startSurah; i <= endSurah; i++) {
        if (i >= 1 && i <= 114 && !quranData.loadedSurahs.has(i)) {
            loadPromises.push(loadSurah(i));
        }
    }

    if (loadPromises.length === 0) {
        console.log("All requested surahs in range are already loaded.");
        quranData.isLoading = false;
        return true; // Indicate success as nothing needed loading
    }

    try {
        await Promise.all(loadPromises);
        console.log(`Successfully processed load requests for surahs ${startSurah}-${endSurah}.`);
        renderLoadedSurahs(); // Render the newly loaded surahs
        return true;
    } catch (error) {
        console.error(`Error loading surah range ${startSurah}-${endSurah}:`, error);
        return false; // Indicate failure
    } finally {
        quranData.isLoading = false;
    }
}

/**
 * Load data for a single surah.
 */
async function loadSurah(surahNumber) {
    if (quranData.loadedSurahs.has(surahNumber)) {
        console.log(`Surah ${surahNumber} already loaded.`);
        return quranData.surahs[surahNumber]; // Return cached data
    }
    console.log(`Loading Surah ${surahNumber}...`);

    // Validate against metadata
    const surahMeta = quranData.surahMetadata?.find(s => s.number === surahNumber);
    if (!surahMeta) {
        console.error(`Metadata not found for Surah ${surahNumber}. Cannot load.`);
        // Attempt to load metadata again if it's missing
        if (!quranData.surahMetadata || quranData.surahMetadata.length === 0) {
           await loadQuranMetadata();
           const newMeta = quranData.surahMetadata?.find(s => s.number === surahNumber);
           if (!newMeta) throw new Error(`Metadata still unavailable for Surah ${surahNumber} after retry.`);
           // Proceed with new meta if found
        } else {
             throw new Error(`Metadata not found for Surah ${surahNumber}.`);
        }
    }

    try {
        // Fetch Arabic text and selected translation concurrently
        const [arabicRes, translationRes] = await Promise.all([
            fetch(`${quranData.apiBase}/surah/${surahNumber}/quran-uthmani`), // Explicit Arabic edition
            fetch(`${quranData.apiBase}/surah/${surahNumber}/en.clearquran`) // Specific translation
        ]);

        if (!arabicRes.ok) throw new Error(`Failed to fetch Arabic text for Surah ${surahNumber}. Status: ${arabicRes.status}`);
        if (!translationRes.ok) throw new Error(`Failed to fetch translation for Surah ${surahNumber}. Status: ${translationRes.status}`);

        const [arabicData, translationData] = await Promise.all([
            arabicRes.json(),
            translationRes.json()
        ]);

        if (arabicData.code !== 200 || !arabicData.data || !Array.isArray(arabicData.data.ayahs)) {
            throw new Error(`Invalid Arabic data format for Surah ${surahNumber}. Code: ${arabicData.code}`);
        }
        if (translationData.code !== 200 || !translationData.data || !Array.isArray(translationData.data.ayahs)) {
            throw new Error(`Invalid translation data format for Surah ${surahNumber}. Code: ${translationData.code}`);
        }
        if (arabicData.data.ayahs.length !== translationData.data.ayahs.length) {
             console.warn(`Verse count mismatch between Arabic (${arabicData.data.ayahs.length}) and translation (${translationData.data.ayahs.length}) for Surah ${surahNumber}.`);
             // Decide how to handle mismatch, e.g., use the shorter length or log specific verses
        }

        // Combine data, ensuring alignment even with potential mismatches
        const combinedVerses = arabicData.data.ayahs.map((arabicAyah, index) => {
            const translationAyah = translationData.data.ayahs[index];
            return {
                number: arabicAyah.numberInSurah, // Correct key for ayah number
                text: arabicAyah.text,
                translation: translationAyah ? translationAyah.text : "Translation unavailable", // Fallback
                audio: arabicAyah.audio // Get audio URL from Arabic edition response
            };
        });

         // Re-fetch metadata for this specific surah from the response to ensure accuracy
         const responseMeta = arabicData.data;

        const surah = {
            number: responseMeta.number,
            name: responseMeta.name,
            englishName: responseMeta.englishName,
            englishNameTranslation: responseMeta.englishNameTranslation,
            revelationType: responseMeta.revelationType,
            numberOfAyahs: responseMeta.numberOfAyahs,
            verses: combinedVerses,
        };

        quranData.surahs[surahNumber] = surah;
        quranData.loadedSurahs.add(surahNumber);
        console.log(`Successfully loaded Surah ${surahNumber}`);
        return surah;

    } catch (error) {
        console.error(`Error loading Surah ${surahNumber}:`, error);
        // Use fallback for specific surahs if fetch fails
        if (surahNumber === 113 || surahNumber === 114) {
            console.warn(`Using fallback data for Surah ${surahNumber}.`);
            const fallbackData = getFallbackSurahData(surahNumber);
            if (fallbackData) {
                 quranData.surahs[surahNumber] = fallbackData;
                 quranData.loadedSurahs.add(surahNumber);
                 return fallbackData;
            }
        }
        throw error; // Re-throw if not a handled fallback case
    }
}

/**
 * Get fallback data for specific short surahs.
 */
function getFallbackSurahData(surahNumber) {
  const fallbackData = {
    113: { number: 113, name: "الفلق", englishName: "Al-Falaq", englishNameTranslation: "The Daybreak", revelationType: "Meccan", numberOfAyahs: 5, verses: [ {number: 1, text: "قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ", translation: "Say, \"I seek refuge in the Lord of daybreak"}, {number: 2, text: "مِن شَرِّ مَا خَلَقَ", translation: "From the evil of that which He created"}, {number: 3, text: "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ", translation: "And from the evil of darkness when it settles"}, {number: 4, text: "وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ", translation: "And from the evil of the blowers in knots"}, {number: 5, text: "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ", translation: "And from the evil of an envier when he envies."} ] },
    114: { number: 114, name: "الناس", englishName: "An-Nas", englishNameTranslation: "Mankind", revelationType: "Meccan", numberOfAyahs: 6, verses: [ {number: 1, text: "قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ", translation: "Say, \"I seek refuge in the Lord of mankind,"}, {number: 2, text: "مَلِكِ ٱلنَّاسِ", translation: "The Sovereign of mankind,"}, {number: 3, text: "إِلَٰهِ ٱلنَّاسِ", translation: "The God of mankind,"}, {number: 4, text: "مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ", translation: "From the evil of the retreating whisperer -"}, {number: 5, text: "ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ", translation: "Who whispers [evil] into the breasts of mankind -"}, {number: 6, text: "مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ", translation: "From among the jinn and mankind."} ] }
  };
  return fallbackData[surahNumber] || null;
}

// --- UI Rendering ---

/**
 * Render all currently loaded surahs into the container.
 */
function renderLoadedSurahs() {
    console.log("Rendering loaded surahs...");
    const container = document.getElementById('quran-content');
    if (!container) {
        console.error("Quran content container not found!");
        return;
    }

    // Clear loading indicator if it's the first render
    const loadingIndicator = container.querySelector('.loading-indicator');
    if (loadingIndicator) {
        container.innerHTML = ''; // Clear loading message
    }

    const sortedSurahNumbers = Array.from(quranData.loadedSurahs).sort((a, b) => a - b);

    // Use a DocumentFragment for performance
    const fragment = document.createDocumentFragment();

    sortedSurahNumbers.forEach(surahNumber => {
        // Check if the surah is already rendered
        if (!container.querySelector(`.surah-section[data-surah="${surahNumber}"]`)) {
            const surahElement = renderSurah(surahNumber);
            if (surahElement) {
                fragment.appendChild(surahElement);
            }
        }
    });

    // Append the fragment to the container
    container.appendChild(fragment);

    // Update verse indicators after rendering
    updateVerseIndicators();
}

/**
 * Render a single surah and return the DOM element.
 */
function renderSurah(surahNumber) {
    const surah = quranData.surahs[surahNumber];
    if (!surah) {
        console.warn(`Data for Surah ${surahNumber} not found for rendering.`);
        return null;
    }

    const surahSection = document.createElement('div');
    surahSection.className = 'surah-section';
    surahSection.dataset.surah = surahNumber;
    surahSection.id = `surah-${surahNumber}`; // Add ID for scrolling

    // Surah Header
    const surahHeader = document.createElement('div');
    surahHeader.className = 'surah-header';
    surahHeader.innerHTML = `
        <div class="surah-title">
        <div class="surah-number-badge">${surahNumber}</div>
        <div class="surah-name-container">
            <h2>${surah.englishName}</h2>
            <h3 dir="rtl">${surah.name}</h3>
        </div>
        </div>
        <div class="surah-info">
        <span>${surah.englishNameTranslation}</span>
        <span>${surah.revelationType} • ${surah.numberOfAyahs} Ayahs</span>
        </div>
    `;
    surahSection.appendChild(surahHeader);

    // Verses Container
    const versesContainer = document.createElement('div');
    versesContainer.className = 'verses-container';

    // Bismillah (except for Surah 1 and 9)
    if (surahNumber !== 1 && surahNumber !== 9) {
        const bismillah = document.createElement('div');
        bismillah.className = 'bismillah';
        bismillah.textContent = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
        versesContainer.appendChild(bismillah);
    }

    // Verses
    if (Array.isArray(surah.verses)) {
        surah.verses.forEach(verse => {
            const verseElement = document.createElement('div');
            verseElement.className = 'verse';
            verseElement.dataset.surah = surahNumber;
            verseElement.dataset.verse = verse.number;
            verseElement.dataset.audio = verse.audio; // Store audio URL

            verseElement.innerHTML = `
                <div class="verse-number">${surahNumber}:${verse.number}</div>
                <div class="arabic-text">${verse.text || 'Text unavailable'}</div>
                <div class="translation">${verse.translation || 'Translation unavailable'}</div>
                <div class="verse-indicators"></div>
            `;

            verseElement.addEventListener('click', () => {
                selectVerse(surahNumber, verse.number, verseElement);
            });
            versesContainer.appendChild(verseElement);
        });
    } else {
         versesContainer.innerHTML = '<p>Error: Verses data is not available or invalid.</p>';
    }


    surahSection.appendChild(versesContainer);
    return surahSection;
}

// --- Scroll and Navigation ---

/**
 * Setup scroll event listeners for the Quran container.
 */
function setupScrollHandling() {
  const scrollContainer = document.getElementById('quran-container');
  if (!scrollContainer) return;

  let scrollTimeout;
  scrollContainer.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
          handleScroll();
      }, 150); // Debounce scroll events
  }, { passive: true }); // Improve scroll performance
}


/**
 * Handle scroll events to load more surahs and update UI.
 */
function handleScroll() {
    const scrollContainer = document.getElementById('quran-container');
    if (!scrollContainer || quranData.isLoading) return;

    // Check if near bottom
    const scrollBottom = scrollContainer.scrollTop + scrollContainer.clientHeight;
    const scrollThreshold = scrollContainer.scrollHeight * 0.85; // Load when 85% scrolled

    if (scrollBottom >= scrollThreshold) {
        const maxLoadedSurah = quranData.loadedSurahs.size > 0 ? Math.max(...quranData.loadedSurahs) : 0;
        if (maxLoadedSurah < 114) {
            console.log("Near bottom, loading next surahs...");
            loadSurahRange(maxLoadedSurah + 1, Math.min(maxLoadedSurah + 2, 114)); // Load next 2
        }
    }

    // Update current visible surah in state and UI
    updateCurrentVisibleSurah();

    // Show/hide scroll-to-top button
    const scrollTopButton = document.getElementById('scroll-top-button');
    if (scrollTopButton) {
        scrollTopButton.style.display = scrollContainer.scrollTop > 400 ? 'flex' : 'none';
    }
}

/**
 * Update the quranData.currentSurah based on visibility.
 */
function updateCurrentVisibleSurah() {
    const scrollContainer = document.getElementById('quran-container');
    if (!scrollContainer) return;

    const containerTop = scrollContainer.getBoundingClientRect().top;
    let bestVisibleSurah = quranData.currentSurah; // Start with current
    let minTop = Infinity;

    // Iterate through rendered surah sections
    const surahSections = scrollContainer.querySelectorAll('.surah-section');
    surahSections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const surahNum = parseInt(section.dataset.surah, 10);

        // Check if the top of the surah section is within the viewport or just above
        if (rect.top >= containerTop && rect.top < minTop) {
            minTop = rect.top;
            bestVisibleSurah = surahNum;
        } else if (rect.bottom > containerTop && rect.top < containerTop && surahNum > bestVisibleSurah) {
             // If the top is above the viewport but bottom is below, consider it if it's a higher number than current best
             bestVisibleSurah = surahNum;
        }
    });


    if (bestVisibleSurah !== quranData.currentSurah) {
        console.log(`Current visible surah updated to: ${bestVisibleSurah}`);
        quranData.currentSurah = bestVisibleSurah;

        // Update UI elements like the surah jump dropdown and document title
        const selector = document.getElementById('surah-jump');
        if (selector && selector.value !== String(bestVisibleSurah)) {
            selector.value = bestVisibleSurah;
        }
        const surahMeta = quranData.surahMetadata?.find(s => s.number === bestVisibleSurah);
        if (surahMeta) {
            document.title = `${surahMeta.englishName} (${bestVisibleSurah}) - Qur'an Meezan`;
        }
    }
}

/**
 * Scroll the container to the specified surah.
 */
async function scrollToSurah(surahNumber) {
    console.log(`Scrolling to Surah ${surahNumber}...`);
    // Ensure the target surah and potentially adjacent ones are loaded
    if (!quranData.loadedSurahs.has(surahNumber)) {
        console.log(`Surah ${surahNumber} not loaded. Loading range...`);
        const startLoad = Math.max(1, surahNumber - 1);
        const endLoad = Math.min(114, surahNumber + 1);
        await loadSurahRange(startLoad, endLoad); // Wait for loading
    }

    const surahElement = document.getElementById(`surah-${surahNumber}`);
    const scrollContainer = document.getElementById('quran-container');

    if (surahElement && scrollContainer) {
        const headerHeight = document.querySelector('.header')?.clientHeight || 60; // Estimate header height
        const targetScrollTop = surahElement.offsetTop - headerHeight - 10; // Adjust for header and padding

        console.log(`Target element found. Scrolling to offsetTop: ${targetScrollTop}`);
        scrollContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
         // Force update of current visible surah after scroll animation
         setTimeout(() => updateCurrentVisibleSurah(), 800); // Adjust delay as needed
    } else {
        console.error(`Could not find element for Surah ${surahNumber} to scroll to.`);
    }
}


// --- Audio Playback ---

/**
 * Setup event listeners for the global audio player.
 */
function setupAudioPlayerListeners() {
    quranData.audioElement = document.getElementById('verse-audio-player');
    const playButton = document.getElementById('play-button');
    const pauseButton = document.getElementById('pause-button');
    const prevButton = document.getElementById('prev-verse-button');
    const nextButton = document.getElementById('next-verse-button');
    const reciterSelect = document.getElementById('reciter-select');

    if (!quranData.audioElement || !playButton || !pauseButton || !reciterSelect || !prevButton || !nextButton) {
        console.error("Audio player elements not found.");
        return;
    }

    playButton.addEventListener('click', () => {
        if (quranData.currentAudioVerse) {
            playVerseAudio(quranData.currentAudioVerse.surah, quranData.currentAudioVerse.verse);
        }
    });

    pauseButton.addEventListener('click', () => {
        quranData.audioElement.pause();
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
        playButton.disabled = false;
        pauseButton.disabled = true;
        document.querySelector(`.verse.active`)?.classList.remove('playing'); // Remove playing style
    });

    prevButton.addEventListener('click', () => playAdjacentVerse(-1));
    nextButton.addEventListener('click', () => playAdjacentVerse(1));

    reciterSelect.addEventListener('change', (e) => {
        quranData.selectedReciter = e.target.value;
        console.log("Reciter changed to:", quranData.selectedReciter);
        // If audio is playing, restart with new reciter
        if (quranData.currentAudioVerse && !quranData.audioElement.paused) {
            playVerseAudio(quranData.currentAudioVerse.surah, quranData.currentAudioVerse.verse);
        }
    });

    quranData.audioElement.addEventListener('ended', () => {
        console.log("Audio ended for", quranData.currentAudioVerse);
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
        playButton.disabled = false;
        pauseButton.disabled = true;
        document.querySelector(`.verse.active.playing`)?.classList.remove('playing');
        // Optionally play next verse automatically
        // playAdjacentVerse(1);
    });

    quranData.audioElement.addEventListener('error', (e) => {
        console.error("Audio playback error:", e);
        alert(`Error playing audio. Check network or try a different reciter. Details: ${e.message || 'Unknown error'}`);
        playButton.style.display = 'inline-block';
        pauseButton.style.display = 'none';
        playButton.disabled = false; // Re-enable play button on error
        pauseButton.disabled = true;
         document.querySelector(`.verse.active.playing`)?.classList.remove('playing');
    });

     quranData.audioElement.addEventListener('play', () => {
         playButton.style.display = 'none';
         pauseButton.style.display = 'inline-block';
         playButton.disabled = true;
         pauseButton.disabled = false;
         document.querySelector(`.verse.active`)?.classList.add('playing');
     });

     quranData.audioElement.addEventListener('pause', () => {
         // This is handled by the pause button click and ended event
         // We might not need specific handling here unless differentiating pause types
          document.querySelector(`.verse.active.playing`)?.classList.remove('playing');
     });
}


/**
 * Select a verse, update UI, and prepare for playback.
 */
function selectVerse(surahNumber, verseNumber, verseElement) {
    console.log(`Selecting verse: ${surahNumber}:${verseNumber}`);
    // Clear previous selection highlight
    document.querySelectorAll('.verse.active').forEach(el => el.classList.remove('active', 'playing'));

    // Add active class to the clicked verse
    verseElement.classList.add('active');

    // Update audio player info and enable controls
    const audioInfo = document.querySelector('.audio-info');
    const playButton = document.getElementById('play-button');
    const pauseButton = document.getElementById('pause-button');
    const prevButton = document.getElementById('prev-verse-button');
    const nextButton = document.getElementById('next-verse-button');


    if (audioInfo) {
        audioInfo.textContent = `S${surahNumber}:V${verseNumber}`;
    }

    quranData.currentAudioVerse = { surah: surahNumber, verse: verseNumber };

    if (playButton) playButton.disabled = false;
    if (pauseButton) pauseButton.disabled = true; // Pause initially disabled
     if (prevButton) prevButton.disabled = (surahNumber === 1 && verseNumber === 1);
     if (nextButton) nextButton.disabled = (surahNumber === 114 && verseNumber === 6); // Adjust based on actual last verse

    // Optional: Auto-play on select (consider user preference)
    // playVerseAudio(surahNumber, verseNumber);
}

/**
 * Construct the audio URL for a given verse and reciter.
 */
function getAudioUrl(surahNumber, verseNumber) {
    // API returns absolute verse number in audio URL field
    const surahData = quranData.surahs[surahNumber];
    const verseData = surahData?.verses?.find(v => v.number === verseNumber);
    let audioUrl = verseData?.audio; // Get URL from fetched data

    // Fallback construction if URL is missing in fetched data
    if (!audioUrl) {
        console.warn(`Audio URL missing for ${surahNumber}:${verseNumber}. Constructing fallback URL.`);
         // Need absolute verse number for the CDN link format
         const absoluteVerse = calculateAbsoluteVerseNumber(surahNumber, verseNumber);
         if (absoluteVerse) {
            // Use the selected reciter ID correctly
            audioUrl = `https://cdn.alquran.cloud/media/audio/ayah/${quranData.selectedReciter}/${absoluteVerse}`;
         } else {
             console.error(`Could not calculate absolute verse number for ${surahNumber}:${verseNumber}.`);
             return null;
         }
    }

    // Replace reciter if it changed and URL format allows
    if (audioUrl && quranData.selectedReciter && audioUrl.includes('cdn.alquran.cloud')) {
       // Example: https://cdn.alquran.cloud/media/audio/ayah/ar.alafasy/1
       const parts = audioUrl.split('/');
       // Find the reciter part (usually the second to last element before the number)
       if (parts.length >= 3 && parts[parts.length - 2].startsWith('ar.')) {
           parts[parts.length - 2] = quranData.selectedReciter;
           audioUrl = parts.join('/');
       } else {
            console.warn("Could not reliably replace reciter in existing audio URL format:", audioUrl);
            // Fallback to constructing URL from scratch if replacing is unsafe
             const absoluteVerse = calculateAbsoluteVerseNumber(surahNumber, verseNumber);
             if (absoluteVerse) {
                audioUrl = `https://cdn.alquran.cloud/media/audio/ayah/${quranData.selectedReciter}/${absoluteVerse}`;
             } else {
                 audioUrl = null;
             }
       }
    }

    console.log(`Audio URL for ${surahNumber}:${verseNumber} (${quranData.selectedReciter}): ${audioUrl}`);
    return audioUrl;
}

/**
 * Calculate the absolute verse number (1-6236). Requires metadata.
 */
function calculateAbsoluteVerseNumber(surahNumber, verseNumberInSurah) {
    if (!quranData.surahMetadata || quranData.surahMetadata.length === 0) {
        console.error("Cannot calculate absolute verse number: Metadata not loaded.");
        return null;
    }
    let absoluteVerse = 0;
    for (let i = 0; i < surahNumber - 1; i++) {
        if (!quranData.surahMetadata[i]) {
             console.error(`Missing metadata for surah ${i + 1}`);
             return null;
        }
        absoluteVerse += quranData.surahMetadata[i].numberOfAyahs;
    }
    absoluteVerse += verseNumberInSurah;
    return absoluteVerse;
}


/**
 * Play audio for the specified verse.
 */
function playVerseAudio(surahNumber, verseNumber) {
    if (!quranData.audioElement) {
        console.error("Audio element not initialized.");
        return;
    }
    const audioUrl = getAudioUrl(surahNumber, verseNumber);
    if (!audioUrl) {
        alert(`Audio is not available for verse ${surahNumber}:${verseNumber} with the selected reciter.`);
        return;
    }

    quranData.audioElement.src = audioUrl;
    quranData.audioElement.load(); // Important to load the new source
    quranData.audioElement.play().catch(error => {
        console.error('Error initiating audio playback:', error);
        // Update UI to reflect failure
        const playButton = document.getElementById('play-button');
        const pauseButton = document.getElementById('pause-button');
        if (playButton) playButton.disabled = false;
        if (pauseButton) pauseButton.disabled = true;
        if (pauseButton) pauseButton.style.display = 'none';
        if (playButton) playButton.style.display = 'inline-block';
         document.querySelector(`.verse.active.playing`)?.classList.remove('playing');
        alert(`Could not play audio for ${surahNumber}:${verseNumber}. Error: ${error.message}`);
    });

    // Highlight the playing verse
     document.querySelectorAll('.verse.playing').forEach(el => el.classList.remove('playing'));
     document.querySelector(`.verse[data-surah="${surahNumber}"][data-verse="${verseNumber}"]`)?.classList.add('playing');
}

/**
 * Play the next or previous verse relative to the current one.
 */
function playAdjacentVerse(direction) { // direction is +1 for next, -1 for previous
    if (!quranData.currentAudioVerse) return;

    let { surah, verse } = quranData.currentAudioVerse;
    const currentSurahMeta = quranData.surahMetadata?.find(s => s.number === surah);

    if (!currentSurahMeta) {
        console.error(`Metadata not found for current surah ${surah}. Cannot navigate.`);
        return;
    }

    if (direction === 1) { // Next verse
        if (verse < currentSurahMeta.numberOfAyahs) {
            verse++;
        } else if (surah < 114) {
            surah++;
            verse = 1; // Start of next surah
        } else {
            console.log("Already at the last verse of the Quran.");
            return; // End of Quran
        }
    } else if (direction === -1) { // Previous verse
        if (verse > 1) {
            verse--;
        } else if (surah > 1) {
            surah--;
            const prevSurahMeta = quranData.surahMetadata.find(s => s.number === surah);
            if (!prevSurahMeta) return; // Should not happen if metadata is complete
            verse = prevSurahMeta.numberOfAyahs; // Last verse of previous surah
        } else {
            console.log("Already at the first verse of the Quran.");
            return; // Beginning of Quran
        }
    }

    // Check if the target surah is loaded, load if necessary
    if (!quranData.loadedSurahs.has(surah)) {
         console.log(`Target surah ${surah} not loaded. Loading...`);
         loadSurah(surah).then(loadedSurah => {
             if (loadedSurah) {
                 // Ensure the element exists before selecting
                 const targetVerseElement = document.querySelector(`.verse[data-surah="${surah}"][data-verse="${verse}"]`);
                 if (targetVerseElement) {
                     selectVerse(surah, verse, targetVerseElement);
                     playVerseAudio(surah, verse);
                 } else {
                     console.error(`Verse element ${surah}:${verse} not found after loading surah.`);
                     // Optional: scroll to surah start?
                     scrollToSurah(surah);
                 }
             } else {
                 console.error(`Failed to load target surah ${surah} for navigation.`);
             }
         });
    } else {
         // Surah is loaded, find the element and play
         const targetVerseElement = document.querySelector(`.verse[data-surah="${surah}"][data-verse="${verse}"]`);
         if (targetVerseElement) {
            selectVerse(surah, verse, targetVerseElement);
            playVerseAudio(surah, verse);
         } else {
             console.error(`Verse element ${surah}:${verse} not found in already loaded surah.`);
             // This might indicate a rendering issue or incomplete data
             scrollToSurah(surah); // Scroll to surah as fallback
         }
    }
}


// --- Other UI and Utilities ---

/**
 * Setup listeners for header buttons (Menu, Search, Settings).
 */
function setupHeaderListeners() {
    const menuButton = document.getElementById('menu-button');
    const searchButton = document.getElementById('search-button');
    const settingsButton = document.getElementById('settings-button');

    if (menuButton) menuButton.addEventListener('click', () => alert("Menu: Not Implemented Yet"));
    if (searchButton) searchButton.addEventListener('click', () => alert("Search: Not Implemented Yet"));
    if (settingsButton) settingsButton.addEventListener('click', () => alert("Settings: Not Implemented Yet"));
}

/**
 * Update indicators on verses (e.g., for notes or concepts).
 */
function updateVerseIndicators() {
    // This function would iterate through rendered verses and check localStorage
    // for notes or concept tags associated with each verse, then add/remove indicators.
    // Example logic (needs integration with actual note/concept services):
    document.querySelectorAll('.verse').forEach(verseElement => {
        const surah = parseInt(verseElement.dataset.surah, 10);
        const verse = parseInt(verseElement.dataset.verse, 10);
        const indicatorsContainer = verseElement.querySelector('.verse-indicators');
        if (!indicatorsContainer) return;

        indicatorsContainer.innerHTML = ''; // Clear old indicators

        // Example check (replace with actual logic from note/concept services)
        const noteExists = localStorage.getItem(`note_${surah}_${verse}`);
        const conceptsExist = localStorage.getItem(`concepts_${surah}_${verse}`);

        if (noteExists) {
            const indicator = document.createElement('div');
            indicator.className = 'note-indicator';
            indicator.textContent = '📝';
            indicator.title = 'Has Note';
            indicatorsContainer.appendChild(indicator);
        }
        if (conceptsExist) {
            const indicator = document.createElement('div');
            indicator.className = 'concept-indicator';
            indicator.textContent = '💡';
            indicator.title = 'Has Concepts Tagged';
            indicatorsContainer.appendChild(indicator);
        }
    });
}


// --- Entry Point ---
document.addEventListener('DOMContentLoaded', initContinuousReading);
