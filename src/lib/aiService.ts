import axios from 'axios';
import { knowledgebaseService } from './knowledgebaseService';
import { v4 as uuidv4 } from 'uuid';

interface Reference {
  fileId: string;
  text: string;
  position?: number;
  type?: string;
  sourceId?: string;
}

interface AIResponse {
  text: string;
  references: Reference[];
}

export const aiService = {
  /**
   * Query the OpenAI API with the user's question and knowledge base context
   * @param knowledgebaseId The ID of the knowledge base to query
   * @param query The user's question
   * @returns The AI response with references
   */
  async queryKnowledgebase(knowledgebaseId: string, query: string): Promise<AIResponse> {
    try {
      // 1. Search the knowledge base for relevant content
      let relevantFiles;
      try {
        relevantFiles = await knowledgebaseService.semanticSearchContent(knowledgebaseId, query);
      } catch (searchError) {
        console.error('Error searching knowledge base:', searchError);
        return {
          text: "I encountered an error while searching your knowledge base. The search query format might be invalid. Please try rephrasing your question with simpler terms.",
          references: []
        };
      }
      
      if (!relevantFiles || relevantFiles.length === 0) {
        return {
          text: "I couldn't find any relevant information in your knowledge base to answer this question. Please try rephrasing your question or add more content to your knowledge base.",
          references: []
        };
      }
      
      // 2. Prepare context from the relevant files
      const context = relevantFiles.map(file => {
        return {
          content: file.content_text || "",
          fileId: file.id,
          fileName: file.name,
          fileType: file.type.toLowerCase()
        };
      });
      
      // 3. Prepare the prompt for OpenAI
      const systemPrompt = `
        You are a university-level professor assistant that helps answer questions based on the provided knowledge base.
        You will be given context from a knowledge base and a question.
        Your task is to answer the question based ONLY on the provided context.
        
        If the context doesn't contain enough information to fully answer the question, still try to provide a partial answer based on what is available, and explain what additional information would be needed.
        
        If the context is completely unrelated to the question, say "I don't have specific information about that in your knowledge base. Here's what I found instead:" and then summarize the context you were given.
        
        RESPONSE FORMAT (REQUIRED):
        - Start with a clear # heading that states the main topic
        - Provide a direct, concise answer in the first paragraph
        - Use markdown formatting consistently
        - Break complex answers into logical sections with ## subheadings
        - Use bullet points (-) for lists when needed
        - Highlight important terms with **bold**

        WRITING STYLE (REQUIRED):
        - Be clear and direct
        - Use natural, conversational language
        - Avoid academic or overly formal tone
        - Explain concepts simply
        - Give practical examples when relevant

        CITATION RULES (MANDATORY - YOU MUST FOLLOW THESE EXACTLY):
        - Every statement must have a reference
        - Place references immediately after each statement
        - NEW FORMAT: {{ref:type:sourceId:position}} where:
          - type: The type of source (youtube, pdf, document, etc.)
          - sourceId: The ID of the source file
          - position: The position in the source (timestamp for videos, page number for documents)
        - Example: statement {{ref:youtube:abc123:120}} next statement {{ref:pdf:def456:5}}
        - LEGACY FORMAT (also supported): {{fileId:position}}
        - The sourceId MUST be one of the actual document IDs provided in the context
        - DO NOT use UUIDs like "011ebcba-34bf-415f-be8f-740ee79b5cc0" as sourceIds
        - DO NOT make up sourceIds or use UUIDs that weren't provided
        - For YouTube videos or audio files, use the timestamp in seconds as the position
        - Never group references
        - Never leave statements unreferenced
        - IMPORTANT: You MUST include at least one reference in your response
        - IMPORTANT: References must be in the exact format shown above - do not modify this format
        
        EXAMPLE OF PROPERLY FORMATTED RESPONSE WITH REFERENCES:
        
        # How to Screen Record on a Laptop
        
        Screen recording on a laptop involves using built-in tools to capture video of your screen activities. {{ref:youtube:abc123:120}}
        
        ## Steps to Record Your Screen
        
        - Press **Windows key + Shift + R** to open the screen recording tool. {{ref:youtube:abc123:150}}
        - Select the area of the screen you want to record. {{ref:youtube:abc123:180}}
        - Click the **Start** button to begin recording after a 3-second countdown. {{ref:youtube:abc123:210}}
        - When finished, click the **Stop** button to end the recording. {{ref:youtube:abc123:250}}
        
        ## Editing Your Recording
        
        The recorded video can be edited using **Clipchamp**, which allows you to trim unwanted sections. {{ref:pdf:def456:3}} You can save the final video as an MP4 file for sharing or future reference. {{ref:pdf:def456:5}}
        
        REMEMBER: EVERY statement must have a reference in the format {{ref:type:sourceId:position}} or {{fileId:position}} where sourceId/fileId is one of the document IDs provided in the context. This is critical for the application to function correctly.
        DO NOT use UUIDs like "011ebcba-34bf-415f-be8f-740ee79b5cc0" as sourceIds.
      `;
      
      // 4. Call the OpenAI API
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key is not set in environment variables');
      }
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: `
                Context:
                ${context.map((ctx, index) => `
                  --- Document ${index + 1} (ID: ${ctx.fileId}, Type: ${ctx.fileType}) ---
                  ${ctx.content}
                `).join('\n\n')}
                
                Question: ${query}
                
                IMPORTANT: Remember to include references for every statement in the format {{ref:type:sourceId:position}} or {{fileId:position}}.
                IMPORTANT: Use ONLY the document IDs provided above in your references.
                Available document IDs: ${context.map(ctx => ctx.fileId).join(', ')}
              `
            }
          ],
          temperature: 0.8,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // 5. Extract the AI response
      const aiResponseText = response.data.choices[0].message.content;
      
      // Debug log to see the raw response
      console.log('Raw AI response:', aiResponseText);
      
      // Check for UUID-like references and replace them with actual file references
      const uuidRegex = /{{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})}}/gi;
      const specificUuidRegex = /{{011ebcba-34bf-415f-be8f-740ee79b5cc0}}/g;
      const newFormatUuidRegex = /{{ref:[a-zA-Z0-9-]+:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):\d+}}/gi;
      
      let processedResponse = aiResponseText;
      
      // If we find UUID references, replace them with actual file references
      if (uuidRegex.test(aiResponseText) || 
          specificUuidRegex.test(aiResponseText) || 
          newFormatUuidRegex.test(aiResponseText)) {
        console.warn('Found UUID references in AI response. Replacing with actual file references.');
        
        // Reset the regex lastIndex to start from the beginning again
        uuidRegex.lastIndex = 0;
        newFormatUuidRegex.lastIndex = 0;
        
        // Replace all UUID references with references to the first file in the context
        if (context.length > 0) {
          const firstFile = context[0];
          const fileType = firstFile.fileType.toLowerCase();
          
          // Replace legacy format UUIDs
          processedResponse = processedResponse.replace(uuidRegex, `{{${firstFile.fileId}:0}}`);
          processedResponse = processedResponse.replace(specificUuidRegex, `{{${firstFile.fileId}:0}}`);
          
          // Replace new format UUIDs
          processedResponse = processedResponse.replace(
            newFormatUuidRegex, 
            (match, uuid) => `{{ref:${fileType}:${firstFile.fileId}:0}}`
          );
          
          console.log('Replaced UUID references with file ID:', firstFile.fileId);
        }
      }
      
      // 6. Extract references from the response
      const references: Reference[] = [];
      
      // Regular expression to match references in the format {{ref:type:sourceId:position}}
      const newReferenceRegex = /{{ref:([a-zA-Z0-9-]+):([a-zA-Z0-9-_]+):(\d+)}}/g;
      
      // Also support the legacy format {{fileId:position}}
      const legacyReferenceRegex = /{{([a-zA-Z0-9-]+):(\d+)}}/g;
      
      // Regular expression to match UUIDs (which should not be used as fileIds)
      const uuidRegexForReferences = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      
      // Create a copy of the response text for reference extraction
      let responseTextForReferences = processedResponse;
      let match;
      
      // Check if the response contains any references in the correct format
      const hasProperReferences = newReferenceRegex.test(responseTextForReferences) || 
                                 legacyReferenceRegex.test(responseTextForReferences);
      
      // Reset the regex lastIndex to start from the beginning again
      newReferenceRegex.lastIndex = 0;
      legacyReferenceRegex.lastIndex = 0;
      
      // Extract references using the new format
      while ((match = newReferenceRegex.exec(responseTextForReferences)) !== null) {
        const type = match[1];
        const sourceId = match[2];
        const position = parseInt(match[3]);
        
        // Skip references with UUID-like sourceIds (which are likely incorrect)
        if (uuidRegexForReferences.test(sourceId)) {
          console.warn(`Skipping reference with UUID-like sourceId: ${sourceId}`);
          continue;
        }
        
        // Find the file in the context based on type and sourceId
        const file = context.find(ctx => {
          if (type === 'youtube' && ctx.fileType === 'youtube') {
            // For YouTube, match by video ID if available
            return ctx.sourceId === sourceId || ctx.fileId === sourceId;
          }
          return ctx.fileId === sourceId;
        });
        
        if (file) {
          try {
            // Extract a snippet of text around the position
            const start = Math.max(0, position - 100);
            const end = Math.min(file.content.length, position + 100);
            const snippet = file.content.substring(start, end);
            
            // Check if this is a YouTube or audio file to handle position as timestamp
            const isMediaFile = ['youtube', 'audio', 'video'].includes(file.fileType);
            
            references.push({
              fileId: file.fileId,
              text: snippet,
              position: isMediaFile ? position : undefined,
              type: type,
              sourceId: sourceId
            });
          } catch (error) {
            console.error('Error extracting snippet from file:', error);
            // Add a reference with just the file ID if we can't extract a snippet
            references.push({
              fileId: file.fileId,
              text: "Referenced content",
              position: ['youtube', 'audio', 'video'].includes(file.fileType) ? position : undefined,
              type: type,
              sourceId: sourceId
            });
          }
        } else {
          console.warn(`Reference to unknown sourceId: ${sourceId}`);
        }
      }
      
      // Also extract references using the legacy format
      while ((match = legacyReferenceRegex.exec(responseTextForReferences)) !== null) {
        const fileId = match[1];
        const position = parseInt(match[2]);
        
        // Skip references with UUID-like fileIds (which are likely incorrect)
        if (uuidRegexForReferences.test(fileId)) {
          console.warn(`Skipping reference with UUID-like fileId: ${fileId}`);
          continue;
        }
        
        // Find the file in the context
        const file = context.find(ctx => ctx.fileId === fileId);
        
        if (file) {
          try {
            // Extract a snippet of text around the position
            const start = Math.max(0, position - 100);
            const end = Math.min(file.content.length, position + 100);
            const snippet = file.content.substring(start, end);
            
            // Check if this is a YouTube or audio file to handle position as timestamp
            const isMediaFile = ['youtube', 'audio', 'video'].includes(file.fileType);
            
            // Determine the type based on file type
            const type = file.fileType.toLowerCase();
            
            references.push({
              fileId,
              text: snippet,
              position: isMediaFile ? position : undefined,
              type: type
            });
          } catch (error) {
            console.error('Error extracting snippet from file:', error);
            // Add a reference with just the file ID if we can't extract a snippet
            references.push({
              fileId,
              text: "Referenced content",
              position: ['youtube', 'audio', 'video'].includes(file.fileType) ? position : undefined,
              type: file.fileType.toLowerCase()
            });
          }
        } else {
          console.warn(`Reference to unknown fileId: ${fileId}`);
        }
      }
      
      // If no references were found but we have context, create at least one reference
      if (references.length === 0 && context.length > 0) {
        console.warn('No valid references found in AI response. Adding default references from context.');
        
        // Add a reference from each context file to ensure coverage
        for (const contextFile of context) {
          try {
            const snippet = contextFile.content.substring(0, Math.min(200, contextFile.content.length));
            const isMediaFile = ['youtube', 'audio', 'video'].includes(contextFile.fileType);
            
            references.push({
              fileId: contextFile.fileId,
              text: snippet,
              position: isMediaFile ? 0 : undefined,
              type: contextFile.fileType.toLowerCase()
            });
            
            console.log(`Added default reference for file: ${contextFile.fileId}`);
          } catch (error) {
            console.error(`Error creating default reference for file ${contextFile.fileId}:`, error);
            // Add a basic reference if we can't extract a snippet
            references.push({
              fileId: contextFile.fileId,
              text: "Referenced content",
              position: ['youtube', 'audio', 'video'].includes(contextFile.fileType) ? 0 : undefined,
              type: contextFile.fileType.toLowerCase()
            });
          }
        }
      }
      
      // 7. Clean up the response text by removing the reference markers
      const cleanedText = processedResponse
        .replace(/{{ref:[a-zA-Z0-9-]+:[a-zA-Z0-9-_]+:\d+}}/g, '')
        .replace(/{{[a-zA-Z0-9-]+:\d+}}/g, '');
      
      return {
        text: cleanedText,
        references
      };
    } catch (error) {
      console.error('Error querying OpenAI:', error);
      
      // Provide a more user-friendly error message
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your API key in the settings.');
        } else if (error.response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`OpenAI API error: ${error.response.data.error?.message || 'Unknown error'}`);
        }
      }
      
      throw new Error(`Failed to query AI: ${error.message || 'Unknown error'}`);
    }
  },
  
  /**
   * Generate study notes from chat history
   * @param messages Array of chat messages
   * @returns Formatted study notes
   */
  async generateStudyNotes(messages: { content: string; isUser: boolean }[]): Promise<string> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key is not set in environment variables');
      }
      
      // Filter out system messages and format the conversation
      const conversation = messages
        .filter(msg => msg.content.trim().length > 0)
        .map(msg => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.content
        }));
      
      if (conversation.length === 0) {
        return "There isn't enough conversation to generate study notes. Please have a conversation with the AI first.";
      }
      
      // Create a system prompt for generating study notes
      const systemPrompt = `
        You are a university professor who creates well-structured study notes.
        Based on the conversation provided, create comprehensive study notes that:
        
        1. Start with a clear title and introduction
        2. Organize information into logical sections with headings
        3. Include bullet points for key concepts
        4. Highlight important definitions, theories, or formulas
        5. Summarize main takeaways at the end
        
        Format the notes using Markdown for better readability.
        Focus only on factual information from the conversation.
        Be concise but thorough.
      `;
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversation,
            { 
              role: 'user', 
              content: 'Please generate well-structured study notes based on our conversation above.'
            }
          ],
          temperature: 0.5,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error generating study notes:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your API key in the settings.');
        } else if (error.response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`OpenAI API error: ${error.response.data.error?.message || 'Unknown error'}`);
        }
      }
      
      throw new Error(`Failed to generate study notes: ${error.message || 'Unknown error'}`);
    }
  }
};

