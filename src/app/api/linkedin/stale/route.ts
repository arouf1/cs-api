import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/core/convex";

/**
 * POST /api/linkedin/stale
 *
 * Manually trigger stale profile updates (profiles older than 3 months)
 *
 * Body parameters (optional):
 * - batchSize?: number - Number of profiles to process (default: 5, max: 10)
 *
 * GET /api/linkedin/stale
 *
 * Get statistics about stale profiles
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { batchSize = 5 } = body;

    // Limit batch size to prevent rate limiting
    const safeBatchSize = Math.min(Math.max(batchSize, 1), 10);

    console.log(
      `🔄 Manual stale profile update triggered (batch size: ${safeBatchSize})`
    );

    const result = await convex.mutation(
      "functions:triggerStaleProfileUpdates" as any,
      {
        batchSize: safeBatchSize,
      }
    );

    return NextResponse.json({
      success: true,
      result,
      message: `Stale profile update completed: ${result.message}`,
    });
  } catch (error: any) {
    console.error("Failed to trigger stale profile updates:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get all profiles to calculate stale statistics
    const profiles = await convex.query(
      "functions:getLinkedInProfiles" as any,
      {
        limit: 1000, // Get a large sample
      }
    );

    const now = Date.now();
    const threeMonthsAgo = now - 3 * 30 * 24 * 60 * 60 * 1000; // 3 months in milliseconds
    const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds
    const oneYearAgo = now - 12 * 30 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

    const total = profiles.length;
    const stale3Months = profiles.filter(
      (p: any) => p.updatedAt < threeMonthsAgo
    ).length;
    const stale6Months = profiles.filter(
      (p: any) => p.updatedAt < sixMonthsAgo
    ).length;
    const stale1Year = profiles.filter(
      (p: any) => p.updatedAt < oneYearAgo
    ).length;
    const fresh = total - stale3Months;

    // Find recently processed stale updates
    const recentlyProcessed = profiles.filter(
      (p: any) =>
        p.staleUpdateProcessedAt &&
        p.staleUpdateProcessedAt > now - 24 * 60 * 60 * 1000 // Last 24 hours
    ).length;

    // Find profiles with stale update errors
    const withErrors = profiles.filter((p: any) => p.staleUpdateError).length;

    return NextResponse.json({
      success: true,
      stats: {
        total,
        fresh,
        stale3Months,
        stale6Months,
        stale1Year,
        recentlyProcessed,
        withErrors,
        staleness: {
          fresh: Math.round((fresh / total) * 100),
          stale3Months: Math.round((stale3Months / total) * 100),
          stale6Months: Math.round((stale6Months / total) * 100),
          stale1Year: Math.round((stale1Year / total) * 100),
        },
      },
      message: `Found ${stale3Months} stale profiles (>3 months) out of ${total} total`,
    });
  } catch (error: any) {
    console.error("Failed to get stale profile statistics:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
