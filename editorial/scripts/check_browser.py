"""Functional browser checks against a running local build; does not send messages."""
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json
import os
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'evidence'
EVIDENCE.mkdir(exist_ok=True)
BASE = os.environ.get('APEX_TEST_URL', 'http://127.0.0.1:4173/')
motion_only = '--motion-only' in sys.argv
previous_results = EVIDENCE / 'browser-results.json'
results = json.loads(previous_results.read_text()) if motion_only and previous_results.exists() else []


def passed(name, **details):
    record = {'check': name, 'result': 'passed', **details}
    results[:] = [item for item in results if item['check'] != name]
    results.append(record)
    print(json.dumps(record), flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height in ([] if motion_only else [(390, 844), (768, 1024), (1440, 1000)]):
        context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto(BASE, wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        assert page.evaluate('document.documentElement.scrollWidth') == width, 'Horizontal overflow'
        assert page.locator('h1').inner_text() == 'Cars. Cafés.\nA different\nperspective.'
        assert page.locator('h1').evaluate("e => getComputedStyle(e).fontFamily.includes('Bodoni Moda')")
        page.screenshot(path=str(EVIDENCE / f'hero-{width}.png'))

        # Tab enters the real page, and the skip link moves focus to main content.
        page.keyboard.press('Tab')
        assert page.locator('.skip-link').evaluate('e => e === document.activeElement')
        page.keyboard.press('Enter')
        assert page.evaluate("location.hash === '#main'")

        # Native dialog keyboard behavior: arrows, focus containment, Escape, restoration.
        opener = page.locator('.hero-car .photo-button')
        opener.focus()
        page.keyboard.press('Enter')
        assert page.locator('dialog').evaluate('e => e.open')
        assert page.locator('.lightbox-close').evaluate('e => e === document.activeElement')
        page.keyboard.press('ArrowRight')
        assert 'cafe-interior' in page.locator('.lightbox-image').get_attribute('src')
        page.keyboard.press('ArrowLeft')
        assert 'car-orange-front' in page.locator('.lightbox-image').get_attribute('src')
        for _ in range(5):
            page.keyboard.press('Tab')
            assert page.evaluate("Boolean(document.activeElement.closest('dialog'))"), 'Focus escaped modal'
        page.screenshot(path=str(EVIDENCE / f'lightbox-{width}.png'))
        page.keyboard.press('Escape')
        assert not page.locator('dialog').evaluate('e => e.open')
        assert opener.evaluate('e => e === document.activeElement')

        page.locator('[data-filter="Cars"]').focus()
        page.keyboard.press('Enter')
        assert page.locator('#work-grid figure').count() == 6
        assert page.locator('[data-filter="Cars"]').get_attribute('aria-pressed') == 'true'
        page.locator('[data-filter="Cafés"]').click()
        assert page.locator('#work-grid figure').count() == 2
        page.locator('#work-grid .photo-button').first.click()
        page.keyboard.press('ArrowLeft')
        assert page.locator('.lightbox-position').inner_text() == '2 / 2'
        page.keyboard.press('Escape')
        page.locator('[data-filter="All"]').click()
        assert page.locator('#work-grid figure').count() == 8
        page.locator('#selected-work').scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        page.screenshot(path=str(EVIDENCE / f'work-{width}.png'))
        page.locator('.header-nav [data-category-link="Cars"]').click()
        assert page.locator('#work-grid figure').count() == 6
        page.locator('[data-filter="All"]').click()

        # The café anchor navigates to the collection; it does not invent a route.
        page.locator('.header-nav a[href="#cafes"]').click()
        page.wait_for_function("location.hash === '#cafes'")
        page.locator('#cafes').scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        assert page.locator('#cafe-grid figure').count() == 8
        page.screenshot(path=str(EVIDENCE / f'cafes-{width}.png'))

        message = 'A café enquiry & a car photograph — custom quote, please.'
        page.locator('#enquiry-message').fill(message)
        href = page.locator('#whatsapp-send').get_attribute('href')
        parsed = urlparse(href)
        assert parsed.netloc == 'wa.me' and parsed.path == '/919701414074'
        assert message in parse_qs(parsed.query)['text'][0]
        assert page.locator('a[href="mailto:apexautocaptures@gmail.com"]').count() == 2
        page.locator('#enquire').scroll_into_view_if_needed()
        page.wait_for_timeout(250)
        page.screenshot(path=str(EVIDENCE / f'enquiry-{width}.png'))
        if width == 390:
            assert page.locator('.mobile-action').is_hidden(), 'Mobile action duplicates enquiry CTA'
            page.locator('#selected-work').scroll_into_view_if_needed()
            page.wait_for_timeout(400)
            assert page.locator('.mobile-action').is_visible()
            assert page.locator('.mobile-action .button').bounding_box()['height'] >= 48

        # Scroll each image into view so lazy loading is checked, not assumed.
        for image in page.locator('main .photo-button > img, main .sequence-poster').all():
            image.scroll_into_view_if_needed()
            image.evaluate('e => e.decode()')
            assert image.evaluate('e => e.naturalWidth > 0')
        assert page.locator('body').inner_text().find('Ibrahim') == -1
        assert not page.locator('[id="about"]').count()
        assert not errors, errors
        page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
        page.wait_for_timeout(200)
        page.screenshot(path=str(EVIDENCE / f'page-{width}.png'), full_page=True)
        passed(f'layout and core interactions at {width}px', viewport=f'{width}×{height}', console_errors=errors)
        context.close()

    # Prove native scrolling advances the supplied frame sequence and pauses offscreen.
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    frame_requests = []
    concurrent = set()
    peak = [0]

    def frame_request(request):
        if '/frames/cars/' in request.url and request.resource_type == 'fetch':
            frame_requests.append(request.url)
            concurrent.add(request)
            peak[0] = max(peak[0], len(concurrent))

    page.on('request', frame_request)
    page.on('requestfinished', lambda r: concurrent.discard(r))
    page.on('requestfailed', lambda r: concurrent.discard(r))
    page.goto(BASE, wait_until='networkidle')
    assert not frame_requests, 'Animation downloaded before it was visible'
    network = page.context.new_cdp_session(page)
    network.send('Network.enable')
    network.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 80, 'downloadThroughput': 150000, 'uploadThroughput': 150000})
    page.evaluate("window.scrollTo({top:document.querySelector('.motion-track').getBoundingClientRect().top + window.scrollY,behavior:'instant'})")
    page.wait_for_function("Number(document.querySelector('.motion-section').dataset.framesLoaded) >= 5")
    page.wait_for_function("document.querySelector('canvas').classList.contains('has-frame')")
    before = int(page.locator('.motion-section').get_attribute('data-frame'))
    page.mouse.wheel(0, 650)
    page.wait_for_timeout(600)
    after = int(page.locator('.motion-section').get_attribute('data-frame'))
    assert after > before, (before, after)
    assert peak[0] <= 3, peak[0]
    page.screenshot(path=str(EVIDENCE / 'animation-active.png'))
    page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
    page.wait_for_function("document.querySelector('.motion-section').dataset.animationState === 'paused'")
    count = len(frame_requests)
    assert count < 192, 'The pause check must stop an incomplete loading queue'
    page.wait_for_timeout(500)
    assert len(frame_requests) == count, 'Animation kept loading offscreen'
    passed('progressive frames, native scroll and offscreen pause', frame_before=before, frame_after=after, max_parallel_fetches=peak[0], requests_before_offscreen_pause=count)
    page.close()

    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    reduced_fetches = []
    page.on('request', lambda r: reduced_fetches.append(r.url) if '/frames/cars/' in r.url and r.resource_type == 'fetch' else None)
    page.goto(BASE, wait_until='networkidle')
    page.locator('.motion-section').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    assert page.locator('.motion-section').get_attribute('data-animation-state') == 'still'
    assert not reduced_fetches
    assert page.locator('.sequence-poster').evaluate('e => e.complete && e.naturalWidth === 1280')
    assert page.locator('canvas').evaluate('e => getComputedStyle(e).display === "none"')
    page.screenshot(path=str(EVIDENCE / 'reduced-motion-390.png'))
    passed('reduced motion shows the supplied still with zero animated-frame fetches')
    page.close()

    page = browser.new_page(viewport={'width': 390, 'height': 844})
    page.route('**/frames/cars/*.webp', lambda route: route.abort() if route.request.resource_type == 'fetch' else route.continue_())
    page.goto(BASE, wait_until='networkidle')
    page.locator('.motion-section').scroll_into_view_if_needed()
    page.wait_for_timeout(800)
    assert page.locator('.sequence-poster').evaluate('e => e.complete && e.naturalWidth === 1280')
    assert page.locator('canvas').evaluate('e => !e.classList.contains("has-frame")')
    page.screenshot(path=str(EVIDENCE / 'frame-failure-fallback-390.png'))
    passed('frame-request failure retains the real supplied still')
    page.close()
    browser.close()

(EVIDENCE / 'browser-results.json').write_text(json.dumps(results, indent=2))
print(f'Completed {len(results)} browser check groups.', flush=True)
