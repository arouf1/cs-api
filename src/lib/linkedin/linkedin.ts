import Exa from "exa-js";
import { generateObject } from "ai";
import { z } from "zod";
import { config } from "../core/config";
import { getChatModel } from "../external/openrouter";
import {
  findExistingLinkedInSearch,
  createPendingLinkedInSearch,
  updateLinkedInSearchResults,
  markLinkedInSearchFailed,
  cleanupExpiredLinkedInEntries,
} from "./linkedin-storage";

const exa = new Exa(config.exa.apiKey);

// AI model for LinkedIn profile parsing
const LINKEDIN_AI_MODEL = "gpt-4.1-mini";

export interface LinkedInSearchParams {
  jobTitle: string;
  userLocation: string;
  numResults: number;
}

export interface LinkedInSearchOptions {
  userId?: string;
  storeResult?: boolean;
}

// Raw profile data from Exa
export interface RawLinkedInProfile {
  id: string;
  title: string | null;
  url: string;
  publishedDate?: string;
  author?: string;
  text: string;
}

// Structured profile schema for LLM parsing
const StructuredProfileSchema = z.object({
  // Basic information
  name: z.string().describe("Full name of the professional"),
  position: z.string().describe("Current job title/position"),
  company: z.string().describe("Current company/employer"),
  location: z.string().describe("Location (city, country)"),
  connections: z.string().describe("Number of LinkedIn connections"),
  bio: z
    .string()
    .nullable()
    .describe("Professional bio/summary from their profile"),

  // AI-generated profile summary
  profileSummary: z
    .object({
      overview: z
        .string()
        .describe(
          "Comprehensive 2-3 sentence professional overview highlighting key achievements and expertise"
        ),
      keyStrengths: z
        .array(z.string())
        .describe("Top 3-5 key professional strengths and areas of expertise"),
      careerHighlights: z
        .array(z.string())
        .describe(
          "Notable career achievements, promotions, or significant accomplishments"
        ),
      industryExpertise: z
        .array(z.string())
        .describe("Industries and domains where they have experience"),
      yearsOfExperience: z
        .number()
        .nullable()
        .describe("Estimated total years of professional experience"),
      seniorityLevel: z
        .enum(["Entry", "Mid", "Senior", "Lead", "Executive", "C-Level"])
        .describe("Professional seniority level"),
      specialisations: z
        .array(z.string())
        .describe("Technical or functional specialisations and areas of focus"),
    })
    .describe("AI-generated comprehensive profile summary and analysis"),

  // Current job details
  currentJob: z
    .object({
      title: z.string(),
      company: z.string(),
      startDate: z.string().nullable(),
      location: z.string().nullable(),
      description: z.string().nullable(),
    })
    .describe("Current job information"),

  // Work experience
  experience: z
    .array(
      z.object({
        title: z.string(),
        company: z.string(),
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
        location: z.string().nullable(),
        description: z.string().nullable(),
      })
    )
    .describe("Work experience history"),

  // Education
  education: z
    .array(
      z.object({
        institution: z.string(),
        degree: z.string().nullable(),
        field: z.string().nullable(),
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
      })
    )
    .describe("Educational background"),

  // Skills and certifications
  skills: z.array(z.string()).describe("Professional skills mentioned"),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string().nullable(),
        date: z.string().nullable(),
      })
    )
    .describe("Professional certifications"),

  // Additional information
  languages: z
    .array(
      z.object({
        language: z.string(),
        proficiency: z.string().nullable(),
      })
    )
    .describe("Languages spoken"),

  recommendations: z
    .array(z.string())
    .describe("Professional recommendations received"),
  volunteering: z
    .array(
      z.object({
        position: z.string(),
        organisation: z.string(),
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
      })
    )
    .describe("Volunteering experience"),

  websites: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      })
    )
    .describe("Personal/professional websites"),

  publications: z
    .array(
      z.object({
        title: z.string(),
        published: z.string().nullable(),
        summary: z.string().nullable(),
        url: z.string().nullable(),
      })
    )
    .describe("Publications and articles"),

  // Metadata
  profileUrl: z.string().describe("LinkedIn profile URL"),
  lastUpdated: z.string().describe("When the profile was last scraped"),
});

export type StructuredLinkedInProfile = z.infer<typeof StructuredProfileSchema>;

