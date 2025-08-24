import axios from "axios";
import { generateObject } from "ai";
import { z } from "zod";
import { getChatModel } from "../external/openrouter";
import { findBestLocationMatch } from "./location-matcher";

// AI model for job parsing
const JOB_AI_MODEL = "gpt-4.1-mini";

export interface JobSearchParams {
  query: string;
  location: string;
  numResults?: number;
  countryCode?: string;
}

export interface JobSearchOptions {
  userId?: string;
  storeResult?: boolean;
}

export interface ReverseJobSearchParams {
  url: string;
}

export interface ReverseJobSearchOptions {
  userId?: string;
}

// Raw job data from providers
export interface RawJobData {
  id: string;
  title: string;
  company_name: string;
  location: string;
  description: string;
  via?: string;
  share_link?: string;
  thumbnail?: string;
  detected_extensions?: Record<string, any>;
  job_highlights?: Array<{
    title: string;
    items: string[];
  }>;
  apply_options?: Array<{
    title: string;
    link: string;
  }>;
  extensions?: string[];
  job_id?: string;
  provider: "serpapi" | "reverse";
  raw_data: any; // Store original response for debugging
}

// Structured job schema for unified data
const StructuredJobSchema = z.object({
  // Basic information
  title: z.string().describe("Job title"),
  company: z.string().describe("Company name"),
  location: z.string().describe("Job location"),
  description: z.string().describe("Full job description"),

  // Job details
  jobType: z
    .string()
    .nullable()
    .describe("Employment type (Full-time, Part-time, Contract, etc.)"),
  salaryRange: z.string().nullable().describe("Salary range if mentioned"),
  experienceLevel: z
    .enum(["Entry", "Mid", "Senior", "Lead", "Executive"])
    .nullable()
    .describe("Required experience level"),

  // Requirements and qualifications
  requirements: z
    .object({
      essential: z
        .array(z.string())
        .describe("Essential requirements and qualifications"),
      preferred: z.array(z.string()).describe("Preferred qualifications"),
      skills: z
        .array(z.string())
        .describe("Required technical and soft skills"),
      experience: z
        .string()
        .nullable()
        .describe("Years of experience required"),
      education: z.string().nullable().describe("Educational requirements"),
    })
    .describe("Job requirements breakdown"),

  // Benefits and perks
  benefits: z
    .array(z.string())
    .describe("Company benefits and perks mentioned"),

  // AI-generated job analysis
  jobAnalysis: z
    .object({
      summary: z
        .string()
        .describe("2-3 sentence summary of the role and its key aspects"),
      keyResponsibilities: z
        .array(z.string())
        .describe("Main job responsibilities"),
      idealCandidate: z
        .string()
        .describe("Description of the ideal candidate profile"),
      careerProgression: z
        .string()
        .nullable()
        .describe("Potential career progression opportunities"),
      companySize: z
        .enum(["Startup", "Small", "Medium", "Large", "Enterprise"])
        .nullable()
        .describe("Estimated company size"),
      industry: z.string().nullable().describe("Industry sector"),
      workArrangement: z
        .enum(["Remote", "Hybrid", "On-site", "Unknown"])
        .describe("Work arrangement"),
    })
    .describe("AI-generated comprehensive job analysis"),

  // Application details
  applicationDetails: z
    .object({
      applyOptions: z
        .array(
          z.object({
            platform: z.string(),
            url: z.string(),
          })
        )
        .describe("Where to apply for this job"),
      postedDate: z.string().nullable().describe("When the job was posted"),
      applicationDeadline: z
        .string()
        .nullable()
        .describe("Application deadline if mentioned"),
    })
    .describe("How and when to apply"),

  // Metadata
  sourceUrl: z.string().describe("Original job posting URL"),
  provider: z.enum(["serpapi", "reverse"]).describe("Data provider used"),
  lastUpdated: z.string().describe("When the job data was last scraped"),
});

export type StructuredJob = z.infer<typeof StructuredJobSchema>;

export interface JobSearchResult {
  searchId: string;
  jobs: StructuredJob[];
  totalFound: number;
  searchParams: JobSearchParams;
  costDollars: number;
  responseTime: number;
  provider: "serpapi" | "reverse";
  rawJobs?: RawJobData[]; // Include raw jobs for individual storage
  convexJobIds?: string[]; // Convex document IDs for AI processing
}

