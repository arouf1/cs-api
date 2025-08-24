import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/core/convex";
import { refreshLinkedInProfile } from "@/lib/linkedin";

/**
 * POST /api/linkedin/profiles/[profileId]/refresh
 *
 * Refresh a single LinkedIn profile by fetching latest data from Exa API
 *
 * Path parameters:
 * - profileId: The Convex document ID of the profile to refresh
 *
 * Body parameters (optional):
 * - userId?: string - User ID to associate with the refresh
 * - userLocation?: string - Location to associate with the refresh
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId } = await params;
    const body = await req.json().catch(() => ({}));
    const { userId, userLocation } = body;

    // Get the profile from the database
    const profile = await convex.query("functions:getLinkedInProfile" as any, {
      id: profileId,
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }

    console.log(
      `🔄 Manual refresh requested for profile: ${profile.author} (${profile.url})`
    );

    // Refresh the profile using the LinkedIn service
    const result = await refreshLinkedInProfile(profile.url, {
      userId,
      userLocation,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        profileId: result.profileId,
        message: result.message,
        profile: {
          id: profileId,
          author: profile.author,
          url: profile.url,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          error: result.error,
          profile: {
            id: profileId,
            author: profile.author,
            url: profile.url,
          },
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Failed to refresh LinkedIn profile:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/linkedin/profiles/[profileId]/refresh
 *
 * Get refresh status and information for a profile
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId } = await params;

    // Get the profile from the database
    const profile = await convex.query("functions:getLinkedInProfile" as any, {
      id: profileId,
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }

    // Calculate how old the profile is
    const now = Date.now();
    const ageInDays = Math.floor(
      (now - profile.updatedAt) / (1000 * 60 * 60 * 24)
    );
    const ageInMonths = Math.floor(ageInDays / 30);
    const isStale = ageInDays > 90; // 3 months

    return NextResponse.json({
      success: true,
      profile: {
        id: profileId,
        author: profile.author,
        url: profile.url,
        updatedAt: profile.updatedAt,
        createdAt: profile.createdAt,
        isStale,
        ageInDays,
        ageInMonths,
        staleUpdateProcessedAt: profile.staleUpdateProcessedAt,
        staleUpdateError: profile.staleUpdateError,
      },
      message: isStale
        ? `Profile is ${ageInMonths} months old and needs refreshing`
        : `Profile is ${ageInDays} days old and up to date`,
    });
  } catch (error: any) {
    console.error("Failed to get profile refresh status:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
