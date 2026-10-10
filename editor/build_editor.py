"""Package the existing design kit and editor into one offline HTML file."""
import base64
import io
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def data_uri(data, mime):
    return "data:" + mime + ";base64," + base64.b64encode(data).decode("ascii")


def build():
    font_uri = data_uri((ROOT / "assets/fonts/Cairo.ttf").read_bytes(), "font/ttf")
    font_css = "@font-face{font-family:'Cairo';src:url('" + font_uri + "') format('truetype');font-weight:100 1000;font-style:normal;}"
    schema = json.loads((HERE / "template-fields.json").read_text(encoding="utf-8"))
    templates = []
    for item in schema["templates"]:
        source = ROOT / "output/identity" / (item["id"] + ".svg")
        svg = ET.fromstring(source.read_text(encoding="utf-8"))
        texts = list(svg.iter("{" + NS + "}text"))
        assert len(texts) == len(item["allTextNodes"]), item["id"]
        for index, node in enumerate(texts):
            node.set("id", f"editor-text-{index}")
        for index, node in enumerate(svg.iter("{" + NS + "}image")):
            node.set("id", f"editor-image-{index}")
        all_ids = {node.get("id") for node in svg.iter() if node.get("id")}
        for field in item["fields"] + item["advanced"]:
            assert all(target in all_ids for target in field["ids"]), (item["id"], field["id"])
        for style in svg.iter("{" + NS + "}style"):
            style.text = re.sub(r"@font-face\s*\{[^}]*\}", "__FONT_FACE__", style.text or "")
        assert "__FONT_FACE__" in ET.tostring(svg, encoding="unicode"), item["id"]
        thumbnail = Image.open(source.with_suffix(".png")).convert("RGBA")
        thumbnail.thumbnail((132, 150), Image.Resampling.LANCZOS)
        if item["id"] == "logo-white":
            backdrop = Image.new("RGBA", thumbnail.size, "#073E2A")
            backdrop.alpha_composite(thumbnail)
            thumbnail = backdrop
        buf = io.BytesIO()
        thumbnail.save(buf, format="PNG", optimize=True)
        fields, advanced = [], []
        for source_fields, destination in [(item["fields"], fields), (item["advanced"], advanced)]:
            for field in source_fields:
                normalized = {key: field[key] for key in ["id", "label", "kind", "default", "fontSize", "minFontSize", "weight", "anchor", "direction", "maxLines"] if key in field}
                normalized["targets"] = field["ids"]
                normalized.update(field.get("box", {}))
                if field["kind"] == "image" and field.get("defaultAsset"):
                    with Image.open(ROOT / field["defaultAsset"]) as original_image:
                        normalized["sourceWidth"], normalized["sourceHeight"] = original_image.size
                if field.get("fontSize"):
                    normalized["minFontSize"] = max(field["minFontSize"], math.ceil(field["fontSize"] * .8))
                baselines = field.get("suggestedBaselines") or field.get("originalBaselines", [])
                if baselines:
                    normalized["baselineOffset"] = (baselines[0] - field["box"]["y"]) / field["fontSize"]
                if field.get("lineHeight"):
                    normalized["lineHeight"] = field["lineHeight"] / field["fontSize"]
                elif len(baselines) > 1:
                    normalized["lineHeight"] = (baselines[1] - baselines[0]) / field["fontSize"]
                else:
                    normalized["lineHeight"] = 1.35
                if item["id"] == "04-important-news" and field["id"] == "body":
                    normalized["height"] = 84
                destination.append(normalized)
        primary_order = {
            "02-quote": ["speaker", "portrait", "quote", "sourceDate", "context", "heading", "caption", "credit"],
            "04-important-news": ["headline", "body", "sourceDate", "category", "displayTitle"],
        }.get(item["id"])
        if primary_order:
            fields.sort(key=lambda field: primary_order.index(field["id"]))
        templates.append({
            "id": item["id"], "title": item["title"], "description": item["description"],
            "width": item["width"], "height": item["height"], "visualOnly": item.get("visualOnly", False),
            "fields": fields, "advanced": advanced,
            "svg": ET.tostring(svg, encoding="unicode"),
            "thumbnail": data_uri(buf.getvalue(), "image/png"),
        })
    # Most frequently used designs first; preserve every original asset.
    rank = ["02-quote", "04-important-news", "03-comparison", "01-introduction", "05-voting", "06-story", "07-speaker-lower-third", "cover", "logo-primary", "avatar", "logo-symbol", "logo-black", "logo-white"]
    templates.sort(key=lambda item: rank.index(item["id"]))
    data = {"version": 1, "fontCss": font_css, "templates": templates}
    data_js = "window.EDITOR_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + ";"
    shell = (HERE / "editor-shell.html").read_text(encoding="utf-8")
    license_text = (ROOT / "assets/fonts/OFL-Cairo.txt").read_text(encoding="utf-8").replace("-->", "-- >")
    shell = shell.replace("</head>", "<!-- Bundled Cairo font license:\n" + license_text + "\n-->\n</head>")
    css = (HERE / "editor.css").read_text(encoding="utf-8").replace("__FONT_URI__", font_uri)
    for marker, content in [
        ("/*__STYLES__*/", css), ("/*__DATA__*/", data_js),
        ("/*__CORE__*/", (HERE / "editor-core.js").read_text(encoding="utf-8")),
        ("/*__APP__*/", (HERE / "app.js").read_text(encoding="utf-8")),
    ]:
        assert marker in shell
        shell = shell.replace(marker, content)
    output = HERE / "ultras-editor.html"
    output.write_text(shell, encoding="utf-8")
    (HERE / "build-info.json").write_text(json.dumps({"version": 1, "templates": len(templates), "file": output.name, "bytes": output.stat().st_size, "offline": True}, indent=2), encoding="utf-8")
    print(f"Built {output.name}: {len(templates)} templates, {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    build()
