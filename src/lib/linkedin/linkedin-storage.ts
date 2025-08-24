import { convex } from "../core/convex";
import { generateEmbedding, prepareTextForEmbedding } from "../core/embeddings";
import type {
  LinkedInSearchParams,
  LinkedInSearchResult,
  StructuredLinkedInProfile,
} from "./linkedin";

/**
 * Service for storing and retrieving LinkedIn profile data with embeddings
 */

export interface StoredLinkedInSearch {
  _id: string;
  jobTitle: string;
  userLocation: string;
  numResults: number;
  data: any;
  status?: "pending" | "complete" | "failed";
  expiresAt?: number;
  userId?: string;
  model?: string;
  responseTime?: number;
  costDollars?: number;
  createdAt: number;
  updatedAt: number;
  isStale?: boolean; // Added by findExistingLinkedInSearch
}

export interface StoredLinkedInProfile {
  _id: string;
  // Exa API structured fields
  exaId: string;
  title: string;
  url: string;
  publishedDate?: string;
  author: string;
  image?: string;
  text?: string;

  // Profile data
  aiData: StructuredLinkedInProfile;
  isProcessed?: boolean;
  rawData?: any;
  embedding?: number[];
  embeddingText?: string;
  userId?: string;
  searchId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Create a pending LinkedIn search entry
 */
export async function createPendingLinkedInSearch(
  params: LinkedInSearchParams,
  options: {
    userId?: string;
  } = {}
): Promise<string> {
  try {
    console.log("Creating pending LinkedIn search with params:", {
      params,
      options,
    });

    const searchId = await convex.mutation(
      "functions:createPendingLinkedInSearch" as any,
      {
        jobTitle: params.jobTitle,
        userLocation: params.userLocation,
        numResults: params.numResults,
        userId: options.userId,
      }
    );

    console.log("Created pending LinkedIn search with ID:", searchId);
    return searchId;
  } catch (error) {
    console.error("Failed to create pending LinkedIn search:", error);
    throw new Error("Failed to create pending LinkedIn search");
  }
}

/**
 * Update LinkedIn search with results
 */
export async function updateLinkedInSearchResults(
  searchId: string,
  result: LinkedInSearchResult,
  options: {
    userId?: string;
    model?: string;
    responseTime?: number;
    costDollars?: number;
  } = {}
): Promise<void> {
  try {
    // Update in Convex
    await convex.mutation("functions:updateLinkedInSearchResults" as any, {
      id: searchId as any,
      data: result,
      status: "complete" as const,
      ...options,
    });
  } catch (error) {
    console.error("Failed to update LinkedIn search results:", error);
    throw new Error("Failed to update LinkedIn search results");
  }
}

/**
 * Mark LinkedIn search as failed
 */
export async function markLinkedInSearchFailed(
  searchId: string,
  error?: string
): Promise<void> {
  try {
    await convex.mutation("functions:updateLinkedInSearchResults" as any, {
      id: searchId as any,
      data: { error: error || "LinkedIn search failed" },
      status: "failed" as const,
    });
  } catch (err) {
    console.error("Failed to mark LinkedIn search as failed:", err);
    throw new Error("Failed to mark LinkedIn search as failed");
  }
}

/**
 * Store a LinkedIn profile with embeddings
 */
export async function storeLinkedInProfile(
  profile: StructuredLinkedInProfile,
  options: {
    userId?: string;
    searchId?: string;
    userLocation?: string;
    isProcessed?: boolean;
    rawData?: any;
  } = {}
): Promise<string> {
  try {
    let embedding: number[] | undefined;
    let embeddingText: string | undefined;

    // Extract Exa API fields from rawData
    const exaId =
      options.rawData?.id || options.rawData?.url || profile.profileUrl;
    const title =
      options.rawData?.title || `${profile.name} - ${profile.position}`;
    const url = options.rawData?.url || profile.profileUrl;
    const publishedDate = options.rawData?.publishedDate;
    const author = options.rawData?.author || profile.name;
    const image = options.rawData?.image;
    const text = options.rawData?.text;

    // Only generate embeddings for processed profiles (to save costs)
    if (options.isProcessed === "true") {
      // Prepare text for embedding
      embeddingText = [
        `Name: ${profile.name}`,
        `Position: ${profile.position}`,
        `Company: ${profile.company}`,
        `Location: ${profile.location}`,
        `Bio: ${profile.bio || ""}`,
        `Current Job: ${profile.currentJob.title} at ${profile.currentJob.company}`,
        `Experience: ${profile.experience.map((exp) => `${exp.title} at ${exp.company}`).join(", ")}`,
        `Education: ${profile.education.map((edu) => `${edu.degree} from ${edu.institution}`).join(", ")}`,
        `Skills: ${profile.skills.join(", ")}`,
        `Certifications: ${profile.certifications.map((cert) => cert.name).join(", ")}`,
      ].join(" ");

      // Generate embedding
      embedding = await generateEmbedding(embeddingText);
    }

    // Store in Convex with new schema fields
    const profileId = await convex.mutation(
      "functions:saveLinkedInProfile" as any,
      {
        // Exa API structured fields
        exaId,
        title,
        url,
        publishedDate,
        author,
        image,
        text,

        // Profile data
        aiData: profile,
        isProcessed: options.isProcessed ?? "true",
        rawData: options.rawData,
        embedding,
        embeddingText: embeddingText
          ? prepareTextForEmbedding(embeddingText)
          : undefined,
        userId: options.userId,
        searchId: options.searchId,
        userLocation: options.userLocation,
      }
    );

    return profileId;
  } catch (error) {
    console.error("Failed to store LinkedIn profile:", error);
    throw new Error("Failed to store LinkedIn profile");
  }
}

/**
 * Update LinkedIn profile with AI-processed data
 */
export async function updateLinkedInProfileWithAI(
  profileId: string,
  processedProfile: StructuredLinkedInProfile
): Promise<void> {
  try {
    // Prepare text for embedding
    const embeddingText = [
      `Name: ${processedProfile.name}`,
      `Position: ${processedProfile.position}`,
      `Company: ${processedProfile.company}`,
      `Location: ${processedProfile.location}`,
      `Bio: ${processedProfile.bio || ""}`,
      `Current Job: ${processedProfile.currentJob.title} at ${processedProfile.currentJob.company}`,
      `Experience: ${processedProfile.experience.map((exp) => `${exp.title} at ${exp.company}`).join(", ")}`,
      `Education: ${processedProfile.education.map((edu) => `${edu.degree} from ${edu.institution}`).join(", ")}`,
      `Skills: ${processedProfile.skills.join(", ")}`,
      `Certifications: ${processedProfile.certifications.map((cert) => cert.name).join(", ")}`,
    ].join(" ");

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText);

    // Update in Convex
    await convex.mutation("functions:updateLinkedInProfileWithAI" as any, {
      id: profileId as any,
      aiData: processedProfile,
      embedding,
      embeddingText: prepareTextForEmbedding(embeddingText),
    });
  } catch (error) {
    console.error("Failed to update LinkedIn profile with AI:", error);
    throw new Error("Failed to update LinkedIn profile with AI");
  }
}

