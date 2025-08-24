import { NextRequest, NextResponse } from "next/server";
import {
  searchLinkedInProfessionals,
  searchLinkedInProfilesDirect,
  validateLinkedInSearchParams,
  type LinkedInSearchParams,
} from "@/lib/linkedin";

/**
 * POST /api/linkedin
 * Search for LinkedIn professionals using Exa API
 *
 * Body:
 * - jobTitle: string (required) - Job title to search for (e.g., "Software Engineers")
 * - userLocation: string (required) - Location code (e.g., "GB", "US")
 * - numResults: number (required) - Number of results to return (1-100)
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
    const { jobTitle, userLocation, numResults, userId, direct = false } = body;

    // Validate required parameters
    const params: LinkedInSearchParams = {
      jobTitle,
      userLocation,
      numResults,
    };

    validateLinkedInSearchParams(params);

    if (direct) {
      // Direct search without caching/status management
      console.log("Performing direct LinkedIn search:", params);

      const result = await searchLinkedInProfilesDirect(params, {
        userId,
        storeResult: true, // Still store for future reference
      });

      // Get the stored profiles from the database
      if (result.searchId) {
        const { getLinkedInProfiles } = await import(
          "@/lib/linkedin/linkedin-storage"
        );
        const profiles = await getLinkedInProfiles({
          searchId: result.searchId,
          limit: 100,
        });

        return NextResponse.json({
          success: true,
          result: {
            ...result,
            profiles: profiles.map((p) => ({
              ...p.aiData,
              isProcessed: p.isProcessed ?? false,
            })),
          },
          message: `Found ${profiles.length} LinkedIn profiles (AI processing in background)`,
        });
      }

      return NextResponse.json({
        success: true,
        result,
        message: `Found ${result.totalFound} LinkedIn profiles`,
      });
    } else {
      // Cached search with status management
      console.log("Performing cached LinkedIn search:", params);

      const searchResult = await searchLinkedInProfessionals(params, {
        userId,
      });

      if (searchResult.status === "complete" && searchResult.result) {
        // Get the actual profiles from the database
        const { getLinkedInProfiles } = await import(
          "@/lib/linkedin/linkedin-storage"
        );
        const profiles = await getLinkedInProfiles({
          searchId: searchResult.searchId,
          limit: 100,
        });

        return NextResponse.json({
          success: true,
          searchId: searchResult.searchId,
          status: searchResult.status,
          result: {
            ...searchResult.result,
            profiles: profiles.map((p) => p.aiData), // Return the structured profile data
          },
          isExisting: searchResult.isExisting,
          message: `Found ${profiles.length} LinkedIn profiles`,
        });
      } else if (searchResult.status === "pending") {
        // For pending searches, return any profiles that are already stored
        const { getLinkedInProfiles } = await import(
          "@/lib/linkedin/linkedin-storage"
        );
        const profiles = await getLinkedInProfiles({
          searchId: searchResult.searchId,
          limit: 100,
        });

        return NextResponse.json({
          success: true,
          searchId: searchResult.searchId,
          status: searchResult.status,
          profiles: profiles.map((p) => ({
            ...p.aiData,
            isProcessed: p.isProcessed ?? false,
          })),
          isExisting: searchResult.isExisting,
          message:
            profiles.length > 0
              ? `Found ${profiles.length} LinkedIn profiles (AI processing in progress)`
              : "LinkedIn search is in progress. Profiles will appear shortly.",
        });
      } else {
        // Return failed status
        return NextResponse.json({
          success: true,
          searchId: searchResult.searchId,
          status: searchResult.status,
          isExisting: searchResult.isExisting,
          message: "LinkedIn search failed. Please try again.",
        });
      }
    }
  } catch (error) {
    console.error("LinkedIn search API error:", error);

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
 * GET /api/linkedin?searchId=xxx
 * Get LinkedIn search results by search ID
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

    // Import storage function here to avoid circular imports
    const { getLinkedInSearch } = await import(
      "@/lib/linkedin/linkedin-storage"
    );

    const searchResult = await getLinkedInSearch(searchId);

    if (!searchResult) {
      return NextResponse.json(
        {
          success: false,
          error: "LinkedIn search not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      searchId: searchResult._id,
      status: searchResult.status,
      result:
        searchResult.status === "complete" ? searchResult.data : undefined,
      message:
        searchResult.status === "complete"
          ? `LinkedIn search completed with ${searchResult.data?.totalFound || 0} profiles`
          : searchResult.status === "pending"
            ? "LinkedIn search is still in progress"
            : "LinkedIn search failed",
    });
  } catch (error) {
    console.error("LinkedIn search status API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
