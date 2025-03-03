# Sattva AI - Knowledge Base & AI Chat Application

Sattva AI is a powerful application that allows users to create knowledge bases from various file types, including YouTube videos, PDFs, documents, and more. Users can then chat with an AI assistant that uses the knowledge base as context to provide accurate and relevant answers.

## Features

- **User Authentication**: Sign up and login with email/password or Google authentication
- **Knowledge Base Management**: Create, read, update, and delete knowledge bases
- **Text Extraction**: Extract and store text content from various file types:
  - PDF, PPTX, DOCX, TXT files
  - YouTube videos (via transcripts)
  - Audio files (via speech-to-text)
  - Real-time speech-to-text
- **AI Chat**: Ask questions about your knowledge base and get answers with reference points
- **Context Viewer**: View the source context of AI answers with highlighted text
- **Media Player**: Automatically play YouTube videos from the referenced timestamp

## How It Works

1. **Upload & Extract**: When you upload a file or provide a YouTube URL, Sattva AI extracts the text content
2. **Store & Index**: The extracted text is stored in the database and indexed for efficient searching
3. **Chat & Reference**: When you ask questions, the AI uses the stored text as context and provides answers with references to the original source

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS, Shadcn UI
- **Backend**: Supabase (Authentication, Database)
- **AI**: OpenAI API (GPT-3.5 Turbo)
- **Text Processing**: Various libraries for text extraction from different file formats

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Yarn or npm
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sattva-ai.git
   cd sattva-ai
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_OPENAI_API_KEY=your_openai_api_key
   ```

4. Set up Supabase:
   - Follow the instructions in [SUPABASE_SETUP.md](SUPABASE_SETUP.md) to set up your Supabase project.

### Development

Run the development server:
```bash
yarn dev
```

The application will be available at http://localhost:5173.

### Build

Build the application for production:
```bash
yarn build
```

Preview the production build:
```bash
yarn preview
```

## Project Structure

```
sattva/
├── public/            # Static assets
├── src/
│   ├── components/    # UI components
│   │   ├── ui/        # Shadcn UI components
│   │   ├── layout/    # Layout components
│   │   └── dashboard/ # Dashboard-specific components
│   ├── lib/           # Utility functions and services
│   ├── pages/         # Page components
│   ├── App.tsx        # Main application component
│   └── main.tsx       # Entry point
├── .env               # Environment variables (not committed)
├── .env.example       # Example environment variables
└── SUPABASE_SETUP.md  # Supabase setup instructions
```

## Usage

1. **Sign Up/Login**: Create an account or log in with your credentials.
2. **Create a Knowledge Base**: Go to the dashboard and create a new knowledge base.
3. **Add Content**: Upload files, add YouTube videos, or record audio to extract text for your knowledge base.
4. **Chat with AI**: Navigate to the chat page and start asking questions about your knowledge base.
5. **View Context**: See the source context for AI answers and navigate to specific parts of your content.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Supabase](https://supabase.com/) for authentication and database
- [OpenAI](https://openai.com/) for the AI capabilities
- [Shadcn UI](https://ui.shadcn.com/) for the beautiful UI components
- [TailwindCSS](https://tailwindcss.com/) for styling
