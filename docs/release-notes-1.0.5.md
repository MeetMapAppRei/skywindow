# SkyWindow 1.0.5 (build 7)

**Release date:** June 11, 2026

## Play Store listing (paste into “Release notes”)

```
What's new in 1.0.5:

• Good-night notifications now work in the Android app — no “Add to Home Screen” required
• Enable alerts in Profile; we check your skies around 8 pm and notify you when conditions look good
• Tapping a notification opens tonight’s verdict
• Profile notification copy updated for the native app
```

## Full notes

### Fixed
- **Native notifications** — The Android app now uses system local notifications instead of PWA-only service workers. Enabling “Notify me on good nights” requests Android permission and schedules daily 8 pm checks.
- **Profile copy** — Removed misleading “Add to Home Screen” / PWA text on the native app. Native users see accurate guidance about 8 pm sky checks.

### Improved
- **Notification flow** — Good-night alerts fire when conditions qualify (clear skies, favorable moon, strong targets). Checks run at 8 pm, when you open the app after 8 pm, or when you tap the scheduled reminder.
- **Tap to open** — Notification taps navigate to Tonight’s verdict.

### Includes from 1.0.4
- Five languages (EN, DE, FR, ES, JA) with Profile language picker
- Tab navigation scroll-to-top fix

## Build artifacts

- **Android AAB:** `android/app/build/outputs/bundle/release/app-release.aab`
- **Upload copy:** `SkyWindow-release.aab` (project root)
- **Version:** 1.0.5 (`versionCode` 7)
