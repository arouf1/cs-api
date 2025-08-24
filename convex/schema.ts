import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Example table for API logs
  apiLogs: defineTable({
    endpoint: v.string(),
    method: v.string(),
    timestamp: v.number(),
    responseTime: v.optional(v.number()),
    statusCode: v.optional(v.number()),
    userId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }).index("by_timestamp", ["timestamp"]),

  // Research reports table with embeddings for semantic search
  researchReports: defineTable({
    // Research parameters
    company: v.string(),
    position: v.string(),
    location: v.string(),

    // Research results
    type: v.union(
      v.literal("structured"),
      v.literal("completion"),
      v.literal("streaming")
    ),
    data: v.any(), // The actual research data (structured or text)

    // Status tracking for duplicate prevention
    status: v.optional(
      v.union(v.literal("pending"), v.literal("complete"), v.literal("failed"))
    ),
    expiresAt: v.optional(v.number()), // For pending entries timeout (5 minutes)

    // Embeddings for semantic search (only populated when complete)
    embedding: v.optional(v.array(v.number())), // Vector embedding of the research content
    embeddingText: v.optional(v.string()), // The text that was embedded (for reference)

    // Metadata
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),

    // Additional metadata
    model: v.optional(v.string()), // AI model used for research
    responseTime: v.optional(v.number()), // Time taken to generate
    costDollars: v.optional(v.number()), // Total cost in USD for the research
  })
    .index("by_company", ["company"])
    .index("by_position", ["position"])
    .index("by_location", ["location"])
    .index("by_created", ["createdAt"])
    .index("by_user", ["userId"])
    .index("by_company_position", ["company", "position"])
    .index("by_status", ["status"])
    .index("by_expires", ["expiresAt"])
    .index("by_research_key", ["company", "position", "location", "type"]), // For duplicate detection

  // LinkedIn searches table for tracking search requests
  linkedinSearches: defineTable({
    // Search parameters
    jobTitle: v.string(),
    userLocation: v.string(),
    numResults: v.number(),

    // Search results
    data: v.any(), // The actual search results

    // Status tracking for duplicate prevention
    status: v.optional(
      v.union(v.literal("pending"), v.literal("complete"), v.literal("failed"))
    ),
    expiresAt: v.optional(v.number()), // For pending entries timeout (5 minutes)

    // Metadata
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),

    // Additional metadata
    model: v.optional(v.string()), // AI model used for parsing
    responseTime: v.optional(v.number()), // Time taken to complete search
    costDollars: v.optional(v.number()), // Total cost in USD for the search
  })
    .index("by_job_title", ["jobTitle"])
    .index("by_location", ["userLocation"])
    .index("by_created", ["createdAt"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_expires", ["expiresAt"])
    .index("by_search_key", ["jobTitle", "userLocation", "numResults"]), // For duplicate detection

  // LinkedIn profiles table with embeddings for semantic search
  linkedinProfiles: defineTable({
    // Exa API structured fields
    exaId: v.string(), // The Exa result ID (URL)
    title: v.string(), // Profile title from Exa
    url: v.string(), // LinkedIn profile URL
    publishedDate: v.optional(v.string()), // ISO date string from Exa
    author: v.string(), // Profile owner name
    image: v.optional(v.string()), // Profile image URL from LinkedIn

    // Full structured profile data
    aiData: v.any(), // The complete StructuredLinkedInProfile object (AI processed)
    text: v.optional(v.string()), // Raw text content from Exa

    // Processing status
    isProcessed: v.optional(v.boolean()), // Whether AI processing is complete
    rawData: v.optional(v.any()), // Raw profile data from Exa for AI processing

    // Embeddings for semantic search
    embedding: v.optional(v.array(v.number())), // Vector embedding of the profile content
    embeddingText: v.optional(v.string()), // The text that was embedded (for reference)

    // Extracted profile data from rawData.text
    profileLocation: v.optional(v.string()), // Extracted location from "Location: ..." in profile text
    position: v.optional(v.string()), // Extracted position from "Position: ..." in profile text

    // Metadata
    userId: v.optional(v.string()),
    searchId: v.optional(v.string()), // Link back to the search that found this profile
    userLocation: v.optional(v.string()), // The location parameter used in the original search query (e.g., "GB", "US", "London")
    createdAt: v.number(),
    updatedAt: v.number(),

    // Cron job tracking
    cronProcessedAt: v.optional(v.number()), // When the cron job last touched this profile
    processingError: v.optional(v.string()), // Error message if processing failed
    staleUpdateProcessedAt: v.optional(v.number()), // When the stale update cron job last touched this profile
    staleUpdateError: v.optional(v.string()), // Error message if stale update failed
  })
    .index("by_created", ["createdAt"])
    .index("by_user", ["userId"])
    .index("by_search", ["searchId"])
    .index("by_processed", ["isProcessed"]) // For finding unprocessed profiles
    .index("by_exa_id", ["exaId"]) // For duplicate detection
    .index("by_url", ["url"]) // For URL-based lookups
    .index("by_author", ["author"]) // For filtering by profile owner
    .index("by_location", ["userLocation"]) // For location-based filtering
    .index("by_profile_location", ["profileLocation"]) // For filtering by extracted profile location
    .index("by_position", ["position"]), // For filtering by extracted position

  // Job searches table for tracking job search requests
  jobsSearches: defineTable({
    // Search parameters
    query: v.string(),
    location: v.string(),
    numResults: v.number(),
    countryCode: v.optional(v.string()),

    // Search results
    data: v.any(), // The actual search results

    // Status tracking for duplicate prevention
    status: v.optional(
      v.union(v.literal("pending"), v.literal("complete"), v.literal("failed"))
    ),
    expiresAt: v.optional(v.number()), // For pending entries timeout (5 minutes)

    // Metadata
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),

    // Additional metadata
    model: v.optional(v.string()), // AI model used for parsing
    responseTime: v.optional(v.number()), // Time taken to complete search
    provider: v.optional(v.string()), // "scrapingdog" or "serpapi"
  })
    .index("by_query", ["query"])
    .index("by_location", ["location"])
    .index("by_country", ["countryCode"])
    .index("by_created", ["createdAt"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_expires", ["expiresAt"])
    .index("by_provider", ["provider"])
    .index("by_search_unique", [
      "query",
      "location",
      "countryCode",
      "numResults",
    ]), // For comprehensive duplicate detection

  // Job results table with embeddings for semantic search
  jobsResults: defineTable({
    // Raw job data fields (from RawJobData interface)
    jobId: v.string(), // The job_id from provider or generated ID
    title: v.string(),
    companyName: v.string(),
    location: v.string(),
    description: v.string(),
    via: v.optional(v.string()), // Source platform (e.g., "Indeed", "LinkedIn")
    shareLink: v.optional(v.string()), // Link to original job posting
    thumbnail: v.optional(v.string()), // Company logo/thumbnail
    detectedExtensions: v.optional(v.any()), // Parsed job metadata
    jobHighlights: v.optional(v.any()), // Structured job highlights
    applyOptions: v.optional(v.any()), // Application options
    extensions: v.optional(v.array(v.string())), // Job tags (e.g., "Full-time", "2 days ago")
    provider: v.string(), // "serpapi" or "reverse"
    rawData: v.any(), // Original response for debugging

    // Full structured job data (AI processed)
    aiData: v.optional(v.any()), // The complete StructuredJob object (AI processed)

    // Processing status
    isProcessed: v.optional(v.boolean()), // Whether AI processing is complete

    // Embeddings for semantic search
    embedding: v.optional(v.array(v.number())), // Vector embedding of the job content
    embeddingText: v.optional(v.string()), // The text that was embedded (for reference)

    // Extracted job data for filtering
    jobType: v.optional(v.string()), // "Full-time", "Part-time", "Contract", etc.
    experienceLevel: v.optional(v.string()), // "Entry", "Mid", "Senior", etc.
    salaryRange: v.optional(v.string()), // Extracted salary information
    industry: v.optional(v.string()), // Extracted industry
    workArrangement: v.optional(v.string()), // "Remote", "Hybrid", "On-site"

    // Metadata
    userId: v.optional(v.string()),
    searchId: v.optional(v.string()), // Link back to the search that found this job
    countryCode: v.optional(v.string()), // The country code used in the original search
    createdAt: v.number(),
    updatedAt: v.number(),

    // Cron job tracking
    cronProcessedAt: v.optional(v.number()), // When the cron job last touched this job
    processingError: v.optional(v.string()), // Error message if processing failed
    staleUpdateProcessedAt: v.optional(v.number()), // When the stale update cron job last touched this job
    staleUpdateError: v.optional(v.string()), // Error message if stale update failed
  })
    .index("by_created", ["createdAt"])
    .index("by_user", ["userId"])
    .index("by_search", ["searchId"])
    .index("by_processed", ["isProcessed"]) // For finding unprocessed jobs
    .index("by_job_id", ["jobId"]) // For duplicate detection
    .index("by_job_unique", ["jobId", "provider", "countryCode"]) // For comprehensive duplicate detection
    .index("by_title", ["title"]) // For filtering by job title
    .index("by_company", ["companyName"]) // For filtering by company
    .index("by_location", ["location"]) // For location-based filtering
    .index("by_provider", ["provider"]) // For filtering by data provider
    .index("by_job_type", ["jobType"]) // For filtering by job type
    .index("by_experience", ["experienceLevel"]) // For filtering by experience level
    .index("by_industry", ["industry"]) // For filtering by industry
    .index("by_work_arrangement", ["workArrangement"]), // For filtering by work arrangement
});
