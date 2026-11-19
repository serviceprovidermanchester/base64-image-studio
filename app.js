/**
 * Base64 Image Studio — Enterprise Client-Side Converter
 * Copyright (c) 2026 SPManchester Private Limited.
 * Author: Sayed Mudassar Akbar <info@spmanchester.com>
 * Licensed under the MIT License.
 */

"use strict";

(function () {
  // Application Configuration
  const CONFIG = {
    source: "BASE64",
    target: "JPG",
    appName: "Base64 Image Studio",
    vendor: "SPManchester Private Limited",
    maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
    maxMegaPixels: 36,
  };

  // DOM Query Utility
  const $ = (id) => document.getElementById(id);

  // Core DOM Elements
  const input = $("file-input");
  const drop = $("dropzone");
  const queueEl = $("queue");
  const resultsEl = $("results-list");
  const targetFormatSelect = $("target-format");
  const outputBadge = $("output-badge");
  const flowTargetSquare = $("flow-target-square");
  const heroTargetPill = $("hero-target-pill");
  const convertLabel = $("convert-label");
  const sizeSelect = $("size-select");
  const customBox = $("custom-box");
  const customWidthInput = $("custom-width");
  const qualityControl = $("quality-control");
  const qualitySlider = $("quality");
  const qualityValue = $("quality-value");
  const convertBtn = $("convert-btn");
  const clearBtn = $("clear-btn");
  const base64TextArea = $("base64-text");
  const addBase64Btn = $("add-base64");
  const resultsSection = $("results-section");
  const resultCount = $("result-count");
  const downloadAllBtn = $("download-all");
  const statusText = $("status-text");

  // State
  const files = [];
  const converted = [];
  const state = { busy: false };

  // File Extensions & MIME Types
  const EXT = {
    PNG: "png",
    JPG: "jpg",
    WEBP: "webp",
    GIF: "gif",
    BMP: "bmp",
    ICO: "ico",
    SVG: "svg",
    AVIF: "avif",
    PDF: "pdf",
    BASE64: "txt",
  };

  const MIME = {
    PNG: "image/png",
    JPG: "image/jpeg",
    WEBP: "image/webp",
    GIF: "image/gif",
    BMP: "image/bmp",
    ICO: "image/x-icon",
    SVG: "image/svg+xml",
    AVIF: "image/avif",
  };

  // Human-readable file size formatter
  function formatBytes(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  }

  // HTML entity escaping
  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[char];
    });
  }

  // Set status text
  function setStatus(msg) {
    statusText.textContent = msg;
  }

  /**
   * Smart Base64 to Blob parser
   * Handles complete data URLs (data:image/...;base64,...)
   * as well as raw Base64 strings.
   */
  function parseBase64ToBlob(rawInput) {
    if (!rawInput || typeof rawInput !== "string") {
      throw new Error("Input string is empty.");
    }

    let cleaned = rawInput.trim();
    // Strip surrounding quotes if present
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    // Check if it's already a complete Data URL
    const dataUrlRegex = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i;
    const match = dataUrlRegex.exec(cleaned);

    let mime = "image/png";
    let base64Data = cleaned;

    if (match) {
      mime = match[1] || "image/png";
      const isBase64 = Boolean(match[2]);
      const payload = match[3];

      if (!/^image\/(?:png|jpeg|jpg|webp|gif|bmp|svg\+xml|avif|x-icon|vnd\.microsoft\.icon)$/i.test(mime)) {
        throw new Error(`Unsupported image MIME type: ${mime}`);
      }

      const decodedStr = isBase64
        ? atob(payload.replace(/\s/g, ""))
        : decodeURIComponent(payload);

      const byteArr = new Uint8Array(decodedStr.length);
      for (let i = 0; i < decodedStr.length; i++) {
        byteArr[i] = decodedStr.charCodeAt(i);
      }
      return new Blob([byteArr], { type: mime });
    }

    // Raw Base64 string fallback: detect header or assume PNG
    try {
      const cleanRaw = cleaned.replace(/\s/g, "");
      const decodedStr = atob(cleanRaw);
      const byteArr = new Uint8Array(decodedStr.length);
      for (let i = 0; i < decodedStr.length; i++) {
        byteArr[i] = decodedStr.charCodeAt(i);
      }

      // Check magic numbers for common image headers
      if (byteArr[0] === 0xff && byteArr[1] === 0xd8 && byteArr[2] === 0xff) {
        mime = "image/jpeg";
      } else if (
        byteArr[0] === 0x89 &&
        byteArr[1] === 0x50 &&
        byteArr[2] === 0x4e &&
        byteArr[3] === 0x47
      ) {
        mime = "image/png";
      } else if (
        byteArr[0] === 0x47 &&
        byteArr[1] === 0x49 &&
        byteArr[2] === 0x46
      ) {
        mime = "image/gif";
      } else if (byteArr[0] === 0x42 && byteArr[1] === 0x4d) {
        mime = "image/bmp";
      } else if (
        byteArr[0] === 0x52 &&
        byteArr[1] === 0x49 &&
        byteArr[2] === 0x46 &&
        byteArr[3] === 0x46
      ) {
        mime = "image/webp";
      }

      return new Blob([byteArr], { type: mime });
    } catch (e) {
      throw new Error(
        "Invalid Base64 payload. Please paste a valid Data URL or raw base64 string."
      );
    }
  }

  // Format synchronization
  function onTargetFormatChange() {
    CONFIG.target = targetFormatSelect.value;
    const tgt = CONFIG.target;

    outputBadge.textContent = `OUTPUT · ${tgt}`;
    flowTargetSquare.textContent = tgt;
    heroTargetPill.textContent = tgt;
    convertLabel.textContent = `Convert to ${tgt}`;

    // Manage quality slider visibility (lossy vs lossless)
    if (["JPG", "WEBP", "PDF"].includes(tgt)) {
      qualityControl.hidden = false;
    } else {
      qualityControl.hidden = true;
    }

    setStatus(`Target format switched to ${tgt}`);
  }

  // Add files to queue
  async function addFiles(fileList) {
    let added = 0;
    for (const file of fileList) {
      if (file.size > CONFIG.maxFileSizeBytes) {
        setStatus(`Skipped ${file.name}: file exceeds 50 MB limit`);
        continue;
      }

      const isText =
        file.name.toLowerCase().endsWith(".txt") ||
        file.name.toLowerCase().endsWith(".b64") ||
        file.type.includes("text");

      if (isText) {
        try {
          const text = await file.text();
          const blob = parseBase64ToBlob(text);
          files.push({
            file: blob,
            name: file.name.replace(/\.(txt|b64)$/i, "") || "base64-image",
            originalFile: file,
          });
          added++;
        } catch (err) {
          setStatus(`Error reading ${file.name}: ${err.message}`);
        }
      } else {
        // Direct image file passed
        files.push({
          file: file,
          name: file.name.replace(/\.[^/.]+$/, "") || "image",
          originalFile: file,
        });
        added++;
      }
    }

    if (added) {
      setStatus(`${added} file(s) added to queue`);
    }
    renderQueue();
  }

  // Render Queue UI
  function renderQueue() {
    queueEl.innerHTML = "";
    $("queue-count").textContent = files.length;
    clearBtn.disabled = !files.length || state.busy;
    convertBtn.disabled = !files.length || state.busy;

    if (!files.length) {
      queueEl.innerHTML =
        '<div class="empty-state">No files added yet. Drop files or paste strings above.</div>';
      return;
    }

    files.forEach((entry, i) => {
      const row = document.createElement("div");
      row.className = "queue-item";

      const thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.alt = "";
      const thumbUrl = URL.createObjectURL(entry.file);
      thumb.src = thumbUrl;
      thumb.onload = () => URL.revokeObjectURL(thumbUrl);
      thumb.onerror = () => URL.revokeObjectURL(thumbUrl);

      const detail = document.createElement("div");
      detail.className = "file-details";
      detail.innerHTML = `<strong>${escapeHTML(
        entry.name
      )}</strong><span>${formatBytes(entry.file.size)}</span>`;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.innerHTML = "&times;";
      removeBtn.title = `Remove ${entry.name}`;
      removeBtn.setAttribute("aria-label", `Remove ${entry.name}`);
      removeBtn.disabled = state.busy;
      removeBtn.onclick = () => {
        files.splice(i, 1);
        renderQueue();
      };

      row.append(thumb, detail, removeBtn);
      queueEl.append(row);
    });
  }

  // Clear results
  function clearResults() {
    for (const item of converted) {
      URL.revokeObjectURL(item.url);
    }
    converted.length = 0;
    resultsEl.innerHTML = "";
    resultsSection.hidden = true;
  }

  // Decode Image
  function decodeImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(
          new Error("Could not decode image; format may be corrupt or unsupported.")
        );
      };
      img.src = url;
    });
  }

  // Calculate target dimensions
  function calculateDimensions(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    if (!w || !h || w * h > CONFIG.maxMegaPixels * 1000000) {
      throw new Error(`Image exceeds ${CONFIG.maxMegaPixels} megapixel safety limit.`);
    }

    const opt = sizeSelect.value;
    let targetWidth =
      opt === "custom"
        ? Number(customWidthInput.value)
        : Math.round(w * Number(opt));

    if (!Number.isFinite(targetWidth) || targetWidth < 1 || targetWidth > 16000) {
      throw new Error("Target width must be between 1 and 16,000 pixels.");
    }

    const targetHeight = Math.max(1, Math.round((targetWidth * h) / w));

    if (targetWidth * targetHeight > CONFIG.maxMegaPixels * 1000000) {
      throw new Error(
        `Target resolution exceeds ${CONFIG.maxMegaPixels} megapixel safety threshold.`
      );
    }

    return [targetWidth, targetHeight];
  }

  // Create configured Canvas
  function createRenderCanvas(img, targetFormat) {
    const [w, h] = calculateDimensions(img);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { willReadFrequently: targetFormat === "BMP" });
    if (!ctx) throw new Error("Canvas 2D context initialization failed.");

    // Solid white background for formats that lack alpha support
    if (["JPG", "BMP", "PDF"].includes(targetFormat)) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }

  // Canvas to standard Blob
  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error(`Browser failed to encode format ${mimeType}`));
            return;
          }
          resolve(blob);
        },
        mimeType,
        quality
      );
    });
  }

  // Uncompressed 24-bit Windows Bitmap encoder
  function createBitmapBlob(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const stride = w * 3 + ((4 - ((w * 3) % 4)) % 4);
    const bytes = new Uint8Array(54 + stride * h);
    const view = new DataView(bytes.buffer);

    bytes[0] = 66; // 'B'
    bytes[1] = 77; // 'M'
    view.setUint32(2, bytes.length, true);
    view.setUint32(10, 54, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, w, true);
    view.setInt32(22, h, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(34, stride * h, true);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = (y * w + x) * 4;
        const dst = 54 + (h - y - 1) * stride + x * 3;
        bytes[dst] = rgba[src + 2]; // B
        bytes[dst + 1] = rgba[src + 1]; // G
        bytes[dst + 2] = rgba[src]; // R
      }
    }
    return new Blob([bytes], { type: "image/bmp" });
  }

  // Standard 256x256 Windows Icon (.ico) encoder
  async function createIcoBlob(canvas) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const cx = c.getContext("2d");
    const s = Math.min(256 / canvas.width, 256 / canvas.height);
    const w = Math.round(canvas.width * s);
    const h = Math.round(canvas.height * s);
    cx.drawImage(canvas, (256 - w) / 2, (256 - h) / 2, w, h);

    const pngBlob = await canvasToBlob(c, "image/png");
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const out = new Uint8Array(22 + pngBytes.length);
    const v = new DataView(out.buffer);

    v.setUint16(0, 0, true);
    v.setUint16(2, 1, true);
    v.setUint16(4, 1, true);
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    v.setUint16(10, 1, true);
    v.setUint16(12, 32, true);
    v.setUint32(14, pngBytes.length, true);
    v.setUint32(18, 22, true);
    out.set(pngBytes, 22);

    return new Blob([out], { type: "image/x-icon" });
  }

  // Minimal standalone PDF Document Generator
  async function createPdfBlob(canvas) {
    const q = Number(qualitySlider.value) / 100;
    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", q);
    const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());

    const width = canvas.width;
    const height = canvas.height;
    const pageW = 595.28;
    const pageH = 841.89;
    const margin = 28;
    const scale = Math.min((pageW - 2 * margin) / width, (pageH - 2 * margin) / height);
    const w = width * scale;
    const h = height * scale;
    const x = ((pageW - w) / 2).toFixed(2);
    const y = ((pageH - h) / 2).toFixed(2);

    const encoder = new TextEncoder();
    const ascii = (txt) => encoder.encode(txt);

    const content = ascii(
      `q\n${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x} ${y} cm\n/Im1 Do\nQ\n`
    );

    const segments = [];
    const offsets = [0];
    let pos = 0;

    function append(chunk) {
      segments.push(chunk);
      pos += chunk.length;
    }

    function addObj(num, parts) {
      offsets[num] = pos;
      append(ascii(`${num} 0 obj\n`));
      for (const p of parts) {
        append(typeof p === "string" ? ascii(p) : p);
      }
      append(ascii("\nendobj\n"));
    }

    append(ascii("%PDF-1.4\n%\xD0\xD0\xD0\xD0\n"));
    addObj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    addObj(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
    addObj(3, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`,
    ]);
    addObj(4, [
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      jpeg,
      "\nendstream",
    ]);
    addObj(5, [`<< /Length ${content.length} >>\nstream\n`, content, "endstream"]);

    const xref = pos;
    append(ascii("xref\n0 6\n0000000000 65535 f \n"));
    for (let i = 1; i <= 5; i++) {
      append(ascii(String(offsets[i]).padStart(10, "0") + " 00000 n \n"));
    }
    append(ascii(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));

    return new Blob(segments, { type: "application/pdf" });
  }

  // Scalable Vector Graphic (SVG) Wrapper
  async function createSvgBlob(canvas) {
    const pngBlob = await canvasToBlob(canvas, "image/png");
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 32768) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
    }
    const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="100%" height="100%" href="data:image/png;base64,${btoa(bin)}"/></svg>`;
    return new Blob([svgXml], { type: "image/svg+xml" });
  }

  // Convert single entry
  async function convertSingleEntry(entry) {
    const img = await decodeImage(entry.file);
    const target = CONFIG.target;
    const canvas = createRenderCanvas(img, target);
    const quality = Number(qualitySlider.value) / 100;
    let blob;

    if (["PNG", "JPG", "WEBP"].includes(target)) {
      blob = await canvasToBlob(canvas, MIME[target], quality);
    } else if (target === "BMP") {
      blob = createBitmapBlob(canvas);
    } else if (target === "ICO") {
      blob = await createIcoBlob(canvas);
    } else if (target === "SVG") {
      blob = await createSvgBlob(canvas);
    } else if (target === "PDF") {
      blob = await createPdfBlob(canvas);
    } else {
      throw new Error(`Unsupported output target: ${target}`);
    }

    const baseName = entry.name.replace(/\.[^.]+$/, "") || "converted-image";
    const finalName = `${baseName}.${EXT[target]}`;

    return {
      blob,
      name: finalName,
      width: canvas.width,
      height: canvas.height,
    };
  }

  // Render converted outputs
  function renderResults() {
    resultsEl.innerHTML = "";
    for (const item of converted) {
      const row = document.createElement("div");
      row.className = "result-item";

      const icon = document.createElement("span");
      icon.className = "square out-square";
      icon.textContent = CONFIG.target;

      const detail = document.createElement("div");
      detail.className = "file-details";
      detail.innerHTML = `<strong>${escapeHTML(item.name)}</strong><span>${formatBytes(
        item.blob.size
      )} · ${item.width} &times; ${item.height}px</span>`;

      const downloadBtn = document.createElement("button");
      downloadBtn.className = "download-btn";
      downloadBtn.textContent = "Save File ↓";
      downloadBtn.onclick = () => triggerDownload(item.url, item.name);

      row.append(icon, detail, downloadBtn);
      resultsEl.append(row);
    }
  }

  // Trigger file download
  function triggerDownload(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // Standalone PKZIP CRC-32 & Archive Builder
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const u16 = (v) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, v, true);
    return b;
  };
  const u32 = (v) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    return b;
  };
  function concatBuffers(arr) {
    const total = arr.reduce((acc, curr) => acc + curr.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const buf of arr) {
      out.set(buf, offset);
      offset += buf.length;
    }
    return out;
  }

  async function generateZipBlob(items) {
    const encoder = new TextEncoder();
    const parts = [];
    const centralDir = [];
    let offset = 0;

    for (const item of items) {
      const nameBytes = encoder.encode(item.name);
      const dataBytes = new Uint8Array(await item.blob.arrayBuffer());
      const crc = crc32(dataBytes);
      const len = dataBytes.length;

      const localHeader = concatBuffers([
        u32(0x04034b50),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(len),
        u32(len),
        u16(nameBytes.length),
        u16(0),
        nameBytes,
      ]);

      parts.push(localHeader, dataBytes);

      const centralEntry = concatBuffers([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(len),
        u32(len),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]);
      centralDir.push(centralEntry);

      offset += localHeader.length + dataBytes.length;
    }

    const centralBuffer = concatBuffers(centralDir);
    const endOfCentralDir = concatBuffers([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(items.length),
      u16(items.length),
      u32(centralBuffer.length),
      u32(offset),
      u16(0),
    ]);

    return new Blob([...parts, centralBuffer, endOfCentralDir], {
      type: "application/zip",
    });
  }

  // Conversion Trigger
  convertBtn.onclick = async () => {
    if (state.busy || !files.length) return;

    state.busy = true;
    clearResults();
    renderQueue();
    convertLabel.textContent = "Processing...";

    let succeeded = 0;
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      setStatus(`Converting ${i + 1} of ${files.length}...`);
      try {
        const item = await convertSingleEntry(files[i]);
        converted.push({
          ...item,
          url: URL.createObjectURL(item.blob),
        });
        succeeded++;
      } catch (err) {
        errors.push(`${files[i].name}: ${err?.message || "Unknown error"}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    state.busy = false;
    renderQueue();
    convertLabel.textContent = `Convert to ${CONFIG.target}`;

    if (succeeded) {
      resultsSection.hidden = false;
      resultCount.textContent = succeeded;
      renderResults();
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const report =
      `${succeeded} converted` +
      (errors.length
        ? ` · ${errors.length} failed: ${errors.slice(0, 2).join(" | ")}`
        : ` · Ready to download`);
    setStatus(report);
  };

  // ZIP Download Action
  downloadAllBtn.onclick = async () => {
    try {
      setStatus("Compiling uncompressed ZIP archive...");
      const zipBlob = await generateZipBlob(converted);
      const zipUrl = URL.createObjectURL(zipBlob);
      triggerDownload(zipUrl, `base64-converted-${CONFIG.target.toLowerCase()}.zip`);
      setTimeout(() => URL.revokeObjectURL(zipUrl), 60000);
      setStatus("ZIP archive downloaded successfully.");
    } catch (err) {
      setStatus(`ZIP Generation Error: ${err.message}`);
    }
  };

  // Event Listeners & Binding
  targetFormatSelect.addEventListener("change", onTargetFormatChange);

  sizeSelect.onchange = () => {
    customBox.hidden = sizeSelect.value !== "custom";
  };

  qualitySlider.oninput = () => {
    qualityValue.textContent = qualitySlider.value + "%";
  };

  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });

  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    addFiles(e.dataTransfer.files);
  });

  input.addEventListener("change", (e) => {
    addFiles(e.target.files);
    input.value = "";
  });

  addBase64Btn.onclick = () => {
    const val = base64TextArea.value.trim();
    if (!val) {
      setStatus("Please paste a Base64 string or data URL first.");
      return;
    }
    try {
      const blob = parseBase64ToBlob(val);
      if (blob.size > CONFIG.maxFileSizeBytes) {
        throw new Error("Pasted image exceeds 50 MB safety threshold.");
      }
      files.push({
        file: blob,
        name: `pasted-${Date.now()}`,
        originalFile: blob,
      });
      base64TextArea.value = "";
      renderQueue();
      setStatus("Pasted Base64 image added to queue.");
    } catch (err) {
      setStatus(`Parse error: ${err.message}`);
    }
  };

  clearBtn.onclick = () => {
    files.length = 0;
    input.value = "";
    clearResults();
    renderQueue();
    setStatus("Queue cleared");
  };

  // Initialize
  onTargetFormatChange();
})();
