package storage

import (
	"context"
	"fmt"
	"io"
	"log"
	"time"

	"github.com/aidashboard/api/config"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioStorage struct {
	client           *minio.Client
	bucket           string
}

func NewMinioStorage(cfg *config.Config) (*MinioStorage, error) {
	client, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: cfg.MinioUseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio client init: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = client.MakeBucket(ctx, cfg.MinioBucket, minio.MakeBucketOptions{})
	if err != nil {
		exists, errCheck := client.BucketExists(ctx, cfg.MinioBucket)
		if errCheck != nil || !exists {
			return nil, fmt.Errorf("minio bucket create: %w", err)
		}
	} else {
		log.Printf("Created MinIO bucket: %s", cfg.MinioBucket)
	}

	return &MinioStorage{
		client:           client,
		bucket:           cfg.MinioBucket,
		}, nil
}

func (s *MinioStorage) Upload(ctx context.Context, objectName string, reader io.Reader, size int64, contentType string) error {
	_, err := s.client.PutObject(ctx, s.bucket, objectName, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return fmt.Errorf("minio upload %s: %w", objectName, err)
	}
	return nil
}

func (s *MinioStorage) Download(ctx context.Context, objectName string) (io.ReadCloser, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("minio download %s: %w", objectName, err)
	}
	return obj, nil
}

func (s *MinioStorage) HealthCheck(ctx context.Context) error {
	_, err := s.client.BucketExists(ctx, s.bucket)
	return err
}

var _ interface {
	Upload(context.Context, string, io.Reader, int64, string) error
} = (*MinioStorage)(nil)
