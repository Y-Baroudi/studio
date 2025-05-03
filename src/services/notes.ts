// src/services/notes.ts
'use client'; // Indicate client-side logic due to localStorage usage

/**
 * @fileoverview Service functions for managing Quran notes using localStorage.
 */

// Define the structure for a note
export interface Note {
  noteId: string;          // Unique identifier
  surahNumber: number;     // Surah number (absolute, 1-114)
  ayahNumberInSurah: number; // Ayah number within the surah
  absoluteVerseNumber: number; // Absolute verse number (1-6236)
  createdAt: string;       // ISO string format timestamp
  updatedAt: string;       // ISO string format timestamp
  noteText: string;        // The note content
  tags: string[];          // Array of concept tags
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
    return []; // Cannot access localStorage on server
  }
  try {
    const notesJson = localStorage.getItem(NOTES_STORAGE_KEY);
    return notesJson ? JSON.parse(notesJson) : [];
  } catch (error) {
    console.error('Error parsing notes from localStorage:', error);
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
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving notes to localStorage:', error);
    // Consider notifying the user here if saving fails critically
  }
}

/**
 * Adds or updates a note for a specific verse.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @param surahNumber The surah number.
 * @param ayahNumberInSurah The ayah number within the surah.
 * @param noteText The text content of the note.
 * @param tags An array of tags associated with the note (optional).
 * @param isPrivate Whether the note should be private (optional, default true).
 * @returns The saved Note object or null if saving failed.
 */
export function saveNote(
  absoluteVerseNumber: number,
  surahNumber: number,
  ayahNumberInSurah: number,
  noteText: string,
  tags: string[] = [],
  isPrivate: boolean = true
): Note | null {
   if (typeof window === 'undefined') {
    console.error('Cannot save note on server.');
    return null;
   }
  try {
    const allNotes = getAllNotes();
    const now = new Date().toISOString();

    // Check if a note for this verse already exists
    const existingNoteIndex = allNotes.findIndex(
      n => n.absoluteVerseNumber === absoluteVerseNumber
    );

    let noteToSave: Note;

    if (existingNoteIndex >= 0) {
      // Update existing note
      noteToSave = {
        ...allNotes[existingNoteIndex],
        noteText,
        tags,
        isPrivate, // Allow updating privacy status
        updatedAt: now,
      };
      allNotes[existingNoteIndex] = noteToSave;
      console.log(`Updating note for verse ${absoluteVerseNumber}`);
    } else {
      // Add new note
       const noteId = `note_${absoluteVerseNumber}_${Date.now()}`; // Use absolute verse number for consistency
      noteToSave = {
        noteId,
        surahNumber,
        ayahNumberInSurah,
        absoluteVerseNumber,
        createdAt: now,
        updatedAt: now,
        noteText,
        tags,
        isPrivate,
      };
      allNotes.push(noteToSave);
      console.log(`Adding new note for verse ${absoluteVerseNumber}`);
    }

    // Save back to localStorage
    saveAllNotes(allNotes);
    console.log("Notes saved to localStorage:", noteToSave);

    return noteToSave;
  } catch (error) {
    console.error('Error in saveNote function:', error);
    return null;
  }
}

/**
 * Gets the note for a specific absolute verse number.
 * Assumes only one note per verse for simplicity in this implementation.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @returns The Note object if found, otherwise null.
 */
export function getNoteForVerse(absoluteVerseNumber: number): Note | null {
  if (typeof window === 'undefined') return null;
  try {
    const allNotes = getAllNotes();
    // Find the first note matching the absolute verse number
    const note = allNotes.find(note => note.absoluteVerseNumber === absoluteVerseNumber);
    return note || null; // Return the found note or null
  } catch (error) {
    console.error(`Error getting note for verse ${absoluteVerseNumber}:`, error);
    return null;
  }
}

/**
 * Retrieves all notes stored.
 * Useful for features like "View All Notes".
 * @returns An array of all Note objects.
 */
export function getAllStoredNotes(): Note[] {
  return getAllNotes();
}

/**
 * Deletes a note based on its absolute verse number.
 * @param absoluteVerseNumber The absolute verse number of the note to delete.
 * @returns True if deletion was successful, false otherwise.
 */
export function deleteNoteForVerse(absoluteVerseNumber: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    let allNotes = getAllNotes();
    const initialLength = allNotes.length;
    allNotes = allNotes.filter(note => note.absoluteVerseNumber !== absoluteVerseNumber);

    if (allNotes.length < initialLength) {
      saveAllNotes(allNotes);
      console.log(`Deleted note for verse ${absoluteVerseNumber}`);
      return true;
    } else {
      console.log(`No note found for verse ${absoluteVerseNumber} to delete.`);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting note for verse ${absoluteVerseNumber}:`, error);
    return false;
  }
}
