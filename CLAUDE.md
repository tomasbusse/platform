# Claude Instructions for Simmonds Platform

## Deployment Workflow

**IMPORTANT**: After making any code changes, always deploy to production:

1. Commit changes to the current branch
2. Push to GitHub
3. Merge to `main` and push to deploy to **app.simmonds.online**:

```bash
cd /Users/tomas/apps/simmonds/platform && git pull origin main && git merge origin/affectionate-gould --no-edit && git push origin main
```

Note: This is a git worktree. The main repository is at `/Users/tomas/apps/simmonds/platform`. You cannot checkout `main` directly in this worktree - you must cd to the main repo to merge.

## Production URL

- **Production**: https://app.simmonds.online (deployed from `main` branch)
- **Preview**: Vercel preview URLs are created for feature branches

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Convex (serverless database)
- Auth: Clerk
- Styling: Tailwind CSS
