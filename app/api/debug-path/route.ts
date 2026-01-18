import { type NextRequest, NextResponse } from "next/server";

interface DebugResults {
  environment?: {
    cwd: string;
    execPath: string;
    nodeEnv: string | undefined;
    nextRuntime: string | undefined;
    platform: NodeJS.Platform;
    arch: string;
  };
  importedModule?: string;
  availableMethods?: string[];
  extensionPath?: string;
  fileExists?: boolean;
  fileStats?: {
    size: number;
    isFile: boolean;
    mode: string;
    mtime: Date;
  };
  readable?: boolean;
  readableError?: string;
  directory?: string;
  directoryContents?: string[];
  resolvedPath?: string;
  resolvedPathExists?: boolean;
  pathResolutionError?: string;
  databaseCreated?: boolean;
  directLoadSuccess?: boolean;
  directLoadError?: {
    name: string | undefined;
    message: string;
    code: string | undefined;
    errno: number | undefined;
  };
  vectorFunctionsAvailable?: boolean;
  vectorFunctionError?: string;
  manualLoadSuccess?: boolean;
  manualLoadError?: {
    name: string | undefined;
    message: string;
    code: string | undefined;
    errno: number | undefined;
  };
  vectorFunctionsAfterManualLoad?: boolean;
  vectorFunctionAfterManualLoadError?: string;
}

interface SqliteVecModule {
  load?(db: unknown): void;
  getLoadablePath?(): string;
}

