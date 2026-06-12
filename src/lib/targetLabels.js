/** Shared target type / clearance labels for i18n. */

export function getTargetTypeBadge(target, tr) {
  const tags = new Set(target.tags || [])
  const type = target.type || ''
  if (tags.has('double_star') || type === 'double_star') {
    return {
      label: tr('targets.typeDoubleStar'),
      bg: 'rgba(167,139,250,0.25)',
      fg: '#d8b4fe',
      border: 'rgba(167,139,250,0.45)',
    }
  }
  if (tags.has('galaxy') || type === 'galaxy') {
    return {
      label: tr('targets.typeGalaxy'),
      bg: 'rgba(59,130,246,0.22)',
      fg: '#93c5fd',
      border: 'rgba(59,130,246,0.45)',
    }
  }
  if (
    tags.has('nebula') ||
    tags.has('emission_nebula') ||
    tags.has('planetary_nebula') ||
    type.includes('nebula') ||
    type === 'supernova_remnant' ||
    type === 'milky_way_patch'
  ) {
    return {
      label: tr('targets.typeNebula'),
      bg: 'rgba(244,114,182,0.2)',
      fg: '#f9a8d4',
      border: 'rgba(244,114,182,0.45)',
    }
  }
  if (tags.has('cluster') || type.includes('cluster')) {
    return {
      label: tr('targets.typeCluster'),
      bg: 'rgba(250,204,21,0.2)',
      fg: '#fde047',
      border: 'rgba(250,204,21,0.45)',
    }
  }
  const pretty = type.replace(/_/g, ' ') || tr('targets.typeGeneric')
  return {
    label: pretty,
    bg: 'rgba(148,163,184,0.2)',
    fg: '#cbd5e1',
    border: 'rgba(148,163,184,0.4)',
  }
}

export function getClearanceIndicator(clearanceDeg, tr) {
  const c = Number(clearanceDeg) || 0
  if (c >= 12) {
    return { label: tr('targets.clearanceGood'), color: '#4ade80', bg: 'rgba(74,222,128,0.15)' }
  }
  if (c >= 5) {
    return { label: tr('targets.clearanceLow'), color: '#facc15', bg: 'rgba(250,204,21,0.15)' }
  }
  return { label: tr('targets.clearanceTight'), color: '#f87171', bg: 'rgba(248,113,113,0.15)' }
}

const MOON_PHASE_KEYS = {
  'New Moon': 'moon.new',
  'Waxing Crescent': 'moon.waxingCrescent',
  'First Quarter': 'moon.firstQuarter',
  'Waxing Gibbous': 'moon.waxingGibbous',
  'Full Moon': 'moon.full',
  'Waning Gibbous': 'moon.waningGibbous',
  'Last Quarter': 'moon.lastQuarter',
  'Waning Crescent': 'moon.waningCrescent',
}

export function translateMoonPhase(name, tr) {
  if (!name) return '—'
  const key = MOON_PHASE_KEYS[name]
  return key ? tr(key) : name
}

const CONDITIONS_KEYS = {
  Excellent: 'conditions.excellent',
  Good: 'conditions.good',
  Fair: 'conditions.fair',
  Poor: 'conditions.poor',
}

export function translateConditionsLabel(label, tr) {
  if (!label || label === '—') return '—'
  const key = CONDITIONS_KEYS[label]
  return key ? tr(key) : label
}
