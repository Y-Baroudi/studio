
// src/services/ai/scholarPersonaManager.ts
/**
 * @fileoverview Manages AI scholar personas, their configurations, and system prompts.
 * Uses localStorage for persistence.
 */

// Ensure this file is treated as a module.
export {};

interface ConceptDetail {
  name: string;
  description: string;
  relatedVerses: string[];
  lastModified?: string; // ISO string
}

export interface ScholarPersona {
  id: string;
  name: string;
  nameArabic?: string;
  description: string;
  created: string; // ISO string
  lastModified: string; // ISO string
  systemPrompt: string;
  concepts: Record<string, ConceptDetail>; // e.g. { "WIP": { name: "Water in Palm", ... } }
  settings: {
    defaultLanguage: string;
    arabicScript: boolean;
    formatCitations: boolean;
    conceptTagging: boolean;
  };
}

const PERSONAS_STORAGE_KEY = 'scholarPersonas_v2'; // Added v2 for potential schema changes
const ACTIVE_PERSONA_ID_KEY = 'activeScholarPersonaId_v2';

class ScholarPersonaManager {
  public personas: Record<string, ScholarPersona> = {};
  public activePersonaId: string | null = null;

  constructor() {
    // Load personas immediately on instantiation for client-side usage
    if (typeof window !== 'undefined') {
      this.loadPersonas();
    } else {
      // Initialize with default if on server (though most methods won't work fully)
      this._initializeDefaultIfNeeded();
    }
  }

  private _initializeDefaultIfNeeded(): string {
    const defaultPersonaId = 'abulfath_default';
    if (!this.personas[defaultPersonaId]) {
        const now = new Date().toISOString();
        this.personas[defaultPersonaId] = {
            id: defaultPersonaId,
            name: "Abul'fath",
            nameArabic: "أبو الفتح",
            description: "Knowledgeable Muslim scholar who provides practical religious guidance",
            created: now,
            lastModified: now,
            systemPrompt: `You are a knowledgeable Muslim scholar named Abul'fath (أبو الفتح) who provides practical religious guidance for Muslims reconnecting with their faith. You support Y, a 54-year-old man of Moroccan-French heritage who has recently renewed his Islamic practice.

When using Arabic Islamic terminology, always present it in three forms: English transliteration, Arabic script, and English translation where needed. Format Arabic terms as follows: English transliteration followed by Arabic original in parentheses, e.g., "tawakkul (توكّل)".

Provide proper sourcing for all Islamic teachings:
- For Quranic references: Cite specific verses, ideally with Surah name and number.
- For hadiths: Provide complete references including collection name, number, and narrator if possible.
- For scholarly opinions: Cite specific scholars, works, and relevant sections if possible.

Focus on these five areas:
1. Strengthening Core Islamic Practices with Intellectual Depth
2. Family-Centered Faith Revival
3. Cultural Integration with Critical Discernment
4. Practical Faith Application with Realistic Implementation
5. Building Intellectual-Spiritual Bridges`,
            concepts: {
                "WIP": {
                name: "Water in Palm",
                description: "Balance of structure without rigidity, like holding water in an open palm.",
                relatedVerses: ["2:143", "55:7-9", "4:171"]
                },
                "FoF": {
                name: "Faith over Fear",
                description: "Choosing action based on faith rather than reaction based on fear.",
                relatedVerses: ["3:173", "9:51", "65:3"]
                },
                "DT": {
                name: "Divine Triangle",
                description: "The relationship between Allah's self-sufficiency, human purpose, and trials/punishment.",
                relatedVerses: ["51:56-57", "67:2", "2:155-157"]
                }
            },
            settings: {
                defaultLanguage: "en",
                arabicScript: true,
                formatCitations: true,
                conceptTagging: true
            }
        };
        console.log("Initialized default Abul'fath persona.");
    }
    if (!this.activePersonaId) {
        this.activePersonaId = defaultPersonaId;
    }
    return defaultPersonaId;
  }


