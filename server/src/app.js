import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { hackathonsRouter } from './routes/hackathons.js';
import { registrationsRouter } from './routes/registrations.js';
import { teamsRouter } from './routes/teams.js';
import { adminRouter } from './routes/admin.js';
import { profileRouter } from './routes/profile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'server' });
});

app.use('/auth', authRouter);
app.use('/hackathons', hackathonsRouter);
app.use('/registrations', registrationsRouter);
app.use('/teams', teamsRouter);
app.use('/admin', adminRouter);
app.use('/profile', profileRouter);

// Serve static files from the React app in production
if (env.nodeEnv === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  
  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);

  if (String(err.message || '').includes('User is already in a team for this hackathon')) {
    return res.status(400).json({ error: 'User already has a team in this hackathon' });
  }

  if (String(err.message || '').includes('Team is full')) {
    return res.status(400).json({ error: 'Team is full' });
  }

  return res.status(500).json({ error: 'Internal server error' });
});

export default app;
