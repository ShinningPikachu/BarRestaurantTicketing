import net from 'node:net';
import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, writeFile } from 'node:fs/promises';

export type PrinterConnectionState =
  | 'connected'
  | 'disconnected'
  | 'unavailable'
  | 'busy'
  | 'out_of_paper'
  | 'error'
  | 'unknown';

export type PrinterConnectionType = 'system' | 'network' | 'usb' | 'bluetooth' | 'none';
export type PrinterDataFormat = 'escpos' | 'text';

export interface PrinterAdapterDescriptor {
  name: string;
  connectionType: PrinterConnectionType;
  address: string | null;
  dataFormat: PrinterDataFormat;
}

export interface PrinterAdapterStatus {
  state: PrinterConnectionState;
  detail?: string;
  code?: string;
  externalQueueDepth?: number;
}

export interface PrinterAdapter {
  readonly descriptor: PrinterAdapterDescriptor;
  probe(): Promise<PrinterAdapterStatus>;
  reconnect(): Promise<PrinterAdapterStatus>;
  print(buffer: Buffer): Promise<void>;
}

export class PrinterTransportError extends Error {
  constructor(
    message: string,
    public readonly code = 'PRINTER_UNAVAILABLE',
    public readonly retrySafe = false,
    public readonly state: PrinterConnectionState = 'error'
  ) {
    super(message);
    this.name = 'PrinterTransportError';
  }
}

export interface ConfiguredPrinterTarget {
  printerName: string;
  systemPrinterRaw: boolean;
  systemPrinterRawConfigured: boolean;
  usbDevice: string;
  bluetoothDevice: string;
  host: string;
  port: number;
  timeoutMs: number;
}

function networkError(error: unknown, operation: string, retrySafe: boolean): PrinterTransportError {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ETIMEDOUT') {
    return new PrinterTransportError(`${operation} timed out`, 'PRINTER_TIMEOUT', retrySafe, 'disconnected');
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE') {
    return new PrinterTransportError(`${operation} failed`, 'PRINTER_DISCONNECTED', retrySafe, 'disconnected');
  }
  if (code === 'ENOTFOUND' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return new PrinterTransportError(`${operation} could not reach the configured printer`, 'PRINTER_UNAVAILABLE', retrySafe, 'unavailable');
  }
  return new PrinterTransportError(`${operation} failed`, 'PRINTER_IO_ERROR', retrySafe, 'error');
}

function probeNetwork(host: string, port: number, timeoutMs: number): Promise<PrinterAdapterStatus> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (status: PrinterAdapterStatus) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(status);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ state: 'connected' }));
    socket.once('timeout', () => finish({ state: 'disconnected', detail: 'Connection timed out' }));
    socket.once('error', (error) => {
      const normalized = networkError(error, 'Connection', true);
      finish({ state: normalized.state, detail: normalized.message });
    });
  });
}

export class NetworkPrinterAdapter implements PrinterAdapter {
  readonly descriptor: PrinterAdapterDescriptor;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number,
    name = 'ESC/POS network printer'
  ) {
    this.descriptor = {
      name,
      connectionType: 'network',
      address: `${host}:${port}`,
      dataFormat: 'escpos',
    };
  }

  probe(): Promise<PrinterAdapterStatus> {
    return probeNetwork(this.host, this.port, this.timeoutMs);
  }

  reconnect(): Promise<PrinterAdapterStatus> {
    return this.probe();
  }

  print(buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      let settled = false;
      let bytesAccepted = false;
      const finish = (error?: PrinterTransportError) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error);
        else resolve();
      };

      socket.setTimeout(this.timeoutMs);
      socket.once('connect', () => {
        socket.end(buffer, () => {
          // From this point the operating system accepted the complete buffer.
          // Retrying could create a duplicate even if the printer disconnects.
          bytesAccepted = true;
        });
      });
      socket.once('timeout', () => finish(new PrinterTransportError(
        'Printer connection timed out',
        'PRINTER_TIMEOUT',
        !bytesAccepted,
        'disconnected'
      )));
      socket.once('error', (error) => finish(networkError(error, 'Printer connection', !bytesAccepted)));
      socket.once('close', (hadError) => {
        if (!hadError && bytesAccepted) finish();
        else if (!hadError) finish(new PrinterTransportError(
          'Printer disconnected before accepting the job',
          'PRINTER_DISCONNECTED',
          true,
          'disconnected'
        ));
      });
    });
  }
}

