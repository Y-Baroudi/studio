
/**
 * @fileOverview Defines the TypeScript interfaces for Firestore documents
 * used in the Qur'an Meezan application. This ensures type safety
 * when interacting with Firestore data.
 */

import type { FieldValue, Timestamp } from 'firebase/firestore'; 

/**
 * Represents the structure of a document in the 'users' collection.
 * Stores user profiles and application preferences.
 */
export interface UserDocument {
  userId: string; // Firebase Authentication User ID
  email: string;
  displayName: string;
  createdAt: Timestamp | FieldValue; // Allow FieldValue for serverTimestamp
  preferredAiModel?: 'claude' | 'gemini' | string; // Allow for other models
  defaultSystemPrompt?: string;
  // Add other user-specific preferences here
}

/**
 * Represents a reference to a Quranic verse or a document within a message.
 */
export interface MessageReference {
  type: 'quran' | 'document' | string; // e.g., 'quran', 'referenceDocument', 'concept'
  value: string; // e.g., '2:255', 'docABC123', 'concept_wip'
  displaySnippet?: string;
}

/**
 * Represents the structure of a document in the 'messages' subcollection
 * within a 'conversations' document.
 */
export interface MessageSubDocument {
  messageId: string; 
  sender: 'user' | 'ai' | string; 
  text: string;
  timestamp: Timestamp | FieldValue;
  referencesToQuranOrDocs?: MessageReference[];
  aiModelUsed?: string; 
}

/**
 * Represents the structure of a document in the 'conversations' collection.
 * Stores AI conversation threads.
 */
export interface ConversationDocument {
  conversationId: string; 
  userId: string; 
  title: string;
  topicTags?: string[]; 
  aiModelUsed?: string; 
  systemPromptUsed?: string; 
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

/**
 * Represents the types of reference documents.
 */
export type ReferenceDocumentType = 'coreConcept' | 'generalContext' | 'priorConversationSummary' | string;

/**
 * Represents the structure of a document in the 'referenceDocuments' collection.
 */
export interface ReferenceDocumentDocument {
  documentId: string; 
  userId: string | null; 
  title: string;
  type: ReferenceDocumentType;
  sourcePath?: string; 
  content?: string; 
  summary?: string; 
  createdAt: Timestamp | FieldValue;
  lastUpdated: Timestamp | FieldValue;
}

/**
 * Represents the structure of a document in the 'userNotes' collection.
 */
export interface UserNoteDocument {
  noteId: string; 
  userId: string; 
  content: string; 
  linkedQuranVerse?: string; 
  linkedConversationId?: string; 
  linkedDocumentId?: string; 
  conceptTags?: string[]; 
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  isPrivate?: boolean; 
}
