export function buildDriveLinks(fileId) {
  return {
    webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: `https://drive.google.com/uc?id=${fileId}&export=download`,
    imageUrl: `https://lh3.googleusercontent.com/d/${fileId}=s0`
  }
}
