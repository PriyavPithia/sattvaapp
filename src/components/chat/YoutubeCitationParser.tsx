import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { FileText, Youtube, Play } from 'lucide-react';
import { formatTime } from '@/lib/youtubeService';
import type { FileRecord } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface YoutubeCitationParserProps {
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

export const YoutubeCitationParser: React.FC<YoutubeCitationParserProps> = ({
  content = '',
  references = [],
  knowledgebaseFiles = [],
  onReferenceClick,
}) => {
  // Log props for debugging
  useEffect(() => {
    console.log('YoutubeCitationParser props:', {
      contentLength: content?.length || 0,
      referencesCount: references?.length || 0,
      knowledgebaseFilesCount: knowledgebaseFiles?.length || 0
    });
    
    if (references?.length > 0) {
      console.log('YouTube References:', references.map(ref => ({
        fileId: ref.fileId,
        position: ref.position,
        textSnippet: ref.text?.substring(0, 50) + (ref.text?.length > 50 ? '...' : '')
      })));
    } else {
      console.log('No YouTube references provided to YoutubeCitationParser');
    }
    
    // Test the citation pattern
    const testContent = "This is a test ((1:123.45)) with a citation.";
    const testMatches = [];
    let testMatch;
    while ((testMatch = CITATION_PATTERN.exec(testContent)) !== null) {
      testMatches.push({
        match: testMatch[0],
        fileIndex: testMatch[1],
        timestamp: testMatch[2]
      });
    }
    console.log('Citation pattern test:', testMatches);
    
    // Reset regex lastIndex
    CITATION_PATTERN.lastIndex = 0;
  }, [content, references, knowledgebaseFiles]);
  
  // Create a map for quick lookup of references by fileId
  const referenceMap = new Map();
  references.forEach(ref => {
    if (ref && ref.fileId) {
      referenceMap.set(ref.fileId, ref);
    }
  });
  
  const renderCitationButton = (fileId: string, timestamp?: number) => {
    // Find the file in the knowledgebase files
    const file = knowledgebaseFiles.find(f => f.id === fileId);
    if (!file) {
      console.log(`File not found for fileId: ${fileId}`);
      return null;
    }
    
    // Skip non-YouTube files - this parser only handles YouTube
    if (file.type.toLowerCase() !== 'youtube') {
      return null;
    }
    
    // Get the reference for this file
    const reference = referenceMap.get(fileId);
    console.log(`Rendering citation button for ${file.name} (${file.type})`, { timestamp });
    
    // Determine the icon and label based on file type
    let icon = <FileText className="h-3 w-3 mr-1" />;
    let label = 'Text';
    
    if (file.type.toLowerCase() === 'youtube') {
      icon = <Youtube className="h-3 w-3 mr-1" />;
      label = 'YouTube';
      
      // For YouTube, ensure we have a timestamp (default to 0 if not provided)
      if (timestamp === undefined && reference?.position !== undefined) {
        timestamp = reference.position;
      } else if (timestamp === undefined) {
        timestamp = 0;
      }
      
      // Format the timestamp for display
      if (timestamp !== undefined) {
        const formattedTime = formatTime(timestamp);
        if (formattedTime) {
          label = `${label} ${formattedTime}`;
        }
        console.log(`Formatted timestamp ${timestamp} as ${formattedTime}`);
      }
    }
    
    // Create the reference object to pass to the click handler
    const referenceObj = {
      fileId,
      text: reference?.text || '',
      position: timestamp
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
  
  // Function to extract timestamp from text
  const extractTimestampFromText = (text: string): number | undefined => {
    // Try to extract timestamp from various formats
    
    // Format: [TIMESTAMP:123]
    const timestampMatch = text.match(/\[TIMESTAMP:(\d+(?:\.\d+)?)\]/);
    if (timestampMatch) {
      console.log(`Extracted timestamp from [TIMESTAMP:x] format: ${timestampMatch[1]}`);
      return parseFloat(timestampMatch[1]);
    }
    
    // Format: ((DOC_INDEX:123))
    const citationMatch = text.match(/\(\((\d+):(\d+(?:\.\d+)?)\)\)/);
    if (citationMatch) {
      console.log(`Extracted timestamp from ((x:y)) format: ${citationMatch[2]}`);
      return parseFloat(citationMatch[2]);
    }
    
    // Format: [123s]
    const secondsMatch = text.match(/\[(\d+(?:\.\d+)?)s\]/);
    if (secondsMatch) {
      console.log(`Extracted timestamp from [xs] format: ${secondsMatch[1]}`);
      return parseFloat(secondsMatch[1]);
    }
    
    // Try to parse MM:SS format
    const timeFormatMatch = text.match(/(\d+):(\d+)/);
    if (timeFormatMatch) {
      const minutes = parseInt(timeFormatMatch[1]);
      const seconds = parseInt(timeFormatMatch[2]);
      const timestamp = minutes * 60 + seconds;
      console.log(`Extracted timestamp from MM:SS format: ${timestamp}`);
      return timestamp;
    }
    
    return undefined;
  };
  
  const parseContentWithReferences = () => {
    if (!content) {
      console.log('No content to parse');
      return null;
    }
    
    const segments = [];
    let lastIndex = 0;
    let match;
    
    // Reset regex lastIndex
    CITATION_PATTERN.lastIndex = 0;
    
    console.log('Parsing content with references...');
    
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
          
          // Parse the timestamp if provided
          let timestamp: number | undefined;
          
          if (!isFileId && fileIdOrTimestamp && !isNaN(parseFloat(fileIdOrTimestamp))) {
            timestamp = parseFloat(fileIdOrTimestamp);
            console.log(`Parsed timestamp from citation: ${timestamp}`);
          } else if (file.type.toLowerCase() === 'youtube' || file.type.toLowerCase() === 'audio' || file.type.toLowerCase() === 'video') {
            // For media files, default to 0 if no timestamp is provided
            timestamp = 0;
          }
          
          // Add the citation button
          segments.push(
            <span key={`citation-${matchIndex}`}>
              {renderCitationButton(fileId, timestamp)}
            </span>
          );
        } else {
          console.log(`File not found for fileId: ${fileId}`);
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
  
  return parseContentWithReferences();
}; 