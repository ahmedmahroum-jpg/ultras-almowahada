"""Create the portable editor handoff after the browser smoke checks pass."""
import json
import zipfile
from pathlib import Path

here = Path(__file__).resolve().parent
report = json.loads((here / "tests/results/smoke-report.json").read_text(encoding="utf-8"))
assert report["checks"] and all(item["ok"] for item in report["checks"])
assert not report.get("errors") and not report.get("network")
files = ["ultras-editor.html", "افتح المحرر.cmd", "طريقة الاستخدام.txt",
         "المصادر والحقوق.txt", "OFL-Cairo.txt", "preview.png", "preview-news.png"]
target = here.parent / "output/ultras-editor-v01.zip"
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        archive.write(here / name, name)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(files)
print(f"Packaged {len(files)} files, {target.stat().st_size:,} bytes: {target.name}")
