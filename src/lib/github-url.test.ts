import test from "node:test";
import assert from "node:assert/strict";
import { injectGitHubToken, isValidGitHubRepoUrl, normalizeGitHubRepoUrl } from "./github-url";

test("accepts HTTPS GitHub repo URLs", () => {
  assert.equal(isValidGitHubRepoUrl("https://github.com/owner/repo.git"), true);
  assert.equal(normalizeGitHubRepoUrl("https://github.com/owner/repo.git"), "https://github.com/owner/repo.git");
});

test("accepts SSH GitHub repo URLs and normalizes them", () => {
  assert.equal(isValidGitHubRepoUrl("git@github.com:owner/repo.git"), true);
  assert.equal(normalizeGitHubRepoUrl("git@github.com:owner/repo.git"), "https://github.com/owner/repo.git");
});

test("rejects invalid non-GitHub URLs", () => {
  assert.equal(isValidGitHubRepoUrl("https://example.com/owner/repo"), false);
  assert.equal(normalizeGitHubRepoUrl("https://example.com/owner/repo"), "https://example.com/owner/repo");
});

test("injects tokens into GitHub remotes for SSH and HTTPS URLs", () => {
  assert.equal(injectGitHubToken("git@github.com:owner/repo.git", "abc123"), "https://abc123@github.com/owner/repo.git");
  assert.equal(injectGitHubToken("https://github.com/owner/repo.git", "abc123"), "https://abc123@github.com/owner/repo.git");
  assert.equal(injectGitHubToken("https://example.com/owner/repo", "abc123"), "https://example.com/owner/repo");
});
