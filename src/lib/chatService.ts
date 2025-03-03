import { supabase } from './supabase';
import { Chat, Message } from './supabase';

export interface ChatMessage {
  id: string;
  chat_id: string;
  content: string;
  is_user: boolean;
  created_at: string;
  references?: {
    fileId: string;
    text: string;
    position?: number;
  }[];
}

// Chat operations
export const chatService = {
  // Get all chats for a user
  async getUserChats(userId: string): Promise<Chat[]> {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }
    
    return data || [];
  },
  
  // Get all chats for a knowledgebase
  async getKnowledgebaseChats(knowledgebaseId: string): Promise<Chat[]> {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('knowledgebase_id', knowledgebaseId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }
    
    return data || [];
  },
  
  // Get a single chat by ID
  async getChatById(id: string): Promise<Chat | null> {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching chat:', error);
      throw error;
    }
    
    return data;
  },
  
  // Create a new chat
  async createChat(userId: string, knowledgebaseId: string, title: string): Promise<Chat> {
    const { data, error } = await supabase
      .from('chats')
      .insert([
        { 
          user_id: userId, 
          knowledgebase_id: knowledgebaseId,
          title
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
    
    return data;
  },
  
  // Update a chat
  async updateChat(id: string, updates: Partial<Chat>): Promise<Chat> {
    const { data, error } = await supabase
      .from('chats')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating chat:', error);
      throw error;
    }
    
    return data;
  },
  
  // Delete a chat
  async deleteChat(id: string): Promise<void> {
    // First delete all messages in this chat
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_id', id);
    
    if (messagesError) {
      console.error('Error deleting chat messages:', messagesError);
      throw messagesError;
    }
    
    // Then delete the chat
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  },
  
  // Get all messages for a chat
  async getChatMessages(chatId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
    
    return data || [];
  },
  
  // Add a message to a chat
  async addMessage(
    chatId: string, 
    content: string, 
    isUser: boolean,
    references?: {
      fileId: string;
      text: string;
      position?: number;
    }[]
  ): Promise<ChatMessage> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          content: content,
          is_user: isUser,
          references: references || null
        })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  },

  // Get total count of AI interactions (assistant messages) for a user
  async getUserAIInteractionsCount(userId: string): Promise<number> {
    try {
      // First get all chat IDs for the user
      const { data: chats, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('user_id', userId);
      
      if (chatError) {
        console.error('Error fetching user chats:', chatError);
        throw chatError;
      }
      
      if (!chats || chats.length === 0) {
        return 0;
      }
      
      // Get count of assistant messages across all user chats
      // Using is_user=false instead of role=assistant
      const chatIds = chats.map(chat => chat.id);
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_user', false)
        .in('chat_id', chatIds);
      
      if (error) {
        console.error('Error getting AI interactions count:', error);
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      console.error('Error getting AI interactions count:', error);
      return 0; // Return 0 instead of throwing to prevent dashboard from breaking
    }
  }
}; 