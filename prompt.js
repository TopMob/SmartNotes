export function buildPrompt(folders, notesChunk) {
    const normalizedFolders = Array.isArray(folders)
        ? folders
            .map(folder => ({
                id: String(folder?.id || "").trim(),
                name: String(folder?.name || "").trim()
            }))
            .filter(folder => folder.id && folder.name)
        : []

    const normalizedNotes = Array.isArray(notesChunk)
        ? notesChunk
            .map(note => ({
                id: String(note?.id || "").trim(),
                title: String(note?.title || "").trim(),
                text: String(note?.text || "").trim(),
                hasFolder: !!note?.hasFolder
            }))
            .filter(note => note.id && note.text)
        : []

    const payload = {
        folders: normalizedFolders,
        notes: normalizedNotes,
        instructions: {
            outputFormat: "json_array",
            itemSchema: {
                id: "string",
                folderId: "string",
                relevance: "integer_0_100",
                userTags: ["string"],
                hiddenTags: ["string"]
            },
            constraints: [
                "Respond only with JSON array",
                "Each note must have exactly one object in response",
                "Use only provided folder ids for folderId",
                "Keep userTags concise and human readable",
                "Use hiddenTags for technical or secondary classification"
            ]
        }
    }

    return JSON.stringify(payload)
}
