
const RUNTIME_BROWSER = 0;
const RUNTIME_NODE = 1;
const RUNTIME_DENO = 2;
const RUNTIME_BUN = 3;

function detectRuntime() {
  let runtime = RUNTIME_BROWSER;
  if (typeof process !== 'undefined' && process.versions.bun !== undefined) {
    runtime = RUNTIME_BUN;
  }
  else if (isNode()) {
    runtime = RUNTIME_NODE;
  }
  else if (window.Deno !== undefined) {
    runtime = RUNTIME_DENO;
  }
  return runtime;
}

function isNode() {
  return (typeof process !== 'undefined' && process.release.name === 'node');
}

let argv;

switch (detectRuntime()) {
  case RUNTIME_DENO: {
    argv = [ Deno.execPath(), Deno.mainModule, ...Deno.args ];
    break;
  }
  default: {
    argv = process.argv;
    break;
  }
}

export {
  argv
}
