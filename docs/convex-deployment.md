# Convex Deployment Guide

This guide covers how to deploy your Convex backend functions to both development and production environments.

## Overview

Convex provides two main deployment environments:

- **Development (Dev)**: For testing and development work
- **Production (Prod)**: For live applications

## Prerequisites

Before deploying, ensure you have:

- Convex CLI installed: `npm install -g convex`
- Convex account set up
- Project initialised with `npx convex dev`

## Development Deployment

### Quick Development Deploy

```bash
npx convex dev --once
```

This command:

- ✅ Provisions a dev deployment if none exists
- ✅ Saves the deployment name to `.env.local`
- ✅ Pushes your functions to the dev environment
- ✅ Runs schema validation
- ✅ Updates function code
- ✅ Exits after deployment (doesn't watch for changes)

### Continuous Development Mode

```bash
npx convex dev
```

This command:

- ✅ Starts continuous development mode
- ✅ Watches for file changes
- ✅ Automatically redeploys on changes
- ✅ Keeps running until manually stopped

### When to Use Dev Deployment

- 🔧 Testing new features
- 🐛 Debugging issues
- 🧪 Experimenting with schema changes
- 👥 Development team collaboration

## Production Deployment

### Deploy to Production

```bash
npx convex deploy --yes
```

This command:

- ✅ Deploys to your production environment
- ✅ Runs schema validation
- ✅ Updates function code
- ✅ Applies any schema migrations
- ✅ The `--yes` flag skips confirmation prompts

### Deploy Without Auto-Confirmation

```bash
npx convex deploy
```

This will prompt you to confirm the deployment before proceeding.

### When to Use Production Deployment

- 🚀 Releasing new features to users
- 🔄 Applying critical bug fixes
- 📊 Schema updates for live data
- 🎯 Final deployment after dev testing

## Deployment Workflow

### Recommended Process

1. **Develop and Test Locally**

   ```bash
   npm run dev          # Start Next.js dev server
   npx convex dev       # Start Convex in watch mode
   ```

2. **Deploy to Development**

   ```bash
   npx convex dev --once
   ```

3. **Test in Development Environment**
   - Test API endpoints
   - Verify database operations
   - Check cron jobs
   - Validate schema changes

4. **Deploy to Production**

   ```bash
   npx convex deploy --yes
   ```

5. **Verify Production Deployment**
   - Check Convex dashboard
   - Test critical endpoints
   - Monitor logs for errors

## Environment Configuration

### Development Environment

- **Deployment Name**: Saved in `.env.local` as `CONVEX_DEPLOYMENT`
- **Dashboard**: Available at the dev deployment URL
- **Database**: Separate dev database instance

### Production Environment

- **Deployment Name**: Your main production deployment
- **Dashboard**: Available at your production deployment URL
- **Database**: Live production database

## Common Commands Summary

| Command                   | Purpose                                  | Environment |
| ------------------------- | ---------------------------------------- | ----------- |
| `npx convex dev`          | Continuous development mode              | Dev         |
| `npx convex dev --once`   | Single dev deployment                    | Dev         |
| `npx convex deploy`       | Deploy to production (with confirmation) | Prod        |
| `npx convex deploy --yes` | Deploy to production (auto-confirm)      | Prod        |

## Schema Migrations

### Development Schema Changes

```bash
# Make schema changes in convex/schema.ts
npx convex dev --once
```

### Production Schema Changes

```bash
# After testing in dev, deploy to production
npx convex deploy --yes
```

**⚠️ Important**: Always test schema changes in development first!

## Troubleshooting

### Common Issues

#### 1. Deployment Fails Due to Schema Conflicts

```bash
# Solution: Check schema validation errors
npx convex dev --once
# Fix schema issues, then redeploy
```

#### 2. Functions Not Updating

```bash
# Solution: Force a fresh deployment
npx convex deploy --yes
```

#### 3. Environment Variables Not Set

```bash
# Check .env.local for CONVEX_DEPLOYMENT
cat .env.local
```

#### 4. Permission Errors

```bash
# Re-authenticate with Convex
npx convex login
```

### Checking Deployment Status

#### View Current Deployments

```bash
npx convex deployments
```

#### View Function Logs

```bash
npx convex logs
```

#### Dashboard Access

- **Dev**: Check the URL shown after `npx convex dev --once`
- **Prod**: Check your production deployment dashboard

## Best Practices

### 🎯 Development

- Use `npx convex dev` for active development
- Use `npx convex dev --once` for quick testing
- Always test schema changes in dev first

### 🚀 Production

- Only deploy tested and validated code
- Use `--yes` flag for automated deployments
- Monitor deployment logs for errors
- Have a rollback plan for critical changes

### 🔄 CI/CD Integration

```bash
# In your CI/CD pipeline
npx convex deploy --yes
```

### 📊 Monitoring

- Check Convex dashboard regularly
- Monitor function execution logs
- Set up alerts for critical errors

## Cron Jobs and Scheduled Functions

Cron jobs defined in `convex/crons.ts` are automatically deployed with your functions:

```typescript
// Example cron job deployment
crons.interval(
  "Process Unprocessed LinkedIn Profiles",
  { minutes: 10 },
  internal.functions.processUnprocessedLinkedInProfiles
);
```

Both dev and production will have their own separate cron job schedules.

## Security Considerations

- **Environment Separation**: Dev and prod have separate databases
- **API Keys**: Use different API keys for dev and prod environments
- **Access Control**: Limit production deployment access
- **Monitoring**: Set up alerts for production deployments

## Support and Resources

- **Convex Documentation**: https://docs.convex.dev
- **Dashboard**: https://dashboard.convex.dev
- **Community**: https://convex.dev/community
- **Support**: support@convex.dev

---

_Last updated: January 2025_