export interface ReverseJobSearchResult {
  job: StructuredJob;
  jobId: string;
  responseTime: number;
}

/**
 * Main job search function with provider fallback
 */
export async function searchJobs(
  params: JobSearchParams,
  options: JobSearchOptions = {}
): Promise<{
  result?: JobSearchResult;
  searchId: string;
  status: "pending" | "complete" | "failed";
  isExisting?: boolean;
}> {
  const {
    createPendingJobSearch,
    updateJobSearchResults,
    markJobSearchFailed,
    findExistingJobSearch,
    storeRawJobResult,
    getJobSearch,
    getJobResults,
  } = await import("./job-storage");

  try {
    // Validate and set defaults for parameters
    const validatedParams = validateJobSearchParams(params);

    // Duplicate detection enabled - will return existing searches if found
    console.log(
      "Checking for existing searches with duplicate detection enabled"
    );

    // Create pending search entry (or get existing one)
    const searchResult = await createPendingJobSearch(validatedParams, {
      userId: options.userId,
    });

    console.log("Job search result:", searchResult);

    // If we found an existing complete search, return it immediately
    if (searchResult.isExisting && searchResult.status === "complete") {
      const existingSearch = await getJobSearch(searchResult.searchId);
      if (existingSearch && existingSearch.data) {
        const jobResults = await getJobResults({
          searchId: searchResult.searchId,
        });
        return {
          result: {
            ...existingSearch.data,
            jobs: jobResults || [],
          },
          searchId: searchResult.searchId,
          status: "complete",
          isExisting: true,
        };
      }
    }

    // If we found an existing pending search, return it
    if (searchResult.isExisting && searchResult.status === "pending") {
      return {
        searchId: searchResult.searchId,
        status: "pending",
        isExisting: true,
      };
    }

    const searchId = searchResult.searchId;

    try {
      // Execute the search
      const startTime = Date.now();
      const result = await executeJobSearch(searchId, validatedParams, options);
      const responseTime = Date.now() - startTime;

      // Update search with results
      await updateJobSearchResults(searchId, result, {
        userId: options.userId,
        responseTime,
      });

      // Store individual job results immediately (without AI processing)
      const rawJobIds: string[] = [];

      // Get the raw jobs from the result and store them
      if (result.rawJobs && result.rawJobs.length > 0) {
        // Store jobs for SerpAPI
        for (const rawJob of result.rawJobs) {
          try {
            const jobId = await storeRawJobResult(rawJob, searchId, {
              userId: options.userId,
              countryCode: validatedParams.countryCode,
            });
            rawJobIds.push(jobId);
          } catch (error) {
            console.error("Failed to store individual job result:", error);
          }
        }
        console.log(
          `Stored ${rawJobIds.length} individual job results for search ${searchId}`
        );

        // AI processing will be handled by cron job
        console.log(
          `📋 Stored ${rawJobIds.length} jobs for cron-based AI processing`
        );
      } else {
        console.log("No raw jobs found to store individually");
      }

      return {
        result,
        searchId,
        status: "complete",
      };
    } catch (error) {
      console.error("Job search execution failed:", error);

      // Mark search as failed
      await markJobSearchFailed(
        searchId,
        error instanceof Error ? error.message : "Unknown error"
      );

      return {
        searchId,
        status: "failed",
      };
    }
  } catch (error) {
    console.error("Job search setup failed:", error);

    // Generate a fallback search ID for error response
    const fallbackSearchId = generateSearchId();

    return {
      searchId: fallbackSearchId,
      status: "failed",
    };
  }
}

/**
 * Execute the actual job search with provider fallback
 */
