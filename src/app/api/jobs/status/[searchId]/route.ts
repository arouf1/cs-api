import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/jobs/status/[searchId]
 * Get job search status and results by search ID
 *
 * Path parameters:
 * - searchId: string - The search ID to check status for
 *
 * Returns:
 * - { searchId, status, result?, message }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  try {
    const { searchId } = await params;

    if (!searchId) {
      return NextResponse.json(
        {
          success: false,
          error: "searchId parameter is required",
        },
        { status: 400 }
      );
    }

    const { getJobSearch, getJobResults } = await import("@/lib/jobs/job-storage");
    
    const searchResult = await getJobSearch(searchId);

    if (!searchResult) {
      return NextResponse.json(
        {
          success: false,
          error: "Job search not found",
          searchId,
        },
        { status: 404 }
      );
    }

    // Get the job results for this search
    const jobResults = await getJobResults({ searchId });

    if (searchResult.status === "complete" && searchResult.data) {
      return NextResponse.json({
        success: true,
        searchId,
        status: searchResult.status,
        result: {
          ...searchResult.data,
          jobs: jobResults || []
        },
        jobCount: jobResults?.length || 0,
        message: `Found ${jobResults?.length || 0} jobs using ${searchResult.data.provider}`,
      });
    } else if (searchResult.status === "pending") {
      // For pending searches, return any jobs that are already stored
      return NextResponse.json({
        success: true,
        searchId,
        status: searchResult.status,
        jobs: jobResults || [],
        jobCount: jobResults?.length || 0,
        message:
          (jobResults?.length || 0) > 0
            ? `Found ${jobResults?.length} jobs (processing in progress)`
            : "Job search is in progress. Results will appear shortly.",
      });
    } else {
      // Return failed status
      return NextResponse.json({
        success: true,
        searchId,
        status: searchResult.status,
        message: "Job search failed. Please try again.",
      });
    }
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
