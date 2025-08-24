# OpenRouter AI SDK Integration

This document provides comprehensive guidance on how OpenRouter is configured and used in this application as part of the AI SDK ecosystem.

## Overview

OpenRouter serves as the primary AI provider for this application, offering access to multiple state-of-the-art language models from various providers (OpenAI, Anthropic, Google, Meta, etc.) through a unified interface. The integration leverages the Vercel AI SDK with the OpenRouter provider for seamless model switching and consistent API usage.

## Architecture

### Core Components

1. **OpenRouter Provider Configuration** (`src/lib/external/openrouter.ts`)
2. **Environment Configuration** (`src/lib/core/config.ts`)
3. **AI SDK Integration** (via `@openrouter/ai-sdk-provider`)
4. **Model Selection and Usage** (throughout the application)

## Configuration

### Environment Variables

The application requires the following environment variable:

```bash
# OpenRouter API key for LLM completions
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**Important Notes:**

- OpenRouter is used for text completions and chat functionality
- OpenAI API is still required separately for embeddings (OpenRouter doesn't support embeddings)
- Get your API key from [OpenRouter](https://openrouter.ai/)

### Provider Setup

The OpenRouter provider is configured in `src/lib/external/openrouter.ts`:

```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { config } from "../core/config";

// Configure OpenRouter provider
export const openrouter = createOpenRouter({
  apiKey: config.openrouter.apiKey,
});
```

### Configuration Validation

The application validates the presence of required API keys on startup:

```typescript
// src/lib/core/config.ts
export const config = {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY!,
  },
  // ... other config
} as const;

export const validateConfig = () => {
  const required = [
    "OPENROUTER_API_KEY",
    // ... other required keys
  ];
  // Validation logic...
};
```

## Available Models

The application provides access to a comprehensive set of AI models through OpenRouter:

### OpenAI Models

#### Latest Flagship Models

- `gpt-5` - Latest GPT-5 model
- `gpt-5-chat` - GPT-5 optimised for chat
- `gpt-5-mini` - Faster, cost-effective GPT-5 variant
- `gpt-5-nano` - Ultra-fast GPT-5 variant

#### GPT-4.1 Series

- `gpt-4.1` - Latest GPT-4.1 model
- `gpt-4.1-mini` - Cost-effective GPT-4.1 variant
- `gpt-4.1-nano` - Ultra-fast GPT-4.1 variant

#### Reasoning Models (o-series)

- `o3-pro` - Advanced reasoning model
- `o3` - Standard reasoning model
- `o1-pro` - Professional reasoning model
- `o1` - Standard reasoning model
- `o1-preview` - Preview reasoning model
- `o1-mini` - Compact reasoning model

#### GPT-4o Series

- `gpt-4o` - Latest GPT-4 Omni model
- `gpt-4o-mini` - Faster, cost-effective variant
- `gpt-4o-audio-preview` - Audio capabilities preview
- `gpt-4o-search-preview` - Search capabilities preview
- `chatgpt-4o-latest` - Latest ChatGPT variant

### Anthropic Claude Models

#### Claude 4 Series (Latest)

- `claude-opus-4.1` - Most capable Claude model
- `claude-opus-4` - High-performance Claude model
- `claude-sonnet-4` - Balanced Claude model

#### Claude 3.7 Series

- `claude-3.7-sonnet` - Advanced reasoning capabilities
- `claude-3.7-sonnet-thinking` - Enhanced thinking mode

#### Claude 3.5 Series

- `claude-3.5-sonnet` - Excellent for complex tasks
- `claude-3.5-haiku` - Fast and efficient

#### Claude 3 Series

- `claude-3-opus` - Most capable Claude 3 model
- `claude-3-sonnet` - Balanced performance
- `claude-3-haiku` - Fast and cost-effective

### Google Gemini Models

#### Gemini 2.5 Series (Latest)

- `gemini-2.5-pro` - Most advanced Gemini model
- `gemini-2.5-flash` - Fast and efficient
- `gemini-2.5-flash-lite` - Ultra-fast variant

#### Gemini 2.0 Series

- `gemini-2.0-flash` - Latest flash model
- `gemini-2.0-flash-lite` - Lightweight variant

#### Gemini 1.5 Series

- `gemini-1.5-pro` - Professional grade
- `gemini-1.5-flash` - Fast processing
- `gemini-1.5-flash-8b` - Compact variant

### Meta Llama Models

#### Llama 3.3 Series (Latest)

- `llama-3.3-70b` - Latest 70B parameter model

#### Llama 3.2 Series

- `llama-3.2-90b` - Largest 3.2 model
- `llama-3.2-11b` - Medium-sized model
- `llama-3.2-3b` - Compact model
- `llama-3.2-1b` - Ultra-compact model

#### Llama 3.1 Series

- `llama-3.1-405b` - Largest available model
- `llama-3.1-70b` - High-performance model
- `llama-3.1-8b` - Efficient model

## Usage Patterns

### Helper Functions

The application provides convenient helper functions for model access:

```typescript
// Get a chat model
export const getChatModel = (modelName: ModelName) => {
  return openrouter.chat(MODEL_IDS[modelName]);
};

// Get a completion model
export const getCompletionModel = (modelName: ModelName) => {
  return openrouter.completion(MODEL_IDS[modelName]);
};
```

### Default Models by Use Case

The application uses specific models for different tasks:

#### Job Processing

- **Default Model**: `gpt-4.1-mini`
- **Use Case**: Parsing job postings and extracting structured data
- **Location**: `src/lib/jobs/jobSearch.ts`

```typescript
const JOB_AI_MODEL = "gpt-4.1-mini";

