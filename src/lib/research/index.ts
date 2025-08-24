/**
 * Research Service Module
 * 
 * This module provides comprehensive company and position research capabilities.
 * It includes both the core research functionality and storage/retrieval operations.
 */

// Core research service exports
export {
  performResearch,
  createResearchTask,
  createStreamingResearch,
  createResearchCompletion,
  validateResearchParams,
  type ResearchParams,
  type ResearchOptions,
  type ResearchResult,
  type CompanyResearchReport,
} from './research';

// Research storage service exports
export {
  createPendingResearch,
  updateResearchReport,
  markResearchFailed,
  storeResearchReport,
  getResearchReport,
  getResearchReports,
  searchResearchReports,
  findExistingResearch,
  cleanupExpiredEntries,
  findSimilarReports,
  type StoredResearchReport,
} from './research-storage';
