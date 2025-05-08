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

// Function to get provider-specific instructions (moved from ai-provider.ts)
function getKeyInstructions(provider: string) {
    switch(provider) {
      case 'claude':
        return (
          <ol className="list-decimal list-inside space-y-1">
            <li>Visit <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">console.anthropic.com</a></li>
            <li>Sign up or log in to your Anthropic account</li>
            <li>Navigate to API Keys section</li>
            <li>Create a new API key and copy it</li>
            <li>Paste the key in the field below</li>
          </ol>
        );
      case 'gemini':
        return (
          <ol className="list-decimal list-inside space-y-1">
            <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Google AI Studio API Keys</a></li>
            <li>Sign up or log in with your Google account</li>
            <li>Click "Create API key" and copy it</li>
            <li>Paste the key in the field below</li>
          </ol>
        );
      default:
        return <p>Please check the provider's website for instructions on obtaining an API key.</p>;
    }
}

export function ApiKeyManager({ isOpen, onOpenChange, provider, onKeysUpdated }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const providerInfo = aiProviderManager.providers[provider as keyof typeof aiProviderManager.providers];
  const providerName = providerInfo?.name || provider;

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

    // Temporarily set the key *only in memory* for testing without saving yet
    const tempEncryptedKey = aiProviderManager.encryptKey(apiKey.trim());
    aiProviderManager.apiKeys[provider] = tempEncryptedKey; // Update in-memory store for testConnection

    const connected = await aiProviderManager.testConnection(provider);

    // Remove the temporary key from memory *after* the test regardless of outcome
    // This ensures we don't keep an unverified key if the user cancels or fails
     delete aiProviderManager.apiKeys[provider];
     // Reload keys from actual storage to revert memory state
     aiProviderManager.loadKeysFromStorage();


    if (connected) {
      // Connection successful, now save permanently
       localStorage.setItem(`ai_key_${provider}`, tempEncryptedKey); // Persist encrypted key
       aiProviderManager.loadKeysFromStorage(); // Reload keys to include the new one in memory correctly
       aiProviderManager.switchProvider(provider); // Make this provider active

      toast({ title: "API Key Saved & Verified", description: `Successfully connected to ${providerName}.` });
      onKeysUpdated?.(); // Notify parent component
      onOpenChange(false); // Close dialog
    } else {
      // Connection failed, show error
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
            {/* Display instructions */}
             <div className="mt-4 p-3 bg-muted/50 border rounded-md text-xs text-muted-foreground">
                 <p className="font-medium mb-2">How to get an API key:</p>
                {getKeyInstructions(provider)}
             </div>
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