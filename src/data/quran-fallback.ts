
/**
 * @fileoverview Fallback data for short Surahs (113, 114) in case API fails.
 */

export interface VerseData {
  number: number;
  text: string;
  translation: string;
}

export interface SurahFallbackData {
  [surahNumber: number]: {
    verses: VerseData[];
  };
}

export const QURAN_FALLBACK_DATA: SurahFallbackData = {
    113: {
      verses: [
        {number: 1, text: "قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ", translation: "Say, \"I seek refuge in the Lord of daybreak"},
        {number: 2, text: "مِن شَرِّ مَا خَلَقَ", translation: "From the evil of that which He created"},
        {number: 3, text: "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ", translation: "And from the evil of darkness when it settles"},
        {number: 4, text: "وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ", translation: "And from the evil of the blowers in knots"},
        {number: 5, text: "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ", translation: "And from the evil of an envier when he envies."}
      ]
    },
    114: {
      verses: [
        {number: 1, text: "قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ", translation: "Say, \"I seek refuge in the Lord of mankind,"},
        {number: 2, text: "مَلِكِ ٱلنَّاسِ", translation: "The Sovereign of mankind,"},
        {number: 3, text: "إِلَٰهِ ٱلنَّاسِ", translation: "The God of mankind,"},
        {number: 4, text: "مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ", translation: "From the evil of the retreating whisperer -"},
        {number: 5, text: "ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ", translation: "Who whispers [evil] into the breasts of mankind -"},
        {number: 6, text: "مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ", translation: "From among the jinn and mankind."}
      ]
    }
};
