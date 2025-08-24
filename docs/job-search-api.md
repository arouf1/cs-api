# Job Search API Documentation

The Job Search API provides comprehensive job search capabilities using SerpAPI with a unified schema and AI-powered job analysis.

## Overview

- **Data Provider**: SerpAPI (Google Jobs API)
- **AI Processing**: Uses GPT-4.1-mini to structure and analyse job postings
- **Unified Schema**: Consistent data format for all job results
- **British English**: All copy and responses use British English

## Authentication

All API endpoints require proper authentication. Ensure your API key is configured:

```env
SERPAPI_API_KEY=your_serpapi_api_key
```

## Endpoints

### POST /api/jobs

Search for job postings with AI-powered analysis and structured data extraction.

#### Request Body

```json
{
  "query": "Software Engineer",
  "location": "London",
  "numResults": 10,
  "countryCode": "gb",
  "userId": "user123",
  "direct": true
}
```

#### Parameters

| Parameter     | Type    | Required | Description                                             |
| ------------- | ------- | -------- | ------------------------------------------------------- |
| `query`       | string  | Yes      | Job search query (e.g., "Software Engineer", "Barista") |
| `location`    | string  | Yes      | Location to search in (e.g., "London", "New York")      |
| `numResults`  | number  | Yes      | Number of results to return (1-100)                     |
| `countryCode` | string  | No       | Country code (e.g., "gb", "us") - defaults to "gb"      |
| `userId`      | string  | No       | User ID for tracking purposes                           |
| `direct`      | boolean | No       | If true, returns results immediately without caching    |

#### Response

```json
{
  "success": true,
  "result": {
    "searchId": "job-search-1234567890-abc123",
    "jobs": [
      {
        "title": "Senior Software Engineer",
        "company": "TechCorp Ltd",
        "location": "London, UK",
        "description": "We are seeking a talented Senior Software Engineer...",
        "jobType": "Full-time",
        "salaryRange": "£60,000 - £80,000",
        "experienceLevel": "Senior",
        "requirements": {
          "essential": [
            "5+ years of software development experience",
            "Proficiency in JavaScript and TypeScript",
            "Experience with React and Node.js"
          ],
          "preferred": [
            "Experience with cloud platforms (AWS, Azure)",
            "Knowledge of microservices architecture"
          ],
          "skills": [
            "JavaScript",
            "TypeScript",
            "React",
            "Node.js",
            "Git",
            "Agile methodologies"
          ],
          "experience": "5+ years",
          "education": "Bachelor's degree in Computer Science or related field"
        },
        "benefits": [
          "Competitive salary",
          "Health insurance",
          "Flexible working hours",
          "Remote work options",
          "Professional development budget"
        ],
        "jobAnalysis": {
          "summary": "This is a senior-level software engineering position at a growing tech company, offering competitive compensation and excellent growth opportunities.",
          "keyResponsibilities": [
            "Design and develop scalable web applications",
            "Collaborate with cross-functional teams",
            "Mentor junior developers",
            "Participate in code reviews and architectural decisions"
          ],
          "idealCandidate": "An experienced software engineer with strong technical skills and leadership potential",
          "careerProgression": "Opportunities to progress to Lead Engineer or Engineering Manager roles",
          "companySize": "Medium",
          "industry": "Technology",
          "workArrangement": "Hybrid"
        },
        "applicationDetails": {
          "applyOptions": [
            {
              "platform": "LinkedIn",
              "url": "https://linkedin.com/jobs/view/123456"
            },
            {
              "platform": "Indeed",
              "url": "https://indeed.co.uk/viewjob?jk=abc123"
            }
          ],
          "postedDate": "2024-01-15",
          "applicationDeadline": null
        },
        "sourceUrl": "https://www.google.com/search?q=software+engineer+london",
        "provider": "scrapingdog",
        "lastUpdated": "2024-01-16T10:30:00Z"
      }
    ],
    "totalFound": 25,
    "searchParams": {
      "query": "Software Engineer",
      "location": "London",
      "numResults": 10,
      "countryCode": "gb"
    },
    "costDollars": 0.25,
    "responseTime": 3500,
    "provider": "scrapingdog"
  },
  "message": "Found 10 jobs using scrapingdog"
}
```

