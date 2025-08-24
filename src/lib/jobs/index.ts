/**
 * Job Search Service Module
 *
 * This module provides comprehensive job search capabilities using multiple providers
 * (Scraping Dog as primary, SerpAPI as fallback) with unified data schema.
 */

// Core job search service exports
export {
  searchJobs,
  searchJobsDirect,
  reverseJobSearch,
  validateJobSearchParams,
  type JobSearchParams,
  type JobSearchOptions,
  type JobSearchResult,
  type ReverseJobSearchParams,
  type ReverseJobSearchOptions,
  type ReverseJobSearchResult,
  type StructuredJob,
  type RawJobData,
} from "./jobSearch";

// Job storage service exports
export {
  createPendingJobSearch,
  updateJobSearchResults,
  markJobSearchFailed,
  storeJobResult,
  storeRawJobResult,
  updateJobResultWithAI,
  getJobSearch,
  getJobResult,
  getJobSearches,
  getJobResults,
  findExistingJobSearch,
  cleanupExpiredJobEntries,
  searchJobResults,
  type StoredJobSearch,
  type StoredJobResult,
} from "./job-storage";

// Location matching service exports
export {
  findBestLocationMatch,
  getLocationSuggestions,
  validateLocation,
} from "./location-matcher";
