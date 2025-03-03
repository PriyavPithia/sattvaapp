import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { knowledgebaseService } from '@/lib/knowledgebaseService';
import { toast } from 'sonner';
import { FileText, Search, Trash, ArrowLeft, Upload, Code, Edit } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import { FileContentViewer } from './FileContentViewer';
import type { FileRecord } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface KnowledgebaseFilesProps {
  knowledgebaseId: string;
  knowledgebaseTitle: string;
  onBack: () => void;
  onAddFiles: () => void;
}

export function KnowledgebaseFiles({ 
  knowledgebaseId, 
  knowledgebaseTitle, 
  onBack,
  onAddFiles
}: KnowledgebaseFilesProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugFile, setDebugFile] = useState<FileRecord | null>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<FileRecord | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchFiles();
  }, [knowledgebaseId]);

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const filesData = await knowledgebaseService.getKnowledgebaseFiles(knowledgebaseId);
      setFiles(filesData);
      
      // Log all files and their content to console for debugging
      console.log('Files loaded:', filesData.length);
      filesData.forEach(file => {
        console.log(`File: ${file.name} (${file.id})`);
        console.log(`Content length: ${file.content_text?.length || 0} characters`);
        console.log(`Content preview: ${file.content_text?.substring(0, 200)}...`);
        console.log('---');
      });
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to load files",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteFile = (fileId: string) => {
    setFileToDelete(fileId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    
    try {
      setIsLoading(true);
      await knowledgebaseService.deleteFile(fileToDelete);
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
      
      // Remove the file from the local state
      setFiles(files.filter(file => file.id !== fileToDelete));
      setFileToDelete(null);
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewFileDetails = (fileId: string) => {
    setSelectedFileId(fileId);
    setIsViewerOpen(true);
  };

  const handleRenameFile = (file: FileRecord) => {
    setFileToRename(file);
    setNewFileName(file.name);
    setIsRenameDialogOpen(true);
  };

  const submitRename = async () => {
    if (!fileToRename || !newFileName.trim()) return;
    
    try {
      setIsLoading(true);
      // In a real implementation, you would call an API to update the file name
      // For now, we'll just update the local state
      const updatedFiles = files.map(file => {
        if (file.id === fileToRename.id) {
          return { ...file, name: newFileName.trim() };
        }
        return file;
      });
      
      setFiles(updatedFiles);
      
      toast({
        title: "Success",
        description: "File renamed successfully",
      });
      
      setIsRenameDialogOpen(false);
      setFileToRename(null);
    } catch (error) {
      console.error('Error renaming file:', error);
      toast({
        title: "Error",
        description: "Failed to rename file",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDebugFile = async (fileId: string) => {
    try {
      const file = await knowledgebaseService.getFileById(fileId);
      setDebugFile(file);
      setDebugMode(true);
      
      // Log file details to console for debugging
      console.log('Debug file:', {
        id: file.id,
        name: file.name,
        type: file.type,
        contentLength: file.content_length,
        contentText: file.content_text?.substring(0, 500) + '...',
        metadata: file.metadata
      });
    } catch (error) {
      console.error('Error loading file for debug:', error);
    }
  };

  // Format date string from ISO to relative time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
      const months = Math.floor(diffInDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'youtube':
        return (
          <svg className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
          </svg>
        );
      case 'audio':
        return (
          <svg className="h-5 w-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        );
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format file type to a more user-friendly format
  const formatFileType = (fileType: string): string => {
    // Handle common MIME types
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('presentation')) return 'PPT';
    if (fileType.includes('wordprocessingml') || fileType.includes('msword')) return 'DOC';
    if (fileType.includes('text/plain')) return 'TXT';
    
    // For other types, just return the original type in uppercase
    return fileType.toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">{knowledgebaseTitle} - Files</h2>
        </div>
        <div className="flex space-x-2">
          <Button 
            className="bg-sattva-600 hover:bg-sattva-700"
            onClick={onAddFiles}
          >
            <Upload className="h-4 w-4 mr-2" />
            Add Files
          </Button>
        </div>
      </div>

      {debugMode && debugFile && (
        <Card className="bg-gray-100 border-2 border-amber-500">
          <CardHeader className="bg-amber-100">
            <div className="flex justify-between items-center">
              <CardTitle className="text-amber-800">Debug Mode: {debugFile.name}</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDebugMode(false)}
                className="text-amber-800 border-amber-800"
              >
                Close Debug
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">File Details:</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>ID: {debugFile.id}</div>
                  <div>Type: {debugFile.type}</div>
                  <div>Size: {formatFileSize(debugFile.size)}</div>
                  <div>Content Length: {formatFileSize(debugFile.content_length || 0)}</div>
                  <div>Status: {debugFile.extraction_status || 'unknown'}</div>
                  <div>Created: {new Date(debugFile.created_at).toLocaleString()}</div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-1">Extracted Text:</h3>
                <div className="bg-white p-3 rounded border max-h-60 overflow-auto">
                  {debugFile.content_text ? (
                    <pre className="whitespace-pre-wrap text-xs">{debugFile.content_text}</pre>
                  ) : (
                    <p className="text-red-500">No text content found!</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-1">Metadata:</h3>
                <div className="bg-white p-3 rounded border max-h-40 overflow-auto">
                  <pre className="text-xs">{JSON.stringify(debugFile.metadata, null, 2)}</pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sattva-600"></div>
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium mb-2">No files found</h3>
            <p className="text-gray-500 mb-4">
              This knowledge base doesn't have any files yet.
            </p>
            <Button 
              className="bg-sattva-600 hover:bg-sattva-700"
              onClick={onAddFiles}
            >
              <Upload className="h-4 w-4 mr-2" />
              Add Files
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Files ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {files.map((file) => (
                <div key={file.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center mr-3">
                        {getFileIcon(file.type)}
                      </div>
                      <div>
                        <h4 className="font-medium">{file.name}</h4>
                        <div className="flex items-center text-xs text-gray-500">
                          <Button variant="outline" size="sm" className="h-6 px-2 mr-2">
                            {formatFileType(file.type)}
                          </Button>
                          <span className="mr-2">{formatFileSize(file.size)}</span>
                          {file.content_length && (
                            <span className="mr-2">
                              Content: {formatFileSize(file.content_length)}
                            </span>
                          )}
                          {file.extraction_status && (
                            <Badge 
                              variant={file.extraction_status === 'completed' ? 'default' : 
                                      file.extraction_status === 'pending' ? 'outline' : 'destructive'}
                              className="mr-2"
                            >
                              {file.extraction_status}
                            </Badge>
                          )}
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleViewFileDetails(file.id)}
                        title="View File Details"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRenameFile(file)}
                        title="Rename File"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDebugFile(file.id)}
                        title="Debug File Content"
                        className="text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                      >
                        <Code className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => confirmDeleteFile(file.id)}
                        title="Delete File"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedFileId && (
        <FileContentViewer
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          fileId={selectedFileId}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the file and its extracted text from your knowledgebase.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteFile}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for the file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="filename">File name</Label>
            <Input 
              id="filename" 
              value={newFileName} 
              onChange={(e) => setNewFileName(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRename}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 