/**
 * Parse references from text using the new reference format
 * @param text Text containing references
 * @param context Context information about available files
 * @returns Array of parsed references
 */
export function parseReferences(text: string, context: any[]): Reference[] {
  const references: Reference[] = [];
  
  // Regular expression to match references in the format {{ref:type:sourceId:position}}
  // This supports both the new format and the legacy format
  const newReferenceRegex = /{{ref:([a-zA-Z0-9-]+):([a-zA-Z0-9-_]+):(\d+)}}/g;
  const legacyReferenceRegex = /{{([a-zA-Z0-9-]+):(\d+)}}/g;
  
  // Extract references using the new format
  let match;
  while ((match = newReferenceRegex.exec(text)) !== null) {
    const type = match[1];
    const sourceId = match[2];
    const position = parseInt(match[3]);
    
    // Find the file in the context based on type and sourceId
    const file = context.find(ctx => {
      if (type === 'youtube' && ctx.fileType === 'youtube') {
        // For YouTube, match by video ID if available
        return ctx.sourceId === sourceId || ctx.fileId === sourceId;
      }
      return ctx.fileId === sourceId;
    });
    
    if (file) {
      try {
        // Extract a snippet of text around the position
        const start = Math.max(0, position - 100);
        const end = Math.min(file.content.length, position + 100);
        const snippet = file.content.substring(start, end);
        
        references.push({
          fileId: file.fileId,
          text: snippet,
          position: ['youtube', 'audio', 'video'].includes(file.fileType) ? position : undefined,
          type: type,
          sourceId: sourceId
        });
      } catch (error) {
        console.error('Error extracting snippet from file:', error);
        // Add a reference with just the file ID if we can't extract a snippet
        references.push({
          fileId: file.fileId,
          text: "Referenced content",
          position: ['youtube', 'audio', 'video'].includes(file.fileType) ? position : undefined,
          type: type,
          sourceId: sourceId
        });
      }
    }
  }
  
  // Also extract references using the legacy format for backward compatibility
  while ((match = legacyReferenceRegex.exec(text)) !== null) {
    const fileId = match[1];
    const position = parseInt(match[2]);
    
    // Find the file in the context
    const file = context.find(ctx => ctx.fileId === fileId);
    
    if (file) {
      try {
        // Extract a snippet of text around the position
        const start = Math.max(0, position - 100);
        const end = Math.min(file.content.length, position + 100);
        const snippet = file.content.substring(start, end);
        
        // Determine the type based on file type
        const type = file.fileType.toLowerCase();
        
        references.push({
          fileId,
          text: snippet,
          position: ['youtube', 'audio', 'video'].includes(type) ? position : undefined,
          type: type
        });
      } catch (error) {
        console.error('Error extracting snippet from file:', error);
        // Add a reference with just the file ID if we can't extract a snippet
        references.push({
          fileId,
          text: "Referenced content",
          position: ['youtube', 'audio', 'video'].includes(file.fileType) ? position : undefined,
          type: file.fileType.toLowerCase()
        });
      }
    }
  }
  
  return references;
} 