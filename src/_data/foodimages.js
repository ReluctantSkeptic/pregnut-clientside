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

module.exports = imageMap;
