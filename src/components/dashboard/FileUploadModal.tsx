import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input } from '@/components/ui/input';
import { Youtube, Mic, Upload, FileText, Eye, ArrowRight, FileAudio, PenLine, Video, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { knowledgebaseService } from '@/lib/knowledgebaseService';
import { extractTextFromFile, extractTextFromPdf, extractTextFromYouTube, extractTextFromWebsite, ExtractedContent } from '@/lib/textExtraction';
import { extractYoutubeVideoId, formatTime } from '@/lib/youtubeService';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { Label } from '@/components/ui/label';
import { SpeechToText } from '@/components/ui/SpeechToTextNew';
import { AudioToText } from '@/components/ui/AudioToText';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { VideoToText } from '@/components/ui/VideoToText';

export type FileUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBaseId: string;
  knowledgeBaseTitle: string;
  userId: string;
  onSuccess?: () => void;
};

export function FileUploadModal({
  isOpen,
  onClose,
  knowledgeBaseId,
  knowledgeBaseTitle,
  userId,
  onSuccess
}: FileUploadModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const { toast } = useToast();
  
  // Track processing state for each tab
  const [isVideoProcessing, setIsVideoProcessing] = useState(false);
  const [isAudioProcessing, setIsAudioProcessing] = useState(false);
  const [isRecordingProcessing, setIsRecordingProcessing] = useState(false);
  
  // Determine if any processing is happening
  const isProcessing = isUploading || isExtracting || isVideoProcessing || isAudioProcessing || isRecordingProcessing;
  
  // Handle escape key and prevent closing when processing
  const handleCloseAttempt = () => {
    if (isProcessing) {
      toast({
        title: "Processing in Progress",
        description: "Please wait until processing is complete before closing.",
        variant: "destructive"
      });
      return;
    }
    onClose();
  };

  // Define accepted file types
  const acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'text/plain': ['.txt']
  };

  // Define accepted audio file types
  const acceptedAudioTypes = {
    'audio/mpeg': ['.mp3'],
    'audio/mp4': ['.m4a'],
    'audio/wav': ['.wav'],
    'audio/webm': ['.webm'],
    'audio/ogg': ['.ogg'],
    'audio/flac': ['.flac']
  };

  const handleExtractText = async (files: File[]) => {
    if (!files.length) return;
    
    const file = files[0]; // Just handle the first file for preview
    setSelectedFile(file);
    setIsExtracting(true);
    setShowPreview(true);
    
    try {
      console.log(`[FileUploadModal] Extracting text from ${file.name} (${file.type}, ${file.size} bytes)`);
      
      // Extract text from file
      const content = await extractTextFromFile(file);
      setExtractedContent(content);
      
      console.log(`[FileUploadModal] Text extraction successful`);
      console.log(`[FileUploadModal] Extracted ${content.text.length} characters`);
      console.log(`[FileUploadModal] Text sample: ${content.text.substring(0, 200)}...`);
      console.log(`[FileUploadModal] Metadata:`, content.metadata);
      
      toast({
        title: "Text Extraction Complete",
        description: `Successfully extracted ${content.text.length} characters from ${file.name}`,
      });
    } catch (error) {
      console.error(`[FileUploadModal] Error extracting text:`, error);
      toast({
        title: "Text Extraction Failed",
        description: `Could not extract text from ${file.name}: ${error.message}`,
        variant: "destructive"
      });
      setExtractedContent(null);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (!files.length || !user) return;
    
    // First extract text to preview
    await handleExtractText(files);
  };

  const handleProceedWithUpload = async () => {
    if (!selectedFile || !extractedContent || !user) return;
    
    setIsUploading(true);
    console.log(`[FileUploadModal] Starting upload of extracted text from ${selectedFile.name} to knowledgebase ${knowledgeBaseId}`);
    
    try {
      // Update progress
      setUploadProgress(prev => ({
        ...prev,
        [selectedFile.name]: 30 // Started processing
      }));
      
      // Add content directly to knowledgebase without uploading the file to storage
      console.log(`[FileUploadModal] Adding extracted text to knowledgebase`);
      console.log(`[FileUploadModal] Text length: ${extractedContent.text.length} characters`);
      
      // Create a file record with the extracted text
      const { data, error } = await supabase
        .from('files')
        .insert([
          {
            user_id: user.id,
            knowledgebase_id: knowledgeBaseId,
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            content_text: extractedContent.text,
            content_length: extractedContent.text.length,
            metadata: extractedContent.metadata,
            extraction_status: 'completed'
          }
        ])
        .select();
      
      if (error) {
        console.error(`[FileUploadModal] Error saving extracted text:`, error);
        toast({
          title: "Upload Failed",
          description: `Could not save extracted text from ${selectedFile.name}: ${error.message}`,
          variant: "destructive"
        });
        return;
      }
      
      console.log(`[FileUploadModal] Content added successfully to knowledgebase`);
      setUploadProgress(prev => ({
        ...prev,
        [selectedFile.name]: 100 // Completed
      }));
      
      toast({
        title: "Text Added",
        description: `Successfully added extracted text from ${selectedFile.name} to the knowledgebase.`,
      });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error(`[FileUploadModal] Upload error:`, error);
      toast({
        title: "Upload Failed",
        description: `An error occurred during the process: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress({});
      setExtractedContent(null);
      setSelectedFile(null);
      setShowPreview(false);
    }
  };

  const handleYoutubeUpload = async () => {
    if (!youtubeUrl.trim() || !user) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Show loading toast
      toast({
        title: "Processing YouTube Video",
        description: "Fetching video information and transcript. This may take a moment...",
      });
      
      // Extract video ID for validation
      const videoId = extractYoutubeVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL format');
      }
      
      // Extract text from YouTube URL
      const extractedContent = await extractTextFromYouTube(youtubeUrl, `YouTube Video - ${new Date().toLocaleString()}`);
      
      // Log success
      console.log(`[FileUploadModal] Extracted transcript with ${extractedContent.metadata.segment_count} segments from YouTube video`);
      console.log(`[FileUploadModal] Video duration: ${formatTime(extractedContent.metadata.duration)}`);
      console.log(`[FileUploadModal] Extraction method: ${extractedContent.metadata.extraction_method}`);
      
      // Get a better title for the file
      const videoTitle = extractedContent.metadata.title || `YouTube Video - ${new Date().toLocaleString()}`;
      
      // Create a file record with the extracted text
      const { data, error } = await supabase
        .from('files')
        .insert([
          {
            user_id: user.id,
            knowledgebase_id: knowledgeBaseId,
            name: videoTitle,
            type: 'youtube',
            size: extractedContent.text.length,
            source_url: youtubeUrl,
            content_text: extractedContent.text,
            content_length: extractedContent.text.length,
            metadata: extractedContent.metadata,
            extraction_status: 'completed'
          }
        ])
        .select();
      
      if (error) {
        console.error(`[FileUploadModal] Error saving YouTube content:`, error);
        throw new Error(error.message);
      }
      
      toast({
        title: "YouTube Content Added",
        description: `Successfully added "${videoTitle}" with ${extractedContent.metadata.segment_count} transcript segments.`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error('Error processing YouTube URL:', error);
      toast({
        title: "Processing Failed",
        description: `Failed to process YouTube URL: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecordingUpload = async (text: string) => {
    if (!text.trim() || !user) {
      toast({
        title: "Invalid Recording",
        description: "Please provide a valid transcription text",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Show loading toast
      toast({
        title: "Processing Recording",
        description: "Saving transcribed text to your knowledge base...",
      });
      
      // Create metadata for the recording
      const metadata = {
        source_type: 'speech_to_text',
        extraction_method: 'web_speech_api',
        recording_date: new Date().toISOString(),
      };
      
      // Create a file name based on date and time
      const fileName = `Voice Recording - ${new Date().toLocaleString()}`;
      
      // Create a file record with the transcribed text
      const { data, error } = await supabase
        .from('files')
        .insert([
          {
            user_id: user.id,
            knowledgebase_id: knowledgeBaseId,
            name: fileName,
            type: 'text/speech',
            size: text.length,
            content_text: text,
            content_length: text.length,
            metadata: metadata,
            extraction_status: 'completed'
          }
        ])
        .select();
      
      if (error) {
        console.error(`[FileUploadModal] Error saving transcribed text:`, error);
        throw new Error(error.message);
      }
      
      toast({
        title: "Recording Added",
        description: `Successfully added "${fileName}" with ${text.length} characters.`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error('Error processing recording:', error);
      toast({
        title: "Processing Failed",
        description: `Failed to save recording: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setTranscribedText('');
    }
  };

  const handleAudioUpload = async (text: string, fileName: string) => {
    if (!text.trim() || !user) {
      toast({
        title: "Invalid Transcription",
        description: "Please provide a valid transcription text",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Show loading toast
      toast({
        title: "Processing Audio Transcription",
        description: "Saving transcribed text to your knowledge base...",
      });
      
      // Create metadata for the audio transcription
      const metadata = {
        source_type: 'audio_transcription',
        extraction_method: 'openai_whisper',
        transcription_date: new Date().toISOString(),
      };
      
      // Create a file record with the transcribed text
      const { data, error } = await supabase
        .from('files')
        .insert([
          {
            user_id: user.id,
            knowledgebase_id: knowledgeBaseId,
            name: fileName,
            type: 'audio/transcription',
            size: text.length,
            content_text: text,
            content_length: text.length,
            metadata: metadata,
            extraction_status: 'completed'
          }
        ])
        .select();
      
      if (error) {
        console.error(`[FileUploadModal] Error saving audio transcription:`, error);
        throw new Error(error.message);
      }
      
      toast({
        title: "Audio Transcription Added",
        description: `Successfully added "${fileName}" with ${text.length} characters.`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error('Error processing audio transcription:', error);
      toast({
        title: "Processing Failed",
        description: `Failed to save audio transcription: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (text: string, fileName: string) => {
    if (!text.trim() || !user) {
      toast({
        title: "Invalid Transcription",
        description: "Please provide a valid transcription text",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Show loading toast
      toast({
        title: "Processing Video Transcription",
        description: "Saving transcribed text to your knowledge base...",
      });
      
      // Create metadata for the video transcription
      const metadata = {
        source_type: 'video_transcription',
        extraction_method: 'openai_whisper',
        transcription_date: new Date().toISOString(),
      };
      
      // Create a file record with the transcribed text
      const { data, error } = await supabase
        .from('files')
        .insert([
          {
            user_id: user.id,
            knowledgebase_id: knowledgeBaseId,
            name: fileName,
            type: 'video/transcription',
            size: text.length,
            content_text: text,
            content_length: text.length,
            metadata: metadata,
            extraction_status: 'completed'
          }
        ])
        .select();
      
      if (error) {
        console.error(`[FileUploadModal] Error saving video transcription:`, error);
        throw new Error(error.message);
      }
      
      toast({
        title: "Video Transcription Added",
        description: `Successfully added "${fileName}" with ${text.length} characters.`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error('Error processing video transcription:', error);
      toast({
        title: "Processing Failed",
        description: `Failed to save video transcription: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleNoteUpload = async (title: string, content: string) => {
    if (!content.trim() || !user) {
      toast({
        title: "Invalid Note",
        description: "Please provide valid note content",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Show loading toast
      toast({
        title: "Processing Note",
        description: "Saving your note to the knowledge base...",
      });
      
      // Extract plain text from HTML content for search and AI processing
      const tempElement = document.createElement('div');
      tempElement.innerHTML = content;
      const plainText = tempElement.textContent || tempElement.innerText || '';
      
      // Create metadata for the note
      const metadata = {
        source_type: 'user_note',
        creation_date: new Date().toISOString(),
        has_rich_content: true,
        original_html: content
      };
      
      // Create a file record with the note content
      const { data, error } = await supabase
        .from('files')
        .insert([
          {
            user_id: user.id,
            knowledgebase_id: knowledgeBaseId,
            name: title,
            type: 'text/note',
            size: plainText.length,
            content_text: plainText,
            content_length: plainText.length,
            metadata: metadata,
            extraction_status: 'completed'
          }
        ])
        .select();
      
      if (error) {
        console.error(`[FileUploadModal] Error saving note:`, error);
        throw new Error(error.message);
      }
      
      toast({
        title: "Note Added",
        description: `Successfully added "${title}" with ${plainText.length} characters.`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error('Error processing note:', error);
      toast({
        title: "Processing Failed",
        description: `Failed to save note: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setExtractedContent(null);
    setSelectedFile(null);
  };

  const handleWebsiteUpload = async () => {
    if (!websiteUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid website URL",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUploading(true);
      
      // Extract text from the website
      const extractedContent = await extractTextFromWebsite(websiteUrl);
      
      if (!extractedContent.text) {
        throw new Error('No text content found in the website');
      }
      
      // Create a file name from the website title or URL
      const websiteTitle = extractedContent.metadata.title || new URL(websiteUrl).hostname;
      const fileName = `${websiteTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.txt`;
      
      // Add the file to the knowledge base
      await knowledgebaseService.addContentToKnowledgebase(
        userId,
        knowledgeBaseId,
        fileName,
        'website',
        extractedContent.text.length,
        websiteUrl,
        extractedContent.text,
        {
          ...extractedContent.metadata,
          source_type: 'website'
        }
      );
      
      toast({
        title: "Success",
        description: "Website content added to knowledge base",
      });
      
      // Reset the form
      setWebsiteUrl('');
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error uploading website content:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to extract content from website",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && !isProcessing) {
          onClose();
        } else if (!open && isProcessing) {
          // Prevent closing if processing
          toast({
            title: "Processing in Progress",
            description: "Please wait until processing is complete before closing.",
            variant: "destructive"
          });
        }
      }}
      modal={true}
    >
      <DialogContent 
        className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with Escape key
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Add Content to {knowledgeBaseTitle}</DialogTitle>
          </div>
          <DialogDescription>
            Upload files, add YouTube videos, or record audio to extract text for your knowledge base.
          </DialogDescription>
        </DialogHeader>
        
        {showPreview && extractedContent ? (
          <>
            <div className="space-y-4">
              {isExtracting ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p>Extracting text from {selectedFile?.name}...</p>
                </div>
              ) : extractedContent ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {selectedFile?.name}
                    </CardTitle>
                    <CardDescription>
                      {extractedContent.metadata.source_type} • {extractedContent.text.length} characters
                      {extractedContent.metadata.page_count && ` • ${extractedContent.metadata.page_count} pages`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px] w-full border rounded-md p-4 bg-muted/30">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {extractedContent.text}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-destructive">Failed to extract text from the file.</p>
                </div>
              )}
            </div>
            
            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={handleCancelPreview}>
                Back
              </Button>
              <Button 
                onClick={handleProceedWithUpload} 
                disabled={isUploading || !extractedContent}
                className="bg-sattva-600 hover:bg-sattva-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    Proceed with Upload
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Tabs defaultValue="upload" className="flex-1 overflow-hidden flex flex-col" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-7">
                <TabsTrigger value="upload" disabled={isProcessing}>
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Upload</span>
                </TabsTrigger>
                <TabsTrigger value="youtube" disabled={isProcessing}>
                  <Youtube className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">YouTube</span>
                </TabsTrigger>
                <TabsTrigger value="website" disabled={isProcessing}>
                  <Globe className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Website</span>
                </TabsTrigger>
                <TabsTrigger value="audio" disabled={isProcessing}>
                  <FileAudio className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Audio</span>
                </TabsTrigger>
                <TabsTrigger value="video" disabled={isProcessing}>
                  <Video className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Video</span>
                </TabsTrigger>
                <TabsTrigger value="record" disabled={isProcessing}>
                  <Mic className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Record</span>
                </TabsTrigger>
                <TabsTrigger value="notes" disabled={isProcessing}>
                  <PenLine className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Notes</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="mt-0 flex-1 overflow-auto">
                <div className="py-4 space-y-4">
                  <FileUpload 
                    onUpload={handleExtractText}
                    accept={acceptedFileTypes}
                    maxSize={20 * 1024 * 1024} // 20MB
                    disabled={isExtracting}
                  />
                  <div className="text-sm text-muted-foreground">
                    <p>Supported file types: PDF, DOCX, DOC, PPTX, PPT, TXT</p>
                    <p>Maximum file size: 20MB</p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="youtube" className="mt-0">
                <div className="py-4 space-y-4">
                  <div className="flex flex-col space-y-2">
                    <label htmlFor="youtube-url" className="text-sm font-medium">
                      YouTube URL
                    </label>
                    <Input
                      id="youtube-url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter a YouTube URL to extract content and add it to your knowledge base.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="website" className="mt-0">
                <div className="py-4 space-y-4">
                  <div className="flex flex-col space-y-2">
                    <label htmlFor="website-url" className="text-sm font-medium">
                      Website URL
                    </label>
                    <Input
                      id="website-url"
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter a website URL to extract content and add it to your knowledge base.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="audio" className="mt-0">
                <AudioToText 
                  onSave={handleAudioUpload}
                  className="border-none shadow-none"
                  onProcessingChange={setIsAudioProcessing}
                />
              </TabsContent>
              
              <TabsContent value="video" className="mt-0 flex-1 overflow-y-auto">
                <VideoToText 
                  onSave={handleVideoUpload}
                  className="border-none shadow-none"
                  onProcessingChange={setIsVideoProcessing}
                />
              </TabsContent>
              
              <TabsContent value="record" className="mt-0">
                <SpeechToText 
                  onSave={handleRecordingUpload}
                  onTranscriptionComplete={setTranscribedText}
                  className="border-none shadow-none"
                  onProcessingChange={setIsRecordingProcessing}
                />
              </TabsContent>
              
              <TabsContent value="notes" className="mt-0">
                <RichTextEditor 
                  onSave={handleNoteUpload}
                  className="border-none shadow-none"
                />
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              {activeTab === 'youtube' && (
                <Button 
                  className="bg-sattva-600 hover:bg-sattva-700" 
                  onClick={handleYoutubeUpload}
                  disabled={isUploading}
                >
                  {isUploading ? 'Processing...' : 'Add Video'}
                </Button>
              )}
              {activeTab === 'website' && (
                <Button 
                  className="bg-sattva-600 hover:bg-sattva-700" 
                  onClick={handleWebsiteUpload}
                  disabled={isUploading}
                >
                  {isUploading ? 'Processing...' : 'Add Website Content'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
