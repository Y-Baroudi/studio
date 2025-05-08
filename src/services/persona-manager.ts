// src/services/persona-manager.ts
'use client'; // Indicate client-side logic due to localStorage usage

import { aiProviderManager } from './ai-provider'; // Assuming aiProviderManager is in the same directory or adjust path

/**
 * @fileoverview Manages different AI personas, focusing on Abul'fath persona.
 */

// --- Interfaces ---
interface PersonaConcept {
  name: string;
  description: string;
  relatedVerses: string[]; // e.g., ["2:143", "55:7-9"]
  lastModified?: Date; // Optional, added for consistency
}

interface PersonaSettings {
  defaultLanguage: string;
  arabicScript: boolean;
  formatCitations: boolean;
  conceptTagging: boolean;
}

export interface Persona {
  id: string;
  name: string;
  nameArabic: string;
  description: string;
  created: Date;
  lastModified: Date;
  systemPrompt: string;
  concepts: Record<string, PersonaConcept>; // Concept ID as key
  settings: PersonaSettings;
}

interface VerseContext {
    surah: number;
    verse: number;
    arabicText: string;
    translation: string;
}

interface ConversationMessage {
    role: 'user' | 'assistant' | 'system'; // Use roles expected by AI provider
    content: string;
}


// Abul'fath Persona Configuration System
export const scholarPersonaManager = {
  // Store multiple personas with unique IDs
  personas: {} as Record<string, Persona>,

  // Active persona ID
  activePersonaId: null as string | null,

  // Initialize with default Abul'fath persona
  init: function() {
    const defaultPersonaId = 'abulfath_default';

    // Initialize only if it doesn't exist to avoid overwriting loaded data
    if (!this.personas[defaultPersonaId]) {
        this.personas[defaultPersonaId] = {
            id: defaultPersonaId,
            name: "Abul'fath",
            nameArabic: "أبو الفتح",
            description: "Knowledgeable Muslim scholar who provides practical religious guidance",
            created: new Date(),
            lastModified: new Date(),

            // System prompt is editable and stored
            systemPrompt: `You are a knowledgeable Muslim scholar named Abul'fath (أبو الفتح) who provides practical religious guidance for Muslims reconnecting with their faith. You support Y, a 54-year-old man of Moroccan-French heritage who has recently renewed his Islamic practice.

When using Arabic Islamic terminology, always present it in three forms: English transliteration, Arabic script, and English translation where needed. Format Arabic terms as follows: English transliteration followed by Arabic original in parentheses, e.g., "tawakkul (توكّل)".

Provide proper sourcing for all Islamic teachings:
- For Quranic references: Cite specific verses with preceding and following surahs
- For hadiths: Provide complete references including collection name, number, and narrator
- For scholarly opinions: Cite specific scholars, works, and relevant sections

Focus on these five areas:
1. Strengthening Core Islamic Practices with Intellectual Depth
2. Family-Centered Faith Revival
3. Cultural Integration with Critical Discernment
4. Practical Faith Application with Realistic Implementation
5. Building Intellectual-Spiritual Bridges`,

            // Core concepts can be edited
            concepts: {
                "wip": { // Use lowercase consistent IDs
                    name: "Water in Palm",
                    description: "Balance of structure without rigidity, like holding water in an open palm",
                    relatedVerses: ["2:143", "55:7-9", "4:171"]
                },
                "fof": { // Use lowercase consistent IDs
                    name: "Faith over Fear",
                    description: "Choosing action based on faith rather than reaction based on fear",
                    relatedVerses: ["3:173", "9:51", "65:3"]
                },
                "dt": { // Use lowercase consistent IDs
                    name: "Divine Triangle",
                    description: "The relationship between Allah's self-sufficiency, human purpose, and trials/punishment",
                    relatedVerses: ["51:56-57", "67:2", "2:155-157"]
                }
            },

            // Settings for this persona
            settings: {
                defaultLanguage: "en",
                arabicScript: true,
                formatCitations: true,
                conceptTagging: true
            }
        };
    }

    // Set active only if none is set or the default one is the only one
    if (!this.activePersonaId || !this.personas[this.activePersonaId] || Object.keys(this.personas).length === 1) {
       this.activePersonaId = defaultPersonaId;
    }
    this.savePersonas();

    return defaultPersonaId;
  },

  // Load personas from storage
  loadPersonas: function() {
    if (typeof window === 'undefined') return; // Guard against server-side execution
    try {
      const storedPersonas = localStorage.getItem('scholarPersonas');
      if (storedPersonas) {
        const parsed = JSON.parse(storedPersonas);
         // Revive Date objects
         Object.keys(parsed).forEach(key => {
             parsed[key].created = new Date(parsed[key].created);
             parsed[key].lastModified = new Date(parsed[key].lastModified);
             Object.keys(parsed[key].concepts).forEach(conceptKey => {
                 if (parsed[key].concepts[conceptKey].lastModified) {
                     parsed[key].concepts[conceptKey].lastModified = new Date(parsed[key].concepts[conceptKey].lastModified);
                 }
             });
         });
        this.personas = parsed;
      } else {
        // No stored personas, initialize with default
        console.log("No stored personas found, initializing default.");
        this.init();
      }

      // Load active persona ID
      const activeId = localStorage.getItem('activeScholarPersonaId');
      if (activeId && this.personas[activeId]) {
        this.activePersonaId = activeId;
      } else if (Object.keys(this.personas).length > 0) {
        // Use first available persona if activeId is invalid
        this.activePersonaId = Object.keys(this.personas)[0];
        console.log(`Active persona ID ${activeId} invalid, falling back to ${this.activePersonaId}`);
      } else {
        // No personas available, create default (should be covered by init above)
        console.log("No personas available after loading, re-initializing.");
        this.init();
      }
      console.log(`Personas loaded. Active ID: ${this.activePersonaId}`);

    } catch (error) {
      console.error('Error loading personas:', error);
      // Reset to default if error during loading
      this.init();
    }
  },

  // Save personas to storage
  savePersonas: function() {
    if (typeof window === 'undefined') return; // Guard against server-side execution
    try {
      localStorage.setItem('scholarPersonas', JSON.stringify(this.personas));
      if (this.activePersonaId) {
         localStorage.setItem('activeScholarPersonaId', this.activePersonaId);
      } else {
          localStorage.removeItem('activeScholarPersonaId');
      }
    } catch (error) {
      console.error('Error saving personas:', error);
    }
  },

  // Get active persona
  getActivePersona: function(): Persona | null {
     if (!this.activePersonaId || !this.personas[this.activePersonaId]) {
         // Attempt to load if not initialized, or if activeId is invalid
         this.loadPersonas();
         if (!this.activePersonaId || !this.personas[this.activePersonaId]) {
             console.warn("No active persona could be determined even after loading/init.");
             return null;
         }
     }
    return this.personas[this.activePersonaId];
  },

  // Set active persona
  setActivePersona: function(personaId: string): boolean {
    if (this.personas[personaId]) {
      this.activePersonaId = personaId;
      this.savePersonas();
      console.log(`Active persona set to: ${personaId}`);
      return true;
    }
    console.warn(`Failed to set active persona: ID ${personaId} not found.`);
    return false;
  },

  // Create a new persona
  createPersona: function(name: string, nameArabic: string, description: string, systemPrompt: string): string | null {
    if (!name || !systemPrompt) {
        console.error("Cannot create persona: Name and systemPrompt are required.");
        return null;
    }
    const id = 'persona_' + Date.now();

    this.personas[id] = {
      id,
      name,
      nameArabic,
      description,
      created: new Date(),
      lastModified: new Date(),
      systemPrompt,
      concepts: {}, // Start with empty concepts
      settings: { // Default settings
        defaultLanguage: "en",
        arabicScript: true,
        formatCitations: true,
        conceptTagging: true
      }
    };

    this.savePersonas();
    console.log(`Created new persona: ${id}`);
    return id;
  },

  // Update existing persona
  updatePersona: function(personaId: string, updates: Partial<Persona>): boolean {
    if (!this.personas[personaId]) {
        console.warn(`Cannot update persona: ID ${personaId} not found.`);
        return false;
    }

    // Ensure non-updatable fields are not changed
    const { id, created, ...validUpdates } = updates;

    // Update fields
    Object.assign(this.personas[personaId], {
      ...validUpdates,
      lastModified: new Date()
    });

    this.savePersonas();
    console.log(`Updated persona: ${personaId}`);
    return true;
  },

  // Add or update concept for a persona
  updateConcept: function(personaId: string, conceptId: string, conceptData: Omit<PersonaConcept, 'lastModified'>): boolean {
    if (!this.personas[personaId]) {
        console.warn(`Cannot update concept: Persona ID ${personaId} not found.`);
        return false;
    }
    if (!conceptId) {
        console.error("Cannot update concept: conceptId is required.");
        return false;
    }

    this.personas[personaId].concepts[conceptId] = {
      ...conceptData,
      lastModified: new Date()
    };

    this.savePersonas();
    console.log(`Updated concept ${conceptId} for persona ${personaId}`);
    return true;
  },

  // Remove concept from a persona
  removeConcept: function(personaId: string, conceptId: string): boolean {
    if (!this.personas[personaId] || !this.personas[personaId].concepts[conceptId]) {
      console.warn(`Cannot remove concept: Persona ID ${personaId} or Concept ID ${conceptId} not found.`);
      return false;
    }

    delete this.personas[personaId].concepts[conceptId];
    this.personas[personaId].lastModified = new Date(); // Update persona timestamp
    this.savePersonas();
    console.log(`Removed concept ${conceptId} from persona ${personaId}`);
    return true;
  },

  // Delete a persona
  deletePersona: function(personaId: string): boolean {
    if (!this.personas[personaId]) {
        console.warn(`Cannot delete persona: ID ${personaId} not found.`);
        return false;
    }
    if (Object.keys(this.personas).length <= 1) {
        console.warn("Cannot delete the last persona.");
        return false; // Prevent deleting the last one
    }


    delete this.personas[personaId];
    console.log(`Deleted persona: ${personaId}`);

    // If deleted the active persona, switch to another
    if (this.activePersonaId === personaId) {
      const remainingIds = Object.keys(this.personas);
      if (remainingIds.length > 0) {
        this.activePersonaId = remainingIds[0];
        console.log(`Active persona switched to: ${this.activePersonaId}`);
      } else {
        // This case should ideally not be reached due to the check above
        console.error("No personas left after deletion, this shouldn't happen.");
        this.activePersonaId = null; // Or re-initialize
      }
    }

    this.savePersonas();
    return true;
  },

  // Get a response from the active persona using the AI Provider Manager
  getResponse: async function(message: string, verseContext: VerseContext | null = null, conversationHistory: ConversationMessage[] = []) {
    const activePersona = this.getActivePersona();
    if (!activePersona) {
      return { error: true, message: 'No active persona available' };
    }

    // Construct message with relevant context
    let contextualizedMessage = message;

    if (verseContext) {
      contextualizedMessage = `[Regarding Quranic verse ${verseContext.surah}:${verseContext.verse}]\nArabic: "${verseContext.arabicText}"\nTranslation: "${verseContext.translation}"\n\nUser Query: ${message}`;
    }

    // Ensure conversation history roles match what the AI provider expects (user/assistant)
    // Note: The AI Provider might handle 'system' role differently or ignore it in history.
    const providerHistory = conversationHistory.filter(msg => msg.role === 'user' || msg.role === 'assistant');

    try {
        // Get response from AI provider using the active persona's system prompt
        const response = await aiProviderManager.sendMessage(
            contextualizedMessage,
            providerHistory, // Pass prepared history
            activePersona.systemPrompt // Pass system prompt
            // Add other options like model if needed from persona settings:
            // { model: activePersona.settings.preferredModel || aiProviderManager.providers[aiProviderManager.activeProvider]?.latestModel }
        );

        console.log("AI Response Received:", response);
        return response;

    } catch (error) {
        console.error("Error getting response via AI Provider Manager:", error);
        return { error: true, message: error instanceof Error ? error.message : 'Failed to get AI response' };
    }
  }
};

// Initialize the manager on load (client-side)
if (typeof window !== 'undefined') {
    scholarPersonaManager.loadPersonas();
}

    