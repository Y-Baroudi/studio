// src/services/concepts.ts
'use client'; // Indicate client-side logic due to localStorage usage

/**
 * @fileoverview Service functions for managing Quran concepts and their relationships with verses using localStorage.
 */

// Define the structure for a concept
export interface Concept {
  id: string;              // Unique identifier (e.g., 'wip', 'faith_over_fear')
  name: string;            // Concept name (e.g., 'Water in Palm')
  description: string;     // Description of the concept
  createdAt: string;       // ISO string format timestamp
  parentConcept: string | null; // ID of parent concept (for hierarchical concepts)
  color: string;           // Display color for visual differentiation
  isCore: boolean;         // Whether it's a core concept like WIP, FoF, etc.
}

// Define the structure for the relationship between a verse and concepts
export interface VerseConceptRelation {
  relationshipKey: string; // Format: "surahNumber:ayahNumberInSurah" e.g., "2:255"
  surahNumber: number;
  ayahNumberInSurah: number;
  absoluteVerseNumber: number; // Added for easier lookup
  conceptIds: string[];     // Array of concept IDs linked to this verse
  createdAt: string;       // ISO string format timestamp
}

const CONCEPTS_STORAGE_KEY = 'quranConcepts';
const VERSE_CONCEPT_RELATIONS_STORAGE_KEY = 'verseConceptRelations';

// --- Helper Functions for localStorage ---

/**
 * Safely retrieves items from localStorage.
 * @param key The localStorage key.
 * @returns The parsed data or an empty array if not found or error.
 */
function getLocalStorageItem<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const itemJson = localStorage.getItem(key);
    return itemJson ? JSON.parse(itemJson) : [];
  } catch (error) {
    console.error(`Error parsing ${key} from localStorage:`, error);
    return [];
  }
}

/**
 * Safely saves items to localStorage.
 * @param key The localStorage key.
 * @param data The data array to save.
 */
function saveLocalStorageItem<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') {
    console.warn(`Cannot save ${key} on server.`);
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
}

// --- Core Concept Initialization ---

/**
 * Generates a random hex color.
 * @returns A random hex color string (e.g., '#A5B4FC').
 */
function generateRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  // Basic check for lightness to avoid very dark/light colors if needed
  // This is a simple approach, might need refinement for accessibility
  const r = parseInt(color.substring(1, 3), 16);
  const g = parseInt(color.substring(3, 5), 16);
  const b = parseInt(color.substring(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness < 50 || brightness > 200) { // Avoid very dark or very light
      return generateRandomColor(); // Recurse if needed
  }
  return color;
}


/**
 * Initializes core concepts (WIP, FoF, Divine Triangle) in localStorage if they don't exist.
 * @returns The array of all concepts (existing or newly initialized).
 */
export function initializeCoreConceptsIfNeeded(): Concept[] {
  if (typeof window === 'undefined') return [];

  let existingConcepts = getLocalStorageItem<Concept>(CONCEPTS_STORAGE_KEY);

  if (existingConcepts.length === 0) {
    const now = new Date().toISOString();
    const coreConcepts: Concept[] = [
      {
        id: 'wip',
        name: 'Water in Palm',
        description: 'Balance of structure without rigidity, like holding water in an open palm.',
        createdAt: now,
        parentConcept: null,
        color: '#4CAF50', // Green shade
        isCore: true,
      },
      {
        id: 'fof',
        name: 'Faith over Fear',
        description: 'Choosing action based on faith rather than reaction based on fear.',
        createdAt: now,
        parentConcept: null,
        color: '#2196F3', // Blue shade
        isCore: true,
      },
      {
        id: 'divine_triangle',
        name: 'Divine Triangle',
        description: "The relationship between Allah's self-sufficiency, human purpose, and trials/punishment.",
        createdAt: now,
        parentConcept: null,
        color: '#9C27B0', // Purple shade
        isCore: true,
      },
    ];

    console.log("Initializing core concepts:", coreConcepts);
    saveLocalStorageItem<Concept>(CONCEPTS_STORAGE_KEY, coreConcepts);
    return coreConcepts;
  }
   console.log("Core concepts already initialized.");
  return existingConcepts;
}

// --- Concept Management ---

