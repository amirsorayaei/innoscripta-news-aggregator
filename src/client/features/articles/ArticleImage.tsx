import { useState } from 'react'
import { Newspaper } from 'lucide-react'

interface ArticleImageProps {
  src?: string
}

/** 16:9 image with reserved space; missing or broken images show a quiet placeholder. */
export function ArticleImage({ src }: ArticleImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
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
      onError={() => setFailed(true)}
      className="aspect-video w-full bg-muted object-cover"
    />
  )
}
