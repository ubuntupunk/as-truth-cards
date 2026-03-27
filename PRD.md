# Product Requirements Document (PRD)

## Truth Cards - AntiSemitism Education Platform

---

## 1. Project Overview

### Purpose
An interactive web application that educates users about antisemitism through a card-based interface. Each card presents a common misconception (front) and factual information debunking it (back).

### Target Users
- General public seeking to understand antisemitism
- Educators and students
- Researchers and academics
- Content moderators and journalists

---

## 2. User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **ANONYMOUS** | View cards, flip cards, see featured card |
| **VERIFIED** | All above + rate cards (thumbs up/down) |
| **ACADEMIC** | All above + structured feedback |
| **RESEARCHER** | All above + academic feedback with citations |
| **MODERATOR** | All above + moderate user content |
| **ADMIN** | Full access + manage cards, users, view analytics |

---

## 3. Core Features

### 3.1 Card Deck (Public)
- Display featured "hero" card at top
- Show card stack visualization (5 cards)
- "Draw a Card" button triggers card selection
- Card flip animation reveals back (truth)
- "Draw Another Card" resets to deck view

### 3.2 Card Filtering
- Toggle: "Include Israel/Palestine content"
- Filters cards with `includedInPalestineStack: true`

### 3.3 Card Rating System
- Thumbs up/down buttons on card back
- One vote per card per user (localStorage for anon)
- Records `RATING_UP` or `RATING_DOWN` interaction

### 3.4 Admin Panel
- List all cards with search/filter
- Add/Edit/Delete cards
- Fields: title, front description (myth), back description (truth), symbol, image, tags, sources, featured flag, Palestine stack flag
- Export functionality (copy JSON)

### 3.5 Authentication
- Stack Auth integration
- Protected admin route (`/admin`)
- Role-based access control via `UserProfile` table

---

## 4. Technical Architecture

### Stack
- **Frontend**: Vite + React 18 + TypeScript
- **UI**: shadcn/ui components + Tailwind CSS
- **Routing**: React Router DOM
- **State**: React Query for server state
- **Auth**: Stack (handled separately)
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma

### Database Schema
```
Card → UserInteraction (one-to-many)
UserProfile (standalone, links to Stack Auth)
```

### Missing Components (Tech Debt)
- API routes for CRUD operations
- Database migrations not run
- Admin panel not connected to DB
- Voting UI not implemented

---

## 5. Out of Scope

- Comments on cards
- User profiles/avatars
- Card sharing to social media
- Email notifications
- Analytics dashboard (v1)

---

## 6. Success Metrics (v1)

- [ ] Users can view and flip cards
- [ ] Admin can create/edit/delete cards in DB
- [ ] Authenticated users can rate cards
- [ ] Israel/Palestine filter works
- [ ] Responsive on mobile devices
- [ ] Lighthouse accessibility score > 80