/**
 * Creates a new concept and saves it to localStorage.
 * Generates an ID based on the name.
 *
 * @param name The name of the concept.
 * @param description A description of the concept.
 * @param parentConcept The ID of the parent concept, if any (optional).
 * @param color A specific color for the concept (optional, random if not provided).
 * @returns The newly created Concept object or null if an error occurs.
 */
export function createConcept(
  name: string,
  description: string,
  parentConcept: string | null = null,
  color?: string
): Concept | null {
  if (typeof window === 'undefined') return null;

  try {
    const concepts = getLocalStorageItem<Concept>(CONCEPTS_STORAGE_KEY);
    const id = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''); // Generate safe ID

    // Check if ID already exists
    if (concepts.some(c => c.id === id)) {
        console.warn(`Concept with ID "${id}" already exists. Cannot create duplicate.`);
        // Optionally, find and return the existing concept or handle as needed.
        return concepts.find(c => c.id === id) || null;
    }
     if (!name.trim()) {
        console.error("Concept name cannot be empty.");
        return null;
     }

    const newConcept: Concept = {
      id,
      name: name.trim(),
      description,
      createdAt: new Date().toISOString(),
      parentConcept,
      color: color || generateRandomColor(),
      isCore: false,
    };

    concepts.push(newConcept);
    saveLocalStorageItem<Concept>(CONCEPTS_STORAGE_KEY, concepts);
    console.log("Created new concept:", newConcept);
    return newConcept;
  } catch (error) {
    console.error('Error creating concept:', error);
    return null;
  }
}

/**
 * Retrieves all concepts from localStorage.
 * @returns An array of Concept objects.
 */
export function getAllConcepts(): Concept[] {
  // Ensure core concepts are initialized before getting all
  initializeCoreConceptsIfNeeded();
  return getLocalStorageItem<Concept>(CONCEPTS_STORAGE_KEY);
}

/**
 * Finds a concept by its ID.
 * @param conceptId The ID of the concept to find.
 * @returns The Concept object if found, otherwise null.
 */
export function getConceptById(conceptId: string): Concept | null {
    const concepts = getAllConcepts();
    return concepts.find(c => c.id === conceptId) || null;
}

// --- Verse Tagging ---

/**
 * Tags a specific verse with one or more concepts.
 * Creates or updates the relationship in localStorage.
 *
 * @param surahNumber The surah number.
 * @param ayahNumberInSurah The ayah number within the surah.
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @param conceptIds An array of concept IDs to associate with the verse.
 * @returns True if the operation was successful, false otherwise.
 */
export function tagVerseWithConcepts(
  surahNumber: number,
  ayahNumberInSurah: number,
  absoluteVerseNumber: number,
  conceptIds: string[]
): boolean {
  if (typeof window === 'undefined' || !conceptIds || conceptIds.length === 0) {
      console.warn("Cannot tag verse: No concept IDs provided or running on server.");
      return false;
  }

  try {
    const verseConcepts = getLocalStorageItem<VerseConceptRelation>(VERSE_CONCEPT_RELATIONS_STORAGE_KEY);
    const relationshipKey = `${surahNumber}:${ayahNumberInSurah}`;

    const existingRelationIndex = verseConcepts.findIndex(
      vc => vc.relationshipKey === relationshipKey
    );

    if (existingRelationIndex >= 0) {
      // Update existing relationship - merge IDs and remove duplicates
      const existingIds = verseConcepts[existingRelationIndex].conceptIds;
      const updatedIds = [...new Set([...existingIds, ...conceptIds])];
      verseConcepts[existingRelationIndex].conceptIds = updatedIds;
       console.log(`Updated concepts for verse ${relationshipKey}. New IDs:`, updatedIds);
    } else {
      // Create new relationship
      const newRelation: VerseConceptRelation = {
        relationshipKey,
        surahNumber,
        ayahNumberInSurah,
        absoluteVerseNumber, // Store absolute number
        conceptIds: [...new Set(conceptIds)], // Ensure unique IDs on creation
        createdAt: new Date().toISOString(),
      };
      verseConcepts.push(newRelation);
      console.log(`Created new concept relationship for verse ${relationshipKey}. IDs:`, newRelation.conceptIds);
    }

    saveLocalStorageItem<VerseConceptRelation>(VERSE_CONCEPT_RELATIONS_STORAGE_KEY, verseConcepts);
    return true;
  } catch (error) {
    console.error(`Error tagging verse ${surahNumber}:${ayahNumberInSurah} with concepts:`, error);
    return false;
  }
}

