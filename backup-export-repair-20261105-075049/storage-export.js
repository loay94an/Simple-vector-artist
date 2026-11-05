import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";


/* =========================================================
   RASEM 2.0
   STORAGE & EXPORT MODULE

   Includes:
   - DocumentFormat
   - StorageManager
   - Autosave
   - SVGExport
   - PNGExport
   - PDFExport

   No external dependencies required.
========================================================= */

const RASEM_FORMAT = "rasem-document";
const RASEM_VERSION = "2.0";
const DEFAULT_STORAGE_KEY = "rasem-2-document";

const SVG_NS = "http://www.w3.org/2000/svg";


// =========================================================
// SHARED HELPERS
// =========================================================

function cloneData(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `rasem-${Date.now()}-${Math.random()
      .toString(36).slice(2)}`;
}

function escapeXML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function downloadBlob(blob, filename) {
  if (!(blob instanceof Blob)) {
    throw new TypeError("Invalid export Blob");
  }

  // Native Android: save the file in cache and open the system share sheet.


  if (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android"
  ) {



    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(
        reader.error || new Error("Unable to read exported file")
      );
      reader.readAsDataURL(blob);
    });

    const base64 = String(dataUrl).split(",")[1];

    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true
    });

    await Share.share({
      title: filename,
      text: "ملف تم تصديره من رسام فكتور بسيط",
      url: savedFile.uri,
      dialogTitle: "مشاركة أو حفظ الملف"
    });

    return true;
  }

  // Regular browser download.
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return true;
}

function normalizeFilename(name, extension) {
  const safeName = String(name || "rasem-drawing")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();

  const base = safeName || "rasem-drawing";

  return base.toLowerCase().endsWith(`.${extension}`)
    ? base
    : `${base}.${extension}`;
}


// =========================================================
// 1. DOCUMENT FORMAT
// =========================================================

export class DocumentFormat {

  static VERSION = RASEM_VERSION;

  static create(data = {}) {
    const now = Date.now();

    return {
      format: RASEM_FORMAT,
      version: RASEM_VERSION,

      id: data.id || createId(),

      name: String(data.name || "رسم جديد"),

      camera: {
        x: safeNumber(data.camera?.x),
        y: safeNumber(data.camera?.y),
        zoom: clamp(
          safeNumber(data.camera?.zoom, 1),
          0.05,
          100
        ),
        rotation: safeNumber(data.camera?.rotation)
      },

      activeLayerId: data.activeLayerId || null,

      layers: Array.isArray(data.layers)
        ? cloneData(data.layers)
        : [],

      createdAt: safeNumber(data.createdAt, now),
      updatedAt: now
    };
  }

