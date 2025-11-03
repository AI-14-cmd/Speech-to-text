# Quick Start: Deploy in 10 Minutes

## Backend (Deta Space)

```bash
# 1. Install CLI
npm install -g @deta/space

# 2. Login
space login

# 3. Deploy
cd "C:\Users\aniru\Desktop\Speech to text\backend"
space new
space push

# 4. Get URL
space open
# Save the URL (e.g., https://abc-1-x123.deta.app)
```

## Frontend (Vercel)

```bash
# 1. Install CLI
npm install -g vercel

# 2. Deploy
cd "C:\Users\aniru\Desktop\Speech to text\frontend"
vercel login
vercel

# 3. Update API URL
# Edit frontend/index.html line 234:
const API_URL = 'YOUR_DETA_URL_HERE';

# 4. Redeploy
vercel --prod
```

## Done! 🎉

Open your Vercel URL and test the app.

**Full guide:** See `README_DEPLOY.md` for detailed instructions and troubleshooting.
