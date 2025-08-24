/**
 * SerpAPI Location Matching Service
 *
 * Matches user-provided locations with SerpAPI's official locations API
 * to ensure accurate geographic targeting for job searches.
 * Enhanced with filtering capabilities to prioritise cities and improve performance.
 */

interface SerpAPILocation {
  id: string;
  google_id: number;
  google_parent_id: number;
  name: string;
  canonical_name: string;
  country_code: string;
  target_type: string;
  reach: number;
  gps?: [number, number];
}

interface LocationFilterOptions {
  minPopulation?: number;
  targetTypes?: string[]; // ['City', 'Region', 'Country']
  maxResults?: number;
  preferBusinessCentres?: boolean;
  proximityTo?: { lat: number; lng: number; radiusKm: number };
  prioritiseCities?: boolean; // Always prioritise cities over other location types
}

interface LocationMatch {
  location: SerpAPILocation;
  confidence: number;
  matchType: "exact" | "partial" | "fuzzy";
}

let locationsCache: SerpAPILocation[] | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Filtered cache for cities only
let citiesCache: SerpAPILocation[] | null = null;
let citiesCacheExpiry: number = 0;

/**
 * Searches for locations using SerpAPI's search endpoint
 */
async function searchSerpAPILocations(
  query: string,
  limit: number = 10
): Promise<SerpAPILocation[]> {
  try {
    console.log(`🔍 Searching SerpAPI locations for: "${query}"`);
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://serpapi.com/locations.json?q=${encodedQuery}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to search locations: ${response.status}`);
    }

    const locations: SerpAPILocation[] = await response.json();
    console.log(`✅ Found ${locations.length} location matches for "${query}"`);

    return locations;
  } catch (error) {
    console.error("❌ Failed to search SerpAPI locations:", error);
    throw new Error("Unable to search location data");
  }
}

// Simple cache for search results to avoid repeated API calls for same queries
const searchCache = new Map<
  string,
  { results: SerpAPILocation[]; expiry: number }
>();
const SEARCH_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for search results

/**
 * Gets locations with search-based caching
 */
async function getLocationsBySearch(
  query: string,
  limit: number = 10
): Promise<SerpAPILocation[]> {
  const cacheKey = `${query.toLowerCase()}:${limit}`;
  const now = Date.now();

  // Check cache first
  const cached = searchCache.get(cacheKey);
  if (cached && now < cached.expiry) {
    console.log(`📋 Using cached results for "${query}"`);
    return cached.results;
  }

  // Fetch new results
  const results = await searchSerpAPILocations(query, limit);

  // Cache the results
  searchCache.set(cacheKey, {
    results,
    expiry: now + SEARCH_CACHE_DURATION,
  });

  return results;
}

/**
 * Filters locations based on provided options
 */
function filterLocations(
  locations: SerpAPILocation[],
  options: LocationFilterOptions = {}
): SerpAPILocation[] {
  let filtered = [...locations];

  // Filter by target types
  if (options.targetTypes && options.targetTypes.length > 0) {
    const targetTypesLower = options.targetTypes.map((t) => t.toLowerCase());
    filtered = filtered.filter((loc) =>
      targetTypesLower.includes(loc.target_type.toLowerCase())
    );
  }

  // Filter by minimum population (using reach as a proxy)
  if (options.minPopulation) {
    filtered = filtered.filter((loc) => loc.reach >= options.minPopulation!);
  }

  // Filter by proximity if GPS coordinates are provided
  if (options.proximityTo && options.proximityTo.radiusKm) {
    const { lat, lng, radiusKm } = options.proximityTo;
    filtered = filtered.filter((loc) => {
      if (!loc.gps) return false;
      const distance = calculateDistance(lat, lng, loc.gps[0], loc.gps[1]);
      return distance <= radiusKm;
    });
  }

  // Sort by preference for business centres (higher reach = more business activity)
  if (options.preferBusinessCentres) {
    filtered.sort((a, b) => b.reach - a.reach);
  }

  // Prioritise cities over other location types
  if (options.prioritiseCities) {
    filtered.sort((a, b) => {
      const aIsCity = a.target_type.toLowerCase() === "city";
      const bIsCity = b.target_type.toLowerCase() === "city";

      if (aIsCity && !bIsCity) return -1;
      if (!aIsCity && bIsCity) return 1;

      // If both are cities or both are not cities, sort by reach
      return b.reach - a.reach;
    });
  }

  // Limit results
  if (options.maxResults) {
    filtered = filtered.slice(0, options.maxResults);
  }

  return filtered;
}

