import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { DEFAULT_GITHUB_REPO } from "@/lib/repo";

function readVersion() {
  try {
    const p = path.join(process.cwd(), "version.json");
    return JSON.parse(fs.readFileSync(p, "utf8")) as {
      version: string;
      name?: string;
      notes?: string;
      updatedAt?: string;
    };
  } catch {
    return { version: "0.0.0" };
  }
}

function run(cmd: string) {
  return execSync(cmd, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function hasGit() {
  try {
    run("git --version");
    return true;
  } catch {
    return false;
  }
}

function hasRemote() {
  try {
    if (!fs.existsSync(path.join(process.cwd(), ".git"))) {
      run("git init -b main");
      run('git config user.email "pepsi@local"');
      run('git config user.name "Pepsi Distribution"');
    }
    const out = run("git remote get-url origin").trim();
    return Boolean(out);
  } catch {
    return false;
  }
}

export async function GET() {
  const local = readVersion();
  const info: Record<string, unknown> = {
    localVersion: local.version,
    notes: local.notes || "",
    updatedAt: local.updatedAt || "",
    gitInstalled: hasGit(),
    hasRemote: false,
    remoteUrl: "",
    status: "ok",
  };

  if (!info.gitInstalled) {
    info.status = "no_git";
    info.message = "Git is not installed. Install it from https://git-scm.com";
    return NextResponse.json(info);
  }

  if (!fs.existsSync(path.join(process.cwd(), ".git"))) {
    try {
      run("git init -b main");
      run('git config user.email "pepsi@local"');
      run('git config user.name "Pepsi Distribution"');
    } catch {
      info.status = "no_repo";
      info.message = "Could not initialize Git repo.";
      return NextResponse.json(info);
    }
  }

  info.hasRemote = hasRemote();
  if (!info.hasRemote) {
    try {
      run(`git remote add origin ${DEFAULT_GITHUB_REPO}`);
      info.hasRemote = true;
      info.remoteUrl = DEFAULT_GITHUB_REPO;
    } catch {
      info.status = "no_remote";
      info.message = `Set GitHub URL to ${DEFAULT_GITHUB_REPO}`;
      info.remoteUrl = DEFAULT_GITHUB_REPO;
      return NextResponse.json(info);
    }
  }

  try {
    info.remoteUrl = run("git remote get-url origin").trim();
    run("git fetch origin main");
    let localHash = "";
    try {
      localHash = run("git rev-parse HEAD").trim();
    } catch {
      info.status = "update_available";
      info.message = "Click Apply Updates to install the latest version.";
      return NextResponse.json(info);
    }
    const remoteHash = run("git rev-parse origin/main").trim();
    info.upToDate = localHash === remoteHash;
    info.status = localHash === remoteHash ? "up_to_date" : "update_available";
    info.message =
      localHash === remoteHash
        ? "You are on the latest version."
        : "A new update is available. Click Apply Updates.";
  } catch (e) {
    info.status = "error";
    info.message = String(e instanceof Error ? e.message : e);
  }

  return NextResponse.json(info);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "apply";

  if (action === "set_remote") {
    const url = String(body.url || "").trim();
    if (!url.includes("github.com") && !url.includes(".git")) {
      return NextResponse.json({ error: "Please enter a valid GitHub repo URL" }, { status: 400 });
    }
    try {
      if (!fs.existsSync(path.join(process.cwd(), ".git"))) {
        run("git init -b main");
        run('git config user.email "pepsi@local"');
        run('git config user.name "Pepsi Distribution"');
      }
      try {
        run(`git remote remove origin`);
      } catch {
        /* no origin yet */
      }
      run(`git remote add origin ${url}`);
      return NextResponse.json({ ok: true, message: "Remote URL saved", url });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (!hasGit()) {
    return NextResponse.json({ error: "Git is not installed" }, { status: 400 });
  }
  if (!hasRemote()) {
    return NextResponse.json(
      { error: "Set the GitHub remote first (Settings → Updates)" },
      { status: 400 }
    );
  }

  try {
    // Keep local data safe - never touch data/*.db (gitignored)
    const before = readVersion();
    let log = "";
    let hasHead = true;
    try {
      run("git rev-parse HEAD");
    } catch {
      hasHead = false;
    }
    if (hasHead) {
      try {
        log += run("git add -A");
        log += run("git stash push --include-untracked -m pepsi-auto-stash");
      } catch {
        log += "stash-skip\n";
      }
    } else {
      log += "no-commits - cleaning untracked files\n";
      try { run("git clean -fd -e data/"); } catch {}
    }
    log += "\n" + run("git pull --ff-only origin main");
    log += "\n" + run("npm install");
    log += "\n" + run("npm run build");
    const after = readVersion();

    return NextResponse.json({
      ok: true,
      message: `Updated: ${before.version} → ${after.version}. Close the app and open it again from the Desktop icon.`,
      from: before.version,
      to: after.version,
      log: log.slice(-2000),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Update failed: " + String(e instanceof Error ? e.message : e),
      },
      { status: 500 }
    );
  }
}