  static validate(data) {
    if (!isObject(data)) {
      return {
        valid: false,
        errors: ["المستند ليس كائناً صالحاً"]
      };
    }

    const errors = [];

    if (
      data.format !== undefined &&
      data.format !== RASEM_FORMAT
    ) {
      errors.push("صيغة المستند غير مدعومة");
    }

    if (!Array.isArray(data.layers)) {
      errors.push("قائمة الطبقات غير صالحة");
    }

    if (Array.isArray(data.layers)) {
      const ids = new Set();

      data.layers.forEach((layer, index) => {
        if (!isObject(layer)) {
          errors.push(`الطبقة ${index} غير صالحة`);
          return;
        }

        if (
          typeof layer.id !== "string" ||
          !layer.id.trim()
        ) {
          errors.push(`معرف الطبقة ${index} غير صالح`);
        } else if (ids.has(layer.id)) {
          errors.push(`معرف الطبقة ${index} مكرر`);
        } else {
          ids.add(layer.id);
        }

        if (!Array.isArray(layer.elements)) {
          errors.push(
            `عناصر الطبقة ${index} غير صالحة`
          );
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static normalize(data) {
    if (!isObject(data)) {
      throw new TypeError("Invalid document data");
    }

    const source = cloneData(data);

    const layers = Array.isArray(source.layers)
      ? source.layers
      : [];

    const normalizedLayers = [];
    const layerIds = new Set();

    for (const layer of layers) {
      if (!isObject(layer)) continue;

      if (
        typeof layer.id !== "string" ||
        !layer.id.trim() ||
        layerIds.has(layer.id)
      ) {
        continue;
      }

      layerIds.add(layer.id);

      const elements = Array.isArray(layer.elements)
        ? layer.elements.filter(element =>
            isObject(element) &&
            typeof element.id === "string" &&
            element.id.length > 0
          )
        : [];

      normalizedLayers.push({
        ...layer,

        name: String(layer.name || "طبقة"),

        visible: layer.visible !== false,

        locked: layer.locked === true,

        opacity: clamp(
          safeNumber(layer.opacity, 1),
          0,
          1
        ),

        elements
      });
    }

    if (!normalizedLayers.length) {
      const id = createId();

      normalizedLayers.push({
        id,
        name: "الطبقة الأولى",
        visible: true,
        locked: false,
        opacity: 1,
        elements: []
      });
    }

    const activeLayer = normalizedLayers.find(
      layer => layer.id === source.activeLayerId
    );

    const now = Date.now();

    return {
      format: RASEM_FORMAT,
      version: RASEM_VERSION,

      id: String(source.id || createId()),

      name: String(source.name || "رسم جديد"),

      camera: {
        x: safeNumber(source.camera?.x),
        y: safeNumber(source.camera?.y),

        zoom: clamp(
          safeNumber(source.camera?.zoom, 1),
          0.05,
          100
        ),

        rotation: safeNumber(
          source.camera?.rotation
        )
      },

      activeLayerId: activeLayer
        ? activeLayer.id
        : normalizedLayers[0].id,

      layers: normalizedLayers,

      createdAt: safeNumber(source.createdAt, now),
      updatedAt: safeNumber(source.updatedAt, now)
    };
  }

  static serialize(documentData, pretty = false) {
    const normalized = this.normalize(documentData);

    return JSON.stringify(
      normalized,
      null,
      pretty ? 2 : 0
    );
  }

  static parse(json) {
    if (typeof json !== "string") {
      throw new TypeError("Document JSON must be a string");
    }

    const parsed = JSON.parse(json);

    const result = this.validate(parsed);

    if (!result.valid) {
      throw new Error(
        `Invalid document: ${result.errors.join(", ")}`
      );
    }

    return this.normalize(parsed);
  }

  static importFile(file) {
    if (!(file instanceof Blob)) {
      return Promise.reject(
        new TypeError("Invalid import file")
      );
    }

    return file.text().then(text => this.parse(text));
  }

  static exportFile(documentData) {
    const json = this.serialize(documentData, true);

    return new Blob(
      [json],
      { type: "application/json;charset=utf-8" }
    );
  }
}


// =========================================================
// 2. STORAGE MANAGER
// =========================================================

export class StorageManager {

  constructor(documentModel, options = {}) {
    if (!documentModel) {
      throw new TypeError(
        "StorageManager requires a document model"
      );
    }

    this.document = documentModel;

    this.storage = options.storage ??
      globalThis.localStorage;

    this.key = options.key || DEFAULT_STORAGE_KEY;

    this.backupKey = `${this.key}-backup`;

    this.memoryCache = new Map();

    this.destroyed = false;
  }

  getDocumentData() {
    if (typeof this.document.toJSON === "function") {
      return this.document.toJSON();
    }

    return cloneData(this.document);
  }

  save() {
    if (this.destroyed) return false;

    let json = "";
    try {
      const data = this.getDocumentData();
      json = DocumentFormat.serialize(data);
      this.memoryCache.set(this.key, json);

      if (this.storage) {
        try {
          const previous = this.storage.getItem(this.key);
          if (previous) {
            this.storage.setItem(this.backupKey, previous);
          }
          this.storage.setItem(this.key, json);
          return true;
        } catch (firstErr) {
          // Fallback if quota exceeded: remove backup and retry once
          try {
            this.storage.removeItem(this.backupKey);
            this.storage.setItem(this.key, json);
            return true;
          } catch (quotaErr) {
            console.warn("Storage quota exceeded in browser, state preserved in memory cache:", quotaErr);
            return true;
          }
        }
      }

      return true;

    } catch (error) {
      console.warn("Rasem save serialization failed:", error);
      return false;
    }
  }

  load() {
    if (this.destroyed) return null;

    try {
      let json = null;
      if (this.storage) {
        try {
          json = this.storage.getItem(this.key);
        } catch {}
      }

      if (!json) {
        json = this.memoryCache.get(this.key) || null;
      }

      if (!json) return null;

      const data = DocumentFormat.parse(json);

      if (!data || typeof data !== "object") {
        throw new Error("Invalid saved document");
      }

      return data;

    } catch (error) {
      console.error("Rasem load failed:", error);
      return null;
    }
  }

  restore() {
    const data = this.load();

    if (!data) {
      return false;
    }

    try {
      if (typeof this.document.fromJSON === "function") {
        this.document.fromJSON(data);
      } else {
        if (
          !Array.isArray(this.document.layers)
        ) {
          return false;
        }

        this.document.id = data.id;
        this.document.name = data.name;
        this.document.camera = data.camera;
        this.document.layers = data.layers;
        this.document.activeLayerId =
          data.activeLayerId;
        this.document.createdAt = data.createdAt;
        this.document.updatedAt = data.updatedAt;
      }

      return true;

    } catch (error) {
      console.error("Rasem restore failed:", error);
      return false;
    }
  }

  restoreBackup() {
    if (this.destroyed) return false;

    try {
      const json = this.storage.getItem(
        this.backupKey
      );

      if (!json) return false;

      const data = DocumentFormat.parse(json);

      if (typeof this.document.fromJSON === "function") {
        this.document.fromJSON(data);
      } else {
        Object.assign(this.document, data);
      }

      return true;

    } catch (error) {
      console.error("Backup restore failed:", error);
      return false;
    }
  }

  importFile(file) {
    return DocumentFormat.importFile(file);
  }

  exportFile() {
    try {
      return DocumentFormat.exportFile(
        this.getDocumentData()
      );
    } catch (error) {
      console.error("Document export failed:", error);
      return null;
    }
  }

  download() {
    const blob = this.exportFile();

    if (!blob) return false;

    try {
      const data = this.getDocumentData();

      return downloadBlob(
        blob,
        normalizeFilename(data.name, "rasem")
          .replace(/\.rasem$/, ".json")
      );

    } catch (error) {
      console.error("Download failed:", error);
      return false;
    }
  }

  clear() {
    if (this.destroyed) return false;

    try {
      this.storage.removeItem(this.key);
      this.storage.removeItem(this.backupKey);

      return true;

    } catch (error) {
      console.error("Storage clear failed:", error);
      return false;
    }
  }

  hasSavedDocument() {
    if (this.destroyed) return false;

    try {
      return this.storage.getItem(this.key) !== null;
    } catch {
      return false;
    }
  }

  destroy() {
    this.document = null;
    this.storage = null;
    this.destroyed = true;
  }
}


// =========================================================
// 3. AUTOSAVE
// =========================================================

export class Autosave {

  constructor(storageManager, options = {}) {
    if (!storageManager) {
      throw new TypeError(
        "Autosave requires StorageManager"
      );
    }

    this.storage = storageManager;

    this.delay = clamp(
      safeNumber(options.delay, 1000),
      100,
      60000
    );

    this.enabled = options.enabled !== false;

    this.timer = null;

    this.destroyed = false;

    this.saving = false;

    this.onSave = options.onSave || null;
    this.onError = options.onError || null;
  }

  schedule() {
    if (this.destroyed || !this.enabled) {
      return false;
    }

    clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      this.timer = null;

      if (this.destroyed || !this.enabled) {
        return;
      }

      this.save();
    }, this.delay);

    return true;
  }

  save() {
    if (
      this.destroyed ||
      !this.enabled ||
      this.saving
    ) {
      return false;
    }

    this.saving = true;

    try {
      const success = this.storage.save();

      if (success) {
        this.onSave?.();
      } else {
        this.onError?.(
          new Error("Autosave failed")
        );
      }

      return success;

    } catch (error) {
      this.onError?.(error);
      return false;

    } finally {
      this.saving = false;
    }
  }

  flush() {
    if (this.destroyed) return false;

    clearTimeout(this.timer);
    this.timer = null;

    return this.save();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);

    if (!this.enabled) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    return this.enabled;
  }

  destroy() {
    if (this.destroyed) return;

    clearTimeout(this.timer);

    this.timer = null;

    this.storage = null;

    this.onSave = null;
    this.onError = null;

    this.destroyed = true;
  }
}


// =========================================================
// =========================================================
// 4. CONTENT BOUNDS CALCULATION
// =========================================================

export function calculateContentBounds(documentData, padding = 30) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasElements = false;

  const layers = Array.isArray(documentData?.layers) ? documentData.layers : [];
  for (const layer of layers) {
    if (layer.visible === false) continue;
    const elements = Array.isArray(layer.elements) ? layer.elements : [];
    for (const el of elements) {
      if (el.visible === false) continue;
      const strokeHalf = (safeNumber(el.style?.size, 2) / 2) + 2;

      // 1. Points
      if (Array.isArray(el.points) && el.points.length > 0) {
        for (const pt of el.points) {
          if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
            hasElements = true;
            minX = Math.min(minX, pt.x - strokeHalf);
            minY = Math.min(minY, pt.y - strokeHalf);
            maxX = Math.max(maxX, pt.x + strokeHalf);
            maxY = Math.max(maxY, pt.y + strokeHalf);
          }
        }
      }

      // 2. Geometry
      const g = el.geometry;
      if (g) {
        if (Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.width) && Number.isFinite(g.height)) {
          hasElements = true;
          minX = Math.min(minX, g.x - strokeHalf);
          minY = Math.min(minY, g.y - strokeHalf);
          maxX = Math.max(maxX, g.x + g.width + strokeHalf);
          maxY = Math.max(maxY, g.y + g.height + strokeHalf);
        } else if (Number.isFinite(g.cx) && Number.isFinite(g.cy)) {
          const rx = g.rx ?? g.r ?? 10;
          const ry = g.ry ?? g.r ?? 10;
          hasElements = true;
          minX = Math.min(minX, g.cx - rx - strokeHalf);
          minY = Math.min(minY, g.cy - ry - strokeHalf);
          maxX = Math.max(maxX, g.cx + rx + strokeHalf);
          maxY = Math.max(maxY, g.cy + ry + strokeHalf);
        } else if (Number.isFinite(g.x1) && Number.isFinite(g.y1) && Number.isFinite(g.x2) && Number.isFinite(g.y2)) {
          hasElements = true;
          minX = Math.min(minX, Math.min(g.x1, g.x2) - strokeHalf);
          minY = Math.min(minY, Math.min(g.y1, g.y2) - strokeHalf);
          maxX = Math.max(maxX, Math.max(g.x1, g.x2) + strokeHalf);
          maxY = Math.max(maxY, Math.max(g.y1, g.y2) + strokeHalf);
        } else if (typeof g.points === "string") {
          const pairs = g.points.trim().split(/\s+/);
          for (const pair of pairs) {
            const [px, py] = pair.split(",").map(Number);
            if (Number.isFinite(px) && Number.isFinite(py)) {
              hasElements = true;
              minX = Math.min(minX, px - strokeHalf);
              minY = Math.min(minY, py - strokeHalf);
              maxX = Math.max(maxX, px + strokeHalf);
              maxY = Math.max(maxY, py + strokeHalf);
            }
          }
        }
      }

      // 3. Fallback: Parse path string
      const pathStr = el.path || g?.d;
      if (typeof pathStr === "string" && (!el.points || el.points.length === 0)) {
        const matches = pathStr.matchAll(/[-+]?[0-9]*\.?[0-9]+/g);
        const nums = [];
        for (const m of matches) nums.push(parseFloat(m[0]));
        for (let i = 0; i < nums.length - 1; i += 2) {
          const px = nums[i];
          const py = nums[i + 1];
          if (Number.isFinite(px) && Number.isFinite(py)) {
            hasElements = true;
            minX = Math.min(minX, px - strokeHalf);
            minY = Math.min(minY, py - strokeHalf);
            maxX = Math.max(maxX, px + strokeHalf);
            maxY = Math.max(maxY, py + strokeHalf);
          }
        }
      }
    }
  }

  if (!hasElements) {
    return { x: 0, y: 0, width: 1920, height: 1080 };
  }

  const p = Math.max(0, padding);
  const x = Math.floor(minX - p);
  const y = Math.floor(minY - p);
  const width = Math.max(20, Math.ceil((maxX - minX) + p * 2));
  const height = Math.max(20, Math.ceil((maxY - minY) + p * 2));
  return { x, y, width, height };
}

