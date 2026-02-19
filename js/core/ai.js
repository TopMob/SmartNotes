export async function analyzeNote(text) {
    try {
        const response = await fetch(
            "https://backendfornmartnotes.vercel.app/api/analyze",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text })
            }
        )

        if (!response.ok) {
            console.error("AI analyze failed")
            return null
        }

        const analysisResult = await response.json()
        const relevanceValue = Number(analysisResult?.relevance)
        if (!analysisResult || Number.isNaN(relevanceValue)) return null
        return {
            folder: typeof analysisResult.folder === "string" ? analysisResult.folder : "",
            tags: Array.isArray(analysisResult.tags) ? analysisResult.tags : [],
            importance: Number(analysisResult.importance) || 0,
            relevance: Math.max(0, Math.min(100, relevanceValue))
        }
    } catch (error) {
        console.error("AI error:", error)
        return null
    }
}
