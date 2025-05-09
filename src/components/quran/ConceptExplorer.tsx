import React, { useState, useEffect } from 'react';
import { getAllConcepts, getConceptsForVerse, tagVerseWithConcepts, untagVerseConcepts } from '@/services/concepts';

interface Concept {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface ConceptExplorerProps {
  surah: number;
  verse: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ConceptExplorer: React.FC<ConceptExplorerProps> = ({
  surah,
  verse,
  isOpen,
  onClose
}) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Load all available concepts
    const loadConcepts = async () => {
      try {
        const allConcepts = await getAllConcepts();
        setConcepts(allConcepts);
      } catch (error) {
        console.error('Error loading concepts:', error);
      }
    };

    loadConcepts();
  }, []);

  useEffect(() => {
    // Load concepts for this verse
    if (surah && verse) {
      const loadVerseConcepts = async () => {
        try {
          const verseConcepts = await getConceptsForVerse(surah, verse);
          setSelectedConcepts(verseConcepts.map(c => c.id));
        } catch (error) {
          console.error('Error loading verse concepts:', error);
        }
      };

      loadVerseConcepts();
    }
  }, [surah, verse]);

  const toggleConcept = (conceptId: string) => {
    setSelectedConcepts(prev => 
      prev.includes(conceptId) 
        ? prev.filter(id => id !== conceptId)
        : [...prev, conceptId]
    );
  };

  const handleSaveConcepts = async () => {
    if (!surah || !verse) return;
    
    setIsSaving(true);
    try {
      // Clear existing concept tags
      await untagVerseConcepts(surah, verse);
      
      // Add selected concept tags
      if (selectedConcepts.length > 0) {
        await tagVerseWithConcepts(surah, verse, selectedConcepts);
      }
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving concepts:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-gray-800 text-white p-4 shadow-lg z-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Concepts for {surah}:{verse}</h3>
        <button 
          onClick={onClose}
          className="text-white hover:text-gray-300"
        >
          ✕
        </button>
      </div>
      
      <div className="mb-4">
        <h4 className="text-md font-semibold mb-2">Available Concepts:</h4>
        <div className="flex flex-col gap-2">
          {concepts.map(concept => (
            <div 
              key={concept.id}
              className="flex items-center"
            >
              <input
                type="checkbox"
                id={`concept-${concept.id}`}
                checked={selectedConcepts.includes(concept.id)}
                onChange={() => toggleConcept(concept.id)}
                className="mr-2"
              />
              <label 
                htmlFor={`concept-${concept.id}`}
                className="flex items-center"
              >
                <span 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: concept.color }}
                ></span>
                {concept.name}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        {saveSuccess && (
          <span className="text-green-400 text-sm">Concepts saved!</span>
        )}
        
        <button
          onClick={handleSaveConcepts}
          disabled={isSaving}
          className={`px-4 py-2 rounded ${
            isSaving 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save Concepts'}
        </button>
      </div>
    </div>
  );
};