export interface LinkedInSearchResult {
  searchId: string;
  profiles: StructuredLinkedInProfile[];
  totalFound: number;
  searchParams: LinkedInSearchParams;
  costDollars: number;
  responseTime: number;
}

/**
 * Main LinkedIn search function with duplicate prevention and status management
 */
export async function searchLinkedInProfessionals(
  params: LinkedInSearchParams,
  options: LinkedInSearchOptions = {}
): Promise<{
  result?: LinkedInSearchResult;
  searchId: string;
  status: "pending" | "complete" | "failed";
  isExisting?: boolean;
}> {
  // Clean up expired entries first
  await cleanupExpiredLinkedInEntries();

  // Check for existing search
  const existing = await findExistingLinkedInSearch(params);

  if (existing) {
    // Handle existing search based on status
    if (existing.status === "complete") {
      if (existing.isStale) {
        // Search is stale (>24 hours old), create new one
        console.log(
          "Found stale LinkedIn search (>24 hours old), creating new one"
        );
        // Fall through to create new search
      } else {
        // Return existing complete search
        console.log("Returning existing complete LinkedIn search");
        return {
          result: existing.data,
          searchId: existing._id,
          status: "complete",
          isExisting: true,
        };
      }
    } else if (existing.status === "pending") {
      // Return pending status for polling
      console.log("LinkedIn search is pending, returning for polling");
      return {
        searchId: existing._id,
        status: "pending",
        isExisting: true,
      };
    } else if (existing.status === "failed") {
      // Previous attempt failed, create new one
      console.log("Previous LinkedIn search failed, creating new one");
      // Fall through to create new search
    }
  }

  // Create new pending search entry
  const searchId = await createPendingLinkedInSearch(params, options);
  console.log("Created pending LinkedIn search entry:", searchId);

  // Start search in background (don't await)
  executeLinkedInSearch(searchId, params, options).catch(async (error) => {
    console.error("LinkedIn search failed:", error);
    await markLinkedInSearchFailed(searchId, error.message);
  });

  return {
    searchId,
    status: "pending",
  };
}

/**
 * Execute the actual LinkedIn search (called in background)
 */
async function executeLinkedInSearch(
  searchId: string,
  params: LinkedInSearchParams,
  options: LinkedInSearchOptions = {}
): Promise<void> {
  try {
    const startTime = Date.now();

    // Search LinkedIn profiles using Exa
    console.log("Searching LinkedIn profiles with params:", params);
    console.log("EXA_API_KEY exists:", !!process.env.EXA_API_KEY);

    let exaResult: any;
    let rawProfileIds: string[] = [];

    try {
      exaResult = await exa.searchAndContents(params.jobTitle, {
        text: true,
        type: "auto",
        userLocation: params.userLocation,
        category: "linkedin profile",
        numResults: params.numResults,
      });

      console.log(`Found ${exaResult.results.length} LinkedIn profiles`);
      console.log(
        "Exa result sample:",
        exaResult.results[0]?.author || "No results"
      );

      // Store raw profiles immediately for instant results
      for (const rawProfile of exaResult.results) {
        try {
          console.log(
            `Storing raw profile: ${rawProfile.author || rawProfile.id}`
          );
          const profileId = await storeRawLinkedInProfile(rawProfile, {
            userId: options.userId,
            searchId,
            userLocation: params.userLocation,
          });
          rawProfileIds.push(profileId);
          console.log(`Stored profile with ID: ${profileId}`);
        } catch (error) {
          console.error(`Failed to store raw profile ${rawProfile.id}:`, error);
          // Continue with other profiles
        }
      }

      console.log(`Successfully stored ${rawProfileIds.length} profiles`);
    } catch (exaError) {
      console.error("Exa API call failed:", exaError);
      throw exaError;
    }

    const responseTime = Date.now() - startTime;
    const costDollars = exaResult?.costDollars?.total || 0;

    // Create result with raw profile count
    const result: LinkedInSearchResult = {
      searchId,
      profiles: [], // Will be populated as AI processing completes
      totalFound: rawProfileIds.length,
      searchParams: params,
      costDollars,
      responseTime,
    };

    // Skip immediate AI processing - let the cron job handle it
    console.log(
      `✅ Stored ${rawProfileIds.length} profiles - AI processing will be handled by cron job`
    );

    // Update the search entry with results
    await updateLinkedInSearchResults(searchId, result, {
      model: LINKEDIN_AI_MODEL,
      responseTime,
      costDollars,
    });

    console.log("LinkedIn search completed successfully:", searchId);
  } catch (error) {
    console.error("LinkedIn search execution failed:", error);
    throw error;
  }
}

