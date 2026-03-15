import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export interface TestimonialAuthor {
  name: string
  handle: string
  avatar?: string
  initials?: string
}

export interface TestimonialCardProps {
  author: TestimonialAuthor
  text: string
  href?: string
  className?: string
}

export function TestimonialCard({
  author,
  text,
  href,
  className,
}: TestimonialCardProps) {
  const Card = href ? "a" : "div"

  return (
    <Card
      {...(href ? { href } : {})}
      className={cn(
        "flex flex-col rounded-lg",
        "bg-white",
        "p-4 text-start sm:p-6",
        "max-w-[320px] sm:max-w-[320px]",
        "card-pop",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-accent/10 text-accent font-bold text-sm">
            {author.initials ?? author.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-start">
          <h3 className="text-md font-semibold leading-none text-text">
            {author.name}
          </h3>
          <p className="text-sm text-text-muted">{author.handle}</p>
        </div>
      </div>
      <p className="sm:text-md mt-4 text-sm text-text-muted">{text}</p>
    </Card>
  )
}
