"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createChannel, signOut, startDm } from "@/app/actions/auth";
import { useSocket } from "@/components/socket-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ConversationListItem, Profile } from "@/lib/types";

function PresenceDot({ userId }: { userId: string }) {
  const { presence } = useSocket();
  const status = presence[userId] ?? "offline";
  return (
    <span
      className={`ml-auto h-2 w-2 rounded-full ${
        status === "online" ? "bg-emerald-500" : "bg-zinc-400"
      }`}
    />
  );
}

export function Sidebar({
  profile,
  conversations,
  joinableChannels,
  searchableUsers,
}: {
  profile: Profile;
  conversations: ConversationListItem[];
  joinableChannels: ConversationListItem[];
  searchableUsers: Profile[];
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const channels = conversations.filter((item) => item.type === "channel");
  const dms = conversations.filter((item) => item.type === "dm");

  const filteredUsers = searchableUsers.filter(
    (user) =>
      user.username.includes(query.toLowerCase()) ||
      user.display_name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-zinc-50 dark:bg-zinc-950">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <Avatar name={profile.display_name} />
          <div>
            <p className="text-sm font-semibold">{profile.display_name}</p>
            <p className="text-xs text-zinc-500">@{profile.username}</p>
          </div>
        </div>
        <form action={signOut} className="mt-3">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Sign out
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1 p-4">
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
            Channels
          </h2>
          <form action={createChannel} className="mb-2 flex gap-2">
            <Input name="name" placeholder="New channel" />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
          <ul className="space-y-1">
            {channels.map((channel) => (
              <li key={channel.id}>
                <Link
                  href={`/app/c/${channel.id}`}
                  className={`flex items-center rounded px-2 py-1 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-900 ${
                    pathname === `/app/c/${channel.id}` ? "bg-zinc-200 dark:bg-zinc-900" : ""
                  }`}
                >
                  # {channel.name}
                </Link>
              </li>
            ))}
          </ul>
          {joinableChannels.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-zinc-500">Join a channel</p>
              <ul className="space-y-1">
                {joinableChannels.map((channel) => (
                  <li key={channel.id}>
                    <Link
                      href={`/app/c/${channel.id}?join=1`}
                      className="block rounded px-2 py-1 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-900"
                    >
                      # {channel.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
            Direct messages
          </h2>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find people"
            className="mb-2"
          />
          {query ? (
            <ul className="mb-3 space-y-1">
              {filteredUsers.map((user) => (
                <li key={user.id}>
                  <form action={startDm}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="h-auto w-full justify-start px-2 py-1"
                    >
                      <Avatar name={user.display_name} className="mr-2 h-6 w-6 text-[10px]" />
                      {user.display_name}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="space-y-1">
            {dms.map((dm) => {
              const label = dm.otherUser?.display_name ?? "Direct message";
              const otherId = dm.otherUser?.id;
              return (
                <li key={dm.id}>
                  <Link
                    href={`/app/c/${dm.id}`}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-900 ${
                      pathname === `/app/c/${dm.id}` ? "bg-zinc-200 dark:bg-zinc-900" : ""
                    }`}
                  >
                    <Avatar name={label} className="h-6 w-6 text-[10px]" />
                    <span>{label}</span>
                    {otherId ? <PresenceDot userId={otherId} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </ScrollArea>
    </aside>
  );
}
