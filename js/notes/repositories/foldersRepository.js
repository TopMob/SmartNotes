const FoldersRepository = (() => {
    function subscribeFolders(user, next, error) {
        const collection = DataPath.getUserFoldersCollection(user)
        if (!collection) return () => {}
        return collection.onSnapshot(next, error)
    }
    return { subscribeFolders }
})()
