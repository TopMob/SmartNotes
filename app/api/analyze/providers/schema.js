export const ANALYSIS_CONTRACT_VERSION = "v1"

export const RESURFACING_CLASSES = [
  "task",
  "time-sensitive",
  "idea",
  "reference",
  "archive-like"
]

export function createAnalysisTaskInput() {
  return {
    contractVersion: ANALYSIS_CONTRACT_VERSION,
    objective: "Analyze notes and return only strict JSON.",
    allowedOutputFields: ["id", "folderId", "userTags", "hiddenTags", "relevance", "resurfacingClass"]
  }
}
