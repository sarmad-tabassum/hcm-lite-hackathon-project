'use client'
import { Bell } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown'
import { useGetNotificationsQuery, useMarkNotificationsReadMutation } from '@/store/services/commsApi'
import { cn } from '@/lib/utils'

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationsBell({ profile }) {
  const { data } = useGetNotificationsQuery(undefined, {
    skip: !profile.company_id,
    pollingInterval: 60000,
  })
  const [markRead] = useMarkNotificationsReadMutation()
  const items = data?.notifications || []
  const unread = items.filter((n) => !n.is_read).length

  return (
    <Dropdown
      width="w-80"
      trigger={
        <button className="relative rounded-md p-1.5 hover:bg-accent" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <DropdownLabel className="px-0">Notifications</DropdownLabel>
        {unread > 0 && (
          <DropdownItem className="w-auto px-1.5 py-1 text-xs text-primary" onClick={() => markRead()}>
            Mark all read
          </DropdownItem>
        )}
      </div>
      <DropdownSeparator />
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet</p>}
        {items.map((n) => (
          <div key={n.id} className={cn('px-3 py-2 text-sm', !n.is_read && 'bg-primary/5')}>
            <p className="font-medium leading-snug">{n.title}</p>
            <p className="text-xs text-muted-foreground">{n.message}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
          </div>
        ))}
      </div>
    </Dropdown>
  )
}
