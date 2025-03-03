# Supabase Setup for Sattva AI

This guide will help you set up Supabase for authentication and database for the Sattva AI application.

## 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign up or log in.
2. Create a new project and give it a name (e.g., "Sattva AI").
3. Choose a strong database password and save it securely.
4. Select a region closest to your users.
5. Wait for the project to be created.

## 2. Set Up Authentication

1. In your Supabase dashboard, go to **Authentication** > **Providers**.
2. Email/Password authentication is enabled by default.
3. For Google authentication:
   - Go to the **Google** provider and toggle it on.
   - Follow the instructions to set up OAuth with Google:
     - Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
     - Set up OAuth consent screen.
     - Create OAuth credentials (Web application type).
     - Add authorized redirect URIs:
       - `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
       - `http://localhost:5173/auth/callback` (for local development)
     - Copy the Client ID and Client Secret to Supabase.

## 3. Create Database Tables

Go to the **SQL Editor** in your Supabase dashboard and run the SQL script from the `supabase_setup.sql` file in this repository. This script will:

1. Create the necessary tables:
   - `knowledgebases` - For storing knowledge base information
   - `files` - For storing metadata and extracted text content from files (not the actual files)
   - `chats` - For tracking conversations
   - `messages` - For storing individual messages in chats

2. Set up indexes for better performance

3. Configure Row Level Security (RLS) policies to ensure users can only access their own data

## 4. Important Note About File Handling

Unlike traditional file storage systems, Sattva AI focuses on extracting and storing the text content from files rather than the files themselves:

- When a user uploads a file (PDF, DOCX, TXT, etc.), the application extracts the text content
- For YouTube videos, the application fetches the transcript or uses speech-to-text
- For audio files, the application uses speech-to-text to generate a transcript
- The extracted text is stored in the database along with metadata about the original source

This approach has several advantages:
- Reduced storage requirements
- Faster search and retrieval of information
- Better integration with AI for question answering

## 5. Get API Keys

1. Go to **Project Settings** > **API** in your Supabase dashboard.
2. Copy the **URL** and **anon key** (public API key).
3. Add these to your `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 6. Run the Application

Now you can run the application with Supabase integration:

```bash
yarn dev
```

## Troubleshooting

- If you encounter CORS issues, make sure your site URL is added to the allowed origins in Supabase project settings.
- For authentication issues, check the browser console for specific error messages.
- For database issues, check the SQL queries and make sure the tables are created correctly.
- For storage issues, verify the bucket policies and make sure the bucket is public if needed. 