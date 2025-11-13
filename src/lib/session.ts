import { getCookie, setCookie } from '@tanstack/react-start/server'
import { randomBytes } from 'node:crypto'

export const SESSION_COOKIE_NAME = 'dashit-session-id'
export const CANVAS_COOKIE_NAME = 'dashit-canvas-id'

export function generateSessionId() {
  return randomBytes(16).toString('hex')
}

export function getOrSetSessionId(): string {
  const sessionId = getCookie(SESSION_COOKIE_NAME)
  if (sessionId) {
    return sessionId
  }

  const newSessionId = generateSessionId()
  setCookie(SESSION_COOKIE_NAME, newSessionId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: false,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return newSessionId
}

export function setCanvasCookie(canvasId: string) {
  setCookie(CANVAS_COOKIE_NAME, canvasId, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: false,
    maxAge: 60 * 60 * 24 * 365,
  })
}
