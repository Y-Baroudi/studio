// src/components/chat/ConceptEditor.tsx
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { scholarPersonaManager } from '@/services/persona-manager';
import { Loader2, Save } from 'lucide-react';

interface ConceptEditorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  personaId: string; // ID of the persona this concept belongs to
  conceptId: string | null; // ID of the concept to edit, or null for new concept
  onConceptUpdate?: () => void; // Callback after save/update
}

export function ConceptEditor({ isOpen, onOpenChange, personaId, conceptId, onConceptUpdate }: ConceptEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [relatedVerses, setRelatedVerses] = useState(''); // Stored as comma-separated string for input
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const isEditing = conceptId !== null;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && conceptId) {
        const persona = scholarPersonaManager.personas[personaId];
        const concept = persona?.concepts?.[conceptId];
        if (concept) {
          setName(concept.name);
          setDescription(concept.description);
          setRelatedVerses(concept.relatedVerses.join(', '));
        } else {
          toast({ title: "Error", description: "Concept not found.", variant: "destructive" });
          onOpenChange(false);
        }
      } else {
        // Reset for new concept
        setName('');
        setDescription('');
        setRelatedVerses('');
      }
    }
  }, [isOpen, isEditing, conceptId, personaId, toast, onOpenChange]);

  const handleSaveConcept = () => {
    if (!name.trim() || !description.trim()) {
      toast({ title: "Error", description: "Concept Name and Description are required.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    const conceptData = {
      name: name.trim(),
      description: description.trim(),
      relatedVerses: relatedVerses.split(',').map(v => v.trim()).filter(v => v) // Split, trim, filter empty
    };

    // Generate ID for new concept based on name
    const idToSave = conceptId || name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Basic check for duplicate ID on creation
     if (!isEditing && scholarPersonaManager.personas[personaId]?.concepts?.[idToSave]) {
         toast({ title: "Error", description: `A concept with ID '${idToSave}' derived from the name already exists. Please choose a different name.`, variant: "destructive" });
         setIsSaving(false);
         return;
     }


    const success = scholarPersonaManager.updateConcept(personaId, idToSave, conceptData);

    setIsSaving(false);
    if (success) {
      toast({ title: "Success", description: `Concept ${isEditing ? 'updated' : 'added'} successfully.` });
      onConceptUpdate?.(); // Notify parent
      onOpenChange(false); // Close dialog
    } else {
      toast({ title: "Error", description: `Failed to ${isEditing ? 'update' : 'add'} concept.`, variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Concept' : 'Add New Concept'}</DialogTitle>
          <DialogDescription>
            Define a key concept for the AI persona. Provide a name, description, and optionally related Quran verses.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="concept-name" className="text-right">Name</Label>
            <Input id="concept-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="concept-description" className="text-right pt-2">Description</Label>
            <Textarea
              id="concept-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 min-h-[100px]"
              placeholder="Explain the concept..."
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="concept-verses" className="text-right">Related Verses</Label>
            <Input
              id="concept-verses"
              value={relatedVerses}
              onChange={(e) => setRelatedVerses(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 2:143, 55:7-9"
            />
             {/* <p className="col-span-3 col-start-2 text-xs text-muted-foreground">Enter verse references separated by commas (e.g., 2:143, 55:7-9).</p> */}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSaveConcept} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Concept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
