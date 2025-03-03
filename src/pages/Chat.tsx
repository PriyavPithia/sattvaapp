import { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizonal, Plus, Bot, Upload, Clock, FileText, ExternalLink, Youtube, Play, Trash2, BookOpen } from 'lucide-react';
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  references?: {
    fileId: string;
    text: string;
    position?: number;
  }[];
};

// Custom component for rendering inline references
type ReferenceButtonProps = {
  reference: {
    fileId: string;
    text: string;
    position?: number;
  };
  knowledgebaseFiles: FileRecord[];
  onReferenceClick: (reference: { fileId: string; position?: number }) => void;
  getFileTypeLabel: (type: string) => string;
};

const ReferenceButton = ({ reference, knowledgebaseFiles, onReferenceClick, getFileTypeLabel }: ReferenceButtonProps) => {
  const file = knowledgebaseFiles.find(f => f.id === reference.fileId);
  const fileType = file ? file.type.toLowerCase() : 'unknown';
  
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
    label = reference.position ? formatTime(reference.position) : 'Audio';
  } else if (fileType === 'video') {
    icon = <Play className="h-3 w-3 mr-1" />;
    label = reference.position ? formatTime(reference.position) : 'Video';
  }
  
  return (
    <button
      onClick={() => onReferenceClick(reference)}
      className="inline-flex items-center px-2 py-0.5 rounded bg-sattva-50 border border-sattva-200 hover:bg-sattva-100 text-xs mx-1 align-middle text-sattva-700 transition-colors"
      title={`View reference in ${file?.name || 'source'}`}
    >
      {icon}
      {label}
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
                  content: `# Welcome to Sattva AI\n\nHello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
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
                content: `# Welcome to Sattva AI\n\nHello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
                isUser: false,
                timestamp: new Date()
              }
            ]);
            
            // Save the welcome message
            await chatService.addMessage(
              newChat.id,
              `# Welcome to Sattva AI\n\nHello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
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
      toast.error('Chat not initialized properly');
      return;
    }

    // Add user message
    const userMessageId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: userMessageId,
      content: inputMessage,
      isUser: true,
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
        isUser: false,
        timestamp: new Date(),
        references: aiResponse.references
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
          setSelectedFile(referencedFile);
          setActiveTab('transcripts');
          
          // If it's a YouTube video, set the current time
          if (referencedFile.type.toLowerCase() === 'youtube' && firstReference.position) {
            setCurrentTime(firstReference.position);
          }
        }
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast.error('Failed to get AI response');
      
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: "# Error Processing Request\n\nI'm sorry, I encountered an error while processing your request. Please try again later.",
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      
      // Save error message to database
      await chatService.addMessage(
        currentChat,
        "# Error Processing Request\n\nI'm sorry, I encountered an error while processing your request. Please try again later.",
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
          content: `# Welcome to Sattva AI\n\nHello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
          isUser: false,
          timestamp: new Date()
        }
      ]);
      
      // Add the welcome message to the database
      await chatService.addMessage(
        currentChat,
        `# Welcome to Sattva AI\n\nHello! I'm your AI assistant. I'm connected to your "${selectedKnowledgeBase.title}" knowledge base. How can I help you today?`,
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

  const handleReferenceClick = (reference: { fileId: string; position?: number }) => {
    // Find the file
    const file = knowledgebaseFiles.find(f => f.id === reference.fileId);
    
    if (file) {
      setSelectedFile(file);
      setActiveTab('transcripts');
      
      // If it's a YouTube video and has a position (timestamp)
      if (file.type.toLowerCase() === 'youtube' && reference.position !== undefined) {
        setCurrentTime(reference.position);
        
        // If we have chunked transcript, find the chunk that contains this timestamp
        if (chunkedTranscript.length > 0) {
          const chunk = chunkedTranscript.find(
            c => reference.position! >= c.startTime && reference.position! <= c.endTime
          );
          
          if (chunk) {
            // Find the element and scroll to it
            setTimeout(() => {
              const element = document.getElementById(`chunk-${chunk.startTime}`);
              if (element) {
                // Ensure the parent container is scrollable
                const container = element.closest('.overflow-y-auto');
                if (container) {
                  // Calculate position to ensure the element is fully visible
                  const containerRect = container.getBoundingClientRect();
                  const elementRect = element.getBoundingClientRect();
                  const offset = elementRect.top - containerRect.top;
                  
                  // Scroll with offset to ensure visibility
                  container.scrollTo({
                    top: container.scrollTop + offset - 100, // 100px buffer from the top
                    behavior: 'smooth'
                  });
                } else {
                  // Fallback to default scrollIntoView
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                element.classList.add('bg-yellow-100');
                setTimeout(() => {
                  element.classList.remove('bg-yellow-100');
                }, 2000);
              }
            }, 500);
          }
        }
      } else if (['pdf', 'text', 'docx', 'txt'].includes(file.type.toLowerCase())) {
        // For text-based files, we could implement highlighting of the referenced text
        // This would require additional logic to find the text in the content
        toast.info('Navigated to referenced document');
      } else if (reference.position !== undefined) {
        // For non-YouTube files with a position, we need to scroll to the position in the text
        setTimeout(() => {
          const contentElement = document.querySelector('.overflow-y-auto.flex-grow');
          if (contentElement && file.content_text) {
            // Calculate approximate position in the content
            const contentLength = file.content_text.length;
            const scrollPercentage = Math.min(1, Math.max(0, reference.position! / contentLength));
            
            // Scroll to the approximate position
            const scrollHeight = contentElement.scrollHeight;
            contentElement.scrollTo({
              top: scrollHeight * scrollPercentage - 100, // 100px buffer from the top
              behavior: 'smooth'
            });
          }
        }, 500);
      }
    } else {
      toast.error('Referenced file not found');
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
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, tempMessage]);
      
      // Format messages for the AI service
      const formattedMessages = messages.map(msg => ({
        content: msg.content,
        isUser: msg.isUser
      }));
      
      // Generate study notes
      const notes = await aiService.generateStudyNotes(formattedMessages);
      
      // Remove the temporary message
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempMessageId));
      
      // Add the study notes as a new AI message
      const notesMessageId = `ai-notes-${Date.now()}`;
      const notesMessage: Message = {
        id: notesMessageId,
        content: notes,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, notesMessage]);
      
      // Save the notes message to the database
      await chatService.addMessage(
        currentChat,
        notes,
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
  const renderContentWithReferences = (content: string, references?: { fileId: string; text: string; position?: number; }[]) => {
    // Check if the content starts with a code block format that might be causing the issue
    const contentToRender = content.startsWith('```') && !content.startsWith('```json') && !content.startsWith('```html') && !content.startsWith('```css') && !content.startsWith('```js') && !content.startsWith('```typescript') && !content.startsWith('```jsx') && !content.startsWith('```tsx')
      ? content.replace(/^```.*?\n/, '').replace(/```$/, '') // Remove the code block markers
      : content;
      
    if (!references || references.length === 0) {
      return (
        <div className="prose prose-sm  max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-gray-800 prose-blockquote:py-1 prose-blockquote:rounded-sm">
          <ReactMarkdown>
            {contentToRender}
          </ReactMarkdown>
        </div>
      );
    }

    // Check if the content already contains reference markers
    // Support both formats: {{ref:fileId:position}} and {{ref}}
    const hasReferenceMarkers = /\{\{ref(:[a-zA-Z0-9-]+:\d+)?\}\}/g.test(contentToRender);
    
    if (hasReferenceMarkers) {
      // Create a map of reference IDs to their data for quick lookup
      const referenceMap = new Map();
      
      // For the new format {{ref}}, we'll assign references sequentially
      let refIndex = 0;
      
      // First, add all the explicit references (format: {{ref:fileId:position}})
      references.forEach((ref) => {
        const refKey = `{{ref:${ref.fileId}:${ref.position || 0}}}`;
        referenceMap.set(refKey, ref);
      });

      // Split content by both reference patterns
      const parts = contentToRender.split(/(\{\{ref(:[a-zA-Z0-9-]+:\d+)?\}\})/g);
      
      // Filter out the capture groups and empty strings
      const filteredParts = parts.filter(part => part && !part.startsWith(':'));
      
      return (
        <div className="prose prose-sm  max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-gray-800 prose-blockquote:py-1 prose-blockquote:rounded-sm">
          {filteredParts.map((part, index) => {
            // Check if this part is a reference
            if (part === '{{ref}}') {
              // For the new format, assign references sequentially
              const ref = references[refIndex % references.length];
              refIndex++;
              
              return (
                <span className="inline-block" key={`inline-ref-${index}`}>
                  <ReferenceButton
                    reference={ref}
                    knowledgebaseFiles={knowledgebaseFiles}
                    onReferenceClick={handleReferenceClick}
                    getFileTypeLabel={getFileTypeLabel}
                  />
                </span>
              );
            } else if (referenceMap.has(part)) {
              // For the explicit format
              const ref = referenceMap.get(part);
              
              return (
                <span className="inline-block" key={`inline-ref-${index}`}>
                  <ReferenceButton
                    reference={ref}
                    knowledgebaseFiles={knowledgebaseFiles}
                    onReferenceClick={handleReferenceClick}
                    getFileTypeLabel={getFileTypeLabel}
                  />
                </span>
              );
            } else {
              // Render regular markdown content
              return part ? (
                <ReactMarkdown key={`content-${index}`}>
                  {part}
                </ReactMarkdown>
              ) : null;
            }
          })}
        </div>
      );
    } else {
      // For backward compatibility with existing messages that don't have inline references
      // Just render the content normally and add references at the end
      return (
        <>
          <div className="prose prose-sm md:prose-base lg:prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-gray-800 prose-blockquote:py-1 prose-blockquote:rounded-sm">
            <ReactMarkdown>
              {contentToRender}
            </ReactMarkdown>
          </div>
          
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
            <p className="font-semibold mb-1">References:</p>
            <div className="flex flex-wrap gap-2">
              {references.map((ref, refIndex) => (
                <ReferenceButton
                  key={`ref-${refIndex}`}
                  reference={ref}
                  knowledgebaseFiles={knowledgebaseFiles}
                  onReferenceClick={handleReferenceClick}
                  getFileTypeLabel={getFileTypeLabel}
                />
              ))}
            </div>
          </div>
        </>
      );
    }
  };

  // Update the AI service to modify the system prompt
  useEffect(() => {
    // Modify the system prompt to use the new reference format
    // This is just to inform you that we need to update the AI service later
  }, []);

  return (
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
                        onClick={handleClearChat}
                        disabled={messages.length <= 1}
                        className="whitespace-nowrap flex-1 md:flex-none"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Chat
                      </Button>
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
                            renderContentWithReferences(message.content, message.references)
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
          <div className="w-[500px] flex flex-col bg-white">
            <Tabs defaultValue="transcripts" className="flex-1 flex flex-col" value={activeTab} onValueChange={(value) => setActiveTab(value as 'transcripts' | 'files')}>
              <div className="border-b px-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                </TabsList>
              </div>
              
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
                          {chunkedTranscript.map((chunk, index) => (
                            <div 
                              key={`chunk-${index}`}
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
    </div>
  );
};

export default Chat;
