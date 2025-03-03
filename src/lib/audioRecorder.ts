/**
 * A utility class for handling audio recording functionality
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private onDataAvailable: ((chunk: Blob) => void) | null = null;
  private recordingInterval: number | null = null;

  /**
   * Start recording audio from the user's microphone
   * @param onDataAvailable Optional callback for real-time audio chunks
   * @returns A promise that resolves when recording starts
   */
  async startRecording(onDataAvailable?: (chunk: Blob) => void): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create a new MediaRecorder instance
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      // Clear previous audio chunks
      this.audioChunks = [];
      
      // Store the callback
      this.onDataAvailable = onDataAvailable || null;
      
      // Add event listener for data available
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          
          // Call the callback if provided
          if (this.onDataAvailable) {
            this.onDataAvailable(event.data);
          }
        }
      });
      
      // Start recording with a timeslice for frequent dataavailable events
      // This allows for real-time processing of audio chunks
      this.mediaRecorder.start(1000); // Get data every 1 second
      
      // Set up an interval to check audio levels for visualization
      if (this.stream) {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(this.stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        this.recordingInterval = window.setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average volume level
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          
          // Dispatch a custom event with the volume level
          const event = new CustomEvent('volume-level', { 
            detail: { level: average / 255 } // Normalize to 0-1
          });
          window.dispatchEvent(event);
        }, 100);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to start recording');
    }
  }

  /**
   * Stop recording audio
   * @returns A promise that resolves with the recorded audio blob
   */
  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      // Clear the recording interval
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }

      // Add event listener for when recording stops
      this.mediaRecorder.addEventListener('stop', () => {
        // Create a single blob from all audio chunks
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Stop all tracks in the stream
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        // Clear the callback
        this.onDataAvailable = null;
        
        resolve(audioBlob);
      });

      // Stop recording
      this.mediaRecorder.stop();
    });
  }

  /**
   * Check if the browser supports audio recording
   * @returns True if audio recording is supported, false otherwise
   */
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Create an audio URL from a blob
   * @param blob The audio blob
   * @returns The audio URL
   */
  static createAudioURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * Revoke an audio URL
   * @param url The audio URL to revoke
   */
  static revokeAudioURL(url: string): void {
    URL.revokeObjectURL(url);
  }
} 