/**
 * Store raw LinkedIn profile immediately for instant results
 */
async function storeRawLinkedInProfile(
  rawProfile: RawLinkedInProfile,
  options: {
    userId?: string;
    searchId?: string;
    userLocation?: string;
  } = {}
): Promise<string> {
  // Create a minimal placeholder profile - AI will fill in the real data
  const basicProfile: StructuredLinkedInProfile = {
    name: rawProfile.author || "Processing...",
    position: "Processing...",
    company: "Processing...",
    location: "Processing...",
    connections: "Processing...",
    bio: null,
    profileSummary: {
      overview: "Processing...",
      keyStrengths: [],
      careerHighlights: [],
      industryExpertise: [],
      yearsOfExperience: null,
      seniorityLevel: "Mid",
      specialisations: [],
    },
    currentJob: {
      title: "Processing...",
      company: "Processing...",
      startDate: null,
      location: null,
      description: null,
    },
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    recommendations: [],
    volunteering: [],
    websites: [],
    publications: [],
    profileUrl: rawProfile.url,
    lastUpdated: rawProfile.publishedDate || new Date().toISOString(),
  };

  // Store with raw data and processing status
  const { storeLinkedInProfile } = await import("./linkedin-storage");
  return await storeLinkedInProfile(basicProfile, {
    ...options,
    isProcessed: false, // Mark as unprocessed
    rawData: rawProfile, // Store raw data for AI processing
  });
}

/**
 * Process profiles with AI in background
 */
async function processProfilesWithAI(
  profileIds: string[],
  searchId: string,
  options: LinkedInSearchOptions = {}
): Promise<void> {
  console.log(
    `🤖 Starting background AI processing for ${profileIds.length} profiles`
  );
  console.log("OPENROUTER_API_KEY exists:", !!process.env.OPENROUTER_API_KEY);
  console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

  try {
    const { getLinkedInProfile, updateLinkedInProfileWithAI } = await import(
      "./linkedin-storage"
    );

    for (const profileId of profileIds) {
      try {
        console.log(`🔄 Processing profile ${profileId}...`);

        // Get the stored profile with raw data
        const storedProfile = await getLinkedInProfile(profileId);
        if (!storedProfile) {
          console.error(`❌ Profile ${profileId} not found`);
          continue;
        }

        if (!storedProfile.rawData) {
          console.error(`❌ Profile ${profileId} missing raw data`);
          continue;
        }

        console.log(
          `📝 Parsing profile with AI: ${storedProfile.aiData?.name || storedProfile.author}`
        );

        // Parse with AI
        console.log(`🔄 Calling parseLinkedInProfile for ${profileId}...`);
        const structuredProfile = await parseLinkedInProfile(
          storedProfile.rawData
        );
        console.log(`✅ AI parsing completed for: ${structuredProfile.name}`);

        console.log(
          `💾 Updating profile in database: ${structuredProfile.name}`
        );

        // Update the stored profile with AI-processed data
        console.log(
          `🔄 Calling updateLinkedInProfileWithAI for ${profileId}...`
        );
        await updateLinkedInProfileWithAI(profileId, structuredProfile);
        console.log(
          `✅ Database update completed for: ${structuredProfile.name}`
        );

        console.log(`✅ AI processed profile: ${structuredProfile.name}`);
      } catch (error) {
        console.error(`❌ Failed to AI process profile ${profileId}:`, error);
        console.error(`Error details:`, error);
        // Continue with other profiles
      }
    }

    console.log(`🎉 Completed background AI processing for search ${searchId}`);
  } catch (error) {
    console.error(`❌ Background AI processing failed completely:`, error);
    throw error;
  }
}

/**
 * Parse a raw LinkedIn profile using LLM to extract structured data
 */
