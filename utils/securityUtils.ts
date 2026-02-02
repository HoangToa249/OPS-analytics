/**
 * Security Utilities
 * 
 * Sanitization, validation, and security helpers
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 * Removes all HTML/JavaScript, keeps only text
 * 
 * @param input - Raw user input
 * @returns Sanitized text
 */
export const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return '';
  
  // Remove all HTML tags, keep only text
  const cleaned = DOMPurify.sanitize(String(input), {
    ALLOWED_TAGS: [],      // No HTML tags allowed
    ALLOWED_ATTR: [],      // No attributes allowed
    KEEP_CONTENT: true,    // Keep text content
  });
  
  return cleaned.trim();
};

/**
 * Sanitize flight identifiers (callsigns, flight numbers)
 * Allows alphanumeric + common separators
 * 
 * @param flightId - Flight identifier
 * @returns Sanitized flight ID
 */
export const sanitizeFlightId = (flightId: string | null | undefined): string => {
  if (!flightId) return '';
  
  const id = String(flightId).trim();
  // Only allow: A-Z, 0-9, hyphen, space
  const cleaned = id.replace(/[^A-Z0-9\-\s]/gi, '').trim();
  
  return cleaned.substring(0, 20); // Max 20 chars
};

/**
 * Sanitize gate/stand identifiers
 * Allows alphanumeric + hyphen
 * 
 * @param gate - Gate identifier
 * @returns Sanitized gate
 */
export const sanitizeGate = (gate: string | null | undefined): string => {
  if (!gate) return 'UNASSIGNED';
  
  const g = String(gate).toUpperCase().trim();
  const cleaned = g.replace(/[^A-Z0-9\-]/g, '').trim();
  
  return cleaned || 'UNASSIGNED';
};

/**
 * Sanitize counter/checkin identifiers
 * Allows alphanumeric + hyphen
 * 
 * @param counter - Counter identifier
 * @returns Sanitized counter
 */
export const sanitizeCounter = (counter: string | null | undefined): string => {
  if (!counter) return '';
  
  const c = String(counter).toUpperCase().trim();
  const cleaned = c.replace(/[^A-Z0-9\-]/g, '').trim();
  
  return cleaned;
};

/**
 * Validate email address
 * 
 * @param email - Email to validate
 * @returns true if valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate date is not in future (past dates only)
 * 
 * @param date - Date to validate
 * @returns true if date is in past
 */
export const isPastDate = (date: Date): boolean => {
  return new Date() >= date;
};

/**
 * Safe console logging for development only
 * Never log sensitive data
 * 
 * @param context - Context string (e.g., '[Auth]')
 * @param message - Log message
 * @param data - Optional data (non-sensitive)
 */
export const safeLog = (
  context: string,
  message: string,
  data?: Record<string, any>
): void => {
  // Check if development mode
  const isDev = typeof window !== 'undefined' && (window as any).__DEV__;
  if (isDev) {
    // Only log in development
    console.debug(`${context} ${message}`, data);
  }
};

/**
 * Never log these patterns (security)
 * Check before logging
 */
export const isSensitiveData = (data: any): boolean => {
  const sensitivePatterns = [
    'password',
    'token',
    'key',
    'secret',
    'authorization',
    'auth',
    'user_id',
    'uid',
    'email',
    'phone',
    'ssn',
    'credit',
    'card',
  ];

  const dataStr = JSON.stringify(data).toLowerCase();
  return sensitivePatterns.some(pattern => dataStr.includes(pattern));
};
