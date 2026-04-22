export function BootstrapErrorFallback() {
  return (
    <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
      <div className="border-destructive/20 bg-destructive-container/20 max-w-md rounded-xl border p-5">
        <h1 className="text-base font-semibold">Application failed to start</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Restart the application. Check the console if this happens again.
        </p>
      </div>
    </div>
  )
}