async function parseLinkedInProfile(
  rawProfile: RawLinkedInProfile
): Promise<StructuredLinkedInProfile> {
  try {
    console.log(`🤖 Getting chat model: ${LINKEDIN_AI_MODEL}`);
    const model = getChatModel(LINKEDIN_AI_MODEL);
    console.log(`✅ Chat model obtained successfully`);

    console.log(`🔄 Calling generateObject with AI model...`);

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("AI processing timeout after 5 minutes")),
        300000 // 5 minutes
      );
    });

    const aiPromise = generateObject({
      model,
      schema: StructuredProfileSchema,
      prompt: `You are an expert LinkedIn profile analyst. Parse the following LinkedIn profile data and extract comprehensive structured information.

INSTRUCTIONS:
- Be thorough and accurate in your analysis
- Generate insightful AI analysis in the profileSummary section
- Calculate years of experience based on work history
- Determine seniority level based on job titles and experience
- Extract all available information systematically
- Use null for unavailable optional fields, empty arrays for missing lists
- Focus on professional achievements and career progression
- Identify key skills, technologies, and industry expertise

PROFILE DATA TO ANALYSE:
${rawProfile.text}

METADATA:
- Profile URL: ${rawProfile.url}
- Last Updated: ${rawProfile.publishedDate || "Unknown"}
- Author: ${rawProfile.author || "Unknown"}

Please provide a comprehensive analysis with particular attention to:
1. Professional overview and career trajectory
2. Key technical and business skills
3. Industry expertise and specialisations
4. Notable achievements and career highlights
5. Leadership experience and seniority level
6. Educational background and certifications`,
    });

    const result = (await Promise.race([aiPromise, timeoutPromise])) as any;
    console.log(`✅ generateObject completed successfully`);

    const finalProfile = {
      ...result.object,
      profileUrl: rawProfile.url,
      lastUpdated: rawProfile.publishedDate || new Date().toISOString(),
    };
    console.log(`✅ Final profile structure created for: ${finalProfile.name}`);

    return finalProfile;
  } catch (error) {
    console.error("Failed to parse LinkedIn profile:", error);
    console.error("Error details:", error);
    throw new Error("Failed to parse LinkedIn profile with LLM");
  }
}

/**
 * Direct search function (without storage/status management)
 */
export async function searchLinkedInProfilesDirect(
  params: LinkedInSearchParams,
  options: LinkedInSearchOptions = {}
): Promise<LinkedInSearchResult> {
  const startTime = Date.now();

  // Search LinkedIn profiles using Exa
  const exaResult = await exa.searchAndContents(params.jobTitle, {
    text: true,
    type: "auto",
    userLocation: params.userLocation,
    category: "linkedin profile",
    numResults: params.numResults,
  });

  const responseTime = Date.now() - startTime;
  const costDollars = exaResult.costDollars?.total || 0;

  const result: LinkedInSearchResult = {
    searchId: "", // No search ID for direct calls
    profiles: [], // Will be populated as AI processing completes
    totalFound: exaResult.results.length,
    searchParams: params,
    costDollars,
    responseTime,
  };

  // Store result if requested
  if (options.storeResult) {
    const searchId = await createPendingLinkedInSearch(params, options);

    // Store raw profiles immediately
    const rawProfileIds: string[] = [];
    for (const rawProfile of exaResult.results) {
      try {
        const profileId = await storeRawLinkedInProfile(rawProfile, {
          userId: options.userId,
          searchId,
          userLocation: params.userLocation,
        });
        rawProfileIds.push(profileId);
      } catch (error) {
        console.error(`Failed to store raw profile ${rawProfile.id}:`, error);
      }
    }

    // Update search with results
    await updateLinkedInSearchResults(
      searchId,
      { ...result, searchId },
      {
        model: LINKEDIN_AI_MODEL,
        responseTime,
        costDollars,
      }
    );

    // Skip immediate AI processing - let the cron job handle it
    console.log(
      `✅ Stored ${rawProfileIds.length} profiles - AI processing will be handled by cron job`
    );

    result.searchId = searchId;
  } else {
    console.log("⚠️ Skipping AI processing - storeResult is false");
  }

  return result;
}

/**
 * Refresh a single LinkedIn profile by URL using Exa API
 */
