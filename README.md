# أولتراس الموحدة — Visual Design Editor

Arabic RTL design editor, editable identity assets, and motion graphics handoff. The editor is a self-contained static HTML application with 13 templates, local image/text editing, PNG/SVG exports, and JSON project import/export.

## Open the editor

Open `editor/ultras-editor.html` directly in a modern browser, or run from the repository root:

```sh
python -m http.server 8769 --bind 127.0.0.1 --directory editor
```

Visit `http://127.0.0.1:8769/ultras-editor.html`.

## Rebuild

Python 3.12 and Pillow 12.3.0 were used for the verified build:

```sh
python -m pip install Pillow==12.3.0
python -B editor/build_editor.py
```

Keep `output/identity/*.svg` and `output/identity/*.png`: despite their directory name, they are required inputs to the editor build.

## Deployment handoff

- [HTML handoff](DEPLOYMENT_HANDOFF.html) — download/open in a browser.
- [Markdown handoff](DEPLOYMENT_HANDOFF.md).

The handoff is a dated audit made before the initial GitHub transfer. Its statements that the repository had no commits and no `.gitignore` describe that earlier audit, not the state of this repository after the initial upload. This transfer adds `.gitignore` and tracks the editor, sources, assets, and final deliverables. Local AI experiment/performance folders, scratch data, conversation history, and test outputs are intentionally excluded; references to those excluded files in the historical audit describe the original PC only.

Recommended hosting: Vercel static hosting. No backend, database, GPU, or AI service is required to use the editor. See section 11 of the handoff for exact static staging commands. Browser drafts are stored only on the current device/origin; save each wanted draft as project JSON before changing sites.

## Files

- `editor/`: frontend sources, standalone bundle, template metadata, and test scripts.
- `assets/`: bundled font, source artwork, portrait, and attribution records.
- `scripts/`: offline identity and scene authoring scripts.
- `output/identity/`: editable SVG templates and rendered PNG assets.
- `output/scene-designs-v2-2026-10-09/`: seven scene designs.
- `output/motion-design-delivery/`: motion handoff, PDF, and animated outro.
- `output/social-profile-kit-2026-10-10/`: profile and social cover assets.
- `references/`: design references and source manifest.

Some optional rendering/test scripts reference Windows-specific tool paths; the editor itself does not. Test reports are excluded, so `editor/package_editor.py` requires a fresh local test report before packaging.

## Attribution and publishing

Retain `assets/fonts/OFL-Cairo.txt`, `assets/source/source-provenance.json`, and `editor/المصادر والحقوق.txt`. Third-party asset licenses do not grant a blanket license to the whole project. No project-wide open-source license has been selected. Do not publish the entire repository as a website: deploy only the allowlisted editor bundle and license described in the handoff.
