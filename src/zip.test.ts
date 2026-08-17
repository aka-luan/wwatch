import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { crc32, zipFile } from "./zip.js";

test("crc32 matches the known check value", () => {
  assert.equal(crc32(Buffer.from("123456789", "utf8")), 0xcbf43926);
});

test("zipFile writes an archive unzip can read back", () => {
  const body = "<?php\n// wwatch\n";
  const archive = zipFile([{ path: "wwatch/wwatch.php", body }], new Date(0));
  assert.equal(archive.subarray(0, 4).toString("hex"), "504b0304");
  assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);

  const dir = mkdtempSync(join(tmpdir(), "wwatch-zip-"));
  const path = join(dir, "wwatch.zip");
  writeFileSync(path, archive);
  try {
    execFileSync("unzip", ["-q", path, "-d", dir]);
  } catch (error) {
    // No unzip on this machine: the header checks above still stand.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
  assert.equal(readFileSync(join(dir, "wwatch", "wwatch.php"), "utf8"), body);
});
