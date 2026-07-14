import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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
    info.status = "no_repo";
    info.message = "This folder is not a Git repository. Ask the developer to set up GitHub first.";
    return NextResponse.json(info);
  }

  info.hasRemote = hasRemote();
  if (!info.hasRemote) {
    info.status = "no_remote";
    info.message = "GitHub remote is not set. Developer should run PUBLISH-UPDATE.bat first.";
    return NextResponse.json(info);
  }

  try {
    info.remoteUrl = run("git remote get-url origin").trim();
    run("git fetch origin main");
    const localHash = run("git rev-parse HEAD").trim();
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
        run("git init");
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
    try {
      log += run("git stash push -m pepsi-auto-stash");
    } catch {
      log += "stash-skip\n";
    }
    log += "\n" + run("git pull origin main");
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