abstract class DevicePrinterAdapter implements PrinterAdapter {
  abstract readonly descriptor: PrinterAdapterDescriptor;

  constructor(protected readonly devicePath: string) {}

  async probe(): Promise<PrinterAdapterStatus> {
    try {
      await access(this.devicePath, fsConstants.W_OK);
      return { state: 'connected' };
    } catch {
      return { state: 'unavailable', detail: 'Configured device is not writable' };
    }
  }

  reconnect(): Promise<PrinterAdapterStatus> {
    return this.probe();
  }

  async print(buffer: Buffer): Promise<void> {
    try {
      await writeFile(this.devicePath, buffer);
    } catch {
      // A character-device write can fail after a partial transfer. It is never
      // safe to retry automatically because that could duplicate part of a job.
      throw new PrinterTransportError('Printer device write failed', 'PRINTER_IO_ERROR', false, 'disconnected');
    }
  }
}

export class UsbPrinterAdapter extends DevicePrinterAdapter {
  readonly descriptor: PrinterAdapterDescriptor;

  constructor(devicePath: string) {
    super(devicePath);
    this.descriptor = {
      name: 'ESC/POS USB printer',
      connectionType: 'usb',
      address: devicePath,
      dataFormat: 'escpos',
    };
  }
}

export class BluetoothPrinterAdapter extends DevicePrinterAdapter {
  readonly descriptor: PrinterAdapterDescriptor;

  constructor(devicePath: string) {
    super(devicePath);
    this.descriptor = {
      name: 'ESC/POS Bluetooth printer',
      connectionType: 'bluetooth',
      address: devicePath,
      dataFormat: 'escpos',
    };
  }
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number,
  input?: Buffer
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let inputAccepted = false;
    const finish = (error?: PrinterTransportError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve({ stdout, stderr });
    };
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new PrinterTransportError(`${command} timed out`, 'PRINTER_TIMEOUT', false, 'unknown'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      if (stdout.length < 8_192) stdout += String(chunk).slice(0, 8_192 - stdout.length);
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 8_192) stderr += String(chunk).slice(0, 8_192 - stderr.length);
    });
    child.once('error', (error) => {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      finish(new PrinterTransportError(
        missing ? `${command} is not installed` : `${command} failed to start`,
        missing ? 'PRINTER_COMMAND_UNAVAILABLE' : 'PRINTER_IO_ERROR',
        !inputAccepted,
        'unavailable'
      ));
    });
    child.once('close', (code) => {
      if (code === 0) finish();
      else finish(new PrinterTransportError(
        stderr.trim() || `${command} exited with code ${code}`,
        'PRINTER_COMMAND_FAILED',
        false,
        'error'
      ));
    });
    child.stdin.once('error', () => finish(new PrinterTransportError(
      `${command} input failed`,
      'PRINTER_IO_ERROR',
      !inputAccepted,
      'error'
    )));
    if (input) {
      child.stdin.end(input, () => {
        inputAccepted = true;
      });
    } else {
      child.stdin.end();
    }
  });
}

export class SystemPrinterAdapter implements PrinterAdapter {
  readonly descriptor: PrinterAdapterDescriptor;

  constructor(
    private readonly printerName: string,
    private readonly raw: boolean,
    private readonly timeoutMs: number
  ) {
    this.descriptor = {
      name: printerName,
      connectionType: 'system',
      address: `CUPS:${printerName}`,
      dataFormat: raw ? 'escpos' : 'text',
    };
  }