export async function POST(_request: NextRequest) {
  try {
    console.log("🔧 Debugging sqlite-vec path resolution in Next.js");
    console.log("===================================================\n");

    const debugResults: DebugResults = {};

    console.log("1. Environment Information:");
    debugResults.environment = {
      cwd: process.cwd(),
      execPath: process.execPath,
      nodeEnv: process.env.NODE_ENV,
      nextRuntime: process.env.NEXT_RUNTIME,
      platform: process.platform,
      arch: process.arch,
    };
    console.log("   - process.cwd():", process.cwd());
    console.log("   - process.execPath:", process.execPath);
    console.log("   - process.env.NODE_ENV:", process.env.NODE_ENV);
    console.log("   - process.env.NEXT_RUNTIME:", process.env.NEXT_RUNTIME);
    console.log("   - platform:", process.platform);
    console.log("   - arch:", process.arch);

    console.log("\n2. Module paths:");
    console.log("   - module.paths would be available in CommonJS only");

    console.log("\n3. Import sqlite-vec and check paths...");

    // Use Function constructor to prevent bundler from analyzing
    const dynamicImport = new Function("module", "return import(module)") as (
      module: string,
    ) => Promise<SqliteVecModule>;
    let sqliteVec: SqliteVecModule | undefined;

    try {
      sqliteVec = await dynamicImport("sqlite-vec-darwin-arm64");
      console.log("   ✅ sqlite-vec-darwin-arm64 imported successfully");
      debugResults.importedModule = "sqlite-vec-darwin-arm64";
    } catch (e) {
      console.log(
        "   - sqlite-vec-darwin-arm64 failed:",
        e instanceof Error ? e.message : String(e),
      );
      try {
        sqliteVec = await import("sqlite-vec");
        console.log("   ✅ sqlite-vec imported successfully");
        debugResults.importedModule = "sqlite-vec";
      } catch (e2) {
        console.log(
          "   - sqlite-vec also failed:",
          e2 instanceof Error ? e2.message : String(e2),
        );
      }
    }

    if (!sqliteVec) {
      return NextResponse.json({
        success: false,
        error: "Failed to import sqlite-vec module",
        debugResults,
      });
    }

    // Reassign to const to help TypeScript narrow the type
    const vec = sqliteVec;

    console.log("   - Available methods:", Object.keys(vec));
    debugResults.availableMethods = Object.keys(sqliteVec);

    if (typeof vec.getLoadablePath === "function") {
      const extensionPath = vec.getLoadablePath();
      console.log("   - getLoadablePath() returns:", extensionPath);
      debugResults.extensionPath = extensionPath;

      // Check if file exists
      const fs = require("node:fs");
      const pathExists = fs.existsSync(extensionPath);
      console.log("   - File exists:", pathExists);
      debugResults.fileExists = pathExists;

      if (pathExists) {
        const stats = fs.statSync(extensionPath);
        const fileStats = {
          size: stats.size,
          isFile: stats.isFile(),
          mode: stats.mode.toString(8),
          mtime: stats.mtime,
        };
        console.log("   - File stats:", fileStats);
        debugResults.fileStats = fileStats;

        // Check if it's readable
        try {
          fs.accessSync(extensionPath, fs.constants.R_OK);
          console.log("   - File is readable: ✅");
          debugResults.readable = true;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.log("   - File is readable: ❌", errMsg);
          debugResults.readable = false;
          debugResults.readableError = errMsg;
        }
      }

      // Check directory structure
      const path = require("node:path");
      const dir = path.dirname(extensionPath);
      console.log("   - Directory:", dir);
      debugResults.directory = dir;

      if (fs.existsSync(dir)) {
        const dirContents = fs.readdirSync(dir);
        console.log("   - Directory contents:", dirContents);
        debugResults.directoryContents = dirContents;
      }

      // Try to resolve the path
      try {
        const resolvedPath = path.resolve(extensionPath);
        console.log("   - Resolved path:", resolvedPath);
        console.log("   - Resolved path exists:", fs.existsSync(resolvedPath));
        debugResults.resolvedPath = resolvedPath;
        debugResults.resolvedPathExists = fs.existsSync(resolvedPath);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.log("   - Path resolution failed:", errMsg);
        debugResults.pathResolutionError = errMsg;
      }
    }

    console.log("\n4. Test database creation and extension loading...");
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(":memory:");
    console.log("   ✅ Database created");
    debugResults.databaseCreated = true;

    // Test different loading approaches
    console.log("\n5. Testing extension loading approaches...");

    // Approach 1: Direct load
    try {
      console.log("   - Testing vec.load(db)...");
      if (typeof vec.load === "function") {
        vec.load(db);
        console.log("   ✅ Direct load successful");
        debugResults.directLoadSuccess = true;
      } else {
        console.log("   ❌ vec.load is not a function");
        debugResults.directLoadSuccess = false;
      }

      // Test if vec0 is available
      try {
        db.exec("SELECT vec_version()");
        console.log("   ✅ Vector functions available");
        debugResults.vectorFunctionsAvailable = true;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.log("   ❌ Vector functions not available:", errMsg);
        debugResults.vectorFunctionsAvailable = false;
        debugResults.vectorFunctionError = errMsg;
      }
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      const errMsg = e instanceof Error ? e.message : String(e);
      console.log("   ❌ Direct load failed:", errMsg);
      debugResults.directLoadSuccess = false;
      debugResults.directLoadError = {
        name: e instanceof Error ? e.name : undefined,
        message: errMsg,
        code: err?.code,
        errno: err?.errno,
      };

      // Approach 2: Manual loadExtension
      if (typeof vec.getLoadablePath === "function") {
        try {
          console.log("   - Testing db.loadExtension(path)...");
          const extensionPath = vec.getLoadablePath();
          db.loadExtension(extensionPath);
          console.log("   ✅ Manual loadExtension successful");
          debugResults.manualLoadSuccess = true;

          // Test if vec0 is available
          try {
            db.exec("SELECT vec_version()");
            console.log("   ✅ Vector functions available after manual load");
            debugResults.vectorFunctionsAfterManualLoad = true;
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.log(
              "   ❌ Vector functions not available after manual load:",
              errMsg,
            );
            debugResults.vectorFunctionsAfterManualLoad = false;
            debugResults.vectorFunctionAfterManualLoadError = errMsg;
          }
        } catch (e) {
          const err = e as NodeJS.ErrnoException;
          const errMsg = e instanceof Error ? e.message : String(e);
          const errName = e instanceof Error ? e.name : undefined;
          console.log("   ❌ Manual loadExtension failed:", errMsg);
          debugResults.manualLoadSuccess = false;
          debugResults.manualLoadError = {
            name: errName,
            message: errMsg,
            code: err?.code,
            errno: err?.errno,
          };
          console.log("   - Error details:", {
            name: errName,
            message: errMsg,
            code: err?.code,
            errno: err?.errno,
          });
        }
      }
    }

    db.close();

    return NextResponse.json({
      success: true,
      debugResults,
    });
  } catch (error) {
    console.error("❌ Debug failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
