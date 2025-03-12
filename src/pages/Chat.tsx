import { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizonal, Plus, Bot, Upload, Clock, FileText, ExternalLink, Youtube, Play, Trash2, BookOpen, Globe } from 'lucide-react';
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
import type { Components } from 'react-markdown';
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@/lib/supabase';
import remarkGfm from 'remark-gfm';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { YoutubeCitationParser } from '@/components/chat/YoutubeCitationParser';
import { TextCitationParser } from '@/components/chat/TextCitationParser';
import { MixedCitationParser } from '@/components/chat/MixedCitationParser';
import { highlightTextInElement } from '@/lib/textHighlighter';
import { CitationsList } from '@/components/chat/CitationsList';

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  references?: {
    fileId: string;
    text: string;
    position?: number;
  }[];
  isGenericResponse?: boolean;
};

// Custom component for rendering inline references
type ReferenceButtonProps = {
  reference: {
    fileId: string;
    text: string;
    position?: number;
  };
  knowledgebaseFiles: FileRecord[];
  onReferenceClick: (reference: { fileId: string; text?: string; position?: number }) => void;
  getFileTypeLabel: (type: string) => string;
};

const ReferenceButton = ({ reference, knowledgebaseFiles, onReferenceClick, getFileTypeLabel }: ReferenceButtonProps) => {
  if (!reference || !reference.fileId || !Array.isArray(knowledgebaseFiles)) return null;
  
  const file = knowledgebaseFiles.find(f => f.id === reference.fileId);
  if (!file) return null;
  
  const fileType = file.type?.toLowerCase() || 'unknown';
  
  let icon = <FileText className="h-3 w-3 mr-1" />;
  let label = getFileTypeLabel(fileType);
  
  if (fileType === 'youtube') {
    icon = <Youtube className="h-3 w-3 mr-1" />;
    label = reference.position ? formatTime(reference.position) : 'YouTube';
  } else if (fileType === 'pdf') {
    icon = <FileText className="h-3 w-3 mr-1" />;
    label = 'PDF';
  } else if (fileType === 'audio') {
    icon = <Play className="h-3 w-3 mr-1" />;
    label = 'Audio';
  } else if (fileType === 'video') {
    icon = <Play className="h-3 w-3 mr-1" />;
    label = reference.position ? formatTime(reference.position) : 'Video';
  } else if (fileType === 'website') {
    icon = <Globe className="h-3 w-3 mr-1" />;
    label = 'Website';
  }
  
  return (
    <button
      onClick={() => onReferenceClick(reference)}
      className="inline-flex items-center px-2 py-0.5 rounded bg-sattva-100 border border-sattva-300 hover:bg-sattva-200 text-xs mx-1 align-middle text-sattva-700 transition-colors"
      title={`View reference in ${file?.name || 'source'}`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
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
  const [activeTab, setActiveTab] = useState<'transcripts' | 'files'>('files');
  
  // YouTube specific state
  const [currentTime, setCurrentTime] = useState(0);
  const [chunkedTranscript, setChunkedTranscript] = useState<ChunkedTranscript[]>([]);
  const [chunkSize, setChunkSize] = useState<number>(30); // Default 30 seconds
  const [isYoutubeVideo, setIsYoutubeVideo] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentChat, setCurrentChat] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const youtubePlayerRef = useRef<{ playFromTime: (time: number) => void; getPlayer: () => any } | null>(null);
  
  // Function to parse content and replace reference markers with buttons
  const parseContentWithReferences = (text: string, refs?: { fileId: string; text: string; position?: number; }[]): string => {
    if (!text) {
      return text;
    }
    
    // Just remove all reference markers without replacing them with buttons
    return text
      .replace(/\{\{ref:[^{}]+?(?:-\d+(?:\.\d+)?)?\}\}/g, '')
      .replace(/\(ref:[a-zA-Z0-9-]+\)/g, '')
      .replace(/🔴\s*\d+:\d+/g, '');
  };

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
                role: msg.is_user ? 'user' as const : 'assistant' as const,
                timestamp: new Date(msg.created_at),
                references: msg.references
              }));
              
              setMessages(formattedMessages);
            } else {
              // Add a welcome message if no messages exist
              setMessages([
                {
                  id: 'welcome',
                  content: `Hello! I'm your AI assistant for the "${selectedKnowledgeBase.title}" knowledge base. Ask me any questions about the content, and I'll provide answers with references to the source material.`,
                  role: 'assistant' as const,
                  timestamp: new Date(),
                  isGenericResponse: true
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
                content: `Hello! I'm your AI assistant for the "${selectedKnowledgeBase.title}" knowledge base. Ask me any questions about the content, and I'll provide answers with references to the source material.`,
                role: 'assistant' as const,
                timestamp: new Date(),
                isGenericResponse: true
              }
            ]);
            
            // Save the welcome message
            await chatService.addMessage(
              newChat.id,
              `Hello! I'm your AI assistant for the "${selectedKnowledgeBase.title}" knowledge base. Ask me any questions about the content, and I'll provide answers with references to the source material.`,
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
    if (!inputMessage.trim() || isProcessing) return;
    
    if (!selectedKnowledgeBase) {
      toast.error('Please select a knowledge base first');
      return;
    }
    
    if (!currentChat) {
      toast.error('Chat not initialized properly');
      return;
    }

    // Add user message
    const userMessageId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: userMessageId,
      content: inputMessage,
      role: 'user' as const,
      timestamp: new Date()
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputMessage('');
    setIsProcessing(true);
    
    try {
      // Save user message to database
      await chatService.addMessage(currentChat, inputMessage, true);
      
      // Query the AI with the user's message
      const aiResponse = await aiService.queryKnowledgebase(selectedKnowledgeBase.id, inputMessage);
      
      // Create AI message
      const aiMessageId = `ai-${Date.now()}`;
      const aiMessage: Message = {
        id: aiMessageId,
        content: aiResponse.text,
        role: 'assistant' as const,
        timestamp: new Date(),
        references: aiResponse.references,
        isGenericResponse: aiResponse.isGenericResponse
      };
      
      // Add AI message to state
      setMessages(prevMessages => [...prevMessages, aiMessage]);
      
      // Save AI message to database
      await chatService.addMessage(
        currentChat, 
        aiResponse.text, 
        false, 
        aiResponse.references
      );
      
      // If there's a reference, select that file
      if (aiResponse.references && aiResponse.references.length > 0) {
        const firstReference = aiResponse.references[0];
        const referencedFile = knowledgebaseFiles.find(file => file.id === firstReference.fileId);
        
        if (referencedFile) {
          // Use handleSourceClick to set up the view without setting a timestamp
          handleSourceClick(referencedFile.id);
        }
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast.error('Failed to get AI response');
      
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: `I'm sorry, I encountered an error while processing your request. Please try again later.`,
        role: 'assistant' as const,
        timestamp: new Date(),
        isGenericResponse: true
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      
      // Save error message to database
      await chatService.addMessage(
        currentChat,
        `I'm sorry, I encountered an error while processing your request. Please try again later.`,
        false
      );
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

  const handleClearChat = async () => {
    if (!selectedKnowledgeBase || !currentChat) {
      toast.error('Knowledge base or chat not selected');
      return;
    }

    try {
      // Delete all messages from the database for this chat
      const { data: messages } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', currentChat);
      
      // Reset the messages in the UI
      setMessages([
        {
          id: 'welcome',
          content: `Hello! I'm your AI assistant for the "${selectedKnowledgeBase.title}" knowledge base. Ask me any questions about the content, and I'll provide answers with references to the source material.`,
          role: 'assistant' as const,
          timestamp: new Date(),
          isGenericResponse: true
        }
      ]);
      
      // Add the welcome message to the database
      await chatService.addMessage(
        currentChat,
        `Hello! I'm your AI assistant for the "${selectedKnowledgeBase.title}" knowledge base. Ask me any questions about the content, and I'll provide answers with references to the source material.`,
        false
      );
      
      toast.success('Chat cleared');
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast.error('Failed to clear chat');
    }
  };

  const handleUploadFiles = () => {
    toast.info('File upload functionality coming soon!');
  };

  const handleFileSelect = (file: FileRecord) => {
    setSelectedFile(file);
    setActiveTab('transcripts');
    
    // Reset YouTube-specific state
    setIsYoutubeVideo(false);
    setVideoId(null);
    setCurrentTime(0);
    
    // Clear existing chunked transcript
    setChunkedTranscript([]);
    
    // Process YouTube videos
    if (file.type.toLowerCase() === 'youtube' && file.source_url) {
      setIsYoutubeVideo(true);
      const extractedVideoId = extractYoutubeVideoId(file.source_url);
      if (extractedVideoId) {
        setVideoId(extractedVideoId);
      }
      
      // Process transcript if available
      if (file.content_text) {
        try {
          // Parse the content text to get transcript segments
          const segments = JSON.parse(file.content_text);
          // Create chunks from the segments
          const chunks = chunkTranscript(segments, chunkSize);
          setChunkedTranscript(chunks);
        } catch (error) {
          console.error('Error parsing transcript:', error);
        }
      }
    }
    // Process audio/video files
    else if (['audio', 'video'].includes(file.type.toLowerCase()) && file.content_text) {
      try {
        // Parse the content text to get transcript segments
        const segments = JSON.parse(file.content_text);
        // Create chunks from the segments
        const chunks = chunkTranscript(segments, chunkSize);
        setChunkedTranscript(chunks);
      } catch (error) {
        console.error('Error parsing transcript:', error);
      }
    }
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
    if (!type) return 'Unknown';
    
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'PDF';
      case 'video':
        return 'Video';
      case 'youtube':
        return 'YouTube';
      case 'audio':
        return 'Audio';
      case 'website':
        return 'Website';
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
    
    // Set the flag to indicate that the user explicitly requested playback
    window.EXPLICIT_PLAY_REQUESTED = true;
    
    // Play the video from this timestamp when the user clicks on a transcript chunk
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.playFromTime(startTime);
      console.log('Playing video from timestamp:', startTime);
    }
  };

  // Scroll to bottom of messages
  useEffect(() => {
    // Use a small timeout to ensure the DOM has updated before scrolling
    const scrollTimeout = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }
    }, 100);
    
    return () => clearTimeout(scrollTimeout);
  }, [messages]);

  const handleReferenceClick = async (reference: { fileId: string; text: string; position?: number; }) => {
    console.log('Reference clicked:', reference);
    
    // Find the file in the knowledgebase files
    const file = knowledgebaseFiles?.find(f => f.id === reference.fileId);
    if (!file) {
      console.error('File not found for reference:', reference);
      return;
    }
    
    console.log('File found:', file.name, file.type);
    
    // Set the selected file and active tab
    setSelectedFile(file);
    setActiveTab('transcripts');
    
    // Handle YouTube videos
    if (file.type.toLowerCase() === 'youtube') {
      // Set the current file
      setIsYoutubeVideo(true);
      
      // Extract the YouTube video ID
        const videoId = extractYoutubeVideoId(file.source_url);
      if (!videoId) {
        console.error('Invalid YouTube URL:', file.source_url);
        return;
      }
      
          setVideoId(videoId);
      
      // If we don't have the chunked transcript yet, fetch and parse it
      if (!chunkedTranscript) {
        try {
          // Fetch the transcript
          const response = await fetch(`/api/youtube/transcript?videoId=${videoId}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch transcript: ${response.statusText}`);
          }
          
          const data = await response.json();
          const transcript = data.transcript;
          
          // Parse the transcript into chunks
          const parsed = chunkTranscript(transcript);
          setChunkedTranscript(parsed);
          
          // Find the chunk that contains this timestamp after setting the chunked transcript
          setTimeout(() => {
            scrollToTimestamp(reference.position!);
            
            // Set the flag to indicate that the user explicitly requested playback
            window.EXPLICIT_PLAY_REQUESTED = true;
            
            // Play the video from this timestamp
            if (youtubePlayerRef.current) {
              youtubePlayerRef.current.playFromTime(reference.position!);
              console.log('Playing video from timestamp:', reference.position);
            }
          }, 500);
        } catch (error) {
          console.error('Error parsing transcript:', error);
        }
      } else {
        // If we already have the chunked transcript, just scroll to the timestamp
        setTimeout(() => {
          scrollToTimestamp(reference.position!);
          
          // Set the flag to indicate that the user explicitly requested playback
          window.EXPLICIT_PLAY_REQUESTED = true;
          
          // Play the video from this timestamp
          if (youtubePlayerRef.current) {
            youtubePlayerRef.current.playFromTime(reference.position!);
            console.log('Playing video from timestamp:', reference.position);
          }
        }, 300);
      }
    } else if (['audio', 'mp3', 'mpeg', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'].includes(file.type.toLowerCase()) || 
               (file.name && file.name.toLowerCase().endsWith('.mp3')) || 
               (file.source_url && file.source_url.toLowerCase().endsWith('.mp3'))) {
      // Handle audio files with or without timestamps
      console.log('Handling audio file reference:', file.name, file.type);
      setIsYoutubeVideo(false);
      
      // Set current time if position is provided
      if (reference.position !== undefined) {
        setCurrentTime(reference.position);
      }
      
      // Highlight the text if available
      if (reference.text) {
        console.log('Highlighting text in audio file:', reference.text);
        
        // Wait for the content to be rendered and tab to be active before highlighting
        setTimeout(() => {
          // Try different selectors for the content container
          // First, look for containers within the transcript tab
          const transcriptTab = document.querySelector('[data-state="active"][role="tabpanel"]');
          let contentContainer = null;
          
          if (transcriptTab) {
            // Look for containers within the active tab
            contentContainer = 
              transcriptTab.querySelector('.file-content-container') || 
              transcriptTab.querySelector('.transcript-container') || 
              transcriptTab.querySelector('.overflow-y-auto');
            
            console.log('Found transcript tab:', transcriptTab);
          }
          
          // If no container found in the transcript tab, try global selectors
          if (!contentContainer) {
            contentContainer = 
              document.querySelector('.file-content-container') || 
              document.querySelector('.transcript-container') || 
              document.querySelector('.overflow-y-auto');
          }
          
          if (contentContainer) {
            console.log('Found content container for highlighting:', contentContainer);
            
            // Give the container a moment to fully render its content
            setTimeout(() => {
              highlightTextInElement(reference.text, contentContainer!);
            }, 300);
          } else {
            console.error('Content container not found for highlighting');
          }
        }, 500);
      }
    } else if (['video'].includes(file.type.toLowerCase()) && reference.position !== undefined) {
      // Handle video files with timestamps
      console.log('Handling video file reference:', file.name, file.type);
      setIsYoutubeVideo(false);
      setCurrentTime(reference.position);
      
      // Highlight the text if available
      if (reference.text) {
        console.log('Highlighting text in video file:', reference.text);
        
        // Wait for the content to be rendered and tab to be active before highlighting
        setTimeout(() => {
          // Try different selectors for the content container
          // First, look for containers within the transcript tab
          const transcriptTab = document.querySelector('[data-state="active"][role="tabpanel"]');
          let contentContainer = null;
          
          if (transcriptTab) {
            // Look for containers within the active tab
            contentContainer = 
              transcriptTab.querySelector('.file-content-container') || 
              transcriptTab.querySelector('.transcript-container') || 
              transcriptTab.querySelector('.overflow-y-auto');
            
            console.log('Found transcript tab:', transcriptTab);
          }
          
          // If no container found in the transcript tab, try global selectors
          if (!contentContainer) {
            contentContainer = 
              document.querySelector('.file-content-container') || 
              document.querySelector('.transcript-container') || 
              document.querySelector('.overflow-y-auto');
          }
          
          if (contentContainer) {
            console.log('Found content container for highlighting:', contentContainer);
            
            // Give the container a moment to fully render its content
            setTimeout(() => {
              highlightTextInElement(reference.text, contentContainer!);
            }, 300);
          } else {
            console.error('Content container not found for highlighting');
          }
        }, 500);
      }
    } else if (file.type.toLowerCase() === 'website') {
      // Handle website references like other file types
      console.log('Handling website reference:', file.name, file.source_url);
      setIsYoutubeVideo(false);
      
      // Highlight the text using the standard highlighting function
      if (reference.text) {
        console.log('Highlighting text in website content:', reference.text);
        
        // Wait for the content to be rendered and tab to be active before highlighting
        setTimeout(() => {
          // Try different selectors for the content container
          const transcriptTab = document.querySelector('[data-state="active"][role="tabpanel"]');
          let contentContainer = null;
          
          if (transcriptTab) {
            // Look for containers within the active tab
            contentContainer = 
              transcriptTab.querySelector('.file-content-container') || 
              transcriptTab.querySelector('.transcript-container') || 
              transcriptTab.querySelector('.overflow-y-auto');
          }
          
          // If no container found in the transcript tab, try global selectors
          if (!contentContainer) {
            contentContainer = 
              document.querySelector('.file-content-container') || 
              document.querySelector('.transcript-container') || 
              document.querySelector('.overflow-y-auto');
          }
          
          if (!contentContainer) {
            console.error('Content container not found for highlighting');
            return;
          }
          
          console.log('Found content container for highlighting:', contentContainer);
          
          // Use the standard highlight function
          setTimeout(() => {
            highlightTextInElement(reference.text, contentContainer!);
          }, 300);
        }, 500);
      }
    } else {
      // For other file types (PDF, text, etc.), highlight the referenced text
      setIsYoutubeVideo(false);
      
      if (reference.text) {
        console.log('Highlighting text in non-media file:', reference.text);
        
        // Wait for the content to be rendered and tab to be active before highlighting
        setTimeout(() => {
          // Try different selectors for the content container
          // First, look for containers within the transcript tab
          const transcriptTab = document.querySelector('[data-state="active"][role="tabpanel"]');
          let contentContainer = null;
          
          if (transcriptTab) {
            // Look for containers within the active tab
            contentContainer = 
              transcriptTab.querySelector('.file-content-container') || 
              transcriptTab.querySelector('.transcript-container') || 
              transcriptTab.querySelector('.overflow-y-auto');
            
            console.log('Found transcript tab:', transcriptTab);
          }
          
          // If no container found in the transcript tab, try global selectors
          if (!contentContainer) {
            contentContainer = 
              document.querySelector('.file-content-container') || 
              document.querySelector('.transcript-container') || 
              document.querySelector('.overflow-y-auto');
          }
          
          if (!contentContainer) {
            console.error('Content container not found for highlighting');
            return;
          }
          
          console.log('Found content container for highlighting:', contentContainer);
          
          // Give the container a moment to fully render its content
          setTimeout(() => {
            highlightTextInElement(reference.text, contentContainer!);
          }, 300);
        }, 500);
      }
    }
  };

  // Update the scrollToTimestamp function to be more robust
  const scrollToTimestamp = (timestamp: number) => {
    console.log('Scrolling to timestamp:', timestamp);
    
    if (!timestamp || timestamp <= 0 || !chunkedTranscript || chunkedTranscript.length === 0) {
      console.log('Invalid timestamp or no transcript available:', timestamp);
      return;
    }
    
    console.log('Chunked transcript length:', chunkedTranscript.length);
    
    // Find the chunk that contains this timestamp
    const chunk = chunkedTranscript.find(
      c => timestamp >= c.startTime && timestamp <= c.endTime
    );
    
    // If no exact match, find the closest chunk
    if (!chunk && chunkedTranscript.length > 0) {
      console.log('No exact chunk match, finding closest chunk');
      // Sort chunks by how close they are to the timestamp
      const sortedChunks = [...chunkedTranscript].sort((a, b) => {
        const aDiff = Math.min(
          Math.abs(timestamp - a.startTime),
          Math.abs(timestamp - a.endTime)
        );
        const bDiff = Math.min(
          Math.abs(timestamp - b.startTime),
          Math.abs(timestamp - b.endTime)
        );
        return aDiff - bDiff;
      });
      
      // Use the closest chunk
      const closestChunk = sortedChunks[0];
      console.log('Using closest chunk instead:', closestChunk);
      
      // Recursively call with the closest chunk's start time
      if (closestChunk) {
        return scrollToTimestamp(closestChunk.startTime);
      }
    }
    
    if (!chunk) {
      console.error('Could not find a suitable chunk for timestamp:', timestamp);
      return;
    }
    
    console.log('Found chunk:', chunk);
    
    // Use a small delay to ensure the DOM is fully rendered
    setTimeout(() => {
      // Find the element by ID using the new format
      const chunkId = `chunk-${chunk.startTime.toString().replace('.', '-')}`;
      let element = document.getElementById(chunkId);
      
      // If element not found by ID, try finding it by data attributes
      if (!element) {
        console.log('Element not found by ID, trying to find by data attributes');
        const allChunkElements = document.querySelectorAll('[data-start-time]');
        
        for (let i = 0; i < allChunkElements.length; i++) {
          const el = allChunkElements[i] as HTMLElement;
          const startTime = parseFloat(el.dataset.startTime || '0');
          const endTime = parseFloat(el.dataset.endTime || '0');
          
          if (startTime === chunk.startTime && endTime === chunk.endTime) {
            element = el;
            console.log('Found element by data attributes');
            break;
          }
        }
      }
      
      // If still not found, try finding by content
      if (!element) {
        console.log('Element not found by data attributes, trying to find by content');
        const allChunkElements = document.querySelectorAll('.overflow-y-auto .p-3.rounded-lg.border');
        
        for (let i = 0; i < allChunkElements.length; i++) {
          const el = allChunkElements[i] as HTMLElement;
          const timeSpan = el.querySelector('span');
          
          if (timeSpan && timeSpan.textContent && timeSpan.textContent.includes(formatTime(chunk.startTime))) {
            element = el;
            console.log('Found element by content match');
            break;
          }
        }
      }
      
      if (!element) {
        console.error('Element still not found for chunk:', chunk);
        return;
      }
      
      console.log('Found element:', element);
      
      // Remove any existing highlights first - only in the transcript section
      const highlightContainer = document.querySelector('.overflow-y-auto');
      if (highlightContainer) {
        highlightContainer.querySelectorAll('.highlight-reference, .border-purple-400, .bg-purple-50').forEach(el => {
          el.classList.remove('highlight-reference');
          el.classList.remove('border-purple-400');
          el.classList.remove('bg-purple-50');
        });
      }
      
      // Add highlight classes
      element.classList.add('highlight-reference');
      element.classList.add('border-purple-400');
      element.classList.add('bg-purple-50');
      
      // Find the transcript container specifically
      const transcriptContainer = element.closest('.overflow-y-auto');
      if (transcriptContainer) {
        // Wait a moment to ensure the DOM is updated
        setTimeout(() => {
          try {
            // Scroll the element into view within the transcript container
            const { top: elementTop, height: elementHeight } = element.getBoundingClientRect();
            const { top: containerTop, height: containerHeight } = transcriptContainer.getBoundingClientRect();
            
            const relativeTop = elementTop - containerTop + transcriptContainer.scrollTop;
            const targetScrollTop = relativeTop - (containerHeight - elementHeight) / 2;
            
            // Ensure the target scroll position is within bounds
            const maxScrollTop = transcriptContainer.scrollHeight - containerHeight;
            const boundedScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
            
            console.log(`Scrolling transcript container to position: ${boundedScrollTop} (max: ${maxScrollTop}`);
            
            transcriptContainer.scrollTo({
              top: boundedScrollTop,
              behavior: 'smooth'
            });
            
            // Double-check the scroll position after a short delay
            setTimeout(() => {
              if (Math.abs(transcriptContainer.scrollTop - boundedScrollTop) > 10) {
                console.log(`Scroll position check failed. Current: ${transcriptContainer.scrollTop}, Target: ${boundedScrollTop}`);
                // Try scrolling again with a direct assignment
                transcriptContainer.scrollTop = boundedScrollTop;
              }
            }, 300);
          } catch (error) {
            console.error('Error during scroll calculation:', error);
          }
        }, 100);
      } else {
        console.error('Transcript container not found');
      }
      
      // Remove highlight after 30 seconds
      setTimeout(() => {
        if (element) {
          element.classList.remove('highlight-reference');
          element.classList.remove('border-purple-400');
          element.classList.remove('bg-purple-50');
        }
      }, 30000);
    }, 200);
  };

  // Helper function to get all text nodes in an element
  const getTextNodes = (node: Node): Text[] => {
    const textNodes: Text[] = [];
    
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node as Text);
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
      }
    };
    
    walk(node);
    return textNodes;
  };

  // Helper function to highlight text in the content
  const highlightText = (textToFind: string) => {
    if (!contentRef.current || !textToFind) {
      return;
    }
    
    console.log('Highlighting text:', textToFind);
    
        // Find the text in the content
        const content = contentRef.current.textContent || '';
        const index = content.indexOf(textToFind);
        
        if (index !== -1) {
          // Create a range to highlight the text
          const range = document.createRange();
          const textNodes = getTextNodes(contentRef.current);
          
          let charCount = 0;
          let startNode = null;
          let startOffset = 0;
          let endNode = null;
          let endOffset = 0;
          
          // Find the start and end nodes/offsets
          for (const node of textNodes) {
            const nodeLength = node.textContent?.length || 0;
            
            if (!startNode && charCount + nodeLength > index) {
              startNode = node;
              startOffset = index - charCount;
            }
            
            if (startNode && !endNode && charCount + nodeLength >= index + textToFind.length) {
              endNode = node;
              endOffset = index + textToFind.length - charCount;
              break;
            }
            
            charCount += nodeLength;
          }
          
          if (startNode && endNode) {
            // Scroll to the start node
            startNode.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight the text
            const highlightEl = document.createElement('span');
        highlightEl.className = 'bg-purple-100 highlight-reference';
            
            try {
              range.setStart(startNode, startOffset);
              range.setEnd(endNode, endOffset);
              range.surroundContents(highlightEl);
              
          // Remove the highlight after 5 seconds
              setTimeout(() => {
                if (highlightEl.parentNode) {
              // Replace the highlight element with its text content
              highlightEl.parentNode.replaceChild(
                document.createTextNode(highlightEl.textContent || ''),
                highlightEl
              );
            }
          }, 5000);
            } catch (e) {
              console.error('Error highlighting text:', e);
              
              // Fallback: just scroll to the element containing the text
              const textElements = Array.from(contentRef.current.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6'));
              const elementWithText = textElements.find(el => el.textContent?.includes(textToFind));
              if (elementWithText) {
                elementWithText.scrollIntoView({ behavior: 'smooth', block: 'center' });
                elementWithText.classList.add('bg-purple-100');
            elementWithText.classList.add('highlight-reference');
                setTimeout(() => {
                  elementWithText.classList.remove('bg-purple-100');
              elementWithText.classList.remove('highlight-reference');
            }, 5000);
              }
            }
          }
        } else {
          // If exact text not found, try to find a close match
          const textElements = Array.from(contentRef.current.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6'));
          
          // Try to find an element containing a significant portion of the text
          const words = textToFind.split(/\s+/).filter(w => w.length > 3);
          if (words.length > 0) {
            const elementWithSimilarText = textElements.find(el => 
              words.some(word => el.textContent?.includes(word))
            );
            
            if (elementWithSimilarText) {
              elementWithSimilarText.scrollIntoView({ behavior: 'smooth', block: 'center' });
              elementWithSimilarText.classList.add('bg-purple-100');
          elementWithSimilarText.classList.add('highlight-reference');
              setTimeout(() => {
                elementWithSimilarText.classList.remove('bg-purple-100');
            elementWithSimilarText.classList.remove('highlight-reference');
          }, 5000);
        }
      }
    }
  };

  const handleGenerateStudyNotes = async () => {
    if (messages.length < 3) {
      toast.error('You need more conversation to generate study notes');
      return;
    }

    if (!selectedKnowledgeBase || !currentChat) {
      toast.error('Knowledge base or chat not selected');
      return;
    }

    try {
      setIsGeneratingNotes(true);
      
      // Add a temporary message to indicate that notes are being generated
      const tempMessageId = `system-${Date.now()}`;
      const tempMessage: Message = {
        id: tempMessageId,
        content: "# Generating Study Notes\n\nGenerating study notes from our conversation...",
        role: 'assistant' as const,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      
      // Format messages for the study notes generation
      const formattedMessages = messages.map(msg => ({
        content: msg.content,
        isUser: msg.role === 'user'
      }));
      
      // Generate study notes
      const notes = await aiService.generateStudyNotes(formattedMessages);
      
      // Remove the temporary message
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempMessageId));
      
      // Add the study notes as a new AI message
      const notesMessageId = `ai-notes-${Date.now()}`;
      const notesMessage: Message = {
        id: notesMessageId,
        content: `# Study Notes\n\n${notes}`,
        role: 'assistant' as const,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, notesMessage]);
      
      // Save the notes message to the database
      await chatService.addMessage(
        currentChat,
        `# Study Notes\n\n${notes}`,
        false
      );
      
      toast.success('Study notes generated');
    } catch (error) {
      console.error('Error generating study notes:', error);
      toast.error('Failed to generate study notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Function to parse and render content with inline references
  const renderContentWithReferences = (content: string, references?: { fileId: string; text: string; position?: number; }[], isGenericResponse?: boolean) => {
    // Check if there are any references
    if (!references || references.length === 0) {
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content || ''}
        </ReactMarkdown>
        </div>
      );
    }
    
    // Check if there are any YouTube references
    const hasYoutubeReferences = references.some(ref => {
      const file = knowledgebaseFiles?.find(f => f.id === ref.fileId);
      return file?.type.toLowerCase() === 'youtube';
    });
    
    // Check if there are any non-YouTube references
    const hasOtherReferences = references.some(ref => {
      const file = knowledgebaseFiles?.find(f => f.id === ref.fileId);
      return file?.type.toLowerCase() !== 'youtube';
    });
    
    // Separate YouTube references from other references
    const youtubeReferences = references.filter(ref => {
      const file = knowledgebaseFiles?.find(f => f.id === ref.fileId);
      return file?.type.toLowerCase() === 'youtube';
    });
    
    const otherReferences = references.filter(ref => {
      const file = knowledgebaseFiles?.find(f => f.id === ref.fileId);
      return file?.type.toLowerCase() !== 'youtube';
    });
    
    return (
      <div className="prose prose-sm max-w-none">
        {hasYoutubeReferences && !hasOtherReferences && (
          /* Only YouTube references - use YoutubeCitationParser */
          <YoutubeCitationParser
            content={content || ''}
            references={youtubeReferences}
            knowledgebaseFiles={knowledgebaseFiles || []}
            onReferenceClick={handleReferenceClick}
          />
        )}
        
        {!hasYoutubeReferences && hasOtherReferences && (
          /* Only non-YouTube references - use TextCitationParser */
          <TextCitationParser
            content={content || ''}
            references={otherReferences}
            knowledgebaseFiles={knowledgebaseFiles || []}
            onReferenceClick={handleReferenceClick}
          />
        )}
        
        {hasYoutubeReferences && hasOtherReferences && (
          /* Both types of references - use MixedCitationParser */
          <MixedCitationParser
            content={content || ''}
            references={references}
            knowledgebaseFiles={knowledgebaseFiles || []}
            onReferenceClick={handleReferenceClick}
          />
        )}
        
        {/* Always show the CitationsList component for sources at the bottom if there are references */}
        {references && references.length > 0 && (
          <CitationsList 
            references={references}
            knowledgebaseFiles={knowledgebaseFiles || []}
            onReferenceClick={handleReferenceClick}
            onSourceClick={handleSourceClick}
          />
        )}
      </div>
    );
  };

  // Update the AI service to modify the system prompt
  useEffect(() => {
    // Modify the system prompt to use the new reference format
    // This is just to inform you that we need to update the AI service later
  }, []);

  // Find the renderMessage function and update it to include the CitationsList component
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    
    // Check if there are any references
    if (!message.references || message.references.length === 0) {
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} max-w-[80%]`}>
          <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
            {isUser ? (
              <UserAvatar className="h-8 w-8" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-sattva-600 flex items-center justify-center text-white">
                <Bot className="h-5 w-5" />
              </div>
            )}
          </div>
          
          <div>
            <div className={`rounded-lg px-4 py-3 ${
              isUser 
                ? 'bg-sattva-600 text-white' 
                : 'bg-white border border-sattva-200 shadow-sm'
            }`}>
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content || ''}
                  </ReactMarkdown>
                  </div>
                )}
              </div>
              
              {/* Add timestamp */}
              <div className="mt-1 text-xs text-sattva-400 text-right">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Check if there are any YouTube references
    const hasYoutubeReferences = message.references.some(ref => {
      const file = knowledgebaseFiles?.find(f => f.id === ref.fileId);
      return file?.type.toLowerCase() === 'youtube';
    });
    
    // Check if there are any non-YouTube references
    const hasOtherReferences = message.references.some(ref => {
      const file = knowledgebaseFiles?.find(f => f.id === ref.fileId);
      return file?.type.toLowerCase() !== 'youtube';
    });
    
    // Separate YouTube references from other references
    const youtubeReferences = message.references.filter(ref => {
      const file = knowledgebaseFiles?.find(f => f.id === ref.fileId);
      return file?.type.toLowerCase() === 'youtube';
    });
    
    const otherReferences = message.references.filter(ref => {
      const file = knowledgebaseFiles?.find(f => f.id === ref.fileId);
      return file?.type.toLowerCase() !== 'youtube';
    });
    
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} max-w-[80%]`}>
          <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
            {isUser ? (
              <UserAvatar className="h-8 w-8" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-sattva-600 flex items-center justify-center text-white">
                <Bot className="h-5 w-5" />
              </div>
            )}
          </div>
          
          <div>
            <div className={`rounded-lg px-4 py-3 ${
              isUser 
                ? 'bg-sattva-600 text-white' 
                : 'bg-white border border-sattva-200 shadow-sm'
            }`}>
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  {hasYoutubeReferences && !hasOtherReferences && (
                    /* Only YouTube references - use YoutubeCitationParser */
                    <YoutubeCitationParser
                      content={message.content || ''}
                      references={youtubeReferences}
                      knowledgebaseFiles={knowledgebaseFiles || []}
                      onReferenceClick={handleReferenceClick}
                    />
                  )}
                  
                  {!hasYoutubeReferences && hasOtherReferences && (
                    /* Only non-YouTube references - use TextCitationParser */
                    <TextCitationParser
                      content={message.content || ''}
                      references={otherReferences}
                      knowledgebaseFiles={knowledgebaseFiles || []}
                      onReferenceClick={handleReferenceClick}
                    />
                  )}
                  
                  {hasYoutubeReferences && hasOtherReferences && (
                    /* Both types of references - use MixedCitationParser */
                    <MixedCitationParser
                      content={message.content || ''}
                      references={message.references}
                      knowledgebaseFiles={knowledgebaseFiles || []}
                      onReferenceClick={handleReferenceClick}
                    />
                  )}
                  
                  {/* Always show the CitationsList component for sources at the bottom if there are references */}
                  {message.references && message.references.length > 0 && (
                    <div className="mt-4">
                    <CitationsList 
                      references={message.references}
                        knowledgebaseFiles={knowledgebaseFiles || []}
                      onReferenceClick={handleReferenceClick}
                        onSourceClick={handleSourceClick}
                    />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Add timestamp */}
            <div className="mt-1 text-xs text-sattva-400 text-right">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Handle clicking on a source link (without setting timestamp)
  const handleSourceClick = (fileId: string) => {
    if (!fileId || !Array.isArray(knowledgebaseFiles)) {
      console.error('Invalid file ID or knowledgebase files:', fileId);
      toast.error('Invalid source');
      return;
    }
    
    // Find the file
    const file = knowledgebaseFiles.find(f => f.id === fileId);
    
    if (!file) {
      console.error('File not found for source:', fileId);
      toast.error('Source file not found');
      return;
    }
    
    console.log('Handling source click:', file.name);
    
    // Set the selected file and active tab
    setSelectedFile(file);
    setActiveTab('transcripts');
    
    // If it's a YouTube video, set up the player but don't set a timestamp
    if (file.type.toLowerCase() === 'youtube') {
      setIsYoutubeVideo(true);
      
      // Extract video ID from the source URL if available
      if (file.source_url) {
        const videoId = extractYoutubeVideoId(file.source_url);
        if (videoId) {
          setVideoId(videoId);
          console.log('Set video ID:', videoId);
        }
      }
      
      // Ensure we have the chunked transcript for this file
      if (chunkedTranscript.length === 0 && file.content_text) {
        try {
          // Parse the content text to get transcript segments
          const segments = JSON.parse(file.content_text);
          // Create chunks from the segments
          const chunks = chunkTranscript(segments, chunkSize);
          setChunkedTranscript(chunks);
          console.log('Created chunked transcript:', chunks.length, 'chunks');
        } catch (error) {
          console.error('Error parsing transcript:', error);
        }
      }
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header 
            title="Chat with AI" 
            subtitle="Ask questions about your knowledge base" 
          />
          
          <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Left side: Chat interface */}
            <div className="flex-1 flex flex-col overflow-hidden border-r">
              {/* Knowledge Base Selector */}
              <div className="border-b p-4 bg-white">
                <div className="max-w-2xl mx-auto">
                  {selectedKnowledgeBase && (
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 w-full md:w-auto">
                        <h2 className="text-xl font-semibold whitespace-nowrap mb-2 md:mb-0">
                          Chat with {selectedKnowledgeBase.title}
                        </h2>
                        <div className="w-full md:w-auto">
                          <KnowledgeBaseSelector 
                            onSelect={handleKnowledgeBaseSelect}
                            initialKnowledgeBaseId={initialKnowledgeBaseId}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto justify-start md:justify-end mt-2 md:mt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateStudyNotes}
                          disabled={isGeneratingNotes || messages.length < 3}
                          className="whitespace-nowrap flex-1 md:flex-none"
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          {isGeneratingNotes ? 'Generating...' : 'Generate Notes'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearChat}
                          disabled={messages.length <= 1}
                          className="whitespace-nowrap flex-1 md:flex-none"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear Chat
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {!selectedKnowledgeBase && (
                    <KnowledgeBaseSelector 
                      onSelect={handleKnowledgeBaseSelect}
                      initialKnowledgeBaseId={initialKnowledgeBaseId}
                    />
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 relative">
                {selectedKnowledgeBase ? (
                  <div className="max-w-2xl mx-auto space-y-4 pb-2">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <Bot className="h-12 w-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium">No messages yet</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                          Start a conversation by typing a message below.
                        </p>
                      </div>
                    ) : (
                      messages.map((message, index) => renderMessage(message))
                    )}
                    <div ref={messagesEndRef} className="h-0 w-full" />
                    
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
              <div className="border-t p-4 bg-white">
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        placeholder={selectedKnowledgeBase ? "Type your message here..." : "Select a knowledge base to start chatting..."}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pr-4 resize-none py-3 min-h-[56px]"
                        disabled={!selectedKnowledgeBase}
                      />
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
            <div className="w-[500px] flex flex-col bg-white">
              <Tabs defaultValue="files" className="flex-1 flex flex-col" value={activeTab} onValueChange={(value) => setActiveTab(value as 'transcripts' | 'files')}>
                <div className="border-b px-4">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="files">Files</TabsTrigger>
                    <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
                  </TabsList>
                </div>
                
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
                
                {/* Transcripts Tab */}
                <TabsContent value="transcripts" className="flex-1 flex flex-col p-0 overflow-hidden">
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
                                  <SelectItem value="0">No grouping</SelectItem>
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
                            ref={youtubePlayerRef}
                            videoId={videoId} 
                            currentTime={currentTime}
                            onSeek={setCurrentTime}
                            height={240}
                          />
                        </div>
                      )}
                      
                      {/* Content Area */}
                      <div 
                        className="overflow-y-auto flex-grow pb-24" 
                        style={{ 
                          maxHeight: isYoutubeVideo 
                            ? 'calc(100vh - 450px)' 
                            : 'calc(100vh - 250px)',
                          minHeight: '300px'
                        }}
                      >
                        {isYoutubeVideo && chunkedTranscript.length > 0 ? (
                          <div className="p-4 space-y-2 pb-12">
                            {chunkedTranscript.map((chunk, index) => {
                              const isCurrentChunk = currentTime >= chunk.startTime && currentTime <= chunk.endTime;
                              const chunkId = `chunk-${chunk.startTime.toString().replace('.', '-')}`;
                              return (
                              <div 
                                key={`chunk-${index}`}
                                id={chunkId}
                                data-start-time={chunk.startTime}
                                data-end-time={chunk.endTime}
                                className={`p-3 rounded-lg border cursor-pointer transition-all duration-300 hover:bg-gray-50 ${
                                  isCurrentChunk 
                                  ? 'bg-sattva-50 border-sattva-200' 
                                    : 'border-gray-200'
                                }`}
                                onClick={() => handleTranscriptChunkClick(chunk.startTime)}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-shrink-0 mt-1">
                                      <Play className={`h-3 w-3 ${isCurrentChunk ? 'text-sattva-600' : 'text-gray-500'}`} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-medium ${isCurrentChunk ? 'text-sattva-600' : 'text-gray-500'}`}>
                                        {formatTime(chunk.startTime)} - {formatTime(chunk.endTime)}
                                      </span>
                                    </div>
                                    <p className="text-sm">{chunk.text}</p>
                                  </div>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 pb-16">
                            {selectedFile?.content_text ? (
                              <pre className="whitespace-pre-wrap font-sans text-sm min-h-[200px]">
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
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Chat;
