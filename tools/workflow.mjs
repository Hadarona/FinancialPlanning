#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WorkflowError,
  applyFeedback,
  evaluateIteration,
  initWorkflow,
  startIteration,
  statusSummary,
  validateProject,
} from "./workflow-core.mjs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(currentDirectory, "..");
const [, , command, ...args] = process.argv;

function option(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function normalizeRoles(value) {
  if (!value) {
    return [];
  }
  const aliases = {
    developer: "developer",
    dev: "developer",
    qa: "qa",
    qa_engineer: "qa",
    "qa-engineer": "qa",
    design: "design",
    design_reviewer: "design",
    "design-reviewer": "design",
  };
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => aliases[item] ?? item);
}

async function messageFromFile() {
  const messageFile = option("--message-file");
  if (!messageFile) {
    throw new WorkflowError("--message-file is required so user feedback is preserved verbatim");
  }
  return readFile(path.resolve(root, messageFile), "utf8");
}

async function run() {
  switch (command) {
    case "init":
      return initWorkflow(root);
    case "status":
      return statusSummary(root);
    case "start-iteration":
      return startIteration(root);
    case "evaluate":
      return evaluateIteration(root);
    case "validate": {
      const result = await validateProject(root);
      if (!result.ok) {
        throw new WorkflowError("Workflow validation failed", result.errors);
      }
      return result;
    }
    case "feedback": {
      const decision = args[0];
      const message = await messageFromFile();
      return applyFeedback(root, {
        decision,
        roles: normalizeRoles(option("--roles")),
        message,
      });
    }
    default:
      throw new WorkflowError(
        "Usage: workflow.mjs <init|status|start-iteration|evaluate|validate|feedback>",
      );
  }
}

try {
  const result = await run();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const payload = {
    error: error.message,
    details: error.details ?? [],
  };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 1;
}
