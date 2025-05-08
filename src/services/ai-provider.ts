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
        // Claude uses 'system' parameter directly, not in messages array
        system: systemPrompt || undefined, // Add system prompt here if provided
        messages: [
          // ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []), // Remove system prompt from messages for Claude v1 API
          ...context.filter(msg => msg.role === 'user' || msg.role === 'assistant'), // Only include user/assistant messages
          { role: "user", content: prompt }
        ]
      })
    } as AIProviderConfig, // Added type assertion
    gemini: {
      name: "Gemini (Google)",
      // Endpoint needs model name, will be constructed in getEndpoint
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
      latestModel: "gemini-1.5-pro",
      alternativeModels: ["gemini-1.0-pro"],
      headers: (apiKey: string) => ({ // API key is usually passed in URL for Gemini
        'Content-Type': 'application/json'
      }),
      prepareRequest: (model: string, prompt: string, context: MessageContext[], systemPrompt: string | null, options: AIRequestOptions) => {
        // Combine context and new prompt into Gemini format
        const contents = [];

        // Gemini API uses a different structure, often less explicit about system prompts
        // We can prepend the system prompt to the first user message or handle it if the model supports specific instructions
        let currentPrompt = prompt;
        if (systemPrompt && context.length === 0) {
            // If no context, prepend system prompt to the user prompt for Gemini
            // This is a common workaround, actual support varies by model version
             contents.push({ role: "user", parts: [{ text: systemPrompt + "\n\n" + prompt }] });
        } else {
             // Process context and the final prompt
            for (const msg of context) {
                 // Gemini uses 'model' for assistant role
                if (msg.role === 'user' || msg.role === 'assistant') {
                     contents.push({
                        role: msg.role === "assistant" ? "model" : "user",
                        parts: [{ text: msg.content }]
                     });
                }
                 // Ignore 'system' messages in context for Gemini's format here
            }
             // Add current user prompt
            contents.push({
                role: "user",
                parts: [{ text: currentPrompt }]
            });
        }


        return {
          contents,
          // Include system instruction if model supports it (e.g., Gemini 1.5)
          ...(systemPrompt && model.startsWith("gemini-1.5") && {
              systemInstruction: {
                  role: "system", // Assuming 'system' role is accepted by 1.5 API
                  parts: [{ text: systemPrompt }]
              }
          }),
          generationConfig: {
            maxOutputTokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.7
          }
        };
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
    console.log(`AI Provider initialized: ${provider}`);
    // Test connection might be too slow for init, consider doing it separately
    // return await this.testConnection(provider);
    return true; // Assume success if key is stored
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
      console.log(`Testing connection to ${testProvider}...`);
      const response = await this.sendMessage(
        "Test connection",
        [], // No context
        "This is a test message. Please respond with 'Connection successful.'", // System prompt
        { provider: testProvider, maxTokens: 50 } // Options object, limit tokens
      );

      // Check for successful response (adjust based on normalized format)
      console.log(`${testProvider} test response:`, response);
      const success = response && !response.error && response.content?.includes('Connection successful');
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
        ? providerConfig.getEndpoint(providerConfig.endpoint, apiKey, model) // Pass model
        : providerConfig.endpoint;

      console.log(`Sending request to ${provider} (${model}) at ${endpoint}`); // Debug log
      // console.log("Request Body:", JSON.stringify(body, null, 2)); // Be careful logging sensitive data

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const responseBodyText = await response.text(); // Read body once

      if (!response.ok) {
          console.error(`API Error from ${provider} (${response.status}): ${responseBodyText}`);
          return { error: true, message: `API request failed with status ${response.status}. ${responseBodyText}` };
      }

      let result;
      try {
          result = JSON.parse(responseBodyText); // Parse the text body
      } catch (parseError) {
          console.error(`Failed to parse JSON response from ${provider}:`, parseError);
          console.error("Raw response body:", responseBodyText);
          return { error: true, message: `Invalid JSON response received from ${provider}.` };
      }

      console.log(`${provider} API Response JSON:`, result); // Debug log of parsed JSON

      // Transform response to standardized format
      return this.normalizeResponse(result, provider, model); // Pass model for normalization context
    } catch (error) {
      console.error(`Error sending message to ${provider}:`, error);
      return { error: true, message: `Network or processing error: ${error instanceof Error ? error.message : String(error)}` };
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
             // Ensure content and parts exist before accessing text
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
                model: modelUsed || 'gemini', // Model name might not be directly in candidate, use the requested one
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
            // Optionally test connection after init
             await aiProviderManager.testConnection('claude');

        } else {
            alert("Claude API Key required.");
            return;
        }

        // Send a message
        try {
            console.log("Sending message to AI...");
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
             const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Error during sendMessage:", errorMessage);
            alert(`An error occurred: ${errorMessage}`);
        }
    }
}

// exampleChat(); // Don't run automatically, just for illustration
*/

    