### GET /api/jobs/status/[searchId]

Get the status and results of a job search by search ID.

#### Parameters

| Parameter  | Type   | Required | Description                                            |
| ---------- | ------ | -------- | ------------------------------------------------------ |
| `searchId` | string | Yes      | The search ID returned from the initial search request |

#### Response

```json
{
  "success": true,
  "searchId": "job-search-1234567890-abc123",
  "status": "complete",
  "result": {
    // Same structure as POST /api/jobs response
  },
  "message": "Found 10 jobs using scrapingdog"
}
```

## Data Schema

### StructuredJob

The unified job data structure returned by the API:

```typescript
interface StructuredJob {
  // Basic information
  title: string;
  company: string;
  location: string;
  description: string;

  // Job details
  jobType: string | null; // "Full-time", "Part-time", "Contract", etc.
  salaryRange: string | null;
  experienceLevel: "Entry" | "Mid" | "Senior" | "Lead" | "Executive" | null;

  // Requirements and qualifications
  requirements: {
    essential: string[];
    preferred: string[];
    skills: string[];
    experience: string | null;
    education: string | null;
  };

  // Benefits and perks
  benefits: string[];

  // AI-generated job analysis
  jobAnalysis: {
    summary: string;
    keyResponsibilities: string[];
    idealCandidate: string;
    careerProgression: string | null;
    companySize: "Startup" | "Small" | "Medium" | "Large" | "Enterprise" | null;
    industry: string | null;
    workArrangement: "Remote" | "Hybrid" | "On-site" | "Unknown";
  };

  // Application details
  applicationDetails: {
    applyOptions: Array<{
      platform: string;
      url: string;
    }>;
    postedDate: string | null;
    applicationDeadline: string | null;
  };

  // Metadata
  sourceUrl: string;
  provider: "serpapi";
  lastUpdated: string;
}
```

## Provider Details

The API uses SerpAPI as the data provider with **programmatic localization** and a **standardized output schema** to ensure consistent job data structure across different countries and languages.

### Localization

The API automatically configures SerpAPI parameters based on the `countryCode`:

- **`hl`** (Language): Automatically set based on country (e.g., "en" for GB/US, "de" for DE, "fr" for FR)
- **`gl`** (Country): Google's country code (e.g., "uk" for GB, "us" for US, "de" for DE)
- **`google_domain`**: Appropriate Google domain (e.g., "google.co.uk" for GB, "google.de" for DE)

#### Supported Countries

| Country Code     | Language | Google Domain   | Description    |
| ---------------- | -------- | --------------- | -------------- |
| `GB`             | `en`     | `google.co.uk`  | United Kingdom |
| `US`             | `en`     | `google.com`    | United States  |
| `DE`             | `de`     | `google.de`     | Germany        |
| `FR`             | `fr`     | `google.fr`     | France         |
| `ES`             | `es`     | `google.es`     | Spain          |
| `CA`             | `en`     | `google.ca`     | Canada         |
| `AU`             | `en`     | `google.com.au` | Australia      |
| And many more... |          |                 |                |

_Defaults to UK settings if country code not recognised._

## Caching and Expiration

The API implements intelligent caching to balance performance with data freshness:

### Cache Duration

- **Successful Searches**: Cached for **24 hours**
  - Same search within 24 hours returns cached results instantly
  - After 24 hours, a fresh search is performed to get updated job listings

- **Pending Searches**: Expire after **5 minutes**
  - Prevents hanging searches from blocking new attempts
  - Allows retry if initial search takes too long

- **Failed Searches**: **No caching**
  - Failed searches can be retried immediately
  - Each retry attempt gets a new search ID

### Benefits

- **⚡ Fast Response**: Instant results for recent searches
- **💰 Cost Efficient**: Reduces API calls within 24-hour window
- **🔄 Fresh Data**: Ensures job listings are updated daily
- **🛡️ No Duplicates**: Prevents duplicate job entries in database

