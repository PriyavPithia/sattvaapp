import { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizonal, Plus, Bot, Upload, Clock, FileText, ExternalLink, Youtube, Play, Trash2, BookOpen, Copy, Save } from 'lucide-react';
import { KnowledgeBaseSelector } from '@/components/chat/KnowledgeBaseSelector';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { knowledgebaseService } from '@/lib/knowledgebaseService';
import type { FileRecord, Knowledgebase } from '@/lib/supabase';
import { YoutubePlayer } from '@/components/ui/YoutubePlayer';
import ReactMarkdown from 'react-markdown';
import { 
  chunkTranscript, 
  extractYoutubeVideoId, 
  formatTime, 
  type ChunkedTranscript, 
  type TranscriptSegment 
} from '@/lib/youtubeService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { aiService } from '@/lib/aiService';
import { useAuth } from '@/lib/AuthContext';
import { chatService } from '@/lib/chatService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parseReferences } from '../lib/aiService';
import ReferenceLink from '../components/ReferenceLink';
import remarkGfm from 'remark-gfm';
import React from 'react';

type Message = {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  references?: {
    fileId: string;
    text: string;
    position?: number;
    type?: string;
    sourceId?: string;
  }[];
};

const Chat = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialKnowledgeBaseId = searchParams.get('kb');
  
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<Knowledgebase | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [knowledgebaseFiles, setKnowledgebaseFiles] = useState<FileRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'transcripts' | 'files'>('transcripts');
  
  // YouTube specific state
  const [currentTime, setCurrentTime] = useState(0);
  const [chunkedTranscript, setChunkedTranscript] = useState<ChunkedTranscript[]>([]);
  const [chunkSize, setChunkSize] = useState<number>(30); // Default 30 seconds
  const [isYoutubeVideo, setIsYoutubeVideo] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [studyNotes, setStudyNotes] = useState<string>('');
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If a knowledge base is selected, create or load a chat
    if (selectedKnowledgeBase && user) {
      const initializeChat = async () => {
        try {
          // Try to find an existing chat for this knowledge base
          const chats = await chatService.getKnowledgebaseChats(selectedKnowledgeBase.id);
          
          if (chats.length > 0) {
            // Use the most recent chat
            const mostRecentChat = chats[0];
            setCurrentChat(mostRecentChat.id);
            
            // Load messages for this chat
            const chatMessages = await chatService.getChatMessages(mostRecentChat.id);
            
            if (chatMessages.length > 0) {
              // Convert to our message format
              const formattedMessages = chatMessages.map(msg => ({
                id: msg.id,
                content: msg.content,
                isUser: msg.is_user,
                timestamp: new Date(msg.created_at),
                references: msg.references
              }));
              
              setMessages(formattedMessages);
            } else {
              // Add a welcome message if no messages exist
              setMessages([
                {
                  id: 'welcome',
                  content: `Hello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
                  isUser: false,
                  timestamp: new Date()
                }
              ]);
            }
          } else {
            // Create a new chat
            const newChat = await chatService.createChat(
              user.id, 
              selectedKnowledgeBase.id, 
              `Chat about ${selectedKnowledgeBase.title}`
            );
            
            setCurrentChat(newChat.id);
            
            // Add a welcome message
            setMessages([
              {
                id: 'welcome',
                content: `Hello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
                isUser: false,
                timestamp: new Date()
              }
            ]);
            
            // Save the welcome message
            await chatService.addMessage(
              newChat.id,
              `Hello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
              false
            );
          }
          
          // Fetch files for the selected knowledge base
          fetchKnowledgebaseFiles(selectedKnowledgeBase.id);
        } catch (error) {
          console.error('Error initializing chat:', error);
          toast.error('Failed to initialize chat');
        }
      };
      
      initializeChat();
    }
  }, [selectedKnowledgeBase, user]);

  const fetchKnowledgebaseFiles = async (knowledgebaseId: string) => {
    try {
      const files = await knowledgebaseService.getKnowledgebaseFiles(knowledgebaseId);
      setKnowledgebaseFiles(files);
      console.log('Fetched files:', files);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load knowledge base files');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    if (!selectedKnowledgeBase) {
      toast.error('Please select a knowledge base first');
      return;
    }
    if (!currentChat) {
      toast.error('Chat is not initialized yet');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        content: inputMessage,
        isUser: true,
        timestamp: new Date(),
        references: []
      };
      
      // Save user message to database
      await chatService.addMessage(currentChat, inputMessage, true);
      
      // Update UI with user message
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setInputMessage('');
      
      // Query AI with user message
      const aiResponse = await aiService.queryKnowledgebase(selectedKnowledgeBase.id, inputMessage);
      
      // Create context array for reference parsing
      const context = knowledgebaseFiles.map(file => ({
        fileId: file.id,
        content: file.content_text || "",
        fileType: file.type.toLowerCase(),
        sourceId: file.metadata?.videoId // For YouTube videos
      }));
      
      // Check for inline references in the content
      const newReferenceRegex = /{{ref:([a-zA-Z0-9-]+):([a-zA-Z0-9-_]+):(\d+)}}/g;
      const legacyReferenceRegex = /{{([a-zA-Z0-9-]+):(\d+)}}/g;
      const uuidRegex = /{{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})}}/gi;
      const specificUuidRegex = /{{011ebcba-34bf-415f-be8f-740ee79b5cc0}}/g;
      const specificRefUuidRegex = /{{ref:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})}}/g;
      const youtubeRefUuidRegex = /{{ref:youtube:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})}}/g;
      const videoTranscriptionRegex = /{{ref:video\/transcription:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d+)}}/g;
      
      // Process the content to handle any problematic references
      let processedContent = aiResponse.text;
      
      // Replace video/transcription references if found
      if (videoTranscriptionRegex.test(processedContent)) {
        console.warn('Found video/transcription references in AI response. Converting to proper format.');
        
        // Reset regex lastIndex
        videoTranscriptionRegex.lastIndex = 0;
        
        if (knowledgebaseFiles.length > 0) {
          // Find video files first
          const videoFiles = knowledgebaseFiles.filter(file => 
            file.type.toLowerCase() === 'video' || 
            file.type.toLowerCase() === 'youtube'
          );
          
          if (videoFiles.length > 0) {
            // Use the first video file for replacements
            const videoFile = videoFiles[0];
            const fileType = videoFile.type.toLowerCase();
            
            // Replace video/transcription references with proper format
            processedContent = processedContent.replace(
              videoTranscriptionRegex,
              (match, uuid, pos) => {
                // Try to find the exact file with this UUID
                const exactFile = knowledgebaseFiles.find(f => f.id === uuid);
                if (exactFile) {
                  // Check if it's a YouTube video by looking at the metadata
                  if (exactFile.type.toLowerCase() === 'youtube' || 
                      (exactFile.metadata && exactFile.metadata.videoId)) {
                    // It's a YouTube video, use the YouTube format
                    const videoId = exactFile.metadata?.videoId || exactFile.id;
                    return `{{ref:youtube:${videoId}:${pos}}}`;
                  }
                  // Otherwise use the file's actual type
                  return `{{ref:${exactFile.type.toLowerCase()}:${exactFile.id}:${pos}}}`;
                }
                
                // If not found, use the first video file
                // Check if it's a YouTube video
                if (fileType === 'youtube' && videoFile.metadata?.videoId) {
                  return `{{ref:youtube:${videoFile.metadata.videoId}:${pos}}}`;
                }
                return `{{ref:${fileType}:${videoFile.id}:${pos}}}`;
              }
            );
          }
        }
      }
      
      // Replace UUID references if found
      if (uuidRegex.test(processedContent) || 
          specificUuidRegex.test(processedContent) || 
          specificRefUuidRegex.test(processedContent) ||
          youtubeRefUuidRegex.test(processedContent)) {
        console.warn('Found UUID references in AI response. Replacing with proper references.');
        
        // Reset regex lastIndex
        uuidRegex.lastIndex = 0;
        specificRefUuidRegex.lastIndex = 0;
        youtubeRefUuidRegex.lastIndex = 0;
        
        if (knowledgebaseFiles.length > 0) {
          // Find YouTube files first
          const youtubeFiles = knowledgebaseFiles.filter(file => 
            file.type.toLowerCase() === 'youtube' && file.metadata?.videoId
          );
          
          if (youtubeFiles.length > 0) {
            // Use the first YouTube file for replacements
            const youtubeFile = youtubeFiles[0];
            const videoId = youtubeFile.metadata?.videoId || 'videoId';
            const position = 120; // Default position in seconds
            
            // Replace YouTube specific UUID references with proper format
            processedContent = processedContent.replace(
              youtubeRefUuidRegex, 
              `{{ref:youtube:${videoId}:${position}}}`
            );
            
            // Also replace other UUID formats with YouTube reference if they exist
            processedContent = processedContent.replace(specificUuidRegex, `{{ref:youtube:${videoId}:${position}}}`);
            processedContent = processedContent.replace(specificRefUuidRegex, `{{ref:youtube:${videoId}:${position}}}`);
          } else {
            // No YouTube files, use the first file of any type
            const firstFile = knowledgebaseFiles[0];
            const fileType = firstFile.type.toLowerCase();
            
            // Replace legacy format UUIDs
            processedContent = processedContent.replace(uuidRegex, `{{ref:${fileType}:${firstFile.id}:0}}`);
            processedContent = processedContent.replace(specificUuidRegex, `{{ref:${fileType}:${firstFile.id}:0}}`);
            
            // Replace new format UUIDs with specific reference
            processedContent = processedContent.replace(
              specificRefUuidRegex, 
              `{{ref:${fileType}:${firstFile.id}:0}}`
            );
            
            // Replace YouTube specific UUID references
            processedContent = processedContent.replace(
              youtubeRefUuidRegex, 
              `{{ref:${fileType}:${firstFile.id}:0}}`
            );
          }
        }
      }
      
      // Parse references from the processed content
      const parsedReferences = parseReferences(processedContent, context);
      
      // Create AI message with processed content
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: processedContent,
        isUser: false,
        timestamp: new Date(),
        references: parsedReferences.length > 0 ? parsedReferences : aiResponse.references
      };
      
      // Save AI message to database with processed content
      await chatService.addMessage(
        currentChat, 
        processedContent, 
        false, 
        aiMessage.references
      );
      
      // Update UI with AI message
      setMessages(prevMessages => [...prevMessages, aiMessage]);
      
      // If there's a reference, select that file
      if (aiMessage.references && aiMessage.references.length > 0) {
        const firstReference = aiMessage.references[0];
        const referencedFile = knowledgebaseFiles.find(file => file.id === firstReference.fileId);
        
        if (referencedFile) {
          setSelectedFile(referencedFile);
          setActiveTab('transcripts');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(`Error: ${error.message || 'Failed to send message'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleKnowledgeBaseSelect = (kb: Knowledgebase) => {
    setSelectedKnowledgeBase(kb);
    // Update URL with the selected knowledgebase ID
    navigate(`/chat?kb=${kb.id}`, { replace: true });
    // Reset selected file when changing knowledge base
    setSelectedFile(null);
  };

  const handleClearChat = () => {
    setMessages([]);
    if (selectedKnowledgeBase) {
      setMessages([
        {
          id: 'welcome',
          content: `Hello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
          isUser: false,
          timestamp: new Date()
        }
      ]);
    }
    toast.success('Chat cleared');
  };

  const handleUploadFiles = () => {
    toast.info('File upload functionality coming soon!');
  };

  const handleFileSelect = (file: FileRecord) => {
    setSelectedFile(file);
    setActiveTab('transcripts');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getFileTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'PDF';
      case 'video':
        return 'Video';
      case 'youtube':
        return 'YouTube';
      case 'audio':
        return 'Audio';
      default:
        return type;
    }
  };

  // Update when a file is selected
  useEffect(() => {
    if (selectedFile) {
      // Check if it's a YouTube video
      const isYoutube = selectedFile.type.toLowerCase() === 'youtube';
      setIsYoutubeVideo(isYoutube);
      
      if (isYoutube && selectedFile.source_url) {
        const extractedVideoId = extractYoutubeVideoId(selectedFile.source_url);
        setVideoId(extractedVideoId);
        
        // Process transcript if available
        if (selectedFile.content_text) {
          try {
            // First try to parse as JSON
            let transcript: TranscriptSegment[] = [];
            
            try {
              transcript = JSON.parse(selectedFile.content_text);
            } catch (jsonError) {
              // If JSON parsing fails, try to parse as text with timestamps
              console.log("Failed to parse as JSON, trying text format");
              const lines = selectedFile.content_text.split('\n');
              let currentSegment: TranscriptSegment | null = null;
              
              for (const line of lines) {
                // Look for timestamp pattern [HH:MM:SS] or [MM:SS]
                const timestampMatch = line.match(/\[(\d{2}):(\d{2}):(\d{2})\]|\[(\d{2}):(\d{2})\]/);
                
                if (timestampMatch) {
                  // If we found a timestamp, create a new segment
                  let startTime = 0;
                  
                  if (timestampMatch[1] !== undefined) {
                    // Format is [HH:MM:SS]
                    const hours = parseInt(timestampMatch[1]);
                    const minutes = parseInt(timestampMatch[2]);
                    const seconds = parseInt(timestampMatch[3]);
                    startTime = hours * 3600 + minutes * 60 + seconds;
                  } else {
                    // Format is [MM:SS]
                    const minutes = parseInt(timestampMatch[4]);
                    const seconds = parseInt(timestampMatch[5]);
                    startTime = minutes * 60 + seconds;
                  }
                  
                  // Extract the text after the timestamp
                  const text = line.substring(timestampMatch[0].length).trim();
                  
                  // Add the previous segment if it exists
                  if (currentSegment) {
                    transcript.push(currentSegment);
                  }
                  
                  // Create a new segment
                  currentSegment = {
                    text: text,
                    start: startTime,
                    duration: 15 // Default duration of 15 seconds
                  };
                } else if (currentSegment && line.trim() !== '') {
                  // If no timestamp but we have text, append to current segment
                  currentSegment.text += ' ' + line.trim();
                }
              }
              
              // Add the last segment
              if (currentSegment) {
                transcript.push(currentSegment);
              }
              
              // Calculate durations based on next segment's start time
              for (let i = 0; i < transcript.length - 1; i++) {
                transcript[i].duration = transcript[i + 1].start - transcript[i].start;
              }
              
              // If we have no segments, create a single segment with the entire content
              if (transcript.length === 0) {
                transcript = [{
                  text: selectedFile.content_text,
                  start: 0,
                  duration: 60
                }];
              }
            }
            
            const chunks = chunkTranscript(transcript, chunkSize);
            setChunkedTranscript(chunks);
          } catch (error) {
            console.error('Error parsing transcript:', error);
            // If all parsing fails, treat content_text as plain text
            setChunkedTranscript([{
              text: selectedFile.content_text,
              startTime: 0,
              endTime: 0,
              segments: [{
                text: selectedFile.content_text,
                start: 0,
                duration: 0
              }]
            }]);
          }
        }
      } else {
        setVideoId(null);
        setChunkedTranscript([]);
      }
    } else {
      setIsYoutubeVideo(false);
      setVideoId(null);
      setChunkedTranscript([]);
    }
  }, [selectedFile, chunkSize]);

  // Handle chunk size change
  const handleChunkSizeChange = (value: string) => {
    const newSize = parseInt(value);
    setChunkSize(newSize);
    
    // Rechunk the transcript if we have one
    if (selectedFile?.content_text) {
      try {
        // Try to parse as JSON first
        let transcript: TranscriptSegment[] = [];
        
        try {
          transcript = JSON.parse(selectedFile.content_text);
        } catch (jsonError) {
          // If JSON parsing fails, use the same text parsing logic as above
          const lines = selectedFile.content_text.split('\n');
          let currentSegment: TranscriptSegment | null = null;
          
          for (const line of lines) {
            const timestampMatch = line.match(/\[(\d{2}):(\d{2}):(\d{2})\]|\[(\d{2}):(\d{2})\]/);
            
            if (timestampMatch) {
              let startTime = 0;
              
              if (timestampMatch[1] !== undefined) {
                const hours = parseInt(timestampMatch[1]);
                const minutes = parseInt(timestampMatch[2]);
                const seconds = parseInt(timestampMatch[3]);
                startTime = hours * 3600 + minutes * 60 + seconds;
              } else {
                const minutes = parseInt(timestampMatch[4]);
                const seconds = parseInt(timestampMatch[5]);
                startTime = minutes * 60 + seconds;
              }
              
              const text = line.substring(timestampMatch[0].length).trim();
              
              if (currentSegment) {
                transcript.push(currentSegment);
              }
              
              currentSegment = {
                text: text,
                start: startTime,
                duration: 15
              };
            } else if (currentSegment && line.trim() !== '') {
              currentSegment.text += ' ' + line.trim();
            }
          }
          
          if (currentSegment) {
            transcript.push(currentSegment);
          }
          
          for (let i = 0; i < transcript.length - 1; i++) {
            transcript[i].duration = transcript[i + 1].start - transcript[i].start;
          }
          
          if (transcript.length === 0) {
            transcript = [{
              text: selectedFile.content_text,
              start: 0,
              duration: 60
            }];
          }
        }
        
        const chunks = chunkTranscript(transcript, newSize);
        setChunkedTranscript(chunks);
      } catch (error) {
        console.error('Error parsing transcript:', error);
      }
    }
  };

  // Handle clicking on a transcript chunk
  const handleTranscriptChunkClick = (startTime: number) => {
    setCurrentTime(startTime);
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReferenceClick = (reference: { 
    fileId: string; 
    position?: number;
    type?: string;
    sourceId?: string;
  }) => {
    // Find the file
    const file = knowledgebaseFiles.find(f => f.id === reference.fileId);
    
    if (file) {
      setSelectedFile(file);
      setActiveTab('transcripts');
      
      // If it's a YouTube video and has a position (timestamp)
      if ((file.type.toLowerCase() === 'youtube' || reference.type === 'youtube') && reference.position) {
        setCurrentTime(reference.position);
        
        // Add a small delay to ensure the transcript tab is fully loaded
        setTimeout(() => {
          // Find the corresponding chunk element by ID
          const chunkElement = document.getElementById(`chunk-${reference.position}`);
          
          if (chunkElement && transcriptContainerRef.current) {
            // Scroll the chunk into view
            chunkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            // If exact match not found, find the closest chunk
            const closestChunk = chunkedTranscript.find(chunk => {
              return reference.position! >= chunk.startTime && reference.position! <= chunk.endTime;
            });
            
            if (closestChunk && transcriptContainerRef.current) {
              const closestElement = document.getElementById(`chunk-${closestChunk.startTime}`);
              if (closestElement) {
                closestElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }
        }, 300);
      }
      // Handle PDF documents with page positions
      else if ((file.type.toLowerCase() === 'pdf' || reference.type === 'pdf') && reference.position) {
        // If you have a PDF viewer component, you can navigate to the specific page
        // For example: setPdfPage(reference.position);
        console.log(`Navigating to PDF page ${reference.position}`);
      }
    }
  };

  const handleGenerateStudyNotes = async () => {
    if (messages.length < 3) {
      toast.error('You need more conversation to generate study notes');
      return;
    }

    try {
      setIsGeneratingNotes(true);
      
      // Format messages for the AI service
      const formattedMessages = messages.map(msg => ({
        content: msg.content,
        isUser: msg.isUser
      }));
      
      // Generate study notes
      const notes = await aiService.generateStudyNotes(formattedMessages);
      
      // Set the notes and show the dialog
      setStudyNotes(notes);
      setShowNotesDialog(true);
    } catch (error) {
      console.error('Error generating study notes:', error);
      toast.error('Failed to generate study notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleCopyNotes = () => {
    navigator.clipboard.writeText(studyNotes);
    toast.success('Study notes copied to clipboard');
  };

  const handleSaveNotes = async () => {
    if (!selectedKnowledgeBase || !user) {
      toast.error('Knowledge base not selected');
      return;
    }

    try {
      // Create a title based on the conversation
      const title = `Study Notes - ${new Date().toLocaleDateString()}`;
      
      // Save as a note in the knowledge base
      await knowledgebaseService.addContentToKnowledgebase(
        user.id,
        selectedKnowledgeBase.id,
        title,
        'note',
        studyNotes.length,
        null,
        studyNotes,
        { source: 'study_notes', generated_from: 'chat' }
      );
      
      toast.success('Study notes saved to knowledge base');
      setShowNotesDialog(false);
    } catch (error) {
      console.error('Error saving study notes:', error);
      toast.error('Failed to save study notes');
    }
  };

  // Update the renderMessageContent function to handle video/transcription references
  const renderMessageContent = (content: string) => {
    if (!content) return null;
    
    // Define regex patterns for different reference formats
    const newReferenceRegex = /{{ref:([a-zA-Z0-9-]+):([a-zA-Z0-9-_]+):(\d+)}}/g;
    const legacyReferenceRegex = /{{([a-zA-Z0-9-]+):(\d+)}}/g;
    const uuidRegex = /{{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})}}/gi;
    const specificUuidRegex = /{{011ebcba-34bf-415f-be8f-740ee79b5cc0}}/g;
    const specificRefUuidRegex = /{{ref:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})}}/g;
    const youtubeRefUuidRegex = /{{ref:youtube:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})}}/g;
    const videoTranscriptionRegex = /{{ref:video\/transcription:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d+)}}/g;
    
    // Process content to replace any remaining UUID references
    let processedContent = content;
    
    // Replace video/transcription references if found
    if (videoTranscriptionRegex.test(processedContent)) {
      // Reset regex lastIndex
      videoTranscriptionRegex.lastIndex = 0;
      
      if (knowledgebaseFiles.length > 0) {
        // Find video files first
        const videoFiles = knowledgebaseFiles.filter(file => 
          file.type.toLowerCase() === 'video' || 
          file.type.toLowerCase() === 'youtube'
        );
        
        if (videoFiles.length > 0) {
          // Use the first video file for replacements
          const videoFile = videoFiles[0];
          const fileType = videoFile.type.toLowerCase();
          const position = 0; // Default position
          
          // Replace video/transcription references with proper format
          processedContent = processedContent.replace(
            videoTranscriptionRegex,
            (match, uuid, pos) => {
              // Try to find the exact file with this UUID
              const exactFile = knowledgebaseFiles.find(f => f.id === uuid);
              if (exactFile) {
                // Check if it's a YouTube video by looking at the metadata
                if (exactFile.type.toLowerCase() === 'youtube' || 
                    (exactFile.metadata && exactFile.metadata.videoId)) {
                  // It's a YouTube video, use the YouTube format
                  const videoId = exactFile.metadata?.videoId || exactFile.id;
                  return `{{ref:youtube:${videoId}:${pos}}}`;
                }
                // Otherwise use the file's actual type
                return `{{ref:${exactFile.type.toLowerCase()}:${exactFile.id}:${pos}}}`;
              }
              
              // If not found, use the first video file
              // Check if it's a YouTube video
              if (fileType === 'youtube' && videoFile.metadata?.videoId) {
                return `{{ref:youtube:${videoFile.metadata.videoId}:${pos}}}`;
              }
              return `{{ref:${fileType}:${videoFile.id}:${pos}}}`;
            }
          );
        }
      }
    }
    
    // Replace UUID references if found
    if (uuidRegex.test(processedContent) || 
        specificUuidRegex.test(processedContent) || 
        specificRefUuidRegex.test(processedContent) ||
        youtubeRefUuidRegex.test(processedContent)) {
      
      // Reset regex lastIndex
      uuidRegex.lastIndex = 0;
      specificRefUuidRegex.lastIndex = 0;
      youtubeRefUuidRegex.lastIndex = 0;
      
      if (knowledgebaseFiles.length > 0) {
        // Find YouTube files first
        const youtubeFiles = knowledgebaseFiles.filter(file => 
          file.type.toLowerCase() === 'youtube' && file.metadata?.videoId
        );
        
        if (youtubeFiles.length > 0) {
          // Use the first YouTube file for replacements
          const youtubeFile = youtubeFiles[0];
          const videoId = youtubeFile.metadata?.videoId || 'videoId';
          const position = 120; // Default position in seconds
          
          // Replace YouTube specific UUID references with proper format
          processedContent = processedContent.replace(
            youtubeRefUuidRegex, 
            `{{ref:youtube:${videoId}:${position}}}`
          );
          
          // Also replace other UUID formats with YouTube reference if they exist
          processedContent = processedContent.replace(specificUuidRegex, `{{ref:youtube:${videoId}:${position}}}`);
          processedContent = processedContent.replace(specificRefUuidRegex, `{{ref:youtube:${videoId}:${position}}}`);
        } else {
          // No YouTube files, use the first file of any type
          const firstFile = knowledgebaseFiles[0];
          const fileType = firstFile.type.toLowerCase();
          
          // Replace legacy format UUIDs
          processedContent = processedContent.replace(uuidRegex, `{{ref:${fileType}:${firstFile.id}:0}}`);
          processedContent = processedContent.replace(specificUuidRegex, `{{ref:${fileType}:${firstFile.id}:0}}`);
          
          // Replace new format UUIDs with specific reference
          processedContent = processedContent.replace(
            specificRefUuidRegex, 
            `{{ref:${fileType}:${firstFile.id}:0}}`
          );
          
          // Replace YouTube specific UUID references
          processedContent = processedContent.replace(
            youtubeRefUuidRegex, 
            `{{ref:${fileType}:${firstFile.id}:0}}`
          );
        }
      }
    }
    
    // Function to parse references from content
    const parseReferences = (text: string) => {
      const references: {
        fileId: string;
        text: string;
        position?: number;
        type?: string;
        sourceId?: string;
      }[] = [];
      
      // Match new reference format: {{ref:type:sourceId:position}}
      let match;
      while ((match = newReferenceRegex.exec(text)) !== null) {
        const [fullMatch, type, sourceId, position] = match;
        
        // For YouTube references, use the sourceId as is (it's the videoId)
        if (type.toLowerCase() === 'youtube') {
          references.push({
            fileId: sourceId, // For YouTube, sourceId is used directly
            text: fullMatch,
            position: parseInt(position, 10),
            type: 'youtube',
            sourceId: sourceId
          });
        } else {
          // For other types, sourceId is the fileId
          // Check if this is actually a YouTube file
          const file = knowledgebaseFiles.find(f => f.id === sourceId);
          if (file && file.type.toLowerCase() === 'youtube') {
            references.push({
              fileId: sourceId,
              text: fullMatch,
              position: parseInt(position, 10),
              type: 'youtube',
              sourceId: file.metadata?.videoId
            });
          } else {
            references.push({
              fileId: sourceId,
              text: fullMatch,
              position: parseInt(position, 10),
              type: type.toLowerCase()
            });
          }
        }
      }
      
      // Reset regex for next use
      newReferenceRegex.lastIndex = 0;
      
      // Match video/transcription format: {{ref:video/transcription:uuid:position}}
      videoTranscriptionRegex.lastIndex = 0;
      while ((match = videoTranscriptionRegex.exec(text)) !== null) {
        const [fullMatch, uuid, position] = match;
        
        // Find the file to determine its type
        const file = knowledgebaseFiles.find(f => f.id === uuid);
        
        // Check if it's a YouTube video
        if (file && (file.type.toLowerCase() === 'youtube' || (file.metadata && file.metadata.videoId))) {
          references.push({
            fileId: uuid,
            text: fullMatch,
            position: parseInt(position, 10),
            type: 'youtube',
            sourceId: file.metadata?.videoId
          });
        } else {
          const fileType = file?.type.toLowerCase() || 'video';
          references.push({
            fileId: uuid,
            text: fullMatch,
            position: parseInt(position, 10),
            type: fileType,
            sourceId: file?.metadata?.videoId // Add videoId for video files
          });
        }
      }
      
      // Match legacy reference format: {{fileId:position}}
      legacyReferenceRegex.lastIndex = 0;
      while ((match = legacyReferenceRegex.exec(text)) !== null) {
        const [fullMatch, fileId, position] = match;
        
        // Find the file to determine its type
        const file = knowledgebaseFiles.find(f => f.id === fileId);
        
        // Check if it's a YouTube video
        if (file && (file.type.toLowerCase() === 'youtube' || (file.metadata && file.metadata.videoId))) {
          references.push({
            fileId,
            text: fullMatch,
            position: parseInt(position, 10),
            type: 'youtube',
            sourceId: file.metadata?.videoId
          });
        } else {
          const fileType = file?.type.toLowerCase() || 'document';
          references.push({
            fileId,
            text: fullMatch,
            position: parseInt(position, 10),
            type: fileType,
            sourceId: file?.metadata?.videoId
          });
        }
      }
      
      return references;
    };
    
    // Parse references from the processed content
    const references = parseReferences(processedContent);
    
    // Create a map of references for quick lookup
    const referenceMap = new Map();
    references.forEach(ref => {
      referenceMap.set(ref.text, ref);
    });
    
    // Split content by reference patterns and create React elements
    const parts = processedContent.split(/({{ref:[a-zA-Z0-9-/]+:[a-zA-Z0-9-_]+:\d+}}|{{[a-zA-Z0-9-]+:\d+}})/g);
    
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => {
            const children = React.Children.toArray(props.children);
            const processedChildren = children.map((child, index) => {
              if (typeof child === 'string') {
                // Process the string to replace reference patterns with ReferenceLink components
                const textParts = child.split(/({{ref:[a-zA-Z0-9-/]+:[a-zA-Z0-9-_]+:\d+}}|{{[a-zA-Z0-9-]+:\d+}})/g);
                
                return textParts.map((part, partIndex) => {
                  const reference = referenceMap.get(part);
                  if (reference) {
                    const file = knowledgebaseFiles.find(f => f.id === reference.fileId);
                    return (
                      <ReferenceLink
                        key={`${index}-${partIndex}`}
                        reference={reference}
                        file={file}
                        onClick={handleReferenceClick}
                      />
                    );
                  }
                  return part;
                });
              }
              return child;
            });
            
            return <p {...props}>{processedChildren}</p>;
          },
          li: ({ node, ...props }) => {
            const children = React.Children.toArray(props.children);
            const processedChildren = children.map((child, index) => {
              if (typeof child === 'string') {
                // Process the string to replace reference patterns with ReferenceLink components
                const textParts = child.split(/({{ref:[a-zA-Z0-9-/]+:[a-zA-Z0-9-_]+:\d+}}|{{[a-zA-Z0-9-]+:\d+}})/g);
                
                return textParts.map((part, partIndex) => {
                  const reference = referenceMap.get(part);
                  if (reference) {
                    const file = knowledgebaseFiles.find(f => f.id === reference.fileId);
                    return (
                      <ReferenceLink
                        key={`${index}-${partIndex}`}
                        reference={reference}
                        file={file}
                        onClick={handleReferenceClick}
                      />
                    );
                  }
                  return part;
                });
              }
              return child;
            });
            
            return <li {...props}>{processedChildren}</li>;
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Chat with AI" 
          subtitle="Ask questions about your knowledge base" 
        />
        
        <main className="flex-1 overflow-hidden flex">
          {/* Left side: Chat interface */}
          <div className="flex-1 flex flex-col overflow-hidden border-r">
            {/* Knowledge Base Selector */}
            <div className="border-b p-4">
              <div className="max-w-2xl mx-auto">
                <KnowledgeBaseSelector 
                  onSelect={handleKnowledgeBaseSelect}
                  initialKnowledgeBaseId={initialKnowledgeBaseId}
                />
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {selectedKnowledgeBase ? (
                <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">
                      Chat with {selectedKnowledgeBase.title}
                    </h2>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearChat}
                        disabled={messages.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Chat
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateStudyNotes}
                        disabled={isGeneratingNotes || messages.length < 3}
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        {isGeneratingNotes ? 'Generating...' : 'Generate Study Notes'}
                      </Button>
                    </div>
                  </div>
                  
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <Bot className="h-12 w-12 text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium">No messages yet</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                        Start a conversation by typing a message below.
                      </p>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div 
                        key={message.id} 
                        className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} mb-4`}
                      >
                        {!message.isUser && (
                          <div className="flex-shrink-0 mr-3">
                            <Bot className="h-8 w-8 rounded-full bg-sattva-100 p-1 text-sattva-600" />
                          </div>
                        )}
                        
                        <div 
                          className={`max-w-[80%] rounded-lg p-4 ${
                            message.isUser 
                              ? 'bg-sattva-600 text-white' 
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {message.isUser ? (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          ) : (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              {renderMessageContent(message.content)}
                            </div>
                          )}
                          
                          <div className="mt-1 text-xs opacity-70">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        
                        {message.isUser && (
                          <div className="flex-shrink-0 ml-3">
                            <UserAvatar />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                  
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div className="flex max-w-[80%] flex-row">
                        <div className="flex-shrink-0 mr-3">
                          <Bot className="h-8 w-8 rounded-full bg-sattva-100 p-1 text-sattva-600" />
                        </div>
                        <div className="rounded-lg bg-gray-100 p-4 text-gray-800">
                          <div className="flex space-x-2">
                            <div className="h-2 w-2 rounded-full bg-sattva-400 animate-bounce"></div>
                            <div className="h-2 w-2 rounded-full bg-sattva-400 animate-bounce [animation-delay:0.2s]"></div>
                            <div className="h-2 w-2 rounded-full bg-sattva-400 animate-bounce [animation-delay:0.4s]"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <FileText className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium">Select a Knowledge Base</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Choose a knowledge base from the dropdown above to start chatting.
                  </p>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t p-4">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <Input
                      placeholder={selectedKnowledgeBase 
                        ? `Ask about your "${selectedKnowledgeBase.title}" knowledge base...` 
                        : "Select a knowledge base to start..."
                      }
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="pr-20 resize-none py-3 min-h-[56px]"
                      disabled={!selectedKnowledgeBase}
                    />
                    <div className="absolute right-2 bottom-2 flex">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleClearChat}
                        className="h-8 w-8"
                        title="Clear chat"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleUploadFiles}
                        className="h-8 w-8"
                        title="Upload files"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={!inputMessage.trim() || !selectedKnowledgeBase}
                    className="bg-sattva-600 hover:bg-sattva-700 h-[56px] px-6"
                  >
                    <SendHorizonal className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right side: Transcripts and Files */}
          <div className="w-[400px] flex flex-col bg-white">
            <Tabs defaultValue="transcripts" className="flex-1 flex flex-col" value={activeTab} onValueChange={(value) => setActiveTab(value as 'transcripts' | 'files')}>
              <div className="border-b px-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                </TabsList>
              </div>
              
              {/* Transcripts Tab */}
              <TabsContent value="transcripts" className="flex-1 flex flex-col p-0">
                {selectedFile ? (
                  <div className="flex flex-col h-full">
                    {/* File Header */}
                    <div className="p-4 border-b flex-shrink-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-sm truncate">{selectedFile.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                              {getFileTypeLabel(selectedFile.type)}
                            </span>
                            {selectedFile.metadata?.duration && (
                              <span className="text-xs text-gray-500">
                                {formatDuration(selectedFile.metadata.duration)}
                              </span>
                            )}
                            {selectedFile.metadata?.page_count && (
                              <span className="text-xs text-gray-500">
                                {selectedFile.metadata.page_count} pages
                              </span>
                            )}
                          </div>
                        </div>
                        {selectedFile.source_url && (
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <a href={selectedFile.source_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                      
                      {/* YouTube specific controls */}
                      {isYoutubeVideo && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Chunk Size:</span>
                            <Select 
                              value={chunkSize.toString()} 
                              onValueChange={handleChunkSizeChange}
                            >
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue placeholder="Chunk Size" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="15">15 seconds</SelectItem>
                                <SelectItem value="30">30 seconds</SelectItem>
                                <SelectItem value="60">1 minute</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* YouTube Player */}
                    {isYoutubeVideo && videoId && (
                      <div className="p-4 border-b">
                        <YoutubePlayer 
                          videoId={videoId} 
                          currentTime={currentTime}
                          onSeek={setCurrentTime}
                          height={200}
                        />
                      </div>
                    )}
                    
                    {/* Content Area */}
                    <div className="overflow-y-auto flex-grow" ref={transcriptContainerRef} style={{ maxHeight: isYoutubeVideo ? 'calc(100vh - 400px)' : 'calc(100vh - 200px)' }}>
                      {isYoutubeVideo && chunkedTranscript.length > 0 ? (
                        <div className="p-4 space-y-2">
                          {chunkedTranscript.map((chunk, index) => (
                            <div 
                              key={index}
                              id={`chunk-${chunk.startTime}`}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                                currentTime >= chunk.startTime && currentTime <= chunk.endTime 
                                  ? 'bg-sattva-50 border-sattva-200' 
                                  : ''
                              }`}
                              onClick={() => handleTranscriptChunkClick(chunk.startTime)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 mt-1">
                                  <Play className="h-3 w-3 text-gray-500" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-500">
                                      {formatTime(chunk.startTime)} - {formatTime(chunk.endTime)}
                                    </span>
                                  </div>
                                  <p className="text-sm">{chunk.text}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4">
                          {selectedFile.content_text ? (
                            <pre className="whitespace-pre-wrap font-sans text-sm">
                              {selectedFile.content_text}
                            </pre>
                          ) : (
                            <div className="text-left py-8">
                              <p className="text-muted-foreground">
                                No content available for this file.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-start justify-start p-8">
                    <div>
                      <FileText className="h-12 w-12 text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium">No file selected</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                        Select a file from the Files tab or click on a reference in the chat to view its content.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              {/* Files Tab */}
              <TabsContent value="files" className="flex-1 p-0">
                <div className="overflow-y-auto h-full" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                  <div className="p-4 space-y-2">
                    {knowledgebaseFiles.length > 0 ? (
                      knowledgebaseFiles.map((file) => (
                        <div 
                          key={file.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedFile?.id === file.id 
                              ? 'bg-sattva-50 border-sattva-200' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleFileSelect(file)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-gray-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{file.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                                  {getFileTypeLabel(file.type)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(file.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-left py-8">
                        <p className="text-muted-foreground">
                          {selectedKnowledgeBase 
                            ? 'No files found in this knowledge base.' 
                            : 'Select a knowledge base to see files.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
      
      {/* Study Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Study Notes</DialogTitle>
            <DialogDescription>
              Generated study notes based on your conversation
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto my-4">
            <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap font-mono text-sm">
              {studyNotes}
            </div>
          </div>
          
          <DialogFooter className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopyNotes}>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button onClick={handleSaveNotes}>
                <Save className="h-4 w-4 mr-2" />
                Save to Knowledge Base
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setShowNotesDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
