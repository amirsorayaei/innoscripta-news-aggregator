import { useState } from 'react'
import { Newspaper } from 'lucide-react'

interface ArticleImageProps {
  src?: string
}

/** 16:9 image with reserved space; missing or broken images show a quiet placeholder. */
export function ArticleImage({ src }: ArticleImageProps) {
  // Tracks the URL that failed, so a different src (e.g. after a merge) loads again.
  const [failedSrc, setFailedSrc] = useState<string>()

  if (!src || src === failedSrc) {
    return (
      <div
        aria-hidden="true"
        className="flex aspect-video w-full items-center justify-center bg-linear-to-br from-secondary to-accent/60 text-accent-foreground/40"
      >
        <Newspaper className="size-8" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      width={640}
      height={360}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className="aspect-video w-full bg-muted object-cover"
    />
  )
}
