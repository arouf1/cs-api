import { convex } from "../core/convex";
import { generateEmbedding, prepareTextForEmbedding } from "../core/embeddings";
import type {
  JobSearchParams,
  JobSearchResult,
  StructuredJob,
} from "./jobSearch";

/**
 * Service for storing and retrieving job search data with embeddings
 */

export interface StoredJobSearch {
  _id: string;
  query: string;
  location: string;
  numResults: number;
  countryCode?: string;
  data: any;
  status?: "pending" | "complete" | "failed";
  expiresAt?: number;
  userId?: string;
  model?: string;
  responseTime?: number;
  costDollars?: number;
  provider?: string;
  createdAt: number;
  updatedAt: number;
  isStale?: boolean; // Added by findExistingJobSearch
}

export interface StoredJobResult {
  _id: string;
  // Raw job data fields
  jobId: string;
  title: string;
  companyName: string;
  location: string;
  description: string;
  via?: string;
  shareLink?: string;
  thumbnail?: string;
  detectedExtensions?: any;
  jobHighlights?: any;
  applyOptions?: any;
  extensions?: string[];
  provider: "serpapi" | "reverse";
  rawData: any;

  // Structured job data
  aiData?: StructuredJob;
  isProcessed?: "false" | "pending" | "true";
  titleEmbedding?: number[];
  descriptionEmbedding?: number[];
  combinedEmbedding?: number[];
  embeddingText?: string;

  // Extracted data for filtering
  jobType?: string;
  experienceLevel?: string;
  salaryRange?: string;
  industry?: string;
  workArrangement?: string;

