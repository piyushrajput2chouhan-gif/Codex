"""Apply the editable theme to the supplied static-site ZIP (no build dependencies)."""
from pathlib import Path
import os
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'apex-website.zip'
THEME_PATH = 'assets/apex-premium.css'
LINK = f'    <link rel="stylesheet" href="/{THEME_PATH}">'


def main():
    theme = (ROOT / 'theme/premium.css').read_bytes()
    with zipfile.ZipFile(ARCHIVE) as source:
        bad = source.testzip()
        if bad:
            raise ValueError(f'Archive integrity failure: {bad}')
        html = source.read('index.html').decode('utf-8')
        if LINK not in html:
            if '</head>' not in html:
                raise ValueError('Missing HTML head')
            html = html.replace('</head>', LINK + '\n  </head>')
        html = html.replace('content="#10110f"', 'content="#091b18"')
        fd, temporary = tempfile.mkstemp(suffix='.zip', dir=ROOT)
        os.close(fd)
        try:
            with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as target:
                for entry in source.infolist():
                    if entry.filename == THEME_PATH:
                        continue
                    content = html.encode('utf-8') if entry.filename == 'index.html' else source.read(entry.filename)
                    target.writestr(entry, content)
                target.writestr(THEME_PATH, theme)
            with zipfile.ZipFile(temporary) as result:
                assert result.testzip() is None
                assert result.read(THEME_PATH) == theme
            os.replace(temporary, ARCHIVE)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    print('Updated apex-website.zip with Emerald Editorial theme.')


if __name__ == '__main__':
    main()
