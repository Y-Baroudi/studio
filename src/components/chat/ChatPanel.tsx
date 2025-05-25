
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { chat, type ChatInput, type ChatOutput } from '@/ai/flows/chat-flow';
import type { Verse } from '@/services/alquran-cloud';
import type { MessageData } from 'genkit';
import { Loader2, Send, CornerDownLeft, HelpCircle, MessageSquarePlus, Brain } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { scholarPersonaManager } from '@/services/ai/scholarPersonaManager';
import { aiProviderManager } from '@/services/ai/ai-provider';
import { ApiKeyManager } from '@/components/chat/ApiKeyManager'; // Import ApiKeyManager
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface ChatPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  verseContext: Verse | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: Date;
}

const MAX_HISTORY_LENGTH = 20; // Keep last N messages for context

// Function to generate a unique key for localStorage based on context
const getStorageKey = (verseCtx: Verse | null): string => {
  if (verseCtx) {
    return verseCtx.verseNumber === 0
      ? `chatHistory_concept_${verseCtx.surah?.englishName.replace(/\s+/g, '_')}`
      : `chatHistory_verse_${verseCtx.verseNumber}`;
  }
  return 'chatHistory_general';
};

export function ChatPanel({ isOpen, onOpenChange, verseContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activePersona, setActivePersona] = useState(scholarPersonaManager.getActivePersona());
  const [currentProvider, setCurrentProvider] = useState(aiProviderManager.activeProvider);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [providerForApiKeyModal, setProviderForApiKeyModal] = useState<string | null>(null);
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);

  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages]);

  // Load persona and chat history on open or context change
  useEffect(() => {
    if (isOpen) {
      scholarPersonaManager.loadPersonas(); // Ensure personas are loaded
      const currentPersona = scholarPersonaManager.getActivePersona();
      setActivePersona(currentPersona);
      setCurrentProvider(aiProviderManager.activeProvider); // Sync provider display

      const storageKey = getStorageKey(verseContext);
      const storedMessagesJson = localStorage.getItem(storageKey);
      const storedMessages: Message[] = storedMessagesJson ? JSON.parse(storedMessagesJson) : [];

      let initialMessages: Message[] = [];
      let introContent = "Welcome! How can I help you reflect today?";
      if (verseContext) {
        introContent = verseContext.verseNumber === 0
          ? `Let's discuss the concept: ${verseContext.surah?.englishName}.`
          : `Starting conversation about Surah ${verseContext.surah?.number}:${verseContext.ayahNumberInSurah} (${verseContext.surah?.englishName}).`;
      }
      
      initialMessages.push({
        id: 'system-intro-' + Date.now(),
        role: 'system',
        content: introContent,
        timestamp: new Date()
      });

      if (storedMessages.length > 0) {
        // Filter out any old system intro messages if they exist in storage
        const userAndAssistantMessages = storedMessages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
        initialMessages = [...initialMessages, ...userAndAssistantMessages];
      }
      
      setMessages(initialMessages);
      setInputMessage('');

      // Generate conversation starters
      if (verseContext && verseContext.surah) {
        const starters = [
          `What are the main themes of Surah ${verseContext.surah.englishName}?`,
          `How can I apply the lessons from ${verseContext.verseNumber === 0 ? `the concept of ${verseContext.surah.englishName}` : `verse ${verseContext.surah.number}:${verseContext.ayahNumberInSurah}`} to my daily life?`,
        ];
        if (verseContext.verseNumber !== 0) {
          starters.push(`Can you explain the context of revelation for Surah ${verseContext.surah.number}:${verseContext.ayahNumberInSurah}?`);
        }
        setConversationStarters(starters);
      } else {
        setConversationStarters([
            "What is the meaning of Tawhid (توحيد)?",
            "Can you explain the concept of Ihsan (إحسان)?",
            "What are some practical ways to increase Khushu' (خشوع) in Salah (صلاة)?",
        ]);
      }


    } else {
      setMessages([]);
      setConversationStarters([]);
    }
  }, [isOpen, verseContext]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const storageKey = getStorageKey(verseContext);
      // Persist only user and assistant messages, system intro is dynamic
      const messagesToStore = messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
      localStorage.setItem(storageKey, JSON.stringify(messagesToStore));
    }
  }, [messages, isOpen, verseContext]);


  const handleSendMessage = async (messageContent?: string) => {
    const currentInput = messageContent || inputMessage;
    if (!currentInput.trim() || isLoading || !user || !activePersona) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    if (!messageContent) { // Clear input only if not from a starter
        setInputMessage('');
    }
    setIsLoading(true);

    const conversationHistory: MessageData[] = messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant') // only user/assistant for history
      .slice(-MAX_HISTORY_LENGTH) // Take last N messages
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role, // Genkit uses 'model' for assistant
        content: [{ text: msg.content }]
      }));
    
    // Add the new user message to the history being sent
    conversationHistory.push({role: 'user', content: [{text: newUserMessage.content}]});

    let systemPrompt = activePersona.systemPrompt;
    if (verseContext) {
      systemPrompt += "\n\n## Current Context for Discussion:\n";
      if (verseContext.verseNumber === 0) {
        systemPrompt += `The user is particularly interested in the Islamic concept: **${verseContext.surah?.englishName}**. Description: "${verseContext.englishTranslation}". Please focus your response on this concept in relation to the user's query.`;
      } else {
        systemPrompt += `The user is asking about Surah ${verseContext.surah?.number}:${verseContext.ayahNumberInSurah} (${verseContext.surah?.englishName}).\nArabic Text: "${verseContext.arabicText}"\nEnglish Translation: "${verseContext.englishTranslation}".\nPlease use this verse as the primary context for your response.`;
      }
    }
     systemPrompt += `\n\n## Persona Reminders:\n- You are ${activePersona.name} (${activePersona.nameArabic}).\n- Reference your core concepts: ${Object.values(activePersona.concepts).map(c => c.name).join(', ')} where appropriate.`;


    try {
      const chatInput: ChatInput = {
        message: currentInput,
        context: conversationHistory,
        systemPrompt: systemPrompt,
      };
      
      // Use aiProviderManager to send message
      const aiResponse = await aiProviderManager.sendMessage(
        chatInput.message,
        chatInput.context as MessageData[], // Cast as MessageData[]
        chatInput.systemPrompt,
        { provider: currentProvider } // Specify current provider
      );

      if (aiResponse.error) {
        throw new Error(aiResponse.message || "AI provider returned an error.");
      }

      const newAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.content || "Sorry, I couldn't generate a response.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newAiMessage]);
    } catch (error: any) {
      console.error("Error sending message to AI:", error);
      const errorMessageContent = error.message?.includes("API key") 
        ? `There was an issue with the API key for ${currentProvider}. Please check your settings.`
        : "Sorry, I encountered an error processing your request. Please try again.";
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'error', // Use 'error' role for styling
        content: errorMessageContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      if (error.message?.includes("API key") && providerForApiKeyModal !== currentProvider) {
        setProviderForApiKeyModal(currentProvider);
        setIsApiKeyModalOpen(true);
      }
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  const handleProviderChange = async (newProvider: string) => {
    if (!aiProviderManager.providers[newProvider]) {
      toast({ title: "Error", description: `Provider ${newProvider} is not supported.`, variant: "destructive" });
      return;
    }

    // Check if API key exists for the new provider
    if (!aiProviderManager.apiKeys[newProvider]) {
      toast({ title: "API Key Needed", description: `Please set up the API key for ${aiProviderManager.providers[newProvider].name}.`, variant: "default" });
      setProviderForApiKeyModal(newProvider);
      setIsApiKeyModalOpen(true);
      // Don't switch yet, wait for key setup
      return;
    }
    
    // Attempt to switch provider
    const switched = aiProviderManager.switchProvider(newProvider);
    if (switched) {
      setCurrentProvider(newProvider);
      // Test connection silently or provide feedback
      const connected = await aiProviderManager.testConnection(newProvider);
      if (connected) {
        toast({ title: "Provider Switched", description: `Now using ${aiProviderManager.providers[newProvider].name}.` });
      } else {
        toast({ title: "Connection Failed", description: `Could not connect to ${aiProviderManager.providers[newProvider].name}. Check API key.`, variant: "destructive"});
        setProviderForApiKeyModal(newProvider);
        setIsApiKeyModalOpen(true);
      }
    } else {
       toast({ title: "Switch Failed", description: `Could not switch to ${aiProviderManager.providers[newProvider].name}.`, variant: "destructive"});
    }
  };
  
  const handleApiKeySaved = (provider: string) => {
    aiProviderManager.switchProvider(provider); // Ensure it's active
    setCurrentProvider(provider);
    toast({ title: "API Key Saved", description: `API key for ${aiProviderManager.providers[provider].name} saved and tested.` });
  };


  if (authLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col p-0" side="right">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>Chat with {activePersona?.name || "AI Scholar"}</SheetTitle>
          </SheetHeader>
          <div className="flex-grow flex items-center justify-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!user && !authLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col p-0" side="right">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>Chat with {activePersona?.name || "AI Scholar"}</SheetTitle>
            <SheetDescription>AI-powered reflections and discussions.</SheetDescription>
          </SheetHeader>
          <div className="p-6 text-center flex-grow flex flex-col items-center justify-center">
            <p className="mb-4 text-muted-foreground">Please log in to use the AI chat feature.</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col p-0" side="right">
          <SheetHeader className="p-6 pb-4 border-b">
            <div className="flex justify-between items-center">
              <SheetTitle>Chat with {activePersona?.name || "AI Scholar"}</SheetTitle>
              <select
                value={currentProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="text-xs p-1 border rounded bg-background text-foreground"
                aria-label="Select AI Provider"
              >
                {Object.entries(aiProviderManager.providers).map(([key, providerDetails]) => (
                  <option key={key} value={key}>{providerDetails.name}</option>
                ))}
              </select>
            </div>
            <SheetDescription>
              {verseContext?.verseNumber === 0
                ? `Discussing: ${verseContext?.surah?.englishName}`
                : verseContext
                ? `S. ${verseContext?.surah?.number}:${verseContext?.ayahNumberInSurah} (${verseContext?.surah?.englishNameShort || verseContext?.surah?.englishName})`
                : "General Discussion"}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-grow p-6">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`p-3 rounded-lg max-w-[85%] text-sm whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : msg.role === 'system'
                        ? 'italic text-muted-foreground text-xs w-full text-center bg-transparent p-1'
                        : msg.role === 'error'
                        ? 'bg-destructive text-destructive-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {conversationStarters.length > 0 && messages.filter(m => m.role === 'user' || m.role === 'assistant').length === 0 && (
            <div className="p-4 border-t">
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Conversation Starters:</h4>
              <div className="flex flex-wrap gap-2">
                {conversationStarters.map((starter, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-1 px-2"
                    onClick={() => handleSendMessage(starter)}
                  >
                    <MessageSquarePlus className="mr-1.5 h-3 w-3" /> {starter}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <SheetFooter className="p-4 border-t bg-background">
            <div className="flex gap-2 w-full items-end">
              <Textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                className="min-h-[40px] max-h-[120px] resize-none text-sm py-2"
                rows={1}
              />
              <Button onClick={() => handleSendMessage()} disabled={isLoading || !inputMessage.trim()} className="h-10 w-10 p-0">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {providerForApiKeyModal && (
        <ApiKeyManager
          isOpen={isApiKeyModalOpen}
          onOpenChange={setIsApiKeyModalOpen}
          providerId={providerForApiKeyModal}
          onApiKeySaved={handleApiKeySaved}
        />
      )}
    </>
  );
}

