// src/services/notes.ts
'use client'; // Indicate client-side logic due to localStorage usage

/**
 * @fileoverview Service functions for managing Quran notes using localStorage.
 */
import { getConceptsForVerse } from './concepts'; // Import function to check concept tags

// Define the structure for a note
export interface Note {
  noteId: string;          // Unique identifier (based on absoluteVerseNumber)
  absoluteVerseNumber: number; // Absolute verse number (1-6236) - Primary Key
  surahNumber: number;     // Surah number (1-114) - For context
  ayahNumberInSurah: number; // Ayah number within the surah - For context
  createdAt: string;       // ISO string format timestamp
  updatedAt: string;       // ISO string format timestamp
  noteText: string;        // The note content
  tags: string[];          // Array of concept tags (concept IDs)
  isPrivate: boolean;      // Whether the note is private (default true)
}

const NOTES_STORAGE_KEY = 'quranCompanionNotes';

/**
 * Retrieves all notes from localStorage.
 * Handles potential parsing errors.
 * @returns An array of Note objects, or an empty array if none exist or an error occurs.
 */
function getAllNotes(): Note[] {
  if (typeof window === 'undefined') {
    console.log("localStorage not available on server, returning empty notes array.");
    return []; // Cannot access localStorage on server
  }
  try {
    const notesJson = localStorage.getItem(NOTES_STORAGE_KEY);
    const notes = notesJson ? JSON.parse(notesJson) : [];
    // Basic validation to ensure it's an array
    return Array.isArray(notes) ? notes : [];
  } catch (error) {
    console.error('Error parsing notes from localStorage:', error);
    localStorage.removeItem(NOTES_STORAGE_KEY); // Clear potentially corrupted data
    return [];
  }
}

/**
 * Saves the entire notes array back to localStorage.
 * @param notes The array of Note objects to save.
 */
function saveAllNotes(notes: Note[]): void {
   if (typeof window === 'undefined') {
    console.warn('Cannot save notes on server.');
    return;
  }
  try {
    // Ensure we're saving a valid array
    if (!Array.isArray(notes)) {
        throw new Error("Attempted to save non-array data as notes.");
    }
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving notes to localStorage:', error);
    // Consider notifying the user here if saving fails critically
    // Possibly implement a more robust error handling/recovery mechanism
  }
}

/**
 * Adds or updates a note for a specific verse, using the absolute verse number as the primary key.
 * If noteText is empty, it will still save/update the note object but with empty text (unless deleted separately).
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @param surahNumber The surah number (for context).
 * @param ayahNumberInSurah The ayah number within the surah (for context).
 * @param noteText The text content of the note.
 * @param tags An array of concept IDs associated *directly with the note object itself* (distinct from verse concept tags).
 * @param isPrivate Whether the note should be private (optional, default true).
 * @returns The saved Note object or null if saving failed or input invalid.
 */
export function saveNote(
  absoluteVerseNumber: number,
  surahNumber: number,
  ayahNumberInSurah: number,
  noteText: string,
  tags: string[] = [], // These are tags associated with the NOTE, not the VERSE concepts
  isPrivate: boolean = true
): Note | null {
   if (typeof window === 'undefined') {
    console.error('Cannot save note on server.');
    return null;
   }
   if (absoluteVerseNumber < 1 || absoluteVerseNumber > 6236) {
       console.error(`Invalid absoluteVerseNumber: ${absoluteVerseNumber}`);
       return null;
   }
   // Removed automatic deletion for empty notes - should be explicit UI action
   // if (!noteText && tags.length === 0) {
   //     console.log(`Note for verse ${absoluteVerseNumber} is empty, deleting if exists.`);
   //     deleteNoteForVerse(absoluteVerseNumber); // Delete empty note
   //     return null; // Return null as no note is saved/updated
   // }


  try {
    const allNotes = getAllNotes();
    const now = new Date().toISOString();

    // Find existing note based on absoluteVerseNumber
    const existingNoteIndex = allNotes.findIndex(
      n => n.absoluteVerseNumber === absoluteVerseNumber
    );

    let noteToSave: Note;

    if (existingNoteIndex >= 0) {
      // Update existing note
      noteToSave = {
        ...allNotes[existingNoteIndex],
        surahNumber, // Update context info in case it changes (shouldn't but safe)
        ayahNumberInSurah,
        noteText: noteText.trim(), // Save trimmed text
        tags: [...new Set(tags)], // Ensure note tags are unique
        isPrivate,
        updatedAt: now,
      };
      allNotes[existingNoteIndex] = noteToSave;
      console.log(`Updating note for verse ${absoluteVerseNumber}`);
    } else {
      // Add new note
      // Generate a unique ID, although absoluteVerseNumber is the functional key
      const noteId = `note_${absoluteVerseNumber}_${Date.now()}`;
      noteToSave = {
        noteId,
        absoluteVerseNumber,
        surahNumber,
        ayahNumberInSurah,
        createdAt: now,
        updatedAt: now,
        noteText: noteText.trim(), // Save trimmed text
        tags: [...new Set(tags)], // Ensure note tags are unique
        isPrivate,
      };
      allNotes.push(noteToSave);
      console.log(`Adding new note for verse ${absoluteVerseNumber}`);
    }

    // Save back to localStorage
    saveAllNotes(allNotes);
    console.log("Notes saved to localStorage. Current count:", allNotes.length);

    return noteToSave;
  } catch (error) {
    console.error(`Error in saveNote function for verse ${absoluteVerseNumber}:`, error);
    return null;
  }
}

