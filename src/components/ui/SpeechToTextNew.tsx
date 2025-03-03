import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Mic, Square, Save, Trash } from 'lucide-react';
import { AudioRecorder } from '@/lib/audioRecorder';
import { toast } from 'sonner';

// Add type definitions for the Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

// Add the SpeechRecognition constructor to the Window interface
declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognition;
    };
  }
}

interface SpeechToTextProps {
  onTranscriptionComplete?: (text: string) => void;
  onSave?: (text: string) => void;
  onProcessingChange?: (isProcessing: boolean) => void;
  initialText?: string;
  className?: string;
}

export function SpeechToText({
  onTranscriptionComplete,
  onSave,
  onProcessingChange,
  initialText = '',
  className = '',
}: SpeechToTextProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState(initialText);
  const [isSupported, setIsSupported] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  const audioRecorder = useRef<AudioRecorder>(new AudioRecorder());
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Notify parent component when recording state changes
  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isRecording);
    }
  }, [isRecording, onProcessingChange]);

  // Check if browser supports audio recording and speech recognition
  useEffect(() => {
    const isSpeechRecognitionSupported = 'SpeechRecognition' in window || 
      'webkitSpeechRecognition' in window;
    
    setIsSupported(AudioRecorder.isSupported() && isSpeechRecognitionSupported);
  }, []);

  // Handle recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  // Listen for volume level events
  useEffect(() => {
    const handleVolumeLevel = (event: Event) => {
      const customEvent = event as CustomEvent;
      setVolumeLevel(customEvent.detail.level * 100);
    };

    window.addEventListener('volume-level', handleVolumeLevel);

    return () => {
      window.removeEventListener('volume-level', handleVolumeLevel);
    };
  }, []);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      // Clear previous data
      setTranscribedText('');
      
      // Start recording for volume visualization only
      await audioRecorder.current.startRecording();
      
      // Initialize speech recognition
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognitionConstructor) {
        throw new Error('Speech recognition not supported in this browser');
      }
      
      const recognition = new SpeechRecognitionConstructor();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Update the transcribed text with both final and interim results
        setTranscribedText(finalTranscript + interimTranscript);
        
        // Call the callback if provided
        if (onTranscriptionComplete) {
          onTranscriptionComplete(finalTranscript + interimTranscript);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        toast.error(`Speech recognition error: ${event.error}`);
      };
      
      recognition.onend = () => {
        // Only restart if we're still recording
        if (isRecording) {
          recognition.start();
        }
      };
      
      recognition.start();
      recognitionRef.current = recognition;
      
      setIsRecording(true);
      setRecordingDuration(0);
      
      toast.success('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    try {
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      
      // Stop audio recording (used for volume visualization)
      await audioRecorder.current.stopRecording();
      
      setIsRecording(false);
      
      toast.success('Recording stopped');
      
      // Call the callback with the final transcription
      if (onTranscriptionComplete && transcribedText) {
        onTranscriptionComplete(transcribedText);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      toast.error('Failed to stop recording');
    }
  };

  const handleSave = () => {
    if (onSave && transcribedText.trim()) {
      onSave(transcribedText);
      toast.success('Transcription saved');
    }
  };

  const handleClear = () => {
    setTranscribedText('');
    setRecordingDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Speech to Text</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-red-500">
            Your browser does not support speech recognition.
            Please use a modern browser like Chrome or Edge.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Speech to Text</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRecording ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={stopRecording}
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="default"
                size="icon"
                onClick={startRecording}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <span className={`font-mono ${isRecording ? 'text-red-500' : ''}`}>
              {formatDuration(recordingDuration)}
            </span>
          </div>
          
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="animate-pulse text-red-500">Recording</span>
              <div 
                className="w-3 h-3 rounded-full bg-red-500 animate-pulse"
                style={{ 
                  transform: `scale(${1 + volumeLevel / 100})`,
                  opacity: 0.5 + volumeLevel / 200
                }}
              ></div>
            </div>
          )}
        </div>
        
        {isRecording && (
          <div className="space-y-2">
            <Progress value={volumeLevel} className="h-1" />
            <p className="text-xs text-gray-500">
              Speak clearly into your microphone. Click the stop button when finished.
            </p>
          </div>
        )}
        
        <Textarea
          placeholder="Transcribed text will appear here in real-time as you speak..."
          value={transcribedText}
          onChange={(e) => setTranscribedText(e.target.value)}
          className="min-h-[150px]"
        />
        
        {isRecording && (
          <div className="text-xs text-gray-500">
            Real-time transcription is active. You can see the text as you speak.
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isRecording || !transcribedText}
        >
          <Trash className="h-4 w-4 mr-2" />
          Clear
        </Button>
        
        <Button
          onClick={handleSave}
          disabled={isRecording || !transcribedText.trim()}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </CardFooter>
    </Card>
  );
} 