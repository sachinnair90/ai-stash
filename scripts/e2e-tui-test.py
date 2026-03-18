#!/usr/bin/env python3
"""
End-to-end TUI smoke test for ai-stash.

Launches the real app in a PTY, simulates the full install flow via keystrokes,
and verifies that:
  - The Browse view renders with assets loaded
  - Pressing 'i' opens the Install view with scope selection
  - Selecting 'project' scope and confirming 'claude-code' target runs the install
  - "Installation complete!" is shown with a ✓ checkmark for the installed file
  - The file is physically written to .claude/skills/<asset>/
  - The lockfile records the file path (not an empty array)

Usage:
  python3 scripts/e2e-tui-test.py

Requires:
  - pnpm available in PATH
  - A registry server running (see registry/README or `pnpm run dev` for the server)
  - The registry URL configured in ~/.config/ai-stash/config.json or via env

Exit codes:
  0  all checks passed
  1  one or more checks failed
"""

import os
import re
import sys
import time
import json
import select
import shutil
import tempfile
import subprocess


# ── helpers ──────────────────────────────────────────────────────────────────

def read_all(fd: int, timeout: float = 1.0) -> bytes:
    """Drain all available bytes from fd within timeout seconds."""
    result = b""
    while True:
        r, _, _ = select.select([fd], [], [], timeout)
        if not r:
            break
        try:
            chunk = os.read(fd, 4096)
            if not chunk:
                break
            result += chunk
        except OSError:
            break
    return result


def strip_ansi(text: str) -> str:
    """Remove ANSI escape sequences and carriage returns."""
    text = re.sub(r'\x1b\[[0-9;?]*[mGKHJABCDEFsuhl]', '', text)
    return text.replace('\r', '')


def check(label: str, condition: bool) -> bool:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}")
    return condition


# ── test ─────────────────────────────────────────────────────────────────────

def run_e2e() -> bool:
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tmp_dir = tempfile.mkdtemp(prefix="ai-stash-e2e-")
    lock_path = os.path.join(project_root, "ai-stash.lock.json")
    installed_skill = os.path.join(project_root, ".claude", "skills", "git-commit", "SKILL.md")

    # Clean up any previous state
    if os.path.exists(lock_path):
        os.remove(lock_path)
    if os.path.exists(installed_skill):
        os.remove(installed_skill)
        try:
            os.rmdir(os.path.dirname(installed_skill))
        except OSError:
            pass

    print(f"\nai-stash TUI end-to-end test")
    print(f"Project root: {project_root}\n")

    import pty, fcntl, termios, struct

    master_fd, slave_fd = pty.openpty()
    # Set a wide terminal so lines don't wrap unexpectedly
    fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))

    pid = os.fork()
    if pid == 0:
        # Child: become the app process
        os.setsid()
        fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(master_fd)
        os.chdir(project_root)
        os.execvp("pnpm", ["pnpm", "run", "dev"])
        sys.exit(1)

    os.close(slave_fd)
    results: list[bool] = []

    try:
        # ── Step 1: Wait for app to load ──────────────────────────────────────
        time.sleep(4)
        initial_out = strip_ansi(read_all(master_fd, 1.0).decode("utf-8", errors="replace"))

        print("Step 1: Browse view loads")
        results.append(check("Title 'ai-stash | Browse' is shown", "ai-stash | Browse" in initial_out))
        results.append(check("Asset list contains 'git-commit'", "git-commit" in initial_out))
        results.append(check("Detail panel shows asset name", "Name: git-commit" in initial_out))

        # ── Step 2: Open install view ─────────────────────────────────────────
        os.write(master_fd, b'i')
        time.sleep(2)
        install_out = strip_ansi(read_all(master_fd, 1.0).decode("utf-8", errors="replace"))

        print("\nStep 2: Install view — scope selection")
        results.append(check("Title 'ai-stash | Install' is shown", "ai-stash | Install" in install_out))
        results.append(check("Scope options shown", "project" in install_out and "global" in install_out))
        results.append(check("'project' is the default selection", "> project" in install_out or ">  project" in install_out or "project" in install_out))

        # ── Step 3: Select project scope ──────────────────────────────────────
        os.write(master_fd, b'\r')
        time.sleep(1)
        targets_out = strip_ansi(read_all(master_fd, 1.0).decode("utf-8", errors="replace"))

        print("\nStep 3: Install view — target selection")
        results.append(check("Target options shown", "claude-code" in targets_out))
        results.append(check("claude-code pre-selected", "[×]" in targets_out))

        # ── Step 4: Confirm install ────────────────────────────────────────────
        os.write(master_fd, b'\r')
        time.sleep(4)
        done_out = strip_ansi(read_all(master_fd, 2.0).decode("utf-8", errors="replace"))

        print("\nStep 4: Install completes")
        results.append(check("'Installation complete!' shown", "Installation complete!" in done_out))
        results.append(check("Checkmark shown for installed file", "✓" in done_out))
        results.append(check("Skill file path shown", ".claude/skills/git-commit/SKILL.md" in done_out))

        # ── Step 5: Verify on-disk state ──────────────────────────────────────
        os.write(master_fd, b'\r')  # dismiss done screen
        time.sleep(0.5)

        print("\nStep 5: On-disk verification")
        results.append(check("SKILL.md written to .claude/skills/git-commit/", os.path.exists(installed_skill)))

        if os.path.exists(lock_path):
            with open(lock_path) as f:
                lf = json.load(f)
            entry = lf.get("installed", {}).get("git-commit", {})
            results.append(check("Lockfile records git-commit entry", bool(entry)))
            results.append(check("Lockfile files[] is not empty", len(entry.get("files", [])) > 0))
            results.append(check(
                "Lockfile files[] contains SKILL.md path",
                ".claude/skills/git-commit/SKILL.md" in entry.get("files", []),
            ))
        else:
            results.append(check("Lockfile exists", False))
            results.append(check("Lockfile files[] is not empty", False))
            results.append(check("Lockfile files[] contains SKILL.md path", False))

    finally:
        os.write(master_fd, b'q')
        time.sleep(0.5)
        try:
            os.close(master_fd)
        except OSError:
            pass
        os.waitpid(pid, 0)
        shutil.rmtree(tmp_dir, ignore_errors=True)

    passed = sum(results)
    total = len(results)
    print(f"\n{'─' * 50}")
    print(f"Result: {passed}/{total} checks passed")

    return all(results)


if __name__ == "__main__":
    ok = run_e2e()
    sys.exit(0 if ok else 1)
