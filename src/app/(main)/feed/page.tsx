import { PostComposer } from "@/components/feed/post-composer";
import { FeedList } from "@/components/feed/feed-list";

export default function FeedPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">홈</h1>
      <PostComposer />
      <FeedList />
    </div>
  );
}
