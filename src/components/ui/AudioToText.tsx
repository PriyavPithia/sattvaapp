import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { FileAudio, Save, Trash, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface AudioToTextProps {
  onTranscriptionComplete?: (text: string) => void;
  onSave?: (text: string, fileName: string) => void;
  onProcessingChange?: (isProcessing: boolean) => void;
  className?: string;
}

// Supported audio formats
const SUPPORTED_AUDIO_FORMATS = [
  'audio/mpeg', // MP3
  'audio/mp4', // M4A
  'audio/wav', // WAV
  'audio/x-wav',
  'audio/webm', // WEBM
  'audio/ogg', // OGG
  'audio/flac', // FLAC
];

// Maximum file size (25MB - Whisper API limit)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function AudioToText({
  onTranscriptionComplete,
  onSave,
  onProcessingChange,
  className = '',
}: AudioToTextProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Notify parent component when processing state changes
  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isProcessing);
    }
  }, [isProcessing, onProcessingChange]);

  // Clean up audio URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
    };
  }, [audioURL]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    
    if (!selectedFile) {
      return;
    }
    
    // Validate file format
    if (!SUPPORTED_AUDIO_FORMATS.includes(selectedFile.type)) {
      setError('Unsupported file format. Please upload an audio file (MP3, WAV, M4A, WEBM, OGG, FLAC).');
      toast.error('Unsupported file format');
      return;
    }
    
    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File size exceeds the limit of ${formatFileSize(MAX_FILE_SIZE)}. Please upload a smaller file.`);
      toast.error('File too large');
      return;
    }
    
    // Clear previous data
    setError(null);
    setTranscribedText('');
    
    // Set the selected file
    setFile(selectedFile);
    
    // Create audio URL for playback
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL(URL.createObjectURL(selectedFile));
  };

  const transcribeAudio = async () => {
    if (!file) {
      setError('Please select an audio file first.');
      return;
    }
    
    setIsProcessing(true);
    setUploadProgress(0);
    
    try {
      // Create a FormData object to send the audio file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // You can make this configurable
      
      // Make the API request with upload progress tracking
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
            setUploadProgress(percentCompleted);
          },
        }
      );
      
      // Set the transcribed text
      const text = response.data.text;
      setTranscribedText(text);
      
      // Call the callback if provided
      if (onTranscriptionComplete) {
        onTranscriptionComplete(text);
      }
      
      toast.success('Transcription complete');
    } catch (error) {
      console.error('Error transcribing audio:', error);
      
      // Handle API errors
      if (axios.isAxiosError(error) && error.response) {
        setError(`API Error: ${error.response.data.error?.message || 'Unknown error'}`);
      } else {
        setError('Failed to transcribe audio. Please try again.');
      }
      
      toast.error('Transcription failed');
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleSave = () => {
    if (onSave && transcribedText.trim() && file) {
      onSave(transcribedText, file.name);
      toast.success('Transcription saved');
    }
  };

  const handleClear = () => {
    setFile(null);
    setTranscribedText('');
    setError(null);
    setUploadProgress(0);
    
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
    
    // Reset the file input
    const fileInput = document.getElementById('audio-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Audio to Text</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-2">
          <label 
            htmlFor="audio-file-input" 
            className="cursor-pointer border-2 border-dashed border-gray-300 rounded-md p-6 text-center hover:border-primary transition-colors"
          >
            <FileAudio className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">
              {file ? file.name : 'Click to upload an audio file or drag and drop'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: MP3, WAV, M4A, WEBM, OGG, FLAC (max {formatFileSize(MAX_FILE_SIZE)})
            </p>
            <input
              id="audio-file-input"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          
          {error && (
            <div className="text-sm text-red-500 mt-2">
              {error}
            </div>
          )}
          
          {file && !isProcessing && !transcribedText && (
            <Button 
              onClick={transcribeAudio} 
              className="mt-2"
            >
              Transcribe Audio
            </Button>
          )}
          
          {isProcessing && (
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
              <Progress value={uploadProgress} className="h-1" />
              <p className="text-xs text-gray-500">
                Uploading and transcribing your audio file. This may take a moment...
              </p>
            </div>
          )}
        </div>
        
        {audioURL && (
          <div className="pt-2">
            <audio src={audioURL} controls className="w-full" />
          </div>
        )}
        
        {transcribedText && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Transcription Result</h3>
              <span className="text-xs text-gray-500">
                {transcribedText.length} characters
              </span>
            </div>
            <Textarea
              value={transcribedText}
              onChange={(e) => setTranscribedText(e.target.value)}
              className="min-h-[150px]"
              placeholder="Transcribed text will appear here..."
            />
          </div>
        )}
      </CardContent>
      
      {(file || transcribedText) && (
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={isProcessing}
          >
            <Trash className="h-4 w-4 mr-2" />
            Clear
          </Button>
          
          {transcribedText && (
            <Button
              onClick={handleSave}
              disabled={isProcessing || !transcribedText.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
} 