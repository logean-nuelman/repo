# Payout Calculator

A web application to project and track your estimated payouts over 12 months, accounting for income and expenses.

## Features

- **12-Month Projection** - Visual breakdown of payouts per month
- **Income & Expense Tracking** - Track multiple income sources and expenses per payout
- **Auto-Apply Items** - Set default items with effective dates that auto-apply to future payouts
- **Per-Payout Editing** - Override amounts, add custom items, or remove items per payout
- **Calendar Sidebar** - Visual calendar showing payout dates
- **Dark Mode** - Theme toggle with localStorage persistence
- **Authentication** - Supabase Auth for user accounts
- **Real-time Updates** - Live data sync via Supabase Realtime

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Routing:** React Router v7
- **Notifications:** react-hot-toast
- **Icons:** Lucide React
- **Date Handling:** date-fns

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to the SQL Editor and run the schema in [`supabase/schema.sql`](supabase/schema.sql)
3. Go to Project Settings > API and copy your Project URL and anon/public key

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Dev Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

### First Time Setup

1. **Sign up** for an account
2. **Create a Projection:**
   - Set the first payout date
   - Set the days between payouts (e.g., 14 for bi-weekly)
   - Add default income items (e.g., Salary: $1500)
   - Add default expense items (e.g., Rent: $500)
3. **View Dashboard** - See your 12-month projection

### Managing Items

- Go to **Settings** to add/edit/delete default income and expense items
- Items have an **effective date** - they auto-apply to payouts on or after that date
- Click **Edit** on any payout to:
  - Toggle items on/off for that specific payout
  - Override amounts
  - Add custom items unique to that payout

## Project Structure

```
src/
├── components/
│   ├── Navbar.tsx
│   ├── ProtectedRoute.tsx
│   └── PayoutEditModal.tsx
├── context/
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── lib/
│   └── supabase.ts
├── pages/
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── Setup.tsx
│   ├── Dashboard.tsx
│   └── Settings.tsx
├── types/
│   └── index.ts
├── App.tsx
└── main.tsx
```

## License

MIT
