import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db, type Entry } from './db';
import { findPrivacyPolicyAndEmails } from './scraper';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

app.use(
  cors({
    origin: CLIENT_ORIGIN,
  }),
);

type ImportEntry = {
  name?: string | null;
  url?: string | null;
  username?: string | null;
  sourceEmail?: string | null;
};

type ApiEntry = {
  id: number;
  siteName: string | null;
  url: string;
  username: string | null;
  sourceEmail: string | null;
  scrapedEmails: string[];
  privacyUrl: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: Entry): ApiEntry {
  return {
    id: row.id,
    siteName: row.siteName,
    url: row.url,
    username: row.username,
    sourceEmail: row.sourceEmail,
    scrapedEmails: row.scrapedEmails ? (JSON.parse(row.scrapedEmails) as string[]) : [],
    privacyUrl: row.privacyUrl,
    status: row.status,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

app.post('/api/import', async (req: Request, res: Response) => {
  const body = req.body as { entries?: ImportEntry[] };

  const entries = body.entries ?? [];
  let imported = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const item of entries) {
    const url = (item.url ?? '').trim();
    if (!url) {
      invalid += 1;
      continue;
    }

    try {
      // normalize to origin for de-duplication & scraping
      const u = new URL(url);
      const normalizedUrl = u.origin;

      const siteName = item.name?.trim() || null;
      const username = item.username?.trim() || null;
      const sourceEmail = item.sourceEmail?.trim() || null;

      // Check if entry already exists
      const existing = await db.entry.findFirst({
        where: {
          url: normalizedUrl,
          username: username || null,
        },
      });

      if (existing) {
        duplicates += 1;
        continue;
      }

      try {
        await db.entry.create({
          data: {
            siteName,
            url: normalizedUrl,
            username,
            sourceEmail,
          },
        });
        imported += 1;
      } catch (err: unknown) {
        // Unique constraint violation means entry already exists
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          err.code === 'P2002'
        ) {
          duplicates += 1;
        } else {
          throw err;
        }
      }
    } catch {
      invalid += 1;
    }
  }

  res.json({
    imported,
    duplicates,
    invalid,
    total: entries.length,
  });
});

app.get('/api/entries', async (_req: Request, res: Response) => {
  const rows = await db.entry.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map((row) => mapRow(row)));
});

