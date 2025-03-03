import { supabase } from './supabase';
import type { Knowledgebase, FileRecord } from './supabase';
import axios from 'axios';

// Knowledgebase operations
export const knowledgebaseService = {
  /**
   * Get all knowledgebases for a user
   */
  async getUserKnowledgebases(userId: string): Promise<Knowledgebase[]> {
    const { data, error } = await supabase
      .from('knowledgebases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching knowledgebases:', error);
      throw new Error(error.message);
    }
    
    return data as Knowledgebase[];
  },
  
  /**
   * Get a knowledgebase by ID
   */
  async getKnowledgebaseById(id: string): Promise<Knowledgebase> {
    const { data, error } = await supabase
      .from('knowledgebases')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching knowledgebase:', error);
      throw new Error(error.message);
    }
    
    return data as Knowledgebase;
  },
  
  /**
   * Create a new knowledgebase
   */
  async createKnowledgebase(userId: string, title: string, description: string): Promise<Knowledgebase> {
    const { data, error } = await supabase
      .from('knowledgebases')
      .insert([
        { 
          user_id: userId, 
          title, 
          description 
        }
      ])
      .select();
    
    if (error) {
      console.error('Error creating knowledgebase:', error);
      throw new Error(error.message);
    }
    
    return data[0] as Knowledgebase;
  },
  
  /**
   * Update a knowledgebase
   */
  async updateKnowledgebase(id: string, title: string, description: string): Promise<Knowledgebase> {
    const { data, error } = await supabase
      .from('knowledgebases')
      .update({
        title,
        description,
        updated_at: new Date(),
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Error updating knowledgebase:', error);
      throw new Error(error.message);
    }
    
    return data[0] as Knowledgebase;
  },
  
  /**
   * Delete a knowledgebase
   */
  async deleteKnowledgebase(id: string): Promise<boolean> {
    // First delete all files associated with this knowledgebase
    const { error: filesError } = await supabase
      .from('files')
      .delete()
      .eq('knowledgebase_id', id);
    
    if (filesError) {
      console.error('Error deleting knowledgebase files:', filesError);
      throw new Error(filesError.message);
    }
    
    // Then delete the knowledgebase itself
    const { error } = await supabase
      .from('knowledgebases')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting knowledgebase:', error);
      throw new Error(error.message);
    }
    
    return true;
  },
  
  /**
   * Get all files for a knowledgebase
   */
  async getKnowledgebaseFiles(knowledgebaseId: string): Promise<FileRecord[]> {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('knowledgebase_id', knowledgebaseId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching knowledgebase files:', error);
      throw new Error(error.message);
    }
    
    return data as FileRecord[];
  },
  
  /**
   * Get a file by ID
   */
  async getFileById(id: string): Promise<FileRecord> {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching file:', error);
      throw new Error(error.message);
    }
    
    return data as FileRecord;
  },
  
  /**
   * Upload a file to storage and create a file record
   */
  async uploadFileToStorage(userId: string, knowledgebaseId: string, file: Blob) {
    try {
      // Generate a unique file path
      const fileName = file instanceof File ? file.name : 'blob-file';
      const fileType = file instanceof File ? file.type : 'application/octet-stream';
      const fileSize = file.size;
      const filePath = `${userId}/${knowledgebaseId}/${Date.now()}_${fileName}`;
      
      // Upload file to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('files')
        .upload(filePath, file);
      
      if (storageError) {
        console.error('Error uploading file to storage:', storageError);
        return { error: storageError };
      }
      
      // Create a record in the files table
      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .insert([
          {
            user_id: userId,
            knowledgebase_id: knowledgebaseId,
            name: fileName,
            type: fileType,
            size: fileSize,
            path: filePath,
            content_length: 0, // Will be updated when content is added
            extraction_status: 'pending'
          }
        ])
        .select()
        .single();
      
      if (fileError) {
        console.error('Error creating file record:', fileError);
        return { error: fileError };
      }
      
      return { data: fileData };
    } catch (error) {
      console.error('Error in uploadFileToStorage:', error);
      return { error };
    }
  },
  
  /**
   * Add content to a knowledgebase
   */
  async addContent(
    userId: string,
    knowledgebaseId: string,
    fileId: string | null,
    fileName: string,
    contentLength: number,
    contentText: string,
    metadata: any
  ) {
    try {
      // If we have a fileId, update the file record with the content
      if (fileId) {
        const { error: updateError } = await supabase
          .from('files')
          .update({
            content_text: contentText,
            content_length: contentLength,
            metadata: metadata,
            extraction_status: 'completed',
            updated_at: new Date()
          })
          .eq('id', fileId)
          .eq('user_id', userId);
        
        if (updateError) {
          console.error('Error updating file with content:', updateError);
          return { error: updateError };
        }
        
        return { success: true };
      } 
      // If no fileId, create a new file record (for URLs, YouTube videos, etc.)
      else {
        const { data, error } = await supabase
          .from('files')
          .insert([
            {
              user_id: userId,
              knowledgebase_id: knowledgebaseId,
              name: fileName,
              type: 'url',
              size: 0,
              content_text: contentText,
              content_length: contentLength,
              metadata: metadata,
              extraction_status: 'completed'
            }
          ])
          .select();
        
        if (error) {
          console.error('Error creating content record:', error);
          return { error };
        }
        
        return { data: data[0], success: true };
      }
    } catch (error) {
      console.error('Error in addContent:', error);
      return { error };
    }
  },
  
  // Add extracted text content to a knowledgebase
  async addContentToKnowledgebase(
    userId: string, 
    knowledgebaseId: string, 
    fileName: string,
    fileType: string,
    fileSize: number,
    sourceUrl: string | null,
    extractedText: string,
    metadata: any = {}
  ): Promise<FileRecord> {
    console.log(`Adding content to knowledgebase ${knowledgebaseId}`);
    console.log(`Text content length: ${extractedText.length} characters`);
    
    // Ensure text content is not empty
    if (!extractedText || extractedText.trim() === '') {
      console.error('Error: Extracted text is empty');
      throw new Error('Cannot add empty text content to knowledgebase');
    }
    
    // Create a record in the files table with the extracted text
    const { data, error } = await supabase
      .from('files')
      .insert([
        {
          name: fileName,
          type: fileType,
          size: fileSize,
          source_url: sourceUrl,
          knowledgebase_id: knowledgebaseId,
          user_id: userId,
          content_text: extractedText,
          content_length: extractedText.length,
          extraction_status: 'completed',
          metadata: metadata
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating file record:', error);
      throw error;
    }
    
    console.log('File record created successfully:', data.id);
    return data;
  },
  
  // Add content from YouTube video
  async addYoutubeContent(
    userId: string,
    knowledgebaseId: string,
    videoUrl: string,
    videoTitle: string,
    transcriptText: string,
    videoMetadata: any = {}
  ): Promise<FileRecord> {
    return this.addContentToKnowledgebase(
      userId,
      knowledgebaseId,
      videoTitle,
      'youtube',
      transcriptText.length,
      videoUrl,
      transcriptText,
      {
        ...videoMetadata,
        source_type: 'youtube'
      }
    );
  },
  
  // Add content from PDF
  async addPdfContent(
    userId: string,
    knowledgebaseId: string,
    fileName: string,
    extractedText: string,
    pageCount: number
  ): Promise<FileRecord> {
    return this.addContentToKnowledgebase(
      userId,
      knowledgebaseId,
      fileName,
      'pdf',
      extractedText.length,
      null,
      extractedText,
      {
        page_count: pageCount,
        source_type: 'pdf'
      }
    );
  },
  
  // Add content from audio file
  async addAudioContent(
    userId: string,
    knowledgebaseId: string,
    fileName: string,
    transcriptText: string,
    duration: number
  ): Promise<FileRecord> {
    return this.addContentToKnowledgebase(
      userId,
      knowledgebaseId,
      fileName,
      'audio',
      transcriptText.length,
      null,
      transcriptText,
      {
        duration: duration,
        source_type: 'audio'
      }
    );
  },
  
  // Delete a file
  async deleteFile(id: string): Promise<void> {
    // Delete from database
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting file record:', error);
      throw error;
    }
  },
  
  // Search within knowledge base content
  async searchContent(knowledgebaseId: string, query: string): Promise<FileRecord[]> {
    try {
      // Format the query for PostgreSQL full-text search
      // Convert natural language query to a proper tsquery format
      const formattedQuery = query
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word + ':*')  // Add prefix search
        .join(' & ');  // AND operator
      
      // If the query is empty after formatting, return all files
      if (!formattedQuery) {
        const { data, error } = await supabase
          .from('files')
          .select('*')
          .eq('knowledgebase_id', knowledgebaseId)
          .limit(5);
        
        if (error) throw error;
        return data || [];
      }
      
      // Use the formatted query for text search
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('knowledgebase_id', knowledgebaseId)
        .textSearch('content_text', formattedQuery, {
          type: 'websearch',
          config: 'english'
        });
      
      if (error) {
        // If there's still an error with the formatted query, fall back to a simpler approach
        if (error.message.includes('syntax error in tsquery')) {
          // Fallback: Get all files and filter them client-side
          const { data: allFiles, error: fetchError } = await supabase
            .from('files')
            .select('*')
            .eq('knowledgebase_id', knowledgebaseId);
          
          if (fetchError) throw fetchError;
          
          // Simple client-side search (not as efficient but works as fallback)
          const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
          return (allFiles || []).filter(file => {
            const content = (file.content_text || '').toLowerCase();
            return searchTerms.some(term => content.includes(term));
          });
        }
        
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error searching content:', error);
      throw error;
    }
  },
  
  // Get file count for a knowledgebase
  async getKnowledgebaseFileCount(knowledgebaseId: string): Promise<number> {
    const { count, error } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('knowledgebase_id', knowledgebaseId);
    
    if (error) {
      console.error('Error getting file count:', error);
      throw error;
    }
    
    return count || 0;
  },
  
  // Get file counts for multiple knowledgebases
  async getKnowledgebaseFileCounts(knowledgebaseIds: string[]): Promise<Record<string, number>> {
    if (knowledgebaseIds.length === 0) return {};
    
    const counts: Record<string, number> = {};
    
    // Initialize all counts to 0
    knowledgebaseIds.forEach(id => {
      counts[id] = 0;
    });
    
    // Get all files for the specified knowledgebases
    const { data, error } = await supabase
      .from('files')
      .select('knowledgebase_id')
      .in('knowledgebase_id', knowledgebaseIds);
    
    if (error) {
      console.error('Error getting file counts:', error);
      throw error;
    }
    
    // Count files for each knowledgebase
    if (data) {
      data.forEach(file => {
        if (file.knowledgebase_id in counts) {
          counts[file.knowledgebase_id]++;
        }
      });
    }
    
    return counts;
  },
  
  // Get total file count for a user across all knowledge bases
  async getUserTotalFileCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error getting total file count:', error);
      throw error;
    }
    
    return count || 0;
  },
  
  // Cache for embeddings to avoid redundant API calls
  embeddingCache: new Map<string, number[]>(),
  
  // Optimized semantic search with caching and better chunking
  async semanticSearchContent(knowledgebaseId: string, query: string): Promise<FileRecord[]> {
    try {
      console.time('semanticSearch');
      
      // 1. Get embedding for the query
      const queryKey = `query:${query}`;
      let embedding = this.embeddingCache.get(queryKey);
      
      if (!embedding) {
        embedding = await this.getEmbedding(query);
        if (embedding) {
          this.embeddingCache.set(queryKey, embedding);
        }
      }
      
      if (!embedding) {
        console.timeEnd('semanticSearch');
        // Fall back to regular search if embedding fails
        return this.searchContent(knowledgebaseId, query);
      }
      
      // 2. Get all files from the knowledge base
      const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('knowledgebase_id', knowledgebaseId);
      
      if (error) throw error;
      if (!files || files.length === 0) {
        console.timeEnd('semanticSearch');
        return [];
      }
      
      // 3. Process files in parallel with a limit to avoid overwhelming the API
      const batchSize = 3; // Process 3 files at a time
      const scoredFiles = [];
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(file => this.processFileForSearch(file, embedding!))
        );
        scoredFiles.push(...batchResults);
      }
      
      // 4. Sort by similarity score and return top results
      const sortedFiles = scoredFiles.sort((a, b) => b.score - a.score);
      
      // Get the top 5 results regardless of score
      const topResults = sortedFiles.slice(0, 5).map(item => item.file);
      
      // Filter by threshold only if we have enough results that meet the threshold
      const thresholdResults = sortedFiles
        .filter(item => item.score > 0.4) // Lower threshold to 0.4
        .slice(0, 5)
        .map(item => item.file);
      
      console.timeEnd('semanticSearch');
      
      // Return threshold results if we have any, otherwise return top results
      return thresholdResults.length > 0 ? thresholdResults : topResults;
    } catch (error) {
      console.error('Error in semantic search:', error);
      // Fall back to regular search if semantic search fails
      return this.searchContent(knowledgebaseId, query);
    }
  },
  
  // Process a single file for semantic search
  async processFileForSearch(file: FileRecord, queryEmbedding: number[]): Promise<{file: FileRecord, score: number}> {
    // Skip files with no content
    if (!file.content_text) return { file, score: 0 };
    
    // For longer texts, we'll split into chunks using recursive character splitting
    const chunks = this.recursiveCharacterTextSplitter(file.content_text, 1000, 200);
    
    // Get the best score across all chunks
    let bestScore = 0;
    let processedChunks = 0;
    
    // Only process a limited number of chunks per file to improve performance
    const maxChunksToProcess = 10;
    const chunksToProcess = chunks.slice(0, maxChunksToProcess);
    
    for (const chunk of chunksToProcess) {
      try {
        // Check if we already have this chunk's embedding in cache
        const chunkKey = `chunk:${file.id}:${chunk.substring(0, 50)}`;
        let chunkEmbedding = this.embeddingCache.get(chunkKey);
        
        if (!chunkEmbedding) {
          chunkEmbedding = await this.getEmbedding(chunk);
          if (chunkEmbedding) {
            this.embeddingCache.set(chunkKey, chunkEmbedding);
          }
        }
        
        if (!chunkEmbedding) continue;
        
        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
        bestScore = Math.max(bestScore, similarity);
        
        processedChunks++;
        
        // Early exit if we found a very good match
        if (bestScore > 0.85) break;
      } catch (e) {
        console.error('Error processing chunk for file', file.id, e);
        continue;
      }
    }
    
    console.log(`Processed ${processedChunks} chunks for file ${file.name}, best score: ${bestScore.toFixed(2)}`);
    return { file, score: bestScore };
  },
  
  // Recursive character text splitter with overlap
  recursiveCharacterTextSplitter(text: string, chunkSize: number, overlap: number = 0): string[] {
    if (!text || text.length <= chunkSize) {
      return [text];
    }
    
    const chunks: string[] = [];
    
    // First try to split by paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    
    if (paragraphs.length > 1) {
      let currentChunk = '';
      
      for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length + 2 <= chunkSize) {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
          }
          
          if (paragraph.length > chunkSize) {
            // Recursively split long paragraphs
            const subChunks = this.recursiveCharacterTextSplitter(paragraph, chunkSize, overlap);
            chunks.push(...subChunks);
          } else {
            currentChunk = paragraph;
          }
        }
      }
      
      if (currentChunk) {
        chunks.push(currentChunk);
      }
    } else {
      // If no paragraph breaks, try sentences
      const sentences = text.split(/(?<=[.!?])\s+/);
      
      if (sentences.length > 1) {
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= chunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            
            if (sentence.length > chunkSize) {
              // Split by character if sentence is too long
              for (let i = 0; i < sentence.length; i += chunkSize - overlap) {
                chunks.push(sentence.substring(i, i + chunkSize));
              }
            } else {
              currentChunk = sentence;
            }
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk);
        }
      } else {
        // If no sentence breaks, split by character with overlap
        for (let i = 0; i < text.length; i += chunkSize - overlap) {
          chunks.push(text.substring(i, i + chunkSize));
        }
      }
    }
    
    return chunks;
  },
  
  // Helper method to get embedding from OpenAI
  async getEmbedding(text: string): Promise<number[] | null> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!apiKey) {
        console.error('OpenAI API key is not set');
        return null;
      }
      
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000) // Limit to 8000 chars (API limit)
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Error getting embedding:', error);
      return null;
    }
  },
  
  // Helper method to calculate cosine similarity between two vectors
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },
}; 