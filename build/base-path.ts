export function normalizeBasePath(configuredPath: string | undefined): string {
  if (configuredPath === undefined || configuredPath === "") {
    return "/"
  }

  if (!configuredPath.startsWith("/") || !configuredPath.endsWith("/")) {
    throw new Error("VITE_BASE_PATH must have a leading and trailing slash")
  }

  return configuredPath
}
