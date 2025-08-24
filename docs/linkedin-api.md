# LinkedIn Professionals API

The LinkedIn Professionals API allows you to search for LinkedIn profiles using Exa's search capabilities and store structured profile data with semantic search functionality.

## Overview

The API provides the following functionality:

- Search for LinkedIn professionals by job title and location
- Parse raw profile data into structured format using AI
- Store profiles with vector embeddings for semantic search
- Retrieve and filter stored profiles
- Duplicate prevention and caching for searches

## Endpoints

### 1. Search LinkedIn Professionals

**POST** `/api/linkedin`

Search for LinkedIn professionals using job title and location.

#### Request Body

```json
{
  "jobTitle": "Software Engineers",
  "userLocation": "GB",
  "numResults": 30,
  "userId": "optional-user-id",
  "direct": false
}
```

#### Parameters

- `jobTitle` (string, required): Job title to search for (e.g., "Software Engineers", "Product Managers")
- `userLocation` (string, required): Location code (e.g., "GB", "US", "CA")
- `numResults` (number, required): Number of results to return (1-100)
- `userId` (string, optional): User ID for tracking and filtering
- `direct` (boolean, optional): If true, bypass caching and return results immediately

#### Response

For cached searches (default):

```json
{
  "success": true,
  "searchId": "search-id-123",
  "status": "pending|complete|failed",
  "result": {
    "searchId": "search-id-123",
    "profiles": [...],
    "totalFound": 25,
    "searchParams": {
      "jobTitle": "Software Engineers",
      "userLocation": "GB",
      "numResults": 30
    },
    "costDollars": 0.007,
    "responseTime": 15432
  },
  "isExisting": false,
  "message": "Found 25 LinkedIn profiles"
}
```

For direct searches:

```json
{
  "success": true,
  "result": {
    "searchId": "",
    "profiles": [...],
    "totalFound": 25,
    "searchParams": {...},
    "costDollars": 0.007,
    "responseTime": 15432
  },
  "message": "Found 25 LinkedIn profiles"
}
```

### 2. Check Search Status

**GET** `/api/linkedin/status/[searchId]`

Check the status of a LinkedIn search by search ID.

#### Response

```json
{
  "success": true,
  "searchId": "search-id-123",
  "status": "complete",
  "result": {
    "profiles": [...],
    "totalFound": 25
  },
  "searchParams": {
    "jobTitle": "Software Engineers",
    "userLocation": "GB",
    "numResults": 30
  },
  "createdAt": 1642678800000,
  "updatedAt": 1642678815000,
  "message": "LinkedIn search completed with 25 profiles found"
}
```

### 3. Get LinkedIn Profiles

**GET** `/api/linkedin/profiles`

Retrieve LinkedIn profiles with optional filters.

#### Query Parameters

- `userId` (string, optional): Filter by user ID
- `searchId` (string, optional): Filter by search ID
- `company` (string, optional): Filter by company name
- `position` (string, optional): Filter by position/job title
- `location` (string, optional): Filter by location
- `limit` (number, optional): Limit number of results (default: 50, max: 100)
- `search` (string, optional): Semantic search query

#### Response

```json
{
  "success": true,
  "profiles": [
    {
      "_id": "profile-id-123",
      "name": "John Smith",
      "position": "Senior Software Engineer",
      "company": "Tech Corp",
      "location": "London, England, United Kingdom",
      "profileUrl": "https://linkedin.com/in/johnsmith",
      "data": {
        "name": "John Smith",
        "position": "Senior Software Engineer",
        "company": "Tech Corp",
        "location": "London, England, United Kingdom",
        "connections": "500+ connections",
        "bio": "Experienced software engineer...",
        "currentJob": {...},
        "experience": [...],
        "education": [...],
        "skills": [...],
        "certifications": [...],
        "languages": [...],
        "recommendations": [...],
        "volunteering": [...],
        "websites": [...],
        "publications": [...]
      },
      "similarity": 0.85,
      "createdAt": 1642678800000,
      "updatedAt": 1642678800000
    }
  ],
  "total": 25,
  "message": "Found 25 LinkedIn profiles"
}
```

### 4. Get Individual Profile

**GET** `/api/linkedin/profiles/[profileId]`

Get a specific LinkedIn profile by ID.

#### Response

