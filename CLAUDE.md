# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reference

The project ships comprehensive developer docs in `AGENTS.md` — read it first for architecture, directory structure, IPC patterns, and code conventions. This file covers what AGENTS.md doesn't: platform-specific pitfalls, test commands, and startup flow.

## Quick commands

```bash
npm run watch          # Dev mode: webpack in watch, auto-rebuild + Electron restart
npm run build          # Development build (main + preload + renderer in parallel)
npm run build-prod     # Production build
npm start              # Launch built app (requires prior build)
npm run check          # Lint + type check + unit tests in parallel
npm run lint:js        # ESLint only
npm run check-types    # TypeScript type check (no emit)
npm run test:unit      # Jest unit tests only
npm run e2e            # Build test bundle + run Playwright E2E tests
npm run fix:js         # ESLint auto-fix
```

### Running a single unit test

```bash
npx jest --testPathPattern="path/to/file.test.ts" --testNamePattern="test name substring"
```

### E2E tests

E2E tests live in `e2e/` (separate `package.json`). Tests are tagged by platform: `@all`, `@win32`, `@darwin`, `@linux`. The Playwright config auto-filters by `process.platform`.

```bash
npm run e2e                              # Full suite for current platform
TEST=app Menu npm --prefix e2e test     # Single spec
```

## Startup flow

1. `src/main/app/index.ts` → dynamic-imports dropdown views (side-effect singletons), calls `initialize()`
2. `initialize()` in `src/main/app/initialize.ts`:
   - Parses CLI args → sets up `CriticalErrorHandler` → inits `Config`, `i18nManager`, `secureStorage`
   - Registers all IPC handlers, protocols, permissions
   - `app.whenReady()` → `initializeAfterAppReady()`: installs React/Redux DevTools (dev only), creates `MainWindow`, sets up `TabManager`, `Tray`, `AutoLauncher`, `MenuManager`
3. `MainWindow.show()` → creates the `BrowserWindow` with tabs UI, loads `mattermost-desktop://renderer/index.html`
4. Each Mattermost server gets its own `WebContentsView` inside the window

## Path aliases

Configured in `webpack.config.base.js` and `tsconfig.json` (`baseUrl: ./src`):

| Import path | Resolves to |
|---|---|
| `app/...` | `src/app/...` |
| `common/...` | `src/common/...` |
| `main/...` | `src/main/...` |
| `renderer/...` | `src/renderer/...` |
| `assets/...` | `src/assets/...` |
| `types/...` | `src/types/...` |

## Platform-specific native modules

Several native Node addons are platform-specific. Compilation requires Visual Studio with C++ workload + Windows SDK on Windows, Xcode CLI tools on macOS.

| Module | Platforms | Used for |
|---|---|---|
| `registry-js` | Windows only | Reading Windows registry (GPO policies, theme) |
| `windows-focus-assist` | Windows only | Detecting Windows Focus Assist / DnD state |
| `cf-prefs` | macOS only | Reading CFPreferences set by MDM profiles |
| `macos-notification-state` | macOS only | Checking macOS notification DnD state |

**Windows gotcha:** `cf-prefs` and `macos-notification-state` are macOS-only. Their binding.gyp has zero sources on Windows, producing a dummy `.node` that fails `NODE_MODULE` registration. The app handles `macos-notification-state` gracefully (logs and continues), but `cf-prefs` requires a patch to its `index.js` — wrap the `require('bindings')` call in try/catch with no-op fallbacks for `getValue` and `isPreferenceForced`.

**Rebuilding for Electron ABI:** If native modules throw "Module did not self-register," rebuild them against Electron headers:

```bash
# Rebuild all native deps
npx electron-rebuild -f

# Or rebuild a single module manually
cd node_modules/<module-name>
npx node-gyp rebuild --target=41.2.0 --arch=x64 --dist-url=https://electronjs.org/headers
```

The Electron version in use is in `package.json` → `devDependencies.electron`.

## IPC patterns

IPC channels are string constants in `src/common/communication.ts`. Two patterns:

- **Request/response:** `ipcMain.handle(GET_CONFIGURATION, handler)` + `ipcRenderer.invoke(GET_CONFIGURATION)`
- **Fire-and-forget:** `ipcMain.on(NOTIFY_MENTION, handler)` + `ipcRenderer.send(NOTIFY_MENTION)`

New channels follow a 3-step flow: define constant → register handler in `initialize.ts` → expose in preload (`internalAPI.js` for internal views, `externalAPI.ts` for server views).

## Singleton pattern

Most main-process modules export a single instance. Import using PascalCase:
```typescript
import Config from 'common/config';
import ServerManager from 'common/servers/serverManager';
```

When unit-testing, mock with `__esModule: true` + `default`:
```javascript
jest.mock('common/config', () => ({
    __esModule: true,
    default: { set: jest.fn(), enableServerManagement: true },
}));
```

## Compile-time constants

Set via `DefinePlugin` in `webpack.config.base.js`. Available as bare globals:
- `__HASH_VERSION__` — git short hash (undefined in CI release builds)
- `__IS_NIGHTLY_BUILD__` — true for nightly CI workflow
- `__IS_MAC_APP_STORE__` — true for Mac App Store variant
- `__DISABLE_GPU__` — hardware acceleration toggle
- `__SENTRY_DSN__` — Sentry endpoint for crash reporting
