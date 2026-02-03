import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in server/.env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const migrationsDir = path.resolve(process.cwd(), 'db/migrations');

function splitSqlStatements(input) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let dollarTag = '$$';

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const nextTwo = input.slice(i, i + 2);

    if (!inSingle && !inDouble) {
      const dollarStart = input.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (dollarStart) {
        const tag = dollarStart[0];
        current += tag;
        i += tag.length - 1;
        if (!inDollar) {
          inDollar = true;
          dollarTag = tag;
        } else if (tag === dollarTag) {
          inDollar = false;
          dollarTag = '$$';
        }
        continue;
      }
    }

    if (!inDouble && !inDollar && ch === "'" && input[i - 1] !== '\\') {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (!inSingle && !inDollar && ch === '"' && input[i - 1] !== '\\') {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inDollar && nextTwo === '--') {
      while (i < input.length && input[i] !== '\n') {
        i += 1;
      }
      current += '\n';
      continue;
    }

    if (!inSingle && !inDouble && !inDollar && ch === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function runMigrations() {
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const raw = await fs.readFile(fullPath, 'utf8');
    const statements = splitSqlStatements(raw);

    for (const stmt of statements) {
      await sql(stmt);
    }

    console.log(`Applied migration: ${file}`);
  }

  console.log('All migrations complete.');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
