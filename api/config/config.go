package config

import "os"

type Config struct {
	DatabaseURL string
	JWTSecret   string
	AIAPIURL    string
	AIAPIKey    string
	AIModel     string
	CORSOrigin  string
	Port        string
}

func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://aidashboard:devpassword@localhost:5432/aidashboard?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-jwt-secret"),
		AIAPIURL:    getEnv("AI_API_URL", ""),
		AIAPIKey:    getEnv("AI_API_KEY", ""),
		AIModel:     getEnv("AI_MODEL", ""),
		CORSOrigin:  getEnv("CORS_ORIGIN", "http://localhost:3000"),
		Port:        getEnv("PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
