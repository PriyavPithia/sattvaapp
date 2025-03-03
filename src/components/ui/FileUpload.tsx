import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface FileUploadProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: Record<string, string[]>;
  disabled?: boolean;
}

export function FileUpload({ 
  onUpload, 
  maxFiles = 5, 
  maxSize = 10485760, // 10MB default
  accept,
  disabled = false
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const fileList = e.target.files;
    if (fileList) {
      processFiles(Array.from(fileList));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    if (disabled) return;
    
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(false);
    
    const fileList = e.dataTransfer.files;
    if (fileList) {
      processFiles(Array.from(fileList));
    }
  };

  const processFiles = (newFiles: File[]) => {
    if (disabled) return;
    
    // Check if adding these files would exceed the max files limit
    if (selectedFiles.length + newFiles.length > maxFiles) {
      toast({
        title: "Too Many Files",
        description: `You can only upload a maximum of ${maxFiles} files at once.`,
        variant: "destructive"
      });
      return;
    }
    
    // Filter files based on size and type
    const validFiles = newFiles.filter(file => {
      // Check file size
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `File "${file.name}" exceeds the maximum size of ${formatFileSize(maxSize)}.`,
          variant: "destructive"
        });
        return false;
      }
      
      // Check file type if accept is provided
      if (accept) {
        const fileType = file.type;
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        
        // Check if the file type is in the accept object
        const isAccepted = Object.entries(accept).some(([mimeType, extensions]) => {
          return fileType === mimeType || extensions.includes(fileExtension);
        });
        
        if (!isAccepted) {
          toast({
            title: "Invalid File Type",
            description: `File "${file.name}" is not an accepted file type.`,
            variant: "destructive"
          });
          return false;
        }
      }
      
      return true;
    });
    
    // Add valid files to the selected files
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    if (disabled) return;
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (disabled || selectedFiles.length === 0) return;
    
    onUpload(selectedFiles);
    setSelectedFiles([]);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept={accept ? Object.entries(accept).flatMap(([type, exts]) => [type, ...exts]).join(',') : undefined}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center justify-center space-y-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-medium">
            Drag and drop files here, or click to select files
          </div>
          <div className="text-xs text-muted-foreground">
            Supports {accept ? Object.values(accept).flat().join(', ') : 'all file types'} (Max: {formatFileSize(maxSize)})
          </div>
        </div>
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Selected Files ({selectedFiles.length}/{maxFiles})</div>
          
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <Button 
            onClick={handleUpload} 
            className="w-full"
            disabled={selectedFiles.length === 0 || disabled}
          >
            Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'}
          </Button>
        </div>
      )}
    </div>
  );
}
