const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.substring(pathname.lastIndexOf(".")).toLowerCase();
    return ext;
  } catch {
    const ext = url.substring(url.lastIndexOf(".")).toLowerCase();
    return ext;
  }
}

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.includes(getExtension(url));
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.includes(getExtension(url));
}
