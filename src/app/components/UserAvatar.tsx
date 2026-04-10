import React, { useEffect, useState } from 'react';
import { RIPENER_API_URL } from '@/app/config';
import { getToken } from '@/app/lib/auth';
import { User } from 'lucide-react';

const defaultSrc = () => `${import.meta.env.BASE_URL}avatar-default.svg`;

interface UserAvatarProps {
  userId: string;
  hasPhoto?: boolean;
  name?: string;
  size?: number;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  hasPhoto,
  name,
  size = 32,
  className = '',
}) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto || !userId) {
      setSrc(null);
      return;
    }
    const token = getToken();
    if (!token) {
      setSrc(null);
      return;
    }
    const base = RIPENER_API_URL.replace(/\/$/, '');
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await fetch(`${base}/api/v1/users/${encodeURIComponent(userId)}/avatar`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) {
          if (!cancelled) setSrc(null);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [userId, hasPhoto]);

  const initial = name?.trim()?.charAt(0)?.toUpperCase() || '';

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gray-200 flex items-center justify-center text-gray-600 shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {initial ? (
        <span className="text-sm font-semibold">{initial}</span>
      ) : (
        <img src={defaultSrc()} alt="" width={size} height={size} className="object-cover w-full h-full" />
      )}
    </div>
  );
};

/** Avatar compacto con icono si no hay nombre */
export const UserAvatarOrIcon: React.FC<UserAvatarProps> = (props) => {
  if (!props.hasPhoto && !props.name) {
    return (
      <div
        className="rounded-full bg-gray-200 flex items-center justify-center text-gray-600 shrink-0"
        style={{ width: props.size ?? 32, height: props.size ?? 32 }}
      >
        <User className="h-4 w-4" />
      </div>
    );
  }
  return <UserAvatar {...props} />;
};
