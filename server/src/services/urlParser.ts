import type { ParseStrategy, DocumentType, SourceType, ParseResult } from '../types/url-parsing';

export class UrlParser {
  /**
   * Detect the document type and determine parsing strategy
   */
  async detectDocumentType(url: string): Promise<{ 
    sourceType: SourceType; 
    documentType: DocumentType; 
    strategy: ParseStrategy 
  }> {
    try {
      // Fetch headers to determine content type
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/pdf')) {
        // PDF document - determine if digital or scanned by attempting text extraction
        return {
          sourceType: 'pdf',
          documentType: 'digital_pdf', // Default to digital, will be updated if OCR needed
          strategy: 'pdf_digital'
        };
      }
      
      if (contentType.includes('text/html')) {
        // HTML document - check for JavaScript frameworks
        const htmlResponse = await fetch(url);
        const html = await htmlResponse.text();
        
        // Check for common SPA indicators
        const hasSpaIndicators = this.detectSpaFramework(html);
        
        return {
          sourceType: 'html',
          documentType: hasSpaIndicators ? 'html_dynamic' : 'html_static',
          strategy: hasSpaIndicators ? 'javascript' : 'html'
        };
      }
      
      // Default to HTML parsing for unknown content types
      return {
        sourceType: 'html',
        documentType: 'html_static',
        strategy: 'html'
      };
    } catch (error) {
      console.error('Error detecting document type:', error);
      // Fallback to HTML parsing
      return {
        sourceType: 'html',
        documentType: 'html_static',
        strategy: 'html'
      };
    }
  }
  
  /**
   * Main parsing orchestrator
   */
  async parseUrl(url: string, strategy: ParseStrategy): Promise<ParseResult> {
    try {
      switch (strategy) {
        case 'html':
          const { parseHtmlMenu } = await import('./parsers/htmlParser');
          return await parseHtmlMenu(url);
          
        case 'pdf_digital':
          try {
            const { parseDigitalPdf } = await import('./parsers/pdfParser');
            return await parseDigitalPdf(url);
          } catch (importError) {
            console.warn('PDF parser not implemented, falling back to error response');
            return {
              success: false,
              menuItems: [],
              categories: [],
              parseMethod: strategy,
              confidence: 0,
              errorMessage: 'PDF parsing not yet implemented'
            };
          }
          
        case 'pdf_ocr':
          try {
            const { parseScannedPdf } = await import('./parsers/pdfParser');
            return await parseScannedPdf(url);
          } catch (importError) {
            console.warn('PDF OCR parser not implemented, falling back to error response');
            return {
              success: false,
              menuItems: [],
              categories: [],
              parseMethod: strategy,
              confidence: 0,
              errorMessage: 'PDF OCR parsing not yet implemented'
            };
          }
          
        case 'javascript':
          try {
            const { parseJavaScriptMenu } = await import('./parsers/jsParser');
            return await parseJavaScriptMenu(url);
          } catch (importError) {
            console.warn('JavaScript parser not implemented, falling back to error response');
            return {
              success: false,
              menuItems: [],
              categories: [],
              parseMethod: strategy,
              confidence: 0,
              errorMessage: 'JavaScript parsing not yet implemented'
            };
          }
          
        default:
          throw new Error(`Unsupported parsing strategy: ${strategy}`);
      }
    } catch (error) {
      console.error(`Error parsing URL with strategy ${strategy}:`, error);
      return {
        success: false,
        menuItems: [],
        categories: [],
        parseMethod: strategy,
        confidence: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown parsing error'
      };
    }
  }
  
  /**
   * Validate restaurant URL
   */
  async validateRestaurantUrl(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      
      // Basic URL validation
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      
      // Try to fetch the URL to ensure it's accessible
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('URL validation error:', error);
      return false;
    }
  }
  
  /**
   * Detect if HTML contains SPA framework indicators
   */
  private detectSpaFramework(html: string): boolean {
    const spaIndicators = [
      // React
      'react',
      'React.createElement',
      'ReactDOM.render',
      
      // Vue
      'vue',
      'Vue.createApp',
      'v-if',
      'v-for',
      
      // Angular
      'angular',
      'ng-app',
      'ng-controller',
      '[ng',
      
      // Next.js
      'next/head',
      '__NEXT_DATA__',
      
      // General SPA indicators
      'single-page',
      'spa',
      'app.js',
      'bundle.js',
      'main.js',
      
      // Menu-specific dynamic content indicators
      'menu-loader',
      'loading-menu',
      'dynamic-menu'
    ];
    
    const lowerHtml = html.toLowerCase();
    return spaIndicators.some(indicator => lowerHtml.includes(indicator.toLowerCase()));
  }
}

export const urlParser = new UrlParser();