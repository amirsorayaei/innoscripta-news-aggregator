import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { MainNav } from './MainNav'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11">
          <Menu aria-hidden="true" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar">
        <SheetHeader>
          <SheetTitle>News Desk</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate between sections.
          </SheetDescription>
        </SheetHeader>
        <div className="px-3">
          <MainNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
