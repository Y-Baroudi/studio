
/**
 * @fileoverview Contains mappings for Juz and Page starting verses in the Quran.
 * These mappings are based on standard Mushaf divisions.
 */

/**
 * Mapping of Juz number to its starting absolute verse number (1-6236).
 * Key: Juz number (1-30)
 * Value: Absolute verse number where the Juz starts.
 */
export const JUZ_STARTS: { [key: number]: number } = {
    1: 1,    // Al-Fatihah 1:1
    2: 142,  // Al-Baqarah 2:142
    3: 253,  // Al-Baqarah 2:253
    4: 93,   // Ali 'Imran 3:93
    5: 24,   // An-Nisa 4:24
    6: 148,  // An-Nisa 4:148
    7: 82,   // Al-Ma'idah 5:82
    8: 111,  // Al-An'am 6:111
    9: 88,   // Al-A'raf 7:88
    10: 41,  // Al-Anfal 8:41
    11: 93,  // At-Tawbah 9:93
    12: 6,   // Hud 11:6
    13: 53,  // Yusuf 12:53
    14: 1,   // Al-Hijr 15:1 (Starts with Ar-Ra'd 13:1, but Al-Hijr 15:1 is common start marker)
    15: 1,   // Al-Isra 17:1
    16: 75,  // Al-Kahf 18:75
    17: 1,   // Al-Anbya 21:1
    18: 1,   // Al-Mu'minun 23:1
    19: 21,  // Al-Furqan 25:21
    20: 56,  // An-Naml 27:56
    21: 46,  // Al-'Ankabut 29:46
    22: 31,  // Al-Ahzab 33:31
    23: 28,  // Ya-Sin 36:28
    24: 32,  // Az-Zumar 39:32
    25: 47,  // Fussilat 41:47
    26: 1,   // Al-Ahqaf 46:1
    27: 31,  // Adh-Dhariyat 51:31
    28: 1,   // Al-Mujadila 58:1
    29: 1,   // Al-Mulk 67:1
    30: 1,   // An-Naba 78:1
};

/**
 * Mapping of standard Mushaf Page number to its starting absolute verse number (1-6236).
 * Key: Page number (1-604)
 * Value: Absolute verse number where the Page starts.
 * Note: This is an approximate mapping based on common prints (like the Madinah Mushaf).
 * Verse start points can vary slightly between editions.
 */
