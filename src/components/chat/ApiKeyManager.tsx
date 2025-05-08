// src/components/chat/ApiKeyManager.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { aiProviderManager } from '@/services/ai-provider';
import { Loader2, Save, KeyRound } from 'lucide-react';

interface ApiKeyManagerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  provider: string; // The provider for which the key is needed
  onKeysUpdated?: () => void; // Callback after keys are potentially updated
}

export function ApiKeyManager({ isOpen, onOpenChange, provider, onKeysUpdated }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const providerName = aiProviderManager.providers[provider]?.name || provider;

  useEffect(() => {
    // Reset key input when dialog opens or provider changes
    if (isOpen) {
      setApiKey('');
    }
  }, [isOpen, provider]);

  const handleSaveAndTestKey = async () => {
    if (!apiKey.trim()) {
      toast({ title: "Error", description: "API Key cannot be empty.", variant: "destructive" });
      return;
    }
    setIsTesting(true);

    // Temporarily set the key for testing without saving yet
    aiProviderManager.apiKeys[provider] = aiProviderManager.encryptKey(apiKey.trim());

    const connected = await aiProviderManager.testConnection(provider);

    if (connected) {
      // Connection successful, now save permanently
       localStorage.setItem(`ai_key_${provider}`, aiProviderManager.encryptKey(apiKey.trim())); // Persist encrypted key
       aiProviderManager.activeProvider = provider; // Switch to this provider
       localStorage.setItem('ai_active_provider', provider); // Persist active choice
      toast({ title: "API Key Saved & Verified", description: `Successfully connected to ${providerName}.` });
      onKeysUpdated?.(); // Notify parent component
      onOpenChange(false); // Close dialog
    } else {
      // Connection failed, clear the temporary key and show error
       delete aiProviderManager.apiKeys[provider]; // Remove the invalid temporary key
      toast({
        title: "Connection Failed",
        description: `Could not connect using the provided key for ${providerName}. Please check the key and try again.`,
        variant: "destructive",
      });
    }

    setIsTesting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary"/>
            API Key for {providerName}
            </DialogTitle>
          <DialogDescription>
            Enter your API key for {providerName} to enable its use. Keys are stored securely in your browser's local storage.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
           <Label htmlFor="api-key-input">API Key</Label>
           <Input
             id="api-key-input"
             type="password" // Mask the key input
             value={apiKey}
             onChange={(e) => setApiKey(e.target.value)}
             placeholder={`Enter your ${providerName} API Key`}
             disabled={isTesting}
           />
            {/* Optionally add links to get API keys */}
             <p className="text-xs text-muted-foreground">
               Find your key at the {providerName} developer console.
            </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isTesting}>Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSaveAndTestKey} disabled={isTesting || !apiKey.trim()}>
            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save & Test Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
