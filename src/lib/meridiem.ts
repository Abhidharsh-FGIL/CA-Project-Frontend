/** "9:50 pm" → "9:50 PM": the en-IN locale prints the am/pm marker in lower case. */
export const upperMeridiem = (s: string): string => s.replace(/\b(am|pm)\b/gi, m => m.toUpperCase());
