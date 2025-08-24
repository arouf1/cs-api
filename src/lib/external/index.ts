/**
 * External Services Module
 * 
 * This module provides integrations with external services including
 * Exa search, OpenRouter AI models, and Swagger documentation.
 */

// Exa search service exports
export {
  exa,
  searchWeb,
  type SearchOptions,
  type SearchResult,
} from './exa';

// OpenRouter AI service exports
export {
  openrouter,
  getChatModel,
  getCompletionModel,
  MODEL_IDS,
  type ModelName,
} from './openrouter';

// Swagger documentation exports
export { swaggerSpec } from './swagger';
