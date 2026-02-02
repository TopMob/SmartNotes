;(() => {
  if (window.UsageSurvey) return

  const ID = "usage-v1"

  const shouldShow = () => !localStorage.getItem(`survey:${ID}`)

  const submit = (answers) => {
    localStorage.setItem(`survey:${ID}`, JSON.stringify(answers))
    if (window.db && state.user) {
      db.collection("surveys").add({
        user: state.user.uid,
        answers,
        ts: Date.now()
      }).catch(() => 0)
    }
  }

  window.UsageSurvey = { shouldShow, submit }
})()
