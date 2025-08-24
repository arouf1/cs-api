import { NextRequest, NextResponse } from "next/server";
import {
  getLinkedInProfiles,
  searchLinkedInProfiles,
} from "@/lib/linkedin/linkedin-storage";

/**
 * GET /api/linkedin/profiles
 * Get LinkedIn profiles with optional filters
 *
 * Query parameters:
 * - userId?: string - Filter by user ID
 * - searchId?: string - Filter by search ID
 * - author?: string - Filter by profile author name
 * - url?: string - Filter by specific LinkedIn URL
 * - userLocation?: string - Filter by search location (e.g., "GB", "US", "London")
 * - profileLocation?: string - Filter by extracted profile location (e.g., "Greater Chicago Area", "London, England")
 * - position?: string - Filter by extracted position (e.g., "Data Science Leader", "Software Engineer")
 * - limit?: number - Limit number of results (default: 50, max: 100)
 * - search?: string - Semantic search query
 *
 * Returns:
 * - { success: true, profiles: [...], total: number }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId") || undefined;
    const searchId = searchParams.get("searchId") || undefined;
    const author = searchParams.get("author") || undefined;
    const url = searchParams.get("url") || undefined;
    const userLocation = searchParams.get("userLocation") || undefined;
    const profileLocation = searchParams.get("profileLocation") || undefined;
    const position = searchParams.get("position") || undefined;
    const limitParam = searchParams.get("limit");
    const searchQuery = searchParams.get("search") || undefined;

    const limit = limitParam ? Math.min(parseInt(limitParam), 100) : 50;

    if (searchQuery) {
      // Semantic search
      console.log(
        "Performing semantic search for LinkedIn profiles:",
        searchQuery
      );

      const profiles = await searchLinkedInProfiles(searchQuery, {
        userId,
        limit,
      });

      return NextResponse.json({
        success: true,
        profiles,
        total: profiles.length,
        message: `Found ${profiles.length} profiles matching "${searchQuery}"`,
      });
    } else {
      // General filtered search
      console.log("Getting LinkedIn profiles with filters:", {
        userId,
        searchId,
        author,
        url,
        userLocation,
        profileLocation,
        position,
        limit,
      });

      const profiles = await getLinkedInProfiles({
        userId,
        searchId,
        author,
        url,
        userLocation,
        profileLocation,
        position,
        limit,
      });

      return NextResponse.json({
        success: true,
        profiles,
        total: profiles.length,
        message: `Found ${profiles.length} LinkedIn profiles`,
      });
    }
  } catch (error) {
    console.error("LinkedIn profiles API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
