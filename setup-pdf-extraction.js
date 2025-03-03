/**
 * Setup script for PDF extraction in Sattva AI
 * 
 * This script:
 * 1. Checks if PDF.js is installed
 * 2. Copies the PDF.js worker file to the public directory
 * 3. Verifies the setup is correct
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    crimson: '\x1b[38m'
  },
  
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    crimson: '\x1b[48m'
  }
};

// Helper function to log with colors
function log(message, color = colors.fg.white) {
  console.log(`${color}${message}${colors.reset}`);
}

// Check if PDF.js is installed
log('🔍 Checking for PDF.js installation...', colors.fg.cyan);

let pdfJsInstalled = false;
try {
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  pdfJsInstalled = packageJson.dependencies && packageJson.dependencies['pdfjs-dist'];
  
  if (pdfJsInstalled) {
    log('✅ PDF.js is installed!', colors.fg.green);
  } else {
    log('⚠️ PDF.js is not installed. Installing now...', colors.fg.yellow);
    execSync('yarn add pdfjs-dist', { stdio: 'inherit' });
    log('✅ PDF.js installed successfully!', colors.fg.green);
  }
} catch (error) {
  log(`❌ Error checking or installing PDF.js: ${error.message}`, colors.fg.red);
  process.exit(1);
}

// Create public directory if it doesn't exist
log('🔍 Checking for public directory...', colors.fg.cyan);
if (!fs.existsSync('./public')) {
  log('⚠️ Public directory not found. Creating it...', colors.fg.yellow);
  fs.mkdirSync('./public', { recursive: true });
  log('✅ Public directory created!', colors.fg.green);
} else {
  log('✅ Public directory exists!', colors.fg.green);
}

// Copy PDF.js worker file to public directory
log('🔍 Copying PDF.js worker file to public directory...', colors.fg.cyan);
try {
  // Check for the worker file with .mjs extension (PDF.js v4.0+)
  const workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
  const workerDest = './public/pdf.worker.min.mjs';
  
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, workerDest);
    log('✅ PDF.js worker file copied successfully!', colors.fg.green);
  } else {
    log(`❌ PDF.js worker file not found at ${workerSrc}`, colors.fg.red);
    log('⚠️ Trying alternative locations...', colors.fg.yellow);
    
    // Try alternative locations
    const alternativeLocations = [
      './node_modules/pdfjs-dist/build/pdf.worker.min.js',
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js',
      './node_modules/pdfjs-dist/webpack.js'
    ];
    
    let copied = false;
    for (const altSrc of alternativeLocations) {
      if (fs.existsSync(altSrc)) {
        const altDest = altSrc.endsWith('.mjs') 
          ? './public/pdf.worker.min.mjs' 
          : './public/pdf.worker.min.js';
        
        fs.copyFileSync(altSrc, altDest);
        log(`✅ PDF.js worker file copied from ${altSrc}!`, colors.fg.green);
        copied = true;
        break;
      }
    }
    
    if (!copied) {
      throw new Error('PDF.js worker file not found in any expected location');
    }
  }
} catch (error) {
  log(`❌ Error copying PDF.js worker file: ${error.message}`, colors.fg.red);
  process.exit(1);
}

// Verify setup
log('🔍 Verifying PDF extraction setup...', colors.fg.cyan);
if (fs.existsSync('./public/pdf.worker.min.mjs') || fs.existsSync('./public/pdf.worker.min.js')) {
  log('✅ PDF extraction setup is complete!', colors.fg.green);
  
  // Update the textExtraction.ts file to use the correct worker file
  log('🔍 Updating textExtraction.ts to use the correct worker file...', colors.fg.cyan);
  try {
    const workerFile = fs.existsSync('./public/pdf.worker.min.mjs') 
      ? 'pdf.worker.min.mjs' 
      : 'pdf.worker.min.js';
    
    const textExtractionPath = './src/lib/textExtraction.ts';
    if (fs.existsSync(textExtractionPath)) {
      let content = fs.readFileSync(textExtractionPath, 'utf8');
      
      // Update the worker source path
      content = content.replace(
        /pdfjsLib\.GlobalWorkerOptions\.workerSrc = '.*';/,
        `pdfjsLib.GlobalWorkerOptions.workerSrc = '/${workerFile}';`
      );
      
      fs.writeFileSync(textExtractionPath, content);
      log('✅ textExtraction.ts updated successfully!', colors.fg.green);
    } else {
      log('⚠️ textExtraction.ts not found. Make sure to set the worker path manually.', colors.fg.yellow);
    }
  } catch (error) {
    log(`⚠️ Error updating textExtraction.ts: ${error.message}`, colors.fg.yellow);
    log('You may need to update the worker path manually.', colors.fg.yellow);
  }
  
  log('\n📚 You can now extract text from PDF files in your application.', colors.fg.cyan);
  log('📝 Import the extraction utilities in your components:', colors.fg.cyan);
  log('   import { extractTextFromFile } from \'@/lib/textExtraction\';', colors.fg.white);
  log('\n📄 Extract text from a PDF file:', colors.fg.cyan);
  log('   const { text, metadata } = await extractTextFromFile(pdfFile);', colors.fg.white);
  log('\n🚀 Happy PDF extracting!', colors.fg.magenta);
} else {
  log('❌ PDF extraction setup failed. The worker file was not copied correctly.', colors.fg.red);
  process.exit(1);
}

// Add a note about additional libraries
console.log(`\n${colors.yellow}Optional: For advanced features, consider installing:${colors.reset}`);
console.log(`${colors.yellow}- tesseract.js: For OCR (scanned documents)${colors.reset}`);
console.log(`${colors.yellow}- pdf-parse: For server-side extraction${colors.reset}`);
console.log(`${colors.yellow}- pdf-lib: For PDF manipulation${colors.reset}`);
console.log(`\n${colors.green}Run 'yarn add <package-name>' to install these.${colors.reset}`); 