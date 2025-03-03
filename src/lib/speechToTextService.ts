import axios from 'axios';
import { supabase } from '@/lib/supabase';

/**
 * Service for handling speech-to-text functionality using OpenAI's Whisper API
 */
export class SpeechToTextService {
  private apiKey: string;
  private socket: WebSocket | null = null;
  private isListening: boolean = false;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!this.apiKey) {
      console.error('OpenAI API key is not set in environment variables');
    }
  }

  /**
   * Transcribe audio using OpenAI's Whisper API
   * @param audioBlob The audio blob to transcribe
   * @returns The transcribed text
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      // Create a FormData object to send the audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // You can make this configurable

      // Make the API request
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Return the transcribed text
      return response.data.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Start real-time transcription
   * @param onTranscript Callback function to receive real-time transcripts
   * @param onError Callback function for errors
   */
  startRealtimeTranscription(
    onTranscript: (text: string) => void,
    onError: (error: Error) => void
  ): void {
    // This is a simulated implementation since OpenAI doesn't have a WebSocket API for Whisper
    // In a real implementation, you would connect to a streaming speech-to-text service
    
    if (this.isListening) {
      return;
    }

    this.isListening = true;
    
    // Simulate real-time transcription with periodic updates
    // In a real implementation, this would be replaced with actual WebSocket connection
    const words = [
      "Hello", "I'm", "speaking", "to", "the", "microphone", 
      "and", "this", "text", "is", "being", "transcribed", 
      "in", "real", "time", "as", "I", "speak"
    ];
    
    let transcript = "";
    let wordIndex = 0;
    
    const intervalId = setInterval(() => {
      if (!this.isListening) {
        clearInterval(intervalId);
        return;
      }
      
      if (wordIndex < words.length) {
        transcript += (transcript ? " " : "") + words[wordIndex];
        onTranscript(transcript);
        wordIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, 300); // Add a new word every 300ms
    
    // Store the interval ID to clear it later
    this.socket = { close: () => clearInterval(intervalId) } as unknown as WebSocket;
  }

  /**
   * Stop real-time transcription
   */
  stopRealtimeTranscription(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isListening = false;
  }

  /**
   * Save audio file to storage
   * @param userId User ID
   * @param knowledgebaseId Knowledgebase ID
   * @param audioBlob Audio blob to save
   * @param fileName File name
   * @returns The URL of the saved audio file
   */
  async saveAudioFile(
    userId: string,
    knowledgebaseId: string,
    audioBlob: Blob,
    fileName: string = `recording-${Date.now()}.webm`
  ): Promise<string> {
    try {
      // Create a storage path
      const filePath = `${userId}/${knowledgebaseId}/${fileName}`;
      
      // Upload the audio file to Supabase storage
      const { data, error } = await supabase.storage
        .from('audio_recordings')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });
      
      if (error) {
        throw error;
      }
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('audio_recordings')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error saving audio file:', error);
      throw new Error('Failed to save audio file');
    }
  }
}

export const speechToTextService = new SpeechToTextService(); 