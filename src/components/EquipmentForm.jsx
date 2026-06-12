import { useEffect, useState } from 'react'
import { saveEquipment } from '../lib/equipment.js'

const fieldStyle = {
  width: '100%',
  padding: '0.75rem 0.85rem',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef7',
  fontSize: '1rem',
}

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  color: '#b7c0d4',
  marginBottom: '0.35rem',
}

const TYPE_OPTIONS = [
  { value: 'visual', label: 'Visual' },
  { value: 'camera', label: 'Camera' },
  { value: 'smart', label: 'Smart Scope' },
]

function emptyForm() {
  return {
    name: '',
    type: 'visual',
    aperture_mm: '',
    focal_length_mm: '',
    fov_degrees: '',
    is_seestar: false,
  }
}

function fromRow(row) {
  if (!row) return emptyForm()
  return {
    name: row.name ?? '',
    type: row.type ?? 'visual',
    aperture_mm: row.aperture_mm != null ? String(row.aperture_mm) : '',
    focal_length_mm:
      row.focal_length_mm != null ? String(row.focal_length_mm) : '',
    fov_degrees: row.fov_degrees != null ? String(row.fov_degrees) : '',
    is_seestar: Boolean(row.is_seestar),
  }
}

/* eslint-disable react/prop-types -- plain JS project */
export default function EquipmentForm({
  userId,
  initialRow,
  onSaved,
  onCancel,
  submitLabel,
}) {
  const [values, setValues] = useState(() => fromRow(initialRow))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setValues(fromRow(initialRow))
    setError('')
  }, [initialRow])

  function setField(key, v) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  function handleSeestarChange(checked) {
    setField('is_seestar', checked)
    if (checked) {
      setValues((prev) => ({
        ...prev,
        is_seestar: true,
        type: 'smart',
        aperture_mm: '50',
        focal_length_mm: '250',
        fov_degrees: '1.0',
      }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!userId) return

    const name = values.name.trim()
    if (!name) {
      setError('Name is required.')
      return
    }
    const aperture = Number(values.aperture_mm)
    const focal = Number(values.focal_length_mm)
    const fov = Number(values.fov_degrees)
    if (!Number.isFinite(aperture) || aperture <= 0) {
      setError('Enter a valid aperture (mm).')
      return
    }
    if (!Number.isFinite(focal) || focal <= 0) {
      setError('Enter a valid focal length (mm).')
      return
    }
    if (!Number.isFinite(fov) || fov <= 0) {
      setError('Enter a valid field of view (degrees).')
      return
    }

    setBusy(true)
    try {
      const { error: saveErr } = await saveEquipment({
        id: initialRow?.id,
        user_id: userId,
        name,
        type: values.type,
        aperture_mm: aperture,
        focal_length_mm: focal,
        fov_degrees: fov,
        is_seestar: values.is_seestar,
      })
      if (saveErr) throw saveErr
      onSaved?.()
    } catch (err) {
      setError(err.message ?? 'Could not save equipment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
    >
      <div>
        <label htmlFor="eq-name" style={labelStyle}>
          Name
        </label>
        <input
          id="eq-name"
          name="name"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          style={fieldStyle}
          disabled={busy}
          autoComplete="off"
        />
      </div>

      <fieldset
        style={{
          margin: 0,
          padding: 0,
          border: 'none',
        }}
      >
        <legend style={{ ...labelStyle, marginBottom: '0.5rem' }}>Type</legend>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#e8eef7',
                fontSize: '0.95rem',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              <input
                type="radio"
                name="equipment-type"
                value={opt.value}
                checked={values.type === opt.value}
                onChange={() => setField('type', opt.value)}
                disabled={busy}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="eq-aperture" style={labelStyle}>
          Aperture (mm)
        </label>
        <input
          id="eq-aperture"
          name="aperture_mm"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={values.aperture_mm}
          onChange={(e) => setField('aperture_mm', e.target.value)}
          style={fieldStyle}
          disabled={busy}
        />
      </div>

      <div>
        <label htmlFor="eq-focal" style={labelStyle}>
          Focal length (mm)
        </label>
        <input
          id="eq-focal"
          name="focal_length_mm"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={values.focal_length_mm}
          onChange={(e) => setField('focal_length_mm', e.target.value)}
          style={fieldStyle}
          disabled={busy}
        />
      </div>

      <div>
        <label htmlFor="eq-fov" style={labelStyle}>
          FOV (degrees)
        </label>
        <input
          id="eq-fov"
          name="fov_degrees"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={values.fov_degrees}
          onChange={(e) => setField('fov_degrees', e.target.value)}
          style={fieldStyle}
          disabled={busy}
        />
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#8b96ad' }}>
          For Seestar S30, use 1.0°
        </p>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#e8eef7',
          fontSize: '0.95rem',
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={values.is_seestar}
          onChange={(e) => handleSeestarChange(e.target.checked)}
          disabled={busy}
        />
        This is a Seestar S30
      </label>

      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: '0.9rem', color: '#ff9b9b' }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #5b7cfa, #8a4dff)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.8 : 1,
            flex: '1 1 140px',
          }}
        >
          {busy ? 'Saving…' : submitLabel ?? 'Save'}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e8eef7',
              fontSize: '1rem',
              cursor: busy ? 'wait' : 'pointer',
              flex: '1 1 140px',
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
