/**
 * Core Infrastructure Module
 * 
 * This module provides core infrastructure services including configuration,
 * database connections, embeddings, and utility functions.
 */

// Configuration exports
export { config, validateConfig } from './config';

// Convex database client exports
export { convex } from './convex';

// Embeddings service exports
export {
  generateEmbedding,
  generateEmbeddings,
  calculateCosineSimilarity,
  findSimilarEmbeddings,
  prepareTextForEmbedding,
  cosineSimilarity,
} from './embeddings';

// Utility function exports
export {
  getCurrentDateString,
  formatDateString,
} from './utils';
