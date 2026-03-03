from minio import Minio
from minio.error import S3Error
from app.core.config import settings
import io
from datetime import timedelta


class S3Service:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_URL.replace("http://", "").replace("https://", ""),
            access_key=settings.MINIO_ROOT_USER,
            secret_key=settings.MINIO_ROOT_PASSWORD,
            secure=False,
        )
        self.bucket = settings.S3_BUCKET

    async def ensure_bucket_exists(self):
        """Create bucket if it doesn't exist."""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error as e:
            print(f"Error creating bucket: {e}")

    async def upload_file(
        self,
        file_data: bytes,
        file_name: str,
        s3_key: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload file to MinIO."""
        try:
            self.client.put_object(
                self.bucket,
                s3_key,
                io.BytesIO(file_data),
                length=len(file_data),
                content_type=content_type,
            )
            return s3_key
        except S3Error as e:
            raise Exception(f"Error uploading file: {e}")

    async def get_presigned_url(self, s3_key: str, expires: int = 3600) -> str:
        """Get presigned URL for download (expires in seconds)."""
        try:
            url = self.client.get_presigned_download_url(
                self.bucket,
                s3_key,
                expires=timedelta(seconds=expires),
            )
            return url
        except S3Error as e:
            raise Exception(f"Error getting presigned URL: {e}")


s3_service = S3Service()
