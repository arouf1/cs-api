/**
 * LinkedIn Service Module
 *
 * This module provides comprehensive LinkedIn profile search and management capabilities.
 * It includes both the core search functionality and storage/retrieval operations.
 */

// Core LinkedIn service exports
export {
  searchLinkedInProfessionals,
  searchLinkedInProfilesDirect,
  refreshLinkedInProfile,
  validateLinkedInSearchParams,
  type LinkedInSearchParams,
  type LinkedInSearchOptions,
  type LinkedInSearchResult,
  type StructuredLinkedInProfile,
  type RawLinkedInProfile,
} from "./linkedin";

// LinkedIn storage service exports
export {
  createPendingLinkedInSearch,
  updateLinkedInSearchResults,
  markLinkedInSearchFailed,
  storeLinkedInProfile,
  updateLinkedInProfileWithAI,
  getLinkedInSearch,
  getLinkedInProfile,
  getLinkedInSearches,
  getLinkedInProfiles,
  searchLinkedInProfiles,
  findExistingLinkedInSearch,
  cleanupExpiredLinkedInEntries,
  findSimilarLinkedInProfiles,
  type StoredLinkedInSearch,
  type StoredLinkedInProfile,
} from "./linkedin-storage";
