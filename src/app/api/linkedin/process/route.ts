import { NextRequest, NextResponse } from "next/server";
import { convex } from "@/lib/core/convex";

/**
 * POST /api/linkedin/process
 *
 * Manually trigger processing of unprocessed LinkedIn profiles
 *
 * Body parameters:
 * - batchSize?: number - Number of profiles to process (default: 10)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { batchSize = 10 } = body;

    console.log(
      `🔄 Manual trigger: Processing unprocessed LinkedIn profiles (batch size: ${batchSize})`
    );

    // Call the Convex mutation to trigger profile processing
    const result = await convex.mutation(
      "functions:triggerProfileProcessing" as any,
      {
        batchSize: Number(batchSize),
      }
    );

    console.log(`✅ Manual processing completed:`, result);

    return NextResponse.json({
      success: true,
      result,
      message: `Manual processing completed: ${result.message}`,
    });
  } catch (error) {
    console.error("❌ Failed to trigger profile processing:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to trigger profile processing",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/linkedin/process
 *
 * Get information about unprocessed profiles
 */
export async function GET() {
  try {
    // Get count of unprocessed profiles
    const profiles = await convex.query(
      "functions:getLinkedInProfiles" as any,
      {
        limit: 1000, // Get a large number to count
      }
    );

    const unprocessedCount = profiles.filter(
      (p: any) => !p.isProcessed && p.rawData
    ).length;
    const totalCount = profiles.length;
    const processedCount = totalCount - unprocessedCount;

    return NextResponse.json({
      success: true,
      stats: {
        total: totalCount,
        processed: processedCount,
        unprocessed: unprocessedCount,
        processingRate:
          totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0,
      },
      message: `Found ${unprocessedCount} unprocessed profiles out of ${totalCount} total`,
    });
  } catch (error) {
    console.error("❌ Failed to get processing stats:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get processing stats",
      },
      { status: 500 }
    );
  }
}
