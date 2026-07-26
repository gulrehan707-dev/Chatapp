export default function AppHomePage() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-zinc-500">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Slack Lite
        </h1>
        <p className="mt-2 text-sm">
          Pick a channel or start a direct message from the sidebar.
        </p>
      </div>
    </div>
  );
}