async function executeJobSearch(
  searchId: string,
  params: JobSearchParams,
  options: JobSearchOptions = {}
): Promise<JobSearchResult> {
  const startTime = Date.now();
  let rawJobs: RawJobData[] = [];
  let provider: "serpapi" = "serpapi";
  let costDollars = 0;
  let convexJobIds: string[] = [];

  try {
    // Use SerpAPI as the primary (and only) provider
    console.log("Attempting job search with SerpAPI...");
    const serpApiResult = await searchWithSerpAPI(params);
    rawJobs = serpApiResult.jobs;
    provider = "serpapi";
    costDollars = serpApiResult.cost;
    console.log(`Found ${rawJobs.length} jobs with SerpAPI`);
  } catch (serpApiError) {
    console.error("SerpAPI failed:", serpApiError);
    throw new Error("Job search provider failed");
  }

  const responseTime = Date.now() - startTime;

  // Create placeholder structured jobs - AI processing will happen later in background
  const placeholderJobs: StructuredJob[] = rawJobs
    .slice(0, params.numResults)
    .map((rawJob) => ({
      title: rawJob.title || "Unknown Title",
      company: rawJob.company_name || "Unknown Company",
      location: rawJob.location || params.location,
      description: rawJob.description || "",
      jobType: null,
      salaryRange: null,
      experienceLevel: null,
      requirements: {
        essential: [],
        preferred: [],
        skills: [],
        experience: null,
        education: null,
      },
      benefits: [],
      jobAnalysis: {
        summary: "Processing job analysis...",
        keyResponsibilities: [],
        idealCandidate: "Processing...",
        careerProgression: null,
        companySize: null,
        industry: null,
        workArrangement: "Unknown",
      },
      applicationDetails: {
        applyOptions:
          rawJob.apply_options?.map((opt: any) => ({
            platform: opt.platform || opt.title || "Unknown",
            url: opt.url || opt.link || "",
          })) || [],
        postedDate: null,
        applicationDeadline: null,
      },
      sourceUrl: rawJob.share_link || "",
      provider: rawJob.provider,
      lastUpdated: new Date().toISOString(),
    }));

  const result: JobSearchResult = {
    searchId,
    jobs: placeholderJobs,
    totalFound: rawJobs.length,
    searchParams: params,
    costDollars,
    responseTime,
    provider,
    rawJobs, // Include raw jobs for individual storage
    convexJobIds, // Convex document IDs for AI processing
  };

  console.log(
    `Job search completed: ${placeholderJobs.length} placeholder jobs from ${provider}, AI processing will happen in background`
  );
  return result;
}

/**
 * Get SerpAPI localization settings based on country code
 */
function getSerpAPILocalization(countryCode: string = "gb") {
  const localizationMap: Record<
    string,
    { hl: string; gl: string; google_domain: string }
  > = {
    // English-speaking countries
    gb: { hl: "en", gl: "uk", google_domain: "google.co.uk" },
    us: { hl: "en", gl: "us", google_domain: "google.com" },
    ca: { hl: "en", gl: "ca", google_domain: "google.ca" },
    au: { hl: "en", gl: "au", google_domain: "google.com.au" },
    ie: { hl: "en", gl: "ie", google_domain: "google.ie" },
    nz: { hl: "en", gl: "nz", google_domain: "google.co.nz" },
    za: { hl: "en", gl: "za", google_domain: "google.co.za" },

    // European countries
    de: { hl: "de", gl: "de", google_domain: "google.de" },
    fr: { hl: "fr", gl: "fr", google_domain: "google.fr" },
    es: { hl: "es", gl: "es", google_domain: "google.es" },
    it: { hl: "it", gl: "it", google_domain: "google.it" },
    nl: { hl: "nl", gl: "nl", google_domain: "google.nl" },
    be: { hl: "nl", gl: "be", google_domain: "google.be" },
    ch: { hl: "de", gl: "ch", google_domain: "google.ch" },
    at: { hl: "de", gl: "at", google_domain: "google.at" },

    // Other major markets
    in: { hl: "en", gl: "in", google_domain: "google.co.in" },
    sg: { hl: "en", gl: "sg", google_domain: "google.com.sg" },
    hk: { hl: "en", gl: "hk", google_domain: "google.com.hk" },
    jp: { hl: "ja", gl: "jp", google_domain: "google.co.jp" },
    br: { hl: "pt", gl: "br", google_domain: "google.com.br" },
    mx: { hl: "es", gl: "mx", google_domain: "google.com.mx" },
  };

  // Default to UK settings if country code not found
  return localizationMap[countryCode.toLowerCase()] || localizationMap["gb"];
}

/**
 * Search jobs using SerpAPI
 */
