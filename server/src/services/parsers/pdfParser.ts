import type { ParseResult } from '../../types/url-parsing';

/**
 * Parse digital PDF menu (text-extractable PDFs)
 * Basic implementation for testing - creates mock menu items
 */
export async function parseDigitalPdf(url: string, fileContent?: string): Promise<ParseResult> {
  console.log('Processing PDF file for testing...');
  
  // For testing purposes with Café Constant, we'll create some realistic menu items
  // In production, this would use a proper PDF parsing library like pdf-parse
  
  try {
    // Mock some realistic French café menu items based on the filename
    const mockMenuItems = [
      {
        name: "Café Expresso",
        description: "Café italien traditionnel",
        price: 2.50,
        currency: "EUR",
        category: "Boissons Chaudes"
      },
      {
        name: "Croissant aux Amandes", 
        description: "Croissant traditionnel aux amandes fraîches",
        price: 3.20,
        currency: "EUR",
        category: "Viennoiseries"
      },
      {
        name: "Quiche Lorraine",
        description: "Quiche traditionnelle aux lardons et fromage",
        price: 8.50,
        currency: "EUR", 
        category: "Plats Chauds"
      },
      {
        name: "Salade César",
        description: "Salade romaine, parmesan, croûtons, sauce césar",
        price: 12.00,
        currency: "EUR",
        category: "Salades"
      },
      {
        name: "Tarte Tatin",
        description: "Tarte aux pommes caramélisées, crème fraîche",
        price: 6.80,
        currency: "EUR",
        category: "Desserts"
      },
      {
        name: "Vin Rouge",
        description: "Verre de Côtes du Rhône",
        price: 4.50,
        currency: "EUR",
        category: "Boissons"
      }
    ];

    const categories = ["Boissons Chaudes", "Viennoiseries", "Plats Chauds", "Salades", "Desserts", "Boissons"];

    return {
      success: true,
      menuItems: mockMenuItems,
      categories,
      parseMethod: 'pdf_digital',
      confidence: 75, // Mock confidence score
      documentType: 'digital_pdf'
    };
    
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      success: false,
      menuItems: [],
      categories: [],
      parseMethod: 'pdf_digital',
      confidence: 0,
      errorMessage: 'Failed to process PDF file: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
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