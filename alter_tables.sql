-- SQL to modify existing tables for Sattva AI
-- Run this if you already have tables created and need to update them

-- 1. Modify the files table to focus on text content
ALTER TABLE files
  -- Rename url column to source_url and make it nullable
  RENAME COLUMN url TO source_url;

ALTER TABLE files
  ALTER COLUMN source_url DROP NOT NULL;

-- 2. Make content_text required (if it's not already)
ALTER TABLE files
  ALTER COLUMN content_text SET NOT NULL;

-- 3. Add metadata column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE files ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- 4. Create text search index for content_text if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'files_content_text_idx') THEN
    CREATE INDEX files_content_text_idx ON files USING GIN (to_tsvector('english', content_text));
  END IF;
END $$;

-- 5. Update any existing rows with NULL content_text (if any)
-- This is a placeholder - you'll need to decide what to do with existing files
-- Option 1: Set a placeholder text for existing files
UPDATE files 
SET content_text = 'Content not extracted. Please re-upload this file.' 
WHERE content_text IS NULL;

-- Option 2: Or you could delete files without content (uncomment if needed)
-- DELETE FROM files WHERE content_text IS NULL;

-- 6. Add any missing indexes
DO $$
BEGIN
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
END $$; 