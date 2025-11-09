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

function getDevConfig(): Config {
  return {
    ...getDefaultConfig(),
  }
}

function getPrdConfig(): Config {
  const config = getDefaultConfig()
  return {
    ...config,
  }
}

export function getConfig(): Config {
  if (process.env.NODE_ENV === 'production') {
    return getPrdConfig()
  } else {
    return getDevConfig()
  }
}
