import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '未选择文件' }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支持的文件类型，请上传 PNG、JPEG、GIF、WebP 或 SVG 格式的图片' }, { status: 400 });
    }

    // 限制文件大小 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 });
    }

    // 创建上传目录
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${randomUUID()}.${ext}`;
    const filePath = join(uploadDir, fileName);

    // 写入文件
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // 返回可访问的 URL
    const url = `/uploads/${fileName}`;

    return NextResponse.json({ url, fileName: file.name });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
