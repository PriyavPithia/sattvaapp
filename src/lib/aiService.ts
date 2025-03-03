import axios from 'axios';
import { knowledgebaseService } from './knowledgebaseService';

interface Reference {
  fileId: string;
  text: string;
  position?: number;
}

interface AIResponse {
  text: string;
  references: Reference[];
  isGenericResponse: boolean;
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
          text: "I encountered an error while searching your knowledge base. This might be due to:\n\n- A temporary service issue\n- Complex search terms\n- Technical limitations\n\nPlease try again with a simpler question or try again later.",
          references: [],
          isGenericResponse: true
        };
      }
      
      if (!relevantFiles || relevantFiles.length === 0) {
        return {
          text: "I don't have specific information about that in your knowledge base. Here's what I can suggest:\n\n- Try rephrasing your question with different keywords\n- Add more content to your knowledge base related to this topic\n- Check if your question is relevant to the content in this knowledge base",
          references: [],
          isGenericResponse: true
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
        
        RESPONSE FORMAT (REQUIRED - YOU MUST FOLLOW THIS FORMAT):
        - ALWAYS start with a clear # heading that summarizes the question or main topic
        - Provide a direct, concise answer in the first paragraph
        - Use markdown formatting consistently throughout your response
        - ALWAYS break complex answers into logical sections with ## subheadings
        - Use bullet points (-) for lists when appropriate
        - Highlight important terms with **bold**
        - Use numbered lists (1., 2., etc.) for sequential steps or processes
        - Use > blockquotes for important notes, warnings, or callouts
        - Use *** for horizontal rules to separate major sections if needed
        - Include a brief summary or conclusion section at the end if appropriate
        - Add a list of key terms or concepts if relevant to the question

        WRITING STYLE (REQUIRED):
        - Be clear and direct
        - Use natural, conversational language
        - Avoid academic or overly formal tone
        - Explain concepts simply
        - Give practical examples when relevant

        CITATION RULES (MANDATORY):
        - Every statement must have a reference
        - Place references immediately after each statement
        - You can use two reference formats:
          1. Specific reference: {{ref:fileId:position}} where fileId is the ID of the file and position is the character position
          2. Simple reference: {{ref}} which will automatically reference the next document in order
        - For YouTube videos or audio files, use the timestamp in seconds as the position
        - Never group references
        - Never leave statements unreferenced
        
        EXAMPLE OF PROPERLY FORMATTED RESPONSE WITH REFERENCES:
        
        # How to Screen Record on a Laptop
        
        Screen recording on a laptop involves using built-in tools to capture video of your screen activities. {{ref:fileId:120}} This feature is available on most modern operating systems including Windows, macOS, and Linux. {{ref}}
        
        ## Required Tools
        
        Before you begin, ensure you have the following: {{ref}}
        
        - A laptop with updated operating system {{ref}}
        - Sufficient storage space (at least 1GB free) {{ref}}
        - Optional: external microphone for better audio quality {{ref}}
        
        ## Steps to Record Your Screen
        
        Follow these steps in sequence to create a screen recording: {{ref}}
        
        1. Press **Windows key + Shift + R** to open the screen recording tool. {{ref}}
        2. Select the area of the screen you want to record. {{ref}}
        3. Choose audio settings if you want to include sound. {{ref}}
        4. Click the **Start** button to begin recording after a 3-second countdown. {{ref:fileId:210}}
        5. When finished, click the **Stop** button to end the recording. {{ref}}
        
        > **Note**: For longer recordings, ensure your laptop is connected to a power source to prevent battery drain. {{ref}}
        
        ## Editing Your Recording
        
        The recorded video can be edited using **Clipchamp**, which allows you to trim unwanted sections. {{ref}} You can save the final video as an MP4 file for sharing or future reference. {{ref:fileId:350}}
        
        ## Troubleshooting Common Issues
        
        If you encounter problems with your screen recording: {{ref}}
        
        - **Laggy playback**: Reduce the recording resolution or close background applications {{ref}}
        - **No audio**: Check that the correct microphone is selected in the settings {{ref}}
        - **Large file size**: Use video compression software after recording {{ref}}
        
        ## Summary
        
        Screen recording is a straightforward process that requires minimal setup on most laptops. {{ref}} By following the steps outlined above, you can create high-quality screen recordings for tutorials, presentations, or troubleshooting. {{ref}}
      `;
      
      // 4. Call the OpenAI API
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key is not set in environment variables');
      }
      
      // Limit context size to prevent exceeding token limits
      const limitedContext = context.map(ctx => {
        // Limit each document to a maximum of 4000 characters
        const maxContentLength = 4000;
        const content = ctx.content.length > maxContentLength 
          ? ctx.content.substring(0, maxContentLength) + "... (content truncated)"
          : ctx.content;
          
        return {
          ...ctx,
          content
        };
      });
      
      // Limit the number of documents to prevent exceeding token limits
      const maxDocuments = 5;
      const truncatedContext = limitedContext.slice(0, maxDocuments);
      
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
                ${truncatedContext.map((ctx, index) => `
                  --- Document ${index + 1} (ID: ${ctx.fileId}, Type: ${ctx.fileType}) ---
                  ${ctx.content}
                `).join('\n\n')}
                
                Question: ${query}
                
                IMPORTANT: 
                1. Make sure to include references for EVERY statement using either:
                   - The specific format {{ref:fileId:position}} where fileId is the document ID and position is the character position or timestamp.
                   - The simple format {{ref}} which will automatically reference the next document in order.
                2. ALWAYS follow the required response format with proper headings, subheadings, and formatting.
                3. Start with a clear # heading and organize your answer with ## subheadings.
                4. Use bullet points, numbered lists, bold text, and other markdown formatting as appropriate.
              `
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
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
      
      // Clean up any potential code block formatting issues
      let cleanedResponseText = aiResponseText;
      
      // If the response starts with a code block marker without a language specifier,
      // remove the code block markers to prevent rendering issues
      if (cleanedResponseText.startsWith('```') && 
          !cleanedResponseText.startsWith('```json') && 
          !cleanedResponseText.startsWith('```html') && 
          !cleanedResponseText.startsWith('```css') && 
          !cleanedResponseText.startsWith('```js') && 
          !cleanedResponseText.startsWith('```typescript') && 
          !cleanedResponseText.startsWith('```jsx') && 
          !cleanedResponseText.startsWith('```tsx')) {
        cleanedResponseText = cleanedResponseText.replace(/^```.*?\n/, '').replace(/```$/, '');
      }
      
      // 6. Extract references from the response
      const references: Reference[] = [];
      // Update regex to handle both formats: {{ref:fileId:position}} and {{ref}}
      const referenceRegex = /\{\{ref(:[a-zA-Z0-9-]+:(\d+))?\}\}/g;
      let match;
      let referenceIds = new Set<string>();
      let autoRefIndex = 0;
      
      while ((match = referenceRegex.exec(cleanedResponseText)) !== null) {
        // Check if this is the new format ({{ref}}) or the old format ({{ref:fileId:position}})
        if (!match[1]) {
          // New format: {{ref}} - assign references sequentially from context
          if (autoRefIndex < context.length) {
            const file = context[autoRefIndex];
            const fileId = file.fileId;
            // For auto-references, use position 0 as default
            const position = 0;
            
            // Create a unique ID for this reference
            const refId = `${fileId}:${position}:auto${autoRefIndex}`;
            
            // Skip if we've already processed this reference
            if (referenceIds.has(refId)) continue;
            referenceIds.add(refId);
            
            // Extract a snippet from the beginning of the content
            const snippet = file.content.substring(0, Math.min(file.content.length, 200));
            
            // Check if this is a YouTube or audio file
            const isMediaFile = ['youtube', 'audio', 'video'].includes(file.fileType);
            
            references.push({
              fileId,
              text: snippet,
              position: isMediaFile ? position : undefined
            });
            
            autoRefIndex++;
          }
        } else {
          // Old format: {{ref:fileId:position}}
          const fileId = match[1].split(':')[1];
          const position = parseInt(match[2]);
          
          // Find the file in the context
          const file = context.find(ctx => ctx.fileId === fileId);
          
          if (file) {
            // Create a unique ID for this reference to avoid duplicates
            const refId = `${fileId}:${position}`;
            
            // Skip if we've already processed this reference
            if (referenceIds.has(refId)) continue;
            referenceIds.add(refId);
            
            // Extract a snippet of text around the position
            const start = Math.max(0, position - 100);
            const end = Math.min(file.content.length, position + 100);
            const snippet = file.content.substring(start, end);
            
            // Check if this is a YouTube or audio file to handle position as timestamp
            const isMediaFile = ['youtube', 'audio', 'video'].includes(file.fileType);
            
            references.push({
              fileId,
              text: snippet,
              position: isMediaFile ? position : undefined
            });
          }
        }
      }
      
      // Add all references to the result
      autoRefIndex = 0;
      
      // Return the original text with the reference markers intact
      return {
        text: cleanedResponseText,
        references,
        isGenericResponse: false
      };
    } catch (error) {
      console.error('Error querying OpenAI:', error);
      
      // Check for specific error types
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.error?.message || 'Unknown error';
        
        console.error(`OpenAI API error (${statusCode}): ${errorMessage}`);
        
        if (statusCode === 401) {
          return {
            text: "I'm sorry, but there's an authentication issue with our AI service. Please contact support with error code: AUTH-401.",
            references: [],
            isGenericResponse: true
          };
        } else if (statusCode === 429) {
          return {
            text: "I'm sorry, but we've hit the rate limit for AI queries. Please try again in a few moments.",
            references: [],
            isGenericResponse: true
          };
        } else if (statusCode === 400) {
          // Handle specific 400 error cases
          if (errorMessage.includes('maximum context length')) {
            return {
              text: "I'm sorry, but the knowledge base content is too large to process in a single query. Please try a more specific question or contact support to optimize your knowledge base.",
              references: [],
              isGenericResponse: true
            };
          } else {
            return {
              text: `I'm sorry, but there was an issue with processing your request. Please try again with a simpler question. (Error: ${errorMessage})`,
              references: [],
              isGenericResponse: true
            };
          }
        }
      }
      
      // Handle non-Axios errors or other error types
      if (error.message.includes('content too large') || error.message.includes('maximum context length')) {
        return {
          text: "I'm sorry, but the knowledge base content is too large to process in a single query. Please try a more specific question or contact support to optimize your knowledge base.",
          references: [],
          isGenericResponse: true
        };
      }
      
      // Generic error
      return {
        text: "I'm sorry, I encountered an error while processing your request. Please try again later.",
        references: [],
        isGenericResponse: true
      };
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
      
      // Limit the conversation to prevent exceeding token limits
      const maxMessages = 20;
      const truncatedConversation = conversation.length > maxMessages 
        ? [...conversation.slice(0, 5), ...conversation.slice(-15)] // Keep first 5 and last 15 messages
        : conversation;
      
      const systemPrompt = `
        You are a university-level professor assistant that helps create study notes from conversations.
        Your task is to analyze the conversation and extract the key concepts, definitions, and insights.
        Organize this information into well-structured study notes.
        
        RESPONSE FORMAT:
        - Start with a clear # title that summarizes the main topic
        - Use ## subheadings to organize different sections
        - Use bullet points for lists of related items
        - Use numbered lists for sequential steps or processes
        - Highlight important terms with **bold**
        - Include examples where relevant
        - End with a brief summary
        
        ## Summary
        [Brief recap of the most important points]
        
        ## Key Terms
        - **Term 1**: Definition
        - **Term 2**: Definition
      `;
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...truncatedConversation,
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
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.error?.message || 'Unknown error';
        
        console.error(`OpenAI API error (${statusCode}): ${errorMessage}`);
        
        if (statusCode === 401) {
          throw new Error('Invalid OpenAI API key. Please check your API key in the settings.');
        } else if (statusCode === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (statusCode === 400) {
          if (errorMessage.includes('maximum context length')) {
            throw new Error('The conversation is too long to process. Please try with a shorter conversation.');
          } else {
            throw new Error(`OpenAI API error: ${errorMessage}`);
          }
        } else {
          throw new Error(`OpenAI API error: ${errorMessage}`);
        }
      }
      
      throw new Error('Failed to generate study notes. Please try again later.');
    }
  }
}; 