import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const form = new formidable.IncomingForm();
  form.uploadDir = '/tmp';
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files: any) => {
    if (err) return res.status(500).json({ error: err.message });

    const file = files.file;
    const fileBuffer = fs.readFileSync(file.filepath);

    try {
      // Upload to Google Drive (or another cloud storage)
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      const drive = google.drive({ version: 'v3', auth });
      const tmpPath = path.join('/tmp', file.originalFilename);
      fs.writeFileSync(tmpPath, fileBuffer);

      const uploaded = await drive.files.create({
        requestBody: { name: file.originalFilename },
        media: { mimeType: 'application/pdf', body: fs.createReadStream(tmpPath) },
      });

      await drive.permissions.create({
        fileId: uploaded.data.id,
        requestBody: { role: 'reader', type: 'anyone' },
      });

      const publicUrl = `https://drive.google.com/uc?export=download&id=${uploaded.data.id}`;
      res.status(200).json({ url: publicUrl });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
