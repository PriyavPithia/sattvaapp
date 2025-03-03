# PDF Text Extraction for Sattva AI

This document outlines the approach for extracting text from PDF files in the Sattva AI application.

## Overview

Sattva AI extracts text content from PDF files to create searchable knowledge bases. Instead of storing the actual PDF files, we extract and store the text content, which provides several advantages:

- Reduced storage requirements
- Faster search and retrieval
- Better integration with AI for question answering
- Improved privacy and security

## Implementation Options

### 1. Client-Side Extraction (Browser)

We use **PDF.js** for client-side extraction. This is the same library that powers PDF viewing in Firefox.

#### Installation

```bash
# Using Yarn (recommended)
yarn add pdfjs-dist

# Or using npm
npm install pdfjs-dist
```

#### Usage

```typescript
import * as pdfjsLib from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

async function extractTextFromPdf(file: File): Promise<string> {
  try {
    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Iterate through each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract text items and join them
      const pageText = textContent.items
        .map((item: TextItem) => item.str)
        .join(' ');
      
      fullText += `[Page ${i}]\n${pageText}\n\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}
```

### 2. Server-Side Extraction (Node.js)

For more powerful extraction with better formatting preservation, you can use **pdf-parse** on the server.

#### Installation

```bash
# Using Yarn (recommended)
yarn add pdf-parse

# Or using npm
npm install pdf-parse
```

#### Usage

```typescript
import pdfParse from 'pdf-parse';

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}
```

## Handling PDF Worker

When using PDF.js in the browser, you need to make the PDF.js worker available. There are two approaches:

### 1. Copy the Worker File

Copy the worker file from `node_modules/pdfjs-dist/build/pdf.worker.min.js` to your public directory:

```bash
# Using cp command
cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/

# Or add a script to package.json
# "copy-pdf-worker": "cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/"
# Then run: yarn copy-pdf-worker
```

### 2. Load the Worker Dynamically

```typescript
useEffect(() => {
  if (!pdfWorkerLoaded) {
    const script = document.createElement('script');
    script.src = '/pdf.worker.min.js';
    script.onload = () => setPdfWorkerLoaded(true);
    document.body.appendChild(script);
  }
}, [pdfWorkerLoaded]);
```

## Extracting Metadata

In addition to text content, we extract metadata from PDFs:

```typescript
const metadata = {
  source_type: 'pdf',
  page_count: pdf.numPages,
  title: file.name,
  // Additional metadata can be extracted from the PDF itself
};
```

## Storing Extracted Text

After extraction, the text content and metadata are stored in the database:

```typescript
await knowledgebaseService.addContent(
  userId,
  knowledgebaseId,
  file.name,
  'pdf',
  extractedText.length,
  null, // No source URL for uploaded files
  extractedText,
  metadata
);
```

## Advanced Features

For a production environment, consider these advanced features:

1. **OCR for Scanned PDFs**: Use Tesseract.js or a cloud OCR service for PDFs that contain scanned images
   ```bash
   yarn add tesseract.js
   ```

2. **Layout Preservation**: Extract text with layout information to maintain the structure of the document
3. **Table Extraction**: Use specialized libraries to extract tables from PDFs
4. **Image Extraction**: Extract and process images within PDFs
5. **Chunking**: Split large documents into manageable chunks for better AI processing

## Recommended Libraries

- **PDF.js**: Client-side PDF parsing (https://mozilla.github.io/pdf.js/)
- **pdf-parse**: Simple PDF text extraction for Node.js
- **pdf-lib**: PDF manipulation in JavaScript
  ```bash
  yarn add pdf-lib
  ```
- **Tesseract.js**: OCR for scanned documents
- **pdf2json**: Convert PDF to JSON with layout information

## Implementation in Sattva AI

In Sattva AI, we've implemented a modular approach to text extraction in `src/lib/textExtraction.ts`, which handles different file types including PDFs. This is integrated with the file upload component to seamlessly extract text when users upload files. 