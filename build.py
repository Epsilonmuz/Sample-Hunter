#!/usr/bin/env python3
"""Builds the app into docs/ (served by GitHub Pages): fonts + engine inlined into one index.html, plus icons,
manifest and the offline worker. docs/index.html also works on its own (it is what the Claude page runs)."""
import os, shutil
here = os.path.dirname(os.path.abspath(__file__))
src, out = os.path.join(here, 'src'), os.path.join(here, 'docs')
app = open(os.path.join(src, 'app.html')).read()
app = app.replace('/*FONTS*/', open(os.path.join(src, 'fonts.css')).read())
app = app.replace('/*ENGINE*/', open(os.path.join(src, 'engine.js')).read())
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'index.html'), 'w').write(app)
for f in ['manifest.webmanifest', 'sw.js', 'icon-180.png', 'icon-192.png', 'icon-512.png']:
    shutil.copy(os.path.join(src, f), os.path.join(out, f))
open(os.path.join(out, '.nojekyll'), 'w').write('')
print('docs/index.html', len(app), 'bytes')