async function scrapeEntry(id: number): Promise<ApiEntry> {
  const existing = await db.entry.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Entry not found');
  }

  await db.entry.update({
    where: { id },
    data: { status: 'in_progress', errorMessage: null },
  });

  try {
    const { privacyUrl, emails } = await findPrivacyPolicyAndEmails(existing.url);

    if (!privacyUrl && emails.length === 0) {
      await db.entry.update({
        where: { id },
        data: { status: 'no_results' },
      });
    } else {
      await db.entry.update({
        where: { id },
        data: {
          privacyUrl: privacyUrl ?? null,
          scrapedEmails: JSON.stringify(emails),
          status: 'done',
          errorMessage: null,
        },
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 500) : 'Unknown error';
    await db.entry.update({
      where: { id },
      data: { status: 'error', errorMessage: message },
    });
  }

  const updated = await db.entry.findUnique({ where: { id } });
  if (!updated) {
    throw new Error('Entry disappeared');
  }
  return mapRow(updated);
}

app.post('/api/entries/:id/scrape', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  try {
    const updated = await scrapeEntry(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

async function processScrapeQueue(
  entryIds: number[],
  concurrency: number = 25,
): Promise<void> {
  if (entryIds.length === 0) return;

  const queue = [...entryIds];
  let activeCount = 0;

  return new Promise<void>((resolve) => {
    function processNext(): void {
      while (activeCount < concurrency && queue.length > 0) {
        const id = queue.shift()!;
        activeCount++;

        scrapeEntry(id)
          .finally(() => {
            activeCount--;
            if (queue.length > 0) {
              processNext();
            } else if (activeCount === 0) {
              resolve();
            }
          })
          .catch(() => {
            // Errors are already handled in scrapeEntry
          });
      }

      if (activeCount === 0 && queue.length === 0) {
        resolve();
      }
    }

    processNext();
  });
}

app.post(
  '/api/entries/scrape-batch',
  async (_req: Request, res: Response) => {
    const rows = await db.entry.findMany({
      where: {
        status: {
          in: ['pending', 'error'],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const entryIds = rows.map((r) => r.id);

    // Start processing in background
    processScrapeQueue(entryIds, 25).catch((err) => {
      console.error('Batch scrape error:', err);
    });

    res.json({
      started: entryIds.length,
      totalCandidates: rows.length,
    });
  },
);

app.get('/api/entries/scrape-progress', async (_req: Request, res: Response) => {
  const allEntries = await db.entry.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const stats = {
    total: allEntries.length,
    pending: allEntries.filter((e) => e.status === 'pending').length,
    inProgress: allEntries.filter((e) => e.status === 'in_progress').length,
    done: allEntries.filter((e) => e.status === 'done').length,
    error: allEntries.filter((e) => e.status === 'error').length,
    noResults: allEntries.filter((e) => e.status === 'no_results').length,
  };

  res.json(stats);
});

app.delete('/api/entries/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  try {
    await db.entry.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'P2025'
    ) {
      res.status(404).json({ error: 'Entry not found' });
    } else {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Delete failed',
      });
    }
  }
});

app.post('/api/entries/delete-batch', async (req: Request, res: Response) => {
  const body = req.body as { ids?: unknown };
  const raw = Array.isArray(body.ids) ? body.ids : [];
  const ids = raw
    .map((id) => (typeof id === 'number' ? id : Number(id)))
    .filter(Number.isFinite);

  if (ids.length === 0) {
    res.json({ deleted: 0 });
    return;
  }

  try {
    const result = await db.entry.deleteMany({
      where: { id: { in: ids } },
    });
    res.json({ deleted: result.count });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Delete failed',
    });
  }
});

app.patch('/api/entries/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const body = req.body as {
    privacyUrl?: string | null;
    scrapedEmails?: string[];
    siteName?: string | null;
  };

  try {
    const updateData: {
      privacyUrl?: string | null;
      scrapedEmails?: string;
      siteName?: string | null;
    } = {};

    if (body.privacyUrl !== undefined) {
      updateData.privacyUrl = body.privacyUrl;
    }
    if (body.scrapedEmails !== undefined) {
      updateData.scrapedEmails = JSON.stringify(body.scrapedEmails);
    }
    if (body.siteName !== undefined) {
      updateData.siteName = body.siteName;
    }

    const updated = await db.entry.update({
      where: { id },
      data: updateData,
    });

    res.json(mapRow(updated));
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'P2025'
    ) {
      res.status(404).json({ error: 'Entry not found' });
    } else {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Update failed',
      });
    }
  }
});

app.get('/api/export', async (req: Request, res: Response) => {
  const scopeRaw = (req.query['scope'] as string | undefined) ?? 'all';
  const scope = scopeRaw === 'source' || scopeRaw === 'scraped' ? scopeRaw : 'all';

  const rows = await db.entry.findMany();

  type EmailRow = {
    url: string;
    siteName: string;
    email: string;
    source: 'from_passwords' | 'from_privacy_policy';
  };

  const out: EmailRow[] = [];

  for (const row of rows) {
    const siteName = row.siteName ?? '';
    const url = row.url;

    if (scope === 'all' || scope === 'source') {
      const email = row.sourceEmail;
      if (email) {
        out.push({
          url,
          siteName,
          email,
          source: 'from_passwords',
        });
      }
    }

    if (scope === 'all' || scope === 'scraped') {
      if (row.scrapedEmails) {
        try {
          const emails = JSON.parse(row.scrapedEmails) as string[];
          for (const email of emails) {
            out.push({
              url,
              siteName,
              email,
              source: 'from_privacy_policy',
            });
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  const header = 'url,site_name,email,source\n';
  const lines = out.map((r) =>
    [
      JSON.stringify(r.url),
      JSON.stringify(r.siteName),
      JSON.stringify(r.email),
      JSON.stringify(r.source),
    ].join(','),
  );
  const csv = header + lines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="privacy-emails.csv"');
  res.send(csv);
});

const PORT = Number(process.env.PORT ?? '4000');

// Graceful shutdown
process.on('beforeExit', async () => {
  await db.$disconnect();
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