export async function parseJobWithAI(
  rawJob: RawJobData
): Promise<StructuredJob> {
  const model = getChatModel(JOB_AI_MODEL);
  // ... processing logic
}
```

#### LinkedIn Profile Processing

- **Default Model**: `gpt-4.1-mini`
- **Use Case**: Parsing LinkedIn profiles and extracting professional data
- **Location**: `src/lib/linkedin/linkedin.ts`

```typescript
const LINKEDIN_AI_MODEL = "gpt-4.1-mini";

async function parseLinkedInProfile(
  rawProfile: RawLinkedInProfile
): Promise<StructuredLinkedInProfile> {
  const model = getChatModel(LINKEDIN_AI_MODEL);
  // ... processing logic
}
```

### AI SDK Integration Examples

#### Structured Data Generation

The application extensively uses the AI SDK's `generateObject` function for structured data extraction:

```typescript
import { generateObject } from "ai";
import { getChatModel } from "../external/openrouter";

const model = getChatModel("gpt-4.1-mini");

const result = await generateObject({
  model,
  schema: StructuredJobSchema, // Zod schema
  prompt: `You are an expert job posting analyst. Parse the following job posting data...`,
});
```

#### Streaming Responses

For real-time applications, the integration supports streaming:

```typescript
const stream = await model.stream({
  messages: [{ role: "user", content: "Your prompt here" }],
});

for await (const chunk of stream) {
  // Process streaming chunks
}
```

#### Error Handling and Timeouts

The application implements robust error handling:

```typescript
// Timeout protection
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(
    () => reject(new Error("AI processing timeout after 5 minutes")),
    300000 // 5 minutes
  );
});

const aiPromise = generateObject({
  model,
  schema,
  prompt,
});

const result = await Promise.race([aiPromise, timeoutPromise]);
```

## Dependencies

The OpenRouter integration requires the following npm packages:

```json
{
  "dependencies": {
    "@openrouter/ai-sdk-provider": "^1.1.2",
    "ai": "^5.0.22",
    "zod": "^3.23.8"
  }
}
```

## Best Practices

### Model Selection

1. **Cost Optimisation**: Use `gpt-4.1-mini` for most tasks as it provides excellent performance at lower cost
2. **Complex Reasoning**: Use `o1` or `o3` models for tasks requiring advanced reasoning
3. **Speed Requirements**: Use `claude-3.5-haiku` or `gemini-2.0-flash-lite` for fast responses
4. **Large Context**: Use `claude-3.5-sonnet` for tasks requiring large context windows

### Error Handling

1. **Always implement timeouts** for AI operations to prevent hanging requests
2. **Log model usage** for debugging and cost tracking
3. **Graceful degradation** when AI services are unavailable
4. **Retry logic** for transient failures

### Performance Optimisation

1. **Batch processing** for multiple items when possible
2. **Appropriate model selection** based on task complexity
3. **Schema validation** using Zod for structured outputs
4. **Caching** of AI results when appropriate

### Security Considerations

1. **API key protection** - never expose keys in client-side code
2. **Input validation** before sending to AI models
3. **Output sanitisation** of AI-generated content
4. **Rate limiting** to prevent abuse

## Monitoring and Debugging

### Logging

The application includes comprehensive logging for AI operations:

```typescript
console.log(`🤖 Getting chat model: ${LINKEDIN_AI_MODEL}`);
console.log(`✅ Chat model obtained successfully`);
console.log(`🔄 Calling generateObject with AI model...`);
console.log(`✅ AI parsing completed for: ${structuredProfile.name}`);
```

### Environment Checks

API key availability is checked during processing:

```typescript
console.log("OPENROUTER_API_KEY exists:", !!process.env.OPENROUTER_API_KEY);
```

### Performance Tracking

Response times and costs are tracked for analytics:

```typescript
const startTime = Date.now();
// ... AI processing
const responseTime = Date.now() - startTime;

// Store metrics for analysis
await updateSearchResults(searchId, result, {
  model: LINKEDIN_AI_MODEL,
  responseTime,
  costDollars,
});
```

## Troubleshooting

### Common Issues

1. **Missing API Key**
   - Error: Configuration validation fails
   - Solution: Ensure `OPENROUTER_API_KEY` is set in environment

2. **Model Not Found**
   - Error: Invalid model identifier
   - Solution: Check `MODEL_IDS` mapping in `openrouter.ts`

3. **Timeout Errors**
   - Error: AI processing timeout
   - Solution: Increase timeout duration or optimise prompts

4. **Rate Limiting**
   - Error: Too many requests
   - Solution: Implement request queuing or use different models

### Debug Mode

Enable detailed logging by setting appropriate log levels in your environment.

## Migration Notes

### From Direct OpenAI Integration

If migrating from direct OpenAI integration:

1. Replace `openai` imports with OpenRouter equivalents
2. Update model identifiers to use OpenRouter format
3. Maintain existing AI SDK patterns - they work seamlessly
4. Update environment variables

### Model Updates

When new models become available:

1. Update `MODEL_IDS` in `openrouter.ts`
2. Test with existing use cases
3. Update documentation
4. Consider performance and cost implications

## Cost Optimisation

### Model Selection Strategy

1. **Development**: Use `gpt-4.1-mini` for most tasks
2. **Production**: Monitor usage and optimise based on requirements
3. **Batch Processing**: Group similar tasks to reduce API calls
4. **Caching**: Store results for repeated queries

### Usage Monitoring

Track model usage and costs through:

1. Application logs
2. OpenRouter dashboard
3. Custom analytics in the application
4. Performance metrics collection

## Conclusion

The OpenRouter integration provides a robust, scalable foundation for AI functionality in this application. By leveraging the AI SDK's consistent interface with OpenRouter's model diversity, the application can easily adapt to new models and requirements while maintaining high performance and reliability.

For additional support or questions about the integration, refer to:

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- Application-specific API documentation at `/docs`
