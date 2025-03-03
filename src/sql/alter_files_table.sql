-- Alter files table to better handle text content storage
-- Run this in your Supabase SQL Editor

-- First, check if content_text column exists and its type
DO $$
BEGIN
  -- Check if content_text column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'files' 
    AND column_name = 'content_text'
  ) THEN
    -- If it exists, alter it to use TEXT type with no limit
    ALTER TABLE files 
    ALTER COLUMN content_text TYPE TEXT;
    
    RAISE NOTICE 'Modified content_text column to TEXT type with no size limit';
  ELSE
    -- If it doesn't exist, add it
    ALTER TABLE files 
    ADD COLUMN content_text TEXT NOT NULL DEFAULT '';
    
    RAISE NOTICE 'Added content_text column with TEXT type';
  END IF;
  
  -- Add a full-text search index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE indexname = 'files_content_text_idx'
  ) THEN
    -- Create a GIN index for full-text search
    CREATE INDEX files_content_text_idx ON files USING GIN (to_tsvector('english', content_text));
    
    RAISE NOTICE 'Created full-text search index on content_text column';
  END IF;
  
  -- Add a content_length column to store the length of the text
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'files' 
    AND column_name = 'content_length'
  ) THEN
    ALTER TABLE files 
    ADD COLUMN content_length INTEGER DEFAULT 0;
    
    -- Update existing records
    UPDATE files 
    SET content_length = LENGTH(content_text);
    
    RAISE NOTICE 'Added content_length column and updated existing records';
  END IF;
  
  -- Add a column to store the extraction status
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'files' 
    AND column_name = 'extraction_status'
  ) THEN
    -- Create an enum type if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_type 
      WHERE typname = 'extraction_status_type'
    ) THEN
      CREATE TYPE extraction_status_type AS ENUM ('pending', 'completed', 'failed');
    END IF;
    
    ALTER TABLE files 
    ADD COLUMN extraction_status extraction_status_type DEFAULT 'pending';
    
    -- Update existing records
    UPDATE files 
    SET extraction_status = 'completed' 
    WHERE content_text IS NOT NULL AND content_text != '';
    
    RAISE NOTICE 'Added extraction_status column and updated existing records';
  END IF;
  
END $$; 