/** Prefer back camera at native wide angle (no digital zoom). */
export const WIDE_CAMERA_VIDEO = {
  facingMode: 'environment',
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  zoom: { ideal: 1 },
}

/**
 * Set optical/digital zoom to the widest value the device allows.
 * @param {MediaStreamTrack | undefined} track
 */
export async function applyWidestCameraZoom(track) {
  if (!track?.getCapabilities || !track.applyConstraints) return
  try {
    const caps = track.getCapabilities()
    if (!caps?.zoom) return
    const min = typeof caps.zoom.min === 'number' ? caps.zoom.min : 1
    await track.applyConstraints({ advanced: [{ zoom: min }] })
  } catch {
    /* zoom not supported on this browser/device */
  }
}
