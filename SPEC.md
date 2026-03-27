# Technical Specification

## Truth Cards - AntiSemitism Education Platform

---

## 1. UI/UX Specification

### 1.1 Layout Structure

**Header**
- Fixed position, `z-50`, glass effect background
- Logo/Title: "Truth Cards" (left-aligned)
- Nav: Home | About | Admin (protected)
- Theme toggle (right-aligned)

**Main Content**
- Max width: `max-w-4xl`, centered
- Padding: `pt-24 pb-16 px-4`
- Fade-in animations on load

**Footer**
- Minimal, copyright text
- Links: Privacy | Terms

### 1.2 Card Component

**Dimensions**
- Aspect ratio: `2/3`
- Max width: `max-w-xs` (hero: `max-w-md`)
- Border radius: `rounded-xl`

**Front Side (Myth)**
- Symbol: 4xl emoji centered
- Title: font-medium, centered
- Description: muted text, centered, flex-grow
- Hint text: "Tap to reveal truth" (small)

**Back Side (Truth)**
- Symbol: rotated 180° (appears upright to viewer)
- Title: centered
- Description: scrollable if overflow
- Sources: bulleted list, clickable URLs
- Rating buttons: thumbs up/down (bottom)
- Hint: "Tap to flip back"

**Animation**
- CSS 3D transform flip
- Duration: 700ms
- Timing: ease-out

### 1.3 Card Deck Component

**Featured Card**
- Displayed at top when no card selected
- Full card component with `isHero={true}`

**Stack Visualization**
- 5 card silhouettes stacked
- Offset: `translateY(index * 2px)`
- Rotation: alternating ±2° per card

**Draw Button**
- `rounded-full px-8 py-3`
- Primary color background
- Hover: scale 1.05, shadow-lg

### 1.4 Admin Panel

**Layout**
- Full-width container
- Search bar + "Add New Card" button
- Card list with edit/delete actions
- Card editor form (slide-in or inline)

**Card Editor Fields**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| ID | number | auto | read-only |
| Title | text | yes | max 100 chars |
| Front Description | textarea | yes | max 500 chars |
| Back Description | textarea | yes | max 2000 chars |
| Symbol | text | yes | emoji or icon |
| Image URL | text | no | valid URL |
| Tags | array | no | string[] |
| Sources | array | no | {text, url}[] |
| isFeatured | boolean | no | default false |
| includedInPalestineStack | boolean | no | default false |

---

## 2. API Specification

### 2.1 Card Endpoints

```
GET    /api/cards              # List all cards
GET    /api/cards/:id          # Get single card
POST   /api/cards              # Create card (admin)
PUT    /api/cards/:id          # Update card (admin)
DELETE /api/cards/:id          # Delete card (admin)
```

### 2.2 Interaction Endpoints

```
POST   /api/interactions       # Record interaction
GET    /api/cards/:id/ratings  # Get rating counts for card
```

**Request Body (POST /api/interactions)**
```json
{
  "cardId": 1,
  "interactionType": "RATING_UP" | "RATING_DOWN",
  "userId": "optional-string" // from auth
}
```

### 2.3 Auth Endpoints

```
GET    /api/auth/user-role     # Get current user's role
```

---

## 3. Component Hierarchy

```
App
├── ThemeProvider
├── QueryClientProvider
├── TooltipProvider
├── Toaster (shadcn)
├── Sonner (toast)
└── BrowserRouter
    └── Routes
        ├── Index (/)
        ├── About (/about)
        ├── Admin (/admin) [protected]
        └── NotFound (*)

Index
├── Header
├── CardDeck
│   ├── Card (featured/hero)
│   └── Card (drawn)
└── Footer

Admin
├── Header
├── CardList (search, add, edit, delete)
├── CardEditor (form)
└── Footer
```

---

## 4. State Management

### Client State (React)
- `useState` for local UI (filter toggle, editing card)
- `useDelayedVisibility` hook for animations

### Server State (React Query)
- Card list queries
- Interaction mutations
- User role query

### Persistence
- **Votes**: localStorage (`card_${cardId}_voted`)
- **Theme**: localStorage (via next-themes)
- **Cards**: PostgreSQL via Prisma

---

## 5. Constants

```typescript
// Card deck animation delays
const HEADER_DELAY = 100;
const CONTENT_DELAY = 300;
const CARD_STAGGER = 50;

// Card dimensions
const CARD_ASPECT_RATIO = '2/3';
const CARD_MAX_WIDTH = 'max-w-xs';
const HERO_MAX_WIDTH = 'max-w-md';
```

---

## 6. Acceptance Criteria

### Index Page
- [ ] Featured card displays with hero styling
- [ ] Card stack shows 5 silhouettes
- [ ] "Draw a Card" triggers selection animation
- [ ] Flipped card shows truth + sources
- [ ] Rating buttons present but disabled for anon
- [ ] Israel/Palestine toggle filters cards

### Admin Page
- [ ] Requires authentication
- [ ] Requires ADMIN role
- [ ] Card list searchable
- [ ] Add/Edit/Delete cards works
- [ ] Changes persist to database
- [ ] Export generates valid JSON

### Mobile Responsive
- [ ] Cards stack vertically on small screens
- [ ] Header collapses to hamburger on mobile
- [ ] Touch targets minimum 44px

---

## 7. File Structure

```
src/
├── components/
│   ├── Card.tsx              # Card flip component
│   ├── CardDeck.tsx         # Deck + draw logic
│   ├── Header.tsx           # Navigation
│   ├── Footer.tsx           # Copyright
│   ├── ThemeToggle.tsx      # Dark mode switch
│   └── admin/
│       ├── CardList.tsx     # Admin card list
│       └── CardEditor.tsx   # Add/Edit form
├── pages/
│   ├── Index.tsx            # Home
│   ├── About.tsx            # About page
│   ├── Admin.tsx            # Admin panel
│   └── NotFound.tsx         # 404
├── hooks/
│   ├── useAdminCheck.ts     # Role verification
│   ├── use-toast.ts         # Toast notifications
│   └── use-mobile.tsx       # Mobile detection
├── lib/
│   └── utils.ts             # cn() utility
├── data/
│   └── cards.ts             # Static card data (fallback)
└── utils/
    └── animations.ts        # Animation hooks

prisma/
├── schema.prisma            # Database schema
└── sql/                     # Migration scripts
```

---

## 8. Out-of-Scope (v1)

- Real-time rating counts on cards
- User authentication flow (handled by Stack)
- Card sharing
- Comments/threads
- Search beyond admin panel
- Pagination
- Unit tests (deferred)