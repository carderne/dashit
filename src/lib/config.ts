type Config = {
  convexUrl: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env

export function get(name: string): string {
  const variable = env[name]
  if (variable) {
    return variable
  } else {
    throw new Error(`Startup aborted: env var missing: ${name}`)
  }
}

function getDefaultConfig() {
  return {
    convexUrl: get('VITE_CONVEX_URL'),
  }
}

export function getConfig(): Config {
  return getDefaultConfig()
}
