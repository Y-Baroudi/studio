// src/components/chat/ChatPanel.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription, // Consider if needed
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, Settings, Bot, User, X } from 'lucide-react';
import { scholarPersonaManager, type Persona } from '@/services/persona-manager';
import { aiProviderManager, type MessageContext, type NormalizedAIResponse } from '@/services/ai-provider';
import { getConversationHistory, saveConversationHistory, type HistoryMessage } from '@/services/conversation-history';
import { useToast } from '@/hooks/use-toast';
import { PersonaEditor } from './PersonaEditor'; // Assuming PersonaEditor exists
import { ApiKeyManager } from './ApiKeyManager'; // Component to manage API keys
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  verseContext: { // Define the structure of the verse context
    surah: number;
    verse: number;
    arabicText: string;
    translation: string;
  } | null;
}

export function ChatPanel({ isOpen, onOpenChange, verseContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>(aiProviderManager.activeProvider);
  const [isPersonaEditorOpen, setIsPersonaEditorOpen] = useState(false);
  const [isApiKeyManagerOpen, setIsApiKeyManagerOpen] = useState(false);
  const [providerNeedsKey, setProviderNeedsKey] = useState<string | null>(null); // Track provider needing key
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const conversationId = verseContext ? `verse_${verseContext.surah}_${verseContext.verse}` : 'general';

  // Load persona and history when panel opens or context changes
  useEffect(() => {
    if (isOpen) {
      aiProviderManager.loadKeysFromStorage(); // Ensure keys are loaded
      scholarPersonaManager.loadPersonas(); // Ensure personas are loaded
      const persona = scholarPersonaManager.getActivePersona();
      setActivePersona(persona);
      // Sync selectedProvider state with the actual active provider from the manager
      setSelectedProvider(aiProviderManager.activeProvider);
      const history = getConversationHistory(conversationId);
      setMessages(history);
      scrollToBottom();
    } else {
      // Optional: Clear messages when closed if desired
      // setMessages([]);
    }
  }, [isOpen, conversationId]);

  // Keep selectedProvider synced with aiProviderManager's activeProvider
  useEffect(() => {
      setSelectedProvider(aiProviderManager.activeProvider);
  }, [aiProviderManager.activeProvider]);


  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleProviderChange = async (providerId: string) => {
     const providerConfig = aiProviderManager.providers[providerId as keyof typeof aiProviderManager.providers];
     if (!providerConfig) {
         toast({ title: "Error", description: "Invalid AI provider selected.", variant: "destructive" });
         return;
     }

     setSelectedProvider(providerId); // Update UI immediately

     // Check if key exists for the selected provider
     if (!aiProviderManager.apiKeys[providerId]) {
         toast({
             title: "API Key Required",
             description: `Please enter your API key for ${providerConfig.name}.`,
             variant: "default", // Less aggressive than destructive
         });
         setProviderNeedsKey(providerId); // Set the provider needing the key
         setIsApiKeyManagerOpen(true); // Open API key manager
         // Don't switch the actual active provider in the manager yet
         return; // Stop processing until key is provided
     } else {
         // Key exists, attempt to switch and test connection
         setIsLoading(true); // Show loading indicator during switch/test
         const connected = await aiProviderManager.testConnection(providerId);
         setIsLoading(false);

         if (connected) {
             aiProviderManager.switchProvider(providerId); // Switch the active provider in the manager
             toast({ title: "AI Provider Switched", description: `Now using ${providerConfig.name}.` });
             // No need to setSelectedProvider here, useEffect handles sync
         } else {
              toast({
                 title: "Connection Failed",
                 description: `Could not connect to ${providerConfig.name}. Please check your API key and network.`,
                 variant: "destructive",
              });
              setSelectedProvider(aiProviderManager.activeProvider); // Revert UI selection to the currently working provider
              setProviderNeedsKey(providerId); // Prompt for key again
              setIsApiKeyManagerOpen(true);
         }
     }
  };


  const handleSendMessage = async () => {
    const message = inputValue.trim();
    if (message === '' || isLoading || !activePersona) return;

    const currentActiveProvider = aiProviderManager.activeProvider; // Use the manager's active provider

    // Ensure active provider has a key before sending
     if (!aiProviderManager.apiKeys[currentActiveProvider]) {
         const providerName = aiProviderManager.providers[currentActiveProvider as keyof typeof aiProviderManager.providers]?.name || currentActiveProvider;
         toast({ title: "API Key Required", description: `Please add your API key for ${providerName} before sending messages.`, variant: "destructive" });
         setProviderNeedsKey(currentActiveProvider);
         setIsApiKeyManagerOpen(true);
         return;
     }


    setInputValue(''); // Clear input immediately

    const userMessage: HistoryMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      id: `msg_${Date.now()}` // Assign unique ID
    };
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);

    // Use only user/assistant roles for history context passed to AI
    const historyContext: MessageContext[] = messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(({ role, content }) => ({ role, content })); // Extract relevant fields


    try {
        // Use the *current active* provider from the manager for the request
      const response: NormalizedAIResponse = await scholarPersonaManager.getResponse(
        message,
        verseContext,
        historyContext, // Pass filtered history
        // currentActiveProvider // Pass the currently active provider - getResponse uses manager's active provider
      );

      if (response.error) {
          // Handle specific case where API key might be invalid
          if (response.message?.toLowerCase().includes('invalid api key') || response.message?.toLowerCase().includes('authentication error') || response.message?.toLowerCase().includes('api key not valid')) {
               const providerName = aiProviderManager.providers[currentActiveProvider as keyof typeof aiProviderManager.providers]?.name || currentActiveProvider;
               toast({
                 title: "Authentication Failed",
                 description: `Invalid API Key for ${providerName}. Please check and update your key.`,
                 variant: "destructive",
               });
               setProviderNeedsKey(currentActiveProvider);
               setIsApiKeyManagerOpen(true);
          } else {
              throw new Error(response.message || 'Failed to get AI response');
          }
      } else {
            const assistantMessage: HistoryMessage = {
                role: 'assistant',
                content: response.content || 'No response content.',
                timestamp: new Date().toISOString(),
                id: `msg_${Date.now()}_ai`,
                metadata: { provider: response.provider, model: response.model }
            };
            setMessages(prev => [...prev, assistantMessage]);
            // Save updated conversation history (including user + assistant message)
            saveConversationHistory(conversationId, [...messages, userMessage, assistantMessage]);
       }

    } catch (error) {
      console.error('Error getting response:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Could not get response from AI.',
        variant: "destructive",
      });
      // Optionally add an error message to the chat
       setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date().toISOString(),
            id: `msg_${Date.now()}_err`,
            metadata: { error: true }
       }]);
       // Remove user message if AI fails completely? Maybe not, keep context.
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeyUpdate = () => {
       // This function is called when the ApiKeyManager *successfully* saves and verifies a key.
       // The manager itself now handles switching the active provider upon success.
       // We just need to clear the flag indicating a key was needed.
       const providerThatWasUpdated = providerNeedsKey; // Store it before clearing
       setProviderNeedsKey(null); // Clear the flag
       setIsApiKeyManagerOpen(false); // Close the manager

       // Optionally, re-sync the UI select dropdown (though the useEffect should handle this)
       if (providerThatWasUpdated) {
            setSelectedProvider(aiProviderManager.activeProvider);
       }

       // Maybe trigger a resend if the original action was sending a message? (More complex UI flow)
       console.log(`API Key updated and verified for ${providerThatWasUpdated}. Active provider is now ${aiProviderManager.activeProvider}`);
  };

   const handleOpenPersonaEditor = () => {
        if (activePersona) {
             setIsPersonaEditorOpen(true);
        } else {
             toast({title: "No Active Persona", description: "Cannot edit persona.", variant: "destructive"});
        }
   };


  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md w-[90vw] flex flex-col p-0" side="right">
          <SheetHeader className="p-4 border-b flex flex-row justify-between items-center">
             {activePersona ? (
                 <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        {/* Placeholder avatar */}
                        <AvatarFallback>{activePersona.name.substring(0, 1)}</AvatarFallback>
                    </Avatar>
                   <div className="flex flex-col">
                     <SheetTitle className="text-base font-semibold">{activePersona.name}</SheetTitle>
                     {/* <span className="text-xs text-muted-foreground font-amiri">{activePersona.nameArabic}</span> */}
                      {/* Ensure description exists before showing */}
                     {activePersona.description && <SheetDescription className="text-xs">{activePersona.description}</SheetDescription>}
                   </div>
                 </div>
             ) : (
                 <SheetTitle className="text-base font-semibold">Chat</SheetTitle> // Fallback title
             )}
            <div className="flex items-center gap-1">
               {/* Provider Selector - reflects manager's active provider */}
               <Select
                  value={selectedProvider} // Use state synced with manager
                  onValueChange={handleProviderChange} // Handle selection attempts
                  disabled={isLoading} // Disable while sending/testing
                >
                 <SelectTrigger className="h-8 text-xs w-auto focus:ring-0 focus:ring-offset-0" aria-label="Select AI Provider">
                   <SelectValue placeholder="Select Provider" />
                 </SelectTrigger>
                 <SelectContent>
                    {Object.entries(aiProviderManager.providers).map(([key, providerInfo]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                        {providerInfo.name}
                        </SelectItem>
                    ))}
                 </SelectContent>
               </Select>
              {/* Edit Persona Button */}
               <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleOpenPersonaEditor}
                  aria-label="Edit Persona"
                  disabled={!activePersona || isLoading} // Disable if no persona or loading
                >
                 <Settings className="h-4 w-4" />
               </Button>
               <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close Chat" disabled={isLoading}>
                   <X className="h-4 w-4" />
                 </Button>
               </SheetClose>
            </div>
          </SheetHeader>

          {/* Chat Messages Area */}
          <ScrollArea className="flex-grow overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              {/* Display Verse Context if available */}
              {verseContext && (
                <div className="text-xs p-3 rounded-md bg-muted border mb-4">
                    <p className="font-semibold mb-1">Context: Verse {verseContext.surah}:{verseContext.verse}</p>
                    <p className="text-muted-foreground line-clamp-2">"{verseContext.translation}"</p>
                </div>
              )}
              {/* Chat Messages */}
              {messages.map((msg) => (
                <div
                  key={msg.id} // Use unique ID
                  className={cn(
                    "p-3 rounded-lg max-w-[85%] break-words",
                    msg.role === 'user' ? 'bg-primary text-primary-foreground self-end' : 'bg-muted text-muted-foreground self-start',
                    isLoading && msg.metadata?.isLoadingPlaceholder && 'opacity-70 animate-pulse' // Updated loading check
                  )}
                  id={msg.id} // Ensure ID is set for potential replacement
                >
                   {/* Use pre-wrap to preserve formatting */}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {/* Optional: Display timestamp or metadata */}
                   {msg.metadata && !msg.metadata.isLoadingPlaceholder && (
                        <p className="text-xs mt-1 opacity-60">
                            {msg.metadata.error ? 'Error' :
                             `via ${aiProviderManager.providers[msg.metadata.provider as keyof typeof aiProviderManager.providers]?.name || '?'} (${msg.metadata.model || '?'})`
                            }
                        </p>
                   )}
                </div>
              ))}
            </div>
            <div ref={messagesEndRef} /> {/* Anchor for scrolling */}
          </ScrollArea>

          {/* Input Area */}
          <SheetFooter className="p-4 border-t">
            <div className="flex gap-2 w-full">
              <Textarea
                id="user-message"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={verseContext ? `Ask ${activePersona?.name || 'AI'} about this verse...` : `Chat with ${activePersona?.name || 'AI'}...`}
                className="flex-1 resize-none text-sm"
                rows={1} // Start with 1 row, potentially expandable
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading || !activePersona} // Disable if loading or no active persona
                aria-label="Chat message input"
              />
              <Button
                id="send-message"
                onClick={handleSendMessage}
                disabled={isLoading || inputValue.trim() === '' || !activePersona}
                size="icon"
                className="w-10 h-10"
                aria-label="Send message"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Persona Editor Modal/Sheet */}
       {/* Pass activePersonaId only if it's not null */}
       {activePersona?.id && (
          <PersonaEditor
             isOpen={isPersonaEditorOpen}
             onOpenChange={setIsPersonaEditorOpen}
             personaId={activePersona.id}
             onPersonaUpdate={() => setActivePersona(scholarPersonaManager.getActivePersona())} // Refresh active persona on update
          />
       )}

      {/* API Key Manager Modal/Sheet */}
      {/* Open manager only if providerNeedsKey is set */}
      <ApiKeyManager
        isOpen={isApiKeyManagerOpen && !!providerNeedsKey}
        // Ensure manager closes when explicitly told or when no provider needs key
        onOpenChange={(open) => setIsApiKeyManagerOpen(open && !!providerNeedsKey)}
        provider={providerNeedsKey || ''} // Pass the provider needing the key
        onKeysUpdated={handleApiKeyUpdate} // Call handler on successful update
      />
    </>
  );
}

// Function to simulate adding a loading message and returning its ID
function addLoadingMessage(role: 'assistant' | 'user' = 'assistant'): string {
    const loadingId = `msg_${Date.now()}_loading`;
    // Simulate adding the message to the state (replace with actual state update)
    // setMessages(prev => [...prev, { role, content: "Thinking...", id: loadingId, timestamp: new Date().toISOString(), metadata: { isLoadingPlaceholder: true } }]);
    console.log("Simulating add loading message with ID:", loadingId);
    return loadingId;
}

// Function to simulate replacing a message by ID (replace with actual state update)
function replaceLoadingMessage(id: string, newContent: string, role: 'assistant' | 'user' = 'assistant', metadata?: Record<string, any>): void {
    // Simulate replacing the message in the state
    // setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, content: newContent, metadata: { ...metadata, isLoadingPlaceholder: false } } : msg));
     console.log(`Simulating replace message ${id} with: ${newContent}`);
}

// Mock function to get conversation history (replace with actual implementation)
// function getConversationHistory(id: string): HistoryMessage[] { return []; }

// Mock function to save conversation history (replace with actual implementation)
// function saveConversationHistory(id: string, history: HistoryMessage[]): void {}
