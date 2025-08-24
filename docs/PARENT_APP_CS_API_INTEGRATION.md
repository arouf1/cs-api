# CS API Integration

This document describes the CS API integration endpoints that provide a migration path from the CAREER_STEER_API_BASE_URL (Supabase-based) to the CS_API_BASE_URL (Convex-based) system.

## Overview

The CS API integration provides a set of endpoints under `/api/cs-api/` that act as proxies to the external CS API service. These endpoints maintain the same functionality as the original Supabase-based system while providing a cleaner, more organised structure.

## Configuration

### Environment Variables

The following environment variables are required:

```env
CS_API_BASE_URL=https://your-cs-api-domain.com/api
VERCEL_AUTOMATION_CS_API_BYPASS_SECRET=your-bypass-secret
```

### Authentication

All requests to the CS API require:

- **Base URL**: Configured via `CS_API_BASE_URL`
- **Protection Bypass**: Header `x-vercel-protection-bypass` with the secret value

## Endpoint Structure

### Job Search Endpoints

#### 1. Job Search

- **Path**: `/api/cs-api/jobs`
- **Method**: `POST`
- **Description**: Search for job postings using multiple providers

**Request Body:**

```json
{
  "query": "Software Engineer",
  "location": "London",
  "countryCode": "gb",
  "direct": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobs": [...],
    "totalFound": 25
  },
  "searchId": "search_abc123",
  "status": "complete|pending",
  "message": "Job search completed"
}
```

#### 2. Job Search Status

- **Path**: `/api/cs-api/jobs/status/[searchId]`
- **Method**: `GET`
- **Description**: Poll job search status and retrieve results

#### 3. Reverse Job Search

- **Path**: `/api/cs-api/jobs/reverse`
- **Method**: `POST`
- **Description**: Scrape specific job URL and convert to structured format

#### 4. Process Job with AI

- **Path**: `/api/cs-api/jobs/process`
- **Method**: `POST`
- **Description**: Manually trigger AI processing for a specific job

#### 5. Batch Process Jobs

- **Path**: `/api/cs-api/jobs/process-all`
- **Method**: `POST`
- **Description**: Batch process all unprocessed jobs with AI

### Professional Search Endpoints

#### 1. Professional Search

- **Path**: `/api/cs-api/professionals`
- **Method**: `POST`
- **Description**: Search for LinkedIn professionals

**Request Body:**

```json
{
  "jobTitle": "Software Engineers",
  "userLocation": "GB",
  "numResults": 50,
  "direct": false
}
```

#### 2. Professional Search Status

- **Path**: `/api/cs-api/professionals/status/[searchId]`
- **Method**: `GET`
- **Description**: Check professional search status

#### 3. Get Professional Profiles

- **Path**: `/api/cs-api/professionals/profiles`
- **Method**: `GET`
- **Description**: Retrieve professional profiles with filtering

**Query Parameters:**

- `userId`, `searchId`, `author`, `url`
- `userLocation`, `profileLocation`, `position`
- `limit`, `search`

#### 4. Get Specific Professional Profile

- **Path**: `/api/cs-api/professionals/profiles/[profileId]`
- **Method**: `GET`
- **Description**: Retrieve specific professional profile by ID

### Research Endpoints

#### 1. Company Research

- **Path**: `/api/cs-api/research`
- **Method**: `POST`
- **Description**: Perform company and position research

**Request Body:**

```json
{
  "company": "Google",
  "position": "Product Manager",
  "location": "Dublin",
  "type": "completion|structured|streaming",
  "storeResult": true
}
```

**Streaming Response:**
When `type: "streaming"`, returns Server-Sent Events stream.

#### 2. Research Status

- **Path**: `/api/cs-api/research/status/[reportId]`
- **Method**: `GET`
- **Description**: Poll research report status

#### 3. Search Research Reports

- **Path**: `/api/cs-api/research/search`
- **Method**: `POST` (semantic search) / `GET` (list/filter)
- **Description**: Search through existing research reports

## Utilities

### Authentication (`/utils/auth.ts`)

- `getCSApiBaseUrl()`: Get configured base URL
- `getCSApiHeaders()`: Get standard headers with bypass secret
- `makeCSApiRequest()`: Make authenticated requests
- `postToCSApi()`, `getFromCSApi()`: Convenience methods

### Error Handling (`/utils/errors.ts`)

- `createErrorResponse()`: Standardised error responses
- `createSuccessResponse()`: Standardised success responses
- `handleCSApiError()`: Convert CS API errors to HTTP responses
- `validateRequiredFields()`, `validateOptionalField()`: Input validation

### Polling (`/utils/polling.ts`)

- `pollCSApiEndpoint()`: Poll endpoints until completion
- `createPendingResponse()`: Create polling response format
- `handlePollingRequest()`: Handle polling-based requests

## Response Format

All endpoints follow a consistent response format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "additionalFields": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

## Usage Examples

### Job Search Workflow

```javascript
// Start job search
const response = await fetch("/api/cs-api/jobs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: "Software Engineer",
    location: "London",
    countryCode: "gb",
  }),
});

const data = await response.json();

if (data.status === "pending") {
  // Poll for results
  const statusResponse = await fetch(
    `/api/cs-api/jobs/status/${data.searchId}`
  );
  const statusData = await statusResponse.json();
  // Handle results when complete
}
```

### Professional Search

```javascript
const response = await fetch("/api/cs-api/professionals", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jobTitle: "Data Scientists",
    userLocation: "GB",
    numResults: 30,
    direct: true,
  }),
});

const data = await response.json();
console.log("Professional profiles:", data.data.profiles);
```

### Company Research with Streaming

```javascript
const response = await fetch("/api/cs-api/research", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    company: "Stripe",
    position: "Backend Engineer",
    location: "Dublin",
    type: "streaming",
  }),
});

// Handle Server-Sent Events
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Process streaming data
}
```

## Migration Notes

### From CAREER_STEER_API_BASE_URL to CS_API_BASE_URL

1. **Environment Variables**: Update from `VERCEL_AUTOMATION_BYPASS_SECRET` to `VERCEL_AUTOMATION_CS_API_BYPASS_SECRET`
2. **Base URL**: Change from `CAREER_STEER_API_BASE_URL` to `CS_API_BASE_URL`
3. **Endpoints**: Use `/api/cs-api/` prefix instead of direct external API calls
4. **Response Format**: All responses now follow standardised success/error format
5. **Authentication**: User authentication is handled automatically via Clerk integration

### Benefits of CS API Integration

1. **Consistent Response Format**: All endpoints return standardised responses
2. **Better Error Handling**: Comprehensive error handling with specific error codes
3. **Built-in Authentication**: Automatic user ID extraction from Clerk
4. **Input Validation**: Robust validation for all request parameters
5. **Organised Structure**: Clean, hierarchical endpoint organisation
6. **Streaming Support**: Native support for Server-Sent Events
7. **Polling Utilities**: Built-in polling mechanisms for async operations

## Testing

Use the main endpoint to check configuration:

```bash
curl http://localhost:3000/api/cs-api
```

This returns configuration status and available endpoints.

## Error Codes

- `CS_API_NOT_CONFIGURED`: CS API base URL not configured
- `INVALID_REQUEST`: Invalid request parameters
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `EXTERNAL_SERVICE_ERROR`: CS API service error
- `MISSING_REQUIRED_FIELDS`: Required fields missing
- `INVALID_*`: Specific field validation errors

## Support

For issues with the CS API integration:

1. Check environment variable configuration
2. Verify CS API service availability
3. Review request format and required fields
4. Check authentication headers and secrets
