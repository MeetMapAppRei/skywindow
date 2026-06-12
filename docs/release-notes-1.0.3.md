# SkyWindow 1.0.3 (build 4)

**Release date:** June 9, 2026

## Play Store listing (paste into “Release notes”)

```
What's new in 1.0.3:

• Home screen icon now matches the Play Store — teal window mark on every device
• Onboarding and sign-in connect to SkyWindow's own account database
• More reliable first-time setup when creating your profile
```

## Full notes

### Fixed
- **Launcher icon** — Android home screen and app drawer now use the correct SkyWindow icon (teal window / horizon mark), matching the Play Store listing. Previously some installs showed a generic or broken icon.
- **Onboarding database** — Native builds now point at SkyWindow's dedicated Supabase project so profile setup no longer fails with missing-column errors.

### Improved
- Mobile builds automatically regenerate PWA and launcher icons before packaging, so future releases stay in sync with the brand mark.

### For testers
- Uninstall the old app (or remove any “Add to Home screen” PWA shortcut) before installing this build so Android picks up the new icon.
- You may need to sign up or sign in again if you previously used a build tied to the wrong backend.

## Build artifacts

- **Android AAB:** `android/app/build/outputs/bundle/release/app-release.aab`
- **Version:** 1.0.3 (`versionCode` 4)
