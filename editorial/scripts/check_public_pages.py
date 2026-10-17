"""Read-only public deployment smoke check. No external messages are sent."""
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from time import sleep
from urllib.parse import urljoin
from urllib.request import Request, urlopen
import os

BASE = 'https://piyushrajput2chouhan-gif.github.io/Codex/'
ROOT = Path(__file__).resolve().parents[1]


def get(path):
    url = urljoin(BASE, path)
    with urlopen(Request(url, headers={'User-Agent': 'Apex-Pages-check', 'Cache-Control': 'no-cache'}), timeout=20) as response:
        assert response.status == 200, (url, response.status)
        return response.read()


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag in ('img', 'script') and attrs.get('src'):
            self.paths.add(attrs['src'])
        if tag == 'link' and attrs.get('href') and attrs.get('rel') in ('stylesheet', 'icon', 'preload'):
            self.paths.add(attrs['href'])


# GitHub may need a moment to make a completed Pages deployment available.
for attempt in range(12):
    try:
        html = get('').decode()
        assert 'Cars. Cafés.' in html and 'Your next' in html and 'cafe-grid' in html, 'The new editorial build is not being served yet.'
        break
    except Exception:
        if attempt == 11:
            raise
        sleep(5)

parser = AssetParser()
parser.feed(html)
paths = sorted(path for path in parser.paths if not path.startswith(('data:', 'http:', 'https:')))
for path in paths:
    content = get(path)
    assert content, f'Empty public asset: {path}'
    assert b'<!doctype html>' not in content[:100].lower(), f'HTML fallback returned for asset: {path}'
    print(f'PASS asset {path} ({len(content)} bytes)', flush=True)

for path in ['work/car-orange-front.webp', 'work/cafe-interior.webp', 'frames/cars/frame_0001.webp', 'frames/cars/frame_0192.webp']:
    live = get(path)
    local = (ROOT / 'public' / path).read_bytes()
    assert sha256(live).digest() == sha256(local).digest(), f'Public asset differs from supplied original: {path}'
    print(f'PASS original asset checksum: {path}', flush=True)

message = f'PASS: {BASE} serves the editorial website, {len(paths)} linked resources, and byte-identical original hero photos and first/last car frames.'
print(message, flush=True)
if summary := os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(summary, 'a') as file:
        file.write(message + '\n')
