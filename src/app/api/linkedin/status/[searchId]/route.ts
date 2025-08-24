import { NextRequest, NextResponse } from "next/server";
import { getLinkedInSearch } from "@/lib/linkedin/linkedin-storage";

/**
 * GET /api/linkedin/status/[searchId]
 * Get the status of a LinkedIn search by search ID
 *
 * Path parameters:
 * - searchId: string (required) - The search ID to check
 *
 * Returns:
 * - { success: true, searchId, status, result?, message }
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
          error: "Search ID is required",
        },
        { status: 400 }
      );
    }

    console.log("Checking LinkedIn search status:", searchId);

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

    // Check if search has expired (pending for more than 5 minutes)
    const now = Date.now();
    const isExpired =
      searchResult.status === "pending" &&
      searchResult.expiresAt &&
      searchResult.expiresAt < now;

    const status = isExpired ? "failed" : searchResult.status;

    let message: string;
    switch (status) {
      case "complete":
        message = `LinkedIn search completed with ${searchResult.data?.totalFound || 0} profiles found`;
        break;
      case "pending":
        message =
          "LinkedIn search is still in progress. Please check again in a few moments.";
        break;
      case "failed":
        message = isExpired
          ? "LinkedIn search timed out. Please try again."
          : "LinkedIn search failed. Please try again.";
        break;
      default:
        message = "Unknown search status";
    }

    return NextResponse.json({
      success: true,
      searchId: searchResult._id,
      status,
      result: status === "complete" ? searchResult.data : undefined,
      searchParams: {
        jobTitle: searchResult.jobTitle,
        userLocation: searchResult.userLocation,
        numResults: searchResult.numResults,
      },
      createdAt: searchResult.createdAt,
      updatedAt: searchResult.updatedAt,
      message,
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
