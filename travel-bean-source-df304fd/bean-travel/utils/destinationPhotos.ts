const DEFAULT_TRAVEL_PHOTOS = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80',
];

const COUNTRY_PHOTOS: Record<string, string[]> = {
  Barbados: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Brandons_Beach%2C_Barbados_%28Unsplash%29.jpg/1365px-Brandons_Beach%2C_Barbados_%28Unsplash%29.jpg',
    'https://images.unsplash.com/photo-1641836449210-5cf8b63131ba?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1570736229422-cfc453fb1667?auto=format&fit=crop&w=900&q=80',
  ],
  Brazil: [
    'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=900&q=80',
  ],
  Canada: [
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  ],
  France: [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80',
  ],
  Greece: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  ],
  Iceland: [
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80',
  ],
  Indonesia: [
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=900&q=80',
  ],
  Italy: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80',
  ],
  Japan: [
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=900&q=80',
  ],
  Mexico: [
    'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=900&q=80',
  ],
  Morocco: [
    'https://images.unsplash.com/photo-1547473898-39cbd3a1047f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=900&q=80',
  ],
  'New Zealand': [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
  ],
  Portugal: [
    'https://images.unsplash.com/photo-1601399470081-29ab3942fd8b?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1508050919630-b135583b29ab?auto=format&fit=crop&w=900&q=80',
  ],
  'South Africa': [
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=900&q=80',
  ],
  'South Korea': [
    'https://upload.wikimedia.org/wikipedia/commons/7/79/Streets_of_Seoul_%28Unsplash%29.jpg',
    'https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=900&q=80',
  ],
  Turkey: [
    'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=80',
  ],
  Vietnam: [
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=900&q=80',
  ],
};

function searchedPlacePhoto(country: string) {
  const query = encodeURIComponent(`${country} travel landmark`);
  return `https://source.unsplash.com/900x600/?${query}`;
}

export function getCuratedDreamBeanCountries() {
  return Object.keys(COUNTRY_PHOTOS);
}

export function hasCuratedCountryPhoto(country?: string) {
  return Boolean(country && COUNTRY_PHOTOS[country]?.length);
}

export function getCountryPhotoCandidates(country?: string, primary?: string | null) {
  const photos = [
    ...(primary ? [primary] : []),
    ...(country ? COUNTRY_PHOTOS[country] ?? [] : []),
    ...(country && !COUNTRY_PHOTOS[country]?.length ? [searchedPlacePhoto(country)] : []),
    ...DEFAULT_TRAVEL_PHOTOS,
  ];
  return photos.filter((url, index) => photos.indexOf(url) === index);
}

export function getCountryHeroPhoto(country?: string) {
  return getCountryPhotoCandidates(country)[0];
}
