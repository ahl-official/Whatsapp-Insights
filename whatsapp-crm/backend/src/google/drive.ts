import { google } from 'googleapis';
import { Readable } from 'stream';
import { config } from '../config';

function getAuth() {
  return new google.auth.JWT(
    config.google.serviceAccountEmail,
    undefined,
    config.google.privateKey,
    ['https://www.googleapis.com/auth/drive.file']
  );
}

export async function uploadToDrive(fileName: string, content: string): Promise<void> {
  const auth  = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const stream = Readable.from([content]);

  await drive.files.create({
    requestBody: {
      name:    fileName,
      parents: [config.google.driveFolderId],
    },
    media: {
      mimeType: 'application/json',
      body:     stream,
    },
  });
}
