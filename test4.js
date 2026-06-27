const fs = require("fs");
let results = {};
try { const e = require("electron"); results.electron = typeof e; } catch(ex) { results.electron_err = ex.message; }
try { const e = require("electron/main"); results.electronMain = typeof e; if(typeof e === "object") results.electronMainKeys = Object.keys(e).slice(0,5); } catch(ex) { results.electronMain_err = ex.message; }
fs.writeFileSync("C:/Users/dell/Downloads/s3-uploader/debug2.json", JSON.stringify(results, null, 2));
process.exit(0)
