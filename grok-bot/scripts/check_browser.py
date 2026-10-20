#!/usr/bin/env python3
"""Isolated browser integration checks; run `npm run build` first.

Requires Python Playwright and Chromium (/usr/bin/chromium by default).
The helper starts two production-style servers with temporary SQLite storage.
Its configured AI provider is an injected local fixture; it sends no AI traffic.
"""

import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import traceback
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence"
BASE = "http://127.0.0.1:4181"
MISSING = "http://127.0.0.1:4182"
FIXTURE_OUTPUT = "Browser integration fixture: useful saved task output."
RESULTS = {"provider": "injected local fixture; no external AI requests", "checks": [], "screenshots": []}
_REDACT_VALUES = []


def redact(message):
    text = str(message)
    for value in _REDACT_VALUES:
        text = text.replace(value, "[redacted]")
    return text


def check(name, operation):
    started = time.monotonic()
    try:
        operation()
        RESULTS["checks"].append({"name": name, "status": "passed", "seconds": round(time.monotonic() - started, 2)})
        print(f"PASS {name}", flush=True)
    except Exception as error:
        safe_error = redact(str(error) or f"{type(error).__name__} at {traceback.extract_tb(error.__traceback__)[-1].filename}:{traceback.extract_tb(error.__traceback__)[-1].lineno}")
        RESULTS["checks"].append({"name": name, "status": "failed", "error": safe_error, "seconds": round(time.monotonic() - started, 2)})
        print(f"FAIL {name}: {safe_error}", flush=True)
        raise RuntimeError(safe_error) from None


def screenshot(page, name):
    page.screenshot(path=str(EVIDENCE / name), full_page=True, animations="disabled")
    RESULTS["screenshots"].append(name)


def no_overflow(page):
    dimensions = page.evaluate("({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth })")
    assert dimensions["content"] <= dimensions["viewport"] + 1, dimensions


def start_fixture(password):
    if not (ROOT / "dist" / "index.html").exists():
        raise RuntimeError("Frontend not built. Run npm run build before this check.")
    for base in (BASE, MISSING):
        try:
            urlopen(f"{base}/healthz", timeout=0.3)
        except HTTPError:
            raise RuntimeError(f"Port already occupied at {base}; refusing to modify an unknown server.")
        except (URLError, TimeoutError):
            pass
        else:
            raise RuntimeError(f"Port already occupied at {base}; refusing to modify an unknown server.")
    log = tempfile.TemporaryFile(mode="w+t")
    process = subprocess.Popen(["node", "tests/browser-fixture.mjs"], cwd=ROOT, env={**os.environ, "APP_PASSWORD": password}, stdout=log, stderr=subprocess.STDOUT)
    for _ in range(100):
        if process.poll() is not None:
            log.seek(0)
            raise RuntimeError(redact(log.read()))
        try:
            with urlopen(f"{MISSING}/healthz", timeout=0.2) as response:
                if response.status == 200:
                    return process, log
        except (URLError, TimeoutError):
            time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Browser fixture did not start within 10 seconds.")


def main():
    EVIDENCE.mkdir(exist_ok=True)
    password = secrets.token_urlsafe(32)
    _REDACT_VALUES.append(password)
    process, log = start_fixture(password)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox", "--disable-dev-shm-usage"])
            try:
                run_checks(browser, password)
            finally:
                browser.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()
        RESULTS["passed"] = bool(RESULTS["checks"]) and all(item["status"] == "passed" for item in RESULTS["checks"])
        (EVIDENCE / "browser-results.json").write_text(json.dumps(RESULTS, indent=2) + "\n")


