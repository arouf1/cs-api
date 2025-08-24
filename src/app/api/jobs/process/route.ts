import { NextRequest, NextResponse } from "next/server";
import { getJobResult, updateJobResultWithAI } from "@/lib/jobs/job-storage";

// Manual AI processing endpoint for testing
export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Job ID is required" },
        { status: 400 }
      );
    }

    console.log(`🔄 Manually processing job ${jobId}...`);

    // Get the stored job with raw data
    const storedJob = await getJobResult(jobId);
    if (!storedJob) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (!storedJob.rawData) {
      return NextResponse.json(
        { success: false, error: "Job missing raw data" },
        { status: 400 }
      );
    }

    console.log(
      `📝 Parsing job with AI: ${storedJob.title || "Unknown Title"}`
    );

    // Import the AI parsing function
    const { parseJobWithAI } = await import("@/lib/jobs/jobSearch");

    // Parse with AI
    const structuredJob = await parseJobWithAI(storedJob.rawData);

    console.log(`💾 Updating job in database: ${structuredJob.title}`);

    // Update the stored job with AI-processed data
    await updateJobResultWithAI(jobId, structuredJob);

    console.log(`✅ AI processed job: ${structuredJob.title}`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed job: ${structuredJob.title}`,
      jobId,
    });
  } catch (error) {
    console.error("❌ Failed to process job:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
