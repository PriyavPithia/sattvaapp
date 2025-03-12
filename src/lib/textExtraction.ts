/**
 * Text extraction utilities for Sattva AI
 * This file contains functions for extracting text from various file types
 */

import * as pdfjsLib from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { scrapeWebsite } from './websiteScraper';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Types for extracted content
export interface ExtractedContent {
  text: string;
  metadata: {
    source_type: string;
    page_count?: number;
    duration?: number;
    title?: string;
    [key: string]: any;
  };
}

/**
 * Extract text from a PDF file using PDF.js
 * This is a client-side implementation that works in the browser
 */
export async function extractTextFromPdf(file: File): Promise<ExtractedContent> {
  try {
    console.log(`[PDF Extraction] Starting extraction for ${file.name} (${formatFileSize(file.size)})`);
    
    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    console.log(`[PDF Extraction] PDF has ${totalPages} pages`);
    
    let fullText = '';
    
    // Iterate through each page
    for (let i = 1; i <= totalPages; i++) {
      console.log(`[PDF Extraction] Processing page ${i}/${totalPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract text items and join them
      const pageText = textContent.items
        .map((item: TextItem) => item.str)
        .join(' ');
      
      fullText += `[Page ${i}]\n${pageText}\n\n`;
    }
    
    console.log(`[PDF Extraction] Extracted ${fullText.length} characters of text`);
    console.log(`[PDF Extraction] Text sample: ${fullText.substring(0, 100)}...`);
    
    return {
      text: fullText,
      metadata: {
        source_type: 'pdf',
        page_count: totalPages,
        title: file.name
      }
    };
  } catch (error) {
    console.error('[PDF Extraction] Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract text from a DOCX file
 * This would typically be handled server-side
 */
export async function extractTextFromDocx(file: File): Promise<ExtractedContent> {
  // In a real implementation, you would use a library like mammoth.js
  // For now, we'll return a placeholder
  console.log(`[DOCX Extraction] Starting extraction for ${file.name} (${formatFileSize(file.size)})`);
  
  // Generate some placeholder text
  const text = `This is simulated content extracted from the DOCX file: ${file.name}\n\n` +
    `Document Title: ${file.name.replace('.docx', '')}\n` +
    `Document Size: ${formatFileSize(file.size)}\n\n` +
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\n\n` +
    `Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;
  
  console.log(`[DOCX Extraction] Extracted ${text.length} characters of text`);
  console.log(`[DOCX Extraction] Text sample: ${text.substring(0, 100)}...`);
  
  return {
    text,
    metadata: {
      source_type: 'docx',
      title: file.name
    }
  };
}

/**
 * Extract text from a plain text file
 */
export async function extractTextFromTxt(file: File): Promise<ExtractedContent> {
  console.log(`[TXT Extraction] Starting extraction for ${file.name} (${formatFileSize(file.size)})`);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      console.log(`[TXT Extraction] Extracted ${text.length} characters of text`);
      console.log(`[TXT Extraction] Text sample: ${text.substring(0, 100)}...`);
      
      resolve({
        text,
        metadata: {
          source_type: 'txt',
          title: file.name
        }
      });
    };
    
    reader.onerror = (error) => {
      console.error('[TXT Extraction] Error reading text file:', error);
      reject(new Error(`Failed to read text file: ${file.name}`));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Extract transcript from a YouTube video
 * Using SearchAPI.io's YouTube Transcripts API
 */
export async function extractTextFromYouTube(
  videoUrl: string,
  videoTitle: string = "YouTube Video"
): Promise<ExtractedContent> {
  try {
    console.log(`[YouTube Extraction] Starting extraction for URL: ${videoUrl}`);
    
    // Extract video ID from URL
    const videoId = extractYouTubeVideoId(videoUrl);
    console.log(`[YouTube Extraction] Extracted video ID: ${videoId}`);
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // First, try to get video metadata from YouTube's oEmbed API
    let videoMetadata = null;
    try {
      console.log(`[YouTube Extraction] Fetching video metadata from oEmbed API`);
      const oEmbedResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
      
      if (oEmbedResponse.ok) {
        videoMetadata = await oEmbedResponse.json();
        console.log(`[YouTube Extraction] Successfully fetched video metadata: "${videoMetadata.title}" by ${videoMetadata.author_name}`);
        // Update the title with the actual video title
        videoTitle = videoMetadata.title;
      } else {
        console.log(`[YouTube Extraction] Failed to fetch video metadata: ${oEmbedResponse.status}`);
      }
    } catch (metadataError) {
      console.log(`[YouTube Extraction] Error fetching video metadata: ${metadataError.message}`);
    }
    
    // Use SearchAPI.io's YouTube Transcripts API
    console.log(`[YouTube Extraction] Fetching transcript using SearchAPI.io YouTube Transcripts API`);
    
    // Construct the API URL with proper parameters as per documentation
    const apiUrl = new URL('https://www.searchapi.io/api/v1/search');
    apiUrl.searchParams.append('engine', 'youtube_transcripts');
    apiUrl.searchParams.append('video_id', videoId);
    apiUrl.searchParams.append('api_key', import.meta.env.VITE_SEARCH_API_KEY);
    
    console.log(`[YouTube Extraction] API URL: ${apiUrl.toString().replace(import.meta.env.VITE_SEARCH_API_KEY, '[REDACTED]')}`);
    
    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      throw new Error(`SearchAPI.io returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Log the response structure to debug
    console.log(`[YouTube Extraction] API Response structure:`, Object.keys(data));
    
    // Detailed inspection of the response
    if (data.search_metadata) {
      console.log(`[YouTube Extraction] Search metadata status: ${data.search_metadata.status}`);
    }
    
    if (data.search_parameters) {
      console.log(`[YouTube Extraction] Search parameters:`, data.search_parameters);
    }
    
    // Check for transcript data in different possible locations
    let transcriptData = null;
    
    if (data.transcript && Array.isArray(data.transcript) && data.transcript.length > 0) {
      transcriptData = data.transcript;
      console.log(`[YouTube Extraction] Found transcript in 'transcript' field with ${transcriptData.length} segments`);
    } else if (data.transcripts && Array.isArray(data.transcripts) && data.transcripts.length > 0) {
      transcriptData = data.transcripts;
      console.log(`[YouTube Extraction] Found transcript in 'transcripts' field with ${transcriptData.length} segments`);
    } else if (data.captions && Array.isArray(data.captions) && data.captions.length > 0) {
      transcriptData = data.captions;
      console.log(`[YouTube Extraction] Found transcript in 'captions' field with ${transcriptData.length} segments`);
    } else {
      // Log the full response for debugging (limiting to 1000 chars to avoid huge logs)
      const responseStr = JSON.stringify(data);
      console.error(`[YouTube Extraction] Full API response (truncated):`, responseStr.substring(0, 1000));
      
      throw new Error(`No transcript found in the API response. Response structure: ${Object.keys(data).join(', ')}`);
    }
    
    // Ensure the transcript segments have the required format
    const formattedTranscript = transcriptData.map((segment: any, index: number) => {
      // Log a sample of segments to understand their structure
      if (index < 3) {
        console.log(`[YouTube Extraction] Sample segment ${index}:`, segment);
      }
      
      return {
        text: segment.text || segment.content || '',
        start: typeof segment.start === 'number' 
          ? segment.start 
          : typeof segment.offset === 'number'
            ? segment.offset / 1000 // Convert ms to seconds if using offset
            : parseFloat(segment.start || segment.offset || '0'),
        duration: typeof segment.duration === 'number' 
          ? segment.duration 
          : parseFloat(segment.duration || '0')
      };
    });
    
    // Convert the transcript to JSON string to store in the database
    const transcriptJson = JSON.stringify(formattedTranscript);
    
    // Calculate total duration from the last segment
    const lastSegment = formattedTranscript[formattedTranscript.length - 1];
    const totalDuration = lastSegment.start + lastSegment.duration;
    
    console.log(`[YouTube Extraction] Generated ${transcriptJson.length} characters of transcript JSON`);
    console.log(`[YouTube Extraction] Total duration: ${totalDuration} seconds`);
    
    return {
      text: transcriptJson,
      metadata: {
        source_type: 'youtube',
        title: videoTitle,
        video_id: videoId,
        video_url: videoUrl,
        duration: totalDuration,
        segment_count: formattedTranscript.length,
        author: videoMetadata?.author_name || null,
        thumbnail_url: videoMetadata?.thumbnail_url || null,
        extraction_method: 'searchapi_youtube_transcripts'
      }
    };
  } catch (error) {
    console.error('[YouTube Extraction] Error extracting text from YouTube:', error);
    throw new Error(`Failed to extract text from YouTube: ${error.message}`);
  }
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Extract text from a PPTX file
 */
export async function extractTextFromPptx(file: File): Promise<ExtractedContent> {
  try {
    console.log(`[PPTX Extraction] Starting extraction for ${file.name} (${formatFileSize(file.size)})`);
    
    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PPTX file with JSZip
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    console.log(`[PPTX Extraction] Successfully loaded PPTX as ZIP`);
    
    // Get all slide files
    const slideFiles: { [key: string]: string } = {};
    const slideRegex = /ppt\/slides\/slide(\d+)\.xml/;
    
    // Find all slide XML files
    zip.forEach((relativePath, zipEntry) => {
      const match = relativePath.match(slideRegex);
      if (match && !zipEntry.dir) {
        const slideNumber = parseInt(match[1], 10);
        slideFiles[slideNumber] = relativePath;
      }
    });
    
    const slideNumbers = Object.keys(slideFiles).map(Number).sort((a, b) => a - b);
    console.log(`[PPTX Extraction] Found ${slideNumbers.length} slides`);
    
    let fullText = '';
    
    // Process each slide in order
    for (const slideNumber of slideNumbers) {
      const slidePath = slideFiles[slideNumber];
      const slideContent = await zip.file(slidePath)?.async('string');
      
      if (slideContent) {
        // Add slide number
        fullText += `[Slide ${slideNumber}]\n`;
        
        // Extract text from slide XML
        // This is a simple regex-based extraction that finds text in <a:t> tags
        const textMatches = slideContent.match(/<a:t>([^<]*)<\/a:t>/g) || [];
        
        for (const textMatch of textMatches) {
          // Extract the text between <a:t> and </a:t>
          const text = textMatch.replace(/<a:t>|<\/a:t>/g, '').trim();
          if (text) {
            fullText += `${text}\n`;
          }
        }
        
        // Also look for text in CDATA sections
        const cdataMatches = slideContent.match(/<a:t><!\[CDATA\[(.*?)\]\]><\/a:t>/g) || [];
        
        for (const cdataMatch of cdataMatches) {
          // Extract the text between CDATA markers
          const text = cdataMatch.replace(/<a:t><!\[CDATA\[|\]\]><\/a:t>/g, '').trim();
          if (text) {
            fullText += `${text}\n`;
          }
        }
        
        fullText += '\n';
      }
    }
    
    console.log(`[PPTX Extraction] Extracted ${fullText.length} characters from ${slideNumbers.length} slides`);
    
    return {
      text: fullText,
      metadata: {
        source_type: 'pptx',
        page_count: slideNumbers.length,
        title: file.name
      }
    };
  } catch (error) {
    console.error('[PPTX Extraction] Error extracting text from PPTX:', error);
    throw new Error(`Failed to extract text from PPTX: ${error.message}`);
  }
}

/**
 * Extract text from a DOC file
 * Note: This function handles both DOC and DOCX files
 */
export async function extractTextFromDoc(file: File): Promise<ExtractedContent> {
  try {
    console.log(`[DOC Extraction] Starting extraction for ${file.name} (${formatFileSize(file.size)})`);
    
    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Use mammoth to extract text from the document
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    
    console.log(`[DOC Extraction] Extracted ${text.length} characters of text`);
    
    // Log any warnings
    if (result.messages.length > 0) {
      console.log(`[DOC Extraction] Warnings:`, result.messages);
    }
    
    // Estimate page count based on text length (rough estimate)
    const estimatedPageCount = Math.max(1, Math.ceil(text.length / 3000)); // ~3000 chars per page
    
    return {
      text,
      metadata: {
        source_type: file.type.includes('openxmlformats') ? 'docx' : 'doc',
        page_count: estimatedPageCount,
        title: file.name,
        warnings: result.messages
      }
    };
  } catch (error) {
    console.error('[DOC Extraction] Error extracting text from DOC/DOCX:', error);
    throw new Error(`Failed to extract text from DOC/DOCX: ${error.message}`);
  }
}

/**
 * Extract text from an audio file using OpenAI's Whisper API
 */
export async function extractTextFromAudio(file: File): Promise<ExtractedContent> {
  try {
    console.log(`[Audio Extraction] Starting extraction for ${file.name} (${formatFileSize(file.size)})`);
    
    // Create a FormData object to send the audio file
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // You can make this configurable
    
    console.log(`[Audio Extraction] Sending request to OpenAI Whisper API`);
    
    // Make the API request
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Audio Extraction] API Error:`, errorData);
      throw new Error(`Whisper API returned status: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const text = data.text;
    
    console.log(`[Audio Extraction] Successfully transcribed audio with ${text.length} characters`);
    console.log(`[Audio Extraction] Text sample: ${text.substring(0, 100)}...`);
    
    // Estimate duration based on file size (very rough estimate)
    // A more accurate approach would be to use the Web Audio API to get the actual duration
    const estimatedDuration = Math.floor(file.size / 16000); // Assuming 16kbps audio
    
    return {
      text,
      metadata: {
        source_type: 'audio',
        title: file.name,
        duration: estimatedDuration,
        extraction_method: 'openai_whisper',
        file_type: file.type,
        file_size: file.size
      }
    };
  } catch (error) {
    console.error('[Audio Extraction] Error transcribing audio:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

/**
 * Extract text from a website by scraping its content
 * This function uses the websiteScraper to extract text from a website
 */
export async function extractTextFromWebsite(
  websiteUrl: string,
  websiteTitle: string = "Website Content"
): Promise<ExtractedContent> {
  try {
    console.log(`[Website Extraction] Starting extraction for ${websiteUrl}`);
    
    // Use the websiteScraper to extract text from the website
    const scrapedData = await scrapeWebsite(websiteUrl);
    
    if (!scrapedData.text) {
      throw new Error('No text content found in the website');
    }
    
    console.log(`[Website Extraction] Extracted ${scrapedData.text.length} characters of text`);
    console.log(`[Website Extraction] Text sample: ${scrapedData.text.substring(0, 100)}...`);
    
    return {
      text: scrapedData.text,
      metadata: {
        source_type: 'website',
        title: scrapedData.title || websiteTitle,
        url: websiteUrl,
        wordCount: scrapedData.metadata.wordCount,
        paragraphCount: scrapedData.metadata.paragraphCount,
        headings: scrapedData.metadata.headings
      }
    };
  } catch (error) {
    console.error('[Website Extraction] Error extracting text from website:', error);
    throw new Error(`Failed to extract text from website: ${error.message}`);
  }
}

/**
 * Main function to extract text from any file
 */
export async function extractTextFromFile(file: File): Promise<ExtractedContent> {
  try {
    console.log(`[Text Extraction] Starting extraction for ${file.name} (${file.type}, ${formatFileSize(file.size)})`);
    
    // Determine file type and use appropriate extraction method
    if (file.type === 'application/pdf') {
      console.log('[Text Extraction] Detected PDF file, using PDF extractor');
      return extractTextFromPdf(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('[Text Extraction] Detected DOCX file, using DOCX extractor');
      return extractTextFromDoc(file);
    } else if (file.type === 'application/msword') {
      console.log('[Text Extraction] Detected DOC file, using DOC extractor');
      return extractTextFromDoc(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      console.log('[Text Extraction] Detected PPTX file, using PPTX extractor');
      return extractTextFromPptx(file);
    } else if (file.type === 'application/vnd.ms-powerpoint') {
      console.log('[Text Extraction] Detected PPT file, using placeholder text (PPT extraction not fully supported)');
      
      const text = `[PowerPoint Extraction] This is a placeholder for extraction from ${file.name}\n\n` +
        `File: ${file.name}\n` +
        `Type: ${file.type}\n` +
        `Size: ${formatFileSize(file.size)}\n\n` +
        `Legacy PowerPoint (.ppt) files are not directly supported. For best results, please convert to .pptx format.`;
      
      return {
        text,
        metadata: {
          source_type: 'ppt',
          title: file.name
        }
      };
    } else if (file.type === 'text/plain') {
      console.log('[Text Extraction] Detected TXT file, using TXT extractor');
      return extractTextFromTxt(file);
    } else if (file.type.includes('audio')) {
      console.log('[Text Extraction] Detected audio file, using Whisper API for transcription');
      return extractTextFromAudio(file);
    } else if (file.type.includes('video')) {
      // For video files, you would use a speech-to-text service
      console.log(`[Text Extraction] Detected video file, using placeholder transcription`);
      
      const text = `[Transcription] This is a placeholder for transcription from ${file.name}\n\n` +
        `File: ${file.name}\n` +
        `Type: ${file.type}\n` +
        `Size: ${formatFileSize(file.size)}\n\n` +
        `This is simulated transcription content. In a real implementation, you would use a speech-to-text service to transcribe the video content.`;
      
      console.log(`[Text Extraction] Generated ${text.length} characters of transcription`);
      
      return {
        text,
        metadata: {
          source_type: 'video',
          title: file.name,
          duration: Math.floor(file.size / 10000) // Rough estimate of duration in seconds
        }
      };
    } else {
      // Default fallback for unsupported file types
      console.log(`[Text Extraction] Unsupported file type: ${file.type}, using generic extractor`);
      
      const text = `Content extraction not supported for ${file.name} (${file.type})\n\n` +
        `File: ${file.name}\n` +
        `Type: ${file.type}\n` +
        `Size: ${formatFileSize(file.size)}\n\n` +
        `This file type is not directly supported for text extraction. Please convert to a supported format (PDF, DOCX, PPTX, TXT) for better results.`;
      
      console.log(`[Text Extraction] Generated ${text.length} characters of generic text`);
      
      return {
        text,
        metadata: {
          source_type: 'unknown',
          title: file.name
        }
      };
    }
  } catch (error) {
    console.error('[Text Extraction] Error extracting text:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Format file size in bytes to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 