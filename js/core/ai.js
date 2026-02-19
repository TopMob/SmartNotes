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

        return await response.json()
    } catch (error) {
        console.error("AI error:", error)
        return null
    }
}
