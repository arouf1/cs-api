import { NextRequest, NextResponse } from "next/server";
import {
  searchJobs,
  searchJobsDirect,
  validateJobSearchParams,
  type JobSearchParams,
} from "@/lib/jobs";

/**
 * POST /api/jobs
 * Search for job postings using Scraping Dog (primary) and SerpAPI (fallback)
 *
 * Body:
 * - query: string (required) - Job search query (e.g., "Software Engineer", "Barista")
 * - location: string (required) - Location to search in (e.g., "London", "New York")
 * - numResults: number (required) - Number of results to return (1-100)
 * - countryCode?: string (optional) - Country code (e.g., "gb", "us") - defaults to "gb"
 * - userId?: string (optional) - User ID for tracking
 * - direct?: boolean (optional) - If true, bypass caching and return results immediately
 *
 * Returns:
 * - For cached searches: { searchId, status, result?, isExisting? }
 * - For direct searches: { result }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      location,
      countryCode = "gb",
      userId,
      direct = false,
    } = body;

    // Validate required parameters (numResults always set to 100)
    const params: JobSearchParams = {
      query,
      location,
      countryCode,
    };

    const validatedParams = validateJobSearchParams(params);

    if (direct) {
      // Direct search without caching/status management
      console.log("Performing direct job search:", validatedParams);

      const result = await searchJobsDirect(validatedParams, {
        userId,
        storeResult: false, // For now, don't store direct searches
      });

      return NextResponse.json({
        success: true,
        result,
        message: `Found ${result.jobs.length} jobs using ${result.provider}`,
      });
    } else {
      // Cached search with status management
      console.log("Performing job search:", validatedParams);

      const searchResult = await searchJobs(validatedParams, {
        userId,
      });

      if (searchResult.status === "complete" && searchResult.result) {
        return NextResponse.json({
          success: true,
          searchId: searchResult.searchId,
          status: searchResult.status,
          result: searchResult.result,
          isExisting: searchResult.isExisting,
          message: `Found ${searchResult.result.jobs.length} jobs using ${searchResult.result.provider}`,
        });
      } else if (searchResult.status === "pending") {
        return NextResponse.json({
          success: true,
          searchId: searchResult.searchId,
          status: searchResult.status,
          isExisting: searchResult.isExisting,
          message: "Job search is in progress. Results will appear shortly.",
        });
      } else {
        return NextResponse.json({
          success: true,
          searchId: searchResult.searchId,
          status: searchResult.status,
          isExisting: searchResult.isExisting,
          message: "Job search failed. Please try again.",
        });
      }
    }
  } catch (error) {
    console.error("Job search API error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs?searchId=xxx
 * Get job search results by search ID
 *
 * Query parameters:
 * - searchId: string (required) - The search ID to retrieve
 *
 * Returns:
 * - { searchId, status, result?, message }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchId = searchParams.get("searchId");

    if (!searchId) {
      return NextResponse.json(
        {
          success: false,
          error: "searchId parameter is required",
        },
        { status: 400 }
      );
    }

    // TODO: Implement job search storage and retrieval
    // For now, return a placeholder response
    return NextResponse.json(
      {
        success: false,
        error:
          "Job search storage not yet implemented. Use direct=true for immediate results.",
      },
      { status: 501 }
    );

    // Future implementation:
    // const { getJobSearch } = await import("@/lib/jobs/job-storage");
    // const searchResult = await getJobSearch(searchId);
    //
    // if (!searchResult) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: "Job search not found",
    //     },
    //     { status: 404 }
    //   );
    // }
    //
    // return NextResponse.json({
    //   success: true,
    //   searchId: searchResult._id,
    //   status: searchResult.status,
    //   result: searchResult.status === "complete" ? searchResult.data : undefined,
    //   message: searchResult.status === "complete"
    //     ? `Job search completed with ${searchResult.data?.totalFound || 0} jobs`
    //     : searchResult.status === "pending"
    //       ? "Job search is still in progress"
    //       : "Job search failed",
    // });
  } catch (error) {
    console.error("Job search status API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