// =========================================================
// 5. SVG EXPORT
// =========================================================


// =========================================================
// SAFE LARGE EXPORT SCALING
// =========================================================

function getSafeExportScale(bounds, requestedScale = 2, maxPixels = 16000000) {
  const width = Math.max(1, Number(bounds.width) || 1);
  const height = Math.max(1, Number(bounds.height) || 1);

  const requested = Math.max(
    0.01,
    Math.min(8, Number(requestedScale) || 2)
  );

  const maxDimension = 16384;

  const dimensionScale = Math.min(
    maxDimension / width,
    maxDimension / height
  );

  const pixelScale = Math.sqrt(
    maxPixels / width / height
  );

  return Math.max(
    0.000001,
    Math.min(requested, dimensionScale, pixelScale)
  );
}

export class SVGExport {

  static getDimensions(documentData, options = {}) {
    if (options.area && Number.isFinite(options.area.width) && Number.isFinite(options.area.height)) {
      return {
        x: safeNumber(options.area.x, 0),
        y: safeNumber(options.area.y, 0),
        width: Math.max(10, Math.round(options.area.width)),
        height: Math.max(10, Math.round(options.area.height))
      };
    }

    if (options.mode === "canvas") {
      const width = Math.max(1, safeNumber(options.width, 1920));
      const height = Math.max(1, safeNumber(options.height, 1080));
      return { x: 0, y: 0, width, height };
    }

    // Default mode: "full" - automatically calculate full content bounds without clipping!
    return calculateContentBounds(documentData, options.padding ?? 30);
  }

