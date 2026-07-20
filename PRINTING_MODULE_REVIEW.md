# Printing Module Review

## Scope and outcome

This review covers configured-printer discovery, status probing, job construction, printable-text sanitization, ESC/POS formatting, queuing, deduplication, transport, safe retry, pending-job cancellation, diagnostics, and frontend controls.

The earlier implementation did not intentionally append logs or exceptions to receipt buffers. Its main instability risks were protocol ambiguity and transport certainty: raw ESC/POS and CUPS-driver text shared one service, TCP socket completion was treated as a definitive print, and raw operating-system errors were returned by the printer bridge. It also had no visible status, pending-job cancellation, recent-job diagnostics, or short-window duplicate suppression.

The module now uses independent network, USB, Bluetooth-device, system/CUPS, and unconfigured adapters. Business code supplies a validated ticket or summary; it never selects a device path, host, printer name, or protocol.

## End-to-end flow

1. The backend validates the authenticated request. Client-supplied transport, fiscal, and device fields are stripped or rejected.
2. The formatter converts each scalar field to printable ASCII, removes control characters, applies the configured paper width, and builds separate ESC/POS and plain-text buffers.
3. The prepared job validator rejects empty, oversized, non-initialized ESC/POS, or control-bearing plain-text jobs.
4. The queue derives a content hash. Matching active or pending jobs share one result; matching recently completed jobs are suppressed for a short window.
5. Immediately before printing, the configured adapter probes availability. Unavailable, disconnected, out-of-paper, error, and unknown states block the real job.
6. The adapter receives only its matching format: ESC/POS for direct network/device/raw-CUPS targets, or sanitized text for a normal CUPS driver queue.
7. At most the configured number of safe retries occurs, and only when the adapter reports that no bytes could have been accepted. A partial, uncertain, or accepted write is never retried automatically.
8. Completion, sanitized failure, attempt count, and timestamps are recorded in an in-memory diagnostic history. Printable buffers never contain these records.

## Commands and encoding

- Direct ESC/POS output starts with `ESC @` initialization.
- Receipts contain ASCII text only. Accents are transliterated and `€` becomes `EUR`; embedded control characters and newlines in data fields become spaces.
- The only optional device commands are the explicit cash-drawer pulse and configured full/partial cut. Set `XPRINTER_CUT_MODE=none` for printers without a compatible cutter.
- Plain CUPS-driver jobs contain no ESC/POS control bytes.
- The safe test print contains only fixed labels stating that it is a test and contains no customer data.

## Connection and status semantics

- `connected`: the target accepted a fresh probe.
- `busy`: an application job is active/pending, CUPS reports work, or an external CUPS queue contains jobs.
- `disconnected`: the known target refused, reset, or timed out.
- `unavailable`: no target, missing device/command, unreachable host, or missing CUPS destination.
- `out_of_paper`: CUPS explicitly reports a paper/media-empty condition.
- `error`: the configured queue or transport reports an error.
- `unknown`: the target cannot provide a reliable state.

USB and Bluetooth character devices, and many inexpensive network ESC/POS printers, do not expose reliable paper or hardware telemetry. For those adapters, `connected` means that the configured path or TCP endpoint is reachable, not that a receipt physically emerged. A successful CUPS result means CUPS accepted the job. These limitations are displayed in diagnostics.

## Queue, cancellation, and recovery

- Jobs are serialized in process; output buffers cannot interleave.
- Pending duplicates do not create a second receipt.
- Only failures proven to occur before byte acceptance can retry.
- “Cancel pending jobs” does not interrupt the active job, avoiding a partial receipt. It also does not delete jobs already accepted by CUPS; external queue depth is shown separately so an operator can investigate it deliberately.
- A failed job does not poison the queue. The next distinct job performs a new status probe.
- Restarting the backend clears only the application’s in-memory pending queue and diagnostics. It does not reset or truncate CUPS.

## Error and diagnostic isolation

Raw exceptions, stack traces, command output, log messages, and diagnostics are never passed to a formatter or transport buffer. The API and status interface expose only a fixed sanitized message selected by error code. Backend logs contain job identifiers, state, code, and attempt count, but never receipt content or customer data.

## Operator checks for unrelated text

1. Open Impresora and cancel only application jobs that are still pending.
2. Confirm that exactly one backend target is configured.
3. Explicitly set `XPRINTER_SYSTEM_PRINTER_RAW=true` for a raw ESC/POS CUPS queue or `false` for a normal CUPS driver. Named system printers remain blocked while this choice is omitted.
4. Confirm `XPRINTER_PAPER_COLUMNS` and set `XPRINTER_CUT_MODE=none` while diagnosing unsupported commands.
5. Refresh status, reconnect, and run the fixed safe test print.
6. Open diagnostics and compare the application queue with the external CUPS queue. Inspect or cancel external CUPS jobs manually only after identifying them; the application will not destructively clear that queue.

## Current workstation finding

The local configuration selects the `POS80_RAW` system queue but does not yet declare `XPRINTER_SYSTEM_PRINTER_RAW`. A read-only CUPS check also reports that the scheduler is not running and that `POS80_RAW` is not currently a valid destination. The new service blocks jobs in this condition. Before printing on this computer, start/install CUPS and create the intended queue, or select the correct USB, Bluetooth, or network adapter; then explicitly choose raw or driver mode and use only the fixed safe test print.
