// Types for URL-based menu parsing functionality

export interface UrlUploadData {
  url: string;
  restaurant: {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    restaurantType?: string;
    cuisines?: string[];
    phoneNumber?: string;
    description?: string;
  };
}

export interface ParsedMenuItem {
  name: string;
  description?: string;
  price: number;
  currency: string;
  category?: string;
  prominence?: MenuItemProminence;
}

export interface MenuItemProminence {
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  hasSpecialIcon?: boolean;
  iconType?: 'chef_special' | 'customer_favorite' | 'new' | 'spicy' | 'vegetarian' | 'gluten_free' | string;
  hasVisualBox?: boolean;
  isHighlighted?: boolean;
  position?: { x: number; y: number };
  confidenceScore?: number; // 0-100 confidence in prominence detection
}

export interface ParseResult {
  success: boolean;
  menuItems: ParsedMenuItem[];
  categories: string[];
  parseMethod: string;
  confidence: number;
  errorMessage?: string;
  documentType?: string;
}

export interface ParseJob {
  id: string;
  restaurantMenuSourceId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
}

export type ParseStrategy = 'html' | 'pdf_digital' | 'pdf_ocr' | 'javascript';
export type DocumentType = 'digital_pdf' | 'scanned_pdf' | 'html_static' | 'html_dynamic';
export type SourceType = 'pdf' | 'html' | 'js';

export interface ParsedMenuData {
  items: ParsedMenuItem[];
  categories: { name: string; items: string[] }[];
  metadata: {
    parseMethod: ParseStrategy;
    documentType: DocumentType;
    confidence: number;
    processingTime: number;
    itemCount: number;
  };
}

export interface RestaurantMenuSourceData {
  id: string;
  restaurantId: string;
  url: string;
  sourceType: SourceType;
  documentType?: DocumentType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  parseMethod?: ParseStrategy;
  confidence?: number;
  errorMessage?: string;
  lastAttemptedAt?: Date;
  successfullyParsedAt?: Date;
}