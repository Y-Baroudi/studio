// src/services/ai-provider.ts
'use client'; // Indicate client-side logic due to localStorage/btoa/atob usage

/**
 * @fileoverview Manages interactions with different AI providers (Claude, Gemini).
 */

// --- Interfaces (Optional but recommended for better type safety) ---
interface AIProviderConfig {
  name: string;
  endpoint: string;
  apiVersion?: string;
  latestModel: string;
  alternativeModels: string[];
  headers: (apiKey: string) => Record<string, string>;
  prepareRequest: (
    model: string,
    prompt: string,
    context: MessageContext[],
    systemPrompt: string | null,
    options: AIRequestOptions
  ) => Record<string, any>;
  getEndpoint?: (endpoint: string, apiKey: string) => string; // Optional for providers needing key in URL
}

interface AIRequestOptions {
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  // Add other provider-specific options if needed
}

interface MessageContext {
  role: 'user' | 'assistant' | 'system'; // Adjust roles based on API needs
  content: string;
}

interface NormalizedAIResponse {
  content?: string;
  model?: string;
  provider?: string;
  error?: boolean;
  message?: string;
}

// --- AI Provider Manager Implementation ---
export const aiProviderManager = {
  providers: {
    claude: {
      name: "Claude (Anthropic)",
      endpoint: "https://api.anthropic.com/v1/messages",
      apiVersion: "2023-06-01",
      latestModel: "claude-3-5-sonnet-20240620", // Latest as of May 2025
      alternativeModels: [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307"
      ],
      headers: (apiKey: string) => ({
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01', // Use the specific version
        'x-api-key': apiKey
      }),
      prepareRequest: (model: string, prompt: string, context: MessageContext[], systemPrompt: string | null, options: AIRequestOptions) => ({
        model: model,
        max_tokens: options.maxTokens || 4000,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...context, // Ensure context roles match API (user/assistant)
          { role: "user", content: prompt }
        ]
      })
    } as AIProviderConfig, // Added type assertion
    gemini: {
      name: "Gemini (Google)",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", // Correct model endpoint
      latestModel: "gemini-1.5-pro",
      alternativeModels: ["gemini-1.0-pro"],
      headers: (apiKey: string) => ({ // API key is usually passed in URL for Gemini
        'Content-Type': 'application/json'
      }),
      prepareRequest: (model: string, prompt: string, context: MessageContext[], systemPrompt: string | null, options: AIRequestOptions) => {
        // Combine context and new prompt into Gemini format
        const contents = [];

        // Gemini API uses a different structure, often less explicit about system prompts
        // This might need adjustment based on specific Gemini model requirements
        if (systemPrompt) {
          // Add system prompt as the first user message or specific system instruction if supported
           contents.push({
             role: "user", // Gemini might treat initial user message as system context
             parts: [{ text: systemPrompt }]
           });
        }

        // Format context as conversation
        for (const msg of context) {
          contents.push({
            // Gemini uses 'model' for assistant role
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
          });
        }

        // Add current prompt
        contents.push({
          role: "user",
          parts: [{ text: prompt }]
        });

        return {
          contents,
          generationConfig: {
            maxOutputTokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.7
          }
        };
      },
      // For Gemini API, append key as query parameter
      getEndpoint: (endpoint: string, apiKey: string) => {
        // Adjust endpoint based on model if necessary, e.g., /v1beta/models/{model}:generateContent
         const effectiveEndpoint = endpoint.includes(':generateContent') ? endpoint : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`; // Fallback logic
         return `${effectiveEndpoint}?key=${apiKey}`;
      }
    } as AIProviderConfig // Added type assertion
  },

  activeProvider: 'claude', // Default provider
  apiKeys: {} as Record<string, string>, // Store encrypted keys

  // Initialize AI provider
  init: async function(provider: string, apiKey: string): Promise<boolean> {
    if (!this.providers[provider as keyof typeof this.providers]) {
      console.error(`Provider ${provider} not supported`);
      return false;
    }
    if (typeof window === 'undefined') {
       console.warn("Cannot initialize AI provider on server.");
       return false;
    }

    this.activeProvider = provider;
    this.apiKeys[provider] = this.encryptKey(apiKey);
    return await this.testConnection(provider); // Ensure testConnection is awaited
  },

  // Switch active provider
  switchProvider: function(provider: string): boolean {
    if (!this.providers[provider as keyof typeof this.providers]) {
      console.error(`Provider ${provider} not supported`);
      return false;
    }

    if (!this.apiKeys[provider]) {
      console.warn(`No API key set for provider ${provider}. Cannot switch.`);
      return false;
    }

    this.activeProvider = provider;
    console.log(`Switched active AI provider to: ${provider}`);
    return true;
  },

  // Simple encryption for API keys (Use a more secure method in production)
  encryptKey: function(key: string): string {
    if (typeof window !== 'undefined' && typeof btoa === 'function') {
       try {
        return btoa(key); // Simple base64 encoding - client-side only
       } catch (e) {
         console.error("Error during btoa:", e);
         return ""; // Handle potential errors
       }
    }
    return ""; // Return empty string or handle server-side appropriately
  },

  // Simple decryption for API keys
  decryptKey: function(encryptedKey: string): string {
     if (typeof window !== 'undefined' && typeof atob === 'function') {
        try {
         return atob(encryptedKey); // Simple base64 decoding - client-side only
        } catch (e) {
         console.error("Error during atob:", e);
          return ""; // Handle potential errors
        }
     }
     return ""; // Return empty string or handle server-side appropriately
  },

  // Test connection to active AI provider
  testConnection: async function(provider: string | null = null): Promise<boolean> {
    const testProvider = provider || this.activeProvider;
     if (typeof window === 'undefined') return false; // Cannot test on server

    if (!this.apiKeys[testProvider]) {
        console.warn(`No API key available for ${testProvider}, cannot test connection.`);
        return false;
    }

    try {
      const response = await this.sendMessage(
        "Test connection",
        [],
        "This is a test message. Please respond with 'Connection successful.'", // System prompt
        { provider: testProvider } // Options object
      );

      // Check for successful response (adjust based on normalized format)
      console.log(`${testProvider} test response:`, response);
      return response && !response.error && response.content?.includes('Connection successful');
    } catch (error) {
      console.error(`${testProvider} API connection failed:`, error);
      return false;
    }
  },

  // Send message to AI provider
  sendMessage: async function(
        prompt: string,
        context: MessageContext[] = [],
        systemPrompt: string | null = null,
        options: AIRequestOptions = {}
    ): Promise<NormalizedAIResponse> {
    const provider = options.provider || this.activeProvider;
    const providerConfig = this.providers[provider as keyof typeof this.providers];

    if (!providerConfig) {
        return { error: true, message: `Provider ${provider} not supported` };
    }
    if (typeof window === 'undefined') {
       return { error: true, message: "Cannot send AI message from server." };
    }

    const encryptedApiKey = this.apiKeys[provider];
    if (!encryptedApiKey) {
        return { error: true, message: `No API key found for ${provider}` };
    }
    const apiKey = this.decryptKey(encryptedApiKey);
     if (!apiKey) { // Check if decryption failed
        return { error: true, message: `Failed to decrypt API key for ${provider}` };
     }

    try {
      const model = options.model || providerConfig.latestModel;
      const headers = providerConfig.headers(apiKey);
      const body = providerConfig.prepareRequest(
        model,
        prompt,
        context,
        systemPrompt,
        options
      );

      // Get endpoint (some providers need API key in URL)
      const endpoint = providerConfig.getEndpoint
        ? providerConfig.getEndpoint(providerConfig.endpoint, apiKey)
        : providerConfig.endpoint;

      console.log(`Sending request to ${provider} (${model}) at ${endpoint}`); // Debug log
      // console.log("Request Body:", JSON.stringify(body, null, 2)); // Be careful logging sensitive data

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
          const errorBody = await response.text();
          console.error(`API Error from ${provider} (${response.status}): ${errorBody}`);
          return { error: true, message: `API request failed with status ${response.status}. ${errorBody}` };
      }

      const result = await response.json();
      console.log(`${provider} API Response:`, result); // Debug log

      // Transform response to standardized format
      return this.normalizeResponse(result, provider);
    } catch (error) {
      console.error(`Error sending message to ${provider}:`, error);
      return { error: true, message: `Network or processing error: ${error instanceof Error ? error.message : String(error)}` };
    }
  },

  // Normalize responses from different providers to a standard format
  normalizeResponse: function(response: any, provider: string): NormalizedAIResponse {
    try {
        if (provider === 'claude') {
        // Claude response format
        if (response.error) {
            return {
            error: true,
            message: response.error.message || 'Unknown Claude API error'
            };
        }
        if (!response.content || !Array.isArray(response.content) || response.content.length === 0 || !response.content[0].text) {
             console.warn("Unexpected Claude response format:", response);
             return { error: true, message: "Invalid response format from Claude." };
        }

        return {
            content: response.content[0].text,
            model: response.model,
            provider: 'claude'
        };
        }
        else if (provider === 'gemini') {
        // Gemini response format
        if (response.error) {
            return {
            error: true,
            message: response.error.message || 'Unknown Gemini API error'
            };
        }
         // Check candidates structure carefully
         if (!response.candidates || !Array.isArray(response.candidates) || response.candidates.length === 0) {
             console.warn("No candidates found in Gemini response:", response);
             // Check for promptFeedback for blockage reasons
             if (response.promptFeedback?.blockReason) {
                 return { error: true, message: `Content blocked by Gemini: ${response.promptFeedback.blockReason}` };
             }
             return { error: true, message: "No candidates in response from Gemini." };
         }
         const candidate = response.candidates[0];
         if (!candidate.content?.parts?.[0]?.text) {
              console.warn("Unexpected Gemini response format (missing text):", response);
              // Check finishReason
              if (candidate.finishReason && candidate.finishReason !== "STOP") {
                 return { error: true, message: `Gemini generation finished unexpectedly: ${candidate.finishReason}` };
              }
              return { error: true, message: "Invalid response format from Gemini (missing text)." };
         }

        return {
            content: candidate.content.parts[0].text,
            // model: candidate.modelName, // Model name might not be directly in candidate
            provider: 'gemini'
        };
        }
    } catch (e) {
         console.error(`Error normalizing response for ${provider}:`, e);
         return { error: true, message: `Failed to process response from ${provider}.` };
    }

    // Unknown provider
    return {
      error: true,
      message: `Unknown provider format: ${provider}`
    };
  },

  // Check if conversations from Claude could be imported
  checkClaudeConversationImport: function() {
    // This is a placeholder for checking if Claude conversations can be imported
    // In reality, this would need to be implemented based on Claude's API capabilities
    return {
      possible: true, // Assume possible for now
      limitations: [
        "Requires user's explicit permission (OAuth or API Key)",
        "Limited to text content; files/images may not transfer",
        "API rate limits might apply during import"
      ],
      importMethod: "Likely requires direct API access with user authentication (not implemented here)"
    };
  }
};

// Example usage (would typically be in a component or another service):
/*
async function exampleChat() {
    if (typeof window !== 'undefined') { // Ensure running client-side
        // Initialize (replace with actual key retrieval mechanism)
        const claudeKey = prompt("Enter Claude API Key:");
        if (claudeKey) {
            const initSuccess = await aiProviderManager.init('claude', claudeKey);
            if (!initSuccess) {
                alert("Failed to initialize Claude API.");
                return;
            }
        } else {
            alert("Claude API Key required.");
            return;
        }

        // Send a message
        try {
            const response = await aiProviderManager.sendMessage(
                "Explain the concept of 'Tawhid' in Islam.",
                [], // No prior context
                "You are a helpful Islamic studies assistant." // System prompt
            );

            if (response.error) {
                alert(`Error: ${response.message}`);
            } else {
                console.log("AI Response:", response.content);
                alert(`Claude says: ${response.content?.substring(0, 100)}...`);
            }
        } catch (error) {
            alert(`An error occurred: ${error}`);
        }
    }
}

// exampleChat(); // Don't run automatically, just for illustration
*/