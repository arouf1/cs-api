import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process unprocessed LinkedIn profiles every 15 seconds for rapid processing
crons.interval(
  "Process Unprocessed LinkedIn Profiles",
  { seconds: 15 }, // Run every 15 seconds
  internal.functions.processUnprocessedLinkedInProfiles,
  { batchSize: 2 } // Process 2 profiles at a time to avoid timeouts
);

// Update stale LinkedIn profiles every 24 hours
crons.interval(
  "Update Stale LinkedIn Profiles",
  { hours: 24 }, // Run every 24 hours to check for stale profiles (>3 months old)
  internal.functions.updateStaleLinkedInProfiles,
  { batchSize: 3 } // Process 3 profiles at a time to avoid rate limits
);

// Alternative: Run every 5 minutes during business hours (more aggressive)
// crons.cron(
//   "Process LinkedIn Profiles - Business Hours",
//   "*/5 9-17 * * 1-5", // Every 5 minutes, 9 AM to 5 PM, Monday to Friday
//   internal.functions.processUnprocessedLinkedInProfiles,
//   { batchSize: 10 }
// );

// Alternative: Run every hour (less aggressive)
// crons.interval(
//   "Process LinkedIn Profiles - Hourly",
//   { hours: 1 }, // Run every hour
//   internal.functions.processUnprocessedLinkedInProfiles,
//   { batchSize: 20 }
// );

export default crons;
