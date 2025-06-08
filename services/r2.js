// Externals
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

/**
 * @dev Configuration for the R2Service class.
 */
// export interface R2Config {
//   accountId: string
//   accessKeyId: string
//   secretAccessKey: string
//   bucket: string
// }

/**
 * @dev Service for interacting with Cloudflare R2.
 * @notice Used to store and retrieve files from Cloudflare R2.
 * @notice Used to generate pre-signed URLs for direct uploads (for frontend 
 * use).
 * @notice Used to store files from a base64 string (typically called from 
 * backend).
 * @notice Used to get a public URL for a stored file.
 */
class R2Service {
  config/* : R2Config */
  apiUrl/* : string */
  s3Client/* : S3Client */

  /**
   * @dev Constructor for the R2Service class.
   * @param config - The configuration for the R2Service.
   */
  constructor (config/*: R2Config */) {
    this.config = config
    this.apiUrl = `https://${ config.accountId }.r2.cloudflarestorage.com`
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.apiUrl,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  /**
   * @dev Generate a pre-signed URL for direct uploads (for frontend use).
   * @notice Used when you want users to upload files (e.g., attachments, 
   * images) directly from their browser to your R2 bucket, you do not want to 
   * send your R2 credentials to the client. Instead, your backend generates a 
   * pre-signed URL using getPresignedUploadUrl(), sends it to the client, and 
   * the client uploads the file directly to R2 using that URL.
   * @notice Why not use the S3 client directly and use the pre-signed URL?
   * - Security: Credentials are never exposed to the client.
   * - Efficiency: Large files do not need to be proxied through your backend.
   * - Scalability: Reduces load on your backend server.
   * @notice Why might you not use a presigned URL?
   * - If all uploads are handled server-side (e.g., files are sent to your 
   * backend for processing, then your backend uploads to R2), you do not need 
   * pre-signed URLs.
   * - If you do not have a frontend feature for direct-to-R2 uploads, this 
   * method will not be used.
   * @param key - The key to store the file under.
   * @param contentType - The content type of the file.
   * @param expiresIn - The number of seconds the URL should be valid for.
   * @returns The pre-signed URL.
   */
  async getPresignedUploadUrl (
    key/*: string */,
    contentType/*: string */,
    expiresIn = 3600,
  )/*: Promise<string> */ {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    })
    const url = await getSignedUrl(this.s3Client, command, { expiresIn })
    return url
  }

  /**
   * @dev Store a file from a base64 string (typically called from backend).
   * @param key - The key to store the file under.
   * @param base64Data - The base64 data of the file.
   * @param contentType - The content type of the file.
   * @returns The public URL of the stored file.
   */
  async storeFile (
    key/*: string */,
    base64Data/*: string */,
    contentType/*: string */,
  )/*: Promise<string> */ {
    // Decode base64 data
    const buffer = Buffer.from(base64Data, 'base64')

    // Upload to R2 using S3-compatible API
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      })
    )

    return this.getPublicUrl(key)
  }

  /**
   * @dev Get a public URL for a stored file.
   * @param key - The key of the file.
   * @returns The public URL of the stored file.
   */
  getPublicUrl (key/*: string */)/*: string */ {
    return `${ this.apiUrl }/${ this.config.bucket }/${ key }`
  }
}

// Create a singleton instance with default config
const defaultConfig/*: R2Config */ = {
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET_NAME || '',
}


const r2Service = new R2Service(defaultConfig)

module.exports = {
  r2Service
}