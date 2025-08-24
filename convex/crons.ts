import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process unprocessed LinkedIn profiles every 10 minutes
crons.interval(
  "Process Unprocessed LinkedIn Profiles",
  { minutes: 10 }, // Run every 10 minutes
  internal.functions.processUnprocessedLinkedInProfiles,
  { batchSize: 5 } // Process 5 profiles at a time
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
