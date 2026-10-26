import crypto from 'node:crypto';

/**
 * Build the parameters a client needs to perform a *signed* upload directly
 * to Cloudinary (bypassing our server bandwidth).
 *
 * Client uses these as multipart fields:
 *   file, api_key, timestamp, folder, signature
 * POST to: https://api.cloudinary.com/v1_1/<cloud_name>/image/upload
 */
export function makeUploadSignature({ folder = 'workers', publicId } = {}) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error('cloudinary_not_configured');
    err.statusCode = 503;
    throw err;
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Params to sign MUST be sorted alphabetically.
  const params = { folder, timestamp };
  if (publicId) params.public_id = publicId;

  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  const signature = crypto
    .createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    publicId: publicId || null,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  };
}
