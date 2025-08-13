export type BBox = [number, number, number, number];

export type GeocodeResult = {
  areaId?: string;
  bbox: BBox;
};

export type OverpassRestaurant = {
  elementType: 'node' | 'way' | 'relation';
  elementId: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  tags: Record<string, string>;
  address?: {
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
};

export type UrlCandidate = {
  url: string;
  source: 'website' | 'url' | 'contact:website' | 'contact:url' | 'google' | 'other';
  isSocial?: boolean;
};

export type ValidationResult = {
  candidateUrl: string;
  effectiveUrl?: string;
  httpStatus?: number;
  contentType?: string;
  isValid: boolean;
  isSocial?: boolean;
  errorMessage?: string;
};

export type MenuDiscoveryResult = {
  url?: string;
  method?: 'link_text' | 'header' | 'nav' | 'footer' | 'sitemap' | 'slug';
  httpStatus?: number;
  contentType?: string;
  isPdf?: boolean;
  isValid: boolean;
};

export type PipelineStats = {
  total_seen: number;
  with_osm_website: number;
  validated_website: number;
  google_fallback_success: number;
  with_menu_url: number;
};

export type PipelineOptions = {
  location: string;
  maxConcurrency?: number;
  httpTimeoutMs?: number;
};



