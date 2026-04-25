# Backend - BookMyEvent (Phase 2 Core Architecture)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp ../.env.example .env
```

Required OTP/Brevo variables:

- `MONGO_URI`
- `BREVO_API_KEY`
- `SENDER_EMAIL`
- `SENDER_NAME`
- `OTP_EXPIRY_MINUTES`

3. Start dev server:

```bash
npm run dev
```

## Scripts

- `npm run dev` - Run backend in watch mode
- `npm run build` - Compile TypeScript into dist
- `npm run start` - Run compiled server
- `npm run lint` - Run ESLint
- `npm run format` - Prettier format check
- `npm run format:fix` - Apply Prettier format

## Core Modules

- Auth: signup/login/refresh/logout/forgot-password placeholder
- Users: role-based account model with indexes
- Vendors: profile and discoverability model
- Categories: nested subcategory taxonomy
- Packages: separate vendor package and platform package models
- Leads: lifecycle-based lead management
- Availability: unique vendor-date-slot conflict prevention
- Bookings: payment and booking status tracking

## Security Architecture

- Helmet and CORS configuration
- API rate limiting
- Request sanitization and JSON content-type enforcement
- JWT access token middleware
- Role guard middleware
- Request validation middleware (Zod)
- Centralized secure error responses

## API Prefix

All routes are mounted under:

- `/api/v1`

Primary routes:

- `/api/v1/auth`
- `/api/v1/vendors`
- `/api/v1/categories`
- `/api/v1/packages`
- `/api/v1/leads`
- `/api/v1/availability`
- `/api/v1/bookings`

Email OTP endpoints:

- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`

## Structure

```text
src/
  config/
  controllers/
  docs/
  jobs/
  logs/
  middlewares/
  models/
  repositories/
  routes/
  services/
  types/
  utils/
  validators/
  app.ts
  server.ts
```

## Module Notes

Each core module has a separate note file in `src/docs/*/README.md` describing:
- what was built
- why it was built
- scalability purpose
