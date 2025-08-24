import { NextRequest, NextResponse } from "next/server";
import { getJobResults, updateJobResultWithAI } from "@/lib/jobs/job-storage";
import { parseJobWithAI } from "@/lib/jobs/jobSearch";

// Process all unprocessed jobs with AI
export async function POST(request: NextRequest) {
  try {
    console.log("🤖 Starting batch AI processing for all unprocessed jobs...");

    // Get all unprocessed jobs
    const unprocessedJobs = await getJobResults({
      isProcessed: false,
      limit: 10, // Process max 10 at a time to avoid timeouts
    });

    console.log(`Found ${unprocessedJobs.length} unprocessed jobs`);

    if (unprocessedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unprocessed jobs found",
        processed: 0,
      });
    }

    let processed = 0;
    let failed = 0;

    for (const job of unprocessedJobs) {
      try {
        console.log(`🔄 Processing job ${job._id}: ${job.title}`);

        if (!job.rawData) {
          console.error(`❌ Job ${job._id} missing raw data`);
          failed++;
          continue;
        }

        // Parse with AI
        const structuredJob = await parseJobWithAI(job.rawData);

        // Update the stored job with AI-processed data
        await updateJobResultWithAI(job._id, structuredJob);

        console.log(`✅ AI processed job: ${structuredJob.title}`);
        processed++;
      } catch (error) {
        console.error(`❌ Failed to process job ${job._id}:`, error);
        failed++;
      }
    }

    console.log(
      `🎉 Batch processing complete: ${processed} processed, ${failed} failed`
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} jobs, ${failed} failed`,
      processed,
      failed,
      total: unprocessedJobs.length,
    });
  } catch (error) {
    console.error("❌ Batch processing failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
