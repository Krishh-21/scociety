// Wipes the local SQLite file. The app re-creates and re-seeds it on the next request.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), ".data");
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("Removed .data — the app will reseed on next start.");
} else {
  console.log("Nothing to remove; .data does not exist.");
}
