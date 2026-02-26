# ProcureAI — Frontend

Enterprise procurement management platform built with Next.js 14.

## Features

- **Procurement Management** — Create and manage purchase requisitions (CAPEX/OPEX) with line items and SAP sync
- **Vendor Management** — Vendor database with performance/risk scoring, bulk CSV/PDF import/export
- **Approval Workflow** — Multi-step approvals with SLA tracking (72-hour windows)
- **Budget Management** — Track budget allocations and utilization across plants
- **User Management** — Role-based access control
- **Reports** — Business intelligence and reporting
- **Azure SSO** — Microsoft MSAL browser integration (optional)

## Tech Stack

| Category | Libraries |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript 5 |
| State | Zustand (auth), TanStack React Query (server state) |
| HTTP | Axios with JWT interceptors and auto-refresh |
| Auth | Azure MSAL browser/react |
| UI | Radix UI, Shadcn components, Tailwind CSS |
| Forms | React Hook Form + Zod validation |
| Tables | TanStack React Table |
| Charts | Recharts |

## Getting Started

### Prerequisites

- Node.js 20+
- A running backend API (see `NEXT_PUBLIC_API_URL`)

### Install and run

```bash
npm install --legacy-peer-deps
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

### Environment variables

Create a `.env.local` file:

```env
# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Azure SSO (optional)
NEXT_PUBLIC_AZURE_CLIENT_ID=
NEXT_PUBLIC_AZURE_TENANT_ID=
```

Requests to `/api/backend/*` are proxied to `NEXT_PUBLIC_API_URL` via `next.config.mjs`.

## Docker

```bash
# Build
docker build -t procureai-frontend .

# Run
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://your-backend:8000/api/v1 \
  procureai-frontend
```

The Dockerfile uses a multi-stage build (deps → builder → runner) on `node:20-alpine` with Next.js standalone output.

## Project Structure

```
app/
  (auth)/          # Login, setup-password
  (dashboard)/     # Protected routes
    approvals/
    budget/
    dashboard/
    procurement/
    reports/
    settings/
    users/
    vendors/
components/
  ui/              # Shadcn/Radix base components
  shared/          # Sidebar, TopBar, StatusBadge, LineItemsEditor
  approvals/
  procurement/
  vendors/
  users/
lib/
  api/             # Axios client, auth API calls
  stores/          # Zustand auth store
  utils.ts         # Formatting, SLA helpers
```

## PR Status Flow

```
Draft → Pending Approval → Approved → Synced to SAP → PO Created
```

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```
