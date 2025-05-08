// src/services/ai-provider.ts
'use client'; // Indicate client-side logic due to localStorage usage

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
  getEndpoint?: (endpoint: string, apiKey: string, model: string) => string; // Optional for providers needing key in URL, added model
}

interface AIRequestOptions {
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  // Add other provider-specific options if needed
}

// Use roles consistent with Claude and OpenAI 'user', 'assistant', 'system'
export interface MessageContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface NormalizedAIResponse {
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
      latestModel: "claude-3-5-sonnet-20240620", // Latest as of June 2024
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
      prepareRequest: (model: string, prompt: string, context: MessageContext[], systemPrompt: string | null, options: AIRequestOptions) => {
        // Ensure context messages have valid roles
        const validContext = context.filter(msg => msg.role === 'user' || msg.role === 'assistant');

        return {
            model: model,
            max_tokens: options.maxTokens || 4000,
            // Claude uses 'system' parameter directly
            system: systemPrompt || undefined,
            messages: [
                 // Messages array should alternate user/assistant roles
                ...validContext,
                { role: "user", content: prompt }
            ]
        };
      }
    } as AIProviderConfig, // Added type assertion
    gemini: {
      name: "Gemini (Google)",
      // Base endpoint, model and action appended later
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
      latestModel: "gemini-1.5-pro",
      alternativeModels: ["gemini-1.0-pro"],
      headers: (apiKey: string) => ({ // API key is usually passed in URL for Gemini
        'Content-Type': 'application/json'
      }),
      prepareRequest: (model: string, prompt: string, context: MessageContext[], systemPrompt: string | null, options: AIRequestOptions) => {
        // Combine context and new prompt into Gemini format
        const contents = [];

        // Process context and the final prompt
        for (const msg of context) {
            // Gemini uses 'model' for assistant role
            if (msg.role === 'user' || msg.role === 'assistant') {
                 contents.push({
                    role: msg.role === "assistant" ? "model" : "user",
                    parts: [{ text: msg.content }]
                 });
            }
            // Handle system messages in context if needed, e.g., prepend to next user message
        }
         // Add current user prompt
        contents.push({
            role: "user",
            parts: [{ text: prompt }]
        });

        // System instructions should be handled at the top level for Gemini 1.5+
        const requestBody: Record<string, any> = {
          contents,
          generationConfig: {
            maxOutputTokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.7
          }
        };

        // Include system instruction if model supports it (e.g., Gemini 1.5) and prompt provided
        if (systemPrompt && model.includes("gemini-1.5")) { // Check model name for 1.5 capability
            requestBody.systemInstruction = {
                 // Gemini system instruction uses 'user' role within the object
                 role: "user", // This seems odd but matches Gemini examples
                 parts: [{ text: systemPrompt }]
            };
        }

        return requestBody;
      },
      // For Gemini API, construct endpoint with model and append key as query parameter
      getEndpoint: (baseEndpoint: string, apiKey: string, model: string) => {
         // Use the provided model in the endpoint path
         const effectiveEndpoint = `${baseEndpoint}/${model}:generateContent`;
         return `${effectiveEndpoint}?key=${apiKey}`;
      }
    } as AIProviderConfig // Added type assertion
  },

  activeProvider: 'claude', // Default provider
  apiKeys: {} as Record<string, string>, // Store encrypted keys (client-side only)

  // Initialize AI provider (call this from client-side component)
  init: async function(provider: string, apiKey: string): Promise<boolean> {
    if (!this.providers[provider as keyof typeof this.providers]) {
      console.error(`Provider ${provider} not supported`);
      return false;
    }
    if (typeof window === 'undefined') {
       console.warn("Cannot initialize AI provider on server.");
       return false;
    }

    // Store encrypted key immediately
    this.apiKeys[provider] = this.encryptKey(apiKey);
    localStorage.setItem(`ai_key_${provider}`, this.encryptKey(apiKey)); // Persist encrypted key

    // Check if the provider being initialized is the current active one
    // If not, switch to it before testing connection
    if (this.activeProvider !== provider) {
        console.log(`Initializing ${provider}, setting as active.`);
        this.activeProvider = provider;
        localStorage.setItem('ai_active_provider', provider); // Persist active provider choice
    }

    console.log(`AI Provider initialized: ${provider}`);
    // Test connection AFTER setting the key and potentially switching
    return await this.testConnection(provider);
  },

  // Load keys from localStorage on startup (call from client-side)
  loadKeysFromStorage: function() {
     if (typeof window === 'undefined') return;
     Object.keys(this.providers).forEach(provider => {
        const storedKey = localStorage.getItem(`ai_key_${provider}`);
        if (storedKey) {
            this.apiKeys[provider] = storedKey; // Load encrypted key
        }
     });
     // Optionally set active provider based on storage or default
     const storedActive = localStorage.getItem('ai_active_provider');
     if (storedActive && this.providers[storedActive as keyof typeof this.providers] && this.apiKeys[storedActive]) {
         this.activeProvider = storedActive;
     } else if (!this.apiKeys[this.activeProvider]) {
         // Fallback if default provider has no key
         const firstProviderWithKey = Object.keys(this.apiKeys)[0];
         if (firstProviderWithKey) {
             this.activeProvider = firstProviderWithKey;
         } else {
             // If no keys loaded at all, keep the default but it won't work
             this.activeProvider = 'claude';
         }
     }
     console.log("AI Keys loaded from storage. Active provider:", this.activeProvider);
  },

  // Switch active provider
  switchProvider: function(provider: string): boolean {
     if (typeof window === 'undefined') return false;
    if (!this.providers[provider as keyof typeof this.providers]) {
      console.error(`Provider ${provider} not supported`);
      return false;
    }

    if (!this.apiKeys[provider]) {
      console.warn(`No API key set for provider ${provider}. Cannot switch.`);
      // Let the UI handle prompting for the key
      return false;
    }

    this.activeProvider = provider;
    localStorage.setItem('ai_active_provider', provider); // Persist active provider choice
    console.log(`Switched active AI provider to: ${provider}`);
    return true;
  },

  // Simple encryption for API keys (Use a more secure method in production)
  encryptKey: function(key: string): string {
    if (typeof window !== 'undefined' && typeof btoa === 'function') {
       try {
        // Basic shift cipher + Base64 for obscurity (NOT real security)
        const shifted = key.split('').map(char => String.fromCharCode(char.charCodeAt(0) + 3)).join('');
        return btoa(shifted);
       } catch (e) {
         console.error("Error during key encryption:", e);
         return ""; // Handle potential errors
       }
    }
    return ""; // Return empty string or handle server-side appropriately
  },

  // Simple decryption for API keys
  decryptKey: function(encryptedKey: string): string {
     if (typeof window !== 'undefined' && typeof atob === 'function') {
        try {
            // Basic shift cipher + Base64 for obscurity (NOT real security)
            const base64Decoded = atob(encryptedKey);
            return base64Decoded.split('').map(char => String.fromCharCode(char.charCodeAt(0) - 3)).join('');
        } catch (e) {
         console.error("Error during key decryption:", e);
          return ""; // Handle potential errors
        }
     }
     return ""; // Return empty string or handle server-side appropriately
  },

  // Test connection to active AI provider
  testConnection: async function(provider: string | null = null): Promise<boolean> {
    const testProvider = provider || this.activeProvider;
     if (typeof window === 'undefined') return false; // Cannot test on server

    const encryptedApiKey = this.apiKeys[testProvider];
    if (!encryptedApiKey) {
        console.warn(`No API key available for ${testProvider}, cannot test connection.`);
        return false;
    }

    try {
      console.log(`Testing connection to ${testProvider}...`);
      const response = await this.sendMessage(
        "Test connection", // Simple prompt
        [], // No context
        "You are a connection testing bot. Respond only with the exact text 'Connection successful.' if you receive this message.", // System prompt
        { provider: testProvider, maxTokens: 50 } // Options object, limit tokens
      );

      // Check for successful response
      console.log(`${testProvider} test response:`, response);
      const success = response && !response.error && response.content?.trim() === 'Connection successful.';
      console.log(`${testProvider} connection test ${success ? 'successful' : 'failed'}`);
      return success;
    } catch (error) {
      console.error(`${testProvider} API connection failed during test:`, error);
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
        return { error: true, message: `API key not configured for ${provider}. Please add it in settings.` };
    }
    const apiKey = this.decryptKey(encryptedApiKey);
     if (!apiKey) { // Check if decryption failed
        return { error: true, message: `Failed to decrypt API key for ${provider}` };
     }

    let endpoint: string | undefined = undefined; // Define endpoint variable here to be accessible in catch block
    const model = options.model || providerConfig.latestModel; // Define model here

    try {
      const headers = providerConfig.headers(apiKey);
      const body = providerConfig.prepareRequest(
        model,
        prompt,
        context,
        systemPrompt,
        options
      );

      // Get endpoint (some providers need API key in URL)
      endpoint = providerConfig.getEndpoint
        ? providerConfig.getEndpoint(providerConfig.endpoint, apiKey, model) // Pass model
        : providerConfig.endpoint;

      // --- Add Logging ---
      console.log(`Sending request to ${provider} (${model})`);
      console.log(`Endpoint: ${endpoint}`);
      // console.log("Headers:", headers); // Avoid logging key
      // console.log("Request Body:", JSON.stringify(body, null, 2));
      // --- End Logging ---

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const responseBodyText = await response.text(); // Read body once

      if (!response.ok) {
          console.error(`API Error from ${provider} (${response.status}): ${responseBodyText}`);
          // Try parsing error messages from known structures
          let errorDetail = `API request failed with status ${response.status}.`;
          try {
              const errorJson = JSON.parse(responseBodyText);
              if (provider === 'claude' && errorJson.error?.message) {
                  errorDetail = errorJson.error.message;
              } else if (provider === 'gemini' && errorJson.error?.message) {
                  errorDetail = errorJson.error.message;
              } else {
                   errorDetail += ` Response: ${responseBodyText}`;
              }
          } catch {
              errorDetail += ` Response: ${responseBodyText}`;
          }
          return { error: true, message: errorDetail };
      }

      let result;
      try {
          result = JSON.parse(responseBodyText); // Parse the text body
      } catch (parseError) {
          console.error(`Failed to parse JSON response from ${provider}:`, parseError);
          console.error("Raw response body:", responseBodyText);
          return { error: true, message: `Invalid JSON response received from ${provider}.` };
      }

      // console.log(`${provider} API Response JSON:`, result); // Debug log of parsed JSON

      // Transform response to standardized format
      return this.normalizeResponse(result, provider, model); // Pass model for normalization context
    } catch (error) {
      console.error(`Error sending message to ${provider}:`, error);
      // Add more detail to the error message if possible
      let detailedErrorMessage = `Network error or processing error while contacting ${provider}.`;
      if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
          detailedErrorMessage = `Failed to fetch from ${provider}. Check network connectivity, CORS policy, or the endpoint URL (${endpoint || 'N/A'}).`; // Include endpoint if available
      } else if (error instanceof Error) {
          detailedErrorMessage = `Error during ${provider} request: ${error.message}`;
      }
      console.error("Detailed fetch error context:", { provider, endpoint: endpoint || 'N/A', model, systemPromptProvided: !!systemPrompt }); // Log context including endpoint
      return { error: true, message: detailedErrorMessage }; // Return the more detailed message
    }
  },

  // Normalize responses from different providers to a standard format
  normalizeResponse: function(response: any, provider: string, modelUsed?: string): NormalizedAIResponse {
    try {
        if (provider === 'claude') {
            // Claude response format (v1 Messages API)
            if (response.error) {
                return {
                error: true,
                message: response.error.message || 'Unknown Claude API error'
                };
            }
            // Claude's response is in response.content[0].text
            if (!response.content || !Array.isArray(response.content) || response.content.length === 0 || typeof response.content[0].text !== 'string') { // Added type check
                 console.warn("Unexpected Claude response format:", response);
                 return { error: true, message: "Invalid response format from Claude." };
            }

            return {
                content: response.content[0].text,
                model: response.model || modelUsed || 'claude',
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
             // Ensure content and parts exist before accessing text
             if (!candidate.content?.parts?.[0]?.text || typeof candidate.content.parts[0].text !== 'string') { // Added type check
                  console.warn("Unexpected Gemini response format (missing text):", response);
                  // Check finishReason
                  if (candidate.finishReason && candidate.finishReason !== "STOP") {
                     return { error: true, message: `Gemini generation finished unexpectedly: ${candidate.finishReason}` };
                  }
                  return { error: true, message: "Invalid response format from Gemini (missing text)." };
             }

            return {
                content: candidate.content.parts[0].text,
                model: modelUsed || 'gemini-pro', // Model name might not be directly in candidate, use the requested one or default
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
        aiProviderManager.loadKeysFromStorage(); // Load keys on app start

        // Check if a key exists for the active provider
        if (!aiProviderManager.apiKeys[aiProviderManager.activeProvider]) {
            alert(`API key for ${aiProviderManager.activeProvider} needed. Please configure it.`);
            // Potentially trigger a UI element to ask for the key
            // Example: apiKeyManager.promptForKey(aiProviderManager.activeProvider);
            return; // Stop if no key
        }


        // Send a message
        try {
            console.log(`Sending message to ${aiProviderManager.activeProvider}...`);
            const response = await aiProviderManager.sendMessage(
                "Explain the concept of 'Tawhid' in Islam.",
                [], // No prior context
                "You are a helpful Islamic studies assistant." // System prompt
            );

            if (response.error) {
                alert(`Error: ${response.message}`);
            } else {
                console.log("AI Response:", response.content);
                alert(`${aiProviderManager.activeProvider} says: ${response.content?.substring(0, 100)}...`);
            }
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Error during sendMessage:", errorMessage);
            alert(`An error occurred: ${errorMessage}`);
        }
    }
}

// exampleChat(); // Don't run automatically, just for illustration
*/

