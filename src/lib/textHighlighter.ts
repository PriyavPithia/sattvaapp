/**
 * Utility functions for highlighting text in non-YouTube files
 */

/**
 * Scrolls an element into view within its container without affecting the page scroll
 * @param element The element to scroll into view
 * @param container The container element
 * @param behavior The scroll behavior ('auto' or 'smooth')
 * @param block The vertical alignment ('start', 'center', 'end', or 'nearest')
 */
const scrollElementIntoViewWithinContainer = (
  element: Element,
  container: Element,
  behavior: ScrollBehavior = 'smooth',
  block: ScrollLogicalPosition = 'center'
): void => {
  if (!element || !container) return;
  
  console.log('Scrolling element into view within container:', element, container);
  
  // Get the element's position relative to the container
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  // Calculate the element's position relative to the container's scroll position
  const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
  const relativeBottom = elementRect.bottom - containerRect.top + container.scrollTop;
  
  // Calculate the target scroll position based on the block parameter
  let targetScrollTop;
  
  switch (block) {
    case 'start':
      targetScrollTop = relativeTop;
      break;
    case 'end':
      targetScrollTop = relativeBottom - containerRect.height;
      break;
    case 'center':
      targetScrollTop = relativeTop - (containerRect.height - elementRect.height) / 2;
      break;
    case 'nearest':
    default:
      // If the element is already fully visible, don't scroll
      if (relativeTop >= container.scrollTop && relativeBottom <= container.scrollTop + containerRect.height) {
        return;
      }
      // If the element is above the visible area, scroll to its top
      if (relativeTop < container.scrollTop) {
        targetScrollTop = relativeTop;
      }
      // If the element is below the visible area, scroll to its bottom
      else {
        targetScrollTop = relativeBottom - containerRect.height;
      }
      break;
  }
  
  // Ensure the target scroll position is within bounds
  targetScrollTop = Math.max(0, Math.min(targetScrollTop, container.scrollHeight - containerRect.height));
  
  console.log(`Calculated target scroll position: ${targetScrollTop}`);
  
  // Scroll the container to the target position
  if (behavior === 'smooth') {
    // Use smooth scrolling
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
  } else {
    // Use instant scrolling
    container.scrollTop = targetScrollTop;
  }
  
  console.log(`Scrolled container to position: ${targetScrollTop}`);
  
  // Double-check the scroll position after a short delay
  setTimeout(() => {
    if (Math.abs(container.scrollTop - targetScrollTop) > 10) {
      console.log(`Scroll position check failed. Current: ${container.scrollTop}, Target: ${targetScrollTop}`);
      // Try scrolling again
      container.scrollTop = targetScrollTop;
    }
  }, 100);
};

/**
 * Highlights text in a container element
 * @param textToFind The text to find and highlight
 * @param container The container element to search in
 * @param highlightClass The CSS class to apply to the highlighted text
 * @param duration The duration in milliseconds to keep the highlight (0 for permanent)
 * @returns A cleanup function to remove the highlight
 */