  public loadPersonas(): void {
    if (typeof window === 'undefined') return;
    try {
      const storedPersonas = localStorage.getItem(PERSONAS_STORAGE_KEY);
      if (storedPersonas) {
        this.personas = JSON.parse(storedPersonas);
      } else {
        this._initializeDefaultIfNeeded();
        this.savePersonas(); // Save the default if nothing was loaded
        return; // Exit after initializing and saving default
      }

      const activeId = localStorage.getItem(ACTIVE_PERSONA_ID_KEY);
      if (activeId && this.personas[activeId]) {
        this.activePersonaId = activeId;
      } else if (Object.keys(this.personas).length > 0) {
        this.activePersonaId = Object.keys(this.personas)[0];
      } else {
        // No personas loaded and default wasn't created somehow, re-initialize
        this._initializeDefaultIfNeeded();
      }
       // Ensure activePersonaId is set if it's null after loading
       if (!this.activePersonaId && Object.keys(this.personas).length > 0) {
        this.activePersonaId = Object.keys(this.personas)[0];
      } else if (!this.activePersonaId) {
        this._initializeDefaultIfNeeded();
      }

    } catch (error) {
      console.error('Error loading personas from localStorage:', error);
      this._initializeDefaultIfNeeded(); // Fallback to default
    }
  }

  public savePersonas(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(this.personas));
      if (this.activePersonaId) {
        localStorage.setItem(ACTIVE_PERSONA_ID_KEY, this.activePersonaId);
      }
    } catch (error) {
      console.error('Error saving personas to localStorage:', error);
    }
  }

  public getActivePersona(): ScholarPersona | null {
    if (!this.activePersonaId || !this.personas[this.activePersonaId]) {
        // If activePersonaId is somehow invalid, try to load or set a default
        this.loadPersonas(); // This will attempt to load or initialize
        if (!this.activePersonaId || !this.personas[this.activePersonaId]) {
            return null; // Still no valid active persona
        }
    }
    return this.personas[this.activePersonaId];
  }

  public setActivePersona(personaId: string): boolean {
    if (this.personas[personaId]) {
      this.activePersonaId = personaId;
      this.savePersonas();
      return true;
    }
    console.warn(`Persona with ID ${personaId} not found.`);
    return false;
  }

  public createPersona(name: string, nameArabic: string | undefined, description: string, systemPrompt: string): string {
    const id = `persona_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    this.personas[id] = {
      id,
      name,
      nameArabic,
      description,
      created: now,
      lastModified: now,
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
    if (!this.activePersonaId) { // If no active persona, set this new one as active
        this.setActivePersona(id);
    }
    return id;
  }

  public updatePersona(personaId: string, updates: Partial<Omit<ScholarPersona, 'id' | 'created' | 'concepts'>>): boolean {
    if (!this.personas[personaId]) {
      console.warn(`Cannot update: Persona with ID ${personaId} not found.`);
      return false;
    }
    this.personas[personaId] = {
      ...this.personas[personaId],
      ...updates,
      lastModified: new Date().toISOString()
    };
    this.savePersonas();
    return true;
  }
  
  public updateConcept(personaId: string, conceptKey: string, conceptData: Omit<ConceptDetail, 'lastModified'>): boolean {
    if (!this.personas[personaId]) {
      console.warn(`Cannot update concept: Persona with ID ${personaId} not found.`);
      return false;
    }
    if (!this.personas[personaId].concepts) {
        this.personas[personaId].concepts = {};
    }
    this.personas[personaId].concepts[conceptKey] = {
      ...conceptData,
      lastModified: new Date().toISOString()
    };
    this.savePersonas();
    return true;
  }

  public removeConcept(personaId: string, conceptKey: string): boolean {
    if (!this.personas[personaId] || !this.personas[personaId].concepts || !this.personas[personaId].concepts[conceptKey]) {
      console.warn(`Cannot remove concept: Persona or concept not found.`);
      return false;
    }
    delete this.personas[personaId].concepts[conceptKey];
    this.savePersonas();
    return true;
  }

  public deletePersona(personaId: string): boolean {
    if (!this.personas[personaId]) {
      console.warn(`Cannot delete: Persona with ID ${personaId} not found.`);
      return false;
    }
    delete this.personas[personaId];
    if (this.activePersonaId === personaId) {
      const remainingIds = Object.keys(this.personas);
      this.activePersonaId = remainingIds.length > 0 ? remainingIds[0] : null;
      if (!this.activePersonaId) {
         this._initializeDefaultIfNeeded(); // Ensure a default is active if all deleted
      }
    }
    this.savePersonas();
    return true;
  }
}

// Export a singleton instance
export const scholarPersonaManager = new ScholarPersonaManager();