/**
 * Calculates distance between two GPS coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len1][len2]) / maxLen;
}

/**
 * Finds the best matching location using SerpAPI's search with intelligent filtering
 */
export async function findBestLocationMatch(
  locationInput: string,
  countryCode: string,
  options: LocationFilterOptions = {}
): Promise<LocationMatch | null> {
  try {
    console.log(
      `🔍 Finding best match for "${locationInput}" in ${countryCode.toUpperCase()}`
    );

    // Use SerpAPI's search to get relevant results
    const searchResults = await getLocationsBySearch(locationInput, 15);

    if (searchResults.length === 0) {
      console.warn(`⚠️ No search results found for "${locationInput}"`);
      return null;
    }

    // Filter by country code first
    let countryFilteredResults = searchResults.filter(
      (loc) => loc.country_code.toLowerCase() === countryCode.toLowerCase()
    );

    // If no results for the country, try without country filtering as fallback
    if (countryFilteredResults.length === 0) {
      console.warn(
        `⚠️ No results for country ${countryCode}, trying without country filter`
      );
      countryFilteredResults = searchResults;
    }

    // Apply additional filtering options
    let filteredResults = filterLocations(countryFilteredResults, {
      prioritiseCities: true,
      preferBusinessCentres: true,
      ...options,
    });

    if (filteredResults.length === 0) {
      console.warn(
        `⚠️ No results after filtering, using unfiltered country results`
      );
      filteredResults = countryFilteredResults;
    }

    // Find the best match using simple but effective logic
    const input = locationInput.toLowerCase().trim();

    for (const location of filteredResults) {
      const name = location.name.toLowerCase();
      const canonicalName = location.canonical_name.toLowerCase();

      // Exact match on name (highest confidence)
      if (name === input || name === input.split(",")[0].trim()) {
        console.log(
          `🎯 Exact match found: ${location.canonical_name} (${location.target_type})`
        );
        return {
          location,
          confidence: 1.0,
          matchType: "exact",
        };
      }

      // Check if the input city name matches the location name
      const inputParts = input.split(",").map((p) => p.trim());
      const firstInputPart = inputParts[0];

      if (name === firstInputPart) {
        console.log(
          `🎯 City name match found: ${location.canonical_name} (${location.target_type})`
        );
        return {
          location,
          confidence: 0.95,
          matchType: "exact",
        };
      }

      // Partial match in canonical name
      if (canonicalName.includes(firstInputPart)) {
        const confidence = Math.min(0.9, firstInputPart.length / name.length);
        console.log(
          `✅ Partial match found: ${location.canonical_name} (${location.target_type}, ${(confidence * 100).toFixed(1)}%)`
        );
        return {
          location,
          confidence,
          matchType: "partial",
        };
      }
    }

    // If we have results but no good matches, take the first city result as fallback
    const firstCity = filteredResults.find(
      (loc) => loc.target_type.toLowerCase() === "city"
    );

    if (firstCity) {
      console.log(
        `🔄 Using first city result as fallback: ${firstCity.canonical_name}`
      );
      return {
        location: firstCity,
        confidence: 0.7,
        matchType: "fuzzy",
      };
    }

    // Last resort: take the first result
    if (filteredResults.length > 0) {
      const firstResult = filteredResults[0];
      console.log(
        `🔄 Using first result as last resort: ${firstResult.canonical_name} (${firstResult.target_type})`
      );
      return {
        location: firstResult,
        confidence: 0.6,
        matchType: "fuzzy",
      };
    }

    console.warn(
      `⚠️ No enhanced location match found for "${locationInput}" in ${countryCode}, using original`
    );
    return null;
  } catch (error) {
    console.error("❌ Location matching failed:", error);
    return null;
  }
}

/**
 * Gets multiple location suggestions using SerpAPI search
 */
