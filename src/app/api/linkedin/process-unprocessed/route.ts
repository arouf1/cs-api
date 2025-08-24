import { NextRequest, NextResponse } from "next/server";
import { getLinkedInProfiles, updateLinkedInProfileWithAI, getLinkedInProfile } from "@/lib/linkedin/linkedin-storage";
// Import AI processing function
async function parseLinkedInProfile(rawData: any) {
  // We need to do this inline since we can't import the function directly
  const { generateObject } = await import("ai");
  const { getChatModel } = await import("@/lib/external/openrouter");
  const { z } = await import("zod");
  
  // Use a simplified schema for now
  const schema = z.object({
    name: z.string(),
    position: z.string(),
    company: z.string(),
    location: z.string(),
    bio: z.string().nullable(),
    skills: z.array(z.string()),
  });
  
  const model = getChatModel("gpt-4.1-mini");
  
  const result = await generateObject({
    model,
    schema,
    prompt: `Extract the following from this LinkedIn profile: name, position, company, location, bio, and skills.
    
Profile text: ${rawData.text}`,
  });
  
  // Return a full structured profile
  return {
    name: result.object.name,
    position: result.object.position,
    company: result.object.company,
    location: result.object.location,
    connections: "500+",
    bio: result.object.bio,
    profileSummary: {
      overview: `${result.object.position} at ${result.object.company}`,
      keyStrengths: [],
      careerHighlights: [],
      industryExpertise: [],
      yearsOfExperience: null,
      seniorityLevel: "Mid",
      specialisations: [],
    },
    currentJob: {
      title: result.object.position,
      company: result.object.company,
      startDate: null,
      location: result.object.location,
      description: null,
    },
    experience: [],
    education: [],
    skills: result.object.skills,
    certifications: [],
    languages: [],
    recommendations: [],
    volunteering: [],
    websites: [],
    publications: [],
    profileUrl: rawData.url,
    lastUpdated: rawData.publishedDate || new Date().toISOString(),
  };
}

/**
 * POST /api/linkedin/process-unprocessed
 * Process unprocessed LinkedIn profiles with AI
 * This endpoint can be called by a cron job or manually
 * 
 * Body:
 * - limit?: number - Maximum number of profiles to process (default: 2)
 * 
 * Returns:
 * - { success: true, processed: number, failed: number, profiles: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const limit = body.limit || 2;

    console.log(`🤖 Processing up to ${limit} unprocessed LinkedIn profiles...`);

    // Get unprocessed profiles
    const unprocessedProfiles = await getLinkedInProfiles({
      limit,
    });

    // Filter to only unprocessed profiles with raw data
    const profilesToProcess = unprocessedProfiles.filter(
      (p) => !p.isProcessed && p.rawData
    );

    console.log(`Found ${profilesToProcess.length} profiles to process`);

    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const profile of profilesToProcess) {
      try {
        console.log(`🔄 Processing profile: ${profile.author}`);

        // Parse the profile with AI
        const structuredProfile = await parseLinkedInProfile(profile.rawData);

        // Update the profile in the database
        await updateLinkedInProfileWithAI(profile._id, structuredProfile);

        console.log(`✅ Successfully processed: ${structuredProfile.name}`);
        
        processed++;
        results.push({
          profileId: profile._id,
          name: structuredProfile.name,
          status: "success",
        });
      } catch (error) {
        console.error(`❌ Failed to process profile ${profile._id}:`, error);
        failed++;
        results.push({
          profileId: profile._id,
          name: profile.author,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: profilesToProcess.length,
      profiles: results,
      message: `Processed ${processed} profiles, ${failed} failed`,
    });
  } catch (error) {
    console.error("Process unprocessed profiles error:", error);

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
 * GET /api/linkedin/process-unprocessed
 * Get count of unprocessed profiles
 */
export async function GET() {
  try {
    // Get all profiles
    const allProfiles = await getLinkedInProfiles({ limit: 1000 });
    
    // Count unprocessed
    const unprocessedCount = allProfiles.filter(
      (p) => !p.isProcessed && p.rawData
    ).length;

    return NextResponse.json({
      success: true,
      unprocessedCount,
      message: `${unprocessedCount} profiles waiting to be processed`,
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
