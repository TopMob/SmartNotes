export async function readJsonObject(request) {
  try {
    const parsedBody = await request.json()
    if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
      return parsedBody
    }
    return {}
  } catch {
    return {}
  }
}
