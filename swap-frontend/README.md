# SWAP Frontend

**Digital Monitoring and Application System for the Student Welfare Assistantship Program**  
Mindanao State University — Marawi

## Stack

- **Next.js 15** (App Router, TypeScript strict mode)
- **React 19**
- **Tailwind CSS v4**
- **TanStack Query 5.x** (server state management)
- **Zustand 4.x** (client state — auth store with sessionStorage + cookies)
- **React Hook Form 7.x** + **Zod 3.x** (forms + validation)
- **Axios 1.x** (API client with interceptors)
- **Laravel Echo 2.x** + **Pusher JS** (WebSocket / Reverb client)
- **Recharts 2.x** (analytics charts)
- **html5-qrcode 2.x** (QR scanner)
- **qrcode.react 3.x** (QR display)
- **date-fns 3.x** (date formatting in Philippine Time)
- **Vitest 2.x** + **Testing Library** (unit tests)

## Architecture

```
app/
├── (auth)/          # Login, Register, Forgot Password, Verify Email
├── (dashboard)/     # Role-based dashboards (applicant, recipient, supervisor, admin)
│   ├── applicant/
│   ├── recipient/
│   ├── supervisor/
│   └── admin/
├── notifications/   # Notification inbox
├── profile/         # Profile + password management
└── chatbot/         # AI FAQ chatbot

components/
├── application/     # ApplicationForm, ApplicationCard, DocumentUpload, ApplicationTimeline
├── attendance/      # HoursProgress, TimeLogCard, QrScanner, QrDisplay
├── charts/          # Recharts wrappers
├── chatbot/         # ChatWindow, ChatMessage, ChatInput
├── layout/          # Sidebar, Topbar, DashboardLayout
├── notifications/   # NotificationBell, NotificationDropdown, NotificationList
└── shared/          # StatusBadge, DataTable

lib/
├── api/             # Typed API client functions (never use axios directly in components)
├── hooks/           # useReverb, useNotifications
├── providers/       # QueryProvider, EchoProvider
├── store/           # authStore (Zustand + sessionStorage + cookies)
└── utils/           # formatDate (Asia/Manila), formatHours, roleGuard
```

## Setup

### 1. Requirements
- Node.js 20+
- SWAP Backend running (see `swap-backend/README.md`)

### 2. Install dependencies
```bash
npm install
```

### 3. Environment
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=SWAP Portal
NEXT_PUBLIC_REVERB_APP_KEY=your-reverb-app-key
NEXT_PUBLIC_REVERB_HOST=localhost
NEXT_PUBLIC_REVERB_PORT=8080
NEXT_PUBLIC_REVERB_SCHEME=http
```

### 4. Run
```bash
npm run dev
```

The app is available at `http://localhost:3000`.

## Role Routing

| Role | Dashboard Route |
|---|---|
| `applicant` | `/applicant/dashboard` |
| `recipient` | `/recipient/dashboard` |
| `supervisor` | `/supervisor/dashboard` |
| `admin` | `/admin/dashboard` |

Next.js middleware (`middleware.ts`) reads `swap_role` cookie to enforce role-gated routes at the SSR level, redirecting unauthorized users to `/login`.

## Authentication

- Tokens stored in `sessionStorage` via Zustand's persist middleware.
- `swap_token` and `swap_role` cookies are written on login so Next.js middleware can read them server-side.
- Axios interceptor reads the token from the store for every request. On 401, it calls `logout()` and redirects to `/login`.

## Real-time (Reverb / Echo)

`useReverb` hook (`lib/hooks/useReverb.ts`) connects Laravel Echo to the Reverb server and subscribes to the `private-user.{userId}` channel. On events, it invalidates the relevant TanStack Query cache keys and shows a toast notification.

## Testing
```bash
# Run all tests
npm test

# With UI
npm run test:ui

# With coverage
npm run test:coverage
```

Key test files:
- `__tests__/components/StatusBadge.test.tsx`
- `__tests__/components/HoursProgress.test.tsx`
- `__tests__/components/LoginForm.test.tsx`
- `__tests__/hooks/useAuth.test.ts`

## Design System

MSU Marawi maroon brand palette used throughout:

| Token | Hex | Usage |
|---|---|---|
| Primary | `#7D1A1A` | Buttons, headings, links, active nav |
| Secondary | `#A52020` | Hover states |
| Sidebar gradient | `#8B1A1A` → `#6B1212` | Sidebar / auth panel background |
| Gold accent | `#F5C842` | Active sidebar item indicator |
| Light maroon | `#FEF0F0` | Icon backgrounds, subtle highlights |
| Page background | `#FAF7F7` | App / page background |
| Border | `#EAD9D9` | Card and table borders |
| Input border | `#DCC5C5` | Form field borders |
| Secondary text | `#8A6A6A` | Muted / helper text |
| Tertiary text | `#B09A9A` | Placeholders, disabled |
| Success | `#27AE60` | Approved, verified |
| Warning | `#F39C12` | Pending, open |
| Danger | `#E74C3C` | Rejected, errors |