/**
 * Gets the note *text object* for a specific absolute verse number.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @returns The Note object if found, otherwise null.
 */
export function getNoteForVerse(absoluteVerseNumber: number): Note | null {
  if (typeof window === 'undefined') {
      // console.log("localStorage not available on server, cannot get note.");
      return null;
  }
   if (absoluteVerseNumber < 1 || absoluteVerseNumber > 6236) {
       console.error(`Invalid absoluteVerseNumber: ${absoluteVerseNumber}`);
       return null;
   }
  try {
    const allNotes = getAllNotes();
    // Find the note matching the absolute verse number
    const note = allNotes.find(note => note.absoluteVerseNumber === absoluteVerseNumber);
    // console.log(`getNoteForVerse(${absoluteVerseNumber}): Found:`, note ? note.noteId : 'None');
    return note || null; // Return the found note or null
  } catch (error) {
    console.error(`Error getting note for verse ${absoluteVerseNumber}:`, error);
    return null;
  }
}

/**
 * Retrieves all notes stored.
 * @returns An array of all Note objects.
 */
export function getAllStoredNotes(): Note[] {
  return getAllNotes();
}

/**
 * Deletes a note based on its absolute verse number.
 * @param absoluteVerseNumber The absolute verse number of the note to delete.
 * @returns True if deletion was successful (or note didn't exist), false if an error occurred.
 */
export function deleteNoteForVerse(absoluteVerseNumber: number): boolean {
  if (typeof window === 'undefined') {
      console.warn("Cannot delete note on server.");
      return false;
  }
   if (absoluteVerseNumber < 1 || absoluteVerseNumber > 6236) {
       console.error(`Invalid absoluteVerseNumber for deletion: ${absoluteVerseNumber}`);
       return false;
   }
  try {
    let allNotes = getAllNotes();
    const initialLength = allNotes.length;
    allNotes = allNotes.filter(note => note.absoluteVerseNumber !== absoluteVerseNumber);

    if (allNotes.length < initialLength) {
      saveAllNotes(allNotes);
      console.log(`Deleted note for verse ${absoluteVerseNumber}`);
    } else {
      console.log(`No note found for verse ${absoluteVerseNumber} to delete.`);
    }
    return true; // Return true even if no note was found, as the state is correct
  } catch (error) {
    console.error(`Error deleting note for verse ${absoluteVerseNumber}:`, error);
    return false;
  }
}

/**
 * Checks if a note *object* exists OR if any *concept tags* are associated with a given absolute verse number.
 * This is used to determine if the note indicator should be shown.
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @returns True if a note object exists or concepts are tagged, false otherwise.
 */
export function checkNoteExists(absoluteVerseNumber: number): boolean {
   if (typeof window === 'undefined') return false;
   const noteObjectExists = getNoteForVerse(absoluteVerseNumber) !== null;
   const conceptsTagged = getConceptsForVerse(absoluteVerseNumber).length > 0;
   // console.log(`checkNoteExists(${absoluteVerseNumber}): noteObject=${noteObjectExists}, conceptsTagged=${conceptsTagged}`);
   return noteObjectExists || conceptsTagged;
}
