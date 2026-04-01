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
          || canReadShared(resource.data, userId);

        allow create: if isOwner(userId)
          && hasAccessRoles(request.resource.data)
          && isValidOwnerPayload(userId);

        allow update: if isOwner(userId)
          || (
            canEditShared(resource.data, userId)
            && request.resource.data.ownerUid == resource.data.ownerUid
            && request.resource.data.access == resource.data.access
          );

        allow delete: if isOwner(userId)
          || canDeleteShared(resource.data, userId);
      }

      match /folders/{folderId} {
        allow read, write: if isOwner(userId);
      }

      match /preferences/{preferenceId} {
        allow read, write: if isOwner(userId);
      }

      match /sharedNotes/{entryId} {
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