  // Metadata
  userId?: string;
  searchId?: string;
  countryCode?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Create a pending job search entry
 */
export async function createPendingJobSearch(
  params: JobSearchParams,
  options: {
    userId?: string;
  } = {}
): Promise<{ searchId: string; isExisting: boolean; status: string }> {
  try {
    console.log("Creating/finding job search with params:", {
      params,
      options,
    });

    const result = await convex.mutation(
      "functions:findOrCreateJobSearch" as any,
      {
        query: params.query,
        location: params.location,
        numResults: params.numResults,
        countryCode: params.countryCode,
        userId: options.userId,
      }
    );

    console.log("Job search result:", result);
    return result;
  } catch (error) {
    console.error("Failed to create/find job search:", error);
    throw new Error("Failed to create/find job search");
  }
}

/**
 * Update job search with results
 */
export async function updateJobSearchResults(
  searchId: string,
  result: JobSearchResult,
  options: {
    userId?: string;
    model?: string;
    responseTime?: number;
  } = {}
): Promise<void> {
  try {
    console.log("Updating job search results with searchId:", searchId);

    if (!searchId) {
      throw new Error("searchId is required to update job search results");
    }

    const mutationArgs = {
      id: searchId as any,
      data: {
        totalFound: result.totalFound,
        jobCount: result.jobs.length,
        searchParams: result.searchParams,
      },
      status: "complete" as const,
      model: options.model,
      responseTime: options.responseTime,
      provider: result.provider,
    };

    console.log("Mutation args:", JSON.stringify(mutationArgs, null, 2));

    // Update in Convex
    await convex.mutation(
      "functions:updateJobSearchResults" as any,
      mutationArgs
    );
  } catch (error) {
    console.error("Failed to update job search results:", error);
    throw new Error("Failed to update job search results");
  }
}

/**
 * Mark job search as failed
 */
export async function markJobSearchFailed(
  searchId: string,
  error?: string
): Promise<void> {
  try {
    await convex.mutation("functions:updateJobSearchResults" as any, {
      id: searchId as any,
      data: { error: error || "Job search failed" },
      status: "failed" as const,
    });
  } catch (err) {
    console.error("Failed to mark job search as failed:", err);
    throw new Error("Failed to mark job search as failed");
  }
}

/**
 * Store a raw job result in the database (without AI processing)
 */
export async function storeRawJobResult(
  rawJob: any,
  searchId: string,
  options: {
    userId?: string;
    countryCode?: string;
  } = {}
): Promise<string> {
  try {
    const result = await convex.mutation(
      "functions:saveJobIfNotExists" as any,
      {
        jobId:
          rawJob.id ||
          rawJob.job_id ||
          `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: rawJob.title || "Unknown Title",
        companyName: rawJob.company_name || "Unknown Company",
        location: rawJob.location || "",
        description: rawJob.description || "",
        via: rawJob.via,
        shareLink: rawJob.share_link,
        thumbnail: rawJob.thumbnail,
        detectedExtensions: rawJob.detected_extensions,
        jobHighlights: rawJob.job_highlights,
        applyOptions: rawJob.apply_options,
        extensions: rawJob.extensions,
        provider: rawJob.provider,
        rawData: rawJob,
        searchId: searchId as any,
        userId: options.userId,
        countryCode: options.countryCode,
      }
    );

    if (!result.isNew) {
      console.log(
        `Job ${rawJob.id || rawJob.job_id} already exists, skipping duplicate`
      );
    } else {
      console.log("Stored raw job result with ID:", result.jobId);
    }

    return result.jobId;
  } catch (error) {
    console.error("Failed to store raw job result:", error);
    throw new Error("Failed to store raw job result");
  }
}

/**
 * Store a job result with embeddings
 */
export async function storeJobResult(
  job: StructuredJob,
  rawJobData: any,
  options: {
    userId?: string;
    searchId?: string;
    countryCode?: string;
    isProcessed?: "false" | "pending" | "true";
  } = {}
): Promise<string> {
  try {
    let embedding:
      | {
          titleEmbedding: number[];
          descriptionEmbedding: number[];
          combinedEmbedding: number[];
        }
      | undefined;
    let embeddingText: string | undefined;

    // Only generate embeddings for processed jobs (to save costs)
    if (options.isProcessed === "true") {
      // Prepare different texts for different embeddings
      const titleText = `${job.title} at ${job.company} in ${job.location}`;
      const descriptionText = [
        `Job Type: ${job.jobType || ""}`,
        `Experience Level: ${job.experienceLevel || ""}`,
        `Description: ${job.description}`,
        `Requirements: ${job.requirements.essential.join(", ")}`,
        `Skills: ${job.requirements.skills.join(", ")}`,
        `Benefits: ${job.benefits.join(", ")}`,
        `Industry: ${job.jobAnalysis.industry || ""}`,
        `Work Arrangement: ${job.jobAnalysis.workArrangement}`,
        `Key Responsibilities: ${job.jobAnalysis.keyResponsibilities.join(", ")}`,
      ].join(" ");

      embeddingText = [titleText, descriptionText].join(" ");

      // Generate separate embeddings
      const [titleEmbedding, descriptionEmbedding, combinedEmbedding] =
        await Promise.all([
          generateEmbedding(titleText),
          generateEmbedding(descriptionText),
          generateEmbedding(embeddingText),
        ]);

      embedding = { titleEmbedding, descriptionEmbedding, combinedEmbedding };
    }

    // Extract data for filtering
    const jobType = job.jobType;
    const experienceLevel = job.experienceLevel;
    const salaryRange = job.salaryRange;
    const industry = job.jobAnalysis.industry;
    const workArrangement = job.jobAnalysis.workArrangement;

    // Store in Convex
    const jobResultId = await convex.mutation(
      "functions:saveJobResult" as any,
      {
        // Raw job data fields
        jobId: rawJobData.id,
        title: rawJobData.title,
        companyName: rawJobData.company_name,
        location: rawJobData.location,
        description: rawJobData.description,
        via: rawJobData.via,
        shareLink: rawJobData.share_link,
        thumbnail: rawJobData.thumbnail,
        detectedExtensions: rawJobData.detected_extensions,
        jobHighlights: rawJobData.job_highlights,
        applyOptions:
          rawJobData.apply_options || job.applicationDetails.applyOptions,
        extensions: rawJobData.extensions,
        provider: rawJobData.provider,
        rawData: rawJobData.raw_data,

        // Structured job data (AI processed)
        aiData: job,
        isProcessed: options.isProcessed ?? "true",

        // Embeddings
        titleEmbedding: embedding?.titleEmbedding,
        descriptionEmbedding: embedding?.descriptionEmbedding,
        combinedEmbedding: embedding?.combinedEmbedding,
        embeddingText: embeddingText
          ? prepareTextForEmbedding(embeddingText)
          : undefined,

        // Extracted data for filtering
        jobType,
        experienceLevel,
        salaryRange,
        industry,
        workArrangement,

        // Metadata
        userId: options.userId,
        searchId: options.searchId,
        countryCode: options.countryCode,
      }
    );

    return jobResultId;
  } catch (error) {
    console.error("Failed to store job result:", error);
    throw new Error("Failed to store job result");
  }
}

/**
 * Update job result with AI-processed data
 */
export async function updateJobResultWithAI(
  jobResultId: string,
  processedJob: StructuredJob
): Promise<void> {
  try {
    // Prepare different texts for different embeddings
    const titleText = `${processedJob.title} at ${processedJob.company} in ${processedJob.location}`;
    const descriptionText = [
      `Job Type: ${processedJob.jobType || ""}`,
      `Experience Level: ${processedJob.experienceLevel || ""}`,
      `Description: ${processedJob.description}`,
      `Requirements: ${processedJob.requirements.essential.join(", ")}`,
      `Skills: ${processedJob.requirements.skills.join(", ")}`,
      `Benefits: ${processedJob.benefits.join(", ")}`,
      `Industry: ${processedJob.jobAnalysis.industry || ""}`,
      `Work Arrangement: ${processedJob.jobAnalysis.workArrangement}`,
      `Key Responsibilities: ${processedJob.jobAnalysis.keyResponsibilities.join(", ")}`,
    ].join(" ");
    
    const embeddingText = [titleText, descriptionText].join(" ");

    // Generate separate embeddings
    const [titleEmbedding, descriptionEmbedding, combinedEmbedding] = await Promise.all([
      generateEmbedding(titleText),
      generateEmbedding(descriptionText),
      generateEmbedding(embeddingText)
    ]);

    // Extract data for filtering (convert null to undefined for Convex)
    const jobType = processedJob.jobType || undefined;
    const experienceLevel = processedJob.experienceLevel || undefined;
    const salaryRange = processedJob.salaryRange || undefined;
    const industry = processedJob.jobAnalysis.industry || undefined;
    const workArrangement =
      processedJob.jobAnalysis.workArrangement || undefined;

    // Prepare update data, filtering out undefined values
    const updateData: any = {
      id: jobResultId as any,
      aiData: processedJob,
      titleEmbedding,
      descriptionEmbedding,
      combinedEmbedding,
      embeddingText: prepareTextForEmbedding(embeddingText),
    };

    // Only include optional fields if they have values
    if (jobType) updateData.jobType = jobType;
    if (experienceLevel) updateData.experienceLevel = experienceLevel;
    if (salaryRange) updateData.salaryRange = salaryRange;
    if (industry) updateData.industry = industry;
    if (workArrangement) updateData.workArrangement = workArrangement;

    // Update in Convex
    await convex.mutation("functions:updateJobResultWithAI" as any, updateData);
  } catch (error) {
    console.error("Failed to update job result with AI:", error);
    throw new Error("Failed to update job result with AI");
  }
}

/**
 * Retrieve a job search by ID
 */
export async function getJobSearch(
  id: string
): Promise<StoredJobSearch | null> {
  try {
    return await convex.query("functions:getJobSearch" as any, {
      id: id as any,
    });
  } catch (error) {
    console.error("Failed to get job search:", error);
    return null;
  }
}

/**
 * Retrieve a job result by ID
 */
export async function getJobResult(
  id: string
): Promise<StoredJobResult | null> {
  try {
    return await convex.query("functions:getJobResult" as any, {
      id: id as any,
    });
  } catch (error) {
    console.error("Failed to get job result:", error);
    return null;
  }
}

/**
 * Get job searches with optional filters
 */
export async function getJobSearches(
  filters: {
    userId?: string;
    query?: string;
    location?: string;
    countryCode?: string;
    provider?: string;
    limit?: number;
  } = {}
): Promise<StoredJobSearch[]> {
  try {
    return await convex.query("functions:getJobSearches" as any, filters);
  } catch (error) {
    console.error("Failed to get job searches:", error);
    return [];
  }
}

/**
 * Get job results with optional filters
 */
export async function getJobResults(
  filters: {
    userId?: string;
    searchId?: string;
    title?: string;
    companyName?: string;
    location?: string;
    provider?: string;
    jobType?: string;
    experienceLevel?: string;
    industry?: string;
    workArrangement?: string;
    isProcessed?: "false" | "pending" | "true";
    limit?: number;
  } = {}
): Promise<StoredJobResult[]> {
  try {
    return await convex.query("functions:getJobResults" as any, filters);
  } catch (error) {
    console.error("Failed to get job results:", error);
    return [];
  }
}

/**
 * Find existing job search for duplicate prevention
 */
export async function findExistingJobSearch(
  params: JobSearchParams
): Promise<StoredJobSearch | null> {
  try {
    return await convex.query("functions:findExistingJobSearch" as any, {
      query: params.query,
      location: params.location,
      numResults: params.numResults,
      countryCode: params.countryCode,
    });
  } catch (error) {
    console.error("Failed to find existing job search:", error);
    return null;
  }
}

/**
 * Clean up expired job entries
 */
export async function cleanupExpiredJobEntries(): Promise<{
  deletedCount: number;
}> {
  try {
    // This would be called by a cron job
    // For now, return a placeholder
    return { deletedCount: 0 };
  } catch (error) {
    console.error("Failed to cleanup expired job entries:", error);
    return { deletedCount: 0 };
  }
}

/**
 * Search job results by similarity (semantic search)
 */
export async function searchJobResults(
  query: string,
  options: {
    userId?: string;
    limit?: number;
  } = {}
): Promise<StoredJobResult[]> {
  try {
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // This would use a semantic search function in Convex
    // For now, return empty array as placeholder
    return [];
  } catch (error) {
    console.error("Failed to search job results:", error);
    return [];
  }
}

/**
 * Find existing reverse job by URL to prevent duplicates
 */
export async function findExistingReverseJob(
  url: string
): Promise<StoredJobResult | null> {
  try {
    console.log(
      `🔍 Searching for existing job with shareLink: ${url} and provider: reverse`
    );

    // Use the existing getJobResults function to find jobs with this provider
    const reverseJobs = await getJobResults({
      provider: "reverse",
      limit: 100, // Get more results to search through
    });

    console.log(`📊 Found ${reverseJobs.length} reverse jobs to check`);

    // Find job with matching shareLink
    const existingJob = reverseJobs.find((job) => job.shareLink === url);

    console.log(
      `📊 Query result:`,
      existingJob ? `Found job: ${existingJob.title}` : "No job found"
    );
    return existingJob || null;
  } catch (error) {
    console.error("Failed to find existing reverse job:", error);
    console.error("Error details:", error);
    return null;
  }
}