  static getGeometry(element) {
    const tag = element.svgTag ||
      (element.type === "shape"
        ? element.shape
        : "path");

    const allowed = new Set([
      "path",
      "line",
      "rect",
      "circle",
      "ellipse",
      "polygon",
      "polyline",
      "g"
    ]);

    return allowed.has(tag) ? tag : "path";
  }

  static renderElement(element) {
    if (!isObject(element)) return "";

    const style = isObject(element.style) ? element.style : {};
    const geometry = isObject(element.geometry) ? element.geometry : {};

    const tag = this.getGeometry(element);
    const isFillMode = element.renderMode === "fill";

    const customBrush =
      typeof style.customBrush === "string" &&
      style.customBrush.startsWith("data:image/")
        ? style.customBrush
        : null;

    let brushDefs = "";
    let stroke = isFillMode
      ? "none"
      : (style.color ?? "#111111");

    if (customBrush) {
      const size = clamp(safeNumber(style.size, 2), 0, 10000);
      const patternDim = Math.max(12, Math.round(size * 2));

      // Generate a stable, SVG-safe and collision-resistant ID.
      const rawId = String(element.id || "custom");
      let hash = 2166136261;

      for (let i = 0; i < rawId.length; i++) {
        hash ^= rawId.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }

      const safeId = "rasem-export-brush-" +
        (hash >>> 0).toString(16);

      brushDefs = [
        "<defs>",
        `<pattern id="${safeId}" patternUnits="userSpaceOnUse" width="${patternDim}" height="${patternDim}">`,
        `<image href="${escapeXML(customBrush)}" width="${patternDim}" height="${patternDim}" preserveAspectRatio="none"/>`,
        "</pattern>",
        "</defs>"
      ].join("");

      stroke = `url(#${safeId})`;
    }

    const opacity = clamp(safeNumber(style.opacity, 1), 0, 1);

    const attributes = {
      "data-id": element.id,
      d: geometry.d ?? element.path,
      x: geometry.x,
      y: geometry.y,
      x1: geometry.x1,
      y1: geometry.y1,
      x2: geometry.x2,
      y2: geometry.y2,
      cx: geometry.cx,
      cy: geometry.cy,
      r: geometry.r,
      rx: geometry.rx,
      ry: geometry.ry,
      width: geometry.width,
      height: geometry.height,
      points: geometry.points,

      fill: isFillMode
        ? (style.color ?? "#111111")
        : (style.fill ?? "none"),

      stroke,
      "stroke-width": safeNumber(style.size, 2),
      "stroke-opacity": opacity,

      "fill-opacity": isFillMode
        ? opacity
        : (style.fill && style.fill !== "none" ? opacity : undefined),

      "stroke-linecap": style.lineCap || "round",
      "stroke-linejoin": style.lineJoin || "round",
      "stroke-dasharray": style.dashArray,
      transform: element.transform,
      visibility: element.visible === false ? "hidden" : "visible"
    };

    const validAttributes = Object.entries(attributes)
      .filter(([name, value]) => {
        if (value === undefined || value === null) return false;
        return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(name);
      })
      .map(([name, value]) =>
        `${name}="${escapeXML(value)}"`
      )
      .join(" ");

    return `${brushDefs}<${tag} ${validAttributes}/>`;
  }