def run_checks(browser, password):
    errors = []
    context = browser.new_context(viewport={"width": 1440, "height": 1080}, timezone_id="Asia/Kolkata", permissions=["clipboard-read", "clipboard-write"], accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(15_000)
    page.on("pageerror", lambda error: errors.append(str(error)))

    def attach_console_errors(current_page):
        current_page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

    def sign_in(base):
        page.locator('input[name="password"]').fill(password)
        page.get_by_role("button", name="Sign in", exact=True).click()
        page.wait_for_url(f"{base}/", wait_until="networkidle")
        expect(page.locator("#composer")).to_be_visible()

    def password_login():
        page.goto(MISSING, wait_until="networkidle")
        page.wait_for_url(f"{MISSING}/login")
        expect(page.locator('input[name="password"]')).to_be_visible()
        expect(page.locator('input[name="password"]')).to_have_attribute("type", "password")
        expect(page.locator("#composer")).to_have_count(0)
        response = page.request.get(f"{MISSING}/api/tasks")
        assert response.status == 401, f"Unauthenticated task API returned {response.status}."
        assert "tasks" not in response.json()
        assert page.request.get(f"{MISSING}/healthz").status == 200
        no_overflow(page)
        screenshot(page, "login-desktop.png")
        page.set_viewport_size({"width": 390, "height": 844})
        no_overflow(page)
        screenshot(page, "login-mobile.png")
        page.locator('input[name="password"]').fill(secrets.token_urlsafe(32))
        with page.expect_response(lambda item: item.url.endswith("/login") and item.request.method == "POST") as failed_login:
            page.get_by_role("button", name="Sign in", exact=True).click()
        assert failed_login.value.status == 401, f"Wrong-password response returned {failed_login.value.status}; Origin={failed_login.value.request.header_value('origin')}, Sec-Fetch-Site={failed_login.value.request.header_value('sec-fetch-site')}."
        expect(page.locator('input[name="password"]')).to_be_visible()
        page.wait_for_load_state("networkidle")
        assert page.request.get(f"{MISSING}/api/tasks").status == 401
        attach_console_errors(page)
        sign_in(MISSING)
        assert page.request.get(f"{MISSING}/api/tasks").status == 200
        cookies = context.cookies(MISSING)
        assert cookies and all(cookie["httpOnly"] and cookie["sameSite"] == "Strict" for cookie in cookies), "Expected an HttpOnly SameSite=Strict session cookie."
        page.set_viewport_size({"width": 1440, "height": 1080})

    check("Password login protects HTML/API, rejects wrong password and works on mobile", password_login)

    def navigate(view):
        link = page.locator(f'.nav-link[data-view="{view}"]')
        menu = page.get_by_role("button", name="Open navigation", exact=True)
        if menu.is_visible() and "nav-open" not in (page.locator("body").get_attribute("class") or ""):
            menu.click()
        link.click()
        expect(page.locator(f"#{view}-view")).to_be_visible()

    def create(title, prompt, schedule="once", first_run=None):
        page.get_by_role("textbox", name="What would you like Orbit to do?", exact=True).fill(prompt)
        page.locator("#task-title").fill(title)
        page.get_by_label("Task schedule", exact=True).select_option(schedule)
        if first_run:
            page.get_by_role("button", name="Choose start time", exact=True).click()
            page.locator("#task-date").fill(first_run)
        page.get_by_role("button", name="Save task", exact=True).click()
        expect(page.get_by_role("button", name=f"Edit {title}", exact=True)).to_be_visible()

    def edit(title):
        trigger = page.get_by_role("button", name=f"Edit {title}", exact=True)
        trigger.click()
        expect(page.locator("#task-dialog")).to_be_visible()
        return page.locator("#task-dialog")

    def initial_empty():
        page.goto(MISSING, wait_until="networkidle")
        expect(page.get_by_role("heading", name="Your next free hour starts here", exact=True)).to_be_visible()
        expect(page.locator(".task-row")).to_have_count(0)
        assert page.request.get(f"{MISSING}/api/tasks").json()["tasks"] == []
        no_overflow(page)
        screenshot(page, "empty-desktop.png")
        page.set_viewport_size({"width": 390, "height": 844})
        no_overflow(page)
        screenshot(page, "empty-mobile.png")
        navigate("settings")
        expect(page.get_by_role("heading", name="Workspace settings.", exact=True)).to_be_visible()
        no_overflow(page)
        navigate("tasks")
        page.get_by_role("button", name="Open navigation", exact=True).click()
        expect(page.locator("body")).to_have_class("nav-open")
        page.keyboard.press("Escape")
        expect(page.locator("body")).not_to_have_class("nav-open")
        page.set_viewport_size({"width": 1440, "height": 1080})

    check("Empty workspace, desktop/mobile layout and navigation", initial_empty)

    hostile_title = 'Draft <img src=x onerror=window.__orbitInjected=true>'
    hostile_prompt = 'Prepare a practical weekly plan.\n<script>window.__orbitInjected=true</script>'

    def save_and_filter():
        create(hostile_title, hostile_prompt)
        assert page.evaluate("window.__orbitInjected !== true")
        expect(page.locator("#task-list img, #task-list script")).to_have_count(0)
        create("Daily writing prompt", "Write one useful reflection prompt.", "daily", "2030-01-01T09:00")
        expect(page.locator(".task-row")).to_have_count(2)
        page.get_by_role("button", name="Scheduled", exact=True).click()
        expect(page.locator(".task-row")).to_have_count(1)
        expect(page.get_by_role("button", name="Edit Daily writing prompt", exact=True)).to_be_visible()
        page.get_by_role("button", name="Paused", exact=True).click()
        expect(page.locator(".task-row")).to_have_count(0)
        expect(page.get_by_role("heading", name="Nothing here just yet", exact=True)).to_be_visible()
        page.get_by_role("button", name="All tasks", exact=True).click()
        page.get_by_label("Search tasks", exact=True).fill("reflection")
        expect(page.locator(".task-row")).to_have_count(1)
        page.get_by_label("Search tasks", exact=True).fill("missing query")
        expect(page.locator(".task-row")).to_have_count(0)
        page.get_by_role("button", name="Clear filters", exact=True).click()
        expect(page.locator(".task-row")).to_have_count(2)
        page.reload(wait_until="networkidle")
        expect(page.locator(".task-row")).to_have_count(2)
        expect(page.get_by_role("button", name=f"Edit {hostile_title}", exact=True)).to_be_visible()
        assert len(page.request.get(f"{MISSING}/api/tasks").json()["tasks"]) == 2
        assert page.evaluate("window.__orbitInjected !== true")

    check("Save manual/recurring tasks, filter/search, SQLite persistence and HTML safety", save_and_filter)

    def edit_pause_and_keyboard():
        dialog = edit(hostile_title)
        expect(dialog.get_by_label("Task name", exact=True)).to_have_value(hostile_title)
        expect(dialog.get_by_label("Instructions", exact=True)).to_have_value(hostile_prompt)
        assert page.evaluate("document.querySelector('#task-dialog').contains(document.activeElement)")
        for _ in range(14):
            page.keyboard.press("Tab")
            assert page.evaluate("document.querySelector('#task-dialog').contains(document.activeElement)")
        focused_id = page.evaluate("document.activeElement.id")
        with page.expect_response(lambda response: response.url.endswith("/api/status") and response.request.method == "GET", timeout=10_000):
            pass
        assert page.evaluate("document.activeElement.id") == focused_id
        expect(dialog.get_by_label("Instructions", exact=True)).to_have_value(hostile_prompt)
        page.keyboard.press("Escape")
        expect(dialog).not_to_be_visible()
        expect(page.get_by_role("button", name=f"Edit {hostile_title}", exact=True)).to_be_focused()
        dialog = edit(hostile_title)
        dialog.get_by_label("Task name", exact=True).fill("Weekly planning notes")
        dialog.get_by_label("Instructions", exact=True).fill("Prepare a practical weekly planning checklist.")
        dialog.get_by_role("button", name="Save changes", exact=False).click()
        expect(dialog).not_to_be_visible()
        expect(page.get_by_role("button", name="Edit Weekly planning notes", exact=True)).to_be_visible()
        dialog = edit("Daily writing prompt")
        dialog.get_by_label("Task name", exact=True).fill("Weekly inspiration")
        dialog.get_by_label("Schedule", exact=True).select_option("weekly")
        dialog.locator("#edit-enabled").uncheck()
        dialog.get_by_role("button", name="Save changes", exact=False).click()
        expect(dialog).not_to_be_visible()
        page.get_by_role("button", name="Paused", exact=True).click()
        expect(page.locator(".task-row")).to_have_count(1)
        expect(page.get_by_role("button", name="Edit Weekly inspiration", exact=True)).to_be_visible()
        page.reload(wait_until="networkidle")
        dialog = edit("Weekly inspiration")
        expect(dialog.get_by_label("Schedule", exact=True)).to_have_value("weekly")
        expect(dialog.locator("#edit-enabled")).not_to_be_checked()
        dialog.locator("#edit-enabled").check()
        dialog.get_by_role("button", name="Save changes", exact=False).click()
        expect(dialog).not_to_be_visible()
        page.get_by_role("button", name="Scheduled", exact=True).click()
        expect(page.locator(".task-row")).to_have_count(1)
        expect(page.locator(".schedule-label")).to_contain_text("Every week")
        page.get_by_role("button", name="All tasks", exact=True).click()
        no_overflow(page)
        screenshot(page, "saved-tasks-desktop.png")

    check("Task details, edit, pause/resume, reschedule, keyboard trap/Escape/focus", edit_pause_and_keyboard)

    def missing_key_run():
        page.get_by_role("button", name="Run Weekly planning notes now", exact=True).click()
        expect(page.locator("#result-dialog")).to_be_visible()
        expect(page.locator(".result-error")).to_be_visible(timeout=15_000)
        expect(page.locator(".result-error")).to_contain_text("AI_API_KEY, AI_BASE_URL, and AI_MODEL")
        assert page.request.get(f"{MISSING}/api/runs").json()["runs"][0]["status"] == "failed"
        page.get_by_role("button", name="Close result", exact=True).click()
        navigate("history")
        expect(page.locator(".history-row")).to_have_count(1)
        expect(page.locator(".history-row")).to_contain_text("Failed")
        page.locator(".history-row").click()
        expect(page.locator(".result-error")).to_contain_text("AI_API_KEY, AI_BASE_URL, and AI_MODEL")
        page.keyboard.press("Escape")
        expect(page.locator("#result-dialog")).not_to_be_visible()
        navigate("tasks")

    check("Unconfigured Run now records saved actionable failure and history/detail", missing_key_run)

    def delete_confirmation():
        dialog = edit("Weekly inspiration")
        dialog.get_by_role("button", name="Delete task", exact=True).click()
        expect(dialog.locator("#delete-confirm")).to_be_visible()
        dialog.get_by_role("button", name="Keep task", exact=True).click()
        expect(dialog.locator("#delete-confirm")).not_to_be_visible()
        assert len(page.request.get(f"{MISSING}/api/tasks").json()["tasks"]) == 2
        dialog.get_by_role("button", name="Delete task", exact=True).click()
        dialog.locator("#delete-confirm").get_by_role("button", name="Delete task", exact=True).click()
        expect(dialog).not_to_be_visible()
        expect(page.locator(".task-row")).to_have_count(1)
        page.reload(wait_until="networkidle")
        expect(page.locator(".task-row")).to_have_count(1)
        assert len(page.request.get(f"{MISSING}/api/runs").json()["runs"]) == 1

    check("Delete confirmation supports cancellation and persists deletion", delete_confirmation)

    def settings_and_mobile():
        navigate("settings")
        expect(page.get_by_text("Setup needed", exact=True)).to_be_visible()
        expect(page.get_by_text("AI_API_KEY", exact=True)).to_be_visible()
        expect(page.get_by_text("Always on, while your server is running", exact=True)).to_be_visible()
        expect(page.get_by_text("AI writing and reasoning", exact=True)).to_be_visible()
        page.get_by_role("button", name="Check configuration", exact=False).click()
        expect(page.locator("#toast")).to_contain_text("Provider still needs setup")
        no_overflow(page)
        page.set_viewport_size({"width": 390, "height": 844})
        no_overflow(page)
        navigate("tasks")
        create("Mobile task", "Write a short plan from a mobile device.")
        dialog = edit("Mobile task")
        no_overflow(page)
        assert dialog.evaluate("el => el.scrollWidth <= el.clientWidth + 1")
        page.keyboard.press("Escape")
        expect(dialog).not_to_be_visible()
        page.get_by_label("Search tasks", exact=True).fill("Mobile task")
        expect(page.locator(".task-row")).to_have_count(1)
        expect(page.get_by_role("button", name="Run Mobile task now", exact=True).locator(".icon")).to_be_visible()
        no_overflow(page)
        expect(page.locator("#toast")).not_to_be_visible()
        screenshot(page, "saved-tasks-mobile.png")
        page.get_by_label("Search tasks", exact=True).fill("")
        navigate("history")
        no_overflow(page)
        navigate("settings")
        no_overflow(page)

    check("Settings communicates real capabilities and mobile task/edit/search flows fit", settings_and_mobile)

    def provider_output():
        nonlocal page, context
        context.close()
        context = browser.new_context(viewport={"width": 1440, "height": 1080}, timezone_id="Asia/Kolkata", permissions=["clipboard-read", "clipboard-write"], accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(15_000)
        page.on("pageerror", lambda error: errors.append(str(error)))
        attach_console_errors(page)
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_url(f"{BASE}/login")
        sign_in(BASE)
        expect(page.locator(".task-row")).to_have_count(0)
        expect(page.locator("#provider-notice")).not_to_be_visible()
        create("Saved provider result", "Generate output using the isolated browser fixture.")
        page.get_by_role("button", name="Run Saved provider result now", exact=True).click()
        expect(page.locator("#result-dialog")).to_be_visible()
        expect(page.locator(".result-text")).to_contain_text(FIXTURE_OUTPUT, timeout=15_000)
        expect(page.locator("#result-body .status-badge")).to_contain_text("Completed")
        output = page.locator(".result-text").inner_text()
        page.get_by_role("button", name="Copy", exact=True).click()
        expect(page.locator("#toast")).to_contain_text("Result copied")
        assert page.evaluate("navigator.clipboard.readText()") == output
        with page.expect_download() as download_info:
            page.get_by_role("button", name="Download", exact=True).click()
        download = download_info.value
        assert download.suggested_filename == "Saved provider result.txt"
        assert Path(download.path()).read_text() == output
        screenshot(page, "fixture-output-desktop.png")
        page.get_by_role("button", name="Close result", exact=True).click()
        page.reload(wait_until="networkidle")
        navigate("history")
        expect(page.locator(".history-row")).to_have_count(1)
        expect(page.locator(".history-row")).to_contain_text("Completed")
        page.locator(".history-row").click()
        expect(page.locator(".result-text")).to_have_text(output)
        page.set_viewport_size({"width": 390, "height": 844})
        no_overflow(page)
        assert page.locator("#result-dialog").evaluate("el => el.scrollWidth <= el.clientWidth + 1")
        page.keyboard.press("Escape")
        no_overflow(page)
        navigate("settings")
        expect(page.get_by_text("Configured", exact=True)).to_be_visible()
        expect(page.get_by_text("browser-fixture-model", exact=True)).to_be_visible()
        assert "browser-fixture-key-not-real" not in page.locator("body").inner_text()

    check("Local provider integration saves real fixture output with copy/download/history", provider_output)

    def logout_locks_workspace():
        button = page.locator('[data-action="logout"]')
        if not button.is_visible():
            page.get_by_role("button", name="Open navigation", exact=True).click()
        button.click()
        page.wait_for_url(f"{BASE}/login", wait_until="networkidle")
        expect(page.locator('input[name="password"]')).to_be_visible()
        expect(page.locator("#composer")).to_have_count(0)
        assert page.request.get(f"{BASE}/api/tasks").status == 401
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_url(f"{BASE}/login")
        sign_in(BASE)
        assert len(page.request.get(f"{BASE}/api/tasks").json()["tasks"]) == 1

    check("Logout locks HTML/API and signing in preserves saved tasks", logout_locks_workspace)

    def browser_errors():
        assert not errors, errors
    check("No browser console errors or uncaught exceptions", browser_errors)
    context.close()


if __name__ == "__main__":
    main()
