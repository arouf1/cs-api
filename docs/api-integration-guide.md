# CS API Integration Guide

This document provides comprehensive integration guidance for the CS API endpoints. This API serves as a migration from Supabase to Convex and provides job search, LinkedIn professional search, and company research functionality.

## Authentication & Protection Bypass

### Vercel Protection Bypass

All requests to this API require a protection bypass header for automation services:

```http
x-vercel-protection-bypass: [SECRET_VALUE]
```

**Implementation in Parent App:**

1. Add both the API base URL and protection bypass secret to your `.env.local` file:
   ```env
   CS_API_BASE_URL=https://your-api-domain.com/api
   VERCEL_PROTECTION_BYPASS_SECRET=your-secret-value
   ```
2. Include the header in all API requests to this service

```javascript
// Example in Next.js
const response = await fetch("https://your-api-domain.com/api/jobs", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-vercel-protection-bypass": process.env.VERCEL_PROTECTION_BYPASS_SECRET,
  },
  body: JSON.stringify(requestData),
});
```

## Base URL

The API base URL is configured in the parent app's `.env.local` file:

```env
CS_API_BASE_URL=https://your-api-domain.com/api
```

All API requests should use this environment variable:

```javascript
// Example usage in parent app
const response = await fetch(`${process.env.CS_API_BASE_URL}/jobs`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-vercel-protection-bypass": process.env.VERCEL_PROTECTION_BYPASS_SECRET,
  },
  body: JSON.stringify(requestData),
});
```

---

## Job Search Endpoints

### 1. Job Search

**Endpoint:** `POST /api/jobs`

Search for job postings using multiple providers (Scraping Dog primary, SerpAPI fallback).

#### Request Body

```json
{
  "query": "Software Engineer", // required: Job search query
  "location": "London", // required: Location to search
  "countryCode": "gb", // optional: Country code (default: "gb")
  "userId": "user123", // optional: User ID for tracking
  "direct": false // optional: Bypass caching (default: false)
}
```

#### Response (Cached Search)

```json
{
  "success": true,
  "searchId": "search_abc123",
  "status": "pending|complete|failed",
  "result": {                           // Only present when status is "complete"
    "jobs": [...],
    "provider": "scraping-dog",
    "totalFound": 25
  },
  "isExisting": false,                  // true if returning cached results
  "message": "Job search is in progress. Results will appear shortly."
}
```

#### Response (Direct Search)

```json
{
  "success": true,
  "result": {
    "jobs": [...],
    "provider": "scraping-dog",
    "totalFound": 25
  },
  "message": "Found 25 jobs using scraping-dog"
}
```

#### Usage Pattern

1. **For cached searches:** POST request → Poll status endpoint until complete
2. **For direct searches:** POST request with `"direct": true` → Immediate results

---

### 2. Job Search Status

**Endpoint:** `GET /api/jobs/status/[searchId]`

Poll the status of a job search and retrieve results when complete.

#### Path Parameters

- `searchId`: The search ID returned from the initial job search request

#### Response

```json
{
  "success": true,
  "searchId": "search_abc123",
  "status": "complete",
  "result": {
    "jobs": [...],
    "provider": "scraping-dog",
    "totalFound": 25
  },
  "jobCount": 25,
  "message": "Found 25 jobs using scraping-dog"
}
```

---

### 3. Reverse Job Search

**Endpoint:** `POST /api/jobs/reverse`

Scrape a specific job URL and convert it to structured format.

#### Request Body

```json
{
  "url": "https://example.com/job-posting", // required: Job posting URL
  "userId": "user123" // optional: User ID for tracking
}
```

#### Response

```json
{
  "success": true,
  "job": {
    "title": "Software Engineer",
    "company": "Tech Corp",
    "location": "London, UK",
    "description": "...",
    "requirements": [...],
    "benefits": [...]
  },
  "jobId": "job_xyz789",
  "message": "Successfully scraped and processed job: Software Engineer at Tech Corp",
  "responseTime": 2.5
}
```

---

### 4. Process Job with AI

**Endpoint:** `POST /api/jobs/process`

Manually trigger AI processing for a specific job (for testing/debugging).

#### Request Body

```json
{
  "jobId": "job_xyz789" // required: Job ID to process
}
```

#### Response

```json
{
  "success": true,
  "message": "Successfully processed job: Software Engineer",
  "jobId": "job_xyz789"
}
```

---

### 5. Process All Jobs

**Endpoint:** `POST /api/jobs/process-all`

Batch process all unprocessed jobs with AI (up to 10 at a time).

#### Request Body

```json
{} // Empty body
```

#### Response

```json
{
  "success": true,
  "message": "Processed 8 jobs, 2 failed",
  "processed": 8,
  "failed": 2,
  "total": 10
}
```

---

## LinkedIn Search Endpoints

### 1. LinkedIn Professional Search

**Endpoint:** `POST /api/linkedin`

Search for LinkedIn professionals using the Exa API.

#### Request Body

