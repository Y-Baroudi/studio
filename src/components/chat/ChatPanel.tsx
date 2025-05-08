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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const conversationId = verseContext ? `verse_${verseContext.surah}_${verseContext.verse}` : 'general';

  // Load persona and history when panel opens or context changes
  useEffect(() => {
    if (isOpen) {
      const persona = scholarPersonaManager.getActivePersona();
      setActivePersona(persona);
      setSelectedProvider(aiProviderManager.activeProvider); // Sync provider select
      const history = getConversationHistory(conversationId);
      setMessages(history);
      scrollToBottom();
    } else {
      // Optional: Clear messages when closed if desired
      // setMessages([]);
    }
  }, [isOpen, conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleProviderChange = async (provider: string) => {
    setSelectedProvider(provider);
    if (!aiProviderManager.apiKeys[provider]) {
        toast({
            title: "API Key Required",
            description: `Please enter your API key for ${aiProviderManager.providers[provider]?.name}.`,
            variant: "destructive",
        });
        setIsApiKeyManagerOpen(true); // Open API key manager
        return false; // Prevent switching provider until key is set
    } else {
        // Test connection before switching
        const connected = await aiProviderManager.testConnection(provider);
        if (connected) {
            aiProviderManager.switchProvider(provider);
            toast({ title: "AI Provider Switched", description: `Now using ${aiProviderManager.providers[provider]?.name}.` });
            return true;
        } else {
             toast({
                title: "Connection Failed",
                description: `Could not connect to ${aiProviderManager.providers[provider]?.name}. Please check your API key and network.`,
                variant: "destructive",
             });
             setSelectedProvider(aiProviderManager.activeProvider); // Revert selection
             setIsApiKeyManagerOpen(true); // Prompt for key again
             return false;
        }
    }
  };

  const handleSendMessage = async () => {
    const message = inputValue.trim();
    if (message === '' || isLoading || !activePersona) return;

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
      const response: NormalizedAIResponse = await scholarPersonaManager.getResponse(
        message,
        verseContext,
        historyContext // Pass filtered history
      );

      if (response.error) {
        throw new Error(response.message || 'Failed to get AI response');
      }

      const assistantMessage: HistoryMessage = {
        role: 'assistant',
        content: response.content || 'No response content.',
        timestamp: new Date().toISOString(),
        id: `msg_${Date.now()}_ai`,
        metadata: { provider: response.provider, model: response.model }
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Save updated conversation history
      saveConversationHistory(conversationId, [...messages, userMessage, assistantMessage]);

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeyUpdate = () => {
      // Reload providers or re-test connection after keys are updated
      setSelectedProvider(aiProviderManager.activeProvider); // Re-sync dropdown
      aiProviderManager.testConnection(aiProviderManager.activeProvider)
        .then(connected => {
            if (connected) {
                toast({ title: "API Key Verified", description: `Connected to ${aiProviderManager.providers[aiProviderManager.activeProvider]?.name}.` });
            } else {
                 toast({ title: "Connection Failed", description: `Could not verify API key for ${aiProviderManager.providers[aiProviderManager.activeProvider]?.name}.`, variant: 'destructive'});
            }
        });
  };


  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md w-[90vw] flex flex-col p-0" side="right">
          <SheetHeader className="p-4 border-b flex flex-row justify-between items-center">
             {activePersona && (
                 <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        {/* Placeholder avatar */}
                        <AvatarFallback>{activePersona.name.substring(0, 1)}</AvatarFallback>
                    </Avatar>
                   <div className="flex flex-col">
                     <SheetTitle className="text-base font-semibold">{activePersona.name}</SheetTitle>
                     {/* <span className="text-xs text-muted-foreground font-amiri">{activePersona.nameArabic}</span> */}
                     <SheetDescription className="text-xs">{activePersona.description}</SheetDescription>
                   </div>
                 </div>
             )}
            <div className="flex items-center gap-1">
               {/* Provider Selector */}
               <Select value={selectedProvider} onValueChange={handleProviderChange}>
                 <SelectTrigger className="h-8 text-xs w-auto focus:ring-0 focus:ring-offset-0">
                   <SelectValue placeholder="Select Provider" />
                 </SelectTrigger>
                 <SelectContent>
                   {Object.entries(aiProviderManager.providers).map(([key, provider]) => (
                     <SelectItem key={key} value={key} className="text-xs">
                       {provider.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
              {/* Edit Persona Button */}
               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsPersonaEditorOpen(true)} aria-label="Edit Persona">
                 <Settings className="h-4 w-4" />
               </Button>
               <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close Chat">
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
              {messages.map((msg, index) => (
                <div
                  key={msg.id || index} // Use unique ID if available
                  className={cn(
                    "p-3 rounded-lg max-w-[85%] break-words",
                    msg.role === 'user' ? 'bg-primary text-primary-foreground self-end' : 'bg-muted text-muted-foreground self-start',
                    isLoading && msg.role === 'assistant' && index === messages.length - 1 && 'opacity-70 animate-pulse' // Basic loading indicator
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {/* Optional: Display timestamp or metadata */}
                   {msg.metadata && (
                        <p className="text-xs mt-1 opacity-60">
                            {msg.metadata.error ? 'Error' :
                             `via ${msg.metadata.provider || '?'} (${msg.metadata.model || '?'})`
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
                placeholder="Ask about this verse..."
                className="flex-1 resize-none text-sm"
                rows={1} // Start with 1 row, potentially expandable
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                id="send-message"
                onClick={handleSendMessage}
                disabled={isLoading || inputValue.trim() === ''}
                size="icon"
                className="w-10 h-10"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                 <span className="sr-only">Send message</span>
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Persona Editor Modal/Sheet */}
      {activePersona && (
        <PersonaEditor
            isOpen={isPersonaEditorOpen}
            onOpenChange={setIsPersonaEditorOpen}
            personaId={activePersona.id}
            onPersonaUpdate={() => setActivePersona(scholarPersonaManager.getActivePersona())} // Refresh active persona on update
        />
      )}

      {/* API Key Manager Modal/Sheet */}
      <ApiKeyManager
        isOpen={isApiKeyManagerOpen}
        onOpenChange={setIsApiKeyManagerOpen}
        provider={selectedProvider} // Pass the provider needing the key
        onKeysUpdated={handleApiKeyUpdate}
      />
    </>
  );
}
