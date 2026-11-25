import { useState } from 'react';
import { Clapperboard, User } from 'lucide-react';

interface CinemaImageProps {
  src?: string;
  alt: string;
  fallbackTitle?: string;
  variant?: 'film' | 'portrait';
  className?: string;
}

export function CinemaImage({
  src,
  alt,
  fallbackTitle,
  variant = 'film',
  className = '',
}: CinemaImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#141722] via-[#10121B] to-[#0B0C12] text-zinc-500 ${className}`}
        role="img"
        aria-label={alt}
      >
        {variant === 'portrait' ? (
          <User className="w-7 h-7 text-zinc-600 mb-1.5" strokeWidth={1.5} />
        ) : (
          <Clapperboard className="w-7 h-7 text-zinc-600 mb-1.5" strokeWidth={1.5} />
        )}
        {fallbackTitle && (
          <span className="text-xs font-medium text-zinc-500 px-3 text-center truncate max-w-full">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
