"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "");
  const displayName = String(formData.get("displayName") ?? username);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/app");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }

  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createChannel(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Channel name is required");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_channel", {
    channel_name: name,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
  redirect(`/app/c/${data}`);
}

export async function startDm(formData: FormData) {
  const otherUserId = String(formData.get("userId") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_dm", {
    other_user_id: otherUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
  redirect(`/app/c/${data}`);
}

export async function joinChannel(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_channel", {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
}
