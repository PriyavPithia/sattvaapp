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
          text: "# Error Searching Knowledge Base\n\nI encountered an error while searching your knowledge base. The search query format might be invalid. Please try rephrasing your question with simpler terms.",
          references: []
        };
      }
      
      if (!relevantFiles || relevantFiles.length === 0) {
        return {
          text: "# No Relevant Information Found\n\nI couldn't find any relevant information in your knowledge base to answer this question. Please try rephrasing your question or add more content to your knowledge base.",
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
        references
      };
    } catch (error) {
      console.error('Error querying OpenAI:', error);
      
      // Check if it's a rate limit error
      if (error.response && error.response.status === 429) {
        return {
          text: "# Rate Limit Exceeded\n\nI'm sorry, but we've hit the rate limit for AI queries. Please try again in a few moments.",
          references: []
        };
      }
      
      // Check if it's a token limit error
      if (error.response && error.response.data && error.response.data.error && 
          error.response.data.error.message && error.response.data.error.message.includes('token')) {
        return {
          text: "# Content Too Large\n\nI'm sorry, but the knowledge base content is too large to process in a single query. Please try a more specific question or contact support to optimize your knowledge base.",
          references: []
        };
      }
      
      // Generic error
      return {
        text: "# Error Processing Request\n\nI'm sorry, I encountered an error while processing your request. Please try again later.",
        references: []
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
        return "# No Conversation Found\n\nThere isn't enough conversation to generate study notes. Please have a conversation with the AI first.";
      }
      
      // Create a system prompt for generating study notes
      const systemPrompt = `
        You are a university professor who creates well-structured study notes.
        Based on the conversation provided, create comprehensive study notes that:
        
        1. Start with a clear title using # heading format
        2. Include an introduction that summarizes the main topic
        3. Organize information into logical sections with ## subheadings
        4. Use bullet points (-) for key concepts and important points
        5. Use numbered lists (1., 2., etc.) for sequential steps or processes
        6. Highlight important definitions, theories, or formulas using **bold** text
        7. Use > blockquotes for important notes, warnings, or callouts
        8. Use *** for horizontal rules to separate major sections if needed
        9. Include a summary or conclusion section at the end
        10. Add a list of key terms or concepts if appropriate
        
        Format the notes using Markdown for better readability.
        Focus only on factual information from the conversation.
        Be concise but thorough.
        
        If you need to include references, you can use either:
        1. The specific format {{ref:fileId:position}} where fileId is the document ID and position is the character position.
        2. The simple format {{ref}} which will automatically reference documents in order.
        
        EXAMPLE FORMAT:
        
        # [Main Topic] Study Notes
        
        ## Introduction
        [Brief overview of the topic]
        
        ## [First Major Section]
        [Content explaining this section]
        
        ### [Subsection if needed]
        - Key point 1
        - Key point 2
        
        ## [Second Major Section]
        1. Step one of the process
        2. Step two of the process
        
        > **Important Note**: [Critical information to remember]
        
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