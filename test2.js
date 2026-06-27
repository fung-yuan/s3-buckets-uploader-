try {
  const e = require("electron");
  console.log("TYPE:", typeof e);
  console.log("KEYS:", JSON.stringify(Object.keys(e || {}).slice(0,5)));
  
  // Try accessing app via process
  console.log("process.type:", process.type);
} catch(err) {
  console.log("ERROR:", err.message);
}
process.exit(0)
