import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { knowledgebaseService } from '@/lib/knowledgebaseService';
import { Loader2 } from 'lucide-react';
import type { FileRecord } from '@/lib/supabase';

interface FileContentViewerProps {
  fileId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FileContentViewer({ fileId, isOpen, onClose }: FileContentViewerProps) {
  const [file, setFile] = useState<FileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('content');

  useEffect(() => {
    if (isOpen && fileId) {
      loadFile();
    }
  }, [isOpen, fileId]);

  const loadFile = async () => {
    setLoading(true);
    try {
      const fileData = await knowledgebaseService.getFileById(fileId);
      setFile(fileData);
      console.log('Loaded file for viewer:', fileData);
    } catch (error) {
      console.error('Error loading file:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{file?.name || 'File Details'}</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : file ? (
          <Tabs defaultValue="content" className="flex-1 overflow-hidden flex flex-col" onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
              <TabsTrigger value="details">File Details</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-hidden">
              <TabsContent value="content" className="h-full overflow-auto">
                <div className="p-4 bg-muted/30 rounded-md h-full overflow-auto">
                  {file.content_text ? (
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {file.content_text}
                    </pre>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No content available for this file.
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="metadata" className="h-full overflow-auto">
                <div className="p-4 bg-muted/30 rounded-md h-full overflow-auto">
                  {file.metadata ? (
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {JSON.stringify(file.metadata, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No metadata available for this file.
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="details" className="h-full overflow-auto">
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">File Information</h3>
                      <div className="grid grid-cols-[120px_1fr] gap-1 text-sm">
                        <div className="font-medium">Name:</div>
                        <div>{file.name}</div>
                        
                        <div className="font-medium">Type:</div>
                        <div>{file.type}</div>
                        
                        <div className="font-medium">Size:</div>
                        <div>{formatFileSize(file.size)}</div>
                        
                        <div className="font-medium">Created:</div>
                        <div>{formatDate(file.created_at)}</div>
                        
                        {file.updated_at && (
                          <>
                            <div className="font-medium">Updated:</div>
                            <div>{formatDate(file.updated_at)}</div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-medium">Content Information</h3>
                      <div className="grid grid-cols-[120px_1fr] gap-1 text-sm">
                        <div className="font-medium">Content Length:</div>
                        <div>{file.content_length || 0} characters</div>
                        
                        <div className="font-medium">Status:</div>
                        <div>{file.extraction_status || 'Unknown'}</div>
                        
                        {file.source_url && (
                          <>
                            <div className="font-medium">Source URL:</div>
                            <div className="truncate">
                              <a 
                                href={file.source_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {file.source_url}
                              </a>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            File not found or could not be loaded.
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 