async function searchWithSerpAPI(params: JobSearchParams): Promise<{
  jobs: RawJobData[];
  cost: number;
}> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY not found in environment variables");
  }

  const url = "https://serpapi.com/search";

  // Get localization settings based on country code
  const localization = getSerpAPILocalization(params.countryCode);

  // Find the best matching location using SerpAPI's locations API
  let finalLocation = params.location;
  const countryCode = params.countryCode || "gb";

  console.log(
    `🔍 Finding best location match for "${params.location}" in ${countryCode.toUpperCase()}`
  );

  try {
    // Use enhanced location matching with city prioritisation
    const locationMatch = await findBestLocationMatch(
      params.location,
      countryCode,
      {
        prioritiseCities: true, // Always prioritise cities for job searches
        preferBusinessCentres: true, // Prefer locations with more business activity
        targetTypes: ["City", "Region"], // Focus on cities and regions, avoid countries
        minPopulation: 10000, // Minimum population threshold for better job market coverage
      }
    );

    if (locationMatch) {
      finalLocation = locationMatch.location.canonical_name;
      console.log(
        `✅ Enhanced location match: "${params.location}" → "${finalLocation}" (${locationMatch.location.target_type}, ${locationMatch.matchType}, ${(locationMatch.confidence * 100).toFixed(1)}%, reach: ${locationMatch.location.reach.toLocaleString()})`
      );

      // Log additional insights for business centres
      if (locationMatch.location.reach > 100000) {
        console.log(`🏢 Major business centre detected: ${finalLocation}`);
      }
    } else {
      console.warn(
        `⚠️ No enhanced location match found for "${params.location}" in ${countryCode.toUpperCase()}, using original`
      );
    }
  } catch (error) {
    console.warn(
      `⚠️ Enhanced location matching failed, using original location:`,
      error
    );
  }

  // Standardized request format (google_jobs engine is always used)
  const requestParams = {
    engine: "google_jobs", // Always google_jobs for job searches
    q: params.query, // Don't combine with location - SerpAPI handles this separately
    location: finalLocation, // Use matched canonical location
    api_key: apiKey,
    num: (params.numResults || 30).toString(),
    hl: localization.hl, // Language code (e.g., "en", "de", "fr")
    gl: localization.gl, // Country code for Google (e.g., "uk", "us", "de")
    google_domain: localization.google_domain, // Google domain to use
  };

  console.log(
    `🌍 SerpAPI request: query="${params.query}", location="${finalLocation}", domain="${localization.google_domain}", hl="${localization.hl}", gl="${localization.gl}"`
  );

  const response = await axios.get(url, { params: requestParams });

  if (response.status !== 200) {
    throw new Error(`SerpAPI returned status ${response.status}`);
  }

  const data = response.data;

  // Check for SerpAPI errors
  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  if (!data.jobs_results || !Array.isArray(data.jobs_results)) {
    throw new Error("Invalid response format from SerpAPI");
  }

  // Log if we get 0 results to help debug issues
  if (data.jobs_results.length === 0) {
    console.warn(
      `⚠️ SerpAPI returned 0 jobs for query: "${params.query}" in "${params.location}"`
    );
    console.warn(
      "This could be due to: rate limiting, no jobs available, or API issues"
    );
  }

  const jobs: RawJobData[] = data.jobs_results.map(
    (job: any, index: number) => ({
      id: job.job_id || `serpapi-${Date.now()}-${index}`,
      title: job.title || "Unknown Title",
      company_name: job.company_name || "Unknown Company",
      location: job.location || params.location,
      description: job.description || "",
      via: job.via, // SerpAPI uses 'via' field directly
      share_link: job.share_link, // SerpAPI uses 'share_link' field directly
      thumbnail: job.thumbnail,
      detected_extensions: job.detected_extensions,
      job_highlights: job.job_highlights,
      apply_options: job.apply_options, // SerpAPI may not have this field
      extensions: job.extensions,
      job_id: job.job_id,
      provider: "serpapi",
      raw_data: job,
    })
  );

  // SerpAPI pricing: roughly $0.005 per search
  const cost = 0.005;

  return { jobs, cost };
}

/**
 * Parse a raw job posting using AI to extract structured data
 */
