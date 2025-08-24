import { NextRequest, NextResponse } from "next/server";
import {
  getJobResults,
  updateJobResultWithAI,
  getJobResult,
} from "@/lib/jobs/job-storage";
import { type StructuredJob } from "@/lib/jobs";

// Import AI processing function
async function parseJobWithAI(rawData: any): Promise<StructuredJob> {
  // We need to do this inline since we can't import the function directly
  const { generateObject } = await import("ai");
  const { getChatModel } = await import("@/lib/external/openrouter");
  const { z } = await import("zod");

  // Define the structured job schema
  const StructuredJobSchema = z.object({
    title: z.string().describe("Job title"),
    company: z.string().describe("Company name"),
    location: z.string().describe("Job location"),
    description: z.string().describe("Job description"),
    jobType: z.string().nullable().describe("Job type (Full-time, Part-time, etc.)"),
    salaryRange: z.string().nullable().describe("Salary range if mentioned"),
    experienceLevel: z.enum(["Entry", "Mid", "Senior", "Lead", "Executive"]).nullable().describe("Required experience level"),
    
    requirements: z.object({
      essential: z.array(z.string()).describe("Essential requirements"),
      preferred: z.array(z.string()).describe("Preferred requirements"),
      skills: z.array(z.string()).describe("Required skills"),
      experience: z.string().nullable().describe("Experience requirements"),
      education: z.string().nullable().describe("Education requirements"),
    }),
    
    benefits: z.array(z.string()).describe("Job benefits and perks"),
    
    jobAnalysis: z.object({
      summary: z.string().describe("Job summary"),
      keyResponsibilities: z.array(z.string()).describe("Key responsibilities"),
      idealCandidate: z.string().describe("Ideal candidate profile"),
      careerProgression: z.string().nullable().describe("Career progression opportunities"),
      companySize: z.string().nullable().describe("Company size estimate"),
      industry: z.string().nullable().describe("Industry sector"),
      workArrangement: z.string().describe("Work arrangement (Remote, Hybrid, On-site)"),
    }),
    
    applicationDetails: z.object({
      applyOptions: z.array(z.object({
        platform: z.string(),
        url: z.string(),
      })).describe("Application options"),
      postedDate: z.string().nullable().describe("Job posting date"),
      applicationDeadline: z.string().nullable().describe("Application deadline"),
    }),
  });

  const model = getChatModel("gpt-4.1-mini");

  const result = await generateObject({
    model,
    schema: StructuredJobSchema,
    prompt: `You are an expert job posting analyst. Parse the following job posting data and extract comprehensive structured information.

INSTRUCTIONS:
- Be thorough and accurate in your analysis
- Generate insightful AI analysis in the jobAnalysis section
- Extract all requirements, skills, and qualifications mentioned
- Identify benefits and perks offered
- Determine experience level based on job requirements
- Estimate company size and work arrangement from context
- Use null for unavailable optional fields, empty arrays for missing lists
- Focus on actionable information for job seekers
- Identify key responsibilities and ideal candidate profile

JOB POSTING DATA TO ANALYSE:
Title: ${rawData.title}
Company: ${rawData.company_name}
Location: ${rawData.location}
Description: ${rawData.description}
Via: ${rawData.via || "Unknown"}
Extensions: ${rawData.extensions?.join(", ") || "None"}
Job Highlights: ${JSON.stringify(rawData.job_highlights || [])}
Apply Options: ${JSON.stringify(rawData.apply_options || [])}

METADATA:
- Source URL: ${rawData.share_link || "Unknown"}
- Provider: ${rawData.provider}
- Job ID: ${rawData.job_id || rawData.id}

Please provide a comprehensive analysis with particular attention to:
1. Job requirements and qualifications breakdown
2. Key responsibilities and role expectations
3. Company benefits and work environment
4. Career progression opportunities
5. Ideal candidate profile and experience level
6. Work arrangement and company culture indicators`,
  });

  // Return a full structured job with proper types
  const job: StructuredJob = {
    ...result.object,
    sourceUrl: rawData.share_link || "",
    provider: rawData.provider,
    lastUpdated: new Date().toISOString(),
  };

  return job;
}

/**
 * POST /api/jobs/process-unprocessed
 * Process unprocessed jobs with AI
 * This endpoint can be called by a cron job or manually
 *
 * Body:
 * - limit?: number - Maximum number of jobs to process (default: 2)
 * - jobIds?: string[] - Specific job IDs to process
 *
 * Returns:
 * - { success: true, processed: number, failed: number, jobs: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const limit = body.limit || 2;
    const specificJobIds = body.jobIds;

    console.log(`🤖 Processing jobs...`);

    let jobsToProcess: any[] = [];

    if (specificJobIds && specificJobIds.length > 0) {
      // Process specific jobs
      console.log(`Processing ${specificJobIds.length} specific jobs`);

      for (const jobId of specificJobIds) {
        const job = await getJobResult(jobId);
        if (job && job.isProcessed !== "true" && job.rawData) {
          jobsToProcess.push(job);
        }
      }
    } else {
      // Get unprocessed jobs
      console.log(`Processing up to ${limit} unprocessed jobs`);

      const unprocessedJobs = await getJobResults({
        limit,
      });

      // Filter to only unprocessed jobs with raw data
      jobsToProcess = unprocessedJobs.filter(
        (j) => j.isProcessed !== "true" && j.rawData
      );
    }

    console.log(`Found ${jobsToProcess.length} jobs to process`);

    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const job of jobsToProcess) {
      try {
        console.log(`🔄 Processing job: ${job.title}`);

        // Parse the job with AI
        const structuredJob = await parseJobWithAI(job.rawData);

        // Update the job in the database
        await updateJobResultWithAI(job._id, structuredJob);

        console.log(`✅ Successfully processed: ${structuredJob.title}`);

        processed++;
        results.push({
          jobId: job._id,
          title: structuredJob.title,
          status: "success",
        });
      } catch (error) {
        console.error(`❌ Failed to process job ${job._id}:`, error);
        failed++;
        results.push({
          jobId: job._id,
          title: job.title,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: jobsToProcess.length,
      jobs: results,
      message: `Processed ${processed} jobs, ${failed} failed`,
    });
  } catch (error) {
    console.error("Process unprocessed jobs error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/process-unprocessed
 * Get count of unprocessed jobs
 */
export async function GET() {
  try {
    // Get all jobs
    const allJobs = await getJobResults({ limit: 1000 });

    // Count unprocessed
    const unprocessedCount = allJobs.filter(
      (j) => j.isProcessed !== "true" && j.rawData
    ).length;

    return NextResponse.json({
      success: true,
      unprocessedCount,
      message: `${unprocessedCount} jobs waiting to be processed`,
    });
  } catch (error) {
    console.error("Get unprocessed count error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
