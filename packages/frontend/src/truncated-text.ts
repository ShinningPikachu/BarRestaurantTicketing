/**
 * Creates a text element that truncates long text with ellipsis
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
  const el = document.createElement('span');
  if (className) el.className = className;
  
  if (text.length > maxLength) {
    el.textContent = text.slice(0, maxLength) + '…';
    el.title = text; // Show full text on hover
  } else {
    el.textContent = text;
  }
  
  return el;
}
