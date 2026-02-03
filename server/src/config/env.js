import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'FRONTEND_URL', 'BACKEND_URL', 'SESSION_SECRET', 'NEON_AUTH_URL'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL,
  backendUrl: process.env.BACKEND_URL,
  neonAuthUrl: process.env.NEON_AUTH_URL,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  sessionSecret: process.env.SESSION_SECRET,
  // Only mark cookies as secure when running on HTTPS URLs.
  isProd: process.env.NODE_ENV === 'production' && String(process.env.BACKEND_URL || '').startsWith('https://'),
};