  async probe(): Promise<PrinterAdapterStatus> {
    try {
      const [result, queued] = await Promise.all([
        runCommand('lpstat', ['-p', this.printerName, '-l'], this.timeoutMs),
        runCommand('lpstat', ['-o', this.printerName], this.timeoutMs),
      ]);
      const output = `${result.stdout}\n${result.stderr}`;
      const externalQueueDepth = queued.stdout.split(/\r?\n/).filter((line) => line.trim()).length;
      if (/out[ -]of[ -]paper|media-empty|paper-empty/i.test(output)) {
        return { state: 'out_of_paper', detail: 'Printer reports that paper is unavailable', externalQueueDepth };
      }
      if (/disabled|paused|stopped/i.test(output)) {
        return { state: 'error', detail: 'System print queue is paused or disabled', externalQueueDepth };
      }
      if (externalQueueDepth > 0 || /processing|printing|now printing/i.test(output)) {
        return { state: 'busy', externalQueueDepth };
      }
      return { state: 'connected', externalQueueDepth };
    } catch (error) {
      if (error instanceof PrinterTransportError) {
        const missingPrinter = /unknown destination|not found|does not exist/i.test(error.message);
        const schedulerUnavailable = /scheduler is not running|connection refused/i.test(error.message);
        return {
          state: missingPrinter || schedulerUnavailable ? 'unavailable' : error.state,
          code: schedulerUnavailable ? 'PRINTER_SCHEDULER_UNAVAILABLE' : missingPrinter ? 'PRINTER_NOT_FOUND' : error.code,
          detail: schedulerUnavailable
            ? 'System print scheduler is unavailable'
            : missingPrinter
              ? 'Configured system printer was not found'
              : error.message,
        };
      }
      return { state: 'unknown', detail: 'Could not query the system print queue' };
    }
  }

  reconnect(): Promise<PrinterAdapterStatus> {
    return this.probe();
  }

  async print(buffer: Buffer): Promise<void> {
    const args = this.raw ? ['-d', this.printerName, '-o', 'raw'] : ['-d', this.printerName];
    try {
      await runCommand('lp', args, this.timeoutMs, buffer);
    } catch (error) {
      if (error instanceof PrinterTransportError) {
        if (/unknown destination|not found|does not exist/i.test(error.message)) {
          throw new PrinterTransportError('Configured system printer was not found', 'PRINTER_NOT_FOUND', false, 'unavailable');
        }
        throw error;
      }
      throw new PrinterTransportError('System print command failed', 'PRINTER_COMMAND_FAILED', false, 'error');
    }
  }
}

export class UnconfiguredPrinterAdapter implements PrinterAdapter {
  readonly descriptor: PrinterAdapterDescriptor = {
    name: 'No printer configured',
    connectionType: 'none',
    address: null,
    dataFormat: 'escpos',
  };

  async probe(): Promise<PrinterAdapterStatus> {
    return { state: 'unavailable', detail: 'No printer is configured' };
  }

  reconnect(): Promise<PrinterAdapterStatus> {
    return this.probe();
  }

  async print(): Promise<void> {
    throw new PrinterTransportError('No printer is configured', 'PRINTER_NOT_CONFIGURED', false, 'unavailable');
  }
}

export class AmbiguousSystemPrinterAdapter implements PrinterAdapter {
  readonly descriptor: PrinterAdapterDescriptor;
  private readonly probeAdapter: SystemPrinterAdapter;

  constructor(printerName: string, timeoutMs: number) {
    this.descriptor = {
      name: printerName,
      connectionType: 'system',
      address: `CUPS:${printerName}`,
      dataFormat: 'text',
    };
    this.probeAdapter = new SystemPrinterAdapter(printerName, false, timeoutMs);
  }

  async probe(): Promise<PrinterAdapterStatus> {
    const targetStatus = await this.probeAdapter.probe();
    if (targetStatus.state !== 'connected' && targetStatus.state !== 'busy') return targetStatus;
    return {
      state: 'error',
      code: 'PRINTER_PROTOCOL_UNCONFIGURED',
      detail: 'System printer protocol mode is not configured',
    };
  }

  reconnect(): Promise<PrinterAdapterStatus> {
    return this.probe();
  }

  async print(): Promise<void> {
    throw new PrinterTransportError(
      'System printer protocol mode is not configured',
      'PRINTER_PROTOCOL_UNCONFIGURED',
      false,
      'error'
    );
  }
}

export function createConfiguredPrinterAdapter(target: ConfiguredPrinterTarget): PrinterAdapter {
  if (target.printerName) {
    if (!target.systemPrinterRawConfigured) return new AmbiguousSystemPrinterAdapter(target.printerName, target.timeoutMs);
    return new SystemPrinterAdapter(target.printerName, target.systemPrinterRaw, target.timeoutMs);
  }
  if (target.usbDevice) return new UsbPrinterAdapter(target.usbDevice);
  if (target.bluetoothDevice) return new BluetoothPrinterAdapter(target.bluetoothDevice);
  if (target.host) return new NetworkPrinterAdapter(target.host, target.port, target.timeoutMs);
  return new UnconfiguredPrinterAdapter();
}
