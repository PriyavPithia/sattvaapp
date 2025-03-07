import axios from 'axios';

/**
 * Service for text-to-speech conversion
 */
export const textToSpeechService = {
  /**
   * Convert text to speech using OpenAI's TTS API
   * @param text The text to convert to speech
   * @param voice The voice to use (default: 'alloy')
   * @returns A blob containing the audio data
   */
  async convertTextToSpeech(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<Blob> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key is not set in environment variables');
      }
      
      console.log(`Converting text to speech using ${voice} voice...`);
      
      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: text,
          voice: voice,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );
      
      // Convert the response to a Blob
      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      return audioBlob;
    } catch (error) {
      console.error('Error converting text to speech:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.error?.message || 'Unknown error';
        
        console.error(`OpenAI API error (${statusCode}): ${errorMessage}`);
        
        if (statusCode === 401) {
          throw new Error('Invalid OpenAI API key. Please check your API key in the settings.');
        } else if (statusCode === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`OpenAI API error: ${errorMessage}`);
        }
      }
      
      throw new Error('Failed to convert text to speech');
    }
  },
  
  /**
   * Generate a podcast from multiple files
   * @param files The files to include in the podcast
   * @param title The title of the podcast
   * @returns A blob containing the podcast audio
   */
  async generatePodcast(files: { id: string; name: string; content: string }[], title: string): Promise<Blob> {
    try {
      // Generate podcast script from files
      const script = await this.generatePodcastScript(files, title);
      
      // Convert script to speech
      const audioBlob = await this.convertTextToSpeech(script);
      
      return audioBlob;
    } catch (error) {
      console.error('Error generating podcast:', error);
      throw error;
    }
  },
  
  /**
   * Generate a podcast script from multiple files
   * @param files The files to include in the podcast
   * @param title The title of the podcast
   * @returns The podcast script
   */
  async generatePodcastScript(files: { id: string; name: string; content: string }[], title: string): Promise<string> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key is not set in environment variables');
      }
      
      // Prepare the content from files
      const fileContents = files.map(file => {
        return `File: ${file.name}\n\n${file.content.substring(0, 1000)}${file.content.length > 1000 ? '...' : ''}`;
      }).join('\n\n---\n\n');
      
      // Generate podcast script using OpenAI
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { 
              role: 'system', 
              content: `You are a professional podcast host and educator. Your task is to create a podcast script based on the provided content.
              The podcast should be engaging, informative, and flow naturally as if it's being spoken.
              
              PODCAST FORMAT:
              1. Start with a brief introduction to the topic
              2. Present the key points from the content in a conversational style
              3. Explain complex concepts in simple terms
              4. Include transitions between different sections
              5. End with a summary and conclusion
              
              Keep the script concise and focused, suitable for a 5-10 minute podcast.
              Do not include any timestamps, sound effects, or speaker names.
              Write in a natural, conversational tone that sounds good when read aloud.`
            },
            { 
              role: 'user', 
              content: `Please create a podcast script for a podcast titled "${title}" based on the following content:\n\n${fileContents}`
            }
          ],
          temperature: 0.7,
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
      console.error('Error generating podcast script:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.error?.message || 'Unknown error';
        
        console.error(`OpenAI API error (${statusCode}): ${errorMessage}`);
        
        if (statusCode === 401) {
          throw new Error('Invalid OpenAI API key. Please check your API key in the settings.');
        } else if (statusCode === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`OpenAI API error: ${errorMessage}`);
        }
      }
      
      throw new Error('Failed to generate podcast script');
    }
  }
}; 