/**
 * Retrieve a LinkedIn search by ID
 */
export async function getLinkedInSearch(
  id: string
): Promise<StoredLinkedInSearch | null> {
  try {
    return await convex.query("functions:getLinkedInSearch" as any, {
      id: id as any,
    });
  } catch (error) {
    console.error("Failed to get LinkedIn search:", error);
    return null;
  }
}

/**
 * Retrieve a LinkedIn profile by ID
 */
export async function getLinkedInProfile(
  id: string
): Promise<StoredLinkedInProfile | null> {
  try {
    return await convex.query("functions:getLinkedInProfile" as any, {
      id: id as any,
    });
  } catch (error) {
    console.error("Failed to get LinkedIn profile:", error);
    return null;
  }
}

/**
 * Get LinkedIn searches with optional filters
 */
export async function getLinkedInSearches(
  filters: {
    userId?: string;
    jobTitle?: string;
    userLocation?: string;
    limit?: number;
  } = {}
): Promise<StoredLinkedInSearch[]> {
  try {
    return await convex.query("functions:getLinkedInSearches" as any, filters);
  } catch (error) {
    console.error("Failed to get LinkedIn searches:", error);
    return [];
  }
}

/**
 * Get LinkedIn profiles with optional filters
 */
export async function getLinkedInProfiles(
  filters: {
    userId?: string;
    searchId?: string;
    author?: string;
    url?: string;
    userLocation?: string;
    profileLocation?: string;
    position?: string;
    limit?: number;
  } = {}
): Promise<StoredLinkedInProfile[]> {
  try {
    return await convex.query("functions:getLinkedInProfiles" as any, filters);
  } catch (error) {
    console.error("Failed to get LinkedIn profiles:", error);
    return [];
  }
}

/**
 * Search LinkedIn profiles using semantic similarity
 */
export async function searchLinkedInProfiles(
  query: string,
  options: {
    userId?: string;
    limit?: number;
  } = {}
): Promise<Array<StoredLinkedInProfile & { similarity: number }>> {
  try {
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Search using Convex
    return await convex.query("functions:searchLinkedInProfiles" as any, {
      queryEmbedding,
      ...options,
    });
  } catch (error) {
    console.error("Failed to search LinkedIn profiles:", error);
    return [];
  }
}

/**
 * Find existing LinkedIn search by parameters
 */
export async function findExistingLinkedInSearch(
  params: LinkedInSearchParams
): Promise<StoredLinkedInSearch | null> {
  try {
    return await convex.query("functions:findExistingLinkedInSearch" as any, {
      jobTitle: params.jobTitle,
      userLocation: params.userLocation,
      numResults: params.numResults,
    });
  } catch (error) {
    console.error("Failed to find existing LinkedIn search:", error);
    return null;
  }
}

/**
 * Clean up expired pending LinkedIn entries
 */
export async function cleanupExpiredLinkedInEntries(): Promise<{
  updated: number;
}> {
  try {
    return await convex.mutation(
      "functions:cleanupExpiredLinkedInEntries" as any,
      {}
    );
  } catch (error) {
    console.error("Failed to cleanup expired LinkedIn entries:", error);
    return { updated: 0 };
  }
}

/**
 * Find similar LinkedIn profiles to a given query
 */
export async function findSimilarLinkedInProfiles(
  query: string,
  options: {
    userId?: string;
    limit?: number;
  } = {}
): Promise<Array<StoredLinkedInProfile & { similarity: number }>> {
  return searchLinkedInProfiles(query, options);
}
