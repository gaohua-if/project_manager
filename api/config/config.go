package config

import "os"

type Config struct {
	DatabaseURL        string
	JWTSecret          string
	AIAPIURL           string
	AIAPIKey           string
	AIModel            string
	CORSOrigin         string
	Port               string
	ReportGeneratorURL string
	ManagedAgentURL    string
	ManagedAgentToken  string

	// AIHub unified-auth platform (shared trust root with the managed-agent
	// platform). When AIHubJWTSecret is set, tokens are verified locally;
	// otherwise Aida introspects via the AIHub userinfo endpoint.
	AIHubHost       string
	AIHubJWTSecret  string

	MinioEndpoint         string
	MinioAccessKey        string
	MinioSecretKey        string
	MinioBucket           string
	MinioUseSSL           bool
	MinioExternalEndpoint string
}

func Load() *Config {
	return &Config{
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://aidashboard:devpassword@localhost:5432/aidashboard?sslmode=disable"),
		JWTSecret:          getEnv("JWT_SECRET", "dev-jwt-secret"),
		AIAPIURL:           getEnv("AI_API_URL", ""),
		AIAPIKey:           getEnv("AI_API_KEY", ""),
		AIModel:            getEnv("AI_MODEL", ""),
		CORSOrigin:         getEnv("CORS_ORIGIN", "http://localhost:3000"),
		Port:               getEnv("PORT", "8080"),
		ReportGeneratorURL: getEnv("REPORT_GENERATOR_URL", ""),
		ManagedAgentURL:    getEnv("MANAGED_AGENT_URL", ""),
		ManagedAgentToken:  getEnv("MANAGED_AGENT_TOKEN", ""),

		AIHubHost:      getEnv("AIHUB_HOST", ""),
		AIHubJWTSecret: getEnv("AIHUB_JWT_SECRET", ""),

		MinioEndpoint:         getEnv("MINIO_ENDPOINT", ""),
		MinioAccessKey:        getEnv("MINIO_ACCESS_KEY", ""),
		MinioSecretKey:        getEnv("MINIO_SECRET_KEY", ""),
		MinioBucket:           getEnv("MINIO_BUCKET", "aidashboard"),
		MinioUseSSL:           getEnv("MINIO_USE_SSL", "false") == "true",
		MinioExternalEndpoint: getEnv("MINIO_EXTERNAL_ENDPOINT", ""),
	}
}

func (c *Config) MinioConfigured() bool {
	return c.MinioEndpoint != "" && c.MinioAccessKey != "" && c.MinioSecretKey != ""
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
