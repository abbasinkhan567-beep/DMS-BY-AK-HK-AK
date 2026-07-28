export function isValidGitHubRepoUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;

  if (/^git@github\.com[:/]/i.test(value)) {
    const normalized = value.replace(/^git@github\.com[:/]/i, "");
    const parts = normalized.replace(/\.git$/i, "").split("/").filter(Boolean);
    return parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0;
  }

  if (!/^https?:\/\//i.test(value)) return false;

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return false;

    const segments = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    return segments.length >= 2 && segments[0].length > 0 && segments[1].length > 0;
  } catch {
    return false;
  }
}

export function normalizeGitHubRepoUrl(url: string): string {
  const value = url.trim();
  if (!value) return "";

  if (/^git@github\.com:/i.test(value)) {
    return `https://github.com/${value.replace(/^git@github\.com:/i, "").replace(/\.git$/i, "")}.git`;
  }

  if (/^ssh:\/\/git@github\.com\//i.test(value)) {
    return `https://github.com/${value.replace(/^ssh:\/\/git@github\.com\//i, "").replace(/\.git$/i, "")}.git`;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (host !== "github.com" && host !== "www.github.com") return value;
      const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
      const segments = path.split("/").filter(Boolean);
      if (segments.length < 2) return value;
      return `https://github.com/${segments[0]}/${segments[1].replace(/\.git$/i, "")}.git`;
    } catch {
      return value;
    }
  }

  return value;
}