export async function parseJobWithAI(
  rawJob: RawJobData
): Promise<StructuredJob> {
  try {
    const model = getChatModel(JOB_AI_MODEL);

    const result = await generateObject({
      model,
      schema: StructuredJobSchema,
      prompt: `You are an expert job posting analyst. Parse the following job posting data and extract comprehensive structured information.

INSTRUCTIONS:
- Be thorough and accurate in your analysis
- Generate insightful AI analysis in the jobAnalysis section
- Extract all requirements, skills, and qualifications mentioned
- Identify benefits and perks offered
- Determine experience level based on job requirements
- Estimate company size and work arrangement from context
- Use null for unavailable optional fields, empty arrays for missing lists
- Focus on actionable information for job seekers
- Identify key responsibilities and ideal candidate profile

JOB POSTING DATA TO ANALYSE:
Title: ${rawJob.title}
Company: ${rawJob.company_name}
Location: ${rawJob.location}
Description: ${rawJob.description}
Via: ${rawJob.via || "Unknown"}
Extensions: ${rawJob.extensions?.join(", ") || "None"}
Job Highlights: ${JSON.stringify(rawJob.job_highlights || [])}
Apply Options: ${JSON.stringify(rawJob.apply_options || [])}

METADATA:
- Source URL: ${rawJob.share_link || "Unknown"}
- Provider: ${rawJob.provider}
- Job ID: ${rawJob.job_id || rawJob.id}

Please provide a comprehensive analysis with particular attention to:
1. Job requirements and qualifications breakdown
2. Key responsibilities and role expectations
3. Company benefits and work environment
4. Career progression opportunities
5. Ideal candidate profile and experience level
6. Work arrangement and company culture indicators`,
    });

    return {
      ...result.object,
      sourceUrl: rawJob.share_link || "",
      provider: rawJob.provider,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to parse job with AI:", error);
    throw new Error("Failed to parse job posting with LLM");
  }
}

/**
 * Process jobs with AI in background
 */
async function processJobsWithAI(
  jobIds: string[],
  searchId: string,
  options: JobSearchOptions = {}
): Promise<void> {
  console.log(`🤖 Starting background AI processing for ${jobIds.length} jobs`);

  try {
    const { getJobResult, updateJobResultWithAI } = await import(
      "./job-storage"
    );

    for (const jobId of jobIds) {
      try {
        console.log(`🔄 Processing job ${jobId}...`);

        // Get the stored job with raw data
        const storedJob = await getJobResult(jobId);
        if (!storedJob) {
          console.error(`❌ Job ${jobId} not found`);
          continue;
        }

        if (!storedJob.rawData) {
          console.error(`❌ Job ${jobId} missing raw data`);
          continue;
        }

        console.log(
          `📝 Parsing job with AI: ${storedJob.title || "Unknown Title"}`
        );

        // Parse with AI
        const structuredJob = await parseJobWithAI(storedJob.rawData);

        console.log(`💾 Updating job in database: ${structuredJob.title}`);

        // Update the stored job with AI-processed data
        await updateJobResultWithAI(jobId, structuredJob);

        console.log(`✅ AI processed job: ${structuredJob.title}`);
      } catch (error) {
        console.error(`❌ Failed to AI process job ${jobId}:`, error);
        console.error(`Error details:`, error);
        // Continue with other jobs
      }
    }

    console.log(`🎉 Completed background AI processing for search ${searchId}`);
  } catch (error) {
    console.error(`❌ Background AI processing failed completely:`, error);
    throw error;
  }
}

/**
 * Generate a unique search ID
 */
function generateSearchId(): string {
  return `job-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Infer country code from job location
 */
function inferCountryCodeFromLocation(location: string): string {
  const locationLower = location.toLowerCase();

  // UK/Britain patterns
  if (
    locationLower.includes("london") ||
    locationLower.includes("manchester") ||
    locationLower.includes("birmingham") ||
    locationLower.includes("glasgow") ||
    locationLower.includes("edinburgh") ||
    locationLower.includes("bristol") ||
    locationLower.includes("liverpool") ||
    locationLower.includes("leeds") ||
    locationLower.includes("sheffield") ||
    locationLower.includes("newcastle") ||
    locationLower.includes("brighton") ||
    locationLower.includes("uk") ||
    locationLower.includes("united kingdom") ||
    locationLower.includes("england") ||
    locationLower.includes("scotland") ||
    locationLower.includes("wales") ||
    locationLower.includes("northern ireland")
  ) {
    return "gb";
  }

  // US patterns
  if (
    locationLower.includes("new york") ||
    locationLower.includes("los angeles") ||
    locationLower.includes("chicago") ||
    locationLower.includes("houston") ||
    locationLower.includes("phoenix") ||
    locationLower.includes("philadelphia") ||
    locationLower.includes("san antonio") ||
    locationLower.includes("san diego") ||
    locationLower.includes("dallas") ||
    locationLower.includes("san jose") ||
    locationLower.includes("austin") ||
    locationLower.includes("jacksonville") ||
    locationLower.includes("san francisco") ||
    locationLower.includes("columbus") ||
    locationLower.includes("charlotte") ||
    locationLower.includes("fort worth") ||
    locationLower.includes("indianapolis") ||
    locationLower.includes("seattle") ||
    locationLower.includes("denver") ||
    locationLower.includes("boston") ||
    locationLower.includes("usa") ||
    locationLower.includes("united states") ||
    locationLower.includes("america")
  ) {
    return "us";
  }

  // Canada patterns
  if (
    locationLower.includes("toronto") ||
    locationLower.includes("montreal") ||
    locationLower.includes("vancouver") ||
    locationLower.includes("calgary") ||
    locationLower.includes("ottawa") ||
    locationLower.includes("edmonton") ||
    locationLower.includes("mississauga") ||
    locationLower.includes("winnipeg") ||
    locationLower.includes("quebec") ||
    locationLower.includes("hamilton") ||
    locationLower.includes("canada")
  ) {
    return "ca";
  }

  // Australia patterns
  if (
    locationLower.includes("sydney") ||
    locationLower.includes("melbourne") ||
    locationLower.includes("brisbane") ||
    locationLower.includes("perth") ||
    locationLower.includes("adelaide") ||
    locationLower.includes("gold coast") ||
    locationLower.includes("newcastle") ||
    locationLower.includes("canberra") ||
    locationLower.includes("sunshine coast") ||
    locationLower.includes("wollongong") ||
    locationLower.includes("australia")
  ) {
    return "au";
  }

  // Germany patterns
  if (
    locationLower.includes("berlin") ||
    locationLower.includes("hamburg") ||
    locationLower.includes("munich") ||
    locationLower.includes("cologne") ||
    locationLower.includes("frankfurt") ||
    locationLower.includes("stuttgart") ||
    locationLower.includes("düsseldorf") ||
    locationLower.includes("dortmund") ||
    locationLower.includes("essen") ||
    locationLower.includes("leipzig") ||
    locationLower.includes("bremen") ||
    locationLower.includes("dresden") ||
    locationLower.includes("hanover") ||
    locationLower.includes("nuremberg") ||
    locationLower.includes("germany") ||
    locationLower.includes("deutschland")
  ) {
    return "de";
  }

  // France patterns
  if (
    locationLower.includes("paris") ||
    locationLower.includes("marseille") ||
    locationLower.includes("lyon") ||
    locationLower.includes("toulouse") ||
    locationLower.includes("nice") ||
    locationLower.includes("nantes") ||
    locationLower.includes("strasbourg") ||
    locationLower.includes("montpellier") ||
    locationLower.includes("bordeaux") ||
    locationLower.includes("lille") ||
    locationLower.includes("rennes") ||
    locationLower.includes("reims") ||
    locationLower.includes("france")
  ) {
    return "fr";
  }

  // Default to 'unknown' if no pattern matches
  return "unknown";
}

/**
 * Validates job search parameters
 */
export function validateJobSearchParams(
  params: JobSearchParams
): JobSearchParams {
  const { query, location, countryCode } = params;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new Error("Search query is required and must be a non-empty string");
  }

  if (
    !location ||
    typeof location !== "string" ||
    location.trim().length === 0
  ) {
    throw new Error("Location is required and must be a non-empty string");
  }

  if (
    countryCode &&
    (typeof countryCode !== "string" || countryCode.trim().length === 0)
  ) {
    throw new Error("Country code must be a non-empty string if provided");
  }

  // Always set numResults to 30
  return {
    ...params,
    numResults: 30,
  };
}

/**
 * Direct search function (without storage/status management)
 */
export async function searchJobsDirect(
  params: JobSearchParams,
  options: JobSearchOptions = {}
): Promise<JobSearchResult> {
  const validatedParams = validateJobSearchParams(params);
  const searchId = generateSearchId();
  return await executeJobSearch(searchId, validatedParams, options);
}

/**
 * Reverse job search - scrape a job URL and store it in the same format as SERP API jobs
 */
export async function reverseJobSearch(
  params: ReverseJobSearchParams,
  options: ReverseJobSearchOptions = {}
): Promise<ReverseJobSearchResult> {
  const startTime = Date.now();

  try {
    console.log("Starting reverse job search for URL:", params.url);

    // Check if this URL has already been processed
    const { findExistingReverseJob } = await import("./job-storage");
    console.log(`🔍 Checking for existing job with URL: ${params.url}`);
    const existingJob = await findExistingReverseJob(params.url);
    
    if (existingJob) {
      console.log(`✅ Found existing job for URL: ${params.url}`);
      console.log(`📋 Job: ${existingJob.title} at ${existingJob.companyName}`);
      
      const responseTime = Date.now() - startTime;
      
      // Return the existing job data
      return {
        job: existingJob.aiData || {
          title: existingJob.title,
          company: existingJob.companyName,
          location: existingJob.location,
          description: existingJob.description,
          jobType: existingJob.jobType || null,
          salaryRange: existingJob.salaryRange || null,
          experienceLevel: existingJob.experienceLevel as any || null,
          requirements: {
            essential: [],
            preferred: [],
            skills: [],
            experience: null,
            education: null,
          },
          benefits: [],
          jobAnalysis: {
            summary: "Previously processed job",
            keyResponsibilities: [],
            idealCandidate: "Previously processed",
            careerProgression: null,
            companySize: null,
            industry: existingJob.industry || null,
            workArrangement: existingJob.workArrangement as any || "Unknown",
          },
          applicationDetails: {
            applyOptions: existingJob.applyOptions || [],
            postedDate: null,
            applicationDeadline: null,
          },
          sourceUrl: params.url,
          provider: "reverse",
          lastUpdated: new Date(existingJob.updatedAt).toISOString(),
        },
        jobId: existingJob._id,
        responseTime,
      };
    }

    console.log("🔍 No existing job found, proceeding with scraping...");

    // First scrape and process the job to get the location and company info
    const scrapedContent = await scrapeJobUrl(params.url);

    // Create raw job data from scraped content
    const rawJob: RawJobData = {
      id: `reverse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: "Processing...", // Will be extracted by AI
      company_name: "Processing...", // Will be extracted by AI
      location: "Processing...", // Will be extracted by AI
      description: scrapedContent,
      share_link: params.url,
      provider: "reverse",
      raw_data: {
        url: params.url,
        scrapedContent,
        scrapedAt: new Date().toISOString(),
      },
    };

    // Parse the scraped content with AI to extract structured job data
    console.log("Parsing scraped content with AI...");
    const structuredJob = await parseReverseJobWithAI(rawJob, params.url);

    // Infer country code from job location
    const inferredCountryCode = inferCountryCodeFromLocation(
      structuredJob.location
    );
    console.log(
      `🌍 Inferred country code: ${inferredCountryCode} from location: ${structuredJob.location}`
    );

    // Now create a job search entry with the correct values
    const { createPendingJobSearch, updateJobSearchResults } = await import(
      "./job-storage"
    );

    const searchResult = await createPendingJobSearch(
      {
        query: `Reverse job search: ${params.url}`,
        location: `Reverse - ${structuredJob.location}`,
        numResults: 1,
        countryCode: inferredCountryCode,
      },
      {
        userId: options.userId,
      }
    );

    const searchId = searchResult.searchId;

    try {
      // Store the job in the database
      const { storeJobResult } = await import("./job-storage");

      // Update raw job with AI-extracted basic info for storage
      rawJob.title = structuredJob.title;
      rawJob.company_name = structuredJob.company;
      rawJob.location = structuredJob.location;
      rawJob.via = structuredJob.company; // Set via to the company name

      // Extract apply options from structured job data
      rawJob.apply_options = structuredJob.applicationDetails.applyOptions.map(
        (option) => ({
          title: option.platform,
          link: option.url,
        })
      );

      // Store the job directly with AI data since we already have it processed
      const jobId = await storeJobResult(structuredJob, rawJob, {
        userId: options.userId,
        searchId: searchId,
        countryCode: inferredCountryCode,
        isProcessed: "true", // Mark as processed since we already have AI data
      });

      const responseTime = Date.now() - startTime;

      // Update the search entry as complete
      await updateJobSearchResults(
        searchId,
        {
          searchId: searchId,
          jobs: [structuredJob],
          totalFound: 1,
          searchParams: {
            query: `Reverse job search: ${params.url}`,
            location: `Reverse - ${structuredJob.location}`,
            numResults: 1,
            countryCode: inferredCountryCode,
          },
          costDollars: 0,
          responseTime: responseTime,
          provider: "reverse",
        },
        {
          userId: options.userId,
          responseTime: responseTime,
        }
      );

      console.log(
        `✅ Reverse job search completed: ${structuredJob.title} at ${structuredJob.company}`
      );

      return {
        job: structuredJob,
        jobId,
        responseTime,
      };
    } catch (error) {
      // Mark search as failed
      const { markJobSearchFailed } = await import("./job-storage");
      await markJobSearchFailed(
        searchId,
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  } catch (error) {
    console.error("Reverse job search failed:", error);
    throw new Error(
      `Failed to scrape and process job URL: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Scrape a job URL using ScrapingDog API
 */
async function scrapeJobUrl(url: string): Promise<string> {
  const apiKey = process.env.SCRAPINGDOG_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPINGDOG_API_KEY not found in environment variables");
  }

  const scrapingUrl = "https://api.scrapingdog.com/scrape";
  const params = new URLSearchParams({
    api_key: apiKey,
    url: url,
    dynamic: "false",
    markdown: "true",
  });

  console.log(`🔍 Scraping URL with ScrapingDog: ${url}`);

  try {
    const response = await axios.get(`${scrapingUrl}?${params.toString()}`);

    if (response.status !== 200) {
      throw new Error(`ScrapingDog returned status ${response.status}`);
    }

    const content = response.data;

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("ScrapingDog returned empty or invalid content");
    }

    console.log(
      `✅ Successfully scraped ${content.length} characters from ${url}`
    );
    return content;
  } catch (error) {
    console.error("ScrapingDog API error:", error);
    throw new Error(
      `Failed to scrape URL: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Parse a scraped job posting using AI to extract structured data
 */
async function parseReverseJobWithAI(
  rawJob: RawJobData,
  originalUrl: string
): Promise<StructuredJob> {
  try {
    const model = getChatModel(JOB_AI_MODEL);

    const result = await generateObject({
      model,
      schema: StructuredJobSchema,
      prompt: `You are an expert job posting analyst. Parse the following scraped job posting content and extract comprehensive structured information.

INSTRUCTIONS:
- Be thorough and accurate in your analysis
- Generate insightful AI analysis in the jobAnalysis section
- Extract all requirements, skills, and qualifications mentioned
- Identify benefits and perks offered
- Determine experience level based on job requirements
- Estimate company size and work arrangement from context
- Use null for unavailable optional fields, empty arrays for missing lists
- Focus on actionable information for job seekers
- Identify key responsibilities and ideal candidate profile
- This content was scraped from a job posting URL, so extract the actual job information
- IMPORTANT: For applicationDetails.applyOptions, always include the original scraped URL as the primary application method

SCRAPED JOB POSTING CONTENT:
${rawJob.description}

METADATA:
- Original URL: ${originalUrl}
- Provider: reverse (scraped)
- Scraped at: ${rawJob.raw_data.scrapedAt}

Please provide a comprehensive analysis with particular attention to:
1. Job title and company name (extract from the content)
2. Job location (extract from the content)
3. Job requirements and qualifications breakdown
4. Key responsibilities and role expectations
5. Company benefits and work environment
6. Career progression opportunities
7. Ideal candidate profile and experience level
8. Work arrangement and company culture indicators
9. Application details - ALWAYS include the original URL (${originalUrl}) as an apply option

CRITICAL: In the applicationDetails.applyOptions array, you MUST include at least one entry with:
- platform: The name of the website/platform (e.g., "Soho House Careers", "Company Website", etc.)
- url: The original scraped URL (${originalUrl})

If you find additional application URLs in the content (like Greenhouse, Indeed, etc.), include those as well, but the original URL must always be included.`,
    });

    return {
      ...result.object,
      sourceUrl: originalUrl,
      provider: "reverse",
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to parse reverse job with AI:", error);
    throw new Error("Failed to parse scraped job posting with LLM");
  }
}
