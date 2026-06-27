const fs = require("fs");
const e = require("electron");
fs.writeFileSync("C:/Users/dell/Downloads/s3-uploader/debug3.json", JSON.stringify({type: typeof e, val: String(e).slice(0,80), keys: typeof e === "object" ? Object.keys(e).slice(0,8) : []}, null, 2));
setTimeout(() => process.exit(0), 500)
