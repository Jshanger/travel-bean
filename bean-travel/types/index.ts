export type PlaceCategory = 'city' | 'landmark' | 'restaurant' | 'coffee_shop' | 'hotel' | 'nature' | 'hidden_spot';

export interface VisitedPlace {
  id: string;
  name: string;
  country: string;
  city?: string;
  category: PlaceCategory;
  dateVisited: string;
  notes: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  moodTags?: string[];
  promptResponses?: PromptResponse[];
  photos?: BeanPhoto[];
  selectedLayout?: string;
  selectedMood?: string;
  isPremiumLayout?: boolean;
  hasWatermark?: boolean;
  exportQuality?: 'standard' | 'hd';
  selectedQuoteText?: string | null;
  selectedQuoteAuthor?: string | null;
  quoteSourceType?: 'premium_library' | 'premium_custom' | 'none';
  quotePlacement?: 'postcard_quote' | 'scrapbook_note' | 'film_subtitle' | 'elegant_overlay' | 'none';
  isPremiumQuoteStyle?: boolean;
}

export interface PlacePhoto {
  id: string;
  placeId: string;
  objectPath: string;
  caption: string;
  createdAt: string;
}

export interface BeanPhoto {
  id: string;
  imageUrl: string;
  caption?: string;
}

export interface PromptResponse {
  id: string;
  photoId?: string;
  prompt: string;
  response: string;
}

export type BlogPrivacy = 'private' | 'public' | 'password';
export type BlogPostStatus = 'draft' | 'published';

export interface TravelBlogSettings {
  id: string;
  username: string;
  title: string;
  intro: string;
  privacy: BlogPrivacy;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostPhoto {
  id: string;
  imageUrl: string;
  caption?: string;
  included: boolean;
}

export interface BlogPost {
  id: string;
  sourcePlaceId: string;
  status: BlogPostStatus;
  privacy: BlogPrivacy;
  password?: string;
  slug: string;
  title: string;
  subtitle: string;
  opening: string;
  body: string;
  coverPhotoId?: string;
  coverImageUrl?: string;
  photos: BlogPostPhoto[];
  place: string;
  country: string;
  city?: string;
  dateVisited: string;
  category: string;
  tags: string[];
  hideExactLocation?: boolean;
  hideDate?: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export type BucketSource = 'Screenshot' | 'TikTok' | 'Instagram' | 'Xiaohongshu' | 'Google Maps' | 'Friend' | 'Article' | 'Own Idea';
export type BucketTag = 'Food' | 'Culture' | 'Nature' | 'Romantic' | 'Budget' | 'Hidden Gem' | 'Relaxing' | 'Adventure';
export type BucketStatus = 'Want to Go' | 'Maybe' | 'Must Go';

export interface BucketItem {
  id: string;
  name: string;
  location: string;
  country?: string;
  source: BucketSource;
  tags: BucketTag[];
  status: BucketStatus;
  notes: string;
  imageUrl?: string;
  imageObjectPath?: string;
  createdAt: string;
}

export type TimeBlock = 'Morning' | 'Afternoon' | 'Evening';
export type BookingStatus = 'Not Booked' | 'Booked' | 'Pending';

export interface TripComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface ItineraryItem {
  id: string;
  day: number;
  timeBlock: TimeBlock;
  title: string;
  location: string;
  travelTime: string;
  notes: string;
  bookingStatus: BookingStatus;
  budget: string;
  votes: { mustGo: number; maybe: number; skip: number };
  comments: TripComment[];
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellers: string[];
  itinerary: ItineraryItem[];
  shareId: string;
  createdAt: string;
}
