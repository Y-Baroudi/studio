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
import { Badge } from '@/components/ui/badge'; // Import Badge for concept display
import { cn } from '@/lib/utils';

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
      // Ensure personas are loaded before accessing
      scholarPersonaManager.loadPersonas(); // Load from storage if not already loaded
      const loadedPersona = scholarPersonaManager.personas[personaId];
      if (loadedPersona) {
        // Deep copy to avoid modifying original state unintentionally
        setPersona(JSON.parse(JSON.stringify(loadedPersona)));
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

  const handleInputChange = (field: keyof Omit<Persona, 'id' | 'created' | 'lastModified' | 'concepts' | 'settings'>, value: string) => {
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
    let finalPersonaId = personaId; // Keep track of the ID

    if (isEditing && personaId) {
       // For editing, pass only the updatable fields
       const { id, created, lastModified, ...updateData } = persona;
      success = scholarPersonaManager.updatePersona(personaId, updateData);
    } else {
        // For creation, pass necessary initial fields
      const newId = scholarPersonaManager.createPersona(
        persona.name!, // Name is required
        persona.nameArabic || '',
        persona.description || '',
        persona.systemPrompt! // Prompt is required
      );
      if (newId) {
          finalPersonaId = newId; // Store the new ID
          // If creating, update concepts and settings separately after creation
          if (persona.concepts) {
              Object.entries(persona.concepts).forEach(([conceptId, conceptData]) => {
                  scholarPersonaManager.updateConcept(newId, conceptId, conceptData);
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
      // Ensure we have a valid persona ID before opening the concept editor
       if (!personaId && !isEditing) {
            toast({ title: "Save Required", description: "Please save the new persona before adding concepts.", variant: "default" });
            return; // Don't open if creating new and not saved yet
       }
      setEditingConceptId(conceptId);
      setIsConceptEditorOpen(true);
  };

  const handleConceptUpdate = () => {
      // Reload persona data to reflect concept changes AFTER the concept editor closes and saves
      loadPersonaData();
      setIsConceptEditorOpen(false); // Ensure editor is closed
  };

  const handleDeleteConcept = (conceptIdToDelete: string) => {
      const currentPersonaId = personaId || persona.id; // Use existing ID or ID from state if creating
      const conceptToDelete = persona.concepts?.[conceptIdToDelete];

       if (!currentPersonaId || !conceptToDelete) {
            console.error("Cannot delete concept: Persona ID or concept data missing.", {currentPersonaId, conceptIdToDelete, conceptToDelete});
            toast({ title: "Error", description: "Could not find concept data to delete.", variant: "destructive" });
            return;
       }

      if (window.confirm(`Are you sure you want to delete the concept "${conceptToDelete.name}"?`)) {
          const success = scholarPersonaManager.removeConcept(currentPersonaId, conceptIdToDelete);
          if (success) {
              toast({ title: "Concept Deleted", description: `Concept "${conceptToDelete.name}" removed.` });
              loadPersonaData(); // Refresh the list immediately
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
                {/* Persona Details Inputs */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="persona-name-input" className="text-right">Name*</Label>
                  <Input id="persona-name-input" value={persona.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="persona-arabic-input" className="text-right">Arabic Name</Label>
                  <Input id="persona-arabic-input" value={persona.nameArabic || ''} onChange={(e) => handleInputChange('nameArabic', e.target.value)} className="col-span-3 font-amiri" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label htmlFor="persona-desc-input" className="text-right">Description</Label>
                   <Input id="persona-desc-input" value={persona.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} className="col-span-3" />
                 </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="system-prompt-input" className="text-right pt-2">Instructions*</Label>
                  <Textarea
                    id="system-prompt-input"
                    value={persona.systemPrompt || ''}
                    onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                    className="col-span-3 min-h-[150px]"
                    placeholder="Enter the system prompt (instructions) for the AI..."
                  />
                </div>

                 {/* Concepts Section */}
                 <div className="col-span-4 mt-4">
                      <h4 className="font-medium mb-2 text-base">Concepts</h4>
                      <div className="space-y-2 rounded-md border p-4 bg-muted/30">
                         {/* List Existing Concepts */}
                          {Object.entries(persona.concepts || {}).map(([id, concept]) => (
                             <div key={id} className="flex items-center justify-between p-2 rounded bg-background shadow-sm">
                               <div className="flex-1 overflow-hidden mr-2">
                                  <p className="text-sm font-medium truncate" title={concept.name}>{concept.name}</p>
                                  <p className="text-xs text-muted-foreground truncate" title={concept.description}>{concept.description}</p>
                                   {/* Display related verses as badges */}
                                   {concept.relatedVerses && concept.relatedVerses.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {concept.relatedVerses.map(verseRef => (
                                                <Badge key={verseRef} variant="secondary" className="text-xs px-1.5 py-0.5">{verseRef}</Badge>
                                            ))}
                                        </div>
                                   )}
                               </div>
                               <div className='flex gap-1 flex-shrink-0'>
                                    <Button variant="ghost" size="icon" className='h-7 w-7' onClick={() => handleOpenConceptEditor(id)} aria-label={`Edit concept ${concept.name}`}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                     <Button
                                        variant="ghost"
                                        size="icon"
                                        className='h-7 w-7 text-destructive hover:text-destructive'
                                        onClick={() => handleDeleteConcept(id)} // Pass the correct concept ID
                                        aria-label={`Delete concept ${concept.name}`}
                                        disabled={isSaving} // Disable while saving persona
                                      >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                               </div>
                             </div>
                          ))}
                          {/* Empty State */}
                          {Object.keys(persona.concepts || {}).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No concepts added yet.</p>
                          )}
                         {/* Add Concept Button */}
                         <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleOpenConceptEditor(null)}
                             className="mt-4 w-full sm:w-auto" // Full width on small screens
                             disabled={isSaving || (!isEditing && !personaId)} // Disable if saving OR if creating new and not saved yet
                            >
                            <Plus className="mr-2 h-4 w-4" /> Add Concept
                         </Button>
                          {(!isEditing && !personaId) && (
                              <p className="text-xs text-muted-foreground mt-1 text-center sm:text-left">Save the persona first to add concepts.</p>
                          )}
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
       {/* Render ConceptEditor only if the main editor is open and we have a persona ID (either editing or just created) */}
       {(isOpen && (personaId || persona.id)) && (
          <ConceptEditor
              isOpen={isConceptEditorOpen}
              onOpenChange={setIsConceptEditorOpen}
              personaId={personaId!} // Use non-null assertion as we check condition above
              conceptId={editingConceptId} // Pass null for new concept
              onConceptUpdate={handleConceptUpdate} // Refresh persona data when concept is saved/updated
          />
       )}
    </>
  );
}
