import { SocketProvider } from "@/components/socket-provider";
import { Sidebar } from "@/components/sidebar";
import {
  getConversations,
  getCurrentProfile,
  getJoinableChannels,
  searchProfiles,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await getCurrentProfile();
  if (!user || !profile) {
    return null;
  }

  const [conversations, joinableChannels, searchableUsers] = await Promise.all([
    getConversations(user.id),
    getJoinableChannels(user.id),
    searchProfiles("", user.id),
  ]);

  return (
    <SocketProvider>
      <div className="flex h-screen">
        <Sidebar
          profile={profile}
          conversations={conversations}
          joinableChannels={joinableChannels}
          searchableUsers={searchableUsers}
        />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </SocketProvider>
  );
}
