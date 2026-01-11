from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Load the local index.html
        page.goto(f"file://{os.getcwd()}/index.html")

        # Take a screenshot of the login page
        page.screenshot(path="verification_styles.png")

        browser.close()

if __name__ == "__main__":
    run()
