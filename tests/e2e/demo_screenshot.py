#!/usr/bin/env python3
"""
End-to-end smoke test for the OAGF frontend.

Starts the main app dev server with the mock backend, opens it in Chromium via
Selenium, takes screenshots of the login and dashboard pages, and uses Pillow
to verify the pages rendered something meaningful.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[2]
SCREENSHOT_DIR = ROOT / "tests" / "e2e" / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def find_free_port() -> int:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def port_is_open(port: int) -> bool:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def start_dev_server(port: int) -> subprocess.Popen:
    env = os.environ.copy()
    # Mock mode lets the frontend run in a browser without the Tauri backend.
    env["VITE_USE_MOCK_TAURI"] = "true"
    proc = subprocess.Popen(
        ["npx", "vite", "--config", "apps/main/vite.config.ts", "--port", str(port), "--strictPort"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    return proc


def wait_for_server(port: int, timeout: int = 60) -> bool:
    for _ in range(timeout):
        if port_is_open(port):
            return True
        time.sleep(0.5)
    return False


def make_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,900")

    service = Service("/usr/bin/chromedriver")
    driver = webdriver.Chrome(service=service, options=options)
    return driver


def is_mostly_blank(img: Image.Image, threshold: int = 240) -> bool:
    """Returns True if the image is mostly one solid/blank color."""
    grayscale = img.convert("L")
    pixels = list(grayscale.getdata())
    avg = sum(pixels) / len(pixels)
    return avg > threshold


def main() -> int:
    port = find_free_port()
    url = f"http://127.0.0.1:{port}"
    print(f"Starting dev server with mock backend on {url}...")
    proc = start_dev_server(port)

    try:
        if not wait_for_server(port):
            print("ERROR: dev server did not start in time")
            try:
                output, _ = proc.communicate(timeout=3)
                print("--- dev server output ---")
                print(output[-2000:] if output else "(no output)")
            except Exception:
                pass
            return 1
        print("Dev server is up.")

        driver = make_driver()
        try:
            print(f"Opening {url} ...")
            driver.get(url)

            wait = WebDriverWait(driver, 20)

            # Wait for either the login page or the dashboard to appear.
            wait.until(
                EC.any_of(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "button[type='submit']")),
                    EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Dashboard') or contains(text(), 'Evaluation')]")),
                )
            )

            login_path = SCREENSHOT_DIR / "01_login.png"
            driver.save_screenshot(str(login_path))
            print(f"Saved screenshot: {login_path}")

            # If still on login, sign in with mock credentials.
            buttons = driver.find_elements(By.CSS_SELECTOR, "button[type='submit']")
            if buttons:
                print("Login page detected; signing in with mock credentials...")
                username_input = driver.find_element(By.CSS_SELECTOR, "input[type='text']")
                password_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
                username_input.send_keys("clerk")
                password_input.send_keys("Clerk@123")
                buttons[0].click()
                time.sleep(2)

                dashboard_path = SCREENSHOT_DIR / "02_dashboard.png"
                driver.save_screenshot(str(dashboard_path))
                print(f"Saved screenshot: {dashboard_path}")
            else:
                dashboard_path = login_path

            # Verify screenshots are not blank.
            for path in [login_path, dashboard_path]:
                if path == dashboard_path and path == login_path:
                    continue
                img = Image.open(path)
                if is_mostly_blank(img):
                    print(f"ERROR: {path.name} looks mostly blank")
                    return 1
                print(f"{path.name}: {img.size}, average brightness OK")

            print("SUCCESS: frontend rendered correctly with mock backend")
            return 0
        finally:
            driver.quit()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())
