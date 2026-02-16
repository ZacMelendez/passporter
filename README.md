# Pass-Port – Local Privacy Contact Finder

Pass-Port is a small, fully local web app that helps you discover contact email addresses from the privacy policies of sites you have saved in your browser password manager. You can then export a CSV of those emails to start data deletion or privacy requests.

The app is designed to keep your data private:

- It runs entirely on your machine.
- It uses a local SQLite database for storage.
- It never stores passwords – only URLs, usernames and emails.
- It talks only to the sites you ask it to (to download their home and privacy pages).

## Quick Start

Get the app running in a few minutes:

1. **Prerequisites**: Node.js v20+ and npm (or pnpm).

2. **Clone and install**:
   ```bash
   cd pass-port
   npm install
   ```

3. **Environment**: Copy the example env and (optionally) edit it:
   ```bash
   cp .env.example .env
   ```
   Defaults use SQLite (`file:./dev.db`) and need no extra setup.

4. **Database**: Create and migrate the SQLite database:
   ```bash
   npm run db:migrate
   ```

5. **Run the app** (API on port 4000, frontend on 5173):
   ```bash
   npm run dev:all
   ```

6. **Open**: Go to [http://localhost:5173](http://localhost:5173).

From there you can **import a password CSV** (exported from Chrome/Brave/Safari), **scrape privacy policies** for contact emails, and **export a CSV** of discovered emails. See [Importing password CSVs](#importing-password-csvs), [Scraping privacy policies](#scraping-privacy-policies-and-emails), and [Exporting emails](#exporting-emails) for details.

## Features

- Import passwords CSV exported from Chrome, Brave, Safari and similar browsers.
- Filter out entries without URLs.
- Store sites in a local SQLite database for reuse across runs.
- For each site:
  - Normalize to the site's origin (e.g. `https://example.com`).
  - Fetch the home page, look for a privacy-policy link, or try common privacy URLs.
  - Scrape the privacy page for `mailto:` links and plain-text email addresses.
- Attach discovered emails to each entry.
- Export a CSV of:
  - Emails found directly in the password CSV (usernames, explicit email columns).
  - Emails found on privacy policy pages.

## Tech stack

- **Frontend**: React + TypeScript, Vite, MUI (Material UI) with a dark theme.
- **State / data fetching**: `@tanstack/react-query`, `axios`, `papaparse`.
- **Backend**: Node.js, Express, Prisma ORM, scraping with `cheerio`.
- **Database**: SQLite (default; file-based, no Docker required).

## Running the app locally

See [Quick Start](#quick-start) for the shortest path. Below is the same flow with more detail and options.

### Prerequisites

- Node.js (v20+)
- npm or pnpm

### Setup steps

1. **Environment variables**:
   ```bash
   cp .env.example .env
   ```
   The default `.env` uses SQLite (`DATABASE_URL="file:./dev.db"`). The DB file is created under `prisma/` when you run migrations. You can change `PORT` (default 4000) and `CLIENT_ORIGIN` (default `http://localhost:5173`) if needed.

2. **Install dependencies and database**:
   ```bash
   npm install
   npm run db:migrate
   ```
   This installs dependencies, generates the Prisma client, and runs migrations (creating the SQLite DB if it doesn’t exist).

3. **Run the application**:
   ```bash
   # Option 1: Run both frontend and backend together
   npm run dev:all

   # Option 2: Run them separately in different terminals
   # Terminal 1 – Backend API (port 4000)
   npm run dev:server

   # Terminal 2 – Frontend (port 5173)
   npm run dev
   ```

4. **Open your browser**: Go to [http://localhost:5173](http://localhost:5173).

### Database management

- **Prisma Studio** (browse/edit data):
  ```bash
  npm run db:studio
  ```
  Opens a web UI at [http://localhost:5555](http://localhost:5555).

- **Reset the database** (⚠️ deletes all data):
  ```bash
  npm run db:reset
  ```

### Production builds

```bash
# Build everything (backend + frontend)
npm run build:all

# Or build separately
npm run build:server  # Generates Prisma client + compiles TypeScript to db/dist/
npm run build         # Frontend (compiles to dist/)
```

To run the production backend:
```bash
npm run start:server
```

**Note**: Ensure your production environment has:
- A `.env` file with the correct `DATABASE_URL` (e.g. SQLite path or another provider)
- Prisma client generated (`npm run db:generate`), which runs automatically on `npm install`

## Project Structure

```
pass-port/
├── db/                  # Backend API server
│   ├── db.ts            # Prisma client setup
│   ├── server.ts        # Express API endpoints
│   └── scraper.ts       # Privacy policy scraping logic
├── prisma/              # Prisma schema and migrations
│   └── schema.prisma    # Database schema definition
├── src/                 # Frontend React app
│   ├── App.tsx          # Main application component
│   └── main.tsx         # React entry point
├── .env.example         # Environment variables template
└── dist/                # Frontend build output
```

## Importing password CSVs

1. Export your passwords from your browser:
   - Chrome / Brave: Settings → Passwords → Export.
   - Safari: File → Export → Passwords.
2. Save the CSV file locally.
3. In the app, click **"Choose CSV"** and select the exported file.

Pass-Port will:

- Parse the CSV in your browser using `papaparse`.
- Extract:
  - URL / website / origin columns (various common header names are handled).
  - Site name / title (for display).
  - Username (never the password).
  - Any obvious email columns or email-shaped usernames.
- Send only normalized entries (name, URL, username, email) to the backend for storage.

Passwords are neither stored nor transmitted.

## Scraping privacy policies and emails

- **Scrape one site**: Click the circular refresh icon on a row.
- **Scrape all pending sites**: Click **"Scrape all pending"** in the toolbar above the table.

For each entry the backend will:

1. Normalize the URL to its origin (e.g. `https://example.com`).
2. Try to download the home page.
3. Look for a link whose text or `href` contains "privacy".
4. If none is found, try common endpoints like:
   - `/privacy`
   - `/privacy-policy`
   - `/legal/privacy`
5. Download the privacy page (when found) and search for:
   - `mailto:` links.
   - Plain-text email addresses via a simple regex.

Discovered emails are stored as an array on the entry and shown in the UI.

## Exporting emails

Use the **"Export all emails"** button to download a CSV file with:

- URL
- Site name
- Email address
- Source (`from_passwords` or `from_privacy_policy`)

You can also call the backend directly:

- `GET /api/export?scope=all`
- `GET /api/export?scope=source` (only emails inferred from the CSV)
- `GET /api/export?scope=scraped` (only emails discovered on privacy pages)

## Privacy and security notes

- **Local-only**: There is no third-party backend. The Node server and PostgreSQL database run on your machine (via Docker).
- **No passwords stored**: The frontend deliberately ignores the `password` column and never sends it to the backend.
- **Minimal data model**:
  - URL (normalized to origin)
  - Optional site name
  - Optional username
  - Optional email inferred from the CSV
  - Optional list of emails found on privacy pages
  - Optional privacy-policy URL and scrape status
- **Database**: SQLite runs as a local file. Data stays on your machine and is not shared with any external services.
- **Network access**: The backend makes outbound HTTPS requests only to the sites you imported, solely to fetch HTML pages for scraping.
- **Open source**: The code is kept small and readable so you can audit what it does.

If you have stricter requirements, consider:
- Running the app on an isolated machine or network segment
- Using a read-only or dedicated filesystem for the SQLite database file
- Auditing the scraper and server code for your threat model
