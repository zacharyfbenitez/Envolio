# Envolio native app / TestFlight preparation

Updated September 13, 2026. Development scaffolding, not a signed or submission-ready release.

## What exists

- Capacitor 8.5.2 core, CLI, iOS and Android packages, pinned in the lockfile.
- Generated `ios/` Xcode project using Swift Package Manager and `android/` Gradle project.
- Owner-selected domain input **envolio.app**, normalized reverse-DNS identifier **app.envolio** on both iOS and Android; display name **Envolio**. No domain registration, DNS setup, or Apple app record has been created or verified by this change.
- `vite.native.config.js` builds bundled assets to `dist-native/`, independent of the live web `dist/` and proxy configuration.
- Native-only shell selected through a build alias. It has a development notice, safe-area-aware navigation, and no PWA install prompts or service worker.
- No remote `server.url`, signing credentials, provider keys, push entitlements, or new permissions added.

The existing deployed web bundle and server were not rebuilt or restarted. Native preparation does not deploy anything.

## Current limitations: do not upload this shell yet

The UI compiles, but API calls still use same-origin `/api/` URLs. In a native app those resolve to the device's local asset server, not Express. Flight search, telemetry, airline icon proxy, and subscriptions need explicit backend connectivity. The development banner intentionally states this limitation. Existing browser offline caching and browser notification APIs are not native offline/push implementations.

The generated native launcher icons and splash assets still need the Envolio passport artwork. Web branding already uses it. Android system-back behavior, native sharing/downloads, deep links, and physical-device keyboard/layout behavior are not implemented or verified.

## Local workflow

Requires Node 22+. Native SDK tools are separate from npm dependencies.

```sh
npm ci
npm run native:build
npm run test:native
npm run native:sync
# On a Mac with Xcode:
npm run native:ios
# With Android Studio installed:
npm run native:android
```

Native projects, configuration, and lockfile belong in version control. Generated web assets/build outputs and signing material are excluded. Run build and sync after cloning to recreate native asset/configuration files.

The selected identity is `app.envolio`, derived by reversing the labels of `envolio.app`. Capacitor, both Xcode build configurations, Android applicationId/namespace, Java package/directory, and Android package/scheme resources now agree. ENVOLIO_APP_ID is optional but rejects conflicting values to prevent partial migrations. Any later identity change must update all these locations together. Domain input does not configure the API URL, universal links, Android App Links, signing, or website hosting. Apple identifier availability still needs verification in the owner's developer account before signing/uploading.

## Repo work required before the first useful TestFlight build

1. **Backend transport:** centralize API URL construction and preserve same-origin behavior for web. Update App.jsx (including airline icon URLs), FlightSearch.jsx, TravelIntelligence.jsx, TripStrategy.jsx, and DecisionPanels.jsx. Use a stable HTTPS staging/production API base for native. Keep FlightAware/Skylink credentials only on Express. Do not put secrets in VITE variables or native assets.
2. **Server integration:** narrowly allow required native origins, handle OPTIONS preflight for JSON requests, and test both iOS and Android. No wildcard credentialed CORS. CORS is not authentication; preserve rate limits and add appropriate authentication/abuse protection to sensitive APIs. Confirm aviation-data licensing covers mobile distribution.
3. **Native features:** add Capacitor App for launch/deep-link/system-back handling; native Share/Filesystem for result cards; network/resume refresh and an explicit stale offline cache. Add APNs/FCM device-token registration and backend delivery before promising background alerts. Avoid unnecessary permissions.
4. **UX:** repair dock overlap, saved-flight navigation, dialog focus, and result hierarchy from `ui-audit/UI-AUDIT.md`. Verify keyboard, notches, safe areas, dynamic text, reduced motion, screen readers, slow network and offline relaunch on real phones. A native wrapper alone does not fix those issues.
5. **Assets/configuration:** create native passport icon sets and launch appearance; confirm identifier, version/build numbers, device support and orientation. Review privacy manifest entries based on actual SDK/API usage; do not invent required-reason declarations. Set up a stable public support/privacy URL. Bundle fonts where appropriate rather than relying on remote fonts for first launch.
6. **Release plumbing:** establish Git-backed macOS CI or a Mac build workflow with protected secrets, run tests and dependency checks, sync, archive, sign and upload. Produce a signed Android App Bundle separately when Play Console is available.
7. **Store-facing product:** honest feature descriptions, screenshots, privacy/data collection answers, support contact, and reviewer instructions. If accounts/social are added, include account deletion, moderation, content reporting, user blocking, and a review login as applicable. Keep unfinished payments/social out of the first flight-focused beta.

## Required from the owner for TestFlight

- **Apple Developer membership:** owner confirmed they have it; verify active membership and accepted agreements.
- **Identifier and publisher identity:** owner selected `envolio.app`; register/check availability of `app.envolio` under the correct Apple team. A live website is not required to choose the identifier. No domain ownership or identifier availability is implied by the local configuration.
- **Team / access:** select the Apple team in Xcode or invite the release developer through Apple with appropriate access. Do not send an Apple password, two-factor code, signing private key, or API key in chat. Use protected build-service secrets if hosted CI is chosen.
- **Build environment:** a Mac with compatible Xcode or an approved hosted macOS build service. This Linux machine can generate/sync projects but cannot create an iOS archive or run the iOS Simulator.
- **App Store Connect record and beta information:** Envolio name availability, identifier, SKU, feedback/support contact, what to test, and export-compliance answers based on the actual app.
- **Testing:** an iPhone and initial tester emails; internal testers need appropriate App Store Connect access. External testing has a beta-review step.
- **Stable HTTPS API:** a custom domain can come later; a stable managed-host HTTPS endpoint can support development. The temporary chat.dev preview URL is not a production backend commitment.

Suggested sequence: confirm identity and API hosting → working signed device build → internal TestFlight → real-device fixes → external beta review → App Store review. TestFlight availability does not guarantee App Store approval.

## Verification completed here

- Native Vite build succeeded; `dist/` was not overwritten.
- iOS and Android generation and `cap sync` succeeded.
- Three native preparation tests passed.
- Chromium shell smoke test checked home search rendering, native navigation, runtime exceptions and absence of service worker registration. This is not a native-device test.
- Existing live local port 5173 returned HTTP 200.
- Production-dependency npm audit: zero reported vulnerabilities. Full audit: three moderate findings in the CLI → xcode → uuid development-tool chain. Resolve/reassess before release CI; no forced dependency override applied. Native binaries have not been compiled, signed, or uploaded.

## Official references checked

Capacitor currently documents Node 22+, Xcode 26+ on macOS, and Android Studio 2025.2.1+; recheck requirements at release time: [environment setup](https://capacitorjs.com/docs/getting-started/environment-setup). Configuration and bundled assets: [Capacitor config](https://capacitorjs.com/docs/config).

Apple beta distribution and access: [TestFlight](https://developer.apple.com/testflight/) and [upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds). Review readiness, minimum functionality, privacy and social moderation: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
