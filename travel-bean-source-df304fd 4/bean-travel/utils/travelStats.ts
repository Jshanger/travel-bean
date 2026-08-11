import { WORLD_COUNTRIES } from '@/constants/worldCountries';
import { VisitedPlace } from '@/types';

export interface CountryVisitStat {
  country: string;
  cities: string[];
  placeCount: number;
}

export function getTravelStats(places: VisitedPlace[]) {
  const countries = [...new Set(places.map(p => p.country).filter(Boolean))].sort();
  const cities = [...new Set(places.flatMap(p => {
    if (p.category === 'city') return [p.name];
    return p.city ? [p.city] : [];
  }).filter(Boolean))].sort();

  const byCountry = countries.map(country => {
    const countryPlaces = places.filter(p => p.country === country);
    const countryCities = [...new Set(countryPlaces.flatMap(p => {
      if (p.category === 'city') return [p.name];
      return p.city ? [p.city] : [];
    }).filter(Boolean))].sort();

    return {
      country,
      cities: countryCities,
      placeCount: countryPlaces.length,
    };
  });

  return {
    countries,
    cities,
    byCountry,
    countryCount: countries.length,
    cityCount: cities.length,
    placeCount: places.length,
    totalCountries: WORLD_COUNTRIES.length,
    countryPercent: Math.round((countries.length / WORLD_COUNTRIES.length) * 1000) / 10,
  };
}
