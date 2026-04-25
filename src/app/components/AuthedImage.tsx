import React, { useEffect, useState } from 'react';
import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, getToken } from '@/app/lib/auth';

type Props = {
  /** Ruta relativa /api/... o URL absoluta */
  apiPath: string;
  alt: string;
  className?: string;
};

/**
 * Carga imágenes protegidas con Bearer (img no envía cabecera por defecto).
 */
export const AuthedImage: React.FC<Props> = ({ apiPath, alt, className }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!apiPath) {
      setUrl(null);
      setErr(false);
      return;
    }
    let path = apiPath;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        const u = new URL(path);
        if (u.pathname.startsWith('/api/') && u.pathname.includes('ripening-processes')) {
          path = u.pathname;
        } else {
          setUrl(path);
          setErr(false);
          return () => {};
        }
      } catch {
        setErr(true);
        setUrl(null);
        return () => {};
      }
    }
    if (!getToken()) {
      setErr(true);
      setUrl(null);
      return () => {};
    }
    const full = `${RIPENER_API_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    let objectUrl: string | null = null;
    let cancelled = false;
    const ac = new AbortController();
    setErr(false);
    fetch(full, { headers: authHeaders(), signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
      ac.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [apiPath]);

  if (err || !url) {
    return (
      <div
        className={className}
        style={{ background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)' }}
        aria-hidden
      />
    );
  }
  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={url} alt={alt} className={className} />;
};
