# Deployment Guide: Speech to Text App

This guide walks you through deploying your Speech-to-Text application with:
- **Backend** on Deta Space (free, Python FastAPI + Whisper)
- **Frontend** on Vercel (free, static HTML)

---

## Prerequisites

1. **Deta Space account** - Sign up at [deta.space](https://deta.space)
2. **Vercel account** - Sign up at [vercel.com](https://vercel.com)
3. **Git** installed locally
4. **Space CLI** - Install Deta Space CLI

---

## Part 1: Deploy Backend to Deta Space

### Step 1: Install Deta Space CLI

```bash
# Install Space CLI (Windows)
iwr https://deta.space/assets/space-cli.ps1 -useb | iex

# Or use npm
npm install -g @deta/space

# Verify installation
space version
```

### Step 2: Login to Deta Space

```bash
space login
```

This will open your browser for authentication.

### Step 3: Navigate to Backend Directory

```bash
cd "C:\Users\aniru\Desktop\Speech to text\backend"
```

### Step 4: Create a New Space Project

```bash
space new
```

Follow the prompts:
- Project name: `speech-to-text-api` (or your preferred name)
- It will detect your Spacefile automatically

### Step 5: Push and Deploy

```bash
space push
```

This will:
- Package your code
- Upload to Deta Space
- Build the container
- Deploy the API

**Note:** First deployment takes 5-10 minutes (downloads Whisper model).

### Step 6: Get Your Backend URL

After deployment completes, run:

```bash
space open
```

Your backend URL will look like:
```
https://your-app-name-1-x1234567.deta.app
```

**Save this URL** - you'll need it for the frontend!

### Step 7: Test Your Backend

```bash
# Test health endpoint
curl https://your-app-name-1-x1234567.deta.app/health

# Expected response:
# {"status":"healthy","model_loaded":true}
```

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

Or deploy via GitHub (recommended, see Step 2b).

### Step 2a: Deploy via Vercel CLI

```bash
# Navigate to frontend directory
cd "C:\Users\aniru\Desktop\Speech to text\frontend"

# Login to Vercel
vercel login

# Deploy
vercel
```

Follow the prompts:
- Set up and deploy: **Y**
- Which scope: Select your account
- Link to existing project: **N**
- Project name: `speech-to-text-frontend`
- Directory: `.` (current)
- Override settings: **N**

### Step 2b: Deploy via GitHub (Recommended)

1. **Push to GitHub:**

```bash
# Initialize git in frontend folder
cd "C:\Users\aniru\Desktop\Speech to text\frontend"
git init
git add .
git commit -m "Initial commit"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/speech-to-text-frontend.git
git branch -M main
git push -u origin main
```

2. **Import to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"
   - Select your `speech-to-text-frontend` repo
   - Framework Preset: **Other**
   - Root Directory: `./` (leave as is)
   - Click **Deploy**

### Step 3: Configure Environment Variable

After deployment, add your backend URL:

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://your-app-name-1-x1234567.deta.app` (your Deta Space URL)
   - **Environments:** Select all (Production, Preview, Development)
4. Click **Save**

### Step 4: Redeploy Frontend

Go to **Deployments** tab and click **Redeploy** on the latest deployment.

### Step 5: Update Frontend Code for Production

Edit `frontend/index.html` line 234 to prioritize environment variable:

```javascript
// Change this line:
const API_URL = window.VITE_API_URL || 'http://localhost:8080';

// To this (using Vercel env injection):
const API_URL = 'YOUR_DETA_URL_HERE';  // Paste your Deta URL directly
```

**Or** use Vercel's automatic environment injection by creating `frontend/.env`:

```
VITE_API_URL=https://your-app-name-1-x1234567.deta.app
```

Then update the HTML to read it properly.

---

## Part 3: Testing Your Deployed App

1. **Open your Vercel URL** (e.g., `https://speech-to-text-frontend.vercel.app`)
2. Click **Start Recording**
3. Allow microphone access
4. Speak for a few seconds
5. Click **Stop Recording**
6. Wait for transcription (5-15 seconds)
7. View your transcribed text!

---

## Troubleshooting

### Backend Issues

**Problem:** Model not loaded
```bash
# Check logs
space logs

# Look for "Whisper model loaded successfully"
```

**Solution:** Wait 5-10 minutes after first deployment for model download.

**Problem:** 503 errors
- Deta Space may cold-start (first request takes 10-30 seconds)
- Subsequent requests are fast

### Frontend Issues

**Problem:** "Cannot connect to API"
- Check API_URL in `index.html` is correct
- Verify Deta backend is running: visit `https://your-deta-url.deta.app/health`

**Problem:** CORS errors
- Backend already has CORS enabled (`allow_origins=["*"]`)
- If needed, update `main.py` line 19 to specific Vercel domain:
  ```python
  allow_origins=["https://your-app.vercel.app"]
  ```

**Problem:** Microphone not working
- HTTPS is required for microphone access (Vercel provides this automatically)
- Check browser permissions

---

## Cost & Limits (Free Tier)

### Deta Space
- ✅ **Free** hosting
- ✅ 512 MB RAM per instance
- ✅ Suitable for small-medium Whisper model
- ⚠️ Cold starts (30s first request)
- ⚠️ Timeout: 30s per request

### Vercel
- ✅ **Free** for static sites
- ✅ Unlimited bandwidth
- ✅ Automatic SSL
- ✅ Global CDN

---

## Production Optimization

### Backend Optimizations

1. **Use smaller Whisper model** (faster, less RAM):
   ```python
   # In backend/main.py line 34
   model = whisper.load_model("tiny")  # or "base"
   ```

2. **Add caching** to avoid cold starts

3. **Upgrade to paid Deta plan** for reserved instances (no cold starts)

### Frontend Optimizations

1. **Add loading spinner** during transcription
2. **Implement retry logic** for failed requests
3. **Add audio format conversion** for better compatibility

---

## Updating Your App

### Update Backend

```bash
cd backend
# Make your changes to main.py
space push
```

### Update Frontend

**Via GitHub:**
```bash
cd frontend
git add .
git commit -m "Update message"
git push
```
Vercel auto-deploys on push.

**Via CLI:**
```bash
cd frontend
vercel --prod
```

---

## Alternative Free Deployment Options

If you encounter issues with Deta Space:

### Backend Alternatives
1. **Hugging Face Spaces** (with Gradio UI)
   - More RAM (16GB on free tier)
   - Better for larger models
   - Auto-handles UI

2. **Railway** (500 hours free/month)
   - More reliable than Deta
   - Better cold start performance

3. **Render** (750 hours free/month)
   - Good performance
   - Easy setup

### Frontend Alternatives
1. **Netlify** (same as Vercel, free)
2. **GitHub Pages** (completely free, static only)
3. **Cloudflare Pages** (unlimited bandwidth)

---

## Security Notes

🔒 **Production Checklist:**
- [ ] Update CORS to specific domain (backend `main.py` line 19)
- [ ] Add API key authentication if needed
- [ ] Monitor usage to avoid abuse
- [ ] Add rate limiting (use Deta's built-in features)

---

## Support

If you encounter issues:
1. Check Deta Space logs: `space logs`
2. Check Vercel deployment logs in dashboard
3. Test backend directly: `curl https://your-backend/health`
4. Verify CORS and HTTPS

---

## Summary

✅ **Backend:** Deta Space  
✅ **Frontend:** Vercel  
✅ **Cost:** $0/month  
✅ **Testing:** 1 month free trial period  

**Your URLs:**
- Backend API: `https://your-app.deta.app`
- Frontend: `https://your-app.vercel.app`

Enjoy your free deployed Speech-to-Text app! 🎉
