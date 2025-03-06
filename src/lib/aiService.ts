import axios from 'axios';
import { knowledgebaseService } from './knowledgebaseService';
import { formatTime } from './youtubeService';

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
      const context = relevantFiles.map((file, index) => {
        // Store the exact chunk that was found during semantic search
        const exactChunk = file.content_text || "";
        
        // Store the chunk metadata if available
        const chunkMetadata = file.metadata || {};
        
        // For media files, try to extract timestamp information
        let processedContent = exactChunk;
        let timestampData = [];
        
        if (['youtube', 'audio', 'video', 'mp3', 'mpeg'].includes(file.type?.toLowerCase()) || 
            (file.name && (
              file.name.toLowerCase().endsWith('.mp3') ||
              file.name.toLowerCase().endsWith('.wav') ||
              file.name.toLowerCase().endsWith('.ogg') ||
              file.name.toLowerCase().endsWith('.m4a')
            ))) {
          try {
            // If the content is JSON (like YouTube transcripts), preserve the timestamp information
            const contentData = JSON.parse(file.content_text);
            if (Array.isArray(contentData) && contentData.length > 0 && contentData[0].start !== undefined) {
              // Store timestamp data for reference
              timestampData = contentData.map(segment => ({
                timestamp: segment.start,
                text: segment.text,
                formattedTime: formatTime(segment.start)
              }));
              
              // Format the content to include timestamps explicitly in the text
              processedContent = contentData.map(segment => 
                `[TIMESTAMP:${segment.start}] ${segment.text}`
              ).join('\n');
              
              console.log(`Extracted ${timestampData.length} timestamps from ${file.type} file`);
            }
          } catch (e) {
            // If parsing fails, use the original content
            console.log(`Could not parse content for ${file.type} file, using original content`);
          }
        }
        
        return {
          content: processedContent,
          fileId: file.id,
          fileName: file.name,
          fileType: file.type.toLowerCase(),
          chunkMetadata,
          docIndex: index + 1, // Add document index for citation
          timestampData // Include timestamp data
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
        
        CITATION FORMAT (CRITICAL - YOU MUST FOLLOW EXACTLY):
        - For EVERY statement based on the context, include a citation in the format ((DOC_INDEX:TIMESTAMP)) immediately after the statement
        - DOC_INDEX is the document number (1, 2, 3, etc.) as listed in the context
        - For media files (YouTube, audio, video), TIMESTAMP is REQUIRED and should be the exact timestamp in seconds from the context
        - For YouTube videos, use the exact timestamp from the JSON timestamp data provided in the context
        - For non-media files, omit the timestamp part and just use ((DOC_INDEX))
        - Place citations immediately after the relevant statement, not at the end of paragraphs
        - Make sure EVERY factual statement has a citation
        - Do NOT include any other citation format

        EXAMPLES OF PROPER CITATIONS:
        - "The mitochondria is the powerhouse of the cell ((1))."
        - "At 2:45 in the lecture, the professor explains quantum entanglement ((3:165))."
        - "According to the research paper, climate change has accelerated ((2))."
        
        IMPORTANT: For YouTube videos, you MUST include the timestamp in seconds in your citations. For example, if you're referencing content at 2 minutes and 30 seconds (150 seconds), use ((DOC_INDEX:150)). The exact timestamps are provided in the TIMESTAMP DATA section for each document.
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
                ${truncatedContext.map((ctx) => `
                  --- Document ${ctx.docIndex} (ID: ${ctx.fileId}, Type: ${ctx.fileType}, Name: ${ctx.fileName}) ---
                  ${ctx.content}
                  
                  ${ctx.timestampData && ctx.timestampData.length > 0 ? 
                    `TIMESTAMP DATA FOR DOCUMENT ${ctx.docIndex} (IMPORTANT - USE THESE EXACT TIMESTAMPS):
                    ${JSON.stringify(ctx.timestampData.slice(0, 10).map(td => ({
                      timestamp: td.timestamp,
                      text: td.text.substring(0, 50) + (td.text.length > 50 ? '...' : ''),
                      formattedTime: td.formattedTime
                    })), null, 2)}
                    ... (${ctx.timestampData.length} total timestamps)` 
                    : ''}
                `).join('\n\n')}
                
                Document to File Mapping:
                ${truncatedContext.map(ctx => `Document ${ctx.docIndex} = ${ctx.fileName} (${ctx.fileId})`).join('\n')}
                
                Question: ${query}
                
                IMPORTANT REMINDER: 
                1. Use the citation format ((DOC_INDEX:TIMESTAMP)) for every statement
                2. DOC_INDEX is the document number (1, 2, 3, etc.)
                3. For YouTube videos and other media, you MUST include the TIMESTAMP in seconds
                4. Use the exact timestamps from the TIMESTAMP DATA provided for each document
                5. Place citations immediately after each statement
                6. Make sure EVERY factual statement has a citation
                7. Format your response with proper markdown headings, lists, and formatting
              `
            }
          ],
          temperature: 0.5, // Lower temperature for more consistent responses
          max_tokens: 800, // Reduced max tokens for faster responses
          presence_penalty: 0.1, // Slight penalty to avoid repetition
          frequency_penalty: 0.1 // Slight penalty to avoid repetition
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
      
      console.log('AI response text sample:', aiResponseText.substring(0, 200) + (aiResponseText.length > 200 ? '...' : ''));
      
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
      let referenceIds = new Set<string>();
      
      // Look for a Sources section at the end of the response
      const sourcesMatch = cleanedResponseText.match(/## Sources|# Sources|Sources:/i);
      
      if (sourcesMatch) {
        const sourcesSection = cleanedResponseText.substring(sourcesMatch.index!);
        const bulletPointRegex = /[-*]\s+([^:\n]+)(?::|$)/g;
        let bulletMatch;
        
        while ((bulletMatch = bulletPointRegex.exec(sourcesSection)) !== null) {
          const filename = bulletMatch[1].trim();
          
          // Find the file by name
          const file = truncatedContext.find(ctx => 
            ctx.fileName.toLowerCase() === filename.toLowerCase()
          );
          
          // If not found by exact name, try partial match
          const fileByPartialName = !file ? truncatedContext.find(ctx => 
            ctx.fileName.toLowerCase().includes(filename.toLowerCase()) || 
            filename.toLowerCase().includes(ctx.fileName.toLowerCase())
          ) : null;
          
          if (file || fileByPartialName) {
            const actualFile = file || fileByPartialName!;
            const fileId = actualFile.fileId;
            
            // Skip if we've already processed this reference
            if (referenceIds.has(fileId)) continue;
            referenceIds.add(fileId);
            
            // Extract a snippet from the content
            const referenceCount = Array.from(references).filter(ref => ref.fileId === fileId).length;
            const contentLength = actualFile.content.length;
            
            let start = 0;
            let end = Math.min(contentLength, 200);
            
            if (referenceCount > 0) {
              // For subsequent references, use different parts of the content
              const segmentSize = Math.min(200, Math.floor(contentLength / 5));
              start = Math.min(referenceCount * segmentSize, contentLength - segmentSize);
              end = Math.min(start + segmentSize, contentLength);
            }
            
            const textSnippet = actualFile.content.substring(start, end);
            
            // Determine position for media files
            let position: number | undefined = undefined;
            
            // For media files, try to extract a timestamp from the content
            if (['youtube', 'audio', 'video', 'mp3', 'mpeg'].includes(actualFile.fileType?.toLowerCase()) || 
                (actualFile.fileName && (
                  actualFile.fileName.toLowerCase().endsWith('.mp3') ||
                  actualFile.fileName.toLowerCase().endsWith('.wav') ||
                  actualFile.fileName.toLowerCase().endsWith('.ogg') ||
                  actualFile.fileName.toLowerCase().endsWith('.m4a')
                ))) {
              try {
                // Try to parse the content as JSON (for YouTube transcripts)
                const contentData = JSON.parse(actualFile.content);
                
                // If it's an array of transcript segments, use the start time of a random segment
                if (Array.isArray(contentData) && contentData.length > 0 && contentData[0].start !== undefined) {
                  // Get a random segment from the first half of the transcript
                  const randomIndex = Math.floor(Math.random() * Math.min(contentData.length, 10));
                  position = contentData[randomIndex].start;
                  console.log(`Found timestamp ${position} for ${actualFile.fileType} file`);
                }
              } catch (e) {
                // If parsing fails, use a default position
                console.log(`Could not parse content for ${actualFile.fileType} file, using default position`);
                position = 0;
              }
            }
            
            references.push({
              fileId,
              text: textSnippet,
              position
            });
          }
        }
      }
      
      // Extract inline references using the new citation format
      const inlineCiteRegex = /\(\((\d+)(?::([a-zA-Z0-9\-]+))?\)\)/g;
      let inlineMatch;
      
      console.log('Looking for citations in response using pattern ((DOC_INDEX:ID_OR_TIMESTAMP))');
      console.log('Response sample:', cleanedResponseText.substring(0, 300) + (cleanedResponseText.length > 300 ? '...' : ''));
      
      // Test the citation pattern with a sample response
      const testResponse = "This is a test ((1:123.45)) with a citation and ((2:6877d069-ea10-4e47-a928-5f0ffbe92b5a)) with an ID.";
      const testMatches = [];
      let testMatch;
      
      // Reset regex state
      inlineCiteRegex.lastIndex = 0;
      
      // Find all citation matches in the test response
      while ((testMatch = inlineCiteRegex.exec(testResponse)) !== null) {
        testMatches.push({
          match: testMatch[0],
          docIndex: testMatch[1],
          timestamp: testMatch[2],
          index: testMatch.index
        });
      }
      
      console.log('Citation pattern test results:', testMatches);
      
      // Reset regex state
      inlineCiteRegex.lastIndex = 0;
      
      // Create a map to track unique references by fileId and timestamp
      const uniqueReferences = new Map<string, Reference>();
      
      while ((inlineMatch = inlineCiteRegex.exec(cleanedResponseText)) !== null) {
        const docIndex = parseInt(inlineMatch[1], 10);
        const idOrTimestamp = inlineMatch[2] ? inlineMatch[2] : undefined;
        
        console.log(`Found citation: ((${docIndex}${idOrTimestamp !== undefined ? ':' + idOrTimestamp : ''}))`);
        
        // Check if the second part is a fileId (UUID format)
        const isFileId = idOrTimestamp && /^[a-f0-9\-]{36}$/i.test(idOrTimestamp);
        
        if (isFileId) {
          // Use the fileId directly
          const fileId = idOrTimestamp;
          console.log(`Using direct fileId: ${fileId}`);
          
          // Find the file in the knowledgebase files
          const actualFile = truncatedContext.find(ctx => ctx.fileId === fileId);
          
          if (actualFile) {
            console.log(`Found file for fileId ${fileId}:`, actualFile.fileName, actualFile.fileType);
            
            // Create a unique key for this reference based on fileId
            const refKey = `${fileId}:direct`;
            
            // Skip if we've already processed this exact reference
            if (uniqueReferences.has(refKey)) {
              console.log(`Skipping duplicate reference for file ${actualFile.fileName}`);
              continue;
            }
            
            // Use the exact chunk that was found during semantic search
            let textSnippet = actualFile.content;
            
            // Extract a snippet from the content - use different snippets for each reference
            // For the first reference to this file, use the beginning
            // For subsequent references, use different parts of the content
            const referenceCount = Array.from(uniqueReferences.values())
              .filter(ref => ref.fileId === fileId).length;
            const contentLength = actualFile.content.length;
            
            let start = 0;
            let end = Math.min(contentLength, 200);
            
            if (referenceCount > 0) {
              // For subsequent references, use different parts of the content
              const segmentSize = Math.min(200, Math.floor(contentLength / 5));
              start = Math.min(referenceCount * segmentSize, contentLength - segmentSize);
              end = Math.min(start + segmentSize, contentLength);
            }
            
            textSnippet = actualFile.content.substring(start, end);
            
            console.log(`Adding reference: fileId=${fileId}`);
            
            // Add the reference to our map of unique references
            uniqueReferences.set(refKey, {
              fileId,
              text: textSnippet,
              position: undefined
            });
          } else {
            console.log(`No file found for fileId ${fileId}`);
          }
        } else {
          // Find the file by document index
          const file = truncatedContext.find(ctx => ctx.docIndex === docIndex);
          
          if (file) {
            console.log(`Found file for docIndex ${docIndex}:`, file.fileName, file.fileType);
            
            const fileId = file.fileId;
            
            // Create a unique key for this reference based on fileId and timestamp
            const refKey = `${fileId}:${idOrTimestamp !== undefined ? idOrTimestamp : 'null'}`;
            
            // Skip if we've already processed this exact reference
            if (uniqueReferences.has(refKey)) {
              console.log(`Skipping duplicate reference for file ${file.fileName} with timestamp ${idOrTimestamp}`);
              continue;
            }
            
            // Use the exact chunk that was found during semantic search
            let textSnippet = file.content;
            let finalTimestamp = undefined;
            
            // Try to parse the timestamp if it's a number
            if (idOrTimestamp && !isNaN(parseFloat(idOrTimestamp))) {
              finalTimestamp = parseFloat(idOrTimestamp);
            }
            
            // For media files, ensure we have a timestamp
            if (['youtube', 'audio', 'video', 'mp3', 'mpeg'].includes(file.fileType?.toLowerCase()) || 
                (file.fileName && (
                  file.fileName.toLowerCase().endsWith('.mp3') ||
                  file.fileName.toLowerCase().endsWith('.wav') ||
                  file.fileName.toLowerCase().endsWith('.ogg') ||
                  file.fileName.toLowerCase().endsWith('.m4a')
                ))) {
              // If no timestamp was provided in the citation, try to extract one from the content
              if (finalTimestamp === undefined) {
                try {
                  // Try to parse the content as JSON (for YouTube transcripts)
                  const contentData = JSON.parse(file.content);
                  
                  // If it's an array of transcript segments, use a timestamp from the content
                  if (Array.isArray(contentData) && contentData.length > 0 && contentData[0].start !== undefined) {
                    // Use the middle of the transcript as a default timestamp
                    const middleIndex = Math.floor(contentData.length / 2);
                    finalTimestamp = contentData[middleIndex].start;
                    console.log(`No timestamp provided in citation ((${docIndex})), using middle of transcript: ${finalTimestamp}s`);
                  }
                } catch (e) {
                  // If parsing fails, use 0 as default
                  finalTimestamp = 0;
                  console.log(`Could not parse content for citation ((${docIndex})), set default timestamp to 0s:`, e);
                }
              }
              
              // Try to find the specific segment for the timestamp
              if (finalTimestamp !== undefined) {
                try {
                  // Try to parse the content as JSON (for YouTube transcripts)
                  const contentData = JSON.parse(file.content);
                  
                  // If it's an array of transcript segments, find the segment closest to the timestamp
                  if (Array.isArray(contentData) && contentData.length > 0 && contentData[0].start !== undefined) {
                    const closestSegment = contentData.reduce((prev, curr) => {
                      return Math.abs(curr.start - finalTimestamp!) < Math.abs(prev.start - finalTimestamp!) ? curr : prev;
                    });
                    
                    console.log(`Found closest segment for citation ((${docIndex}:${finalTimestamp})) at ${closestSegment.start}s:`, closestSegment.text);
                    textSnippet = closestSegment.text;
                    
                    // Update the timestamp to the exact start time of the segment
                    finalTimestamp = closestSegment.start;
                  }
                } catch (e) {
                  // If parsing fails, use a default snippet
                  console.log(`Could not parse content for ${file.fileType} file, using default snippet:`, e);
                  
                  // Extract a snippet from the content - use different snippets for each reference
                  // For the first reference to this file, use the beginning
                  // For subsequent references, use different parts of the content
                  const referenceCount = Array.from(uniqueReferences.values())
                    .filter(ref => ref.fileId === fileId).length;
                  const contentLength = file.content.length;
                  
                  let start = 0;
                  let end = Math.min(contentLength, 200);
                  
                  if (referenceCount > 0) {
                    // For subsequent references, use different parts of the content
                    const segmentSize = Math.min(200, Math.floor(contentLength / 5));
                    start = Math.min(referenceCount * segmentSize, contentLength - segmentSize);
                    end = Math.min(start + segmentSize, contentLength);
                  }
                  
                  textSnippet = file.content.substring(start, end);
                }
              }
            } else {
              // For non-media files, extract different snippets for each reference
              const referenceCount = Array.from(uniqueReferences.values())
                .filter(ref => ref.fileId === fileId).length;
              const contentLength = file.content.length;
              
              let start = 0;
              let end = Math.min(contentLength, 200);
              
              if (referenceCount > 0) {
                // For subsequent references, use different parts of the content
                const segmentSize = Math.min(200, Math.floor(contentLength / 5));
                start = Math.min(referenceCount * segmentSize, contentLength - segmentSize);
                end = Math.min(start + segmentSize, contentLength);
              }
              
              textSnippet = file.content.substring(start, end);
            }
            
            console.log(`Adding reference: fileId=${fileId}, position=${finalTimestamp}`);
            
            // Add the reference to our map of unique references
            uniqueReferences.set(refKey, {
              fileId,
              text: textSnippet,
              position: finalTimestamp
            });
          } else {
            console.log(`No file found for docIndex ${docIndex}`);
          }
        }
      }
      
      // Convert the map values to an array
      const extractedReferences = Array.from(uniqueReferences.values());
      
      // Add the extracted references to our references array
      references.push(...extractedReferences);
      
      // Remove the Sources section from the response text
      if (sourcesMatch) {
        cleanedResponseText = cleanedResponseText.substring(0, sourcesMatch.index!).trim();
      }
      
      // 7. Return the AI response with references
      console.log(`Returning AI response with ${references.length} references`);
      
      // Log the references for debugging
      if (references.length > 0) {
        console.log('References:', references.map(ref => ({
          fileId: ref.fileId,
          position: ref.position,
          textSnippet: ref.text.substring(0, 50) + (ref.text.length > 50 ? '...' : '')
        })));
      } else {
        console.log('No references found in the response');
      }
      
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