export const PAGE_STARTS: { [key: number]: number } = {
    1: 1,     // Surah Al-Fatihah
    2: 1,     // Start of Al-Baqarah
    3: 6,
    4: 17,
    5: 25,
    6: 30,
    7: 38,
    8: 44,
    9: 50,
    10: 58,
    11: 62,
    12: 70,
    13: 77,
    14: 84,
    15: 92,
    16: 102,
    17: 106,
    18: 113,
    19: 121,
    20: 127,
    21: 135,
    22: 142,   // Juz 2 Start
    23: 146,
    24: 154,
    25: 164,
    26: 170,
    27: 177,
    28: 182,
    29: 187,
    30: 191,
    31: 197,
    32: 203,
    33: 211,
    34: 216,
    35: 220,
    36: 225,
    37: 231,
    38: 234,
    39: 238,
    40: 246,
    41: 249,
    42: 253,   // Juz 3 Start
    43: 257,
    44: 260,
    45: 265,
    46: 270,
    47: 275,
    48: 282,
    49: 283,
    50: 292,   // Start of Ali 'Imran
    51: 6,
    52: 14,
    53: 21,
    54: 30,
    55: 38,
    56: 46,
    57: 53,
    58: 62,
    59: 71,
    60: 77,
    61: 84,
    62: 92,    // Juz 4 Start
    63: 94,
    64: 104,
    65: 113,
    66: 121,
    67: 128,
    68: 135,
    69: 141,
    70: 149,
    71: 154,
    72: 158,
    73: 166,
    74: 174,
    75: 177,
    76: 181,
    77: 187,   // Start of An-Nisa
    78: 195,
    79: 201,
    80: 208,
    81: 215,
    82: 221,
    83: 24,    // Juz 5 Start
    84: 34,
    85: 43,
    86: 50,
    87: 60,
    88: 66,
    89: 75,
    90: 80,
    91: 87,
    92: 92,
    93: 95,
    94: 102,
    95: 106,
    96: 114,
    97: 122,
    98: 128,
    99: 135,
    100: 141,
    101: 148, // Juz 6 Start
    102: 155,
    103: 163,
    104: 172,
    105: 176,
    106: 1,     // Start of Al-Ma'idah
    107: 6,
    108: 12,
    109: 16,
    110: 24,
    111: 32,
    112: 37,
    113: 41,
    114: 46,
    115: 51,
    116: 58,
    117: 65,
    118: 71,
    119: 77,
    120: 82,    // Juz 7 Start
    121: 83,    // Start of Al-An'am
    122: 91,
    123: 96,
    124: 102,
    125: 111,   // Juz 8 Start
    126: 119,
    127: 125,
    128: 131,
    129: 138,
    130: 143,
    131: 150,
    132: 152,
    133: 158,
    134: 164,
    135: 1,     // Start of Al-A'raf
    136: 12,
    137: 23,
    138: 31,
    139: 38,
    140: 44,
    141: 52,
    142: 65,
    143: 74,
    144: 82,
    145: 88,    // Juz 9 Start
    146: 96,
    147: 105,
    148: 117,
    149: 121,
    150: 127,
    // ... Continue mapping for all 604 pages
    // This is a tedious process and might be better sourced from a reliable data file
    // Example continuation (needs verification):
    151: 1,     // Start of Al-Anfal
    177: 1,     // Start of At-Tawbah
    208: 1,     // Start of Yunus
    221: 1,     // Start of Hud
    235: 1,     // Start of Yusuf
    249: 1,     // Start of Ar-Ra'd
    255: 1,     // Start of Ibrahim
    262: 1,     // Start of Al-Hijr
    267: 1,     // Start of An-Nahl
    282: 1,     // Start of Al-Isra
    293: 1,     // Start of Al-Kahf
    305: 1,     // Start of Maryam
    312: 1,     // Start of Taha
    322: 1,     // Start of Al-Anbya
    332: 1,     // Start of Al-Hajj
    342: 1,     // Start of Al-Mu'minun
    350: 1,     // Start of An-Nur
    359: 1,     // Start of Al-Furqan
    367: 1,     // Start of Ash-Shu'ara
    377: 1,     // Start of An-Naml
    385: 1,     // Start of Al-Qasas
    396: 1,     // Start of Al-'Ankabut
    404: 1,     // Start of Ar-Rum
    411: 1,     // Start of Luqman
    415: 1,     // Start of As-Sajda
    418: 1,     // Start of Al-Ahzab
    428: 1,     // Start of Saba
    434: 1,     // Start of Fatir
    440: 1,     // Start of Ya-Sin
    446: 1,     // Start of As-Saffat
    453: 1,     // Start of Sad
    458: 1,     // Start of Az-Zumar
    467: 1,     // Start of Ghafir
    477: 1,     // Start of Fussilat
    483: 1,     // Start of Ash-Shura
    489: 1,     // Start of Az-Zukhruf
    496: 1,     // Start of Ad-Dukhan
    499: 1,     // Start of Al-Jathiya
    502: 1,     // Start of Al-Ahqaf
    507: 1,     // Start of Muhammad
    511: 1,     // Start of Al-Fath
    515: 1,     // Start of Al-Hujurat
    518: 1,     // Start of Qaf
    520: 1,     // Start of Adh-Dhariyat
    523: 1,     // Start of At-Tur
    526: 1,     // Start of An-Najm
    528: 1,     // Start of Al-Qamar
    531: 1,     // Start of Ar-Rahman
    534: 1,     // Start of Al-Waqi'ah
    537: 1,     // Start of Al-Hadid
    542: 1,     // Start of Al-Mujadila
    545: 1,     // Start of Al-Hashr
    549: 1,     // Start of Al-Mumtahina
    551: 1,     // Start of As-Saff
    553: 1,     // Start of Al-Jumu'ah
    554: 1,     // Start of Al-Munafiqun
    556: 1,     // Start of At-Taghabun
    558: 1,     // Start of At-Talaq
    560: 1,     // Start of At-Tahrim
    562: 1,     // Start of Al-Mulk
    564: 1,     // Start of Al-Qalam
    566: 1,     // Start of Al-Haqqah
    568: 1,     // Start of Al-Ma'arij
    570: 1,     // Start of Nuh
    572: 1,     // Start of Al-Jinn
    574: 1,     // Start of Al-Muzzammil
    575: 1,     // Start of Al-Muddaththir
    577: 1,     // Start of Al-Qiyamah
    578: 1,     // Start of Al-Insan
    580: 1,     // Start of Al-Mursalat
    582: 1,     // Start of An-Naba
    583: 1,     // Start of An-Nazi'at
    585: 1,     // Start of 'Abasa
    586: 1,     // Start of At-Takwir
    587: 1,     // Start of Al-Infitar
    587: 20,    // Mutaffifin starts mid-page
    589: 1,     // Start of Al-Inshiqaq
    590: 1,     // Start of Al-Buruj
    591: 1,     // Start of At-Tariq
    591: 12,    // Al-A'la starts mid-page
    592: 1,     // Start of Al-Ghashiyah
    593: 1,     // Start of Al-Fajr
    594: 1,     // Start of Al-Balad
    595: 1,     // Start of Ash-Shams
    595: 11,    // Al-Layl starts mid-page
    596: 1,     // Start of Ad-Duhaa
    596: 9,     // Ash-Sharh starts mid-page
    597: 1,     // Start of At-Tin
    597: 7,     // Al-'Alaq starts mid-page
    598: 1,     // Start of Al-Qadr
    598: 6,     // Al-Bayyinah starts mid-page
    599: 1,     // Start of Az-Zalzalah
    599: 9,     // Al-'Adiyat starts mid-page
    600: 1,     // Start of Al-Qari'ah
    600: 9,     // At-Takathur starts mid-page
    601: 1,     // Start of Al-'Asr
    601: 4,     // Al-Humazah starts mid-page
    601: 10,    // Al-Fil starts mid-page
    602: 1,     // Start of Quraysh
    602: 5,     // Al-Ma'un starts mid-page
    603: 1,     // Start of Al-Kawthar
    603: 4,     // Al-Kafirun starts mid-page
    603: 7,     // An-Nasr starts mid-page
    604: 1,     // Start of Al-Masad
    604: 5,     // Al-Ikhlas starts mid-page
    604: 7,     // Al-Falaq starts mid-page
    604: 10,    // An-Nas starts mid-page
    // Verify end verse number for last page if needed
};

// Helper function to find the Juz for a given absolute verse number
export function findJuz(absoluteVerseNumber: number): number | null {
    let currentJuz: number | null = null;
    for (const juz in JUZ_STARTS) {
        if (absoluteVerseNumber >= JUZ_STARTS[juz]) {
            currentJuz = parseInt(juz, 10);
        } else {
            break; // Since JUZ_STARTS is ordered
        }
    }
    return currentJuz;
}

// Helper function to find the Page for a given absolute verse number
export function findPage(absoluteVerseNumber: number): number | null {
    let currentPage: number | null = null;
    for (const page in PAGE_STARTS) {
        if (absoluteVerseNumber >= PAGE_STARTS[page]) {
            currentPage = parseInt(page, 10);
        } else {
            break; // Since PAGE_STARTS should be ordered (ensure data integrity)
        }
    }
    return currentPage;
}
