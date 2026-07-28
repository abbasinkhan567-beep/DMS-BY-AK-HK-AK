import test from "node:test";
import assert from "node:assert/strict";
import { isValidGitHubRepoUrl, normalizeGitHubRepoUrl } from "./github-url";

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
