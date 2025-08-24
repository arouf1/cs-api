# Reverse Job Search API

The Reverse Job Search API allows you to scrape job postings from any URL and store them in the same structured format as jobs found through the regular job search API.

## Overview

Instead of searching for jobs using keywords and locations, reverse job search takes a specific job posting URL, scrapes its content, and processes it with AI to extract structured job data. This is useful for:

- Adding specific job postings you've found manually
- Processing job URLs from company career pages
- Converting job postings from any source into your standardised format
- Building a comprehensive job database from various sources

## API Endpoint

```
POST /api/jobs/reverse
```

## Request Body

```json
{
  "url": "https://careers.sohohouse.com/careers/4660459101?region=United%20Kingdom",
  "userId": "optional-user-id"
}
```

### Parameters

- `url` (string, required): The URL of the job posting to scrape
- `userId` (string, optional): User ID for tracking purposes

## Response

### Success Response

```json
{
  "success": true,
  "job": {
    "title": "Head Chef - Brighton Beach House",
    "company": "Soho House",
    "location": "Brighton",
    "description": "Full job description...",
    "jobType": "Full-time",
    "salaryRange": null,
    "experienceLevel": "Senior",
    "requirements": {
      "essential": [
        "Up to 3-5 years' experience in a busy kitchen within a senior management capacity",
        "Excellent interpersonal skills and ability to build relationships",
        "Strong attention to details"
      ],
      "preferred": [],
      "skills": [
        "Kitchen management",
        "Team leadership",
        "Food safety compliance"
      ],
      "experience": "3-5 years in senior kitchen management",
      "education": null
    },
    "benefits": [
      "Weekly Pay",
      "Team meal whilst on shift prepared by our chefs",
      "£20 Taxi Contribution for late shifts",
      "Every House Membership",
      "50% off Food & Drink, 7 days a week"
    ],
    "jobAnalysis": {
      "summary": "Senior culinary leadership role overseeing kitchen operations at Brighton Beach House...",
      "keyResponsibilities": [
        "Working alongside the General Manager to improve the food offering",
        "Oversee entire kitchen operation team including recruitment and training",
        "Ensure health and safety policy compliance"
      ],
      "idealCandidate": "Experienced kitchen manager with 3-5 years in senior roles...",
      "careerProgression": "Opportunity to lead kitchen operations in premium hospitality environment",
      "companySize": "Large",
      "industry": "Hospitality",
      "workArrangement": "On-site"
    },
    "applicationDetails": {
      "applyOptions": [
        {
          "platform": "Greenhouse",
          "url": "https://job-boards.eu.greenhouse.io/sohohouseco/jobs/4660459101"
        }
      ],
      "postedDate": null,
      "applicationDeadline": null
    },
    "sourceUrl": "https://careers.sohohouse.com/careers/4660459101?region=United%20Kingdom",
    "provider": "reverse",
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  },
  "jobId": "reverse-1705315800000-abc123def",
  "message": "Successfully scraped and processed job: Head Chef - Brighton Beach House at Soho House",
  "responseTime": 3500
}
```

### Error Response

```json
{
  "success": false,
  "error": "Invalid URL format"
}
```

## How It Works

1. **URL Validation**: The API validates that the provided URL is properly formatted
2. **Web Scraping**: Uses ScrapingDog API to scrape the job posting content in markdown format
3. **AI Processing**: Processes the scraped content with AI to extract structured job data
4. **Data Storage**: Stores the job in the same database format as regular job search results
5. **Response**: Returns the structured job data immediately

## Data Structure

The reverse job search returns the same `StructuredJob` format as the regular job search API, ensuring consistency across all job data in your system. The only difference is the `provider` field, which is set to `"reverse"` instead of `"serpapi"`.

## Processing

The reverse job search processes URLs through web scraping and AI analysis to extract structured job data, with no additional pricing beyond your existing API usage.

## Rate Limits

The API inherits rate limits from your configured services:

- ScrapingDog API limits for web scraping
- OpenRouter API limits for AI processing

## Error Handling

Common error scenarios:

- **Invalid URL**: Returns 400 error if URL format is invalid
- **Scraping Failed**: Returns 400 error if the URL cannot be scraped
- **AI Processing Failed**: Returns 400 error if content cannot be processed
- **Storage Failed**: Returns 500 error if job cannot be stored

## Example Usage

### cURL

```bash
curl -X POST http://localhost:3000/api/jobs/reverse \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://careers.sohohouse.com/careers/4660459101?region=United%20Kingdom",
    "userId": "user123"
  }'
```

### JavaScript

```javascript
const response = await fetch("/api/jobs/reverse", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://careers.sohohouse.com/careers/4660459101?region=United%20Kingdom",
    userId: "user123",
  }),
});

const result = await response.json();
console.log(result.job);
```

### Node.js Test Script

A test script is provided at `test-reverse-job-search.js` to test the functionality:

```bash
node test-reverse-job-search.js
```

## Environment Variables

Make sure to set the following environment variables:

```env
# ScrapingDog API key for web scraping
SCRAPINGDOG_API_KEY=your_scrapingdog_api_key

# OpenRouter API key for AI processing
OPENROUTER_API_KEY=your_openrouter_api_key

# OpenAI API key for embeddings
OPENAI_API_KEY=your_openai_api_key
```

## Integration with Existing System

The reverse job search integrates seamlessly with the existing job search system:

- Uses the same database schema and storage functions
- Jobs are stored with embeddings for semantic search
- Can be filtered and searched alongside regular job search results
- Supports the same user tracking and analytics

## Supported Websites

The reverse job search can work with any publicly accessible job posting URL. It has been tested with:

- Company career pages (like Soho House careers)
- Job boards (Indeed, LinkedIn, etc.)
- Recruitment agency websites
- Custom job posting pages

The AI processing is designed to extract job information from various formats and layouts, making it versatile across different website structures.
