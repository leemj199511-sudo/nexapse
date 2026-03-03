export default function FeedLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="h-7 w-16 bg-gray-200 rounded mb-4 animate-pulse" />
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-pulse">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="flex-1">
            <div className="h-20 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 mb-3 animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full bg-gray-100 rounded" />
            <div className="h-4 w-3/4 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
