import type { ParseResult } from '../../types/url-parsing';

/**
 * Parse digital PDF menu (text-extractable PDFs)
 * TODO: Implement PDF parsing using pdf-parse or similar library
 */
export async function parseDigitalPdf(url: string): Promise<ParseResult> {
  console.warn('PDF parsing not yet implemented');
  return {
    success: false,
    menuItems: [],
    categories: [],
    parseMethod: 'pdf_digital',
    confidence: 0,
    errorMessage: 'PDF parsing functionality not yet implemented. Please use HTML or add PDF parsing library.'
  };
}

/**
 * Parse scanned PDF menu using OCR
 * TODO: Implement OCR parsing using Tesseract.js or cloud OCR service
 */
export async function parseScannedPdf(url: string): Promise<ParseResult> {
  console.warn('PDF OCR parsing not yet implemented');
  return {
    success: false,
    menuItems: [],
    categories: [],
    parseMethod: 'pdf_ocr',
    confidence: 0,
    errorMessage: 'PDF OCR parsing functionality not yet implemented. Please use HTML or add OCR capability.'
  };
}