  static renderLayer(layer) {
    if (!layer || layer.visible === false) return "";

    const elements = Array.isArray(layer.elements) ? layer.elements : [];
    const content = elements
      .map(element => this.renderElement(element))
      .join("");

    return [
      `<g data-layer-id="${escapeXML(layer.id)}"`,
      ` opacity="${clamp(safeNumber(layer.opacity, 1), 0, 1)}">`,
      content,
      "</g>"
    ].join("");
  }

  static generate(documentData, options = {}) {
    const data = DocumentFormat.normalize(documentData);
    const bounds = this.getDimensions(data, options);

    const layers = data.layers
      .map(layer => this.renderLayer(layer))
      .join("");

    const background = options.background
      ? `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${escapeXML(options.background)}"/>`
      : "";

    const content = background + layers;

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="${SVG_NS}"`,
      ` width="${bounds.width}" height="${bounds.height}"`,
      ` viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">`,
      content,
      "</svg>"
    ].join("");
  }

  static export(documentData, options = {}) {
    const svg = this.generate(documentData, options);
    return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  }

  static async download(documentData, options = {}) {
    try {
      const blob = this.export(documentData, options);
      return await downloadBlob(
        blob,
        normalizeFilename(documentData.name, "svg")
      );
    } catch (error) {
      console.error("SVG export failed:", error);
      return false;
    }
  }
}

