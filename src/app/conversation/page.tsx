
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { MessageSquareText } from 'lucide-react';

export default function ConversationPage() {
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,10rem))]">
      <div className="text-center">
        <MessageSquareText className="mx-auto h-16 w-16 text-primary mb-6" />
        <h1 className="text-3xl font-semibold mb-4">AI Conversations</h1>
        <p className="mb-8 text-lg text-muted-foreground max-w-md">
          Engage in reflective discussions with an AI scholar.
          Explore Islamic concepts, ask questions, and deepen your understanding.
        </p>
        <Button
          size="lg"
          onClick={() => setIsChatPanelOpen(true)}
          className="shadow-lg hover:shadow-xl transition-shadow"
        >
          <MessageSquareText className="mr-2 h-5 w-5" />
          Start a General Conversation
        </Button>
      </div>

      {/* The ChatPanel will be triggered from here for general discussions */}
      <ChatPanel
        isOpen={isChatPanelOpen}
        onOpenChange={setIsChatPanelOpen}
        verseContext={null} // Pass null for general conversation context
      />
    </div>
  );
}
