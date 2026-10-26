import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { createInterface } from 'readline';
import { AppError } from '../../domain/errors/AppError';
import { env } from '../config/env';

interface WorkerResponse {
  id?: string;
  ready?: boolean;
  model?: string;
  ok?: boolean;
  code?: string;
  template?: string;
}

interface PendingRequest {
  resolve: (template: Buffer) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const WORKER_STARTUP_TIMEOUT_MS = 30_000;
const INFERENCE_TIMEOUT_MS = 20_000;

const workerErrors: Record<string, { status: number; message: string }> = {
  invalid_image: { status: 400, message: 'Use a valid JPEG or PNG camera image smaller than 5 MB.' },
  no_face: { status: 422, message: 'No clear face was detected. Improve the lighting and retry.' },
  multiple_faces: { status: 422, message: 'Show only one face in the camera frame, then retry.' },
  face_too_small: { status: 422, message: 'Move closer to the camera and retry.' },
};

export class FaceEmbeddingService {
  private child?: ChildProcessWithoutNullStreams;
  private startup?: Promise<void>;
  private ready = false;
  private readonly pending = new Map<string, PendingRequest>();

  public constructor(
    private readonly pythonExecutable = env.FACE_PYTHON_PATH || 'python',
    private readonly workerPath = resolve(__dirname, '../../../face-service/worker.py')
  ) {}

  private ensureWorker(): Promise<void> {
    if (this.child && this.ready) return Promise.resolve();
    if (this.startup) return this.startup;

    this.startup = new Promise<void>((resolveStartup, rejectStartup) => {
      const child = spawn(this.pythonExecutable, [this.workerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.child = child;
      let settled = false;
      const startupTimeout = setTimeout(() => {
        child.kill();
        finishStartup(new AppError(503, 'Local face models did not start. Check the model files and Python setup.'));
      }, WORKER_STARTUP_TIMEOUT_MS);

      const finishStartup = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(startupTimeout);
        if (error) {
          this.ready = false;
          this.child = undefined;
          this.startup = undefined;
          rejectStartup(error);
          return;
        }
        this.ready = true;
        resolveStartup();
      };

      const output = createInterface({ input: child.stdout });
      output.on('line', (line) => {
        let response: WorkerResponse;
        try {
          response = JSON.parse(line) as WorkerResponse;
        } catch {
          finishStartup(new AppError(503, 'The local face worker returned an invalid response.'));
          return;
        }

        if (response.ready) {
          console.info('[FaceEmbedding] Local face model worker ready', {
            modelReady: true,
            modelVersion: response.model ?? 'unreported',
          });
          finishStartup();
          return;
        }
        if (!response.id) return;

        const pending = this.pending.get(response.id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(response.id);

        if (response.ok && response.template) {
          const template = Buffer.from(response.template, 'base64');
          if (!template.length || template.length % Float32Array.BYTES_PER_ELEMENT !== 0) {
            pending.reject(new AppError(503, 'Local face inference returned an invalid embedding.'));
            return;
          }
          console.info('[FaceEmbedding] Face embedding extracted', {
            modelReady: true,
            embeddingDimensions: template.length / Float32Array.BYTES_PER_ELEMENT,
          });
          pending.resolve(template);
        } else {
          const failure = workerErrors[response.code || ''];
          pending.reject(
            failure
              ? new AppError(failure.status, failure.message)
              : new AppError(503, 'Local face inference failed. Please retry or use email and password.')
          );
        }
      });

      createInterface({ input: child.stderr }).on('line', (line) => {
        console.error(`[FaceWorker] ${line}`);
      });
      child.once('error', () => {
        finishStartup(new AppError(503, 'Could not start the local face worker. Check the Python installation.'));
        this.failPending();
      });
      child.once('exit', () => {
        finishStartup(new AppError(503, 'The local face worker stopped unexpectedly.'));
        this.ready = false;
        this.child = undefined;
        this.startup = undefined;
        this.failPending();
      });
    });

    return this.startup;
  }

  private failPending(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new AppError(503, 'Local face inference is unavailable. Please retry.'));
    }
    this.pending.clear();
  }

  public async ensureReady(): Promise<void> {
    await this.ensureWorker();
  }

  public async extract(image: Buffer): Promise<Buffer> {
    if (!image.length || image.length > MAX_IMAGE_BYTES) {
      throw new AppError(400, 'Use a valid JPEG or PNG camera image smaller than 5 MB.');
    }

    await this.ensureWorker();
    const child = this.child;
    if (!child || !this.ready) {
      throw new AppError(503, 'Local face inference is unavailable. Please retry.');
    }

    const id = randomUUID();
    return new Promise<Buffer>((resolveTemplate, rejectTemplate) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectTemplate(new AppError(503, 'Local face inference timed out. Please retry.'));
      }, INFERENCE_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolveTemplate, reject: rejectTemplate, timeout });
      child.stdin.write(`${JSON.stringify({ id, image: image.toString('base64') })}\n`, (error) => {
        if (!error) return;
        clearTimeout(timeout);
        this.pending.delete(id);
        rejectTemplate(new AppError(503, 'Could not send the camera frame to local face inference.'));
      });
    });
  }
}

export const faceEmbeddingService = new FaceEmbeddingService();