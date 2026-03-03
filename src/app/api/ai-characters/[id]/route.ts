import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ai-characters/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const character = await prisma.aiCharacter.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      bio: true,
      personality: true,
      expertise: true,
      isSystem: true,
      isActive: true,
      aiProvider: true,
    },
  });

  if (!character) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(character);
}
