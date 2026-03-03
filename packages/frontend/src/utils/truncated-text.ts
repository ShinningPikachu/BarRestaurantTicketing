/**
 * Create a text element that truncates long text with ellipsis
 * @param text - The text to display
 * @param maxLength - Maximum number of characters before truncation (default: 20)
 * @param className - Optional CSS class to apply
 * @returns HTMLElement with optionally truncated text
 */
export function createTruncatedText(
  text: string,
  maxLength: number = 20,
  className?: string
): HTMLElement {
  const element = document.createElement('span');
  if (className) element.className = className;
  
  if (text.length > maxLength) {
    element.textContent = text.slice(0, maxLength) + '…';
    element.title = text; // Show full text on hover
  } else {
    element.textContent = text;
  }
  
  return element;
}