export const highlightTextInElement = (
  textToFind: string,
  container: Element,
  highlightClass: string = 'highlight-reference',
  duration: number = 30000 // Increased to 30 seconds
): (() => void) => {
  if (!textToFind || !container) {
    console.error('Invalid parameters for highlightTextInElement');
    return () => {};
  }

  console.log('Highlighting text in element:', textToFind);
  console.log('Container:', container);
  
  // First, remove any existing highlights
  const existingHighlights = container.querySelectorAll(`.${highlightClass}`);
  existingHighlights.forEach(highlight => {
    if (highlight.parentNode) {
      try {
        highlight.parentNode.replaceChild(
          document.createTextNode(highlight.textContent || ''),
          highlight
        );
      } catch (e) {
        console.error('Error removing existing highlight:', e);
      }
    }
  });
  
  // Create a text node walker to find all text nodes in the container
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }
  
  console.log(`Found ${textNodes.length} text nodes in container`);
  
  // Find the text in the content
  const content = container.textContent || '';
  const index = content.indexOf(textToFind);
  
  console.log(`Looking for text "${textToFind}" in content, found at index: ${index}`);
  
  if (index !== -1) {
    // Create a range to highlight the text
    const range = document.createRange();
    
    let charCount = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    
    // Find the start and end nodes/offsets
    for (const node of textNodes) {
      const nodeLength = node.textContent?.length || 0;
      
      if (!startNode && charCount + nodeLength > index) {
        startNode = node;
        startOffset = index - charCount;
        console.log(`Found start node at offset ${startOffset}:`, node.textContent);
      }
      
      if (startNode && !endNode && charCount + nodeLength >= index + textToFind.length) {
        endNode = node;
        endOffset = index + textToFind.length - charCount;
        console.log(`Found end node at offset ${endOffset}:`, node.textContent);
        break;
      }
      
      charCount += nodeLength;
    }
    
    if (startNode && endNode) {
      // Highlight the text first
      const highlightEl = document.createElement('span');
      highlightEl.className = `bg-purple-100 ${highlightClass}`;
      
      try {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        range.surroundContents(highlightEl);
        
        console.log('Successfully highlighted text:', textToFind);
        
        // Then scroll to the highlighted element
        setTimeout(() => {
          if (startNode.parentElement) {
            scrollElementIntoViewWithinContainer(highlightEl, container, 'smooth', 'center');
          }
        }, 100);
        
        // Return a cleanup function
        const cleanup = () => {
          if (highlightEl.parentNode) {
            // Replace the highlight element with its text content
            highlightEl.parentNode.replaceChild(
              document.createTextNode(highlightEl.textContent || ''),
              highlightEl
            );
          }
        };
        
        // If duration is specified, automatically remove the highlight after the duration
        if (duration > 0) {
          setTimeout(cleanup, duration);
        }
        
        return cleanup;
      } catch (e) {
        console.error('Error highlighting text in element:', e);
        
        // Fallback: just scroll to the element containing the text
        const textElements = Array.from(container.querySelectorAll('p, pre, div, span'));
        const elementWithText = textElements.find(el => el.textContent?.includes(textToFind));
        if (elementWithText) {
          console.log('Using fallback highlighting for element:', elementWithText);
          
          elementWithText.classList.add('bg-purple-100');
          elementWithText.classList.add(highlightClass);
          
          // Scroll the element into view within the container
          setTimeout(() => {
            scrollElementIntoViewWithinContainer(elementWithText, container, 'smooth', 'center');
          }, 100);
          
          // Return a cleanup function
          const cleanup = () => {
            elementWithText.classList.remove('bg-purple-100');
            elementWithText.classList.remove(highlightClass);
          };
          
          // If duration is specified, automatically remove the highlight after the duration
          if (duration > 0) {
            setTimeout(cleanup, duration);
          }
          
          return cleanup;
        }
      }
    } else {
      console.log('Could not find start or end node for highlighting');
    }
  } else {
    console.log('Text not found in element:', textToFind);
    
    // Try to find a close match
    const words = textToFind.split(/\s+/).filter(w => w.length > 3);
    if (words.length > 0) {
      // Look for the longest words as they're more likely to be unique
      words.sort((a, b) => b.length - a.length);
      console.log('Looking for significant words:', words.slice(0, 3));
      
      // Try to find a paragraph containing at least one of the significant words
      const paragraphs = Array.from(container.querySelectorAll('p, pre, div, span'));
      
      for (const word of words.slice(0, 3)) { // Try with the 3 longest words
        console.log(`Searching for word: "${word}"`);
        const paragraph = paragraphs.find(p => p.textContent?.includes(word));
        if (paragraph) {
          console.log('Found paragraph containing word:', word);
          console.log('Paragraph content:', paragraph.textContent);
          
          paragraph.classList.add('bg-purple-100');
          paragraph.classList.add(highlightClass);
          
          // Scroll the paragraph into view within the container
          setTimeout(() => {
            scrollElementIntoViewWithinContainer(paragraph, container, 'smooth', 'center');
          }, 100);
          
          // Return a cleanup function
          const cleanup = () => {
            paragraph.classList.remove('bg-purple-100');
            paragraph.classList.remove(highlightClass);
          };
          
          // If duration is specified, automatically remove the highlight after the duration
          if (duration > 0) {
            setTimeout(cleanup, duration);
          }
          
          return cleanup;
        }
      }
      
      // If we couldn't find a paragraph with any of the significant words,
      // try a more aggressive approach by looking for partial matches
      console.log('No exact word matches found, trying partial matches');
      for (const word of words.slice(0, 3)) {
        for (const paragraph of paragraphs) {
          const content = paragraph.textContent || '';
          // Check if the paragraph contains at least 60% of the characters in the word
          const matchCount = [...word].filter(char => content.includes(char)).length;
          const matchRatio = matchCount / word.length;
          
          if (matchRatio > 0.6) {
            console.log(`Found paragraph with partial match (${matchRatio.toFixed(2)}) for word: ${word}`);
            console.log('Paragraph content:', paragraph.textContent);
            
            paragraph.classList.add('bg-purple-100');
            paragraph.classList.add(highlightClass);
            
            // Scroll the paragraph into view within the container
            setTimeout(() => {
              scrollElementIntoViewWithinContainer(paragraph, container, 'smooth', 'center');
            }, 100);
            
            // Return a cleanup function
            const cleanup = () => {
              paragraph.classList.remove('bg-purple-100');
              paragraph.classList.remove(highlightClass);
            };
            
            // If duration is specified, automatically remove the highlight after the duration
            if (duration > 0) {
              setTimeout(cleanup, duration);
            }
            
            return cleanup;
          }
        }
      }
    }
    
    // If all else fails, just scroll to the first paragraph
    console.log('No matches found, scrolling to first paragraph');
    const firstParagraph = container.querySelector('p, pre, div');
    if (firstParagraph) {
      // Scroll the first paragraph into view within the container
      setTimeout(() => {
        scrollElementIntoViewWithinContainer(firstParagraph, container, 'smooth', 'start');
      }, 100);
      
      // Add a temporary highlight to the first paragraph
      firstParagraph.classList.add('bg-purple-100');
      firstParagraph.classList.add(highlightClass);
      
      // Remove the highlight after the duration
      if (duration > 0) {
        setTimeout(() => {
          firstParagraph.classList.remove('bg-purple-100');
          firstParagraph.classList.remove(highlightClass);
        }, duration);
      }
    }
    
    // Return a no-op cleanup function
    return () => {};
  }
};

/**
 * Finds the best match for a text in a container
 * @param textToFind The text to find
 * @param container The container element to search in
 * @returns The best matching element or null if no match is found
 */
export const findBestTextMatch = (textToFind: string, container: Element): Element | null => {
  if (!textToFind || !container) {
    return null;
  }
  
  // Try exact match first
  const content = container.textContent || '';
  if (content.includes(textToFind)) {
    // Find the element containing the exact text
    const elements = Array.from(container.querySelectorAll('*'));
    return elements.find(el => el.textContent?.includes(textToFind)) || null;
  }
  
  // Try to find a close match
  const words = textToFind.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0) {
    // Look for the longest words as they're more likely to be unique
    words.sort((a, b) => b.length - a.length);
    
    // Try to find a paragraph containing at least one of the significant words
    const paragraphs = Array.from(container.querySelectorAll('p, pre, div'));
    
    for (const word of words.slice(0, 3)) { // Try with the 3 longest words
      const paragraph = paragraphs.find(p => p.textContent?.includes(word));
      if (paragraph) {
        return paragraph;
      }
    }
  }
  
  return null;
}; 