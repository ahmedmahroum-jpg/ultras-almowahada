(function() {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const XLINK_NS = "http://www.w3.org/1999/xlink";

    function parseSVG(source) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(source, "image/svg+xml");
        const errorNode = doc.querySelector("parsererror");
        if (errorNode) throw new Error("SVG parsing failed");
        const root = doc.documentElement;
        if (!root || root.localName !== "svg" || root.namespaceURI !== SVG_NS) throw new Error("Root element is not SVG");
        
        const scripts = root.querySelectorAll("script");
        scripts.forEach(s => s.remove());
        const foreignObjects = root.querySelectorAll("foreignObject");
        foreignObjects.forEach(f => f.remove());
        
        const allElements = [root, ...root.querySelectorAll("*")];
        allElements.forEach(el => {
            for (const attr of [...el.attributes]) {
                if (/^on/i.test(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            }
        });
        
        return root;
    }

    const measureContext = document.createElement("canvas").getContext("2d");
    function measureMetrics(text, font, weight, size) {
        const ctx = measureContext;
        ctx.font = `${weight} ${size}px ${font}`;
        return ctx.measureText(text);
    }
    function measureText(text, font, weight, size) {
        return measureMetrics(text, font, weight, size).width;
    }

    function getGraphemes(str) {
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' });
            return Array.from(segmenter.segment(str), s => s.segment);
        }
        return Array.from(str);
    }

    function wrapText(text, maxWidth, font, weight, size, styleAt) {
        const lines = [];
        const paragraphs = text.split('\n');
        const fits = value => {
            const style = styleAt ? styleAt(lines.length) : { size, weight };
            return measureText(value, font, style.weight, style.size) <= maxWidth;
        };
        
        paragraphs.forEach(para => {
            if (para.trim() === "") {
                lines.push("");
                return;
            }
            
            const words = para.split(/\s+/).filter(w => w.length > 0);
            let currentLine = "";
            
            words.forEach(word => {
                const testLine = currentLine ? currentLine + " " + word : word;
                if (fits(testLine)) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = "";
                    
                    if (fits(word)) {
                        currentLine = word;
                    } else {
                        const graphemes = getGraphemes(word);
                        graphemes.forEach(g => {
                            const gTest = currentLine + g;
                            if (!currentLine || fits(gTest)) {
                                currentLine = gTest;
                            } else {
                                lines.push(currentLine);
                                currentLine = g;
                            }
                        });
                    }
                }
            });
            
            if (currentLine) lines.push(currentLine);
        });
        
        return lines;
    }

    function editTextBlock(svg, def, value) {
        if (!def.targets || !def.targets.length) throw new Error("No targets provided");
        
        const firstId = def.targets[0];
        const firstNode = svg.getElementById(firstId);
        if (!firstNode) throw new Error("Target node not found: " + firstId);
        const originalNodes = def.targets.map(id => svg.getElementById(id)).filter(Boolean);
        const styleAttributes = ['font-size','fill','stroke','stroke-width','paint-order','font-weight','stroke-linejoin','stroke-linecap','letter-spacing','opacity'];
        // Keep original per-line styles when the same live SVG is edited twice.
        let originalStyles;
        try { originalStyles = JSON.parse(firstNode.getAttribute('data-editor-line-styles') || 'null'); } catch (_) {}
        if (!Array.isArray(originalStyles) || !originalStyles.length) {
            originalStyles = originalNodes.map(node => Object.fromEntries(styleAttributes.map(attr => [attr, node.getAttribute(attr)])));
        }
        const referenceSize = Number(originalStyles[0]['font-size']) || Number(firstNode.getAttribute('font-size')) || 32;
        const styleForLine = index => originalStyles[Math.min(index, originalStyles.length - 1)];
        
        const originalFontFamily = def.fontFamily || firstNode.getAttribute("font-family") || "sans-serif";
        const originalWeight = def.weight || firstNode.getAttribute("font-weight") || "700";
        const originalFill = def.fill || firstNode.getAttribute("fill") || "black";
        const originalStroke = def.stroke || firstNode.getAttribute("stroke") || "none";
        const originalStrokeWidth = def.strokeWidth ?? firstNode.getAttribute("stroke-width") ?? "0";
        
        const anchor = def.anchor || "right";
        const direction = def.direction || "rtl";
        const lineHeight = def.lineHeight || 1.2;
        const x = Number(def.x), y = Number(def.y);
        const width = Number(def.width), height = Number(def.height);
        const minFontSize = Number(def.minFontSize || 10);
        if (![x,y,width,height,minFontSize].every(Number.isFinite) || width <= 0 || height <= 0 || minFontSize <= 0) throw new Error("Invalid text rectangle or minimum font size");
        
        const configuredFontSize = Number(def.fontSize || firstNode.getAttribute("font-size") || 32);
        let fontSize = Math.max(minFontSize, configuredFontSize);
        if (!Number.isFinite(fontSize)) throw new Error("Invalid font size");
        let lines = [];
        let overflow = false;
        const sizeForLine = index => fontSize * ((Number(styleForLine(index)['font-size']) || referenceSize) / referenceSize);
        const weightForLine = index => def.weight || styleForLine(index)['font-weight'] || originalWeight;
        const fixedBaseline = Number(def.fixedBaseline ?? (y + configuredFontSize * (def.baselineOffset ?? 0.85)));
        const baselineForLine = index => fixedBaseline + index * fontSize * lineHeight;
        
        while (true) {
            lines = wrapText(String(value ?? "").replace(/\r\n?/g, "\n"), width, originalFontFamily, originalWeight, fontSize,
                index => ({size: sizeForLine(index), weight: weightForLine(index)}));
            const measurements = lines.map((line, index) => {
                const size = sizeForLine(index);
                const metric = measureMetrics(line, originalFontFamily, weightForLine(index), size);
                const baseline = baselineForLine(index);
                return { width: metric.width, top: baseline - (metric.actualBoundingBoxAscent || size * 0.8),
                    bottom: baseline + (metric.actualBoundingBoxDescent || size * 0.2) };
            });
            const maxLineWidth = Math.max(...measurements.map(m => m.width), 0);
            const top = Math.min(...measurements.map(m => m.top), y);
            const bottom = Math.max(...measurements.map(m => m.bottom), y);
            
            if (top >= y && bottom <= y + height && maxLineWidth <= width && (!def.maxLines || lines.length <= def.maxLines)) {
                overflow = false;
                break;
            }
            
            if (fontSize === minFontSize) {
                overflow = true;
                break;
            }
            
            fontSize = Math.max(minFontSize, fontSize - 1);
        }
        
        const newTextNode = firstNode.cloneNode(false);
        newTextNode.removeAttribute("x");
        newTextNode.removeAttribute("y");
        newTextNode.removeAttribute("dx");
        newTextNode.removeAttribute("dy");
        
        newTextNode.setAttribute("font-family", originalFontFamily);
        newTextNode.setAttribute("font-size", fontSize);
        newTextNode.setAttribute("direction", direction);
        newTextNode.setAttribute("unicode-bidi", "plaintext");
        newTextNode.setAttribute("font-weight", originalWeight);
        newTextNode.setAttribute("fill", originalFill);
        newTextNode.setAttribute("stroke", originalStroke);
        newTextNode.setAttribute("stroke-width", originalStrokeWidth);
        newTextNode.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
        newTextNode.setAttribute('data-editor-line-styles', JSON.stringify(originalStyles));
        
        let textAnchor;
        let xPos;
        
        if (direction === "rtl") {
            if (anchor === "right") { textAnchor = "start"; xPos = x + width; }
            else if (anchor === "left") { textAnchor = "end"; xPos = x; }
            else { textAnchor = "middle"; xPos = x + width / 2; }
        } else {
            if (anchor === "right") { textAnchor = "end"; xPos = x + width; }
            else if (anchor === "left") { textAnchor = "start"; xPos = x; }
            else { textAnchor = "middle"; xPos = x + width / 2; }
        }
        
        newTextNode.setAttribute("text-anchor", textAnchor);
        
        def.targets.slice(1).forEach(id => {
            const node = svg.getElementById(id);
            if (node) node.remove();
        });
        
        newTextNode.setAttribute("id", firstId);
        
        lines.forEach((line, i) => {
            const tspan = document.createElementNS(SVG_NS, "tspan");
            const source = styleForLine(i);
            for (const attr of ['fill','stroke','stroke-width','paint-order','font-weight','stroke-linejoin','stroke-linecap','letter-spacing','opacity']) {
                const original = source[attr];
                const key = {'font-weight':'weight','stroke-width':'strokeWidth'}[attr] || attr;
                if (def[key] != null) tspan.setAttribute(attr, def[key]);
                else if (original != null) tspan.setAttribute(attr, original);
                else if (attr === 'stroke') tspan.setAttribute(attr, 'none');
                else if (attr === 'stroke-width') tspan.setAttribute(attr, '0');
            }
            tspan.setAttribute('font-size', sizeForLine(i));
            tspan.setAttribute("x", xPos);
            tspan.setAttribute("y", baselineForLine(i));
            tspan.textContent = line;
            newTextNode.appendChild(tspan);
        });
        
        firstNode.replaceWith(newTextNode);
        
        return { overflow, fontSize, lines: lines.length, lineFontSizes: lines.map((_, index) => sizeForLine(index)) };
    }

    function updateImage(svg, id, dataUrl, crop = {}) {
        const img = svg.getElementById(id);
        if (!img) throw new Error("Image not found: " + id);
        
        const zoom = Math.max(0.2, Math.min(3, crop.zoom || 1));
        const offsetX = Math.max(-1, Math.min(1, crop.offsetX || 0));
        const offsetY = Math.max(-1, Math.min(1, crop.offsetY || 0));
        
        let originalBox;
        try { originalBox = JSON.parse(img.getAttribute('data-editor-image-box') || 'null'); } catch (_) {}
        if (!originalBox) {
            originalBox = {x: parseFloat(img.getAttribute('x')) || 0, y: parseFloat(img.getAttribute('y')) || 0,
                width: parseFloat(img.getAttribute('width')) || 0, height: parseFloat(img.getAttribute('height')) || 0};
            img.setAttribute('data-editor-image-box', JSON.stringify(originalBox));
        }
        const {x: origX, y: origY, width: origW, height: origH} = originalBox;
        const sourceWidth = Number(crop.sourceWidth), sourceHeight = Number(crop.sourceHeight);
        const hasDimensions = Number.isFinite(sourceWidth) && sourceWidth > 0 && Number.isFinite(sourceHeight) && sourceHeight > 0;
        const coverScale = hasDimensions ? Math.max(origW / sourceWidth, origH / sourceHeight) : 1;
        
        const newW = (hasDimensions ? sourceWidth * coverScale : origW) * zoom;
        const newH = (hasDimensions ? sourceHeight * coverScale : origH) * zoom;
        
        const excessW = newW - origW;
        const excessH = newH - origH;
        
        const newX = origX + (origW - newW) / 2 + offsetX * (Math.abs(excessW) / 2);
        const newY = origY + (origH - newH) / 2 + offsetY * (Math.abs(excessH) / 2);
        
        img.setAttribute("x", newX);
        img.setAttribute("y", newY);
        img.setAttribute("width", newW);
        img.setAttribute("height", newH);
        img.setAttribute("preserveAspectRatio", "xMidYMid slice");
        
        img.setAttribute("href", dataUrl);
        img.setAttributeNS(XLINK_NS, "xlink:href", dataUrl);
    }

    function exportSVG(svg) {
        const clone = svg.cloneNode(true);
        clone.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", SVG_NS);
        clone.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", XLINK_NS);
        
        const serializer = new XMLSerializer();
        const xmlString = serializer.serializeToString(clone);
        
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
    }

    async function exportPNG(svg, width, height, scale = 1) {
        if (![width,height,scale].every(n => Number.isFinite(n) && n > 0)) throw new Error("PNG dimensions and scale must be positive numbers");
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        
        const clone = svg.cloneNode(true);
        clone.setAttribute("width", width);
        clone.setAttribute("height", height);
        
        const svgString = exportSVG(clone);
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        
        try {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error("Failed to load SVG image"));
                img.src = url;
            });
            
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);
            
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            return new Promise((resolve, reject) => {
                canvas.toBlob((pngBlob) => {
                    if (pngBlob) resolve(pngBlob);
                    else reject(new Error("Failed to generate PNG"));
                }, "image/png");
            });
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    window.TemplateCore = Object.freeze({
        parseSVG,
        editTextBlock,
        updateImage,
        exportSVG,
        exportPNG
    });
})();