/**
 * Untags (removes) specific concepts from a verse.
 *
 * @param surahNumber The surah number.
 * @param ayahNumberInSurah The ayah number within the surah.
 * @param conceptIdsToRemove An array of concept IDs to remove from the verse.
 * @returns True if the operation was successful, false otherwise.
 */
export function untagVerseConcepts(
  surahNumber: number,
  ayahNumberInSurah: number,
  conceptIdsToRemove: string[]
): boolean {
    if (typeof window === 'undefined' || !conceptIdsToRemove || conceptIdsToRemove.length === 0) {
        console.warn("Cannot untag verse: No concept IDs provided or running on server.");
        return false;
    }

    try {
        const verseConcepts = getLocalStorageItem<VerseConceptRelation>(VERSE_CONCEPT_RELATIONS_STORAGE_KEY);
        const relationshipKey = `${surahNumber}:${ayahNumberInSurah}`;

        const existingRelationIndex = verseConcepts.findIndex(
            vc => vc.relationshipKey === relationshipKey
        );

        if (existingRelationIndex >= 0) {
            const currentIds = verseConcepts[existingRelationIndex].conceptIds;
            // Filter out the concepts to remove
            const updatedIds = currentIds.filter(id => !conceptIdsToRemove.includes(id));

            // If no concepts remain, remove the entire relationship entry
            if (updatedIds.length === 0) {
                verseConcepts.splice(existingRelationIndex, 1);
                console.log(`Removed concept relationship for verse ${relationshipKey} as no concepts remain.`);
            } else {
                verseConcepts[existingRelationIndex].conceptIds = updatedIds;
                console.log(`Untagged concepts from verse ${relationshipKey}. Remaining IDs:`, updatedIds);
            }

            saveLocalStorageItem<VerseConceptRelation>(VERSE_CONCEPT_RELATIONS_STORAGE_KEY, verseConcepts);
            return true;
        } else {
            console.log(`No existing concept relationship found for verse ${relationshipKey} to untag.`);
            return true; // Operation is successful in the sense that the state is as desired
        }
    } catch (error) {
        console.error(`Error untagging concepts from verse ${surahNumber}:${ayahNumberInSurah}:`, error);
        return false;
    }
}


/**
 * Retrieves the concept IDs associated with a specific verse.
 *
 * @param absoluteVerseNumber The absolute verse number (1-6236).
 * @returns An array of concept IDs, or an empty array if none are found.
 */
export function getConceptsForVerse(absoluteVerseNumber: number): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const verseConcepts = getLocalStorageItem<VerseConceptRelation>(VERSE_CONCEPT_RELATIONS_STORAGE_KEY);
    const relation = verseConcepts.find(vc => vc.absoluteVerseNumber === absoluteVerseNumber);
    return relation ? relation.conceptIds : [];
  } catch (error) {
    console.error(`Error getting concepts for verse ${absoluteVerseNumber}:`, error);
    return [];
  }
}

/**
 * Retrieves all verses associated with a specific concept ID.
 *
 * @param conceptId The ID of the concept.
 * @returns An array of objects containing { surahNumber, ayahNumberInSurah, absoluteVerseNumber }.
 */
export function getVersesForConcept(conceptId: string): { surahNumber: number; ayahNumberInSurah: number; absoluteVerseNumber: number }[] {
    if (typeof window === 'undefined') return [];
    try {
        const verseConcepts = getLocalStorageItem<VerseConceptRelation>(VERSE_CONCEPT_RELATIONS_STORAGE_KEY);
        return verseConcepts
            .filter(vc => vc.conceptIds.includes(conceptId))
            .map(vc => ({
                surahNumber: vc.surahNumber,
                ayahNumberInSurah: vc.ayahNumberInSurah,
                absoluteVerseNumber: vc.absoluteVerseNumber,
            }));
    } catch (error) {
        console.error(`Error getting verses for concept ${conceptId}:`, error);
        return [];
    }
}


/**
 * Retrieves all verse-concept relationships.
 * @returns An array of VerseConceptRelation objects.
 */
export function getAllVerseConceptRelations(): VerseConceptRelation[] {
    return getLocalStorageItem<VerseConceptRelation>(VERSE_CONCEPT_RELATIONS_STORAGE_KEY);
}


// Initialize core concepts on load if running in a browser context
if (typeof window !== 'undefined') {
    initializeCoreConceptsIfNeeded();
}
