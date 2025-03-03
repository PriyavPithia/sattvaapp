-- Create tables for Sattva AI

-- Knowledgebases table
CREATE TABLE IF NOT EXISTS knowledgebases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Files table - primarily stores metadata and extracted text content, not the actual files
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  source_url TEXT, -- URL to the source (e.g., YouTube URL) or reference
  knowledgebase_id UUID NOT NULL REFERENCES knowledgebases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_text TEXT NOT NULL, -- Extracted text content from the file (required)
  metadata JSONB, -- Additional metadata like timestamps for videos, page numbers for PDFs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledgebase_id UUID NOT NULL REFERENCES knowledgebases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_user BOOLEAN NOT NULL DEFAULT FALSE,
  "references" JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance (with conditional checks)
DO $$
BEGIN
    -- Check if indexes exist before creating them
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'knowledgebases_user_id_idx') THEN
        CREATE INDEX knowledgebases_user_id_idx ON knowledgebases(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'files_knowledgebase_id_idx') THEN
        CREATE INDEX files_knowledgebase_id_idx ON files(knowledgebase_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'chats_knowledgebase_id_idx') THEN
        CREATE INDEX chats_knowledgebase_id_idx ON chats(knowledgebase_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'chats_user_id_idx') THEN
        CREATE INDEX chats_user_id_idx ON chats(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'messages_chat_id_idx') THEN
        CREATE INDEX messages_chat_id_idx ON messages(chat_id);
    END IF;
    
    -- Add text search index for content_text to enable efficient text searching
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'files_content_text_idx') THEN
        CREATE INDEX files_content_text_idx ON files USING GIN (to_tsvector('english', content_text));
    END IF;
END $$;

-- Create Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE knowledgebases ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for knowledgebases (with conditional checks)
DO $$
BEGIN
    -- Check if policies exist before creating them
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'knowledgebases' AND policyname = 'Users can view their own knowledgebases') THEN
        CREATE POLICY "Users can view their own knowledgebases" 
          ON knowledgebases FOR SELECT 
          USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'knowledgebases' AND policyname = 'Users can create their own knowledgebases') THEN
        CREATE POLICY "Users can create their own knowledgebases" 
          ON knowledgebases FOR INSERT 
          WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'knowledgebases' AND policyname = 'Users can update their own knowledgebases') THEN
        CREATE POLICY "Users can update their own knowledgebases" 
          ON knowledgebases FOR UPDATE 
          USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'knowledgebases' AND policyname = 'Users can delete their own knowledgebases') THEN
        CREATE POLICY "Users can delete their own knowledgebases" 
          ON knowledgebases FOR DELETE 
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create policies for files (with conditional checks)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'files' AND policyname = 'Users can view their own files') THEN
        CREATE POLICY "Users can view their own files" 
          ON files FOR SELECT 
          USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'files' AND policyname = 'Users can create their own files') THEN
        CREATE POLICY "Users can create their own files" 
          ON files FOR INSERT 
          WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'files' AND policyname = 'Users can update their own files') THEN
        CREATE POLICY "Users can update their own files" 
          ON files FOR UPDATE 
          USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'files' AND policyname = 'Users can delete their own files') THEN
        CREATE POLICY "Users can delete their own files" 
          ON files FOR DELETE 
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create policies for chats (with conditional checks)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users can view their own chats') THEN
        CREATE POLICY "Users can view their own chats" 
          ON chats FOR SELECT 
          USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users can create their own chats') THEN
        CREATE POLICY "Users can create their own chats" 
          ON chats FOR INSERT 
          WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users can update their own chats') THEN
        CREATE POLICY "Users can update their own chats" 
          ON chats FOR UPDATE 
          USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users can delete their own chats') THEN
        CREATE POLICY "Users can delete their own chats" 
          ON chats FOR DELETE 
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create policies for messages (with conditional checks)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view messages in their chats') THEN
        CREATE POLICY "Users can view messages in their chats" 
          ON messages FOR SELECT 
          USING (auth.uid() IN (
            SELECT user_id FROM chats WHERE id = messages.chat_id
          ));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can create messages in their chats') THEN
        CREATE POLICY "Users can create messages in their chats" 
          ON messages FOR INSERT 
          WITH CHECK (auth.uid() IN (
            SELECT user_id FROM chats WHERE id = messages.chat_id
          ));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can update messages in their chats') THEN
        CREATE POLICY "Users can update messages in their chats" 
          ON messages FOR UPDATE 
          USING (auth.uid() IN (
            SELECT user_id FROM chats WHERE id = messages.chat_id
          ));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can delete messages in their chats') THEN
        CREATE POLICY "Users can delete messages in their chats" 
          ON messages FOR DELETE 
          USING (auth.uid() IN (
            SELECT user_id FROM chats WHERE id = messages.chat_id
          ));
    END IF;
END $$; 