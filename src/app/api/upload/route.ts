import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

// POST /api/upload — 이미지 업로드 (Supabase Storage)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file — 영상 업로드는 현재 비활성화
  const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const isImage = imageTypes.includes(file.type);

  if (!isImage) {
    return NextResponse.json({ error: "현재 이미지만 업로드할 수 있습니다. (jpg, png, gif, webp)" }, { status: 400 });
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "파일이 너무 큽니다. (최대 5MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `uploads/${session.user.id}/${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from("nexapse-media")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data } = supabase.storage.from("nexapse-media").getPublicUrl(path);

  return NextResponse.json({ url: data.publicUrl });
}
