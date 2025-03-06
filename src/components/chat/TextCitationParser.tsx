import React, { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { FileText, Youtube, Play, Headphones, Video } from 'lucide-react';
import { formatTime } from '@/lib/youtubeService';
import type { FileRecord } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TextCitationParserProps {
  content: string;
  references?: {
    fileId: string;
    text: string;
    position?: number;
  }[];
  knowledgebaseFiles: FileRecord[];
  onReferenceClick: (reference: { fileId: string; text?: string; position?: number }) => void;
}

// Regex pattern for citation format
const CITATION_PATTERN = /\(\((\d+)(?::([a-zA-Z0-9\-]+))?\)\)/g;

export const TextCitationParser: React.FC<TextCitationParserProps> = ({
  content = '',
  references = [],
  knowledgebaseFiles = [],
  onReferenceClick,
}) => {
  // Create a ref to the content container for highlighting
  const contentRef = useRef<HTMLDivElement>(null);

  // Log props for debugging
  useEffect(() => {
    console.log('TextCitationParser props:', {
      contentLength: content?.length || 0,
      referencesCount: references?.length || 0,
      knowledgebaseFilesCount: knowledgebaseFiles?.length || 0
    });
    
    if (references?.length > 0) {
      console.log('References:', references.map(ref => ({
        fileId: ref.fileId,
        position: ref.position,
        textSnippet: ref.text?.substring(0, 50) + (ref.text?.length > 50 ? '...' : '')
      })));
    } else {
      console.log('No references provided to TextCitationParser');
    }
  }, [content, references, knowledgebaseFiles]);

  if (!content) return null;

  // Create a map of fileIds to references for quick lookup
  const referenceMap = new Map();
  
  // Only iterate if references is an array
  if (Array.isArray(references)) {
    references.forEach(ref => {
      if (ref && ref.fileId) {
        referenceMap.set(ref.fileId, ref);
      }
    });
  }

  // Function to render a citation button for non-YouTube files
  const renderCitationButton = (fileId: string, textSnippet?: string) => {
    // Find the file in the knowledgebase files
    const file = knowledgebaseFiles.find(f => f.id === fileId);
    if (!file) {
      console.log(`File not found for fileId: ${fileId}`);
      return null;
    }
    
    // Skip YouTube files - this parser only handles non-YouTube files
    if (file.type.toLowerCase() === 'youtube') {
      return null;
    }
    
    // Get the reference for this file
    const reference = referenceMap.get(fileId);
    console.log(`Rendering citation button for ${file.name} (${file.type})`);
    
    // Determine the icon and label based on file type
    let icon = <FileText className="h-3 w-3 mr-1" />;
    let label = file.type || 'Text';
    
    // Convert the file type to a more readable format
    if (file.type) {
      const type = file.type.toLowerCase();
      console.log(`Processing file type: "${type}" for file: ${file.name}`);
      
      if (type === 'audio' || type.includes('audio/') || 
          type === 'mp3' || type.includes('mpeg') || 
          file.name?.toLowerCase().endsWith('.mp3') ||
          file.name?.toLowerCase().endsWith('.wav') ||
          file.name?.toLowerCase().endsWith('.ogg') ||
          file.name?.toLowerCase().endsWith('.m4a')) {
        icon = <Headphones className="h-3 w-3 mr-1" />;
        label = 'Audio';
        
        // For audio, ensure we have a timestamp (default to 0 if not provided)
        if (reference?.position !== undefined) {
          const formattedTime = formatTime(reference.position);
          if (formattedTime) {
            label = `${label} ${formattedTime}`;
          }
        }
      } else if (type === 'video' || type.includes('video/')) {
        icon = <Video className="h-3 w-3 mr-1" />;
        label = 'Video';
        
        // For video, ensure we have a timestamp (default to 0 if not provided)
        if (reference?.position !== undefined) {
          const formattedTime = formatTime(reference.position);
          if (formattedTime) {
            label = `${label} ${formattedTime}`;
          }
        }
      } else if (type === 'pdf' || type.includes('application/pdf')) {
        icon = <FileText className="h-3 w-3 mr-1" />;
        label = 'PDF';
      } else if (
        type === 'ppt' || 
        type === 'pptx' || 
        type.includes('presentation') || 
        type.includes('powerpoint') ||
        type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.name?.toLowerCase().endsWith('.ppt') ||
        file.name?.toLowerCase().endsWith('.pptx')
      ) {
        icon = <FileText className="h-3 w-3 mr-1" />;
        label = 'PPT';
      } else if (
        type === 'doc' || 
        type === 'docx' || 
        type.includes('document') || 
        type.includes('word') ||
        type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name?.toLowerCase().endsWith('.doc') ||
        file.name?.toLowerCase().endsWith('.docx')
      ) {
        icon = <FileText className="h-3 w-3 mr-1" />;
        label = 'DOC';
      } else if (
        type === 'xls' || 
        type === 'xlsx' || 
        type.includes('spreadsheet') || 
        type.includes('excel') ||
        type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.name?.toLowerCase().endsWith('.xls') ||
        file.name?.toLowerCase().endsWith('.xlsx')
      ) {
        icon = <FileText className="h-3 w-3 mr-1" />;
        label = 'XLS';
      } else if (
        type === 'txt' || 
        type.includes('text/plain') ||
        file.name?.toLowerCase().endsWith('.txt')
      ) {
        icon = <FileText className="h-3 w-3 mr-1" />;
        label = 'TXT';
      } else {
        // For any other file type, try to extract a simple label from the file name or type
        const fileExtMatch = file.name?.match(/\.([^.]+)$/);
        if (fileExtMatch && fileExtMatch[1]) {
          // Use the file extension from the name
          label = fileExtMatch[1].toUpperCase();
        } else {
          // Try to extract a simple label from the MIME type
          const mimeMatch = type.match(/\/([^.]+)$/);
          if (mimeMatch && mimeMatch[1]) {
            label = mimeMatch[1].toUpperCase();
          } else {
            // Fallback to a generic label
            label = 'File';
          }
        }
      }
    }
    
    // Create the reference object to pass to the click handler
    const referenceObj = {
      fileId,
      text: reference?.text || '',
      position: reference?.position
    };
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-sattva-100 text-sattva-700 hover:bg-sattva-200 transition-colors mx-1 citation-button"
              onClick={() => onReferenceClick(referenceObj)}
            >
              {icon}
              <span>{label}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="tooltip-content">
            <div className="p-2 max-w-md">
              <p className="font-medium text-sm">{file.name}</p>
              {reference?.text && (
                <p className="text-xs text-gray-600 mt-1 line-clamp-6">
                  "{reference.text}"
                </p>
              )}
              <div className="mt-2 text-xs bg-gray-50 p-1 rounded">
                Click to view in context
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Split content into segments with references
  const parseContentWithReferences = () => {
    if (!content) {
      console.log('No content to parse');
      return null;
    }
    
    // Filter out YouTube references - this parser only handles non-YouTube files
    const nonYoutubeReferences = references.filter(ref => {
      const file = knowledgebaseFiles.find(f => f.id === ref.fileId);
      return file && file.type.toLowerCase() !== 'youtube';
    });
    
    // If there are no non-YouTube references, return the content as is
    if (nonYoutubeReferences.length === 0) {
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      );
    }
    
    const segments = [];
    let lastIndex = 0;
    let match;
    
    // Reset regex lastIndex
    CITATION_PATTERN.lastIndex = 0;
    
    console.log('Parsing content with non-YouTube references...');
    
    while ((match = CITATION_PATTERN.exec(content)) !== null) {
      const [fullMatch, fileIndex, fileIdOrTimestamp] = match;
      const matchIndex = match.index;
      
      console.log(`Found citation match: ${fullMatch} at index ${matchIndex}`, { fileIndex, fileIdOrTimestamp });
      
      // Add text before the citation
      if (matchIndex > lastIndex) {
        const textBefore = content.substring(lastIndex, matchIndex);
        segments.push(
          <ReactMarkdown 
            key={`text-${lastIndex}`} 
            remarkPlugins={[remarkGfm]}
          >
            {textBefore}
          </ReactMarkdown>
        );
      }
      
      // Check if the second part is a fileId (UUID format)
      const isFileId = fileIdOrTimestamp && /^[a-f0-9\-]{36}$/i.test(fileIdOrTimestamp);
      
      // Get the reference based on the file index or fileId
      let fileId;
      
      if (isFileId) {
        // Use the fileId directly
        fileId = fileIdOrTimestamp;
        console.log(`Using direct fileId: ${fileId}`);
      } else {
        // Use the index to find the fileId
        fileId = references[parseInt(fileIndex) - 1]?.fileId;
        console.log(`Using fileId from index ${fileIndex}: ${fileId}`);
      }
      
      if (fileId) {
        // Find the file
        const file = knowledgebaseFiles.find(f => f.id === fileId);
        
        if (file) {
          console.log(`Found file for citation: ${file.name} (${file.type})`);
          
          // Skip YouTube files - this parser only handles non-YouTube files
          if (file.type.toLowerCase() === 'youtube') {
            // Just add the original citation text for YouTube files
            segments.push(
              <span key={`citation-text-${matchIndex}`}>
                {fullMatch}
              </span>
            );
          } else {
            // Add the citation button for non-YouTube files
            segments.push(
              <span key={`citation-${matchIndex}`}>
                {renderCitationButton(fileId)}
              </span>
            );
          }
        } else {
          console.log(`File not found for fileId: ${fileId}`);
          // If no file is found, just add the original citation text
          segments.push(
            <span key={`citation-text-${matchIndex}`}>
              {fullMatch}
            </span>
          );
        }
      } else {
        console.log(`No reference found for index: ${fileIndex}`);
        // If no reference is found, just add the original citation text
        segments.push(
          <span key={`citation-text-${matchIndex}`}>
            {fullMatch}
          </span>
        );
      }
      
      lastIndex = matchIndex + fullMatch.length;
    }
    
    // Add any remaining text
    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex);
      segments.push(
        <ReactMarkdown 
          key={`text-${lastIndex}`} 
          remarkPlugins={[remarkGfm]}
        >
          {textAfter}
        </ReactMarkdown>
      );
    }
    
    return (
      <div className="content-with-citations">
        {segments.length > 0 ? segments : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        )}
      </div>
    );
  };

  return <>{parseContentWithReferences()}</>;
}; 