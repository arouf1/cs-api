import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  action,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Utility functions for extracting profile data from raw text
function extractProfileLocation(text: string): string | undefined {
  // Match "Location: [location text]" pattern
  const locationMatch = text.match(/^Location:\s*(.+)$/m);
  if (locationMatch && locationMatch[1]) {
    return locationMatch[1].trim();
  }
  return undefined;
}

function extractPosition(text: string): string | undefined {
  // Match "Position: [position text]" pattern
  const positionMatch = text.match(/^Position:\s*(.+)$/m);
  if (positionMatch && positionMatch[1]) {
    return positionMatch[1].trim();
  }
  return undefined;
}

// Test function
export const testFunction = query({
  args: {},
  handler: async () => {
    return "test";
  },
});

// API Log functions
export const logApiCall = mutation({
  args: {
    endpoint: v.string(),
    method: v.string(),
    responseTime: v.optional(v.number()),
    statusCode: v.optional(v.number()),
    userId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getApiLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiLogs")
      .order("desc")
      .take(args.limit ?? 100);
  },
});

// Research Report functions

// Create a pending research entry
export const createPendingResearch = mutation({
  args: {
    company: v.string(),
    position: v.string(),
    location: v.string(),
    type: v.union(
      v.literal("structured"),
      v.literal("completion"),
      v.literal("streaming")
    ),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes from now

    return await ctx.db.insert("researchReports", {
      ...args,
      data: {}, // Will be populated when complete
      status: "pending" as const,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update research report with results
export const updateResearchReport = mutation({
  args: {
    id: v.id("researchReports"),
    data: v.any(),
    titleEmbedding: v.optional(v.array(v.number())),
    descriptionEmbedding: v.optional(v.array(v.number())),
    combinedEmbedding: v.optional(v.array(v.number())),
    embeddingText: v.optional(v.string()),
    status: v.union(v.literal("complete"), v.literal("failed")),
    model: v.optional(v.string()),
    responseTime: v.optional(v.number()),
    costDollars: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updateData } = args;
    return await ctx.db.patch(id, {
      ...updateData,
      updatedAt: Date.now(),
    });
  },
});

// Legacy function for backwards compatibility
export const saveResearchReport = mutation({
  args: {
    company: v.string(),
    position: v.string(),
    location: v.string(),
    type: v.union(
      v.literal("structured"),
      v.literal("completion"),
      v.literal("streaming")
    ),
    data: v.any(),
    titleEmbedding: v.optional(v.array(v.number())),
    descriptionEmbedding: v.optional(v.array(v.number())),
    combinedEmbedding: v.optional(v.array(v.number())),
    embeddingText: v.optional(v.string()),
    userId: v.optional(v.string()),
    model: v.optional(v.string()),
    responseTime: v.optional(v.number()),
    costDollars: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("researchReports", {
      ...args,
      status: "complete" as const,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getResearchReport = query({
  args: {
    id: v.id("researchReports"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.id);
    if (!report) return null;

    // Remove embedding fields from response
    const {
      titleEmbedding,
      descriptionEmbedding,
      combinedEmbedding,
      ...reportWithoutEmbeddings
    } = report;
    return reportWithoutEmbeddings;
  },
});

export const getResearchReports = query({
  args: {
    userId: v.optional(v.string()),
    company: v.optional(v.string()),
    position: v.optional(v.string()),
    location: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("researchReports");

    // Apply filters
    if (args.userId) {
      query = query.filter((q) => q.eq(q.field("userId"), args.userId));
    }
    if (args.company) {
      query = query.filter((q) => q.eq(q.field("company"), args.company));
    }
    if (args.position) {
      query = query.filter((q) => q.eq(q.field("position"), args.position));
    }
    if (args.location) {
      query = query.filter((q) => q.eq(q.field("location"), args.location));
    }

    const reports = await query.order("desc").take(args.limit ?? 50);

    // Remove embedding fields from response
    return reports.map((report) => {
      const {
        titleEmbedding,
        descriptionEmbedding,
        combinedEmbedding,
        ...reportWithoutEmbeddings
      } = report;
      return reportWithoutEmbeddings;
    });
  },
});

// Find existing research by parameters
export const findExistingResearch = query({
  args: {
    company: v.string(),
    position: v.string(),
    location: v.string(),
    type: v.union(
      v.literal("structured"),
      v.literal("completion"),
      v.literal("streaming")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Find research with exact parameters
    const existing = await ctx.db
      .query("researchReports")
      .withIndex("by_research_key", (q) =>
        q
          .eq("company", args.company)
          .eq("position", args.position)
          .eq("location", args.location)
          .eq("type", args.type)
      )
      .order("desc")
      .first();

    if (!existing) {
      return null;
    }

    // Check if entry is expired (pending > 5 minutes)
    if (
      existing.status === "pending" &&
      existing.expiresAt &&
      existing.expiresAt < now
    ) {
      return { ...existing, status: "failed" as const };
    }

    // Check if entry is stale (> 7 days old)
    if (existing.createdAt < sevenDaysAgo && existing.status === "complete") {
      return { ...existing, isStale: true };
    }

    return existing;
  },
});

// Mark expired pending entries as failed
export const cleanupExpiredEntries = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all pending entries that have expired
    const expiredEntries = await ctx.db
      .query("researchReports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Mark them as failed
    const updates = expiredEntries.map((entry) =>
      ctx.db.patch(entry._id, {
        status: "failed" as const,
        updatedAt: now,
      })
    );

    await Promise.all(updates);
    return { updated: expiredEntries.length };
  },
});

export const searchResearchReports = query({
  args: {
    queryEmbedding: v.array(v.number()),
    limit: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all completed research reports (with optional user filter)
    let query = ctx.db
      .query("researchReports")
      .filter((q) => q.eq(q.field("status"), "complete"));

    if (args.userId) {
      query = query.filter((q) => q.eq(q.field("userId"), args.userId));
    }

    const reports = await query.collect();

    // Calculate cosine similarity for each report using combinedEmbedding
    const reportsWithSimilarity = reports
      .filter((report) => report.combinedEmbedding) // Only reports with combinedEmbedding
      .map((report) => {
        const similarity = cosineSimilarity(
          args.queryEmbedding,
          report.combinedEmbedding!
        );
        // Remove embedding fields from response
        const {
          titleEmbedding,
          descriptionEmbedding,
          combinedEmbedding,
          ...reportWithoutEmbeddings
        } = report;
        return { ...reportWithoutEmbeddings, similarity };
      });

    // Sort by similarity and return top results
    return reportsWithSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, args.limit ?? 10);
  },
});

// Helper function for cosine similarity (duplicated from embeddings.ts for Convex)
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// LinkedIn Search functions

// Create a pending LinkedIn search entry
export const createPendingLinkedInSearch = mutation({
  args: {
    jobTitle: v.string(),
    userLocation: v.string(),
    numResults: v.number(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes from now

    return await ctx.db.insert("linkedinSearches", {
      ...args,
      data: {}, // Will be populated when complete
      status: "pending" as const,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update LinkedIn search with results
export const updateLinkedInSearchResults = mutation({
  args: {
    id: v.id("linkedinSearches"),
    data: v.any(),
    status: v.union(v.literal("complete"), v.literal("failed")),
    model: v.optional(v.string()),
    responseTime: v.optional(v.number()),
    costDollars: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updateData } = args;
    return await ctx.db.patch(id, {
      ...updateData,
      updatedAt: Date.now(),
    });
  },
});

// Get LinkedIn search by ID
export const getLinkedInSearch = query({
  args: {
    id: v.id("linkedinSearches"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get LinkedIn searches with filters
export const getLinkedInSearches = query({
  args: {
    userId: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    userLocation: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("linkedinSearches");

    // Apply filters
    if (args.userId) {
      query = query.filter((q) => q.eq(q.field("userId"), args.userId));
    }
    if (args.jobTitle) {
      query = query.filter((q) => q.eq(q.field("jobTitle"), args.jobTitle));
    }
    if (args.userLocation) {
      query = query.filter((q) =>
        q.eq(q.field("userLocation"), args.userLocation)
      );
    }

    return await query.order("desc").take(args.limit ?? 50);
  },
});

// Find existing LinkedIn search by parameters
export const findExistingLinkedInSearch = query({
  args: {
    jobTitle: v.string(),
    userLocation: v.string(),
    numResults: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000; // 24 hours ago

    // Find search with exact parameters
    const existing = await ctx.db
      .query("linkedinSearches")
      .withIndex("by_search_key", (q) =>
        q
          .eq("jobTitle", args.jobTitle)
          .eq("userLocation", args.userLocation)
          .eq("numResults", args.numResults)
      )
      .order("desc")
      .first();

    if (!existing) {
      return null;
    }

    // Check if entry is expired (pending > 5 minutes)
    if (
      existing.status === "pending" &&
      existing.expiresAt &&
      existing.expiresAt < now
    ) {
      return { ...existing, status: "failed" as const };
    }

    // Check if entry is stale (> 24 hours old)
    if (existing.createdAt < oneDayAgo && existing.status === "complete") {
      return { ...existing, isStale: true };
    }

    return existing;
  },
});

// Clean up expired LinkedIn search entries
export const cleanupExpiredLinkedInEntries = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all pending entries that have expired
    const expiredEntries = await ctx.db
      .query("linkedinSearches")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Mark them as failed
    const updates = expiredEntries.map((entry) =>
      ctx.db.patch(entry._id, {
        status: "failed" as const,
        updatedAt: now,
      })
    );

    await Promise.all(updates);
    return { updated: expiredEntries.length };
  },
});

// LinkedIn Profile functions

// Save LinkedIn profile (overwrites existing profile with same URL)
export const saveLinkedInProfile = mutation({
  args: {
    // Exa API structured fields
    exaId: v.string(),
    title: v.string(),
    url: v.string(),
    publishedDate: v.optional(v.string()),
    author: v.string(),
    image: v.optional(v.string()),
    text: v.optional(v.string()),

    // Profile data
    aiData: v.any(),
    isProcessed: v.optional(
      v.union(v.literal("false"), v.literal("pending"), v.literal("true"))
    ),
    rawData: v.optional(v.any()),
    titleEmbedding: v.optional(v.array(v.number())),
    descriptionEmbedding: v.optional(v.array(v.number())),
    combinedEmbedding: v.optional(v.array(v.number())),
    embeddingText: v.optional(v.string()),
    userId: v.optional(v.string()),
    searchId: v.optional(v.string()),
    userLocation: v.optional(v.string()),
    profileLocation: v.optional(v.string()),
    position: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Extract profileLocation and position from text if not provided and text is available
    let profileLocation = args.profileLocation;
    let position = args.position;

    if (args.text && (!profileLocation || !position)) {
      if (!profileLocation) {
        profileLocation = extractProfileLocation(args.text);
      }
      if (!position) {
        position = extractPosition(args.text);
      }
    }

    // Check if a profile with this URL already exists
    const existing = await ctx.db
      .query("linkedinProfiles")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();

    const profileData = {
      ...args,
      profileLocation,
      position,
      updatedAt: now,
    };

    if (existing) {
      // Update existing profile
      return await ctx.db.patch(existing._id, profileData);
    } else {
      // Create new profile
      return await ctx.db.insert("linkedinProfiles", {
        ...profileData,
        createdAt: now,
      });
    }
  },
});

// Update LinkedIn profile with AI-processed data
export const updateLinkedInProfileWithAI = mutation({
  args: {
    id: v.id("linkedinProfiles"),
    aiData: v.any(),
    titleEmbedding: v.optional(v.array(v.number())),
    descriptionEmbedding: v.optional(v.array(v.number())),
    combinedEmbedding: v.optional(v.array(v.number())),
    embeddingText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updateData } = args;
    return await ctx.db.patch(id, {
      ...updateData,
      isProcessed: "true",
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation to process unprocessed LinkedIn profiles (called by cron job)
export const processUnprocessedLinkedInProfiles = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 5; // Process 5 profiles at a time by default

    console.log(
      `🔄 Cron job: Looking for unprocessed LinkedIn profiles (batch size: ${batchSize})`
    );

    // Query for unprocessed profiles that have raw data (only process "false" status, not "pending")
    const unprocessedProfiles = await ctx.db
      .query("linkedinProfiles")
      .filter((q) =>
        q.and(
          q.eq(q.field("isProcessed"), "false"),
          q.neq(q.field("rawData"), null)
        )
      )
      .take(batchSize);

    if (unprocessedProfiles.length === 0) {
      console.log("✅ Cron job: No unprocessed LinkedIn profiles found");
      return {
        processed: 0,
        errors: 0,
        message: "No unprocessed profiles found",
      };
    }

    console.log(
      `📝 Cron job: Found ${unprocessedProfiles.length} unprocessed LinkedIn profiles`
    );

    let processedCount = 0;
    let errorCount = 0;

    for (const profile of unprocessedProfiles) {
      try {
        console.log(
          `🔄 Processing profile: ${profile.author} (${profile.url})`
        );

        // Mark the profile as pending before scheduling AI processing
        await ctx.db.patch(profile._id, {
          isProcessed: "pending",
          updatedAt: Date.now(),
        });

        // Schedule the AI processing action to run
        await ctx.scheduler.runAfter(
          0,
          internal.functions.processLinkedInProfileWithAI,
          { profileId: profile._id }
        );

        processedCount++;
        console.log(`✅ Queued AI processing for: ${profile.author}`);
      } catch (error) {
        console.error(`❌ Failed to process profile ${profile.author}:`, error);
        errorCount++;

        // Mark the profile with an error flag
        await ctx.db.patch(profile._id, {
          processingError:
            error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        });
      }
    }

    const message = `Processed ${processedCount} profiles, ${errorCount} errors`;
    console.log(`🎉 Cron job completed: ${message}`);

    return {
      processed: processedCount,
      errors: errorCount,
      message,
    };
  },
});

// Manual trigger to process unprocessed LinkedIn profiles (for testing/manual runs)
export const triggerProfileProcessing = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ processed: number; errors: number; message: string }> => {
    // Call the internal mutation
    return await ctx.runMutation(
      internal.functions.processUnprocessedLinkedInProfiles,
      {
        batchSize: args.batchSize || 10,
      }
    );
  },
});

// Internal action to process a LinkedIn profile with AI
export const processLinkedInProfileWithAI = internalAction({
  args: {
    profileId: v.id("linkedinProfiles"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`🤖 Processing LinkedIn profile ${args.profileId} with AI`);

      // Get environment variables
      const apiUrl = process.env.CS_API_BASE_URL;
      const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

      if (!apiUrl) {
        throw new Error("CS_API_BASE_URL environment variable not set");
      }

      if (!bypassSecret) {
        throw new Error(
          "VERCEL_AUTOMATION_BYPASS_SECRET environment variable not set"
        );
      }

      console.log(
        `📡 Calling API at: ${apiUrl}/api/linkedin/process-unprocessed`
      );

      const response = await fetch(
        `${apiUrl}/api/linkedin/process-unprocessed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-vercel-protection-bypass": bypassSecret,
          },
          body: JSON.stringify({
            profileIds: [args.profileId], // Process just this one profile
            limit: 1,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API call failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to process profile");
      }

      console.log(
        `✅ Successfully processed profile via API: ${args.profileId}`
      );
      return { success: true, result };
    } catch (error) {
      console.error(`❌ Failed to process profile ${args.profileId}:`, error);

      // Mark the profile as having an error
      await ctx.runMutation(internal.functions.markLinkedInProfileError, {
        profileId: args.profileId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});

// Internal query to get a LinkedIn profile by ID
export const getLinkedInProfileById = internalQuery({
  args: {
    profileId: v.id("linkedinProfiles"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profileId);
  },
});

// Internal mutation to update LinkedIn profile with AI-parsed data
export const updateLinkedInProfileWithAIData = internalMutation({
  args: {
    profileId: v.id("linkedinProfiles"),
    aiData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      aiData: args.aiData,
      isProcessed: "true",
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation to mark LinkedIn profile as having an error
export const markLinkedInProfileError = internalMutation({
  args: {
    profileId: v.id("linkedinProfiles"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      processingError: args.error,
      isProcessed: "false", // Reset to false so it can be retried
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation to update stale LinkedIn profiles (called by cron job)
export const updateStaleLinkedInProfiles = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ updated: number; errors: number; message: string }> => {
    const batchSize = args.batchSize || 3; // Process 3 profiles at a time by default (to avoid rate limits)

    // Calculate 3 months ago timestamp
    const threeMonthsAgo = Date.now() - 3 * 30 * 24 * 60 * 60 * 1000; // 3 months in milliseconds

    console.log(
      `🔄 Cron job: Looking for stale LinkedIn profiles (older than 3 months, batch size: ${batchSize})`
    );

    // Query for profiles that haven't been updated in 3+ months
    const staleProfiles = await ctx.db
      .query("linkedinProfiles")
      .filter((q) => q.lt(q.field("updatedAt"), threeMonthsAgo))
      .take(batchSize);

    if (staleProfiles.length === 0) {
      console.log("✅ Cron job: No stale LinkedIn profiles found");
      return {
        updated: 0,
        errors: 0,
        message: "No stale profiles found",
      };
    }

    console.log(
      `📝 Cron job: Found ${staleProfiles.length} stale LinkedIn profiles`
    );

    let updatedCount = 0;
    let errorCount = 0;

    for (const profile of staleProfiles) {
      try {
        console.log(
          `🔄 Updating stale profile: ${profile.author} (${profile.url})`
        );

        // Mark as being processed to avoid duplicate processing
        await ctx.db.patch(profile._id, {
          updatedAt: Date.now(),
          // Add a processing flag to track that this profile was touched by stale update cron
          staleUpdateProcessedAt: Date.now(),
        });

        updatedCount++;
        console.log(`✅ Marked stale profile for update: ${profile.author}`);
      } catch (error) {
        console.error(
          `❌ Failed to process stale profile ${profile.author}:`,
          error
        );
        errorCount++;

        // Mark the profile with an error flag
        await ctx.db.patch(profile._id, {
          staleUpdateError:
            error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        });
      }
    }

    const message = `Updated ${updatedCount} stale profiles, ${errorCount} errors`;
    console.log(`🎉 Stale update cron job completed: ${message}`);

    return {
      updated: updatedCount,
      errors: errorCount,
      message,
    };
  },
});

// Manual trigger to update stale LinkedIn profiles (for testing/manual runs)
export const triggerStaleProfileUpdates = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ updated: number; errors: number; message: string }> => {
    // Call the internal mutation
    return await ctx.runMutation(
      internal.functions.updateStaleLinkedInProfiles,
      {
        batchSize: args.batchSize || 5,
      }
    );
  },
});

// Get LinkedIn profile by ID
export const getLinkedInProfile = query({
  args: {
    id: v.id("linkedinProfiles"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Find existing LinkedIn profile by Exa ID
export const findLinkedInProfileByExaId = query({
  args: {
    exaId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("linkedinProfiles")
      .withIndex("by_exa_id", (q) => q.eq("exaId", args.exaId))
      .first();
  },
});

// Find existing LinkedIn profile by URL
export const findLinkedInProfileByUrl = query({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("linkedinProfiles")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .first();
  },
});

// Get LinkedIn profiles with filters
export const getLinkedInProfiles = query({
  args: {
    userId: v.optional(v.string()),
    searchId: v.optional(v.string()),
    author: v.optional(v.string()),
    url: v.optional(v.string()),
    userLocation: v.optional(v.string()),
    profileLocation: v.optional(v.string()),
    position: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("linkedinProfiles");

    // Apply filters
    if (args.userId) {
      query = query.filter((q) => q.eq(q.field("userId"), args.userId));
    }
    if (args.searchId) {
      query = query.filter((q) => q.eq(q.field("searchId"), args.searchId));
    }
    if (args.author) {
      query = query.filter((q) => q.eq(q.field("author"), args.author));
    }
    if (args.url) {
      query = query.filter((q) => q.eq(q.field("url"), args.url));
    }
    if (args.userLocation) {
      query = query.filter((q) =>
        q.eq(q.field("userLocation"), args.userLocation)
      );
    }
    if (args.profileLocation) {
      query = query.filter((q) =>
        q.eq(q.field("profileLocation"), args.profileLocation)
      );
    }
    if (args.position) {
      query = query.filter((q) => q.eq(q.field("position"), args.position));
    }

    const profiles = await query.order("desc").take(args.limit ?? 50);

    // Remove embedding fields from response
    return profiles.map((profile) => {
      const {
        titleEmbedding,
        descriptionEmbedding,
        combinedEmbedding,
        ...profileWithoutEmbeddings
      } = profile;
      return profileWithoutEmbeddings;
    });
  },
});

// Search LinkedIn profiles using semantic similarity
export const searchLinkedInProfiles = query({
  args: {
    queryEmbedding: v.array(v.number()),
    limit: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all LinkedIn profiles (with optional user filter)
    let query = ctx.db.query("linkedinProfiles");

    if (args.userId) {
      query = query.filter((q) => q.eq(q.field("userId"), args.userId));
    }

    const profiles = await query.collect();

    // Calculate cosine similarity for each profile using combinedEmbedding
    const profilesWithSimilarity = profiles
      .filter((profile) => profile.combinedEmbedding) // Only profiles with combinedEmbedding
      .map((profile) => {
        const similarity = cosineSimilarity(
          args.queryEmbedding,
          profile.combinedEmbedding!
        );
        // Remove embedding fields from response
        const {
          titleEmbedding,
          descriptionEmbedding,
          combinedEmbedding,
          ...profileWithoutEmbeddings
        } = profile;
        return { ...profileWithoutEmbeddings, similarity };
      });

    // Sort by similarity and return top results
    return profilesWithSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, args.limit ?? 10);
  },
});

// Job Search functions

// Create a pending job search entry
export const createPendingJobSearch = mutation({
  args: {
    query: v.string(),
    location: v.string(),
    numResults: v.number(),
    countryCode: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes from now

    return await ctx.db.insert("jobsSearches", {
      ...args,
      data: {}, // Will be populated when complete
      status: "pending" as const,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update job search with results
export const updateJobSearchResults = mutation({
  args: {
    id: v.id("jobsSearches"),
    data: v.any(),
    status: v.union(v.literal("complete"), v.literal("failed")),
    model: v.optional(v.string()),
    responseTime: v.optional(v.number()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updateData } = args;

    await ctx.db.patch(id, {
      ...updateData,
      updatedAt: Date.now(),
      expiresAt: undefined, // Clear expiration since it's now complete/failed
    });
  },
});

// Update job search location and country code (for reverse job search)
export const updateJobSearchLocationAndCountry = mutation({
  args: {
    id: v.id("jobsSearches"),
    location: v.string(),
    countryCode: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      location: args.location,
      countryCode: args.countryCode,
      updatedAt: Date.now(),
    });
  },
});

// Find job by share link and provider (for duplicate detection)
export const findJobByShareLink = query({
  args: {
    shareLink: v.string(),
    provider: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("jobsResults"),
      jobId: v.string(),
      title: v.string(),
      companyName: v.string(),
      location: v.string(),
      description: v.string(),
      via: v.optional(v.string()),
      shareLink: v.optional(v.string()),
      thumbnail: v.optional(v.string()),
      detectedExtensions: v.optional(v.any()),
      jobHighlights: v.optional(v.any()),
      applyOptions: v.optional(v.any()),
      extensions: v.optional(v.array(v.string())),
      provider: v.string(),
      rawData: v.any(),
      aiData: v.optional(v.any()),
      isProcessed: v.optional(
        v.union(v.literal("false"), v.literal("pending"), v.literal("true"))
      ),
      embedding: v.optional(v.array(v.number())),
      embeddingText: v.optional(v.string()),
      jobType: v.optional(v.string()),
      experienceLevel: v.optional(v.string()),
      salaryRange: v.optional(v.string()),
      industry: v.optional(v.string()),
      workArrangement: v.optional(v.string()),
      userId: v.optional(v.string()),
      searchId: v.optional(v.string()),
      countryCode: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      cronProcessedAt: v.optional(v.number()),
      processingError: v.optional(v.string()),
      staleUpdateProcessedAt: v.optional(v.number()),
      staleUpdateError: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find job with matching shareLink and provider
    const job = await ctx.db
      .query("jobsResults")
      .filter((q) =>
        q.and(
          q.eq(q.field("shareLink"), args.shareLink),
          q.eq(q.field("provider"), args.provider)
        )
      )
      .first();

    return job || null;
  },
});

// Save a job result
export const saveJobResult = mutation({
  args: {
    // Raw job data fields
    jobId: v.string(),
    title: v.string(),
    companyName: v.string(),
    location: v.string(),
    description: v.string(),
    via: v.optional(v.string()),
    shareLink: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    detectedExtensions: v.optional(v.any()),
    jobHighlights: v.optional(v.any()),
    applyOptions: v.optional(v.any()),
    extensions: v.optional(v.array(v.string())),
    provider: v.string(),
    rawData: v.any(),

    // Structured job data (AI processed)
    aiData: v.optional(v.any()),
    isProcessed: v.optional(
      v.union(v.literal("false"), v.literal("pending"), v.literal("true"))
    ),

    // Embeddings
    titleEmbedding: v.optional(v.array(v.number())),
    descriptionEmbedding: v.optional(v.array(v.number())),
    combinedEmbedding: v.optional(v.array(v.number())),
    embeddingText: v.optional(v.string()),

    // Extracted data for filtering
    jobType: v.optional(v.string()),
    experienceLevel: v.optional(v.string()),
    salaryRange: v.optional(v.string()),
    industry: v.optional(v.string()),
    workArrangement: v.optional(v.string()),

    // Metadata
    userId: v.optional(v.string()),
    searchId: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("jobsResults", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update job result with AI-processed data
export const updateJobResultWithAI = mutation({
  args: {
    id: v.id("jobsResults"),
    aiData: v.any(),
    titleEmbedding: v.optional(v.array(v.number())),
    descriptionEmbedding: v.optional(v.array(v.number())),
    combinedEmbedding: v.optional(v.array(v.number())),
    embeddingText: v.optional(v.string()),
    jobType: v.optional(v.string()),
    experienceLevel: v.optional(v.string()),
    salaryRange: v.optional(v.string()),
    industry: v.optional(v.string()),
    workArrangement: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updateData } = args;

    await ctx.db.patch(id, {
      ...updateData,
      isProcessed: "true",
      updatedAt: Date.now(),
    });
  },
});

// Get job search by ID
export const getJobSearch = query({
  args: {
    id: v.id("jobsSearches"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get job result by ID
export const getJobResult = query({
  args: {
    id: v.id("jobsResults"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get job searches with filters
export const getJobSearches = query({
  args: {
    userId: v.optional(v.string()),
    query: v.optional(v.string()),
    location: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    provider: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use the most specific filter available
    if (args.userId) {
      return await ctx.db
        .query("jobsSearches")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(args.limit ?? 50);
    }

    if (args.query) {
      return await ctx.db
        .query("jobsSearches")
        .withIndex("by_query", (q) => q.eq("query", args.query!))
        .order("desc")
        .take(args.limit ?? 50);
    }

    if (args.location) {
      return await ctx.db
        .query("jobsSearches")
        .withIndex("by_location", (q) => q.eq("location", args.location!))
        .order("desc")
        .take(args.limit ?? 50);
    }

    if (args.countryCode) {
      return await ctx.db
        .query("jobsSearches")
        .withIndex("by_country", (q) => q.eq("countryCode", args.countryCode))
        .order("desc")
        .take(args.limit ?? 50);
    }

    if (args.provider) {
      return await ctx.db
        .query("jobsSearches")
        .withIndex("by_provider", (q) => q.eq("provider", args.provider))
        .order("desc")
        .take(args.limit ?? 50);
    }

    // Default: get all searches ordered by creation time
    return await ctx.db
      .query("jobsSearches")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Get job results with filters
export const getJobResults = query({
  args: {
    userId: v.optional(v.string()),
    searchId: v.optional(v.string()),
    title: v.optional(v.string()),
    companyName: v.optional(v.string()),
    location: v.optional(v.string()),
    provider: v.optional(v.string()),
    jobType: v.optional(v.string()),
    experienceLevel: v.optional(v.string()),
    industry: v.optional(v.string()),
    workArrangement: v.optional(v.string()),
    isProcessed: v.optional(
      v.union(v.literal("false"), v.literal("pending"), v.literal("true"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Helper function to remove embedding fields from job results
    const removeEmbeddings = (jobs: any[]) => {
      return jobs.map((job) => {
        const {
          titleEmbedding,
          descriptionEmbedding,
          combinedEmbedding,
          ...jobWithoutEmbeddings
        } = job;
        return jobWithoutEmbeddings;
      });
    };

    let jobs: any[];

    // Use the most specific filter available
    if (args.userId) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.searchId) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_search", (q) => q.eq("searchId", args.searchId))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.title) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_title", (q) => q.eq("title", args.title!))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.companyName) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_company", (q) => q.eq("companyName", args.companyName!))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.location) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_location", (q) => q.eq("location", args.location!))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.provider) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_provider", (q) => q.eq("provider", args.provider!))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.jobType) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_job_type", (q) => q.eq("jobType", args.jobType))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.experienceLevel) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_experience", (q) =>
          q.eq("experienceLevel", args.experienceLevel)
        )
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.industry) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_industry", (q) => q.eq("industry", args.industry))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.workArrangement) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_work_arrangement", (q) =>
          q.eq("workArrangement", args.workArrangement)
        )
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.isProcessed !== undefined) {
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_processed", (q) => q.eq("isProcessed", args.isProcessed))
        .order("desc")
        .take(args.limit ?? 50);
    } else {
      // Default: get all job results ordered by creation time
      jobs = await ctx.db
        .query("jobsResults")
        .withIndex("by_created")
        .order("desc")
        .take(args.limit ?? 50);
    }

    // Remove embedding fields from response
    return removeEmbeddings(jobs);
  },
});

// Find existing job search for duplicate prevention
export const findExistingJobSearch = query({
  args: {
    query: v.string(),
    location: v.string(),
    numResults: v.number(),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use the new comprehensive index for better duplicate detection
    const search = await ctx.db
      .query("jobsSearches")
      .withIndex("by_search_unique", (q) =>
        q
          .eq("query", args.query)
          .eq("location", args.location)
          .eq("countryCode", args.countryCode || undefined)
          .eq("numResults", args.numResults)
      )
      .order("desc")
      .first();

    if (!search) {
      return null;
    }

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    return {
      ...search,
      isStale: search.createdAt < twentyFourHoursAgo,
    };
  },
});

// New function to find or create a job search atomically
export const findOrCreateJobSearch = mutation({
  args: {
    query: v.string(),
    location: v.string(),
    numResults: v.number(),
    countryCode: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // First, try to find an existing search
    const existing = await ctx.db
      .query("jobsSearches")
      .withIndex("by_search_unique", (q) =>
        q
          .eq("query", args.query)
          .eq("location", args.location)
          .eq("countryCode", args.countryCode || undefined)
          .eq("numResults", args.numResults)
      )
      .first();

    if (existing) {
      // If it's complete and not expired (24 hours), return it
      if (existing.status === "complete") {
        const completedAt = existing.updatedAt || existing.createdAt;
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (completedAt > twentyFourHoursAgo) {
          return {
            searchId: existing._id,
            isExisting: true,
            status: "complete",
          };
        }
        // If complete search is older than 24 hours, create a new one (fall through)
      }
      // If it's pending and not expired, return it
      if (
        existing.status === "pending" &&
        existing.expiresAt &&
        existing.expiresAt > Date.now()
      ) {
        return { searchId: existing._id, isExisting: true, status: "pending" };
      }
      // If it's failed or expired, we'll create a new one (fall through)
    }

    // Create a new search
    const searchId = await ctx.db.insert("jobsSearches", {
      query: args.query,
      location: args.location,
      numResults: args.numResults,
      countryCode: args.countryCode,
      data: null,
      status: "pending",
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now
      userId: args.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { searchId, isExisting: false, status: "pending" };
  },
});

// New function to save a job only if it doesn't exist
export const saveJobIfNotExists = mutation({
  args: {
    jobId: v.string(),
    title: v.string(),
    companyName: v.string(),
    location: v.string(),
    description: v.string(),
    via: v.optional(v.string()),
    shareLink: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    detectedExtensions: v.optional(v.any()),
    jobHighlights: v.optional(v.any()),
    applyOptions: v.optional(v.any()),
    extensions: v.optional(v.array(v.string())),
    provider: v.string(),
    rawData: v.any(),
    searchId: v.id("jobsSearches"),
    userId: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if job already exists
    const existing = await ctx.db
      .query("jobsResults")
      .withIndex("by_job_unique", (q) =>
        q
          .eq("jobId", args.jobId)
          .eq("provider", args.provider)
          .eq("countryCode", args.countryCode || undefined)
      )
      .first();

    if (existing) {
      return { jobId: existing._id, isNew: false };
    }

    // Create new job
    const jobId = await ctx.db.insert("jobsResults", {
      jobId: args.jobId,
      title: args.title,
      companyName: args.companyName,
      location: args.location,
      description: args.description,
      via: args.via,
      shareLink: args.shareLink,
      thumbnail: args.thumbnail,
      detectedExtensions: args.detectedExtensions,
      jobHighlights: args.jobHighlights,
      applyOptions: args.applyOptions,
      extensions: args.extensions,
      provider: args.provider,
      rawData: args.rawData,
      searchId: args.searchId,
      userId: args.userId,
      countryCode: args.countryCode,
      isProcessed: "false",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { jobId, isNew: true };
  },
});

// Location filtering and caching functions
export const cacheLocationData = internalMutation({
  args: {
    countryCode: v.string(),
    locations: v.array(v.any()),
    cities: v.array(v.any()),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Store location cache data in a simple key-value format
    // This could be extended to use a proper caching table if needed
    console.log(
      `📦 Caching ${args.locations.length} locations and ${args.cities.length} cities for ${args.countryCode}`
    );
    return null;
  },
});

export const getLocationSuggestions = query({
  args: {
    locationInput: v.string(),
    countryCode: v.string(),
    limit: v.optional(v.number()),
    targetTypes: v.optional(v.array(v.string())),
    minPopulation: v.optional(v.number()),
    prioritiseCities: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      canonical_name: v.string(),
      country_code: v.string(),
      target_type: v.string(),
      reach: v.number(),
      confidence: v.number(),
      matchType: v.union(
        v.literal("exact"),
        v.literal("partial"),
        v.literal("fuzzy")
      ),
    })
  ),
  handler: async (ctx, args) => {
    // This would typically call the location matcher service
    // For now, return empty array as this requires external API integration
    console.log(
      `🔍 Getting location suggestions for "${args.locationInput}" in ${args.countryCode}`
    );
    return [];
  },
});

export const validateLocationMatch = query({
  args: {
    locationInput: v.string(),
    countryCode: v.string(),
    minConfidence: v.optional(v.number()),
  },
  returns: v.object({
    isValid: v.boolean(),
    match: v.optional(
      v.object({
        id: v.string(),
        name: v.string(),
        canonical_name: v.string(),
        country_code: v.string(),
        target_type: v.string(),
        reach: v.number(),
        confidence: v.number(),
        matchType: v.union(
          v.literal("exact"),
          v.literal("partial"),
          v.literal("fuzzy")
        ),
      })
    ),
  }),
  handler: async (ctx, args) => {
    // This would validate location using the enhanced matcher
    console.log(
      `✅ Validating location "${args.locationInput}" in ${args.countryCode}`
    );
    return {
      isValid: false,
      match: undefined,
    };
  },
});

export const getCitiesForCountry = query({
  args: {
    countryCode: v.string(),
    limit: v.optional(v.number()),
    minPopulation: v.optional(v.number()),
    preferBusinessCentres: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      canonical_name: v.string(),
      country_code: v.string(),
      target_type: v.string(),
      reach: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // This would return filtered cities for the country
    console.log(`🏙️ Getting cities for country ${args.countryCode}`);
    return [];
  },
});

// Location analytics and insights
export const getLocationAnalytics = query({
  args: {
    countryCode: v.optional(v.string()),
    timeRange: v.optional(
      v.union(v.literal("day"), v.literal("week"), v.literal("month"))
    ),
  },
  returns: v.object({
    totalSearches: v.number(),
    topLocations: v.array(
      v.object({
        location: v.string(),
        count: v.number(),
        successRate: v.number(),
      })
    ),
    matchTypeDistribution: v.object({
      exact: v.number(),
      partial: v.number(),
      fuzzy: v.number(),
    }),
    averageConfidence: v.number(),
  }),
  handler: async (ctx, args) => {
    // This would analyze location matching patterns from job searches
    const timeRange = args.timeRange || "week";
    const now = Date.now();
    const timeRangeMs =
      timeRange === "day"
        ? 24 * 60 * 60 * 1000
        : timeRange === "week"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

    const startTime = now - timeRangeMs;

    // Get job searches in the time range
    let jobSearches = await ctx.db
      .query("jobsSearches")
      .withIndex("by_created", (q) => q.gte("createdAt", startTime))
      .collect();

    if (args.countryCode) {
      jobSearches = jobSearches.filter(
        (search) =>
          search.countryCode?.toLowerCase() === args.countryCode?.toLowerCase()
      );
    }

    // Analyze location patterns
    const locationCounts: Record<string, number> = {};
    jobSearches.forEach((search) => {
      const location = search.location;
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    });

    const topLocations = Object.entries(locationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([location, count]) => ({
        location,
        count,
        successRate: 0.85, // Placeholder - would calculate actual success rate
      }));

    return {
      totalSearches: jobSearches.length,
      topLocations,
      matchTypeDistribution: {
        exact: Math.floor(jobSearches.length * 0.3),
        partial: Math.floor(jobSearches.length * 0.5),
        fuzzy: Math.floor(jobSearches.length * 0.2),
      },
      averageConfidence: 0.82, // Placeholder
    };
  },
});

// Internal mutation to mark a profile for manual AI processing
export const markProfileForProcessing = internalMutation({
  args: {
    profileId: v.id("linkedinProfiles"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${args.profileId}`);
    }

    // Mark the profile as needing processing by setting isProcessed to false
    await ctx.db.patch(args.profileId, {
      isProcessed: "false",
      updatedAt: Date.now(),
    });

    console.log(`✅ Marked profile ${args.profileId} for AI processing`);
  },
});

// Internal action to process a job with AI
export const processJobWithAI = internalAction({
  args: {
    jobId: v.id("jobsResults"),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`🤖 Processing job ${args.jobId} with AI`);

      // Get environment variables
      const apiUrl = process.env.CS_API_BASE_URL;
      const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

      if (!apiUrl) {
        throw new Error("CS_API_BASE_URL environment variable not set");
      }

      if (!bypassSecret) {
        throw new Error(
          "VERCEL_AUTOMATION_BYPASS_SECRET environment variable not set"
        );
      }

      console.log(`📡 Calling API at: ${apiUrl}/api/jobs/process-unprocessed`);

      const response = await fetch(`${apiUrl}/api/jobs/process-unprocessed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vercel-protection-bypass": bypassSecret,
        },
        body: JSON.stringify({
          jobIds: [args.jobId], // Process just this one job
          limit: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API call failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to process job");
      }

      console.log(`✅ Successfully processed job via API: ${args.jobId}`);
      return { success: true, result };
    } catch (error) {
      console.error(`❌ Failed to process job ${args.jobId}:`, error);

      // Mark the job as having an error
      await ctx.runMutation(internal.functions.markJobError, {
        jobId: args.jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});

// Internal mutation to mark job as having an error
export const markJobError = internalMutation({
  args: {
    jobId: v.id("jobsResults"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      processingError: args.error,
      isProcessed: "false", // Reset to false so it can be retried
      updatedAt: Date.now(),
    });
  },
});

// Internal query to get a job by ID
export const getJobById = internalQuery({
  args: {
    jobId: v.id("jobsResults"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Internal mutation to update job with AI-parsed data
export const updateJobWithAIData = internalMutation({
  args: {
    jobId: v.id("jobsResults"),
    aiData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      aiData: args.aiData,
      isProcessed: "true",
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation to process unprocessed jobs (called by cron job)
export const processUnprocessedJobs = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50; // Process 50 jobs at a time by default

    console.log(
      `🔄 Cron job: Looking for unprocessed jobs (batch size: ${batchSize})`
    );

    // Query for unprocessed jobs that have raw data (only process "false" status, not "pending")
    const unprocessedJobs = await ctx.db
      .query("jobsResults")
      .filter((q) =>
        q.and(
          q.eq(q.field("isProcessed"), "false"),
          q.neq(q.field("rawData"), null)
        )
      )
      .take(batchSize);

    if (unprocessedJobs.length === 0) {
      console.log("✅ Cron job: No unprocessed jobs found");
      return {
        processed: 0,
        errors: 0,
        message: "No unprocessed jobs found",
      };
    }

    console.log(
      `📝 Cron job: Found ${unprocessedJobs.length} unprocessed jobs`
    );

    let processedCount = 0;
    let errorCount = 0;

    for (const job of unprocessedJobs) {
      try {
        console.log(`🔄 Processing job: ${job.title} (${job.companyName})`);

        // Mark the job as pending before scheduling AI processing
        await ctx.db.patch(job._id, {
          isProcessed: "pending",
          updatedAt: Date.now(),
        });

        // Schedule the AI processing action to run
        await ctx.scheduler.runAfter(0, internal.functions.processJobWithAI, {
          jobId: job._id,
        });

        processedCount++;
        console.log(`✅ Queued AI processing for: ${job.title}`);
      } catch (error) {
        console.error(`❌ Failed to process job ${job.title}:`, error);
        errorCount++;

        // Mark the job with an error flag
        await ctx.db.patch(job._id, {
          processingError:
            error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        });
      }
    }

    const message = `Processed ${processedCount} jobs, ${errorCount} errors`;
    console.log(`🎉 Cron job completed: ${message}`);

    return {
      processed: processedCount,
      errors: errorCount,
      message,
    };
  },
});

// Manual trigger to process unprocessed jobs (for testing/manual runs)
export const triggerJobProcessing = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ processed: number; errors: number; message: string }> => {
    // Call the internal mutation
    return await ctx.runMutation(internal.functions.processUnprocessedJobs, {
      batchSize: args.batchSize || 50,
    });
  },
});
