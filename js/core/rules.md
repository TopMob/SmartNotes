# Firebase Firestore Rules

Используй эти правила в Firebase Console:

1. Открой Firebase Console.
2. Перейди в **Firestore Database**.
3. Открой вкладку **Rules**.
4. Замени текущие правила на блок ниже.
5. Нажми **Publish**.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function hasAccessRoles(noteData) {
      return noteData.access is map
        && noteData.access.ownerUid is string
        && noteData.access.roles is map;
    }

    function requesterRole(noteData) {
      return noteData.access.roles[request.auth.uid];
    }

    function canReadShared(noteData, ownerId) {
      return isAuthenticated()
        && hasAccessRoles(noteData)
        && noteData.access.ownerUid == ownerId
        && request.auth.uid in noteData.access.roles;
    }

    function canEditShared(noteData, ownerId) {
      return canReadShared(noteData, ownerId)
        && requesterRole(noteData) in ['editor', 'owner'];
    }

    function canDeleteShared(noteData, ownerId) {
      return canReadShared(noteData, ownerId)
        && requesterRole(noteData) == 'owner';
    }

    function sharedNoteEntryId(ownerId, noteId) {
      return ownerId + '_' + noteId;
    }

    function sharedFolderEntryId(ownerId, folderId) {
      return ownerId + '_' + folderId;
    }

    function sharedNoteEntry(ownerId, noteId) {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)/sharedNotes/$(sharedNoteEntryId(ownerId, noteId)));
    }

    function sharedFolderEntry(ownerId, folderId) {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)/sharedFolders/$(sharedFolderEntryId(ownerId, folderId)));
    }

    function hasSharedNoteEntry(ownerId, noteId) {
      return isAuthenticated()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid)/sharedNotes/$(sharedNoteEntryId(ownerId, noteId)));
    }

    function hasSharedFolderEntry(ownerId, folderId) {
      return isAuthenticated()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid)/sharedFolders/$(sharedFolderEntryId(ownerId, folderId)));
    }

    function sharedNotePermission(ownerId, noteId) {
      return hasSharedNoteEntry(ownerId, noteId)
        ? sharedNoteEntry(ownerId, noteId).data.permission
        : '';
    }

    function sharedFolderPermission(ownerId, folderId) {
      return hasSharedFolderEntry(ownerId, folderId)
        ? sharedFolderEntry(ownerId, folderId).data.permission
        : '';
    }

    function canReadByShareEntry(ownerId, noteId, folderId) {
      return hasSharedNoteEntry(ownerId, noteId)
        || (folderId is string && folderId.size() > 0 && hasSharedFolderEntry(ownerId, folderId));
    }

    function canEditByShareEntry(ownerId, noteId, folderId) {
      return sharedNotePermission(ownerId, noteId) == 'editor'
        || (folderId is string && folderId.size() > 0 && sharedFolderPermission(ownerId, folderId) == 'editor');
    }

    function isValidOwnerPayload(ownerId) {
      return request.resource.data.ownerUid == ownerId
        && request.resource.data.access is map
        && request.resource.data.access.ownerUid == ownerId
        && request.resource.data.access.roles[ownerId] == 'owner';
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /notes/{noteId} {
        allow read: if isOwner(userId)
          || canReadShared(resource.data, userId)
          || canReadByShareEntry(userId, noteId, resource.data.folderId);

        allow create: if isOwner(userId)
          && hasAccessRoles(request.resource.data)
          && isValidOwnerPayload(userId);

        allow update: if isOwner(userId)
          || (
            canEditShared(resource.data, userId)
            && request.resource.data.ownerUid == resource.data.ownerUid
            && request.resource.data.access == resource.data.access
          )
          || (
            canEditByShareEntry(userId, noteId, resource.data.folderId)
            && request.resource.data.ownerUid == resource.data.ownerUid
            && request.resource.data.access == resource.data.access
          );

        allow delete: if isOwner(userId)
          || canDeleteShared(resource.data, userId);
      }

      match /folders/{folderId} {
        allow read: if isOwner(userId)
          || canReadShared(resource.data, userId)
          || hasSharedFolderEntry(userId, folderId);
        allow create: if isOwner(userId)
          && hasAccessRoles(request.resource.data)
          && isValidOwnerPayload(userId);
        allow update: if isOwner(userId);
        allow delete: if isOwner(userId);
      }

      function isValidThemePreferencePayload() {
        return request.resource.data.settings is map
          && request.resource.data.settings.preset is string
          && request.resource.data.settings.p is string
          && request.resource.data.settings.bg is string
          && request.resource.data.settings.t is string
          && request.resource.data.settings.mainBackgroundImage is string
          && request.resource.data.settings.mainBackgroundImage.size() <= 2048
          && request.resource.data.settings.sidebarBackgroundImage is string
          && request.resource.data.settings.sidebarBackgroundImage.size() <= 2048
          && request.resource.data.settings.uiOpacity is number
          && request.resource.data.settings.cardsOpacity is number
          && (!('customPresets' in request.resource.data) || request.resource.data.customPresets is list);
      }

      match /preferences/{preferenceId} {
        allow read: if isOwner(userId);
        allow create, update: if isOwner(userId)
          && (preferenceId != 'theme' || isValidThemePreferencePayload());
        allow delete: if isOwner(userId);
      }

      match /sharedNotes/{entryId} {
        allow read, create, delete: if isOwner(userId);
        allow update: if false;
      }

      match /sharedFolders/{entryId} {
        allow read, create, delete: if isOwner(userId);
        allow update: if false;
      }
    }

    match /noteShares/{token} {
      allow create: if isAuthenticated()
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.noteId is string
        && request.resource.data.permission in ['viewer', 'editor'];

      allow read: if isAuthenticated();
      allow update: if false;

      allow delete: if isAuthenticated()
        && resource.data.ownerUid == request.auth.uid;
    }

    match /folderShares/{token} {
      allow create: if isAuthenticated()
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.folderId is string
        && request.resource.data.permission in ['viewer', 'editor'];

      allow read: if isAuthenticated();
      allow update: if false;

      allow delete: if isAuthenticated()
        && resource.data.ownerUid == request.auth.uid;
    }

    match /feedback/{id} {
      allow create: if isAuthenticated();
      allow read, update, delete: if false;
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}

```
