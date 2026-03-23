const FoldersRepository = (() => {
    function subscribeFolders(user, next, error) {
        const collection = DataPath.getUserFoldersCollection(user)
        if (!collection) return () => {}
        return collection.onSnapshot(next, error)
    }
    function subscribeSharedEntries(user, next, error) {
        const collection = DataPath.getUserSharedCollection(user, "sharedFolders")
        if (!collection) return () => {}
        return collection.onSnapshot(next, error)
    }
    function subscribeSharedFolder(ownerUid, folderId, next, error) {
        return db.collection("users").doc(ownerUid).collection("folders").doc(folderId).onSnapshot(next, error)
    }
    return { subscribeFolders, subscribeSharedEntries, subscribeSharedFolder }
})()
