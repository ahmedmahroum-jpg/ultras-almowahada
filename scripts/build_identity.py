import json
import base64
import mimetypes
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

# المسار الجذري للمشروع
ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "scripts" / "identity_spec.json"
OUTPUT_DIR = ROOT / "output" / "identity"
FONT_PATH = ROOT / "assets" / "fonts" / "Cairo.ttf"

def get_base64_data_uri(file_path: Path) -> str:
    """تحويل الملف إلى Data URI بصيغة Base64"""
    if not file_path.exists():
        raise FileNotFoundError(f"الملف غير موجود: {file_path}")
    
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "application/octet-stream"
        
    with open(file_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{data}"

def escape_xml(value) -> str:
    """تأمين القيم من حقول XML"""
    if value is None:
        return ""
    return escape(str(value), {'"': '&quot;', "'": '&apos;'})

def render_element(el: dict, indent: int = 0) -> str:
    """تحويل عنصر JSON إلى سطر SVG"""
    prefix = "  " * indent
    el_type = el.get("type")
    
    # خصائص مشتركة
    common_attrs = []
    if "id" in el:
        common_attrs.append(f'id="{escape_xml(el["id"])}"')
    if "opacity" in el:
        common_attrs.append(f'opacity="{escape_xml(el["opacity"])}"')
    if "transform" in el:
        common_attrs.append(f'transform="{escape_xml(el["transform"])}"')
        
    common_str = (" " + " ".join(common_attrs)) if common_attrs else ""
    
    if el_type == "text":
        x = el.get("x", 0)
        y = el.get("y", 0)
        text = el.get("text", "")
        size = el.get("size", 16)
        weight = el.get("weight", 700)
        fill = el.get("fill", "#000000")
        anchor = el.get("anchor", "end")
        direction = el.get("direction", "rtl")
        # Spec anchors mean physical left/start and right/end, including RTL.
        if direction == "rtl":
            anchor = {"start": "end", "end": "start"}.get(anchor, anchor)
        stroke = el.get("stroke")
        stroke_width = el.get("strokeWidth")
        letter_spacing = el.get("letterSpacing")
        
        attrs = [
            f'x="{x}"',
            f'y="{y}"',
            f'font-size="{size}"',
            f'font-weight="{weight}"',
            f'fill="{fill}"',
            f'text-anchor="{anchor}"',
            f'direction="{direction}"',
            f'unicode-bidi="plaintext"',
            f'font-family="Cairo, Arial, sans-serif"'
        ]
        
        if letter_spacing:
            attrs.append(f'letter-spacing="{letter_spacing}"')
            
        if stroke:
            attrs.append(f'stroke="{stroke}"')
            if stroke_width:
                attrs.append(f'stroke-width="{stroke_width}"')
            attrs.append('paint-order="stroke fill"')
            attrs.append('stroke-linejoin="round"')
            
        return f'{prefix}<text {" ".join(attrs)}{common_str}>{escape_xml(text)}</text>'

    elif el_type == "rect":
        x = el.get("x", 0)
        y = el.get("y", 0)
        w = el.get("width", 0)
        h = el.get("height", 0)
        rx = el.get("rx", 0)
        fill = el.get("fill", "none")
        stroke = el.get("stroke")
        stroke_width = el.get("strokeWidth")
        
        attrs = [
            f'x="{x}"',
            f'y="{y}"',
            f'width="{w}"',
            f'height="{h}"',
            f'rx="{rx}"',
            f'fill="{fill}"'
        ]
        if stroke:
            attrs.append(f'stroke="{stroke}"')
        if stroke_width:
            attrs.append(f'stroke-width="{stroke_width}"')
            
        return f'{prefix}<rect {" ".join(attrs)}{common_str}/>'

    elif el_type == "circle":
        cx = el.get("cx", 0)
        cy = el.get("cy", 0)
        r = el.get("r", 0)
        fill = el.get("fill", "none")
        
        attrs = [
            f'cx="{cx}"',
            f'cy="{cy}"',
            f'r="{r}"',
            f'fill="{fill}"'
        ]
        
        return f'{prefix}<circle {" ".join(attrs)}{common_str}/>'

    elif el_type == "path":
        d = el.get("d", "")
        fill = el.get("fill", "none")
        stroke = el.get("stroke")
        stroke_width = el.get("strokeWidth")
        opacity = el.get("opacity")
        
        attrs = [
            f'd="{escape_xml(d)}"',
            f'fill="{fill}"'
        ]
        if stroke:
            attrs.append(f'stroke="{stroke}"')
        if stroke_width:
            attrs.append(f'stroke-width="{stroke_width}"')
            
        return f'{prefix}<path {" ".join(attrs)}{common_str}/>'

    elif el_type == "line":
        x1 = el.get("x1", 0)
        y1 = el.get("y1", 0)
        x2 = el.get("x2", 0)
        y2 = el.get("y2", 0)
        stroke = el.get("stroke", "#000000")
        stroke_width = el.get("strokeWidth", 1)
        
        attrs = [
            f'x1="{x1}"',
            f'y1="{y1}"',
            f'x2="{x2}"',
            f'y2="{y2}"',
            f'stroke="{stroke}"',
            f'stroke-width="{stroke_width}"'
        ]
        
        return f'{prefix}<line {" ".join(attrs)}{common_str}/>'

    elif el_type == "image":
        href = el.get("href", "")
        x = el.get("x", 0)
        y = el.get("y", 0)
        w = el.get("width", 0)
        h = el.get("height", 0)
        preserve = el.get("preserveAspectRatio", "xMidYMid meet")
        
        # تحويل المسار النسبي إلى Data URI
        img_path = ROOT / href
        if img_path.suffix.lower() == ".svg":
            ET.register_namespace("", "http://www.w3.org/2000/svg")
            node = ET.fromstring(img_path.read_text(encoding="utf-8"))
            if el.get("fillOverride"):
                for child in node.iter():
                    if child.tag.endswith("path"):
                        child.set("fill", el["fillOverride"])
            for key, value in {"x": x, "y": y, "width": w, "height": h, "preserveAspectRatio": preserve}.items():
                node.set(key, str(value))
            return prefix + ET.tostring(node, encoding="unicode")
        data_uri = get_base64_data_uri(img_path)
        
        attrs = [
            f'x="{x}"',
            f'y="{y}"',
            f'width="{w}"',
            f'height="{h}"',
            f'href="{data_uri}"',
            f'preserveAspectRatio="{preserve}"'
        ]
        
        return f'{prefix}<image {" ".join(attrs)}{common_str}/>'

    elif el_type == "raw":
        # نسمح بتمرير SVG خام
        content = el.get("svg", el.get("content", ""))
        return f'{prefix}{content}'

    elif el_type == "group":
        transform = el.get("transform", "")
        elements = el.get("elements", [])
        
        inner_content = "\n".join([render_element(child, indent + 1) for child in elements])
        
        attrs = []
        if common_str:
            attrs.append(common_str)
            
        attr_str = f' {" ".join(attrs)}' if attrs else ""
        return f'{prefix}<g{attr_str}>\n{inner_content}\n{prefix}</g>'

    else:
        raise ValueError(f"نوع عنصر غير مدعوم: {el_type}")

def build_svg(asset: dict, font_data_uri: str) -> str:
    """بناء محتوى ملف SVG كامل"""
    width = asset.get("width", 100)
    height = asset.get("height", 100)
    background = asset.get("background", "#FFFFFF")
    title = asset.get("title", "Untitled")
    elements = asset.get("elements", [])
    
    # بناء عناصر الـ SVG
    body = "\n".join([render_element(el) for el in elements])
    
    # تضمين الخط
    font_face = f"""
    @font-face {{
        font-family: 'Cairo';
        src: url({font_data_uri}) format('truetype');
        font-weight: 200 1000;
        font-style: normal;
    }}
    """
    
    svg_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" stroke-linecap="round" stroke-linejoin="round">
  <title>{escape_xml(title)}</title>
  <defs>
    <style type="text/css">
      {font_face}
    </style>
  </defs>
  <rect width="100%" height="100%" fill="{background}"/>
  {body}
</svg>"""
    
    return svg_content

def build():
    """الدالة الرئيسية لبناء الأصول"""
    # التحقق من وجود ملف المواصفات
    if not SPEC_PATH.exists():
        print(f"خطأ: ملف المواصفات غير موجود في {SPEC_PATH}", file=sys.stderr)
        sys.exit(1)
        
    # قراءة المواصفات
    try:
        with open(SPEC_PATH, "r", encoding="utf-8") as f:
            spec = json.load(f)
    except json.JSONDecodeError as e:
        print(f"خطأ في قراءة JSON: {e}", file=sys.stderr)
        sys.exit(1)
        
    # التحضير للمخرجات
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # تحميل الخط مرة واحدة
    font_data_uri = ""
    if FONT_PATH.exists():
        font_data_uri = get_base64_data_uri(FONT_PATH)
    else:
        print(f"تحذير: خط Cairo غير موجود في {FONT_PATH}. سيتم استخدام الخطوط الافتراضية.", file=sys.stderr)

    assets = spec.get("assets", [])
    manifest_assets = []
    
    for asset in assets:
        asset_id = asset.get("id")
        if not asset_id:
            print("خطأ: عنصر asset بدون id", file=sys.stderr)
            continue
            
        title = asset.get("title", asset_id)
        width = asset.get("width", 0)
        height = asset.get("height", 0)
        
        # بناء SVG
        svg_content = build_svg(asset, font_data_uri)
        
        # كتابة ملف SVG
        svg_filename = f"{asset_id}.svg"
        svg_path = OUTPUT_DIR / svg_filename
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg_content)
            
        # إضافة للمانيفست
        manifest_assets.append({
            "id": asset_id,
            "title": title,
            "width": width,
            "height": height,
            "file": svg_filename,
            "png_file": f"{asset_id}.png"
        })
        
        print(f"تم إنشاء: {svg_path}")

    # كتابة manifest.json
    manifest = {
        "assets": manifest_assets
    }
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"تم إنشاء: {manifest_path}")
    
    # بناء index.html
    html_items = ""
    for a in manifest_assets:
        html_items += f"""
        <div class="card">
            <h3>{escape_xml(a['title'])}</h3>
            <img src="{a['file']}" alt="{escape_xml(a['title'])}" style="width:100%; height:auto; background:{"#073E2A" if a["id"] == "logo-white" else "#F7F8EF"}; border:1px solid #ddd; border-radius:8px;">
            <div class="actions">
                <a href="{a['file']}" download>تحميل SVG</a>
                <a href="{a['png_file']}" download>تحميل PNG</a>
            </div>
        </div>
        """
        
    html_content = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>معرض الهوية البصرية</title>
    <style>
        body {{
            font-family: 'Cairo', Arial, sans-serif;
            background-color: #F7F8EF;
            color: #333;
            margin: 0;
            padding: 20px;
        }}
        header {{
            background-color: #2E5C3A;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }}
        .card {{
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }}
        .actions {{
            margin-top: 10px;
            display: flex;
            gap: 10px;
        }}
        .actions a {{
            text-decoration: none;
            color: #2E5C3A;
            font-weight: bold;
        }}
        .footer {{
            margin-top: 40px;
            text-align: center;
        }}
        .footer a {{
            color: #2E5C3A;
        }}
    </style>
</head>
<body>
    <header>
        <h1>معرض الهوية البصرية</h1>
        <p>جميع الأصول المولدة من المواصفات</p>
    </header>
    
    <div class="grid">
        {html_items}
    </div>
    
    <div class="footer">
        <a href="brand-guide.html">الانتقال إلى دليل العلامة التجارية</a>
    </div>
</body>
</html>"""
    
    index_path = OUTPUT_DIR / "index.html"
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"تم إنشاء: {index_path}")

if __name__ == "__main__":
    build()