```json
{
  "jobTitle": "Software Engineers", // required: Job title to search for
  "userLocation": "GB", // required: Location code (GB, US, etc.)
  "numResults": 50, // required: Number of results (1-100)
  "userId": "user123", // optional: User ID for tracking
  "direct": false // optional: Bypass caching (default: false)
}
```

#### Response (Cached Search)

```json
{
  "success": true,
  "searchId": "linkedin_search_abc123",
  "status": "pending|complete|failed",
  "result": {                             // Only present when status is "complete"
    "profiles": [...],
    "totalFound": 50
  },
  "profiles": [...],                      // Available profiles (may be partial for pending)
  "isExisting": false,
  "message": "Found 50 LinkedIn profiles"
}
```

#### Response (Direct Search)

```json
{
  "success": true,
  "result": {
    "profiles": [...],
    "totalFound": 50,
    "searchId": "linkedin_search_abc123"
  },
  "message": "Found 50 LinkedIn profiles (AI processing in background)"
}
```

---

### 2. LinkedIn Search Status

**Endpoint:** `GET /api/linkedin/status/[searchId]`

Check the status of a LinkedIn search.

#### Path Parameters

- `searchId`: The search ID returned from the initial LinkedIn search

#### Response

```json
{
  "success": true,
  "searchId": "linkedin_search_abc123",
  "status": "complete",
  "result": {
    "profiles": [...],
    "totalFound": 50
  },
  "searchParams": {
    "jobTitle": "Software Engineers",
    "userLocation": "GB",
    "numResults": 50
  },
  "createdAt": 1640995200000,
  "updatedAt": 1640995260000,
  "message": "LinkedIn search completed with 50 profiles found"
}
```

---

### 3. Get LinkedIn Profiles

**Endpoint:** `GET /api/linkedin/profiles`

Retrieve LinkedIn profiles with optional filtering and semantic search.

#### Query Parameters

- `userId`: Filter by user ID
- `searchId`: Filter by search ID
- `author`: Filter by profile author name
- `url`: Filter by specific LinkedIn URL
- `userLocation`: Filter by search location (e.g., "GB", "US")
- `profileLocation`: Filter by extracted profile location
- `position`: Filter by extracted position
- `limit`: Limit results (default: 50, max: 100)
- `search`: Semantic search query

#### Response

```json
{
  "success": true,
  "profiles": [
    {
      "author": "John Smith",
      "position": "Senior Software Engineer",
      "location": "London, England",
      "company": "Tech Corp",
      "experience": "5+ years",
      "skills": ["JavaScript", "React", "Node.js"],
      "url": "https://linkedin.com/in/johnsmith"
    }
  ],
  "total": 25,
  "message": "Found 25 LinkedIn profiles"
}
```

---

### 4. Get Specific LinkedIn Profile

**Endpoint:** `GET /api/linkedin/profiles/[profileId]`

Retrieve a specific LinkedIn profile by ID.

#### Path Parameters

- `profileId`: The profile ID to retrieve

#### Response

```json
{
  "success": true,
  "profile": {
    "author": "John Smith",
    "position": "Senior Software Engineer",
    "location": "London, England",
    "company": "Tech Corp",
    "experience": "5+ years",
    "skills": ["JavaScript", "React", "Node.js"],
    "url": "https://linkedin.com/in/johnsmith"
  },
  "message": "Retrieved LinkedIn profile for John Smith"
}
```

---

## Research Endpoints

### 1. Company Research

**Endpoint:** `POST /api/research`

Perform company and position research with duplicate prevention and caching.

#### Request Body

```json
{
  "company": "Google", // required: Company name
  "position": "Product Manager", // required: Position title
  "location": "Dublin", // required: Location
  "type": "completion", // optional: "completion"|"structured"|"streaming"
  "userId": "user123", // optional: User ID for tracking
  "storeResult": true // optional: Store result (default: false)
}
```

#### Response Types

**Pending Research:**

```json
{
  "reportId": "report_abc123",
  "status": "pending"
}
```

**Complete Research:**

```json
{
  "reportId": "report_abc123",
  "status": "complete",
  "report": {
    "company": "Google",
    "position": "Product Manager",
    "location": "Dublin",
    "analysis": "...",
    "keyInsights": [...],
    "recommendations": [...]
  },
  "isExisting": false,
  "type": "completion"
}
```

**Failed Research:**

```json
{
  "reportId": "report_abc123",
  "status": "failed",
  "error": "Research failed due to timeout"
}
```

#### Streaming Response

When `type: "streaming"` is used, the response is a Server-Sent Events stream:

```
data: {"chunk": "Researching Google..."}

data: {"chunk": "Analysing Product Manager role..."}

data: [DONE]
```

---

### 2. Research Status

**Endpoint:** `GET /api/research/status/[reportId]`

Poll the status of a research report.

#### Path Parameters

- `reportId`: The report ID returned from the initial research request

#### Response

```json
{
  "reportId": "report_abc123",
  "status": "complete",
  "data": {
    "company": "Google",
    "position": "Product Manager",
    "analysis": "...",
    "keyInsights": [...],
    "recommendations": [...]
  },
  "model": "gpt-4",
  "responseTime": 45.2,
  "costDollars": 0.15,
  "createdAt": 1640995200000,
  "updatedAt": 1640995260000
}
```

