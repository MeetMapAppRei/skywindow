---
# SkyWindow — Project Context

## What This App Does
SkyWindow helps amateur astronomers discover what they can actually see from their specific location on any given night. It combines:
- A photo-based horizon profile analyzer (Claude Vision API)
- A nightly target list engine filtered by the user's horizon, Bortle zone, moon phase, and weather
- Equipment profiles (with Seestar S30 as a preset)
- Session logging

## Stack
- React + Vite (plain JS, no TypeScript)
- Supabase: auth (email/password) + all database tables
- Anthropic API (claude-sonnet-4-20250514): horizon photo analysis via vision
- Vercel: deployment
- Mobile-first responsive design

## Key Design Rules
- All Supabase calls go through src/lib/supabase.js
- All Anthropic usage goes through src/lib/anthropic.js (browser → same-origin `/api/analyze-horizon` → Claude); never call Anthropic from components or from the browser directly
- No TypeScript, no class components — functional components + hooks only
- Keep components small and single-purpose
- .env.local holds: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY (server-only; Vite dev proxies `/api/analyze-horizon`)

## Local backup (Windows)
- This machine uses `scripts/backup-config.local.json` (gitignored): destination `D:\Backups\skywindow`, `requiredVolumeLabel` **External** so backups only run when that volume is mounted (edit the JSON if the disk letter or label changes).
- Task **SkyWindowBackup** runs `scripts/backup-skywindow.ps1` every **15** minutes (interactive user, via `schtasks` / `register-backup-task.ps1`). If the drive is missing, the script exits quietly.
- To remove the task: `powershell -ExecutionPolicy Bypass -File scripts/unregister-backup-task.ps1`

## Database Tables (Supabase)
- profiles: id, user_id, display_name, location_lat, location_lng, bortle_zone, created_at
- equipment: id, user_id, name, aperture_mm, focal_length_mm, type (visual/camera/smart), is_seestar, fov_degrees
- sky_profiles: id, user_id, label, horizon_data (jsonb), created_at
- sessions: id, user_id, date, equipment_id, sky_profile_id, location_lat, location_lng, notes, targets_observed (jsonb)
---
