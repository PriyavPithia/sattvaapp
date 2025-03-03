import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

// Define types for our database tables
export type User = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
};

export type Knowledgebase = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type FileRecord = {
  id: string;
  user_id: string;
  knowledgebase_id: string;
  name: string;
  type: string;
  size: number;
  path?: string;
  source_url?: string;
  content_text?: string;
  content_length?: number;
  extraction_status?: 'pending' | 'completed' | 'failed';
  metadata?: any;
  created_at: string;
  updated_at: string;
};

export type Chat = {
  id: string;
  user_id: string;
  knowledgebase_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  chat_id: string;
  user_id: string;
  is_user: boolean;
  content: string;
  references?: {
    fileId: string;
    text: string;
    position?: number;
  }[];
  created_at: string;
}; 