# FX Prime Academy — API Reference

Base URL: `http://localhost:4000/api/v1` (dev)

All JSON responses use:

```json
{ "success": true, "data": { ... } }
```

Errors:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | JWT + refresh cookie |
| POST | `/auth/refresh` | Cookie | Refresh access token |
| POST | `/auth/logout` | — | Clear session |
| GET | `/auth/me` | Bearer | Current user |

## Courses

| Method | Path | Description |
|--------|------|-------------|
| GET | `/courses` | List published courses |
| GET | `/courses/:slug` | Course detail |
| POST | `/courses/:courseId/enroll` | Enroll (auth) |

## Payments

| Method | Path | Description |
|--------|------|-------------|
| POST | `/payments/create-session` | Start checkout |
| POST | `/payments/webhook/stripe` | Stripe webhook (raw body) |

## Marketplace

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products/marketplace` | Public catalog |
| GET | `/products/digital/by-slug/:slug` | Digital product |
| GET | `/products/physical/by-slug/:slug` | Physical product |

## Live & Mentorship

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions/hub` | Live desk (upcoming, live, recordings; includes private course sessions when enrolled) |
| POST | `/sessions/:id/register` | Register for live session (course enrollment required for `COURSE_CLASS`) |
| GET | `/sessions/:id/join` | Time-gated join URL (marks attendance on join) |
| GET | `/mentors/:id/slots` | Available mentor slots |
| POST | `/mentors/slots/:id/book` | Book mentor session |

## Search & Saves

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=` | Global search |
| GET | `/bookmarks` | User bookmarks |
| GET | `/bookmarks/wishlist` | Wishlist |

## Admin

Prefix: `/admin` — requires `ADMIN` or `SUPER_ADMIN` role.

Key areas: courses, blog, products, mentors, sessions, users, certificates, community moderation.

See [ADMIN.md](./ADMIN.md) for CMS workflows.
