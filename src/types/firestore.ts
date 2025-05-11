/**
 * @fileOverview Defines the TypeScript interfaces for Firestore documents
 * used in the Qur'an Meezan application. This ensures type safety
 * when interacting with Firestore data.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the structure of a document in the 'users' collection.
 * Stores user profiles and application preferences.
 */
export interface UserDocument {
  userId: string; // Firebase Authentication User ID
  email: string;
  displayName: string;
  createdAt: Timestamp;
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
  // Optional: Add display name or snippet for quick reference in UI
  displaySnippet?: string;
}

/**
 * Represents the structure of a document in the 'messages' subcollection
 * within a 'conversations' document.
 */
export interface MessageSubDocument {
  messageId: string; // Auto-generated or specific ID
  sender: 'user' | 'ai' | string; // Or 'system' for system messages
  text: string;
  timestamp: Timestamp;
  referencesToQuranOrDocs?: MessageReference[];
  aiModelUsed?: string; // Model used for this specific AI message
  // Optional: Add other message-specific data like attachments, processing time, etc.
}

/**
 * Represents the structure of a document in the 'conversations' collection.
 * Stores AI conversation threads.
 */
export interface ConversationDocument {
  conversationId: string; // Auto-generated or specific ID
  userId: string; // Links to a UserDocument
  title: string;
  topicTags?: string[]; // Array of keywords or topics
  aiModelUsed?: string; // Default or primary AI model for the conversation
  systemPromptUsed?: string; // System prompt active for this conversation
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // 'messages' will be a subcollection, not a field in this document.
  // Optional: Add other conversation-level metadata, e.g., summary, status
}

/**
 * Represents the types of reference documents.
 * - 'coreConcept': Key guiding principles (WIP, FoF, Divine Triangle).
 * - 'generalContext': Broader Islamic or scholarly texts.
 * - 'priorConversationSummary': Summaries of past AI conversations for context.
 */
export type ReferenceDocumentType = 'coreConcept' | 'generalContext' | 'priorConversationSummary' | string;

/**
 * Represents the structure of a document in the 'referenceDocuments' collection.
 * Stores metadata about reference documents used for RAG or user reference.
 */
export interface ReferenceDocumentDocument {
  documentId: string; // Auto-generated or specific ID
  userId: string; // User who uploaded/owns this document, or null for global docs
  title: string;
  type: ReferenceDocumentType;
  sourcePath?: string; // e.g., Firebase Storage path like '/docs/wip.pdf', or external URL
  content?: string; // Optional: For directly storing small text content instead of a path
  summary?: string; // Optional: AI-generated or manual summary
  createdAt: Timestamp;
  lastUpdated: Timestamp;
  // Optional: Add other metadata like author, publication date, vector embeddings status
}

/**
 * Represents the structure of a document in the 'userNotes' collection.
 * Stores personal notes linked to Quranic verses, conversations, or documents.
 */
export interface UserNoteDocument {
  noteId: string; // Auto-generated or specific ID
  userId: string; // Links to a UserDocument
  content: string; // The note content (could be plain text, markdown, or rich text JSON)
  linkedQuranVerse?: string; // e.g., '2:153' (absolute verse number or surah:ayah)
  linkedConversationId?: string; // Links to a ConversationDocument
  linkedDocumentId?: string; // Links to a ReferenceDocumentDocument
  conceptTags?: string[]; // Array of concept IDs or keywords
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPrivate?: boolean; // Default true
  // Optional: Add other note-specific data like color coding, attachments
}
