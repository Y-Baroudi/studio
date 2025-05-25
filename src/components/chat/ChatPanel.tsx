
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Changed from Textarea to Input for single line
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { chat, type ChatInput, type ChatOutput } from '@/ai/flows/chat-flow';
import type { Verse } from '@/services/alquran-cloud';
import type { MessageData } from 'genkit';
import { Loader2, Send, CornerDownLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea'; // Keep Textarea for multi-line input

interface ChatPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  verseContext: Verse | null; 
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export function ChatPanel({ isOpen, onOpenChange, verseContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: authLoading } = useAuth(); // Get authLoading state
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Set initial system message when panel opens or context changes
  useEffect(() => {
    if (isOpen && verseContext) {
      let introContent = `Starting conversation about Surah ${verseContext.surah?.number}:${verseContext.ayahNumberInSurah} (${verseContext.surah?.englishName}).`;
      if (verseContext.verseNumber === 0) { // Check if it's a general concept discussion
        introContent = `Let's discuss the concept: ${verseContext.surah?.englishName}.`;
      }
      setMessages([
        { 
          id: 'system-intro-' + Date.now(), 
          role: 'system', 
          content: introContent,
          timestamp: new Date()
        }
      ]);
      setInputMessage(''); // Clear input field when context changes
    } else if (!isOpen) {
      setMessages([]); 
    }
  }, [isOpen, verseContext]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !user) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    const currentInput = inputMessage; // Capture current input before clearing
    setInputMessage('');
    setIsLoading(true);

    const genkitContext: MessageData[] = [...messages, newUserMessage].map(msg => ({ // Include new user message in history
        role: msg.role === 'assistant' ? 'model' : msg.role,
        content: [{ text: msg.content }]
    }));
    
    let systemPrompt = "You are Abul'fath, a knowledgeable and respectful Islamic scholar. Please keep your responses concise and to the point, ideally under 200 words unless more detail is explicitly requested. Focus on the user's query regarding the provided Quranic verse or concept.";

    if (verseContext) {
      if (verseContext.verseNumber === 0) { // General concept discussion
        systemPrompt += `\n\nThe user is asking about the concept: ${verseContext.surah?.englishName} - "${verseContext.englishTranslation}".`;
      } else { // Specific verse discussion
        systemPrompt += `\n\nThe user is asking about Surah ${verseContext.surah?.number}:${verseContext.ayahNumberInSurah} (${verseContext.surah?.englishName}): "${verseContext.englishTranslation}" (Arabic: "${verseContext.arabicText}")`;
      }
    }


    try {
      const chatInput: ChatInput = {
        message: currentInput, // Use captured input
        context: genkitContext,
        systemPrompt: systemPrompt,
      };
      const aiResponse: ChatOutput = await chat(chatInput);

      const newAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newAiMessage]);
    } catch (error) {
      console.error("Error sending message to AI:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
       textareaRef.current?.focus(); // Refocus textarea
    }
  };
  
  // Adjust Textarea Height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set to scroll height
    }
  }, [inputMessage]);


  if (authLoading) {
      return (
          <Sheet open={isOpen} onOpenChange={onOpenChange}>
              <SheetContent className="sm:max-w-lg w-full flex flex-col p-0" side="right">
                  <SheetHeader className="p-6 pb-4 border-b">
                      <SheetTitle>Chat with Abul'fath</SheetTitle>
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
                    <SheetTitle>Chat with Abul'fath</SheetTitle>
                     <SheetDescription>
                        AI-powered reflections and discussions.
                    </SheetDescription>
                </SheetHeader>
                <div className="p-6 text-center flex-grow flex flex-col items-center justify-center">
                    <p className="mb-4 text-muted-foreground">Please log in to use the AI chat feature.</p>
                    {/* Optionally, include a login button here if your AuthProvider exposes login functions directly */}
                </div>
            </SheetContent>
        </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg w-full flex flex-col p-0" side="right">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Chat with Abul'fath</SheetTitle>
           <SheetDescription>
             {verseContext?.verseNumber === 0 
                ? `Discussing: ${verseContext?.surah?.englishName}`
                : verseContext 
                ? `S. ${verseContext?.surah?.number}:${verseContext?.ayahNumberInSurah} (${verseContext?.surah?.englishNameShort || verseContext?.surah?.englishName})`
                : "General Discussion"
            }
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-grow p-6">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`p-3 rounded-lg max-w-[85%] text-sm whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : msg.role === 'system'
                      ? 'italic text-muted-foreground text-xs w-full text-center bg-transparent p-1'
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
        <SheetFooter className="p-4 border-t bg-background">
          <div className="flex gap-2 w-full items-end">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask a question..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                  e.preventDefault(); // Prevent newline
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              className="min-h-[40px] max-h-[120px] resize-none text-sm py-2" // Adjusted padding
              rows={1} // Start with 1 row
            />
            <Button onClick={handleSendMessage} disabled={isLoading || !inputMessage.trim()} className="h-10 w-10 p-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
