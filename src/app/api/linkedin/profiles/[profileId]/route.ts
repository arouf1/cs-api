import { NextRequest, NextResponse } from "next/server";
import { getLinkedInProfile } from "@/lib/linkedin/linkedin-storage";

/**
 * GET /api/linkedin/profiles/[profileId]
 * Get a specific LinkedIn profile by ID
 *
 * Path parameters:
 * - profileId: string (required) - The profile ID to retrieve
 *
 * Returns:
 * - { success: true, profile: {...} }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId } = await params;

    if (!profileId) {
      return NextResponse.json(
        {
          success: false,
          error: "Profile ID is required",
        },
        { status: 400 }
      );
    }

    console.log("Getting LinkedIn profile:", profileId);

    const profile = await getLinkedInProfile(profileId);

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: "LinkedIn profile not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
      message: `Retrieved LinkedIn profile for ${profile.author}`,
    });
  } catch (error) {
    console.error("LinkedIn profile API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
