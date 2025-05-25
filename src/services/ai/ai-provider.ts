// src/services/ai/ai-provider.ts
'use client'; // Marking as client component due to btoa/atob usage

// Minimal type for Genkit-like MessageData parts
interface GenkitPart {
  text?: string;
  media?: { url: string; mimeType?: string };
  // other part types if necessary, e.g., toolRequest, toolResponse
}

// Minimal type for Genkit-like MessageData
interface GenkitMessageData {
  role: 'user' | 'model' | 'system' | 'tool' | 'assistant'; // model/assistant for AI, user for human
  content: GenkitPart[] | string; // Genkit's content is Part[], but some internal uses might pass string.
                                 // The ChatPanel passes GenkitMessageData where content is Part[]
}

// Provider configuration type (can be expanded)
interface ProviderConfig {
  name: string;
  endpoint: string;
  apiVersion?: string;
  latestModel: string;
  alternativeModels?: string[];
  headers: (apiKey: string) => Record<string, string>;
  prepareRequest: (
    model: string,
    prompt: string, // This is the main new user prompt text
    context: GenkitMessageData[], // This is the conversation history
    systemPrompt: string | null,
    options: any
  ) => Record<string, any>;
  getEndpoint?: (endpoint: string, apiKey: string) => string;
}

export const aiProviderManager = {
  providers: {
    claude: {
      name: "Claude (Anthropic)",
      endpoint: "https://api.anthropic.com/v1/messages",
      apiVersion: "2023-06-01",
      latestModel: "claude-3-5-sonnet-20240620",
      alternativeModels: [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307"
      ],
      headers: (apiKey) => ({
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey
      }),
      prepareRequest: (model, prompt, context, systemPrompt, options) => {
        // Claude messages are an array of {role, content: string | Part[]}
        // The prompt is the latest user message. Context is history.
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: "system", content: systemPrompt });
        }
        // Add historical context messages
        context.forEach(msg => {
            messages.push({
                role: msg.role === 'model' ? 'assistant' : msg.role, // Claude uses 'assistant'
                content: typeof msg.content === 'string' ? msg.content : msg.content // Pass Part[] if it is, or string
            });
        });
        // Add current user prompt
        messages.push({ role: "user", content: prompt });

        return {
            model: model,
            max_tokens: options.maxTokens || 4000,
            messages: messages
        };
      }
    } as ProviderConfig,
    gemini: {
      name: "Gemini (Google)",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
      latestModel: "gemini-1.5-pro", // or gemini-pro if 1.5 is not generally available
      alternativeModels: ["gemini-1.0-pro"], // gemini-pro is more common for v1beta
      headers: (apiKey) => ({ // API key is in URL for Gemini
        'Content-Type': 'application/json'
      }),
      prepareRequest: (model, prompt, context, systemPrompt, options) => {
        const contents: any[] = []; // Gemini expects 'contents' array

        // System prompt handling for Gemini is typically at the top level for some models
        // or as the first 'user' turn with a 'system' instruction for multi-turn.
        // For multi-turn via `generateContent`, it's part of the `contents` array.
        if (systemPrompt) {
          contents.push({
            role: "user", // Often, system instructions are prepended to the first user message or handled by a specific "system" role if the model supports it explicitly in contents.
                          // For simplicity, let's assume it's a user message or that the model handles a 'system' role here.
                          // If gemini-pro/v1beta requires system instruction differently, this might need adjustment.
            parts: [{ text: systemPrompt }] // Or use {role: "system", parts: [{text: systemPrompt}]} if model supports
          });
        }

        context.forEach(msg => {
          // msg.content for GenkitMessageData is GenkitPart[]
          // Ensure parts are correctly formatted from GenkitMessageData.content
          let partsForMsg: GenkitPart[];
          if (typeof msg.content === 'string') {
            partsForMsg = [{ text: msg.content }];
          } else {
            partsForMsg = msg.content;
          }
          contents.push({
            role: msg.role === 'assistant' ? 'model' : msg.role, // Gemini uses 'model' for AI
            parts: partsForMsg
          });
        });

        // Add current user prompt
        contents.push({
          role: "user",
          parts: [{ text: prompt }]
        });

        return {
          contents,
          generationConfig: {
            maxOutputTokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.7
            // safetySettings: options.safetySettings || defaultSafetySettings (if any)
          }
        };
      },
      getEndpoint: (endpoint, apiKey) => `${endpoint}?key=${apiKey}`
    } as ProviderConfig,
  },

  activeProvider: 'claude',
  apiKeys: {} as Record<string, string>, // Stores encrypted keys

  init: function(provider: string, apiKey: string): Promise<boolean> {
    if (!this.providers[provider]) {
      console.error(`Provider ${provider} not supported`);
      return Promise.resolve(false);
    }
    this.activeProvider = provider;
    this.apiKeys[provider] = this.encryptKey(apiKey);
    console.log(`AI Provider initialized: ${provider}.`);
    return this.testConnection(provider);
  },

  switchProvider: function(provider: string): boolean {
    if (!this.providers[provider]) {
      console.warn(`Attempted to switch to unsupported provider: ${provider}`);
      return false;
    }
    if (!this.apiKeys[provider]) {
      console.warn(`API key for ${provider} not found. Cannot switch.`);
      // Optionally: Trigger UI to ask for key
      return false;
    }
    this.activeProvider = provider;
    console.log(`Switched active AI provider to: ${provider}`);
    return true;
  },

  encryptKey: function(key: string): string {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      try {
        return btoa(key);
      } catch (e) {
        console.error("Error in btoa:", e);
        return key;
      }
    }
    return key; // Fallback for non-browser env
  },

  decryptKey: function(encryptedKey: string): string {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      try {
        return atob(encryptedKey);
      } catch (e) {
        console.error("Error in atob:", e);
        return encryptedKey;
      }
    }
    return encryptedKey; // Fallback
  },

  testConnection: async function(providerId: string | null = null): Promise<boolean> {
    const testProvider = providerId || this.activeProvider;
    if (!this.providers[testProvider]) {
        console.error(`Test Connection: Provider ${testProvider} not supported.`);
        return false;
    }
    if (!this.apiKeys[testProvider]) {
      console.warn(`Test Connection: API key for ${testProvider} not found.`);
      return false;
    }
    try {
      console.log(`Testing connection for ${testProvider}...`);
      const response = await this.sendMessage(
        "Test connection",
        [],
        "This is a test message. Please respond with 'Connection successful.'",
        { provider: testProvider }
      );
      console.log(`Test connection response for ${testProvider}:`, response);
      
      const success = response && !response.error && response.content && typeof response.content === 'string' && response.content.toLowerCase().includes('connection successful');
       if (!success) {
         console.warn(`${testProvider} API connection test did not return expected 'Connection successful.' Response:`, response);
       }
      return success;
    } catch (error) {
      console.error(`${testProvider} API connection failed during test:`, error);
      return false;
    }
  },

  sendMessage: async function(
    prompt: string,
    context: GenkitMessageData[] = [],
    systemPrompt: string | null = null,
    options: any = {} // Can include { provider, model, maxTokens, temperature }
  ): Promise<{ content?: string; model?: string; provider?: string; error?: boolean; message?: string }> {
    const providerId = options.provider || this.activeProvider;
    const providerConfig = this.providers[providerId];

    if (!providerConfig) {
      console.error(`Send Message: Provider ${providerId} not supported.`);
      return { error: true, message: `Provider ${providerId} not supported.` };
    }

    if (!this.apiKeys[providerId]) {
        console.error(`Send Message: No API key found for ${providerId}.`);
        return { error: true, message: `API key for ${providerId} is missing. Please set it up.` };
    }
    const apiKey = this.decryptKey(this.apiKeys[providerId]);
     if (!apiKey) {
        console.error(`Send Message: API key for ${providerId} could not be decrypted or is invalid.`);
        return { error: true, message: `API key for ${providerId} is invalid or could not be decrypted.` };
    }

    try {
      const model = options.model || providerConfig.latestModel;
      const headers = providerConfig.headers(apiKey);
      // Context here is GenkitMessageData[] where content is Part[]
      // prepareRequest for Claude expects content to be string or Part[]
      // prepareRequest for Gemini expects content to be Part[]
      const body = providerConfig.prepareRequest(
        model,
        prompt,
        context, 
        systemPrompt,
        options
      );

      const endpoint = providerConfig.getEndpoint
        ? providerConfig.getEndpoint(providerConfig.endpoint, apiKey)
        : providerConfig.endpoint;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => response.text());
        console.error(`API Error from ${providerId} (${response.status}):`, errorBody);
        const message = typeof errorBody === 'string' ? errorBody : (errorBody?.error?.message || JSON.stringify(errorBody));
        return { error: true, message: `API request failed with status ${response.status}. Details: ${message}` };
      }
      
      const result = await response.json();
      return this.normalizeResponse(result, providerId);

    } catch (error: any) {
      console.error(`Error sending message to ${providerId}:`, error);
      return { error: true, message: `Network error or CORS issue. ${error.message || ''}` };
    }
  },

  normalizeResponse: function(
    response: any,
    provider: string
  ): { content?: string; model?: string; provider?: string; error?: boolean; message?: string } {
    const providerConfig = this.providers[provider];
    if (provider === 'claude') {
      if (response.error) {
        return { error: true, message: response.error.message || "Unknown Claude API error" };
      }
      if (!response.content || !Array.isArray(response.content) || response.content.length === 0 || typeof response.content[0].text !== 'string') {
        console.warn("Unexpected Claude response format:", response);
        return { error: true, message: "Malformed response from Claude API." };
      }
      return {
        content: response.content[0].text,
        model: response.model,
        provider: 'claude'
      };
    }
    else if (provider === 'gemini') {
      if (response.error) {
        return { error: true, message: response.error.message || "Unknown Gemini API error"};
      }
      if (!response.candidates || !Array.isArray(response.candidates) || response.candidates.length === 0) {
        console.warn("Unexpected Gemini response format (no candidates):", response);
        return { error: true, message: "Malformed response from Gemini API (no candidates)." };
      }
      const candidate = response.candidates[0];
      if (!candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0 || typeof candidate.content.parts[0].text !== 'string') {
        console.warn("Unexpected Gemini response format (no text part):", response);
         if (candidate.finishReason === "SAFETY" && candidate.safetyRatings) {
          const safetyIssues = candidate.safetyRatings.filter((r: any) => r.probability !== "NEGLIGIBLE" && r.blocked).map((r: any) => r.category).join(', ');
          return { error: true, message: `Content blocked by Gemini due to safety reasons: ${safetyIssues || 'Unspecified safety concern'}` };
        }
        return { error: true, message: "Malformed response from Gemini API (no text part)." };
      }
      return {
        content: candidate.content.parts[0].text,
        model: providerConfig.latestModel, // Use the model we requested
        provider: 'gemini'
      };
    }
    return { error: true, message: `Unknown provider format: ${provider}` };
  },

  checkClaudeConversationImport: function() { // This is hypothetical
    return {
      possible: true,
      limitations: [
        "User's explicit permission required",
        "Only user's own conversations",
        "Text content only"
      ],
      importMethod: "Direct API access with user authentication (not implemented)"
    };
  }
};
