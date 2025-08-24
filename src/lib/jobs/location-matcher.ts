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
 * Fetches the latest locations from SerpAPI
 */
async function fetchSerpAPILocations(): Promise<SerpAPILocation[]> {
  try {
    console.log("🌍 Fetching SerpAPI locations...");
    const response = await fetch("https://serpapi.com/locations.json");

    if (!response.ok) {
      throw new Error(`Failed to fetch locations: ${response.status}`);
    }

    const locations: SerpAPILocation[] = await response.json();
    console.log(`✅ Fetched ${locations.length} locations from SerpAPI`);

    return locations;
  } catch (error) {
    console.error("❌ Failed to fetch SerpAPI locations:", error);
    throw new Error("Unable to fetch location data");
  }
}

/**
 * Gets locations with caching
 */
async function getLocations(): Promise<SerpAPILocation[]> {
  const now = Date.now();

  if (locationsCache && now < cacheExpiry) {
    return locationsCache;
  }

  locationsCache = await fetchSerpAPILocations();
  cacheExpiry = now + CACHE_DURATION;

  return locationsCache;
}

/**
 * Gets cities only with separate caching for better performance
 */
async function getCities(countryCode?: string): Promise<SerpAPILocation[]> {
  const now = Date.now();

  if (citiesCache && now < citiesCacheExpiry) {
    return countryCode
      ? citiesCache.filter(
          (loc) => loc.country_code.toLowerCase() === countryCode.toLowerCase()
        )
      : citiesCache;
  }

  const allLocations = await getLocations();
  citiesCache = allLocations.filter(
    (loc) => loc.target_type.toLowerCase() === "city"
  );
  citiesCacheExpiry = now + CACHE_DURATION;

  console.log(
    `🏙️ Cached ${citiesCache.length} cities from ${allLocations.length} total locations`
  );

  return countryCode
    ? citiesCache.filter(
        (loc) => loc.country_code.toLowerCase() === countryCode.toLowerCase()
      )
    : citiesCache;
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
 * Finds the best matching location for a given input with enhanced filtering
 * Always prioritises cities as the target type
 */
export async function findBestLocationMatch(
  locationInput: string,
  countryCode: string,
  options: LocationFilterOptions = {}
): Promise<LocationMatch | null> {
  try {
    // Always prioritise cities and set default options
    const filterOptions: LocationFilterOptions = {
      prioritiseCities: true,
      preferBusinessCentres: true,
      ...options,
    };

    // First, try to find matches in cities only for better accuracy
    let locations = await getCities(countryCode);

    if (locations.length === 0) {
      console.warn(
        `⚠️ No cities found for country code: ${countryCode}, falling back to all locations`
      );
      const allLocations = await getLocations();
      locations = allLocations.filter(
        (loc) => loc.country_code.toLowerCase() === countryCode.toLowerCase()
      );
    }

    // Apply filtering
    locations = filterLocations(locations, filterOptions);

    if (locations.length === 0) {
      console.warn(
        `⚠️ No locations found after filtering for country code: ${countryCode}`
      );
      return null;
    }

    console.log(
      `🔍 Searching ${locations.length} filtered locations in ${countryCode.toUpperCase()}`
    );

    const input = locationInput.toLowerCase().trim();
    let bestMatch: SerpAPILocation | null = null;
    let bestScore = 0;
    let matchType: "exact" | "partial" | "fuzzy" = "fuzzy";

    for (const location of locations) {
      const name = location.name.toLowerCase();
      const canonicalName = location.canonical_name.toLowerCase();

      // Exact match on name (highest priority)
      if (name === input) {
        console.log(
          `🎯 Exact match found: ${location.canonical_name} (${location.target_type})`
        );
        return {
          location,
          confidence: 1.0,
          matchType: "exact",
        };
      }

      // Exact match on canonical name
      if (canonicalName.includes(input)) {
        const score = input.length / canonicalName.length;
        if (score > bestScore) {
          bestMatch = location;
          bestScore = score;
          matchType = "partial";
        }
      }

      // Fuzzy matching on name
      const nameScore = calculateSimilarity(name, input);
      if (nameScore > bestScore && nameScore > 0.6) {
        bestMatch = location;
        bestScore = nameScore;
        matchType = nameScore > 0.9 ? "partial" : "fuzzy";
      }

      // Fuzzy matching on canonical name parts
      const canonicalParts = canonicalName.split(",").map((p) => p.trim());
      for (const part of canonicalParts) {
        const partScore = calculateSimilarity(part, input);
        if (partScore > bestScore && partScore > 0.7) {
          bestMatch = location;
          bestScore = partScore;
          matchType = partScore > 0.9 ? "partial" : "fuzzy";
        }
      }
    }

    if (bestMatch && bestScore > 0.6) {
      console.log(
        `✅ Best match: ${bestMatch.canonical_name} (${bestMatch.target_type}, ${matchType}, ${(bestScore * 100).toFixed(1)}%)`
      );
      return {
        location: bestMatch,
        confidence: bestScore,
        matchType,
      };
    }

    console.warn(
      `⚠️ No good match found for "${locationInput}" in ${countryCode}`
    );
    return null;
  } catch (error) {
    console.error("❌ Location matching failed:", error);
    return null;
  }
}

/**
 * Gets multiple location suggestions for a given input with enhanced filtering
 */
export async function getLocationSuggestions(
  locationInput: string,
  countryCode: string,
  limit: number = 5,
  options: LocationFilterOptions = {}
): Promise<LocationMatch[]> {
  try {
    // Always prioritise cities for suggestions
    const filterOptions: LocationFilterOptions = {
      prioritiseCities: true,
      preferBusinessCentres: true,
      maxResults: limit * 3, // Get more candidates before final filtering
      ...options,
    };

    // Prioritise cities for suggestions
    let locations = await getCities(countryCode);

    if (locations.length === 0) {
      const allLocations = await getLocations();
      locations = allLocations.filter(
        (loc) => loc.country_code.toLowerCase() === countryCode.toLowerCase()
      );
    }

    // Apply filtering
    locations = filterLocations(locations, filterOptions);

    const input = locationInput.toLowerCase().trim();
    const suggestions: LocationMatch[] = [];

    for (const location of locations) {
      const name = location.name.toLowerCase();
      const canonicalName = location.canonical_name.toLowerCase();

      let score = 0;
      let matchType: "exact" | "partial" | "fuzzy" = "fuzzy";

      // Check for matches
      if (name === input || canonicalName.includes(input)) {
        score = name === input ? 1.0 : input.length / canonicalName.length;
        matchType = name === input ? "exact" : "partial";
      } else {
        const nameScore = calculateSimilarity(name, input);
        const canonicalParts = canonicalName.split(",").map((p) => p.trim());
        const partScores = canonicalParts.map((part) =>
          calculateSimilarity(part, input)
        );
        score = Math.max(nameScore, ...partScores);
        matchType = score > 0.9 ? "partial" : "fuzzy";
      }

      if (score > 0.5) {
        suggestions.push({
          location,
          confidence: score,
          matchType,
        });
      }
    }

    // Sort by confidence and return top results
    return suggestions
      .sort((a, b) => {
        // First sort by confidence
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
 * Gets all cities for a given country code (useful for dropdowns/autocomplete)
 */
export async function getCitiesForCountry(
  countryCode: string,
  options: LocationFilterOptions = {}
): Promise<SerpAPILocation[]> {
  try {
    const cities = await getCities(countryCode);
    return filterLocations(cities, {
      preferBusinessCentres: true,
      ...options,
    });
  } catch (error) {
    console.error("❌ Failed to get cities for country:", error);
    return [];
  }
}

/**
 * Clears the location cache (useful for testing or forced refresh)
 */
export function clearLocationCache(): void {
  locationsCache = null;
  citiesCache = null;
  cacheExpiry = 0;
  citiesCacheExpiry = 0;
  console.log("🧹 Location cache cleared");
}
