import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { config } from "../core/config";

// Configure OpenRouter provider
export const openrouter = createOpenRouter({
  apiKey: config.openrouter.apiKey,
});

// Available model identifiers for OpenRouter
export const MODEL_IDS = {
  // OpenAI models (latest flagship)
  "gpt-5": "openai/gpt-5",
  "gpt-5-chat": "openai/gpt-5-chat",
  "gpt-5-mini": "openai/gpt-5-mini",
  "gpt-5-nano": "openai/gpt-5-nano",

  // OpenAI GPT-4.1 series
  "gpt-4.1": "openai/gpt-4.1",
  "gpt-4.1-mini": "openai/gpt-4.1-mini",
  "gpt-4.1-nano": "openai/gpt-4.1-nano",

  // OpenAI o-series (reasoning models)
  "o3-pro": "openai/o3-pro",
  o3: "openai/o3",
  "o1-pro": "openai/o1-pro",
  o1: "openai/o1",
  "o1-preview": "openai/o1-preview",
  "o1-mini": "openai/o1-mini",

  // OpenAI GPT-4o series
  "gpt-4o-audio-preview": "openai/gpt-4o-audio-preview",
  "gpt-4o-search-preview": "openai/gpt-4o-search-preview",
  "gpt-4o-mini-search-preview": "openai/gpt-4o-mini-search-preview",
  "chatgpt-4o-latest": "openai/chatgpt-4o-latest",
  "gpt-4o": "openai/gpt-4o-2024-11-20",
  "gpt-4o-2024-08-06": "openai/gpt-4o-2024-08-06",
  "gpt-4o-2024-05-13": "openai/gpt-4o-2024-05-13",
  "gpt-4o-mini": "openai/gpt-4o-mini-2024-07-18",
  "gpt-4o-extended": "openai/gpt-4o:extended",

  // OpenAI GPT-4 series
  "gpt-4-turbo": "openai/gpt-4-turbo",
  "gpt-4-turbo-preview": "openai/gpt-4-turbo-preview",
  "gpt-4-vision-preview": "openai/gpt-4-vision-preview",
  "gpt-4": "openai/gpt-4",
  "gpt-4-32k": "openai/gpt-4-32k",

  // OpenAI GPT-3.5 series
  "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
  "gpt-3.5-turbo-instruct": "openai/gpt-3.5-turbo-instruct",
  "gpt-3.5-turbo-16k": "openai/gpt-3.5-turbo-16k",

  // OpenAI open-source models
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "gpt-oss-20b": "openai/gpt-oss-20b",
  "gpt-oss-20b-free": "openai/gpt-oss-20b:free",

  // OpenAI specialised models
  "codex-mini": "openai/codex-mini",

  // Anthropic Claude 4 series (latest flagship)
  "claude-opus-4.1": "anthropic/claude-opus-4.1",
  "claude-opus-4": "anthropic/claude-opus-4",
  "claude-sonnet-4": "anthropic/claude-sonnet-4",

  // Anthropic Claude 3.7 series
  "claude-3.7-sonnet": "anthropic/claude-3.7-sonnet",
  "claude-3.7-sonnet-thinking": "anthropic/claude-3.7-sonnet:thinking",

  // Anthropic Claude 3.5 series
  "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
  "claude-3.5-sonnet-20241022": "anthropic/claude-3.5-sonnet-20241022",
  "claude-3.5-sonnet-20240620": "anthropic/claude-3.5-sonnet-20240620",
  "claude-3.5-haiku": "anthropic/claude-3.5-haiku",
  "claude-3.5-haiku-20241022": "anthropic/claude-3.5-haiku-20241022",

  // Anthropic Claude 3 series
  "claude-3-opus": "anthropic/claude-3-opus",
  "claude-3-sonnet": "anthropic/claude-3-sonnet",
  "claude-3-haiku": "anthropic/claude-3-haiku",

  // Anthropic Claude legacy models
  "claude-2.1": "anthropic/claude-2.1",
  "claude-2": "anthropic/claude-2",
  "claude-2.0": "anthropic/claude-2.0",
  "claude-instant-1.1": "anthropic/claude-instant-1.1",
  "claude-instant-1": "anthropic/claude-instant-1",
  "claude-instant-1.0": "anthropic/claude-instant-1.0",
  "claude-1.2": "anthropic/claude-1.2",
  "claude-1": "anthropic/claude-1",

  // Google Gemini 2.5 series (latest flagship)
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.5-pro-preview": "google/gemini-2.5-pro-preview",
  "gemini-2.5-pro-preview-05-06": "google/gemini-2.5-pro-preview-05-06",
  "gemini-2.5-pro-exp": "google/gemini-2.5-pro-exp-03-25",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview": "google/gemini-2.5-flash-lite-preview-06-17",
  "gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash-preview-05-20",
  "gemini-2.5-flash-preview": "google/gemini-2.5-flash-preview",

  // Google Gemini 2.0 series
  "gemini-2.0-flash": "google/gemini-2.0-flash-001",
  "gemini-2.0-flash-lite": "google/gemini-2.0-flash-lite-001",
  "gemini-2.0-flash-exp": "google/gemini-2.0-flash-exp:free",

  // Google Gemini 1.5 series
  "gemini-1.5-pro": "google/gemini-pro-1.5",
  "gemini-1.5-pro-exp": "google/gemini-pro-1.5-exp",
  "gemini-1.5-flash": "google/gemini-flash-1.5",
  "gemini-1.5-flash-8b": "google/gemini-flash-1.5-8b",
  "gemini-1.5-flash-exp": "google/gemini-flash-1.5-exp",

  // Google Gemini experimental models
  "gemini-exp-1121": "google/gemini-exp-1121",
  "gemini-exp-1114": "google/gemini-exp-1114",

  // Google Gemma 3 series (latest)
  "gemma-3-27b": "google/gemma-3-27b-it",
  "gemma-3-27b-free": "google/gemma-3-27b-it:free",
  "gemma-3-12b": "google/gemma-3-12b-it",
  "gemma-3-12b-free": "google/gemma-3-12b-it:free",
  "gemma-3-4b": "google/gemma-3-4b-it",
  "gemma-3-4b-free": "google/gemma-3-4b-it:free",
  "gemma-3-1b": "google/gemma-3-1b-it",

  // Google Gemma 2 series
  "gemma-2-27b": "google/gemma-2-27b-it",
  "gemma-2-9b": "google/gemma-2-9b-it",
  "gemma-2-9b-free": "google/gemma-2-9b-it:free",

  // Google Gemma legacy models
  "gemma-7b": "google/gemma-7b-it",
  "gemma-2b": "google/gemma-2b-it",

  // Google legacy models
  "gemini-pro": "google/gemini-pro",
  "gemini-pro-vision": "google/gemini-pro-vision",

  // Meta models (latest)
  "llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct",
  "llama-3.2-90b": "meta-llama/llama-3.2-90b-instruct",
  "llama-3.2-11b": "meta-llama/llama-3.2-11b-instruct",
  "llama-3.2-3b": "meta-llama/llama-3.2-3b-instruct",
  "llama-3.2-1b": "meta-llama/llama-3.2-1b-instruct",
  "llama-3.1-405b": "meta-llama/llama-3.1-405b-instruct",
  "llama-3.1-70b": "meta-llama/llama-3.1-70b-instruct",
  "llama-3.1-8b": "meta-llama/llama-3.1-8b-instruct",
} as const;

export type ModelName = keyof typeof MODEL_IDS;

// Helper function to get a chat model
export const getChatModel = (modelName: ModelName) => {
  return openrouter.chat(MODEL_IDS[modelName]);
};

// Helper function to get a completion model
export const getCompletionModel = (modelName: ModelName) => {
  return openrouter.completion(MODEL_IDS[modelName]);
};
