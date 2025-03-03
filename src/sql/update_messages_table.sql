-- Script to update the messages table schema if needed

-- Check if the is_user column exists, and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'is_user'
    ) THEN
        ALTER TABLE messages ADD COLUMN is_user BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- Check if the references column exists, and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'references'
    ) THEN
        ALTER TABLE messages ADD COLUMN "references" JSONB;
    END IF;
END $$;

-- If there's a 'role' column that was mistakenly added, we can migrate data and drop it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'role'
    ) THEN
        -- Migrate data from 'role' to 'is_user'
        UPDATE messages
        SET is_user = (role = 'user')
        WHERE role IS NOT NULL;
        
        -- Drop the 'role' column
        ALTER TABLE messages DROP COLUMN role;
    END IF;
END $$;

-- Add an index on chat_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'messages_chat_id_idx'
    ) THEN
        CREATE INDEX messages_chat_id_idx ON messages(chat_id);
    END IF;
END $$; 