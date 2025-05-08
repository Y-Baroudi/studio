// src/components/chat/PersonaEditor.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { scholarPersonaManager, type Persona } from '@/services/persona-manager';
import { Loader2, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { ConceptEditor } from './ConceptEditor'; // Assuming ConceptEditor exists

interface PersonaEditorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  personaId: string | null; // ID of the persona to edit, or null to create new
  onPersonaUpdate?: () => void; // Callback after successful update/creation
}

export function PersonaEditor({ isOpen, onOpenChange, personaId, onPersonaUpdate }: PersonaEditorProps) {
  const [persona, setPersona] = useState<Partial<Persona>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConceptEditorOpen, setIsConceptEditorOpen] = useState(false);
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const { toast } = useToast();

  const isEditing = personaId !== null;

  const loadPersonaData = useCallback(() => {
    if (isEditing && personaId) {
      setIsLoading(true);
      const loadedPersona = scholarPersonaManager.personas[personaId];
      if (loadedPersona) {
        setPersona(JSON.parse(JSON.stringify(loadedPersona))); // Deep copy to avoid modifying original state
      } else {
        toast({ title: "Error", description: `Persona with ID ${personaId} not found.`, variant: "destructive" });
        onOpenChange(false); // Close if persona not found
      }
      setIsLoading(false);
    } else {
      // Default values for creating a new persona
      setPersona({
        name: '',
        nameArabic: '',
        description: '',
        systemPrompt: '',
        concepts: {},
        settings: {
            defaultLanguage: "en",
            arabicScript: true,
            formatCitations: true,
            conceptTagging: true
        }
      });
    }
  }, [personaId, isEditing, toast, onOpenChange]);

  useEffect(() => {
    if (isOpen) {
      loadPersonaData();
    } else {
        // Reset state when closing
        setPersona({});
    }
  }, [isOpen, loadPersonaData]);

  const handleInputChange = (field: keyof Persona, value: any) => {
    setPersona(prev => ({ ...prev, [field]: value }));
  };

   const handleSettingsChange = (field: keyof Persona['settings'], value: any) => {
      setPersona(prev => ({
        ...prev,
        settings: {
          ...(prev.settings ?? {} as Persona['settings']), // Ensure settings object exists
          [field]: value
        }
      }));
    };


  const handleSavePersona = () => {
    if (!persona.name || !persona.systemPrompt) {
      toast({ title: "Error", description: "Persona Name and Instructions are required.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    let success = false;

    if (isEditing && personaId) {
      success = scholarPersonaManager.updatePersona(personaId, persona);
    } else {
      const newId = scholarPersonaManager.createPersona(
        persona.name,
        persona.nameArabic || '',
        persona.description || '',
        persona.systemPrompt
      );
      if (newId) {
          // If creating, update concepts and settings separately after creation
          if (persona.concepts) {
              Object.entries(persona.concepts).forEach(([id, conceptData]) => {
                  scholarPersonaManager.updateConcept(newId, id, conceptData);
              });
          }
          if (persona.settings) {
               scholarPersonaManager.updatePersona(newId, { settings: persona.settings });
          }
          success = true;
      }
    }

    setIsSaving(false);
    if (success) {
      toast({ title: "Success", description: `Persona ${isEditing ? 'updated' : 'created'} successfully.` });
      onPersonaUpdate?.(); // Notify parent component
      onOpenChange(false); // Close dialog
    } else {
      toast({ title: "Error", description: `Failed to ${isEditing ? 'update' : 'create'} persona.`, variant: "destructive" });
    }
  };

  const handleOpenConceptEditor = (conceptId: string | null = null) => {
      setEditingConceptId(conceptId);
      setIsConceptEditorOpen(true);
  };

  const handleConceptUpdate = () => {
      // Reload persona data to reflect concept changes
      loadPersonaData();
  };

  const handleDeleteConcept = (conceptId: string) => {
      if (!personaId || !persona.concepts?.[conceptId]) return;

      if (window.confirm(`Are you sure you want to delete the concept "${persona.concepts[conceptId].name}"?`)) {
          const success = scholarPersonaManager.removeConcept(personaId, conceptId);
          if (success) {
              toast({ title: "Concept Deleted", description: `Concept "${persona.concepts[conceptId].name}" removed.` });
              loadPersonaData(); // Refresh the list
          } else {
              toast({ title: "Error", description: "Failed to delete concept.", variant: "destructive" });
          }
      }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Scholar Persona' : 'Create New Persona'}</DialogTitle>
            <DialogDescription>
              Configure the name, instructions, and concepts for this AI persona.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="persona-name-input" className="text-right">Name</Label>
                  <Input id="persona-name-input" value={persona.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="persona-arabic-input" className="text-right">Arabic Name</Label>
                  <Input id="persona-arabic-input" value={persona.nameArabic || ''} onChange={(e) => handleInputChange('nameArabic', e.target.value)} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label htmlFor="persona-desc-input" className="text-right">Description</Label>
                   <Input id="persona-desc-input" value={persona.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} className="col-span-3" />
                 </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="system-prompt-input" className="text-right pt-2">Instructions</Label>
                  <Textarea
                    id="system-prompt-input"
                    value={persona.systemPrompt || ''}
                    onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                    className="col-span-3 min-h-[150px]"
                    placeholder="Enter the system prompt (instructions) for the AI..."
                  />
                </div>
                 <div className="col-span-4">
                      <h4 className="font-medium mb-2">Concepts</h4>
                      <div className="space-y-2 rounded-md border p-4">
                          {Object.entries(persona.concepts || {}).map(([id, concept]) => (
                             <div key={id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                               <div>
                                  <p className="text-sm font-medium">{concept.name}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-xs">{concept.description}</p>
                               </div>
                               <div className='flex gap-1'>
                                    <Button variant="ghost" size="icon" className='h-7 w-7' onClick={() => handleOpenConceptEditor(id)}>
                                        <Edit2 className="h-4 w-4" />
                                        <span className="sr-only">Edit Concept</span>
                                    </Button>
                                     <Button variant="ghost" size="icon" className='h-7 w-7 text-destructive hover:text-destructive' onClick={() => handleDeleteConcept(id)}>
                                        <Trash2 className="h-4 w-4" />
                                         <span className="sr-only">Delete Concept</span>
                                    </Button>
                               </div>
                             </div>
                          ))}
                          {Object.keys(persona.concepts || {}).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No concepts added yet.</p>
                          )}
                         <Button variant="outline" size="sm" onClick={() => handleOpenConceptEditor(null)} className="mt-2">
                            <Plus className="mr-2 h-4 w-4" /> Add Concept
                         </Button>
                      </div>
                 </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleSavePersona} disabled={isSaving || isLoading}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEditing ? 'Save Changes' : 'Create Persona'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Concept Editor Modal */}
       {personaId && ( // Only render ConceptEditor if a persona exists (editing or newly created)
          <ConceptEditor
              isOpen={isConceptEditorOpen}
              onOpenChange={setIsConceptEditorOpen}
              personaId={personaId}
              conceptId={editingConceptId} // Pass null for new concept
              onConceptUpdate={handleConceptUpdate}
          />
       )}
    </>
  );
}
