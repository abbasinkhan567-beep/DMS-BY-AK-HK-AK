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

  if (/^git@github\.com[:/]/i.test(value)) {
    const normalized = value.replace(/^git@github\.com[:/]/i, "");
    const parts = normalized.replace(/\.git$/i, "").split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `https://github.com/${parts[0]}/${parts[1]}.git`;
    }
    return value;
  }

  if (/^ssh:\/\/git@github\.com\//i.test(value)) {
    const normalized = value.replace(/^ssh:\/\/git@github\.com\//i, "").replace(/\.git$/i, "");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `https://github.com/${parts[0]}/${parts[1]}.git`;
    }
    return value;
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

export function injectGitHubToken(url: string, token: string): string {
  const value = url.trim();
  if (!value || !token) return value;

  const normalized = normalizeGitHubRepoUrl(value);
  if (!isValidGitHubRepoUrl(normalized)) return value;

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname.toLowerCase() !== "github.com" && parsed.hostname.toLowerCase() !== "www.github.com") {
        return value;
      }
      parsed.username = token;
      parsed.password = "";
      return parsed.toString();
    } catch {
      return value;
    }
  }

  return normalized;
}