---

### 3. Search Research Reports

**Endpoint:** `POST /api/research/search`

Semantic search through existing research reports.

#### Request Body

```json
{
  "query": "fintech startups in London", // required: Search query
  "userId": "user123", // optional: User ID filter
  "limit": 10 // optional: Result limit (default: 10, max: 50)
}
```

#### Response

```json
{
  "query": "fintech startups in London",
  "results": [
    {
      "reportId": "report_abc123",
      "company": "Monzo",
      "position": "Software Engineer",
      "location": "London",
      "score": 0.95,
      "createdAt": 1640995200000
    }
  ],
  "count": 5
}
```

---

### 4. List Research Reports

**Endpoint:** `GET /api/research/search`

List and filter research reports.

#### Query Parameters

- `userId`: Filter by user ID
- `company`: Filter by company name
- `position`: Filter by position
- `location`: Filter by location
- `limit`: Limit results (default: 10, max: 50)
- `action`: "list" (default) or "similar"

#### Response

```json
{
  "action": "list",
  "filters": {
    "userId": "user123",
    "company": "Google",
    "position": "Product Manager"
  },
  "results": [
    {
      "reportId": "report_abc123",
      "company": "Google",
      "position": "Product Manager",
      "location": "Dublin",
      "createdAt": 1640995200000,
      "status": "complete"
    }
  ],
  "count": 1
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:

- `400`: Bad Request (invalid parameters)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error
- `501`: Not Implemented (feature not yet available)

---

## Integration Examples

### Job Search Workflow

```javascript
// 1. Start job search
const searchResponse = await fetch(`${process.env.CS_API_BASE_URL}/jobs`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-vercel-protection-bypass": process.env.VERCEL_PROTECTION_BYPASS_SECRET,
  },
  body: JSON.stringify({
    query: "Software Engineer",
    location: "London",
    countryCode: "gb",
  }),
});

const searchData = await searchResponse.json();

if (searchData.status === "pending") {
  // 2. Poll for results
  const pollStatus = async () => {
    const statusResponse = await fetch(
      `${process.env.CS_API_BASE_URL}/jobs/status/${searchData.searchId}`,
      {
        headers: {
          "x-vercel-protection-bypass":
            process.env.VERCEL_PROTECTION_BYPASS_SECRET,
        },
      }
    );
    const statusData = await statusResponse.json();

    if (statusData.status === "complete") {
      console.log("Jobs found:", statusData.result.jobs);
      return statusData.result.jobs;
    } else if (statusData.status === "pending") {
      // Wait and poll again
      setTimeout(pollStatus, 2000);
    } else {
      console.error("Search failed:", statusData.message);
    }
  };

  pollStatus();
} else if (searchData.status === "complete") {
  console.log("Jobs found:", searchData.result.jobs);
}
```

### LinkedIn Search Workflow

```javascript
// Direct search for immediate results
const linkedinResponse = await fetch(
  `${process.env.CS_API_BASE_URL}/linkedin`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vercel-protection-bypass": process.env.VERCEL_PROTECTION_BYPASS_SECRET,
    },
    body: JSON.stringify({
      jobTitle: "Data Scientists",
      userLocation: "GB",
      numResults: 30,
      direct: true,
    }),
  }
);

const linkedinData = await linkedinResponse.json();
console.log("LinkedIn profiles:", linkedinData.result.profiles);
```

### Research Workflow

```javascript
// 1. Start research
const researchResponse = await fetch(
  `${process.env.CS_API_BASE_URL}/research`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vercel-protection-bypass": process.env.VERCEL_PROTECTION_BYPASS_SECRET,
    },
    body: JSON.stringify({
      company: "Stripe",
      position: "Backend Engineer",
      location: "Dublin",
      type: "structured",
    }),
  }
);

const researchData = await researchResponse.json();

if (researchData.status === "pending") {
  // 2. Poll for results
  const pollResearch = async () => {
    const statusResponse = await fetch(
      `${process.env.CS_API_BASE_URL}/research/status/${researchData.reportId}`,
      {
        headers: {
          "x-vercel-protection-bypass":
            process.env.VERCEL_PROTECTION_BYPASS_SECRET,
        },
      }
    );
    const statusData = await statusResponse.json();

    if (statusData.status === "complete") {
      console.log("Research complete:", statusData.data);
      return statusData.data;
    } else if (statusData.status === "pending") {
      setTimeout(pollResearch, 3000);
    }
  };

  pollResearch();
}
```

---

## Caching & Performance

- **Job searches**: Cached for efficiency, use `direct: true` for immediate results
- **LinkedIn searches**: Results stored and processed with AI in background
- **Research reports**: Cached for 7 days to prevent duplicates
- **Timeouts**: Pending requests timeout after 5 minutes

## Rate Limits

The API uses external services with their own rate limits:

- **Scraping Dog**: Primary job search provider
- **SerpAPI**: Fallback job search provider
- **Exa API**: LinkedIn professional search
- **OpenRouter**: AI processing for research and data structuring

Consider implementing appropriate delays between requests to avoid hitting external service limits.
