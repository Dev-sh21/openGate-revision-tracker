# Tasks: Spaced Repetition Revision Tracker

- [x] **Phase 1: Project Setup & System Prep**
  - [x] Initialize Next.js project using Tailwind CSS and TypeScript
  - [x] Install essential npm dependencies (Prisma, NextAuth, googleapis, `@notionhq/client`, lucide-react, framer-motion, canvas-confetti, recharts, bcryptjs)
  - [x] Set up local PostgreSQL server via Homebrew and create database (Running in Docker container `pg-revision-tracker`)
  - [x] Configure environment variables in `.env`
  - [x] Initialize Prisma schema, run migration, and generate Prisma client

- [x] **Phase 2: Database Schema & Authentication**
  - [x] Implement full Prisma schema (User, Account, Subject, Topic, RevisionSchedule, CompletionHistory)
  - [x] Set up NextAuth configuration for credentials & Google login
  - [x] Implement secure authentication API routes (`/api/auth/[...nextauth]` and `/api/auth/register`)

- [x] **Phase 3: Integration Services & Sync Engine**
  - [x] Build Google Calendar API client (Event generation & reminders configuration)
  - [x] Build Google Sheets API client (Spreadsheet creation & row appending/updating)
  - [x] Build Notion API client (Database creation, page appends, status updates)
  - [x] Implement the main bidirectional Sync Engine `/src/lib/syncEngine.ts`

- [x] **Phase 4: API Routes**
  - [x] Implement Subjects CRUD endpoints (`/api/subjects`)
  - [x] Implement Topics creation with spaced repetition date generation (`/api/topics`)
  - [x] Implement Revisions state update API (`/api/revisions/[id]/complete` and `/api/revisions/[id]/skip`)
  - [x] Implement Sync trigger endpoint (`/api/sync`)
  - [x] Implement Cron Reminders endpoint (`/api/cron/daily-reminders`)

- [x] **Phase 5: Responsive Modern Dark UI**
  - [x] Configure global styles (`globals.css`) and Tailwind theme config (sleek dark mode)
  - [x] Build reusable UI components (Card, Sidebar, Navbar, Button, Dialog, Loader, Confetti celebration)
  - [x] Build Login & Signup pages
  - [x] Build Dashboard (Stats, Today's Revisions, Quick-Add)
  - [x] Build Auto Planner page (Today, Tomorrow, This Week columns)
  - [x] Build Calendar page (Visual calendar colored by revision state)
  - [x] Build Analytics page (Recharts study metrics)
  - [x] Build Settings page (Google OAuth integration, Notion token, preference toggles)

- [x] **Phase 6: Verification & Handover**
  - [x] Test the entire user flow: register, add topic, complete revision, see statistics update
  - [x] Test integration APIs under mock/simulated conditions
  - [x] Run full project compilation check (TypeScript compiles with 0 errors, npm run build completes successfully)
  - [x] Create walkthrough documentation
