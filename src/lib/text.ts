/**
 * Cuts text to at most `max` characters without splitting an emoji or other
 * character in half. A half character (a lone surrogate) makes the request
 * invalid JSON for the Anthropic API, which rejects it with a 400.
 */
export function clip(text: string, max: number): string {
  const chars = Array.from(text);
  const out = chars.length > max ? chars.slice(0, max).join("") : text;
  // Drop any lone surrogates already in the source text.
  return out.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}