// =========================================================
// 6. PNG EXPORT
// =========================================================

export class PNGExport {

  static async export(documentData, options = {}) {
    const data = DocumentFormat.normalize(documentData);
    const bounds = SVGExport.getDimensions(data, options);
    const scale = getSafeExportScale(
      bounds,
      options.scale,
      16000000
    );

    const svg = SVGExport.generate(data, options);
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();
      image.decoding = "async";

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Unable to load SVG image for PNG rendering"));
        image.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));

      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Canvas context unavailable");

      if (options.background) {
        context.fillStyle = options.background;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          result => {
            if (!result) return reject(new Error("PNG encoding failed"));
            resolve(result);
          },
          "image/png"
        );
      });

      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  static async download(documentData, options = {}) {
    try {
      const blob = await this.export(documentData, options);
      return downloadBlob(
        blob,
        normalizeFilename(documentData.name, "png")
      );
    } catch (error) {
      console.error("PNG export failed:", error);
      return false;
    }
  }
}

// =========================================================
// 7. DIRECT PDF EXPORT (COMPLIANT PDF 1.4 GENERATOR)
// =========================================================

export class PDFExport {

  static async export(documentData, options = {}) {
    const data = DocumentFormat.normalize(documentData);
    const bounds = SVGExport.getDimensions(data, options);

    // Render image onto high-resolution canvas
    const scale = getSafeExportScale(
      bounds,
      options.scale,
      options.background === null ? 4000000 : 8000000
    );
    const transparent = options.background === null;
    const pdfBackground = transparent
      ? undefined
      : (options.background || "#ffffff");

    const svg = SVGExport.generate(data, {
      ...options,
      background: pdfBackground
    });

    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Failed to load vector image for PDF export"));
        image.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));

      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) throw new Error("PDF canvas context unavailable");
      if (pdfBackground) {
        ctx.fillStyle = pdfBackground;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Prepare image data: JPEG for opaque PDF, RGB + alpha for transparent PDF.
      let imgBytes;
      let alphaBytes;
      if (transparent) {
        const pixels = ctx.getImageData(
          0, 0, canvas.width, canvas.height
        ).data;
        const count = canvas.width * canvas.height;
        imgBytes = new Uint8Array(count * 3);
        alphaBytes = new Uint8Array(count);
        for (let i = 0, rgb = 0, pixel = 0;
             i < pixels.length;
             i += 4, rgb += 3, pixel++) {
          imgBytes[rgb] = pixels[i];
          imgBytes[rgb + 1] = pixels[i + 1];
          imgBytes[rgb + 2] = pixels[i + 2];
          alphaBytes[pixel] = pixels[i + 3];
        }
      } else {
        const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
        const binaryString = atob(jpegDataUrl.split(",")[1]);
        imgBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          imgBytes[i] = binaryString.charCodeAt(i);
        }
      }
      // Build valid standard PDF 1.4 document
      const pdfFit = Math.min(
        1,
        14400 / (Math.max(bounds.width, bounds.height) * 0.75)
      );

      const ptWidth = bounds.width * 0.75 * pdfFit;
      const ptHeight = bounds.height * 0.75 * pdfFit;

      const enc = new TextEncoder();
      const parts = [];

      function write(str) {
        parts.push(enc.encode(str));
      }

      const offsets = [];
      let currentLength = 0;

      function addPart(bytes) {
        parts.push(bytes);
        currentLength += bytes.length;
      }

      function addText(str) {
        const b = enc.encode(str);
        addPart(b);
      }

      // Header
      addText("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

      // Obj 1: Catalog
      offsets[1] = currentLength;
      addText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

      // Obj 2: Pages
      offsets[2] = currentLength;
      addText(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);

      // Obj 3: Page
      offsets[3] = currentLength;
      addText(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth.toFixed(2)} ${ptHeight.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`);

      // Obj 4: Content stream (draw image)
      const streamContent = `q\n${ptWidth.toFixed(2)} 0 0 ${ptHeight.toFixed(2)} 0 0 cm\n/Im1 Do\nQ\n`;
      const streamBytes = enc.encode(streamContent);

      offsets[4] = currentLength;
      addText(
        `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`
      );
      addPart(streamBytes);
      addText("\nendstream\nendobj\n");

      // Obj 5: Main image XObject.
      offsets[5] = currentLength;

      if (transparent) {
        addText(`5 0 obj
<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask 6 0 R /Length ${imgBytes.length} >>
stream
`);
      } else {
        addText(`5 0 obj
<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>
stream
`);
      }

      addPart(imgBytes);
      addText("\nendstream\nendobj\n");

      // Grayscale soft mask carrying pixel transparency.
      if (transparent) {
        offsets[6] = currentLength;
        addText(`6 0 obj
<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${alphaBytes.length} >>
stream
`);
        addPart(alphaBytes);
        addText("\nendstream\nendobj\n");
      }

      // Xref table with dynamic object count.
      const objectCount = transparent ? 6 : 5;
      const xrefOffset = currentLength;

      addText(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);

      for (let i = 1; i <= objectCount; i++) {
        const off = String(offsets[i]).padStart(10, "0");
        addText(`${off} 00000 n \n`);
      }

      // Trailer
      addText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

      return new Blob(parts, { type: "application/pdf" });

    } finally {
      URL.revokeObjectURL(url);
    }
  }

  static async download(documentData, options = {}) {
    try {
      const blob = await this.export(documentData, options);
      return downloadBlob(
        blob,
        normalizeFilename(documentData.name, "pdf")
      );
    } catch (error) {
      console.error("PDF export failed:", error);
      return false;
    }
  }
}


// =========================================================
// END OF STORAGE & EXPORT MODULE
// =========================================================
