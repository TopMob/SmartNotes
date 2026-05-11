export const ANALYSIS_CONTRACT_VERSION = "v1"
export const ANALYSIS_MODEL_FAMILY = "folder-classification-v1"
export const MAX_FOLDER_CANDIDATES = 8

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
    modelFamily: ANALYSIS_MODEL_FAMILY,
    objective: "Analyze notes and return only strict JSON.",
    allowedOutputFields: ["id", "folderId", "userTags", "hiddenTags", "relevance", "resurfacingClass"]
  }
}
