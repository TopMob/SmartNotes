;(() => {
  if (window.SmartSearch) return

  const norm = (s) => s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "")

  const score = (q, text) => {
    if (!q || !text) return 0
    q = norm(q)
    text = norm(text)
    if (!q || !text) return 0
    if (text.includes(q)) return q.length * 3
    let hit = 0
    for (let i = 0; i < q.length; i++) {
      if (text.includes(q[i])) hit++
    }
    return hit
  }

  const filter = (notes, query) => {
    if (!query) return notes
    return notes
      .map((n) => ({
        note: n,
        score:
          score(query, n.title || "") +
          score(query, n.content || "")
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.note)
  }

  window.SmartSearch = { filter }
})()
