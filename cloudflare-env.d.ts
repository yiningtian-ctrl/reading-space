declare namespace Cloudflare {
  interface Env {
    READSPACE_DB?: D1Database;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
