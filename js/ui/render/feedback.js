Object.assign(UI, {
    async submitFeedback() {
        if (!db || !StateStore.read().user) {
            this.showToast(this.getText("feedback_failed", "Unable to send feedback"))
            return
        }
        if (!StateStore.read().tempRating) {
            this.showToast(this.getText("rate_required", "Please rate first"))
            return
        }
        const text = String(document.getElementById("feedback-text")?.value || "")
        const { user, tempRating, config } = StateStore.read()
        const payload = {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            rating: tempRating,
            text: text.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent || "",
            appVersion: "web",
            language: config.lang
        }
        try {
            await db.collection("feedback").add(payload)
            StateActions.setTempRating(0)
            document.querySelectorAll(".star").forEach(s => {
                s.textContent = "star_border"
                s.classList.remove("active")
            })
            const feedbackInput = document.getElementById("feedback-text")
            if (feedbackInput) feedbackInput.value = ""
            this.showToast(this.getText("feedback_thanks", "Thanks!"))
            this.closeModal("rate-modal")
        } catch {
            this.showToast(this.getText("feedback_failed", "Unable to send feedback"))
        }
    },

    getSurveyQuestions() {
        return [
            { id: 1, text: this.getText("survey_q1", "What would you like to add") },
            { id: 2, text: this.getText("survey_q2", "What themes and colors do you like") },
            { id: 3, text: this.getText("survey_q3", "Dark or light theme") },
            { id: 4, text: this.getText("survey_q4", "What functionality is missing") },
            { id: 5, text: this.getText("survey_q5", "What would you change in the app") },
            { id: 6, text: this.getText("survey_q6", "How convenient is the interface") },
            { id: 7, text: this.getText("survey_q8", "Is it convenient to write and edit notes") },
            { id: 8, text: this.getText("survey_q9", "Is export and saving important") },
            { id: 9, text: this.getText("survey_q10", "What topics would you add visual presets for") }
        ]
    },

    startSurvey() {
        this.surveyState = {
            index: 0,
            mode: "question",
            answers: {}
        }
        this.renderSurveyStep()
    },

    renderSurveyStep() {
        const stepEl = document.getElementById("survey-step")
        const questionEl = document.getElementById("survey-question")
        const answerEl = document.getElementById("survey-answer")
        const decisionEl = document.getElementById("survey-decision")
        const nextButton = document.querySelector('[data-action="survey-next"]')
        const prevButton = document.querySelector('[data-action="survey-prev"]')
        const progressEl = document.getElementById("survey-progress")
        if (!stepEl || !questionEl || !answerEl || !decisionEl || !nextButton || !prevButton || !progressEl) return

        const questions = this.getSurveyQuestions()
        const total = questions.length
        const { index, mode, answers } = this.surveyState || { index: 0, mode: "question", answers: {} }
        const currentQuestion = questions[index]

        stepEl.textContent = `${index + 1}/${total}`
        progressEl.textContent = this.getText("survey_progress", "Survey")
        questionEl.textContent = currentQuestion ? currentQuestion.text : ""
        answerEl.value = answers[currentQuestion?.id] || ""
        answerEl.classList.toggle("hidden", mode === "decision")
        nextButton.classList.toggle("hidden", mode === "decision")
        decisionEl.classList.toggle("hidden", mode !== "decision")
        prevButton.classList.toggle("hidden", index === 0 && mode === "question")
    },

    storeSurveyAnswer() {
        const answerEl = document.getElementById("survey-answer")
        if (!answerEl) return false
        const value = String(answerEl.value || "").trim()
        if (!value) {
            this.showToast(this.getText("survey_required", "Please answer the question"))
            return false
        }
        const questions = this.getSurveyQuestions()
        const currentQuestion = questions[this.surveyState.index]
        this.surveyState.answers[currentQuestion.id] = value
        return true
    },

    advanceSurvey() {
        if (!this.surveyState || this.surveyState.mode !== "question") return
        const questions = this.getSurveyQuestions()
        const currentIndex = this.surveyState.index
        if (!this.storeSurveyAnswer()) return
        if (currentIndex === 4) {
            this.surveyState.mode = "decision"
            this.renderSurveyStep()
            return
        }
        if (currentIndex < questions.length - 1) {
            this.surveyState.index = currentIndex + 1
            this.renderSurveyStep()
        } else {
            this.finishSurvey()
        }
    },

    goBackSurvey() {
        if (!this.surveyState) return
        if (this.surveyState.mode === "decision") {
            this.surveyState.mode = "question"
            this.renderSurveyStep()
            return
        }
        if (this.surveyState.index > 0) {
            this.surveyState.index -= 1
            this.renderSurveyStep()
        }
    },

    continueSurvey() {
        if (!this.surveyState) return
        this.surveyState.mode = "question"
        this.surveyState.index = 5
        this.renderSurveyStep()
    },

    finishSurvey() {
        this.submitSurvey()
    },

    async submitSurvey() {
        if (!db || !StateStore.read().user) {
            this.showToast(this.getText("poll_failed", "Unable to send poll"))
            return
        }
        if (this.surveyState?.mode === "question") {
            if (!this.storeSurveyAnswer()) return
        }
        const { user, config } = StateStore.read()
        const answers = this.surveyState?.answers || {}
        const questions = this.getSurveyQuestions()
        const payloadAnswers = questions
            .map(question => ({
                id: question.id,
                question: question.text,
                answer: answers[question.id] || ""
            }))
            .filter(item => item.answer)
        try {
            await db.collection("feedback").add({
                uid: user.uid,
                email: user.email || "",
                displayName: user.displayName || "",
                answers: payloadAnswers,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent || "",
                appVersion: "web",
                language: config.lang,
                type: "survey"
            })
            this.showToast(this.getText("poll_thanks", "Thanks!"))
            this.closeModal("poll-modal")
        } catch {
            this.showToast(this.getText("poll_failed", "Unable to send poll"))
        }
    }
})
