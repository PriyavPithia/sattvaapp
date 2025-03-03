import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { FileVideo, Save, Trash, Loader2, Play, Pause, Info } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface VideoToTextProps {
  onTranscriptionComplete?: (text: string) => void;
  onSave?: (text: string, fileName: string) => void;
  onProcessingChange?: (isProcessing: boolean) => void;
  className?: string;
}

// Supported video formats
const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime', // MOV
  'video/x-msvideo', // AVI
  'video/x-matroska', // MKV
];

// Maximum file size (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Supported audio formats for Whisper API
const SUPPORTED_WHISPER_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'wav', 'webm'];

export function VideoToText({
  onTranscriptionComplete,
  onSave,
  onProcessingChange,
  className = '',
}: VideoToTextProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [transcribedText, setTranscribedText] = useState('');
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Notify parent component when processing state changes
  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isProcessing);
    }
  }, [isProcessing, onProcessingChange]);

  // Update overall progress when individual progress values change
  useEffect(() => {
    if (isProcessing) {
      let newOverallProgress = 0;
      
      if (isConverting) {
        // During conversion, overall progress is 0-50% based on conversion progress
        newOverallProgress = Math.floor(conversionProgress * 0.5);
      } else if (isTranscribing) {
        // During transcription, overall progress is 50-100% based on transcription progress
        newOverallProgress = 50 + Math.floor(transcriptionProgress * 0.5);
      }
      
      setOverallProgress(newOverallProgress);
    } else {
      if (overallProgress === 100) {
        setCurrentStatus('Processing complete');
      } else if (!isProcessing && overallProgress > 0) {
        setCurrentStatus('Processing paused');
      }
    }
  }, [isConverting, isTranscribing, conversionProgress, transcriptionProgress, isProcessing, overallProgress]);

  // Clean up URLs and intervals when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (videoURL) {
        URL.revokeObjectURL(videoURL);
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [videoURL, audioURL]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    
    if (!selectedFile) {
      return;
    }
    
    // Validate file format
    if (!SUPPORTED_VIDEO_FORMATS.includes(selectedFile.type)) {
      setError('Unsupported file format. Please upload a video file (MP4, WEBM, MOV, etc.).');
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
    setAudioBlob(null);
    setOverallProgress(0);
    setCurrentStatus('');
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
    
    // Set the selected file
    setFile(selectedFile);
    
    // Create video URL for preview
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
    }
    setVideoURL(URL.createObjectURL(selectedFile));
  };

  // Extract audio directly from the video file
  const extractAudioFromVideo = async (videoFile: File): Promise<Blob> => {
    setCurrentStatus('Extracting audio from video file...');
    
    return new Promise((resolve, reject) => {
      try {
        // Create a simulated progress updater
        let progress = 0;
        progressIntervalRef.current = window.setInterval(() => {
          progress += 5;
          if (progress > 95) {
            progress = 95;
          }
          setConversionProgress(progress);
          setCurrentStatus(`Extracting audio: ${progress}%`);
        }, 500) as unknown as number;
        
        // Use the video file directly
        // For MP4 files, we can use them directly with Whisper API
        if (videoFile.type === 'video/mp4') {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          setConversionProgress(100);
          setCurrentStatus('Audio extraction complete');
          resolve(videoFile);
          return;
        }
        
        // For other formats, we'll create a simple audio extraction
        // by playing the video and recording its audio output
        if (videoRef.current) {
          const video = videoRef.current;
          
          // Create a MediaSource
          const mediaSource = new MediaSource();
          const url = URL.createObjectURL(mediaSource);
          video.src = url;
          
          mediaSource.addEventListener('sourceopen', async () => {
            try {
              // Read the video file
              const arrayBuffer = await videoFile.arrayBuffer();
              
              // Create a source buffer
              const sourceBuffer = mediaSource.addSourceBuffer(videoFile.type);
              sourceBuffer.appendBuffer(arrayBuffer);
              
              sourceBuffer.addEventListener('updateend', () => {
                // When the buffer is loaded, we can extract the audio
                try {
                  // Create a new audio context
                  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                  
                  // Create a media element source
                  const source = audioContext.createMediaElementSource(video);
                  
                  // Create a destination for recording
                  const destination = audioContext.createMediaStreamDestination();
                  
                  // Connect the source to the destination
                  source.connect(destination);
                  
                  // Create a media recorder
                  const mediaRecorder = new MediaRecorder(destination.stream, {
                    mimeType: 'audio/webm'
                  });
                  
                  const chunks: BlobPart[] = [];
                  
                  mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                      chunks.push(e.data);
                    }
                  };
                  
                  mediaRecorder.onstop = () => {
                    // Create the audio blob
                    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                    
                    if (progressIntervalRef.current) {
                      clearInterval(progressIntervalRef.current);
                      progressIntervalRef.current = null;
                    }
                    
                    setConversionProgress(100);
                    setCurrentStatus('Audio extraction complete');
                    
                    // Clean up
                    URL.revokeObjectURL(url);
                    
                    resolve(audioBlob);
                  };
                  
                  // Start recording
                  mediaRecorder.start(100);
                  
                  // Play the video silently
                  video.muted = true;
                  video.currentTime = 0;
                  video.play().catch(error => {
                    console.error('Error playing video:', error);
                    if (progressIntervalRef.current) {
                      clearInterval(progressIntervalRef.current);
                      progressIntervalRef.current = null;
                    }
                    reject(error);
                  });
                  
                  // Stop recording when video ends
                  video.onended = () => {
                    mediaRecorder.stop();
                    video.pause();
                  };
                } catch (error) {
                  console.error('Error setting up audio extraction:', error);
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                  }
                  reject(error);
                }
              });
            } catch (error) {
              console.error('Error reading video file:', error);
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              reject(error);
            }
          });
        } else {
          // Fallback: use the video file directly
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          setConversionProgress(100);
          setCurrentStatus('Using video file directly for transcription');
          resolve(videoFile);
        }
      } catch (error) {
        console.error('Error extracting audio:', error);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        reject(error);
      }
    });
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setTranscriptionProgress(0);
    setCurrentStatus('Preparing to transcribe audio...');
    
    try {
      // Log the audio blob details for debugging
      console.log('Audio blob type:', audioBlob.type);
      console.log('Audio blob size:', audioBlob.size);
      
      // Create a FormData object to send the audio file
      const formData = new FormData();
      
      // Determine the file extension based on MIME type
      let fileExtension = 'mp4';
      if (audioBlob.type.includes('/')) {
        fileExtension = audioBlob.type.split('/')[1];
      }
      
      // Ensure we're using a supported extension
      if (!SUPPORTED_WHISPER_FORMATS.includes(fileExtension)) {
        fileExtension = 'mp4'; // Default to mp4 which is supported
      }
      
      // Add the file to the form data
      formData.append('file', audioBlob, `audio.${fileExtension}`);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // You can make this configurable
      
      setCurrentStatus('Uploading audio to transcription service...');
      
      // Simulate upload progress since axios doesn't always report it correctly
      let simulatedProgress = 0;
      const progressInterval = setInterval(() => {
        simulatedProgress += 5;
        if (simulatedProgress > 95) {
          clearInterval(progressInterval);
          simulatedProgress = 95;
        }
        setTranscriptionProgress(simulatedProgress);
        setCurrentStatus(`Uploading and transcribing audio: ${simulatedProgress}%`);
      }, 1000);
      
      // Make the API request
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data',
          }
        }
      );
      
      // Clear the simulated progress interval
      clearInterval(progressInterval);
      
      setTranscriptionProgress(100);
      setCurrentStatus('Processing transcription results...');
      
      // Set the transcribed text
      const text = response.data.text;
      setTranscribedText(text);
      
      // Call the callback if provided
      if (onTranscriptionComplete) {
        onTranscriptionComplete(text);
      }
      
      setCurrentStatus('Transcription complete');
      return text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      
      // Handle API errors
      if (axios.isAxiosError(error) && error.response) {
        const errorMsg = `API Error: ${error.response.data.error?.message || 'Unknown error'}`;
        setCurrentStatus(errorMsg);
        throw new Error(errorMsg);
      } else {
        const errorMsg = 'Failed to transcribe audio. Please try again.';
        setCurrentStatus(errorMsg);
        throw new Error(errorMsg);
      }
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(100);
      setOverallProgress(100);
    }
  };

  const processVideo = async () => {
    if (!file) {
      setError('Please select a video file first.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setOverallProgress(0);
    setCurrentStatus('Starting video processing...');
    
    try {
      toast.info('Processing video. This may take a while...');
      
      // Step 1: Extract audio from video
      setIsConverting(true);
      const extractedAudioBlob = await extractAudioFromVideo(file);
      setIsConverting(false);
      
      if (!extractedAudioBlob) {
        throw new Error('Failed to extract audio from video');
      }
      
      setAudioBlob(extractedAudioBlob);
      
      // Create audio URL for preview if it's an audio type
      if (extractedAudioBlob.type.startsWith('audio/')) {
        const newAudioURL = URL.createObjectURL(extractedAudioBlob);
        setAudioURL(newAudioURL);
      }
      
      toast.success('Audio extracted successfully');
      setCurrentStatus('Audio extraction complete. Starting transcription...');
      
      // Step 2: Transcribe audio
      setIsTranscribing(true);
      const text = await transcribeAudio(extractedAudioBlob);
      setIsTranscribing(false);
      
      toast.success('Transcription complete');
      setCurrentStatus('Processing complete');
      setOverallProgress(100);
    } catch (error) {
      console.error('Error processing video:', error);
      setError(`Error: ${error.message}`);
      setCurrentStatus(`Failed: ${error.message}`);
      toast.error('Processing failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (onSave && transcribedText.trim() && file) {
      onSave(transcribedText, file.name.replace(/\.[^/.]+$/, '') + ' (Transcription)');
      toast.success('Transcription saved');
    }
  };

  const handleClear = () => {
    setFile(null);
    setTranscribedText('');
    setError(null);
    setUploadProgress(0);
    setConversionProgress(0);
    setTranscriptionProgress(0);
    setOverallProgress(0);
    setCurrentStatus('');
    setIsPlaying(false);
    
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
      setVideoURL(null);
    }
    
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
    
    setAudioBlob(null);
    
    // Clear any running intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    // Reset the file input
    const fileInput = document.getElementById('video-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Video to Text</CardTitle>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setShowDebugInfo(!showDebugInfo)}
          title="Toggle debug info"
        >
          <Info className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto">
        <div className="flex flex-col space-y-2">
          <label 
            htmlFor="video-file-input" 
            className="cursor-pointer border-2 border-dashed border-gray-300 rounded-md p-6 text-center hover:border-primary transition-colors"
          >
            <FileVideo className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">
              {file ? file.name : 'Click to upload a video file or drag and drop'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: MP4, WEBM, MOV, AVI, MKV (max {formatFileSize(MAX_FILE_SIZE)})
            </p>
            <input
              id="video-file-input"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
          </label>
          
          {error && (
            <div className="text-sm text-red-500 mt-2">
              {error}
            </div>
          )}
          
          {videoURL && (
            <div className="pt-2 space-y-2">
              <div className="relative max-h-[200px] overflow-hidden rounded-md">
                <video 
                  ref={videoRef}
                  src={videoURL} 
                  className="w-full object-contain max-h-[200px]" 
                  controls={false}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute bottom-2 left-2 bg-background/80 hover:bg-background"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{file?.name}</span>
                <span>{formatFileSize(file?.size || 0)}</span>
              </div>
            </div>
          )}
          
          {file && !isProcessing && !audioURL && (
            <Button 
              onClick={processVideo} 
              className="mt-2"
            >
              Process Video
            </Button>
          )}
          
          {isProcessing && (
            <div className="space-y-3 mt-2 p-3 border rounded-md bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-xs font-medium">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
              </div>
              
              <div className="text-sm font-medium">
                Status: <span className="text-primary">{currentStatus}</span>
              </div>
              
              {showDebugInfo && (
                <div className="space-y-2 text-xs text-muted-foreground border-t pt-2 mt-2">
                  <div>
                    <span className="font-medium">Converting: </span>
                    <span>{isConverting ? 'Yes' : 'No'} - {conversionProgress}%</span>
                  </div>
                  <div>
                    <span className="font-medium">Transcribing: </span>
                    <span>{isTranscribing ? 'Yes' : 'No'} - {transcriptionProgress}%</span>
                  </div>
                  {audioBlob && (
                    <div>
                      <span className="font-medium">Audio Format: </span>
                      <span>{audioBlob.type}</span>
                    </div>
                  )}
                  {file && (
                    <div>
                      <span className="font-medium">Video Format: </span>
                      <span>{file.type}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {audioURL && (
          <div className="pt-2">
            <p className="text-sm font-medium mb-1">Extracted Audio</p>
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
              className="min-h-[150px] max-h-[300px] overflow-y-auto"
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