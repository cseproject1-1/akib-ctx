const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script to read .env.local from the root directory and set
 * Cloudflare Worker secrets via wrangler.
 */

const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('.env.local not found at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split(/\r?\n/);

const secretMapping = {
  'VITE_R2_ACCESS_KEY_ID': 'R2_ACCESS_KEY_ID',
  'VITE_R2_SECRET_ACCESS_KEY': 'R2_SECRET_ACCESS_KEY',
  'VITE_R2_ENDPOINT': 'R2_ENDPOINT',
  'VITE_R2_BUCKET_NAME': 'R2_BUCKET_NAME',
  'GEMINI_API_KEY': 'GEMINI_API_KEY'
};

// Also look for non-VITE prefixed ones
const directMapping = [
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ENDPOINT',
  'R2_BUCKET_NAME',
  'GEMINI_API_KEY'
];

const secretsToSet = {};

envLines.forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;
  
  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    
    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    
    if (secretMapping[key]) {
      secretsToSet[secretMapping[key]] = val;
    } else if (directMapping.includes(key)) {
      secretsToSet[key] = val;
    }
  }
});

console.log('Secrets found:', Object.keys(secretsToSet).join(', '));

for (const [key, val] of Object.entries(secretsToSet)) {
  console.log(`Setting secret: ${key}...`);
  try {
    // Pipe the value to avoid shell escaping issues and console logs
    execSync(`echo ${val} | npx wrangler secret put ${key}`, { 
      cwd: __dirname,
      stdio: ['pipe', 'inherit', 'inherit']
    });
    console.log(`Successfully set ${key}`);
  } catch (err) {
    console.error(`Failed to set secret ${key}:`, err.message);
  }
}

console.log('Done.');
