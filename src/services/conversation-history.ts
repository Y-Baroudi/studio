// src/services/conversation-history.ts
'use client'; // Indicate client-side logic due to localStorage usage

/**
 * @fileoverview Service functions for managing chat conversation history using localStorage.
 */

// Define the structure for a single message in the history
export interface HistoryMessage {
  id: string; // Unique ID for the message
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string format timestamp
  metadata?: Record<string, any>; // For storing provider, model, errors, etc.
}

const HISTORY_STORAGE_PREFIX = 'quranChatHistory_';
const MAX_HISTORY_LENGTH = 50; // Max messages to keep per conversation thread

/**
 * Retrieves the conversation history for a specific ID (e.g., verse reference or 'general').
 * Handles potential parsing errors.
 * @param conversationId The unique identifier for the conversation thread.
 * @returns An array of HistoryMessage objects, or an empty array if none exist or an error occurs.
 */
export function getConversationHistory(conversationId: string): HistoryMessage[] {
  if (typeof window === 'undefined' || !conversationId) {
    // console.log("Cannot get history: No conversation ID or running on server.");
    return [];
  }
  const storageKey = `${HISTORY_STORAGE_PREFIX}${conversationId}`;
  try {
    const historyJson = localStorage.getItem(storageKey);
    const history = historyJson ? JSON.parse(historyJson) : [];
    // Basic validation to ensure it's an array of expected objects
    if (Array.isArray(history)) {
         // Ensure messages have necessary fields (simple check)
         return history.filter(msg => msg && msg.role && msg.content && msg.timestamp && msg.id);
    }
    console.warn(`Invalid history format found for key ${storageKey}. Resetting.`);
    localStorage.removeItem(storageKey);
    return [];
  } catch (error) {
    console.error(`Error parsing history from localStorage for key ${storageKey}:`, error);
    localStorage.removeItem(storageKey); // Clear potentially corrupted data
    return [];
  }
}

/**
 * Saves the entire conversation history array for a specific ID back to localStorage.
 * Enforces a maximum history length.
 * @param conversationId The unique identifier for the conversation thread.
 * @param history The array of HistoryMessage objects to save.
 */
export function saveConversationHistory(conversationId: string, history: HistoryMessage[]): void {
   if (typeof window === 'undefined' || !conversationId) {
    console.warn('Cannot save history: No conversation ID or running on server.');
    return;
  }
  const storageKey = `${HISTORY_STORAGE_PREFIX}${conversationId}`;
  try {
    // Ensure we're saving a valid array
    if (!Array.isArray(history)) {
        throw new Error("Attempted to save non-array data as history.");
    }

    // Trim history if it exceeds the maximum length
    const trimmedHistory = history.length > MAX_HISTORY_LENGTH
        ? history.slice(-MAX_HISTORY_LENGTH) // Keep the most recent messages
        : history;

    localStorage.setItem(storageKey, JSON.stringify(trimmedHistory));
     // console.log(`Saved history for ${conversationId}. Length: ${trimmedHistory.length}`);
  } catch (error) {
    console.error(`Error saving history to localStorage for key ${storageKey}:`, error);
  }
}

/**
 * Clears the conversation history for a specific ID.
 * @param conversationId The unique identifier for the conversation thread.
 */
export function clearConversationHistory(conversationId: string): void {
    if (typeof window === 'undefined' || !conversationId) {
        console.warn('Cannot clear history: No conversation ID or running on server.');
        return;
    }
    const storageKey = `${HISTORY_STORAGE_PREFIX}${conversationId}`;
    try {
        localStorage.removeItem(storageKey);
        console.log(`Cleared history for ${conversationId}.`);
    } catch (error) {
        console.error(`Error clearing history for ${conversationId}:`, error);
    }
}

/**
 * Clears ALL conversation histories stored under the prefix.
 * Use with caution!
 */
export function clearAllConversationHistories(): void {
    if (typeof window === 'undefined') {
        console.warn('Cannot clear all histories on server.');
        return;
    }
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(HISTORY_STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        console.log("Cleared all Quran chat histories.");
    } catch (error) {
        console.error("Error clearing all conversation histories:", error);
    }
}
