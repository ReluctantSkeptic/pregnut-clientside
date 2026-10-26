const fs = require("fs");
const path = require("path");

const imageDirectory = path.join(__dirname, "../resource/portions/top-foods");
const imageMap = new Map();

if (fs.existsSync(imageDirectory)) {
  for (const filename of fs.readdirSync(imageDirectory)) {
    if (!/\.webp$/i.test(filename)) continue;
    const match = filename.match(/^(\d+)-/);
    if (!match) continue;
    imageMap.set(match[1], `/resource/portions/top-foods/${filename}`);
  }
}

// Every food photo is shown as its cut-out (no background) when one exists.
const cutoutDirectory = path.join(__dirname, "../resource/portions/cutouts");
const cutouts = new Set(fs.existsSync(cutoutDirectory) ? fs.readdirSync(cutoutDirectory) : []);
for (const [id, src] of imageMap) {
  const name = path.basename(src);
  if (cutouts.has(name)) imageMap.set(id, `/resource/portions/cutouts/${name}`);
}

module.exports = imageMap;
