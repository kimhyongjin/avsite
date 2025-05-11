export const runtime = 'nodejs';
export const config  = { api: { bodyParser: false } };

import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function GET(req: Request) {
  const url        = new URL(req.url);
  const fileName   = url.searchParams.get('fileName');
  const contentType= url.searchParams.get('contentType');

  if (!fileName || !contentType) {
    return NextResponse.json(
      { error: 'fileName과 contentType 쿼리 파라미터가 필요합니다.' },
      { status: 400 }
    );
  }

  const bucket = process.env.S3_BUCKET!;
  const region = process.env.AWS_REGION!;
  const s3     = new S3Client({ region });

  const command = new PutObjectCommand({
    Bucket:      bucket,
    Key:         `videos/${Date.now()}-${fileName}`,
    ContentType: contentType,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return NextResponse.json({ url: signedUrl, key: command.input.Key });
}
