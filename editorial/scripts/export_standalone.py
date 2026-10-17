"""Create a portable HTML export containing the original assets, fonts and app."""
from pathlib import Path
import base64
import json
import mimetypes
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
EXPORT = ROOT / 'exports'
EXPORT.mkdir(exist_ok=True)


def data_url(path):
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}'


html = (DIST / 'index.html').read_text()
assets = {p.relative_to(DIST).as_posix(): data_url(p) for directory in ['work', 'frames/cars'] for p in (DIST / directory).glob('*.webp')}

for match in list(re.finditer(r'<link[^>]+rel="stylesheet"[^>]*>', html)):
    tag = match.group()
    file = DIST / re.search(r'href="([^"]+)"', tag)[1]
    css = file.read_text()
    css = re.sub(r'url\([\'"]?([^\)\'\"]+)[\'"]?\)', lambda m: f'url("{data_url((file.parent / m[1]).resolve())}")' if not m[1].startswith('data:') else m[0], css)
    html = html.replace(tag, f'<style>{css}</style>')

for match in list(re.finditer(r'<script[^>]+src="([^"]+)"[^>]*></script>', html)):
    javascript = (DIST / match[1]).read_text().replace('</script', '<\\/script')
    html = html.replace(match[0], f'<script type="module">{javascript}</script>')


def inline_url(match):
    attr, value = match[1], match[2]
    if value.startswith(('./', '/')):
        path = DIST / value.lstrip('./')
        if path.is_file():
            return f'{attr}="{assets.get(path.relative_to(DIST).as_posix()) or data_url(path)}"'
    return match[0]


html = re.sub(r'(src|href)="([^"]+)"', inline_url, html)
html = html.replace('<head>', '<head>\n<script>window.APEX_OFFLINE_ASSETS=' + json.dumps(assets, separators=(',', ':')) + ';</script>', 1)
notices = '\n\n'.join(p.name + '\n' + p.read_text() for p in sorted((DIST / 'licenses').glob('*.txt')))
html += '\n<!-- Font and icon license notices:\n' + notices.replace('-->', '-- >') + '\n-->\n'
output = EXPORT / 'Apex-Auto-Captures.html'
output.write_text(html)
print(f'Exported {output.name}: {output.stat().st_size:,} bytes; {len(assets)} supplied images embedded.')
