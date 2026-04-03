# Cloudflare Worker Deployment Guide

## Problem Fixed: CORS Policy Error

The error you encountered was caused by the Cloudflare Worker only allowing requests from `https://ctxnote.app`, but your frontend is running on `https://www.akib-ctx.pro.bd`.

## Changes Made

### 1. Updated CORS Configuration (`worker/src/index.ts`)

The CORS middleware now explicitly allows the following origins:
- `https://ctxnote.app` (original domain)
- `https://www.akib-ctx.pro.bd` (your new domain)
- `https://akib-ctx.pro.bd` (without www)
- `localhost` and `127.0.0.1` (development)
- `*.lovable.app` (preview deployments)

### 2. Updated Wrangler Configuration (`worker/wrangler.toml`)

Added comprehensive documentation for required secrets and configuration.

---

## Required Environment Variables (Secrets)

You **MUST** set these secrets using the Wrangler CLI. These are NOT stored in `wrangler.toml`:

```bash
# Navigate to worker directory
cd /workspace/worker

# Set each secret (you'll be prompted to enter the value)
wrangler secret put GEMINI_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_ENDPOINT
wrangler secret put R2_BUCKET_NAME
```

### Secret Descriptions

| Secret | Description | Example Value |
|--------|-------------|---------------|
| `GEMINI_API_KEY` | Google Gemini API key for AI features | `AIzaSy...` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key ID | `a1b2c3d4e5f6g7h8i9j0` |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret access key | `k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6` |
| `R2_ENDPOINT` | Cloudflare R2 endpoint URL | `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com` |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name | `ctxnote` |

### Where to Get These Values

#### 1. Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create or select a project
3. Click "Create API Key"
4. Copy the key and run: `wrangler secret put GEMINI_API_KEY`

#### 2. Cloudflare R2 Credentials
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** in the left sidebar
3. Click **Manage R2 API Tokens**
4. Click **Create API Token** (or use an existing one)
5. Copy the **Access Key ID** and **Secret Access Key**
6. Run:
   ```bash
   wrangler secret put R2_ACCESS_KEY_ID
   wrangler secret put R2_SECRET_ACCESS_KEY
   ```

#### 3. R2 Endpoint
Your R2 endpoint follows this format:
```
https://YOUR_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com
```

To find your Account ID:
1. Go to Cloudflare Dashboard
2. Look at the right sidebar under "Account ID"
3. Or go to **Workers & Pages** → Your worker → **Settings**

Then run:
```bash
wrangler secret put R2_ENDPOINT
```

#### 4. R2 Bucket Name
1. Go to Cloudflare Dashboard → R2
2. Find your bucket name (e.g., `ctxnote`)
3. Run: `wrangler secret put R2_BUCKET_NAME`

---

## Deployment Steps

### Step 1: Install Dependencies
```bash
cd /workspace/worker
npm install
```

### Step 2: Verify Secrets
Check that all secrets are set:
```bash
wrangler secret list
```

You should see:
- GEMINI_API_KEY
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_ENDPOINT
- R2_BUCKET_NAME

### Step 3: Deploy the Worker
```bash
wrangler deploy
```

### Step 4: Verify Deployment
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click on `ctxnote-worker`
4. Check the **Logs** tab for any errors
5. Test the endpoints using the **Preview** URL

---

## Testing CORS Fix

After deployment, test that CORS is working:

### Option 1: Browser Console Test
Open your browser console on `https://www.akib-ctx.pro.bd` and run:
```javascript
fetch('https://ctxnote-worker.mm-adnanakib.workers.dev/api/presign', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://www.akib-ctx.pro.bd'
  }
}).then(r => r.headers.get('Access-Control-Allow-Origin'));
```

Expected output: `"https://www.akib-ctx.pro.bd"`

### Option 2: curl Test
```bash
curl -X OPTIONS https://ctxnote-worker.mm-adnanakib.workers.dev/api/presign \
  -H "Origin: https://www.akib-ctx.pro.bd" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep "Access-Control-Allow-Origin"
```

Expected output: `Access-Control-Allow-Origin: https://www.akib-ctx.pro.bd`

---

## Adding New Domains in the Future

To add more allowed origins, edit `/workspace/worker/src/index.ts`:

```typescript
const ALLOWED_ORIGINS = [
    'https://ctxnote.app',
    'https://www.akib-ctx.pro.bd',
    'https://akib-ctx.pro.bd',
    'https://your-new-domain.com',  // Add new domains here
];
```

Then redeploy:
```bash
wrangler deploy
```

---

## Troubleshooting

### Issue: Still Getting CORS Errors After Deployment

1. **Clear Browser Cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check Worker Logs**: Go to Cloudflare Dashboard → Workers → Logs
3. **Verify Origin Header**: Make sure your frontend sends the correct `Origin` header
4. **Check for Redirects**: Ensure no redirects are changing the origin

### Issue: Secret Not Found Error

```bash
# List all secrets
wrangler secret list

# If a secret is missing, add it
wrangler secret put SECRET_NAME
```

### Issue: Worker Not Updating

```bash
# Force a new deployment
wrangler deploy --force
```

---

## Security Notes

1. **Never commit secrets** to version control
2. **Always use HTTPS** for production domains
3. **Regularly rotate** API keys and access tokens
4. **Monitor worker logs** for unauthorized access attempts
5. **Keep ALLOWED_ORIGINS list** up to date with only trusted domains

---

## File Structure

```
/workspace/worker/
├── src/
│   └── index.ts          # Main worker code (CORS configured here)
├── wrangler.toml         # Worker configuration
├── package.json          # Dependencies
└── DEPLOYMENT_GUIDE.md   # This file
```

---

## Support

If you continue experiencing issues:
1. Check [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
2. Review [Hono CORS Documentation](https://hono.dev/docs/middleware/cors)
3. Examine worker logs in Cloudflare Dashboard
4. Test with curl to isolate frontend vs backend issues