### Standardized Output Schema

All job data from SerpAPI is normalized into the `RawJobData` structure:

```typescript
interface RawJobData {
  id: string; // Unique job identifier
  title: string; // Job title
  company_name: string; // Company name
  location: string; // Job location
  description: string; // Job description
  via?: string; // Source platform (e.g., "Indeed", "LinkedIn")
  share_link?: string; // Link to original job posting
  thumbnail?: string; // Company logo/thumbnail
  detected_extensions?: Record<string, any>; // Parsed job metadata
  job_highlights?: Array<{
    // Structured job highlights
    title: string;
    items: string[];
  }>;
  apply_options?: Array<{
    // Application options
    title: string;
    link: string;
  }>;
  extensions?: string[]; // Job tags (e.g., "Full-time", "2 days ago")
  job_id?: string; // Provider-specific job ID
  provider: "serpapi"; // Data source
  raw_data: any; // Original response for debugging
}
```

This ensures that regardless of which provider is used (primary or fallback), the application receives identical data structures.

### Scraping Dog (Primary)

- **API**: Google Jobs via Scraping Dog
- **Pricing**: ~£0.01 per job result
- **Features**: Comprehensive job data, multiple apply options, job highlights
- **Rate Limits**: Varies by plan
- **Request Format**: Standardized parameters with Scraping Dog specific fields
- **Response Format**: Normalized to `RawJobData` schema

### SerpAPI (Fallback)

- **API**: Google Jobs via SerpAPI (always uses `google_jobs` engine)
- **Pricing**: ~£0.005 per search
- **Features**: Reliable fallback, identical data structure after normalization
- **Rate Limits**: 100 searches/month on free plan
- **Request Format**: Standardized parameters with `google_jobs` engine automatically applied
- **Response Format**: Normalized to `RawJobData` schema (identical to Scraping Dog)

## AI Processing

All job postings are processed using GPT-4.1-mini to:

- Extract structured requirements and qualifications
- Identify key responsibilities and benefits
- Analyse company size and industry
- Determine experience level and work arrangement
- Generate candidate profiles and career progression insights

## Error Handling

The API includes comprehensive error handling:

```json
{
  "success": false,
  "error": "Search query is required and must be a non-empty string"
}
```

Common error scenarios:

- Missing or invalid parameters
- API key not configured
- Provider API failures
- Rate limit exceeded
- AI processing failures

## Rate Limits

- **Scraping Dog**: Varies by plan (typically 1000+ requests/month)
- **SerpAPI**: 100 searches/month on free plan
- **AI Processing**: Subject to OpenRouter limits

## Best Practices

1. **Use Direct Mode**: Set `direct: true` for immediate results
2. **Reasonable Limits**: Request 5-20 results for optimal performance
3. **Specific Queries**: Use detailed search terms for better results
4. **Location Specificity**: Include city/region for localised results
5. **Country Code**: Use proper ISO country codes (gb, us, etc.) for better localisation
6. **Error Handling**: Always handle both provider and AI processing errors
7. **Fallback Reliability**: The system automatically falls back to SerpAPI if Scraping Dog fails

## Examples

### Basic Job Search

```bash
curl -X POST https://your-api.com/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Frontend Developer",
    "location": "Manchester",
    "numResults": 5,
    "countryCode": "gb",
    "direct": true
  }'
```

### Advanced Search with Tracking

```bash
curl -X POST https://your-api.com/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Data Scientist remote",
    "location": "United Kingdom",
    "numResults": 15,
    "countryCode": "gb",
    "userId": "user123",
    "direct": false
  }'
```

### Check Search Status

```bash
curl https://your-api.com/api/jobs/status/job-search-1234567890-abc123
```

## Future Enhancements

- **Job Storage**: Persistent storage with Convex database
- **Search History**: Track user search patterns
- **Job Alerts**: Notifications for new matching jobs
- **Salary Analysis**: Market rate comparisons
- **Company Insights**: Integration with company research data
- **Application Tracking**: Monitor application status
