
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Notebook, Tag, Save, XCircle, Loader2, Edit2, Check, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Note } from '@/services/notes';
import { saveNote, getNoteForVerse, deleteNoteForVerse } from '@/services/notes';
import { absoluteVerseToSurahAyah } from '@/services/alquran-cloud';
import type { QuranMeta } from '@/services/alquran-cloud';
import type { Concept, VerseConceptRelation } from '@/services/concepts'; // Import concept types
import { getAllConcepts, getConceptsForVerse, tagVerseWithConcepts, untagVerseConcepts } from '@/services/concepts'; // Import concept functions
import { ScrollArea } from '@/components/ui/scroll-area'; // For scrollable concept list
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // For concept selection
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'; // For concept selection input
import { cn } from '@/lib/utils';

// Placeholder for a simple rich text editor component
const RichTextEditorPlaceholder = ({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) => (
  <Textarea
    id="note-content"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Start writing your reflections here..."
    className="min-h-[200px] text-sm"
    disabled={disabled}
    aria-label="Note content"
  />
);

interface NotesSidebarProps {
  currentAbsoluteVerseNumber: number;
  quranMeta: QuranMeta | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onNoteUpdated: (absoluteVerseNumber: number, hasNote: boolean) => void; // Callback to notify parent of note status change
}

export function NotesSidebar({
  currentAbsoluteVerseNumber,
  quranMeta,
  isOpen,
  onOpenChange,
  onNoteUpdated,
}: NotesSidebarProps) {
  const [noteContent, setNoteContent] = useState('');
  const [verseTags, setVerseTags] = useState<string[]>([]); // Tags specific to the note itself (deprecated?)
  const [verseConceptIds, setVerseConceptIds] = useState<string[]>([]); // Concept IDs linked to the verse
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [conceptSelectorOpen, setConceptSelectorOpen] = useState(false);

  const { toast } = useToast();

  const verseLocation = useMemo(() => absoluteVerseToSurahAyah(currentAbsoluteVerseNumber, quranMeta), [currentAbsoluteVerseNumber, quranMeta]);
  const surahNumber = verseLocation?.surahNumber;
  const ayahNumberInSurah = verseLocation?.ayahNumber;
  const surahName = verseLocation?.surahMeta?.englishName ?? '';
  const ayahDisplay = verseLocation ? `${verseLocation.surahNumber}:${verseLocation.ayahNumber}` : '?';

  // Fetch note, concepts, and verse concept relations
  useEffect(() => {
    if (isOpen && currentAbsoluteVerseNumber > 0) {
      setIsLoadingData(true);
      // Ensure this runs client-side
      if (typeof window !== 'undefined') {
        // Fetch existing note
        const existingNote = getNoteForVerse(currentAbsoluteVerseNumber);
        setCurrentNote(existingNote);
        setNoteContent(existingNote?.noteText ?? '');
        setVerseTags(existingNote?.tags ?? []); // Keep tags associated with note object if needed

        // Fetch all available concepts
        const concepts = getAllConcepts();
        setAllConcepts(concepts);

        // Fetch concepts already tagged for this verse
        const taggedConceptIds = getConceptsForVerse(currentAbsoluteVerseNumber);
        setVerseConceptIds(taggedConceptIds);

        console.log(`Loaded data for verse ${currentAbsoluteVerseNumber}: Note exists: ${!!existingNote}, Tagged Concepts:`, taggedConceptIds);
      }
      setIsLoadingData(false);
    } else if (!isOpen) {
        // Optionally clear state when closing - prevents stale data flash
        // setNoteContent('');
        // setVerseTags([]);
        // setVerseConceptIds([]);
        // setCurrentNote(null);
        // setAllConcepts([]);
    }
  }, [isOpen, currentAbsoluteVerseNumber]);

  // --- Note Saving Logic ---
  const handleSaveNote = () => {
    if (!surahNumber || !ayahNumberInSurah || isLoadingData) return;

    setIsSaving(true);
    console.log(`Attempting to save note for verse ${currentAbsoluteVerseNumber} (${surahNumber}:${ayahNumberInSurah})`);

    // Save the note text (and its tags if they are stored with the note object)
    const savedNote = saveNote(
      currentAbsoluteVerseNumber,
      surahNumber,
      ayahNumberInSurah,
      noteContent,
      verseTags, // Save note-specific tags
      true // isPrivate can be added later if needed
    );

    setIsSaving(false);

    if (savedNote !== null) { // saveNote now returns null for deleted empty notes
        setCurrentNote(savedNote); // Update local state
        toast({
            title: "Note Saved",
            description: `Your note for ${surahName} ${ayahDisplay} has been saved locally.`,
        });
        onNoteUpdated(currentAbsoluteVerseNumber, true); // Notify parent that note exists
        onOpenChange(false); // Close sidebar on successful save
    } else if (!noteContent && verseTags.length === 0) {
         // Handle case where an empty note was deleted
        setCurrentNote(null);
        toast({
            title: "Note Cleared",
            description: `Empty note for ${surahName} ${ayahDisplay} was removed.`,
        });
        onNoteUpdated(currentAbsoluteVerseNumber, false); // Notify parent note doesn't exist
        onOpenChange(false); // Close sidebar
    } else {
        console.error("Failed to save note via service.");
        toast({
            title: "Save Failed",
            description: "Could not save the note. Please try again.",
            variant: "destructive",
        });
    }
  };

   // --- Note Deletion Logic ---
   const handleDeleteNote = () => {
      if (!currentNote || isLoadingData) return;

      setIsSaving(true); // Use saving state to disable buttons during delete
      console.log(`Attempting to delete note for verse ${currentAbsoluteVerseNumber}`);

      const deleted = deleteNoteForVerse(currentAbsoluteVerseNumber);

      setIsSaving(false);

      if (deleted) {
        setCurrentNote(null);
        setNoteContent('');
        setVerseTags([]);
        toast({
          title: "Note Deleted",
          description: `Note for ${surahName} ${ayahDisplay} removed.`,
        });
        onNoteUpdated(currentAbsoluteVerseNumber, false); // Notify parent note deleted
        onOpenChange(false); // Close sidebar
      } else {
        toast({
          title: "Delete Failed",
          description: "Could not delete the note. Please try again.",
          variant: "destructive",
        });
      }
  };


  // --- Concept Tagging Logic ---
  const handleConceptToggle = (conceptId: string) => {
    if (!surahNumber || !ayahNumberInSurah || isLoadingData) return;

    const isCurrentlyTagged = verseConceptIds.includes(conceptId);
    let success = false;

    if (isCurrentlyTagged) {
      // Untag the concept
      console.log(`Untagging concept ${conceptId} from verse ${currentAbsoluteVerseNumber}`);
      success = untagVerseConcepts(surahNumber, ayahNumberInSurah, [conceptId]);
      if (success) {
          setVerseConceptIds(prev => prev.filter(id => id !== conceptId));
          toast({ title: "Concept Untagged", description: `Removed tag from ${surahName} ${ayahDisplay}.` });
      } else {
           toast({ title: "Untag Failed", description: "Could not remove concept tag.", variant: "destructive" });
      }
    } else {
      // Tag the concept
      console.log(`Tagging verse ${currentAbsoluteVerseNumber} with concept ${conceptId}`);
      success = tagVerseWithConcepts(surahNumber, ayahNumberInSurah, currentAbsoluteVerseNumber, [conceptId]);
      if (success) {
          setVerseConceptIds(prev => [...prev, conceptId]);
          toast({ title: "Concept Tagged", description: `Added tag to ${surahName} ${ayahDisplay}.` });
      } else {
          toast({ title: "Tag Failed", description: "Could not add concept tag.", variant: "destructive" });
      }
    }
     onNoteUpdated(currentAbsoluteVerseNumber, checkNoteExists(currentAbsoluteVerseNumber) || verseConceptIds.length > 0); // Update parent state based on tags too
  };

  // Helper to get concept name by ID
  const getConceptName = (id: string): string => {
    return allConcepts.find(c => c.id === id)?.name ?? id;
  };

   // Check if there's content to save (either text or tags)
   // Note: Concept tagging saves immediately, so saving mainly applies to text.
   const canSaveNoteText = noteContent.trim().length > 0;
   // Check if *any* note-related data exists (text OR concepts tagged)
   const hasExistingNoteData = currentNote !== null || verseConceptIds.length > 0;


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col p-0"> {/* Remove default padding */}
        <SheetHeader className="p-6 pb-4 border-b"> {/* Add padding back here */}
          <SheetTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-primary" />
            <span>Note for {surahName} {ayahDisplay}</span>
             {/* Optional: Display absolute verse number too */}
             <span className="text-sm text-muted-foreground">({currentAbsoluteVerseNumber})</span>
          </SheetTitle>
          <SheetDescription>
            Add reflections and tag concepts. Saved locally.
          </SheetDescription>
        </SheetHeader>

        {/* Main Content Area - Scrollable */}
        <ScrollArea className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6"> {/* Add padding back to content */}
              {isLoadingData ? (
                <div className="flex justify-center items-center h-[200px]">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Note Content Section */}
                  <div>
                    <Label htmlFor="note-content">Note</Label>
                    <RichTextEditorPlaceholder
                      value={noteContent}
                      onChange={setNoteContent}
                      disabled={isSaving}
                    />
                  </div>

                  {/* Concept Tagging Section */}
                   <div>
                      <Label htmlFor="concepts-display">Concepts</Label>
                       <div className="mt-2 flex flex-wrap gap-2 items-center">
                         {verseConceptIds.map(conceptId => (
                           <Badge key={conceptId} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-0.5">
                             <span className="text-xs">{getConceptName(conceptId)}</span>
                             <button
                               onClick={() => handleConceptToggle(conceptId)}
                               className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 disabled:opacity-50"
                               aria-label={`Remove concept ${getConceptName(conceptId)}`}
                               disabled={isSaving}
                             >
                               <XCircle className="h-3 w-3" />
                             </button>
                           </Badge>
                         ))}

                        {/* Concept Selector Popover */}
                         <Popover open={conceptSelectorOpen} onOpenChange={setConceptSelectorOpen}>
                           <PopoverTrigger asChild>
                             <Button
                               variant="outline"
                               size="sm"
                               className="h-7 px-2 py-0.5 text-xs"
                               disabled={isSaving}
                               aria-label="Add concept tag"
                             >
                               <Plus className="h-3 w-3 mr-1" /> Add Concept
                             </Button>
                           </PopoverTrigger>
                           <PopoverContent className="w-[250px] p-0" align="start">
                              <Command>
                                 <CommandInput placeholder="Search concepts..." />
                                 <CommandList>
                                    <CommandEmpty>No concepts found.</CommandEmpty>
                                     <CommandGroup>
                                       {allConcepts.map((concept) => (
                                         <CommandItem
                                           key={concept.id}
                                           value={concept.name} // Use name for search/filtering
                                           onSelect={() => {
                                             handleConceptToggle(concept.id);
                                             setConceptSelectorOpen(false);
                                           }}
                                           className="text-sm"
                                           disabled={isSaving}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                verseConceptIds.includes(concept.id)
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            {concept.name}
                                         </CommandItem>
                                       ))}
                                     </CommandGroup>
                                 </CommandList>
                              </Command>
                           </PopoverContent>
                         </Popover>

                         {verseConceptIds.length === 0 && (
                           <p className="text-xs text-muted-foreground italic">No concepts tagged yet.</p>
                         )}
                       </div>
                   </div>


                  {/* Display Timestamps if note exists */}
                  {currentNote && (
                      <div className="text-xs text-muted-foreground mt-4 border-t pt-2">
                        <p>Created: {new Date(currentNote.createdAt).toLocaleString()}</p>
                        <p>Updated: {new Date(currentNote.updatedAt).toLocaleString()}</p>
                      </div>
                  )}
                </>
              )}
          </div>
        </ScrollArea>

        {/* Footer with Actions */}
        <SheetFooter className="p-6 pt-4 border-t flex justify-between"> {/* Adjusted for space-between */}
           {/* Delete Button (only show if note or concepts exist) */}
           {hasExistingNoteData ? (
              <Button
                  variant="destructive"
                  onClick={handleDeleteNote} // Note: This only deletes the text note currently
                  disabled={isSaving || isLoadingData || !currentNote} // Disable if no text note exists
                  size="sm"
                  aria-label="Delete Note Text"
              >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete Note
              </Button>
           ) : (
                <div /> // Placeholder to keep spacing consistent
           )}

           <div className="flex gap-2"> {/* Group Cancel and Save */}
              <SheetClose asChild>
                 <Button variant="outline" disabled={isSaving} size="sm">Cancel</Button>
              </SheetClose>
              <Button onClick={handleSaveNote} disabled={isSaving || isLoadingData || !canSaveNoteText} size="sm">
                 {isSaving ? (
                   <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving... </>
                 ) : (
                   <> <Save className="mr-2 h-4 w-4" /> Save Note </>
                 )}
              </Button>
           </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Helper to check if a note *object* exists OR concepts are tagged
// Moved to notes.ts and imported
import { checkNoteExists } from '@/services/notes';

