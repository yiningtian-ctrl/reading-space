declare namespace Cloudflare {
  interface Env {
    READSPACE_DB?: D1Database;
    READSPACE_SMTP_PASSWORD?: string;
    READSPACE_SMTP_FROM?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
