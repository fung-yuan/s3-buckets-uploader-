const fs = require("fs");
const e = require("electron");
const info = {
  type: typeof e,
  processType: process.type,
  isString: typeof e === "string",
  keys: typeof e === "object" ? Object.keys(e).slice(0,8) : []
};
fs.writeFileSync("C:/Users/dell/Downloads/s3-uploader/debug.json", JSON.stringify(info, null, 2));
process.exit(0)
