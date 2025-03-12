/**
 * Website scraping utilities for Sattva AI
 * This file contains functions for scraping text content from websites
 */

/**
 * Scrape text content from a website URL
 * This function uses a proxy service to avoid CORS issues
 */
export async function scrapeWebsite(url: string): Promise<{
  text: string;
  title: string;
  metadata: {
    url: string;
    headings: string[];
    wordCount: number;
    paragraphCount: number;
  };
}> {
  try {
    // Validate URL
    if (!url.match(/^https?:\/\/.+/)) {
      throw new Error('Invalid URL. Please include http:// or https://');
    }
    
    // Use a proxy service to avoid CORS issues
    // For production, you should use your own backend service
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
    
    // Fetch the website content
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.statusText}`);
    }
    
    // Get the HTML content
    const html = await response.text();
    
    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract the title
    const title = doc.title || 'Untitled Website';
    
    // Store all content elements in order to preserve structure
    const contentElements: {type: string; text: string}[] = [];
    
    // Extract headings (for metadata only)
    const headings: string[] = [];
    
    // Helper function to check if an element is visible
    const isVisible = (element: Element): boolean => {
      try {
        const computedStyle = window.getComputedStyle(element);
        return !(computedStyle.display === 'none' || 
                computedStyle.visibility === 'hidden' || 
                computedStyle.opacity === '0' ||
                element.hasAttribute('hidden'));
      } catch (e) {
        // If we can't compute style, assume it's visible
        return true;
      }
    };
    
    // Helper function to check if text is meaningful
    const isMeaningfulText = (text: string): boolean => {
      if (!text) return false;
      
      // Remove whitespace
      const trimmed = text.trim();
      if (trimmed.length === 0) return false;
      
      // Check if it's just a single character or punctuation
      if (trimmed.length < 2) return false;
      
      // Check if it's just a number
      if (/^\d+$/.test(trimmed)) return false;
      
      return true;
    };
    
    // Helper function to check if text is likely promotional content
    const isPromotionalContent = (text: string): boolean => {
      // Don't process empty text
      if (!text || text.trim().length === 0) return false;
      
      const lowerText = text.toLowerCase();
      
      // Only filter out obvious promotional content
      // Check for script-like content and specific promotional patterns
      if (lowerText.includes('hbspt.cta') || 
          lowerText.includes('function(') || 
          lowerText.includes('var ') || 
          lowerText.includes('const ') || 
          lowerText.includes('let ') ||
          /\bhbspt\.cta\.load\b/.test(lowerText) ||
          /\brelated articles\b/i.test(lowerText) ||
          /\bcontact us\b/i.test(lowerText) ||
          /\bsubscribe\s+to\s+our\s+newsletter\b/i.test(lowerText)) {
        return true;
      }
      
      // Less aggressive filtering - only filter out obvious CTAs and ads
      if (text.length < 100 && (
        /\b(click|tap|get|download)\s+(now|today|here)\b/i.test(lowerText) ||
        /\b(free|limited)\s+(trial|offer|time)\b/i.test(lowerText) ||
        /\bsubscribe\s+now\b/i.test(lowerText) ||
        /\bsign\s+up\s+now\b/i.test(lowerText)
      )) {
        return true;
      }
      
      return false;
    };
    
    // Helper function to check if an element is likely a navigation, footer, or sidebar
    const isNonContentElement = (element: Element): boolean => {
      const tagName = element.tagName.toLowerCase();
      const className = (element.className || '').toString().toLowerCase();
      const id = (element.id || '').toString().toLowerCase();
      
      // Check tag name - but be more selective
      // Don't exclude header elements as they might contain the article title
      if (['nav', 'footer'].includes(tagName)) {
        return true;
      }
      
      // Check for obvious navigation, footer, and sidebar elements
      const nonContentClasses = [
        'navbar', 'navigation', 'menu', 'footer', 'sidebar',
        'widget', 'ad', 'advertisement', 'banner', 'cookie-banner',
        'social-links', 'share-buttons', 'newsletter-signup',
        'comment-section', 'author-bio', 'copyright'
      ];
      
      for (const cls of nonContentClasses) {
        if (className.includes(cls)) {
          return true;
        }
      }
      
      // Check ID - be more selective
      const nonContentIds = [
        'navbar', 'navigation', 'menu', 'footer', 'sidebar',
        'widget', 'ad', 'advertisement', 'banner', 'cookie-banner',
        'social-links', 'share-buttons', 'newsletter-signup',
        'comment-section', 'author-bio', 'copyright'
      ];
      
      for (const idName of nonContentIds) {
        if (id.includes(idName)) {
          return true;
        }
      }
      
      return false;
    };
    
    // Process the body content in order of appearance
    const processNode = (node: Element, depth = 0) => {
      // Skip invisible elements, scripts, styles, and comments
      if (!isVisible(node) || 
          node.tagName.toLowerCase() === 'script' ||
          node.tagName.toLowerCase() === 'style' ||
          node.tagName.toLowerCase() === 'noscript' ||
          node.nodeType === 8) { // Comment node
        return;
      }
      
      // Only skip obvious non-content elements
      if (depth > 0 && isNonContentElement(node)) {
        return;
      }
      
      const tagName = node.tagName.toLowerCase();
      
      // Get direct text content (excluding child elements)
      let directText = '';
      for (const childNode of Array.from(node.childNodes)) {
        if (childNode.nodeType === Node.TEXT_NODE) {
          directText += childNode.textContent || '';
        }
      }
      directText = directText.trim();
      
      // Only skip obvious promotional content
      if (directText && isPromotionalContent(directText)) {
        return;
      }
      
      // Process by tag type
      switch (tagName) {
        // Headings
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          const headingText = node.textContent?.trim();
          if (isMeaningfulText(headingText) && !isPromotionalContent(headingText)) {
            contentElements.push({type: 'heading', text: headingText});
            headings.push(`${tagName.toUpperCase()}: ${headingText}`);
          }
          break;
          
        // Paragraphs and text content
        case 'p':
          const paragraphText = node.textContent?.trim();
          if (isMeaningfulText(paragraphText) && !isPromotionalContent(paragraphText)) {
            contentElements.push({type: 'paragraph', text: paragraphText});
          }
          break;
          
        // List items
        case 'li':
          const listItemText = node.textContent?.trim();
          if (isMeaningfulText(listItemText) && !isPromotionalContent(listItemText)) {
            contentElements.push({type: 'list-item', text: `• ${listItemText}`});
          }
          break;
          
        // Tables
        case 'table':
          // Skip tables that might contain navigation or layout elements
          if (!isNonContentElement(node)) {
            // Process table rows
            node.querySelectorAll('tr').forEach(row => {
              const rowText = row.textContent?.trim();
              if (isMeaningfulText(rowText) && !isPromotionalContent(rowText)) {
                contentElements.push({type: 'table-row', text: rowText});
              }
            });
          }
          break;
          
        // Blockquotes
        case 'blockquote':
          const quoteText = node.textContent?.trim();
          if (isMeaningfulText(quoteText) && !isPromotionalContent(quoteText)) {
            contentElements.push({type: 'quote', text: `"${quoteText}"`});
          }
          break;
          
        // Process text in divs only if they contain direct text (not just child elements)
        case 'div':
        case 'section':
        case 'article':
        case 'main':
        case 'aside':
          if (isMeaningfulText(directText) && !isPromotionalContent(directText)) {
            contentElements.push({type: 'text', text: directText});
          }
          
          // Always process children of these container elements
          Array.from(node.children).forEach(child => processNode(child as Element, depth + 1));
          break;
          
        // Default: process children for any other elements
        default:
          // If the element has direct text, add it
          if (isMeaningfulText(directText) && !isPromotionalContent(directText)) {
            contentElements.push({type: 'text', text: directText});
          }
          
          // Process children
          if (node.children && node.children.length > 0) {
            Array.from(node.children).forEach(child => processNode(child as Element, depth + 1));
          }
          break;
      }
    };
    
    // Try to find the main content area
    // Common selectors for main content in blogs and articles
    const contentSelectors = [
      'article', 
      'main', 
      '.post-content', 
      '.article-content', 
      '.entry-content', 
      '.blog-post', 
      '.content-area',
      '#content',
      '.main-content',
      '.post',
      '.article',
      '.blog',
      '.content',
      '[role="main"]'
    ];
    
    let mainContent: Element | null = null;
    
    // Try each selector until we find a match
    for (const selector of contentSelectors) {
      mainContent = doc.querySelector(selector);
      if (mainContent) break;
    }
    
    // If no specific content area found, use the body
    if (!mainContent) {
      mainContent = doc.querySelector('body');
    }
    
    // Process the content
    if (mainContent) {
      Array.from(mainContent.children).forEach(child => processNode(child as Element));
    }
    
    // If we didn't get any content, try a more aggressive approach
    if (contentElements.length === 0 || contentElements.length === 1) {
      console.log('No content found with selective approach, trying more aggressive approach');
      // Process the entire body
      const body = doc.querySelector('body');
      if (body) {
        // Find all paragraphs in the document
        const paragraphs = body.querySelectorAll('p');
        paragraphs.forEach(p => {
          const text = p.textContent?.trim();
          if (isMeaningfulText(text) && !isPromotionalContent(text)) {
            contentElements.push({type: 'paragraph', text});
          }
        });
        
        // Find all headings in the document
        const headingElements = body.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headingElements.forEach(h => {
          const text = h.textContent?.trim();
          if (isMeaningfulText(text) && !isPromotionalContent(text)) {
            contentElements.push({type: 'heading', text});
            headings.push(`${h.tagName.toUpperCase()}: ${text}`);
          }
        });
      }
    }
    
    // Sort content elements by their position in the document if we have very few elements
    if (contentElements.length < 5) {
      console.log('Few content elements found, trying to extract more content');
      // Try to extract more content from the document
      const body = doc.querySelector('body');
      if (body) {
        // Look for text in divs that might contain content
        const divs = body.querySelectorAll('div');
        divs.forEach(div => {
          // Skip divs that are likely navigation, footer, etc.
          if (isNonContentElement(div)) return;
          
          // Get direct text content
          let directText = '';
          for (const childNode of Array.from(div.childNodes)) {
            if (childNode.nodeType === Node.TEXT_NODE) {
              directText += childNode.textContent || '';
            }
          }
          directText = directText.trim();
          
          // Add meaningful text
          if (isMeaningfulText(directText) && !isPromotionalContent(directText) && directText.length > 50) {
            contentElements.push({type: 'paragraph', text: directText});
          }
        });
      }
    }
    
    // Format the content in a natural flow
    let formattedContent = `${title}\n\n`;
    
    // Add content elements in the order they appear
    contentElements.forEach(element => {
      switch (element.type) {
        case 'heading':
          formattedContent += `${element.text}\n\n`;
          break;
        case 'paragraph':
        case 'text':
          formattedContent += `${element.text}\n\n`;
          break;
        case 'list-item':
          formattedContent += `${element.text}\n`;
          break;
        case 'table-row':
          formattedContent += `${element.text}\n`;
          break;
        case 'quote':
          formattedContent += `${element.text}\n\n`;
          break;
      }
    });
    
    // Count words and paragraphs
    const paragraphCount = contentElements.filter(el => el.type === 'paragraph').length;
    const wordCount = formattedContent.split(/\s+/).filter(Boolean).length;
    
    // If we still have very little content, try a last-resort approach
    if (wordCount < 50) {
      console.log('Very little content extracted, using last-resort approach');
      // Just get all visible text from the body
      const body = doc.querySelector('body');
      if (body) {
        const allText = body.textContent || '';
        // Split by newlines and filter out empty lines and promotional content
        const lines = allText.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .filter(line => !isPromotionalContent(line));
        
        // Rebuild the content
        formattedContent = `${title}\n\n${lines.join('\n\n')}`;
      }
    }
    
    return {
      text: formattedContent,
      title,
      metadata: {
        url,
        headings,
        wordCount,
        paragraphCount
      }
    };
  } catch (error) {
    console.error('Error scraping website:', error);
    throw new Error(`Failed to scrape website: ${error.message}`);
  }
} 