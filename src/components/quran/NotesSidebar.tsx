import React, { useState, useEffect } from 'react';
import { saveNote, getNoteForVerse } from '@/services/notes';

interface NotesSidebarProps {
  surah: number;
  verse: number;
  isOpen: boolean;
  onClose: () => void;
}

export const NotesSidebar: React.FC<NotesSidebarProps> = ({ 
  surah, 
  verse, 
  isOpen, 
  onClose 
}) => {
  const [noteContent, setNoteContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (surah && verse) {
      // Load existing note if any
      const loadNote = async () => {
        try {
          const note = await getNoteForVerse(surah, verse);
          if (note) {
            setNoteContent(note.content);
          } else {
            setNoteContent('');
          }
        } catch (error) {
          console.error('Error loading note:', error);
        }
      };
      
      loadNote();
    }
  }, [surah, verse]);

  const handleSaveNote = async () => {
    if (!surah || !verse) return;
    
    setIsSaving(true);
    try {
      await saveNote(surah, verse, noteContent);
      setSaveSuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-gray-800 text-white p-4 shadow-lg z-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Notes for {surah}:{verse}</h3>
        <button 
          onClick={onClose}
          className="text-white hover:text-gray-300"
        >
          ✕
        </button>
      </div>
      
      <textarea
        value={noteContent}
        onChange={(e) => setNoteContent(e.target.value)}
        placeholder="Write your notes here..."
        className="w-full h-64 p-2 bg-gray-700 text-white border border-gray-600 rounded"
      />
      
      <div className="mt-4 flex justify-between items-center">
        {saveSuccess && (
          <span className="text-green-400 text-sm">Note saved successfully!</span>
        )}
        
        <button
          onClick={handleSaveNote}
          disabled={isSaving}
          className={`px-4 py-2 rounded ${
            isSaving 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save Note'}
        </button>
      </div>
    </div>
  );
};