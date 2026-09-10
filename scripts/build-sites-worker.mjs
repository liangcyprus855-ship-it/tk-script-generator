import { mkdirSync, copyFileSync } from "node:fs";
mkdirSync("dist/server", { recursive: true });
copyFileSync("sites-worker/index.js", "dist/server/index.js");
console.log("Sites Worker built: dist/server/index.js");
