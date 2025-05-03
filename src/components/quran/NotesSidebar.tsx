
'use client';

import React, { useState, useEffect } from 'react';
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
import { Notebook, Tag, Save, XCircle, Loader2, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Note } from '@/services/notes'; // Import Note type
import { saveNote, getNoteForVerse } from '@/services/notes'; // Import note service functions
import { absoluteVerseToSurahAyah } from '@/services/alquran-cloud'; // To get surah/ayah from absolute
import type { QuranMeta } from '@/services/alquran-cloud';

// Placeholder for a simple rich text editor component (replace with actual implementation)
const RichTextEditorPlaceholder = ({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) => (
  <Textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Start writing your notes here..."
    className="min-h-[200px] text-sm"
    disabled={disabled}
  />
);

interface NotesSidebarProps {
  currentAbsoluteVerseNumber: number; // Use absolute verse number as the key
  quranMeta: QuranMeta | null; // Need metadata to get surah/ayah info
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // Removed props related to backend saving
}

export function NotesSidebar({
  currentAbsoluteVerseNumber,
  quranMeta,
  isOpen,
  onOpenChange,
}: NotesSidebarProps) {
  const [noteContent, setNoteContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null); // Store the loaded note
  const { toast } = useToast();

  const verseLocation = absoluteVerseToSurahAyah(currentAbsoluteVerseNumber, quranMeta);
  const surahNumber = verseLocation?.surahNumber;
  const ayahNumberInSurah = verseLocation?.ayahNumber;
  const surahName = verseLocation?.surahMeta?.englishName ?? '';
  const ayahDisplay = verseLocation ? `${verseLocation.surahNumber}:${verseLocation.ayahNumber}` : '?';

  // Fetch note when sidebar opens or verse changes
  useEffect(() => {
    if (isOpen && currentAbsoluteVerseNumber > 0) {
      setIsLoadingNote(true);
      // Ensure this runs client-side
      if (typeof window !== 'undefined') {
        const existingNote = getNoteForVerse(currentAbsoluteVerseNumber);
        if (existingNote) {
          setNoteContent(existingNote.noteText);
          setTags(existingNote.tags);
          setCurrentNote(existingNote);
          console.log(`Loaded note for verse ${currentAbsoluteVerseNumber}:`, existingNote);
        } else {
          setNoteContent(''); // Clear previous note if none exists for current verse
          setTags([]);
          setCurrentNote(null);
          console.log(`No note found for verse ${currentAbsoluteVerseNumber}.`);
        }
      }
      setIsLoadingNote(false);
    } else if (!isOpen) {
       // Optionally clear state when closing
       // setNoteContent('');
       // setTags([]);
       // setCurrentNote(null);
    }
  }, [isOpen, currentAbsoluteVerseNumber]);

  // Save note function using the imported service
  const handleSave = () => {
    if (!surahNumber || !ayahNumberInSurah || isLoadingNote) return;

    setIsSaving(true);
    console.log(`Attempting to save note for verse ${currentAbsoluteVerseNumber} (${surahNumber}:${ayahNumberInSurah})`);
    console.log("Content:", noteContent);
    console.log("Tags:", tags);

    const savedNote = saveNote(
      currentAbsoluteVerseNumber,
      surahNumber,
      ayahNumberInSurah,
      noteContent,
      tags
      // isPrivate can be added later if needed
    );

    setIsSaving(false);

    if (savedNote) {
      setCurrentNote(savedNote); // Update local state with the saved note (including timestamps)
      toast({
        title: "Note Saved",
        description: `Your note for ${surahName} ${ayahDisplay} has been saved locally.`,
      });
      onOpenChange(false); // Close sidebar on successful save
    } else {
      console.error("Failed to save note via service.");
      toast({
        title: "Save Failed",
        description: "Could not save the note. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase(); // Normalize tags
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
    }
    setTagInput(''); // Clear input after adding
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); // Prevent form submission or comma input
      handleAddTag();
    }
  };

  // Note indicator logic (simple check based on current state)
  const hasNote = noteContent.length > 0 || tags.length > 0;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-primary" />
            <span>Note for {surahName} {ayahDisplay}</span>
             {/* Optional: Display absolute verse number too */}
             {/* <span className="text-sm text-muted-foreground">({currentAbsoluteVerseNumber})</span> */}
          </SheetTitle>
          <SheetDescription>
            Add your reflections and tag concepts related to this verse. Notes are saved locally.
          </SheetDescription>
        </SheetHeader>

        {/* Main Content Area */}
        <div className="flex-grow py-4 space-y-4 overflow-y-auto pr-2">
          {isLoadingNote ? (
             <div className="flex justify-center items-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
             </div>
          ) : (
            <>
              {/* Rich Text Editor */}
              <div>
                <Label htmlFor="note-content">Note</Label>
                <RichTextEditorPlaceholder
                   value={noteContent}
                   onChange={setNoteContent}
                   disabled={isSaving}
                 />
              </div>

              {/* Tagging Section */}
              <div>
                <Label htmlFor="tag-input">Tags</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tag-input"
                    value={tagInput}
                    onChange={handleTagInputChange}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Add tags (e.g., patience, faith)"
                    className="flex-grow"
                    aria-label="Add tags"
                    disabled={isSaving}
                  />
                  <Button onClick={handleAddTag} size="sm" variant="outline" aria-label="Add Tag" disabled={isSaving}>
                    <Tag className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                {/* Display Tags */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                        aria-label={`Remove tag ${tag}`}
                        disabled={isSaving}
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {tags.length === 0 && <p className="text-xs text-muted-foreground">No tags added yet.</p>}
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

        {/* Footer with Actions */}
        <SheetFooter className="mt-auto border-t pt-4">
          <SheetClose asChild>
            <Button variant="outline" disabled={isSaving}>Cancel</Button>
          </SheetClose>
          <Button onClick={handleSave} disabled={isSaving || isLoadingNote}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
               <>
                 <Save className="mr-2 h-4 w-4" /> Save Note
               </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
