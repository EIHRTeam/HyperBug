import { useEffect, useRef, useState } from 'react';
import { useAuth, usePublicConfig } from '../app.tsx';
import { productError } from '../product-state.ts';
export function AttachmentReference({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const { auth } = useAuth();
  const config = usePublicConfig();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<string>();
  const urls = useRef(new Set<string>());
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const owned = urls.current;
    return () => {
      controller.current?.abort();
      for (const url of owned) URL.revokeObjectURL(url);
      owned.clear();
    };
  }, []);
  if (!config.mediaOrigins[0])
    return (
      <span>
        Attachment {label || id}: downloads are unavailable until an isolated
        media origin is configured.
      </span>
    );
  async function load(preview: boolean) {
    if (pending) return;
    setPending(true);
    setMessage('');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const { blob, imageType } = await auth.downloadAttachment(
        id,
        config.mediaOrigins[0]!,
        abort.signal,
      );
      if (preview && (!imageType || blob.size > 8388608)) {
        setMessage(
          'Only released raster images up to 8 MiB can be previewed. Download this file to open it.',
        );
        return;
      }
      const url = URL.createObjectURL(
        preview ? new Blob([blob], { type: imageType! }) : blob,
      );
      urls.current.add(url);
      if (preview) {
        if (image) {
          URL.revokeObjectURL(image);
          urls.current.delete(image);
        }
        setImage(url);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download =
          label.replace(/[\\/:*?"<>|]/g, '_').slice(0, 200) ||
          `attachment-${id}`;
        link.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          urls.current.delete(url);
        }, 1000);
      }
    } catch (error) {
      if (!abort.signal.aborted) setMessage(productError(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="image-reference">
      <span>Attachment: {label || id}</span>
      <span className="actions">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void load(false);
          }}
        >
          Download attachment
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void load(true);
          }}
        >
          Preview image
        </button>
      </span>
      <output>{message}</output>
      {image ? <img src={image} alt={label} /> : null}
    </span>
  );
}