```json
{
  "success": true,
  "profile": {
    "_id": "profile-id-123",
    "name": "John Smith",
    "position": "Senior Software Engineer",
    "company": "Tech Corp",
    "location": "London, England, United Kingdom",
    "profileUrl": "https://linkedin.com/in/johnsmith",
    "data": {...},
    "createdAt": 1642678800000,
    "updatedAt": 1642678800000
  },
  "message": "Retrieved LinkedIn profile for John Smith"
}
```

## Profile Data Structure

Each LinkedIn profile contains the following structured data:

```typescript
interface StructuredLinkedInProfile {
  name: string;
  position: string;
  company: string;
  location: string;
  connections: string;
  bio: string | null;

  currentJob: {
    title: string;
    company: string;
    startDate: string | null;
    location: string | null;
    description: string | null;
  };

  experience: Array<{
    title: string;
    company: string;
    startDate: string | null;
    endDate: string | null;
    location: string | null;
    description: string | null;
  }>;

  education: Array<{
    institution: string;
    degree: string | null;
    field: string | null;
    startDate: string | null;
    endDate: string | null;
  }>;

  skills: string[];

  certifications: Array<{
    name: string;
    issuer: string | null;
    date: string | null;
  }>;

  languages: Array<{
    language: string;
    proficiency: string | null;
  }>;

  recommendations: string[];

  volunteering: Array<{
    position: string;
    organisation: string;
    startDate: string | null;
    endDate: string | null;
  }>;

  websites: Array<{
    title: string;
    url: string;
  }>;

  publications: Array<{
    title: string;
    published: string | null;
    summary: string | null;
    url: string | null;
  }>;

  profileUrl: string;
  lastUpdated: string;
}
```

## Usage Examples

### Basic Search

```bash
curl -X POST http://localhost:3000/api/linkedin \
  -H "Content-Type: application/json" \
  -d '{
    "jobTitle": "Software Engineers",
    "userLocation": "GB",
    "numResults": 10
  }'
```

### Direct Search (No Caching)

```bash
curl -X POST http://localhost:3000/api/linkedin \
  -H "Content-Type: application/json" \
  -d '{
    "jobTitle": "Product Managers",
    "userLocation": "US",
    "numResults": 20,
    "direct": true
  }'
```

### Check Search Status

```bash
curl http://localhost:3000/api/linkedin/status/search-id-123
```

### Get Profiles by Company

```bash
curl "http://localhost:3000/api/linkedin/profiles?company=Google&limit=20"
```

### Semantic Search

```bash
curl "http://localhost:3000/api/linkedin/profiles?search=experienced%20React%20developers&limit=10"
```

## Features

### Duplicate Prevention

- Searches with identical parameters are cached for 24 hours
- Prevents unnecessary API calls and costs
- Returns existing results immediately if available

### Semantic Search

- Profiles are stored with vector embeddings
- Enables intelligent search based on meaning, not just keywords
- Powered by OpenAI embeddings

### Structured Data Extraction

- Raw LinkedIn profile text is parsed using AI (Gemma 3-4B model)
- Extracts structured information including experience, education, skills, etc.
- Handles missing or incomplete data gracefully

### Cost Optimisation

- Uses lightweight AI model (Gemma 3-4B) for profile parsing
- Implements caching to reduce API usage
- Tracks costs for monitoring and budgeting

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid parameters or missing required fields
- `404 Not Found`: Search or profile not found
- `500 Internal Server Error`: Server-side errors

Example error response:

```json
{
  "success": false,
  "error": "Job title is required and must be a non-empty string"
}
```

## Rate Limits and Costs

- Exa API costs approximately $0.005-0.010 per search
- AI parsing costs are minimal with the lightweight model
- No built-in rate limiting (implement as needed)
- Caching reduces costs by preventing duplicate searches

## Configuration

The API requires the following environment variables:

- `EXA_API_KEY`: Your Exa API key
- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI parsing
- `OPENAI_API_KEY`: Your OpenAI API key for embeddings

## Database Schema

The API uses Convex with the following tables:

### linkedinSearches

- Tracks search requests and results
- Implements duplicate prevention
- Stores search metadata and costs

### linkedinProfiles

- Stores individual LinkedIn profiles
- Includes vector embeddings for semantic search
- Links back to the search that found each profile

