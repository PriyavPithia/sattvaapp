import axios from 'axios';

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface ChunkedTranscript {
  text: string;
  startTime: number;
  endTime: number;
  segments: TranscriptSegment[];
}

export interface YoutubeVideoDetails {
  videoId: string;
  title: string;
  channelName: string;
  transcript: TranscriptSegment[];
}

/**
 * Extract YouTube video ID from a URL
 */
export function extractYoutubeVideoId(url: string): string | null {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

/**
 * Fetch YouTube transcript using SearchAPI.io
 */
export async function fetchYoutubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    const response = await axios.get('https://www.searchapi.io/api/v1/search', {
      params: {
        engine: 'youtube_transcripts',
        video_id: videoId,
        api_key: import.meta.env.VITE_SEARCH_API_KEY
      }
    });

    if (response.data && response.data.transcript) {
      return response.data.transcript.map((segment: any) => ({
        text: segment.text,
        start: segment.start,
        duration: segment.duration
      }));
    }
    
    throw new Error('No transcript found in the response');
  } catch (error) {
    console.error('Error fetching YouTube transcript:', error);
    throw new Error('Failed to fetch YouTube transcript');
  }
}

/**
 * Fetch YouTube video details including transcript
 */
export async function fetchYoutubeVideoDetails(videoUrl: string): Promise<YoutubeVideoDetails> {
  const videoId = extractYoutubeVideoId(videoUrl);
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  try {
    // Fetch transcript
    const transcript = await fetchYoutubeTranscript(videoId);
    
    // For now, we'll use a placeholder for title and channel
    // In a real implementation, you might want to fetch these from the YouTube Data API
    return {
      videoId,
      title: 'YouTube Video',
      channelName: 'YouTube Channel',
      transcript
    };
  } catch (error) {
    console.error('Error fetching YouTube video details:', error);
    throw error;
  }
}

/**
 * Chunk transcript segments into larger chunks based on time intervals
 */
export function chunkTranscript(
  transcript: TranscriptSegment[], 
  chunkSize: number = 30 // Default chunk size is 30 seconds
): ChunkedTranscript[] {
  // Special case: if chunkSize is 0, return each segment as its own chunk (no grouping)
  if (chunkSize === 0) {
    return transcript.map(segment => ({
      text: segment.text,
      startTime: segment.start,
      endTime: segment.start + segment.duration,
      segments: [segment]
    }));
  }
  
  if (!transcript || transcript.length === 0) {
    return [];
  }
  
  const chunks: ChunkedTranscript[] = [];
  let currentChunk: ChunkedTranscript = {
    text: '',
    startTime: transcript[0].start,
    endTime: transcript[0].start + transcript[0].duration,
    segments: []
  };
  
  for (const segment of transcript) {
    // If this segment would exceed the chunk size, start a new chunk
    if (segment.start >= currentChunk.startTime + chunkSize) {
      // Finalize the current chunk
      chunks.push(currentChunk);
      
      // Start a new chunk
      currentChunk = {
        text: segment.text,
        startTime: segment.start,
        endTime: segment.start + segment.duration,
        segments: [segment]
      };
    } else {
      // Add to the current chunk
      currentChunk.text += ' ' + segment.text;
      currentChunk.endTime = segment.start + segment.duration;
      currentChunk.segments.push(segment);
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.segments.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Format seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
} 