# CS API Service

A comprehensive Next.js API service with AI chat capabilities, web search, and database functionality.

## Features

- 🤖 **AI Chat**: Multiple AI models via OpenRouter (GPT-4, Claude, Gemini, Llama, etc.)
- 🔍 **Web Search**: Neural and keyword search using Exa API
- 📊 **Database**: Real-time database with Convex
- 📚 **API Documentation**: Interactive Swagger UI
- 📈 **Analytics**: Built-in API usage tracking and logging
- 🔒 **SEO Protection**: Configured to prevent search engine indexing

## Quick Start

### 1. Environment Setup

Copy the environment template and fill in your API keys:

```bash
cp env.template .env.local
```

Required environment variables:

- `CONVEX_DEPLOYMENT`: Your Convex deployment URL
- `NEXT_PUBLIC_CONVEX_URL`: Your Convex public URL
- `OPENROUTER_API_KEY`: Your OpenRouter API key
- `EXA_API_KEY`: Your Exa Search API key

Optional:

- `API_SECRET_KEY`: For API authentication
- `REDIS_URL`: For rate limiting (future feature)

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Convex

```bash
# Start Convex development server
npm run convex:dev
```

This will:

- Create your Convex project
- Set up the database schema
- Generate the necessary configuration files

### 4. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Chat API

- **POST** `/api/chat` - Chat with AI models
- Supports streaming and non-streaming responses
- Multiple models available (GPT-4, Claude, Gemini, Llama)

### Search API

- **POST** `/api/search` - Search the web using Exa
- Neural and keyword search capabilities
- Domain filtering and date range options

### Analytics API

- **GET** `/api/analytics` - Get API usage analytics
- Track API calls, search queries, and conversations

### Documentation

- **GET** `/docs` - Interactive Swagger UI documentation
- **GET** `/api/docs` - OpenAPI specification JSON

## Available Models

### OpenAI Models

- `gpt-4o` - Latest GPT-4 Omni model
- `gpt-4o-mini` - Faster, cost-effective GPT-4 variant
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-3.5-turbo` - GPT-3.5 Turbo

### Anthropic Models

- `claude-3-5-sonnet` - Claude 3.5 Sonnet
- `claude-3-opus` - Claude 3 Opus
- `claude-3-haiku` - Claude 3 Haiku

### Google Models

- `gemini-pro` - Gemini Pro
- `gemini-pro-vision` - Gemini Pro with vision

### Meta Models

- `llama-3.1-405b` - Llama 3.1 405B
- `llama-3.1-70b` - Llama 3.1 70B
- `llama-3.1-8b` - Llama 3.1 8B

## Example Usage

### Chat API

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "model": "gpt-4o-mini",
    "stream": false
  }'
```

### Search API

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest developments in AI",
    "numResults": 5,
    "type": "neural"
  }'
```

### Analytics API

```bash
curl -X GET "http://localhost:3000/api/analytics?type=logs&limit=50"
```

## Database Schema

The Convex database includes:

- **apiLogs**: API call logging and analytics
- **researchReports**: Company research reports with embeddings for semantic search
- **linkedinSearches**: LinkedIn professional search requests and results
- **linkedinProfiles**: LinkedIn profile data with AI processing and embeddings

## Security Features

- **No Search Engine Indexing**: Configured with robots.txt and meta tags
- **API Key Authentication**: Optional API key validation
- **Request Logging**: All API calls are logged for monitoring
- **Rate Limiting**: Ready for Redis-based rate limiting

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run convex:dev` - Start Convex development
- `npm run convex:deploy` - Deploy Convex to production
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── app/
│   ├── api/          # API routes
│   ├── docs/         # Swagger documentation page
│   └── layout.tsx    # Root layout with SEO config
├── lib/
│   ├── config.ts     # Environment configuration
│   ├── convex.ts     # Convex client setup
│   ├── exa.ts        # Exa search utilities
│   ├── openrouter.ts # OpenRouter/AI SDK setup
│   └── swagger.ts    # Swagger configuration
convex/
├── schema.ts         # Database schema
└── functions.ts      # Database functions
```

## Deployment

### Environment Variables for Production

Ensure all required environment variables are set in your production environment.

### Convex Deployment

```bash
npm run convex:deploy
```

### Next.js Deployment

The app can be deployed to any platform that supports Next.js (Vercel, Netlify, etc.).

## API Keys Required

1. **OpenRouter**: Get your API key from [OpenRouter](https://openrouter.ai/)
2. **Exa**: Get your API key from [Exa](https://exa.ai/)
3. **Convex**: Set up your project at [Convex](https://convex.dev/)

## Support

For issues and questions, please check the API documentation at `/docs` when running the service.
