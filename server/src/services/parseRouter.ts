import type { DocumentType, ParseStrategy } from '../types/url-parsing';

export function routeToParser(documentType: DocumentType, mimeType: string): ParseStrategy {
  if (mimeType === 'application/pdf') {
    return documentType === 'scanned_pdf' ? 'pdf_ocr' : 'pdf_digital';
  }
  if (mimeType === 'text/html') {
    return documentType === 'html_dynamic' ? 'javascript' : 'html';
  }
  throw new Error(`Unsupported document type: ${documentType} (${mimeType})`);
}