export async function refreshLinkedInProfile(
  profileUrl: string,
  options: {
    userId?: string;
    userLocation?: string;
  } = {}
): Promise<{
  success: boolean;
  profileId?: string;
  message: string;
  error?: string;
}> {
  try {
    console.log(`🔄 Refreshing LinkedIn profile: ${profileUrl}`);

    // Search for the specific profile using Exa API
    const exaResult = await exa.searchAndContents(profileUrl, {
      text: true,
      category: "linkedin profile",
      numResults: 1,
      type: "auto",
    });

    if (!exaResult.results || exaResult.results.length === 0) {
      return {
        success: false,
        message: "Profile not found in Exa search results",
        error: "NO_RESULTS",
      };
    }

    const rawProfile = exaResult.results[0];

    // Verify the returned profile matches the requested URL
    if (rawProfile.id !== profileUrl && rawProfile.url !== profileUrl) {
      return {
        success: false,
        message: `Profile URL mismatch. Expected: ${profileUrl}, Got: ${rawProfile.id || rawProfile.url}`,
        error: "URL_MISMATCH",
      };
    }

    console.log(`✅ Found matching profile: ${rawProfile.author}`);

    // Get the existing profile to compare raw data
    const { getLinkedInProfiles } = await import("./linkedin-storage");
    const existingProfiles = await getLinkedInProfiles({
      url: profileUrl,
      limit: 1,
    });
    const existingProfile =
      existingProfiles.length > 0 ? existingProfiles[0] : null;

    // Compare the new raw data with existing raw data to check for meaningful changes
    let hasChanges = true;
    let shouldRunAI = true;

    if (existingProfile && existingProfile.rawData) {
      // Compare key fields that would indicate meaningful changes
      const oldData = existingProfile.rawData;
      const newData = rawProfile;

      // Check if the core content has changed
      const oldText = oldData.text || "";
      const newText = newData.text || "";
      const oldTitle = oldData.title || "";
      const newTitle = newData.title || "";
      const oldPublishedDate = oldData.publishedDate || "";
      const newPublishedDate = newData.publishedDate || "";

      // Consider it unchanged if text, title, and publishedDate are the same
      if (
        oldText === newText &&
        oldTitle === newTitle &&
        oldPublishedDate === newPublishedDate
      ) {
        hasChanges = false;
        shouldRunAI = false;
        console.log(
          `📋 No meaningful changes detected for ${rawProfile.author}, skipping AI processing`
        );
      } else {
        console.log(
          `🔄 Meaningful changes detected for ${rawProfile.author}, will run AI processing`
        );
      }
    } else {
      console.log(
        `🆕 No existing raw data found for ${rawProfile.author}, will run AI processing`
      );
    }

    // Store the refreshed profile (this will overwrite the existing one)
    const profileId = await storeRawLinkedInProfile(rawProfile, {
      userId: options.userId,
      userLocation: options.userLocation,
    });

    // Only trigger AI processing if there are meaningful changes
    if (shouldRunAI) {
      await processProfilesWithAI([profileId], "refresh", {
        userId: options.userId,
      });
    }

    return {
      success: true,
      profileId,
      message: `Successfully refreshed profile for ${rawProfile.author}${shouldRunAI ? " (with AI processing)" : " (no AI processing - no changes detected)"}`,
    };
  } catch (error) {
    console.error(
      `❌ Failed to refresh LinkedIn profile ${profileUrl}:`,
      error
    );
    return {
      success: false,
      message: `Failed to refresh profile: ${error instanceof Error ? error.message : String(error)}`,
      error: "REFRESH_ERROR",
    };
  }
}

/**
 * Validates LinkedIn search parameters
 */
export function validateLinkedInSearchParams(
  params: LinkedInSearchParams
): void {
  const { jobTitle, userLocation, numResults } = params;

  if (
    !jobTitle ||
    typeof jobTitle !== "string" ||
    jobTitle.trim().length === 0
  ) {
    throw new Error("Job title is required and must be a non-empty string");
  }

  if (
    !userLocation ||
    typeof userLocation !== "string" ||
    userLocation.trim().length === 0
  ) {
    throw new Error("User location is required and must be a non-empty string");
  }

  if (
    !numResults ||
    typeof numResults !== "number" ||
    numResults < 1 ||
    numResults > 100
  ) {
    throw new Error("Number of results must be a number between 1 and 100");
  }
}
