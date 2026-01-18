#!/usr/bin/env node

/**
 * Test Runner - Executes all Willys MCP tests in sequence
 * Comprehensive test coverage for MCP server, web interface, and parsing logic
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  async runTest(testName, testFile) {
    return new Promise((resolve) => {
      console.log(`\\n${"=".repeat(60)}`);
      console.log(`🧪 RUNNING: ${testName}`);
      console.log(`📁 File: ${testFile}`);
      console.log(`${"=".repeat(60)}`);

      const startTime = Date.now();

      const testProcess = spawn("node", [testFile], {
        stdio: "inherit",
        cwd: process.cwd(),
      });

      testProcess.on("close", (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        this.results.total++;

        if (code === 0) {
          console.log(`\\n✅ PASSED: ${testName} (${duration}ms)`);
          this.results.passed++;
          this.results.tests.push({
            name: testName,
            status: "PASSED",
            duration,
            file: testFile,
          });
        } else {
          console.log(
            `\\n❌ FAILED: ${testName} (${duration}ms) - Exit code: ${code}`,
          );
          this.results.failed++;
          this.results.tests.push({
            name: testName,
            status: "FAILED",
            duration,
            file: testFile,
            exitCode: code,
          });
        }

        resolve(code === 0);
      });

      testProcess.on("error", (error) => {
        console.error(`\\n💥 ERROR running ${testName}:`, error.message);
        this.results.total++;
        this.results.failed++;
        this.results.tests.push({
          name: testName,
          status: "ERROR",
          error: error.message,
          file: testFile,
        });
        resolve(false);
      });
    });
  }

  async runAllTests() {
    console.log("🚀 WILLYS MCP COMPREHENSIVE TEST SUITE");
    console.log("=".repeat(60));

    const startTime = Date.now();

    // Check prerequisites
    if (!fs.existsSync(".credentials")) {
      console.log("❌ Missing .credentials file. Please create with:");
      console.log("   Line 1: Username");
      console.log("   Line 2: Password");
      process.exit(1);
    }

    // Define test suite in execution order
    const testSuite = [
      {
        name: "Parsing Validation (No Network)",
        file: "./test-parsing-validation.js",
        description: "Tests parsing logic with presaved HTTP snapshots",
      },
      {
        name: "MCP Search JSON Structure",
        file: "./test-search-json-structure.js",
        description: "Validates new clean JSON structure in MCP search",
      },
      {
        name: "Comprehensive E2E Tests",
        file: "./test-e2e-comprehensive.js",
        description: "Full MCP server and web interface integration tests",
      },
      {
        name: "Smart Product Matching",
        file: "./test-smart-product-matches.js",
        description: "AI-enhanced product matching with vector search",
        optional: true, // May fail if database not set up
      },
    ];

    console.log(`\\n📋 Test Plan: ${testSuite.length} test suites`);
    testSuite.forEach((test, index) => {
      console.log(
        `   ${index + 1}. ${test.name}${test.optional ? " (optional)" : ""}`,
      );
      console.log(`      ${test.description}`);
    });

    console.log("\\n⚡ Starting test execution...");

    // Execute tests sequentially
    for (const test of testSuite) {
      if (!fs.existsSync(test.file)) {
        console.log(
          `\\n⚠️  SKIPPED: ${test.name} - Test file not found: ${test.file}`,
        );
        continue;
      }

      const success = await this.runTest(test.name, test.file);

      if (!success && !test.optional) {
        console.log(`\\n💥 CRITICAL FAILURE: ${test.name}`);
        console.log("   Stopping test execution due to critical test failure.");
        break;
      }
    }

    // Generate summary report
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log(`\\n${"=".repeat(60)}`);
    console.log("📊 FINAL TEST REPORT");
    console.log("=".repeat(60));

    console.log(
      `⏱️  Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`,
    );
    console.log(`📈 Tests Run: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);

    if (this.results.total > 0) {
      const successRate = (this.results.passed / this.results.total) * 100;
      console.log(`📊 Success Rate: ${successRate.toFixed(1)}%`);

      console.log("\\n🔍 Detailed Results:");
      this.results.tests.forEach((test, index) => {
        const status =
          test.status === "PASSED"
            ? "✅"
            : test.status === "FAILED"
              ? "❌"
              : "💥";
        const duration = test.duration ? ` (${test.duration}ms)` : "";
        console.log(`   ${index + 1}. ${status} ${test.name}${duration}`);
        if (test.error) {
          console.log(`      Error: ${test.error}`);
        } else if (test.exitCode) {
          console.log(`      Exit Code: ${test.exitCode}`);
        }
      });

      // Save detailed report
      const reportFile = path.join(__dirname, "test-results.json");
      const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
          total: this.results.total,
          passed: this.results.passed,
          failed: this.results.failed,
          successRate: `${successRate.toFixed(1)}%`,
          totalDuration: totalDuration,
        },
        tests: this.results.tests,
      };

      fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
      console.log(`\\n💾 Detailed report saved to: ${reportFile}`);

      // Final verdict
      if (successRate >= 80) {
        console.log("\\n🎉 TEST SUITE PASSED! Willys MCP is ready for use.");
        process.exit(0);
      } else {
        console.log(
          "\\n💥 TEST SUITE FAILED! Please address failing tests before deployment.",
        );
        process.exit(1);
      }
    } else {
      console.log("\\n⚠️  No tests were executed.");
      process.exit(1);
    }
  }
}

// Run the test suite
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch((error) => {
    console.error("💥 Test runner failed:", error);
    process.exit(1);
  });
}

module.exports = TestRunner;
