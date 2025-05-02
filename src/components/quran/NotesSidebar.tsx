
'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  // SheetTrigger, // Removed SheetTrigger import
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // Use Textarea for notes
import { Input } from '@/components/ui/input'; // For tags input
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge'; // To display tags
import { Notebook, Tag, Save, XCircle, Loader2, Edit2 } from 'lucide-react'; // Added icons
import { useToast } from '@/hooks/use-toast'; // Import useToast

// Placeholder for a simple rich text editor component (replace with actual implementation)
const RichTextEditorPlaceholder = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <Textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Start writing your notes here... Basic formatting (bold, italics) will be supported."
    className="min-h-[200px] text-sm" // Basic styling
  />
);

interface NotesSidebarProps {
  currentVerseNumber: number;
  surahName: string;
  ayahNumber: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // Add props for fetching/saving notes and tags if implementing backend
  // initialNote?: string;
  // initialTags?: string[];
  // onSave?: (note: string, tags: string[]) => Promise<void>;
}

export function NotesSidebar({
  currentVerseNumber,
  surahName,
  ayahNumber,
  isOpen,
  onOpenChange,
  // initialNote = '',
  // initialTags = [],
  // onSave
}: NotesSidebarProps) {
  const [noteContent, setNoteContent] = useState(''); // Replace with initialNote prop if available
  const [tags, setTags] = useState<string[]>([]); // Replace with initialTags prop if available
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Placeholder save function (replace with actual API call)
  const handleSave = async () => {
    setIsSaving(true);
    console.log("Saving Note:", noteContent);
    console.log("Saving Tags:", tags);
    // if (onSave) {
    //   try {
    //     await onSave(noteContent, tags);
    //     toast({ title: "Note Saved", description: `Note for verse ${currentVerseNumber} saved successfully.` });
    //     onOpenChange(false); // Close sidebar on successful save
    //   } catch (error) {
    //     console.error("Failed to save note:", error);
    //     toast({ title: "Save Failed", description: "Could not save the note. Please try again.", variant: "destructive" });
    //   } finally {
    //     setIsSaving(false);
    //   }
    // } else {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({ title: "Note Saved (Simulated)", description: `Note for ${surahName} ${ayahNumber} would be saved.` });
      setIsSaving(false);
      onOpenChange(false); // Close sidebar
    // }
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim();
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

  // --- Note Indicator Logic (Placeholder) ---
  // In a real app, this would check if a note exists for the current verse
  const hasNote = noteContent.length > 0 || tags.length > 0; // Simple check based on current state

  return (
     // The Sheet component itself is still used, but it's controlled by the isOpen prop
     <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {/* The SheetTrigger is removed from here. The FAB in ReaderView now controls the 'isOpen' state. */}
      <SheetContent className="sm:max-w-lg flex flex-col"> {/* Increase max width and make flex column */}
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
             <Edit2 className="h-5 w-5 text-primary" />
             <span>Note for {surahName} {ayahNumber}</span> ({currentVerseNumber})
          </SheetTitle>
          <SheetDescription>
            Add your reflections and tag concepts related to this verse.
          </SheetDescription>
        </SheetHeader>

        {/* Main Content Area */}
        <div className="flex-grow py-4 space-y-4 overflow-y-auto pr-2"> {/* Add scroll */}
          {/* Rich Text Editor */}
          <div>
            <Label htmlFor="note-content">Note</Label>
            <RichTextEditorPlaceholder value={noteContent} onChange={setNoteContent} />
             {/* Add actual Rich Text Editor toolbar here */}
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
              />
              <Button onClick={handleAddTag} size="sm" variant="outline" aria-label="Add Tag">
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
                  >
                    <XCircle className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {tags.length === 0 && <p className="text-xs text-muted-foreground">No tags added yet.</p>}
            </div>
          </div>
        </div>

        {/* Footer with Actions */}
        <SheetFooter className="mt-auto border-t pt-4"> {/* Stick footer to bottom */}
          <SheetClose asChild>
            <Button variant="outline" disabled={isSaving}>Cancel</Button>
          </SheetClose>
          <Button onClick={handleSave} disabled={isSaving}>
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
