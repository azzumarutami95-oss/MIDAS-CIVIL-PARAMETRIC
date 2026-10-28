#!/usr/bin/env python3
"""Bundle the browser app into a single HTML with no runtime dependencies."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
web = root / 'web'
html = (web / 'index.html').read_text(encoding='utf-8')
css = (web / 'styles.css').read_text(encoding='utf-8')
assert '@import' not in css and '</style' not in css.lower()
html = html.replace('<link rel="stylesheet" href="./styles.css">', '<style>\n'+css+'\n</style>')
for name in ['engine.js', 'app.js']:
    source = (web / name).read_text(encoding='utf-8')
    assert '</script' not in source.lower(), 'Escape a closing script tag before bundling'
    token = f'<script src="./{name}"></script>'
    assert token in html
    html = html.replace(token, '<script>\n'+source+'\n</script>')
assert '<script src=' not in html and 'href="./styles.css"' not in html
target = root / 'downloads' / 'CIVIL_HEAT_HYDRATION.html'
target.parent.mkdir(exist_ok=True)
target.write_text(html, encoding='utf-8')
print(f'{target}: {target.stat().st_size:,} bytes; standalone HTML')
