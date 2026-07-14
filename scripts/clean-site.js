const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "_site");

if (!output.startsWith(root + path.sep)) {
  throw new Error(`Refusing to clean outside the project: ${output}`);
}

fs.rmSync(output, { recursive: true, force: true });
console.log("Cleaned", output);
