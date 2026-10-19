import { ApiClientError } from '@hyperbug/api-client';
import { useEffect, useRef, useState } from 'react';
import { useProductApi } from '../product-api.ts';
import { usePublicConfig } from '../app.tsx';
import { transferUpload } from '../uploads.ts';
import { productError } from '../product-state.ts';

function uploadStatus(result: { state: string; scanStatus: string }) {
  const next =
    result.state === 'rejected'
      ? 'Choose another file; its type or content did not pass verification.'
      : result.scanStatus === 'failed'
        ? 'This file remains held because scanning could not finish. Contact the operator.'
        : 'Files become usable only after processing and release.';
  return `Upload ${result.state}. Scan: ${result.scanStatus}. ${next}`;
}

export function UploadField({
  projectId,
  draftId,
  id,
  accept,
  label,
  required,
  describedBy,
  invalid,
  disabled = false,
  onReady,
}: {
  projectId: string;
  draftId: string;
  id: string;
  accept: string;
  label: string;
  required?: boolean;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  onReady: (uploadId: string) => void;
}) {
  const api = useProductApi();
  const config = usePublicConfig();
  const [file, setFile] = useState<File>();
  const [sent, setSent] = useState(0);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [uploadId, setUploadId] = useState(() => crypto.randomUUID());
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const origins = (config.uploadOrigins ?? []).filter(
    (origin) =>
      ![location.origin, config.apiBaseUrl, config.authBaseUrl].includes(
        origin,
      ),
  );
  async function transfer() {
    if (!file || pending || disabled) return;
    if (!file.size || file.size > 33554432) {
      setMessage('Choose a non-empty file up to 32 MiB.');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setPending(true);
    setMessage('Uploading…');
    try {
      const result = await transferUpload({
        request: api.request,
        projectId,
        uploadId,
        file,
        association: { kind: 'issue-draft', draftId },
        origins,
        signal: abort.signal,
        progress: setSent,
      });
      if (abort.signal.aborted) return;
      setSent(file.size);
      setMessage(uploadStatus(result));
      if (result.state === 'ready') onReady(result.id);
      if (result.state === 'expired') {
        setUploadId(crypto.randomUUID());
        setMessage('Upload expired. Retry to reserve a fresh upload.');
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        setMessage(productError(error));
        if (error instanceof ApiClientError && error.status === 410)
          setUploadId(crypto.randomUUID());
      }
    } finally {
      if (!abort.signal.aborted) setPending(false);
    }
  }
  return (
    <fieldset
      className="upload-field"
      id={id}
      tabIndex={-1}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    >
      <legend>
        {label}
        {required ? ' (required)' : ''}
      </legend>
      {!origins.length ? (
        <p>
          Uploads are unavailable until the operator configures an approved
          direct-upload origin.
        </p>
      ) : (
        <>
          <label htmlFor={`${id}-file`}>Choose a file</label>
          <input
            id={`${id}-file`}
            name={id}
            type="file"
            accept={accept}
            disabled={pending}
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setUploadId(crypto.randomUUID());
              setSent(0);
              setMessage('');
            }}
          />
          <progress
            aria-label="Upload progress"
            value={sent}
            max={file?.size || 1}
          />
          <div className="actions">
            <button
              type="button"
              disabled={!file || pending}
              onClick={() => {
                void transfer();
              }}
            >
              Upload or retry
            </button>
            <button
              type="button"
              disabled={!pending}
              onClick={() => {
                controller.current?.abort();
                setPending(false);
                setMessage(
                  'Upload cancelled. Retry resumes the same reservation.',
                );
              }}
            >
              Cancel upload
            </button>
            <button
              type="button"
              disabled={pending || !file}
              onClick={async () => {
                const abort = new AbortController();
                controller.current = abort;
                setPending(true);
                setMessage('Checking processing status…');
                try {
                  const result = await api.request(
                    'GET /api/v1/projects/{projectId}/uploads/{uploadId}',
                    { params: { projectId, uploadId }, signal: abort.signal },
                  );
                  if (abort.signal.aborted) return;
                  setMessage(uploadStatus(result));
                  if (result.state === 'ready') onReady(result.id);
                  if (result.state === 'expired') {
                    setUploadId(crypto.randomUUID());
                    setMessage(
                      'Upload expired. Retry to reserve a fresh upload.',
                    );
                  }
                } catch (error) {
                  if (!abort.signal.aborted) setMessage(productError(error));
                } finally {
                  if (!abort.signal.aborted) setPending(false);
                }
              }}
            >
              Check processing status
            </button>
          </div>
        </>
      )}
      <output>{message}</output>
    </fieldset>
  );
}
