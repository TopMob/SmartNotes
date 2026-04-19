function buildErrorText(error) {
  const message = String(error?.message || "")
  const code = String(error?.code || "")
  const status = String(error?.status || "")
  const body = JSON.stringify(error?.response?.data || {})
  return `${message} ${code} ${status} ${body}`.toLowerCase()
}

export function mapDriveError(error) {
  const combined = buildErrorText(error)

  if (combined.includes("invalid_grant") || combined.includes("invalid credentials") || combined.includes("unauthorized_client")) {
    return "RECONNECT_REQUIRED"
  }

  if (combined.includes("insufficient permissions") || combined.includes("insufficientpermissions") || combined.includes("insufficient authentication scopes")) {
    return "DRIVE_SCOPE_INSUFFICIENT"
  }

  if (combined.includes("rate limit") || combined.includes("quota")) {
    return "DRIVE_QUOTA_EXCEEDED"
  }

  if (combined.includes("file not found") || combined.includes("notfound") || combined.includes("404")) {
    return "DRIVE_FILE_NOT_FOUND"
  }

  return null
}
