const SYNC_CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfycbxJbz08kyiltSfyQSfmeONr32dG7RgiZQAQAlETG_0vSkA7SoSbS4ZYQwp0nEBA2Dn1/exec",
  DEBOUNCE_MS: 3000,
  BATCH_LIMIT: 50000
};

const SyncService = {
  queue: new Map(),

  init() {
    if (!auth) return;
    auth.onAuthStateChanged(user => {
      if (user) this.listen(user);
    });
  },

  listen(user) {
    db.collection("users")
      .doc(user.uid)
      .collection("notes")
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          const id = change.doc.id;
          const data = change.doc.data();

          if (change.type === "removed") {
            this.schedule(id, this.buildPayload(id, data, user, true));
            return;
          }

          if (!data || data._isAiUpdating) return;
          if (!data.title && !data.content) return;

          this.schedule(id, this.buildPayload(id, data, user, false));
        });
      });
  },

  schedule(id, payload) {
    if (this.queue.has(id)) {
      clearTimeout(this.queue.get(id));
    }

    const timer = setTimeout(() => {
      this.send(payload);
      this.queue.delete(id);
    }, SYNC_CONFIG.DEBOUNCE_MS);

    this.queue.set(id, timer);
  },

  async send(payload) {
    try {
      await fetch(SYNC_CONFIG.ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
    } catch (e) {}
  },

  buildPayload(id, data, user, isDeleted) {
    const folderName =
      window.state?.folders?.find(f => f.id === data?.folderId)?.name ||
      "Общее";

    const cleanText = this.toPlainText(data?.content || "");
    const attachments = this.countAttachments(data?.content || "");

    return {
      noteId: id,
      email: user.email || "Anonymous",
      title: data?.title || "Без названия",
      content: cleanText.slice(0, SYNC_CONFIG.BATCH_LIMIT),
      tags: Array.isArray(data?.tags) ? data.tags.join(", ") : "",
      folder: folderName,
      isPinned: data?.isPinned ? "Да" : "Нет",
      isImportant: data?.isImportant ? "Да" : "Нет",
      isArchived: data?.isArchived ? "Да" : "Нет",
      isTrash: isDeleted ? "Да" : "Нет",
      attachments
    };
  },

  toPlainText(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || "").trim();
  },

  countAttachments(html) {
    const div = document.createElement("div");
    div.innerHTML = html;

    const imgs = div.querySelectorAll("img").length;
    const audio = div.querySelectorAll("audio").length;

    const list = [];
    if (imgs) list.push(imgs + " фото");
    if (audio) list.push(audio + " аудио");

    return list.length ? list.join(", ") : "Нет";
  }
};

SyncService.init();
