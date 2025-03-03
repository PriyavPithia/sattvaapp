import React from 'react';
import { FileText, Youtube, Play, FileIcon, BookOpen, File, Music } from 'lucide-react';

interface ReferenceLinkProps {
  reference: {
    fileId: string;
    position?: number;
    type?: string;
    sourceId?: string;
  };
  file?: {
    id: string;
    name: string;
    type: string;
  } | null;
  onClick: (reference: any) => void;
}

/**
 * Format seconds into a readable time format (MM:SS)
 */
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Component for displaying a reference link with appropriate icon and styling
 */
export const ReferenceLink: React.FC<ReferenceLinkProps> = ({ reference, file, onClick }) => {
  // Determine the file type, either from the reference type or the file type
  const fileType = reference.type?.toLowerCase() || (file ? file.type.toLowerCase() : 'unknown');
  
  // Determine the appropriate styling based on file type
  const getStylesByType = () => {
    const type = reference.type || (file?.type.toLowerCase() || 'document');
    
    switch (type) {
      case 'youtube':
        return 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50';
      case 'video':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50';
      case 'audio':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50';
      case 'pdf':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50';
      case 'document':
      case 'docx':
      case 'doc':
        return 'bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';
    }
  };
  
  // Get the appropriate icon based on file type
  const getIcon = () => {
    const type = reference.type || (file?.type.toLowerCase() || 'document');
    
    switch (type) {
      case 'youtube':
        return <Play className="h-2 w-2 mr-1" />;
      case 'video':
        return <Play className="h-2 w-2 mr-1" />;
      case 'audio':
        return <Music className="h-2 w-2 mr-1" />;
      case 'pdf':
        return <FileText className="h-2 w-2 mr-1" />;
      case 'document':
      case 'docx':
      case 'doc':
        return <FileText className="h-2 w-2 mr-1" />;
      default:
        return <File className="h-2 w-2 mr-1" />;
    }
  };
  
  // Get the display text for the reference
  const getDisplayText = () => {
    const type = reference.type || (file?.type.toLowerCase() || 'document');
    
    if (type === 'youtube' || type === 'video') {
      return (
        <span className="flex items-center">
          {getIcon()}
          {reference.position !== undefined ? formatTime(reference.position) : '0:00'}
        </span>
      );
    }
    
    if (file?.name) {
      // Truncate long file names
      const maxLength = 15;
      return file.name.length > maxLength 
        ? `${file.name.substring(0, maxLength)}...` 
        : file.name;
    }
    
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  
  // Get the title/tooltip text
  const getTitle = () => {
    const type = reference.type || (file?.type.toLowerCase() || 'document');
    
    if (type === 'youtube' || type === 'video') {
      const timestamp = reference.position !== undefined ? formatTime(reference.position) : '0:00';
      return `Play video at ${timestamp}`;
    }
    return `View reference${file?.name ? `: ${file.name}` : ''}`;
  };
  
  return (
    <button
      onClick={() => onClick(reference)}
      className={`inline-flex items-center px-2 py-1 rounded text-xs transition-colors ${getStylesByType()}`}
      title={getTitle()}
    >
      {getIcon()}
      {getDisplayText()}
    </button>
  );
};

export default ReferenceLink; 