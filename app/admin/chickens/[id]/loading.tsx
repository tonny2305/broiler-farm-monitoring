export default function Loading() {
  return (
    <div className="flex flex-col justify-center items-center min-h-[400px] gap-3">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      <p className="text-muted-foreground">Memuat data batch...</p>
    </div>
  );
} 