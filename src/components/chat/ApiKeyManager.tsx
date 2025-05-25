
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { aiProviderManager } from '@/services/ai/ai-provider';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyManagerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string | null; // The ID of the provider needing a key (e.g., 'claude', 'gemini')
  onApiKeySaved: (providerId: string) => void; // Callback when key is successfully saved and tested
}

export function ApiKeyManager({ isOpen, onOpenChange, providerId, onApiKeySaved }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Reset form when dialog opens or provider changes
    if (isOpen) {
      setApiKey('');
      setError(null);
      setIsTesting(false);
    }
  }, [isOpen, providerId]);

  if (!providerId || !aiProviderManager.providers[providerId]) {
    // This shouldn't happen if used correctly, but good for robustness
    if (isOpen && providerId) console.error(`ApiKeyManager: Invalid providerId "${providerId}"`);
    return null; 
  }

  const providerDetails = aiProviderManager.providers[providerId];

  const handleSaveAndTestKey = async () => {
    if (!apiKey.trim()) {
      setError('API key cannot be empty.');
      return;
    }
    setError(null);
    setIsTesting(true);

    // Temporarily set the key in aiProviderManager for testing
    // This doesn't permanently save it yet, init does that after successful test.
    const tempEncryptedKey = aiProviderManager.encryptKey(apiKey);
    const originalKeys = { ...aiProviderManager.apiKeys }; // Backup original keys
    aiProviderManager.apiKeys[providerId] = tempEncryptedKey;


    const connectionSuccessful = await aiProviderManager.testConnection(providerId);

    aiProviderManager.apiKeys = originalKeys; // Restore original keys before proper init

    setIsTesting(false);

    if (connectionSuccessful) {
      // Permanently save and initialize the provider with the new key
      aiProviderManager.init(providerId, apiKey); // This saves and makes it active if needed
      toast({
        title: 'API Key Verified',
        description: `${providerDetails.name} connection successful. Key saved.`,
      });
      onApiKeySaved(providerId); // Notify parent
      onOpenChange(false);
    } else {
      setError(`Failed to connect to ${providerDetails.name}. Please check your API key and try again.`);
      toast({
        title: 'Connection Failed',
        description: `Could not connect to ${providerDetails.name}. Key not saved.`,
        variant: 'destructive',
      });
    }
  };
  
  const getKeyInstructionsHTML = () => {
    switch(providerId) {
      case 'claude':
        return `
          <li>Visit <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" class="underline text-primary">console.anthropic.com</a></li>
          <li>Sign up or log in to your Anthropic account</li>
          <li>Navigate to API Keys section</li>
          <li>Create a new API key and copy it</li>
          <li>Paste the key in the field above</li>
        `;
      case 'gemini':
        return `
          <li>Visit <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" class="underline text-primary">AI Studio</a></li>
          <li>Sign up or log in with your Google account</li>
          <li>Navigate to API Keys section</li>
          <li>Create a new API key and copy it</li>
          <li>Paste the key in the field above</li>
        `;
      default:
        return `<li>Please check the provider's website for instructions on obtaining an API key.</li>`;
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Setup API Key for {providerDetails.name}</DialogTitle>
          <DialogDescription>
            Enter your API key to enable AI features with {providerDetails.name}.
            Your key will be stored locally in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="api-key-input">API Key</Label>
            <Input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              disabled={isTesting}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">How to get an API key:</p>
            <ul className="list-disc list-inside space-y-0.5" dangerouslySetInnerHTML={{ __html: getKeyInstructionsHTML() }} />
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isTesting}>
            Cancel
          </Button>
          <Button onClick={handleSaveAndTestKey} disabled={isTesting || !apiKey.trim()}>
            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save & Test Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Ensure this component is also correctly exported if it's in its own file.
// export default ApiKeyManager; // If it's in its own file e.g. ApiKeyManager.tsx

