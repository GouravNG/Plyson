# Feature Flags

This document catalogs proposed `playson` runtime flags for API testing, debugging, resilience checks, and controlled fault injection.

Use these flags deliberately. Several options intentionally weaken authentication, change transport behavior, or inject failures, so they should be restricted to local development, test environments, and CI jobs that are designed for those scenarios.

---

## Auth and Security

| Flag                          | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `--skip-auth`                 | Removes the `Authorization` header entirely.                      |
| `--mock-auth`                 | Uses a fake or static token instead of a real one.                |
| `--force-auth-expire`         | Sends an expired token to test `401` handling.                    |
| `--skip-ssl-verify`           | Disables SSL certificate validation for self-signed certificates. |
| `--use-mtls`                  | Enables mutual TLS for client certificate authentication.         |
| `--impersonate-user=<userId>` | Injects a different user identity into request headers.           |

## Network and Transport

| Flag                         | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `--simulate-timeout=<ms>`    | Forces a request to time out after `N` milliseconds.         |
| `--simulate-latency=<ms>`    | Adds artificial delay before sending a request.              |
| `--simulate-flaky=<percent>` | Randomly fails `X%` of requests for chaos testing.           |
| `--force-http1`              | Forces HTTP/1.1.                                             |
| `--force-http2`              | Forces HTTP/2.                                               |
| `--proxy=<url>`              | Routes traffic through a proxy such as Charles or mitmproxy. |
| `--offline-mode`             | Runs tests against mocked responses only.                    |

## Request Manipulation

| Flag                            | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `--strip-headers=<list>`        | Removes specific headers.            |
| `--inject-headers=<json>`       | Adds custom headers globally.        |
| `--force-content-type=<type>`   | Overrides `Content-Type`.            |
| `--malform-body`                | Sends intentionally broken payloads. |
| `--skip-body`                   | Sends requests with an empty body.   |
| `--override-base-url=<url>`     | Redirects all calls to another host. |
| `--inject-query-params=<query>` | Appends query parameters globally.   |

## Mocking and Data

| Flag                        | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `--use-mock-server=<url>`   | Uses WireMock, MSW, or another mock server instead of real APIs. |
| `--seed-data=<fixture>`     | Pre-populates database or application state before tests.        |
| `--snapshot-mode`           | Records real responses as fixtures.                              |
| `--replay-mode`             | Replays saved snapshots.                                         |
| `--randomize-ids`           | Uses random UUIDs instead of static IDs.                         |
| `--freeze-time=<timestamp>` | Freezes application or server time.                              |

## Retry and Resilience

| Flag                        | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `--retry-on-fail=<count>`   | Retries failed requests `N` times.       |
| `--retry-on-status=<codes>` | Retries on specific HTTP status codes.   |
| `--backoff-strategy=<type>` | Uses `linear`, `exponential`, or `none`. |
| `--fail-fast`               | Stops the suite on the first failure.    |
| `--continue-on-error`       | Continues execution despite failures.    |

---

## Enterprise-Grade Additions

### Observability

| Flag                      | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `--trace-requests`        | Enables distributed tracing.                             |
| `--log-level=<level>`     | Sets log verbosity: `debug`, `info`, `warn`, or `error`. |
| `--dump-http`             | Dumps raw HTTP requests and responses.                   |
| `--export-har`            | Saves traffic as a HAR file.                             |
| `--metrics-output=<path>` | Exports latency and error metrics.                       |

### Chaos Engineering

| Flag                          | Purpose                               |
| ----------------------------- | ------------------------------------- |
| `--kill-after-request=<n>`    | Simulates a crash after `N` requests. |
| `--inject-random-500s`        | Randomly injects server failures.     |
| `--corrupt-response`          | Returns malformed responses.          |
| `--drop-connections`          | Simulates abrupt TCP disconnects.     |
| `--throttle-bandwidth=<kbps>` | Simulates slow networks.              |

### Performance

| Flag                       | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `--concurrency=<n>`        | Sets the number of parallel requests.            |
| `--rate-limit=<rps>`       | Caps requests per second.                        |
| `--duration=<time>`        | Runs a soak or load test for the given duration. |
| `--warmup=<time>`          | Adds a warmup period before collecting metrics.  |
| `--max-response-size=<mb>` | Rejects oversized responses.                     |

### Security Testing

| Flag                | Purpose                          |
| ------------------- | -------------------------------- |
| `--inject-sqli`     | Tests SQL injection handling.    |
| `--inject-xss`      | Tests XSS sanitization.          |
| `--fuzz-inputs`     | Enables randomized fuzz testing. |
| `--test-cors`       | Validates CORS behavior.         |
| `--test-rate-limit` | Stress-tests API rate limits.    |

---

## Operational Guidance

- Keep destructive or invasive flags disabled by default.
- Require explicit opt-in for flags that alter authentication, TLS, routing, request bodies, or response payloads.
- Prefer deterministic seeds and fixtures in CI so failures are reproducible.
- Emit selected flag values in test reports to make debugging easier.
- Guard production-like environments from chaos, fuzzing, and impersonation flags unless a dedicated test window has been approved.
