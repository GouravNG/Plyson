✦ The behavior you are seeing—where 10 workers take significantly longer
  (36.2s) than a single worker (19.5s) for 104 tests—is a textbook example of
  parallelization overhead defeating short-lived tasks, heavily amplified by
  Windows process management and the architecture of local API testing.

  Here is exactly why this happens in your project:

  1. Heavy Initialization & Disk Contention (The Primary Bottleneck)
  In Plyson, all tests are registered dynamically from a single file entry
  point (plyson.spec.ts). When Playwright runs with workers: 10 on a single
  file with mode: 'parallel', it spawns 10 independent Node.js worker
  processes. 
   * Duplicate Loading: Each of the 10 workers must independently execute the
     file and invoke bootstrap().
   * Resource Contention: This causes all 10 processes to concurrently read
     from disk and parse your project.json, all your Project-schema/*.json
     schemas, and every single *.test.json suite file at the exact same
     millisecond. 
   * Windows Overhead: Process creation and concurrent small-file I/O are
     notoriously slow on Windows. The CPU and disk thrashing during this
     simultaneous discovery phase inflates the startup time of each worker from
     a couple of seconds to 15+ seconds.

  2. High Overhead vs. Ultra-Fast Execution Time
  Your API tests are extremely lightweight because they hit an in-memory mock
  server. 104 tests running sequentially in 19.5s means each test case averages
  ~185ms (including step processing and assertions).
   * With 1 Worker: You pay the process startup and project loading cost
     exactly once. The worker then streams through all 104 tests sequentially
     with zero friction.
   * With 10 Workers: Each worker only gets about 10 tests to run. The actual
     test execution takes a mere 2 seconds per worker, but each worker spends
     15–20 seconds fighting for CPU cycles just to spin up and load the project
     graph.

  3. Local Single-Threaded Server Bottleneck
  The mock server (src/server.js) runs on a single Node.js event loop thread. 
   * When 1 worker runs the tests, requests hit the server serially. The server
     processes them instantly one-by-one with zero connection contention.
   * When 10 workers run tests in parallel, they flood the single-threaded mock
     server simultaneously. Because the server is single-threaded and handles
     everything in memory, it cannot process requests in true hardware
     parallel; instead, it introduces context-switching and connection queuing
     overhead, slowing down response times.

  Summary / Recommendation
  Parallel workers are highly effective for heavy UI tests (browser spawning,
  page rendering) or long-running integration tests where the test duration
  dominates the setup time. 

  For ultra-fast local API tests, sequential execution (1–2 workers) will
  almost always be faster because the overhead of spinning up and coordinating
  multiple OS processes outweighs the concurrency benefits.
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
✦ Based on the architectural patterns visible in the codebase and your
  benchmark results, the current implementation is a good foundational step,
  but it is conceptually incomplete. 

  It correctly exposes the syntax to users, but it creates a performance trap
  because the plumbing beneath doesn't yet support efficient parallelism.

  Here is an objective breakdown of what is good, what is problematic, and how
  it can be made truly excellent:

  ---

  🟢 What is Good (The Strengths)
   1. User Interface/UX Alignment: Exposing a mode flag (parallel vs
      sequential) at both the project and suite level is the correct design. It
      mimics standard testing frameworks (like Vitest or Jest) and gives users
      intuitive control.
   2. Leveraging Native Power: Mapping parallel directly to Playwright's
      test.describe.configure({ mode }) is smart. It avoids writing custom
      worker scheduling logic from scratch and delegates the complex execution
      orchestration to a battle-tested engine.
   3. Smart Suite Overrides: The ability to run a project in parallel but force
      specific data-dependent suites to run sequentially is exactly what
      complex API testing workflows require.

  ---

  🔴 What is Problematic (The Limitations)
  While the API design is good, the internal execution strategy suffers from
  two severe architectural flaws:

  1. The Redundant Discovery Problem (Why 10 workers is slow)
  Currently, bootstrap(test, expect) is called inside plyson.spec.ts. 

   1 // packages/test/src/index.ts
   2 export async function bootstrap(test: TestType<any, any>, expect: Expect)
     {
   3   const graph = await loader.load(rootDir, env) // Executed by EVERY
     worker!
   4   registerSuites(graph, store, test, expect, ...)
   5 }
  Because of how Playwright workers operate, every single worker re-reads the
  filesystem, re-parses every JSON file, and rebuilds the entire project graph
  independently. 
   * If a user has 50 suites and sets 10 workers, the app reads and parses
     those 50 files 500 times total across workers instead of 50. This creates
     severe disk I/O and CPU contention on startup.

  2. The Shared Variable Store Isolation Leak
  API test suites often share variables across steps or cases (e.g., login
  token extracted to global or environment scope). 
   * When Playwright spawns independent OS worker processes, each worker gets a
     separate memory space. 
   * If Worker A mutates a global variable during a step, Worker B running a
     parallel suite will never see that change. This will cause mysterious test
     failures as soon as users write tests that share cross-suite state in
     parallel mode.

  ---

  🛠️ How to Make it Excellent (Architectural Next Steps)

  To transform this from a simple wrapper into a high-performance,
  enterprise-grade engine, you should implement two improvements:

  1. Split Discovery from Execution (Fixes the Speed)
  Instead of discovering and loading the project graph inside the worker script
  (bootstrap), move the loading mechanism to Playwright's Global Setup phase or
  a custom CLI pre-run subcommand.
   * The Workflow: The Plyson CLI runs first using 1 single thread → parses all
     JSON suites → compiles them into a single, fully-optimized metadata
     manifest file → writes it to .plyson/manifest.json.
   * The Worker: The bootstrap() function inside the worker simply reads that
     one pre-compiled manifest file. This reduces worker initialization time
     from seconds to milliseconds.

  2. Warn Users About State Invalidation
  Parallel execution and global variable modification are fundamentally
  incompatible in memory. You should document or enforce that when
  project.mode: "parallel" is active:
   * suite and case scoped variables are safe (isolated per worker).
   * global or environment variable extraction (extract: [{ scope: "global" }])
     will behave unpredictably across suites.

  Final Verdict
  The implementation is Good for an early iteration because it sets up the
  correct configuration schema and successfully integrates with Playwright's
  core. However, it requires a refactoring of the Project Loader / Discovery
  mechanism before you can confidently market "Parallel Worker Support" as a
  feature that actually speeds up tests.