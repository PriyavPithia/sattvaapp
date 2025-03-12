import React from 'react';
import { FileText, Youtube, Headphones, Video, FileIcon, Globe } from 'lucide-react';
import type { FileRecord } from '@/lib/supabase';

interface CitationsListProps {
  references: {
    fileId: string;
    text: string;
    position?: number;
  }[];
  knowledgebaseFiles: FileRecord[];
  onReferenceClick: (reference: { fileId: string; text: string; position?: number }) => void;
  onSourceClick: (fileId: string) => void;
}

export const CitationsList: React.FC<CitationsListProps> = ({
  references,
  knowledgebaseFiles,
  onReferenceClick,
  onSourceClick
}) => {
  console.log('CitationsList props:', {
    referencesCount: references?.length || 0,
    knowledgebaseFilesCount: knowledgebaseFiles?.length || 0
  });
  
  if (!references || references.length === 0 || !Array.isArray(knowledgebaseFiles) || knowledgebaseFiles.length === 0) {
    console.log('No references or knowledgebase files to display');
    return null;
  }
  
  // Create a map to deduplicate references by fileId
  const uniqueFiles = new Map<string, FileRecord>();
  
  // Add each file to the map
  references.forEach(reference => {
    if (!reference || !reference.fileId) {
      console.log('Invalid reference:', reference);
      return;
    }
    
    const file = knowledgebaseFiles.find(f => f.id === reference.fileId);
    if (file && !uniqueFiles.has(file.id)) {
      console.log('Adding file to sources:', file.name, file.type);
      uniqueFiles.set(file.id, file);
    } else if (!file) {
      console.log('File not found for reference:', reference.fileId);
    }
  });
  
  // Convert the map to an array
  const uniqueFilesList = Array.from(uniqueFiles.values());
  
  if (uniqueFilesList.length === 0) {
    console.log('No unique files to display');
    return null;
  }
  
  console.log('Displaying sources:', uniqueFilesList.map(f => f.name));
  
  return (
    <div className="mt-4 border-t border-sattva-200 pt-2">
      <h4 className="text-sm font-medium text-sattva-700 mb-2">Sources:</h4>
      <ul className="space-y-1">
        {uniqueFilesList.map(file => {
          // Determine the icon based on file type
          let Icon = FileText;
          if (file.type?.toLowerCase() === 'youtube') {
            Icon = Youtube;
          } else if (file.type?.toLowerCase() === 'audio') {
            Icon = Headphones;
          } else if (file.type?.toLowerCase() === 'video') {
            Icon = Video;
          } else if (file.type?.toLowerCase() === 'website') {
            Icon = Globe;
          }
          
          return (
            <li key={file.id} className="flex items-center">
              <button
                className="flex items-center text-xs text-sattva-600 hover:text-sattva-800 hover:underline"
                onClick={() => onSourceClick(file.id)}
              >
                <Icon className="h-3 w-3 mr-1" />
                <span className="truncate max-w-[300px]">{file.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}; 