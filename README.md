# 📚 Revision Tracker

**Spaced-repetition study scheduler** built with Next.js, TypeScript, Tailwind CSS, PostgreSQL (Prisma), and NextAuth. Automatically schedules revisions on **Day 1, 2, 4, and 8** after studying a topic — and syncs them to **Google Calendar**, **Google Sheets**, and **Notion** in real-time.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🧠 **Spaced Repetition** | Auto-schedules 4 revision sessions per topic (Day 1 → 2 → 4 → 8 → Mastered) |
| 🏠 **Smart Dashboard** | Shows today's due tasks, streak, stats, overdue alerts |
| 📋 **Auto Planner** | Kanban board — Today / Tomorrow / This Week |
| 📅 **Calendar View** | Monthly grid with color-coded revision states |
| 📊 **Analytics** | Charts for streaks, completion rate, subject breakdown |
| 🔔 **Notifications** | Browser push + daily email reminders at 8:00 AM |
| 📆 **Google Calendar** | Creates revision events with configurable reminders |
| 📊 **Google Sheets** | Syncs all topics and stages; detects manual edits |
| 🗂 **Notion** | Mirrors topics to a Notion database; bidirectional sync |
| 🔄 **Sync Engine** | Two-way sync across all three platforms |
| 🔐 **Auth** | Email/password + Google OAuth via NextAuth |
| 🎨 **Dark UI** | Notion + Todoist inspired premium dark theme |

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20 (or use `nvm use v20`)
- Docker (for PostgreSQL) **or** a PostgreSQL connection string
- npm

### 1. Clone & Install

```bash
git clone <repo-url>
cd openGate
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/revision_tracker?schema=public"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3001"

# Optional - for Google Calendar & Sheets sync
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Optional - for Notion sync (or use Internal Token in Settings)
NOTION_CLIENT_ID=""
NOTION_CLIENT_SECRET=""

CRON_SECRET="your-cron-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

### 3. Start PostgreSQL

**Using Docker (recommended):**
```bash
docker run --name pg-revision-tracker \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=revision_tracker \
  -p 5432:5432 -d postgres:15
```

### 4. Run Migrations

```bash
npx prisma migrate dev --name init
```

### 5. Start the App

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001)

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected route group
│   │   ├── layout.tsx        # Sidebar + Topbar + Quick Add modal
│   │   ├── dashboard/        # Today's revisions, stats, widgets
│   │   ├── planner/          # Today / Tomorrow / This Week kanban
│   │   ├── calendar/         # Monthly color-coded calendar
│   │   ├── analytics/        # Charts & subject breakdown
│   │   └── settings/         # Integrations + notification prefs
│   ├── api/
│   │   ├── auth/             # NextAuth + register + Notion OAuth
│   │   ├── topics/           # CRUD + spaced-repetition scheduling
│   │   ├── revisions/        # List (with filters) + complete/skip
│   │   ├── subjects/         # Subject management
│   │   ├── analytics/        # Server-side computed stats
│   │   ├── sync/             # Manual full sync trigger
│   │   ├── cron/             # Daily reminder cron endpoint
│   │   └── user/settings/    # Preferences + Notion token
│   ├── login/                # Auth pages
│   ├── signup/
│   └── page.tsx              # Landing page
├── lib/
│   ├── db.ts                 # Prisma client singleton
│   ├── googleClient.ts       # Google OAuth2 client with token refresh
│   ├── notionClient.ts       # Notion API client factory
│   ├── syncEngine.ts         # Bidirectional sync across all platforms
│   └── notifications.ts     # Browser push notification utilities
└── components/
    └── Providers.tsx         # SessionProvider + Toaster
```

---

## 🔗 Integration Setup

### Google Calendar & Sheets

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable **Google Calendar API**, **Google Sheets API**
3. Create **OAuth 2.0 Client ID** (Web Application)
4. Add Authorized redirect URI: `http://localhost:3001/api/auth/callback/google`
5. Copy Client ID & Secret to `.env`
6. In the app: Settings → Connect Google Account

### Notion (OAuth)

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create integration (Public type)
3. Add redirect URI: `http://localhost:3001/api/auth/notion/callback`
4. Copy Client ID & Secret to `.env`
5. In the app: Settings → Connect via Notion OAuth

### Notion (Developer Token — Simpler)

1. Create an **Internal Integration** at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Share a Notion page with the integration
3. In the app: Settings → Notion Developer Token → paste `secret_...` token
4. A "Revision Tracker" database will be auto-created on first sync

---

## 🔄 Sync Engine

The sync engine (`/src/lib/syncEngine.ts`) handles bidirectional sync:

**Outbound (App → Platforms):**
- Google Calendar: Creates/updates 4 revision events per topic
- Google Sheets: Appends/updates rows with topic details
- Notion: Creates/updates pages in the Revision Tracker database

**Inbound (Platforms → App):**
- Notion: Polls for status/stage changes, imports manually created pages
- Google Sheets: Detects row edits, imports manually added rows

**Trigger sync:** Click the ↻ button in the topbar, or `POST /api/sync`

---

## 🔔 Daily Reminders

The cron endpoint `/api/cron/daily-reminders` checks users at their local 8:00 AM and sends revision summaries.

**Trigger manually (for testing):**
```
GET http://localhost:3001/api/cron/daily-reminders?force=true
```

**Set up automated cron (e.g., Vercel Cron or crontab):**
```bash
# Run hourly to check all users
0 * * * * curl "http://localhost:3001/api/cron/daily-reminders?secret=YOUR_CRON_SECRET"
```

---

## 🎯 Spaced Repetition Logic

```
Day 0 → Study topic (added)
Day 1 → Revision 1
Day 2 → Revision 2
Day 4 → Revision 3
Day 8 → Revision 4 → 🏆 MASTERED
```

Mark each revision as **Completed** (advances stage) or **Skipped** (logs and advances).

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth.js (Credentials + Google) |
| Charts | Recharts |
| Animations | Framer Motion + CSS |
| Notifications | Canvas Confetti + Web Notifications API |
| Google APIs | `googleapis` (Calendar v3 + Sheets v4) |
| Notion API | `@notionhq/client` |
| Icons | Lucide React |
