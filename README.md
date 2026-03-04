# ⚡ Fast Read — RSVP Reader

**by [TechScript Limited](https://techscript.ca)**

A production-quality React web application that implements **Rapid Serial Visual Presentation (RSVP)** reading for PDF and EPUB files. All processing runs entirely in the browser — no backend required.

---

## Authentication & Sync (Optional)

ReadSwift works fully offline without any account. If you want **cross-device reading progress sync**, enable the optional Supabase integration. You'll need two free accounts:

| Account | What it does | Sign up |
|---------|-------------|---------|
| **Supabase** | Stores your reading progress in a managed PostgreSQL database | [supabase.com](https://supabase.com) — free tier |
| **Google Cloud** | Provides the "Sign in with Google" OAuth button | [console.cloud.google.com](https://console.cloud.google.com) — free |

**Setup guides (in order):**
1. [Supabase project + database setup](docs/SUPABASE_SETUP.md)
2. [Google OAuth credentials](docs/GOOGLE_OAUTH_SETUP.md)
3. Copy `.env.example` → `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Once configured, a **Sign In with Google** button appears in the burger menu. Without configuration, the app behaves exactly as before.

---

## Features

- **Upload** PDF or EPUB files (up to 100 MB)
- **Display** one word at a time in a fixed focal position
- **Adjustable speed** via logarithmic slider (60–1000 WPM)
- **Controls:** Play, Pause, Faster, Slower, Restart
- **Word navigation:** step or jump to any word by number
- **Page/chapter navigation:** jump to any page (PDF) or chapter (EPUB)
- **Context preview:** side-by-side scrollable text panel with the current word highlighted and clickable
- **Reading history:** automatically records each file you open, saves your progress, and restores your last position when you re-upload the same file
- **Keyboard shortcuts:** `Space` = Play/Pause, `←/→` = Prev/Next word, `↑/↓` = Faster/Slower
- **Persists** current word index and WPM to localStorage (resume reading after refresh)
- **Progressive Web App (PWA):** installable on any device, works offline
- **Native mobile:** Android & iOS via Capacitor

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | React 19 + TypeScript |
| Build tool | Vite 7 |
| PDF parsing | pdfjs-dist |
| EPUB parsing | epubjs |
| Styling | CSS Modules + vanilla CSS |
| State | React Context API |
| PWA | vite-plugin-pwa (Workbox) |
| Mobile wrapper | Capacitor 8 |

---

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Deployment

### Web — GitHub Pages + Subdomain (`readswift.techscript.ca`)

ReadSwift deploys automatically to **`https://readswift.techscript.ca`** on every push to `main`. Your main `techscript.ca` domain is completely untouched.

---

#### ⚠️ One-time setup — do these three things in order

##### 1 · Add one DNS record in GoDaddy

Log in to [GoDaddy DNS Manager](https://dcc.godaddy.com) for `techscript.ca` and add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| `CNAME` | `readswift` | `ppsk2011.github.io` | 1 Hour |

This is the only record you need. Everything else in your `techscript.ca` DNS is untouched.

##### 2 · Enable GitHub Pages (Source = GitHub Actions)

In this repository:

1. Go to **Settings → Pages**
2. Under **Build and deployment → Source**, select **"GitHub Actions"**
3. Leave the **Custom domain** field blank — the `public/CNAME` file in the repo handles it

Click **Save**.

##### 3 · Trigger a deploy and enable HTTPS

Option A — push any commit to `main` (the workflow runs automatically).  
Option B — go to **Actions → Deploy to GitHub Pages → Run workflow → Run workflow**.

After the workflow finishes (~2 minutes):
1. Go back to **Settings → Pages**
2. You should see **"Your site is published at https://readswift.techscript.ca"**
3. Tick **"Enforce HTTPS"** and click **Save**

> If the "Enforce HTTPS" checkbox is greyed out, wait 10–15 minutes for the Let's Encrypt certificate to be issued, then refresh the page.

---

#### Why the site was returning 404 (and how it's now fixed)

Two things were wrong:

| Problem | Fix applied in this repo |
|---------|--------------------------|
| A `jekyll-gh-pages.yml` workflow was also deploying to GitHub Pages on every `main` push, using the same concurrency group. It raced against the Vite build and sometimes won — deploying raw repo files (no CNAME, no built app). | Deleted `jekyll-gh-pages.yml`. Only `deploy-web.yml` runs now. |
| The PR with the `readswift.techscript.ca` CNAME hadn't been merged to `main` yet, so the deployed site still had the old domain. | Merge this PR → a new deploy runs → `dist/CNAME` becomes `readswift.techscript.ca`. |

---

#### Why a subdomain (not a sub-folder)?

| Approach | Notes |
|----------|-------|
| **Subdomain** `readswift.techscript.ca` ✅ | Each site is a separate repo. One DNS record. PWA installs correctly. `techscript.ca` is free for your company website. |
| Sub-folder `techscript.ca/readswift` | Both sites must be in the same repo (or you need a reverse proxy). PWA `scope`/offline breaks in sub-paths. Not recommended with GitHub Pages. |

---

### PWA — Install on any device

The production build is a fully installable Progressive Web App:
- **Desktop (Chrome/Edge):** click the install icon in the address bar
- **Android (Chrome):** tap the "Add to Home Screen" prompt
- **iOS (Safari):** tap the Share button → "Add to Home Screen"

The service worker caches the app shell for offline use.

---

### Android — Native APK via Capacitor

**Prerequisites:** Android Studio, JDK 17+

```bash
# 1. Build the web app
npm run build

# 2. Add & sync the Android project (first time)
npx cap add android
npx cap sync android

# 3. Open in Android Studio
npm run cap:android
```

Inside Android Studio, run on a device/emulator or use
**Build → Generate Signed Bundle / APK** to produce a release APK for the Play Store.

**Automated CI builds** are produced by `.github/workflows/build-android.yml`:
- Every push to `main` produces a **debug APK** (upload artifact `fast-read-debug-apk`)
- Every tag matching `v*` produces a **release APK** (requires repository secrets below)

Required secrets for signed release builds:

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded `.jks` keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Key password |

---

### iOS — Native App via Capacitor

**Prerequisites:** macOS, Xcode 15+, CocoaPods

```bash
# 1. Build the web app
npm run build

# 2. Add & sync the iOS project (first time)
npx cap add ios
npx cap sync ios

# 3. Open in Xcode
npm run cap:ios
```

Inside Xcode, configure your Team & Bundle ID, then run on a simulator / device or archive for App Store submission.

**Automated CI builds** are produced by `.github/workflows/build-ios.yml` on macOS runners. For signed App Store builds, configure signing certificates as GitHub Actions secrets following the [Xcode deployment guide](https://docs.github.com/en/actions/deployment/deploying-xcode-applications).

---

### After updating the web source

Whenever you change the app, sync the native projects:

```bash
npm run build
npm run cap:sync   # equivalent to: npx cap sync
```

---

## Project Structure

```
.
├── capacitor.config.ts     # Capacitor (mobile) configuration
├── vite.config.ts          # Vite + PWA plugin configuration
├── index.html              # HTML shell with PWA + mobile meta tags
├── public/
│   ├── icons/              # App icons (SVG + 192/512 PNG)
│   └── apple-touch-icon.png
├── .github/workflows/
│   ├── deploy-web.yml      # GitHub Pages deployment
│   ├── build-android.yml   # Android APK build
│   └── build-ios.yml       # iOS build
└── src/
    ├── components/
    │   ├── Controls.tsx         # Playback controls, speed slider, file upload
    │   ├── PageNavigator.tsx    # Page / chapter jump navigation
    │   ├── ReadingHistory.tsx   # Reading history panel with per-file progress
    │   ├── WordNavigator.tsx    # Word-level step + jump navigation
    │   ├── ContextPreview.tsx   # Side-by-side page text preview
    │   └── ReaderViewport.tsx   # Fixed-position word display
    ├── context/
    │   ├── ReaderContext.tsx    # ReaderProvider component (state)
    │   ├── readerContextDef.ts  # Context object + TypeScript types
    │   └── useReaderContext.ts  # useReaderContext hook
    ├── hooks/
    │   └── useRSVPEngine.ts     # RSVP engine with drift-corrected timing
    ├── parsers/
    │   ├── pdfParser.ts         # pdfjs-dist page-by-page async generator
    │   └── epubParser.ts        # epubjs chapter-by-chapter async generator
    ├── utils/
    │   ├── recordsUtils.ts      # load / save / delete reading records in localStorage
    │   └── textUtils.ts         # normalizeText / tokenize helpers
    └── styles/
        ├── app.css              # Global layout styles
        └── *.module.css         # Component-scoped styles
```

---

## Architecture Decisions

### Async generators for parsing
Both `parsePDF` and `parseEPUB` are **async generators** that yield text one page/chapter at a time. This means:
- The UI shows loading progress after each page/chapter
- The main thread is never blocked for more than one page at a time
- Memory usage stays low even for large files (words are small strings)

### Drift-corrected timing
`useRSVPEngine` uses `setInterval` with drift correction. After each tick it calculates the difference between the expected and actual fire time and adjusts the next interval accordingly. This prevents timing drift at high WPM rates.

### React Context for state
All reader state lives in `ReaderContext`. The hook `useRSVPEngine` reads from and writes to the context. Components only re-render when the specific slice of state they consume changes.

### CSS Modules for scoped styles
Each component has its own `.module.css` file preventing style leakage. Global structural styles live in `src/styles/app.css`.

### localStorage persistence
`currentWordIndex` and `wpm` are synced to `localStorage` via `useEffect`, letting users resume reading after a page refresh.

### Reading records
Every time a file is successfully parsed, a `ReadingRecord` is saved to `localStorage` under the key `fastread_records`. Each record stores the file name, total word count, last word index, last read date, and WPM. When the same file is uploaded again, its saved `lastWordIndex` is automatically restored. Progress is also updated whenever reading is paused. Up to 20 records are kept (oldest are dropped). Records are displayed in a **Reading History** panel and can be individually deleted.

---

## Performance Considerations

- **No full-document preload:** PDFs are processed page-by-page using pdfjs-dist streaming API; EPUB chapters are loaded one at a time.
- **`React.memo` on ReaderViewport:** The word display only re-renders when the word changes, not on any other state update.
- **Refs in engine:** The RSVP engine interval callback reads the current word index via a ref (not closure) to avoid stale values without triggering re-renders.
- **`will-change: transform`** on the word element enables GPU compositing for the word-appear animation.

---

## Publishing to the App Stores

For a complete step-by-step guide to publishing ReadSwift on **Google Play** and the **Apple App Store** — including keystore creation, signing configuration, GitHub secrets, store listings, and review submission — see **[PUBLISHING.md](./PUBLISHING.md)**.

---

© 2025 TechScript Limited

