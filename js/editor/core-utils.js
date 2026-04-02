export const getCountLabel = (count, singleKey, pluralKey) => {
    if (count === 1) return UI.getText(singleKey, singleKey)
    return UI.getText(pluralKey, UI.getText(singleKey, singleKey))
}
