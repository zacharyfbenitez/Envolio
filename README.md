# Envolio

Flight intelligence web app and Capacitor iOS/Android development projects. Native identifier: `app.envolio` (derived from `envolio.app`).

## Mac / iOS quick start

Requires Node 22+ and Xcode 26+ on compatible macOS. From the cloned project root:

```sh
npm ci
npm run native:build
npx cap sync ios
npm run test:native
npm run native:ios
```

Open `ios/App/App.xcodeproj` (Swift Package Manager; no CocoaPods setup needed). Select the App target, enable automatic signing and choose your paid Apple Developer team. Confirm/register `app.envolio` in that team's developer account before uploading. No team credentials are included.

**The native build is currently a development shell:** remote API connectivity, native icons, offline caching and native push delivery still need implementation before a useful TestFlight beta. See [native readiness and release checklist](docs/NATIVE-APP.md). Build/sync does not deploy the live web app.

## Android

With Android Studio and its SDK installed:

```sh
npm run native:build
npx cap sync android
npm run native:android
```

## Local web development

Copy `.env.example` to `.env` locally and configure server-side credentials if using live providers. Never place provider keys in VITE variables or native assets.

```sh
npm ci
PUBLIC_BASE=/ npm run dev
```

Local web UI: port 5173; API: port 8787 by default. The default Vite configuration also supports the existing chat.dev deployment prefix. Use `PUBLIC_BASE=/` for a normal local root URL.

## Source hygiene

Git excludes credentials, uploaded user files, runtime/provider caches, installed dependencies, generated bundles and signing material. Public UI assets, source, test fixtures, lockfile, native projects and documentation are included. `cap sync` recreates ignored native configuration/assets after cloning. This source snapshot is not a claim of store readiness.
