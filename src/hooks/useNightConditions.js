import { useEffect, useState } from 'react'
import { getMoonPhase } from '../lib/astronomy.js'
import { supabase } from '../lib/supabase.js'
import {
  computeNightConditionsSummary,
  getObservingForecast,
} from '../lib/weather.js'
import { useAuth } from './useAuth.js'

const CACHE_KEY = 'skywindow-night-conditions-v3'
const TTL_MS = 60 * 60 * 1000

function roundCoord(n) {
  return Math.round(Number(n) * 1e4) / 1e4
}

function readCache(lat, lng) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (o.latR !== roundCoord(lat) || o.lngR !== roundCoord(lng)) return null
    if (Date.now() - o.ts > TTL_MS) return null
    return o.payload
  } catch {
    return null
  }
}

function writeCache(lat, lng, payload) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        latR: roundCoord(lat),
        lngR: roundCoord(lng),
        ts: Date.now(),
        payload,
      }),
    )
  } catch {
    /* ignore quota */
  }
}

/**
 * Moon phase, Open-Meteo forecast, and combined conditions for the signed-in user’s saved location.
 * Cached in localStorage for 1 hour per lat/lng.
 * @returns {{ moonPhase: object | null, weather: object | null, conditions: { score: number, label: string, bortle: number } | null, loading: boolean, error: string }}
 */
export function useNightConditions() {
  const { user, loading: authLoading } = useAuth()
  const [moonPhase, setMoonPhase] = useState(null)
  const [weather, setWeather] = useState(null)
  const [conditions, setConditions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setMoonPhase(null)
      setWeather(null)
      setConditions(null)
      setError('')
      setLoading(false)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError('')
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('location_lat, location_lng, bortle_zone')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (profErr) {
        setMoonPhase(null)
        setWeather(null)
        setConditions(null)
        setError(profErr.message ?? 'Could not load your profile for sky conditions.')
        setLoading(false)
        return
      }
      if (prof?.location_lat == null || prof?.location_lng == null) {
        setMoonPhase(null)
        setWeather(null)
        setConditions(null)
        setLoading(false)
        return
      }

      const lat = Number(prof.location_lat)
      const lng = Number(prof.location_lng)
      const bortle = Number(prof.bortle_zone) || 5

      const cached = readCache(lat, lng)
      if (cached) {
        setMoonPhase(cached.moonPhase)
        setWeather(cached.weather)
        setConditions(cached.conditions)
        setLoading(false)
        return
      }

      try {
        const now = new Date()
        const phase = getMoonPhase(now)
        const wx = await getObservingForecast(lat, lng, now)
        const cond = computeNightConditionsSummary(phase, wx, bortle)
        const payload = { moonPhase: phase, weather: wx, conditions: cond }
        writeCache(lat, lng, payload)
        if (!cancelled) {
          setMoonPhase(phase)
          setWeather(wx)
          setConditions(cond)
        }
      } catch {
        const phase = getMoonPhase(new Date())
        const cond = computeNightConditionsSummary(phase, null, bortle)
        if (!cancelled) {
          setMoonPhase(phase)
          setWeather(null)
          setConditions(cond)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  return { moonPhase, weather, conditions, loading, error }
}