export async function getLocationSuggestions(
  locationInput: string,
  countryCode: string,
  limit: number = 5,
  options: LocationFilterOptions = {}
): Promise<LocationMatch[]> {
  try {
    console.log(
      `🔍 Getting ${limit} suggestions for "${locationInput}" in ${countryCode.toUpperCase()}`
    );

    // Use SerpAPI search to get relevant results
    const searchResults = await getLocationsBySearch(locationInput, limit * 2);

    if (searchResults.length === 0) {
      console.warn(`⚠️ No suggestions found for "${locationInput}"`);
      return [];
    }

    // Filter by country code
    let countryFilteredResults = searchResults.filter(
      (loc) => loc.country_code.toLowerCase() === countryCode.toLowerCase()
    );

    // If no results for the country, try without country filtering
    if (countryFilteredResults.length === 0) {
      countryFilteredResults = searchResults;
    }

    // Apply filtering and prioritisation
    const filteredResults = filterLocations(countryFilteredResults, {
      prioritiseCities: true,
      preferBusinessCentres: true,
      ...options,
    });

    const input = locationInput.toLowerCase().trim();
    const suggestions: LocationMatch[] = [];

    for (const location of filteredResults) {
      const name = location.name.toLowerCase();
      const canonicalName = location.canonical_name.toLowerCase();
      const inputParts = input.split(",").map((p) => p.trim());
      const firstInputPart = inputParts[0];

      let confidence = 0;
      let matchType: "exact" | "partial" | "fuzzy" = "fuzzy";

      // Exact matches
      if (name === input || name === firstInputPart) {
        confidence = 1.0;
        matchType = "exact";
      }
      // Partial matches
      else if (
        canonicalName.includes(firstInputPart) ||
        name.includes(firstInputPart)
      ) {
        confidence = 0.8;
        matchType = "partial";
      }
      // Fuzzy matches using similarity
      else {
        const nameScore = calculateSimilarity(name, firstInputPart);
        if (nameScore > 0.6) {
          confidence = nameScore * 0.7; // Scale down fuzzy matches
          matchType = "fuzzy";
        }
      }

      if (confidence > 0.5) {
        suggestions.push({
          location,
          confidence,
          matchType,
        });
      }
    }

    // Sort by confidence, then by city preference, then by reach
    const sortedSuggestions = suggestions
      .sort((a, b) => {
        // First by confidence
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        // Then prioritise cities
        const aIsCity = a.location.target_type.toLowerCase() === "city";
        const bIsCity = b.location.target_type.toLowerCase() === "city";
        if (aIsCity && !bIsCity) return -1;
        if (!aIsCity && bIsCity) return 1;
        // Finally by reach (business activity)
        return b.location.reach - a.location.reach;
      })
      .slice(0, limit);

    console.log(
      `✅ Found ${sortedSuggestions.length} suggestions for "${locationInput}"`
    );

    return sortedSuggestions;
  } catch (error) {
    console.error("❌ Failed to get location suggestions:", error);
    return [];
  }
}

/**
 * Validates if a location exists in SerpAPI's database, prioritising cities
 */
export async function validateLocation(
  locationInput: string,
  countryCode: string,
  options: LocationFilterOptions = {}
): Promise<boolean> {
  const match = await findBestLocationMatch(
    locationInput,
    countryCode,
    options
  );
  return match !== null && match.confidence > 0.7;
}

/**
 * Gets all cities for a given country code using search (useful for dropdowns/autocomplete)
 */
export async function getCitiesForCountry(
  countryCode: string,
  options: LocationFilterOptions = {}
): Promise<SerpAPILocation[]> {
  try {
    // Search for common city-related terms to get a good sample
    const citySearchTerms = ["city", "capital", "major cities", "urban areas"];
    const allResults: SerpAPILocation[] = [];

    for (const term of citySearchTerms) {
      const results = await getLocationsBySearch(term, 20);
      const countryResults = results.filter(
        (loc) =>
          loc.country_code.toLowerCase() === countryCode.toLowerCase() &&
          loc.target_type.toLowerCase() === "city"
      );
      allResults.push(...countryResults);
    }

    // Remove duplicates based on google_id
    const uniqueResults = allResults.filter(
      (location, index, self) =>
        index === self.findIndex((l) => l.google_id === location.google_id)
    );

    return filterLocations(uniqueResults, {
      preferBusinessCentres: true,
      targetTypes: ["City"],
      ...options,
    });
  } catch (error) {
    console.error("❌ Failed to get cities for country:", error);
    return [];
  }
}

/**
 * Clears the search cache (useful for testing or forced refresh)
 */
export function clearLocationCache(): void {
  searchCache.clear();
  console.log("🧹 Location search cache cleared");
}
