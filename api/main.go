package main

import (
	"log"
	"net/http"

	"github.com/aidashboard/api/config"
	"github.com/aidashboard/api/db"
	"github.com/aidashboard/api/handler"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := config.Load()

	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	log.Println("Running migrations...")
	if err := db.RunMigrations(database); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Migrations complete")

	authH := handler.NewAuthHandler(database, cfg.JWTSecret)
	reqH := handler.NewRequirementHandler(database)
	taskH := handler.NewTaskHandler(database)
	sessionH := handler.NewSessionHandler(database)
	reportH := handler.NewReportHandler(database)

	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(corsMiddleware(cfg.CORSOrigin))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	r.Post("/api/v1/auth/login", authH.Login)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(handler.AuthMiddleware(cfg.JWTSecret))

		r.Get("/auth/me", authH.Me)
		r.Get("/users", authH.ListUsers)

		r.Get("/requirements", reqH.List)
		r.Post("/requirements", reqH.Create)
		r.Get("/requirements/{id}", reqH.Get)
		r.Put("/requirements/{id}", reqH.Update)
		r.Get("/requirements/{id}/ac", reqH.GetAC)

		r.Get("/tasks", taskH.List)
		r.Post("/tasks", taskH.Create)
		r.Get("/tasks/{id}", taskH.Get)
		r.Put("/tasks/{id}", taskH.Update)
		r.Put("/tasks/{id}/status", taskH.UpdateStatus)
		r.Post("/tasks/{id}/dependencies", taskH.AddDependency)
		r.Delete("/tasks/{id}/dependencies/{dep_id}", taskH.RemoveDependency)

		r.Post("/sessions/batch", sessionH.BatchUpload)
		r.Get("/sessions", sessionH.List)
		r.Get("/sessions/{id}", sessionH.Get)
		r.Put("/sessions/{id}/task", sessionH.UpdateTask)
		r.Delete("/sessions/{id}", sessionH.Withdraw)

		r.Get("/reports", reportH.List)
		r.Get("/reports/today", reportH.GetOrCreateToday)
		r.Get("/reports/{id}", reportH.Get)
		r.Put("/reports/{id}", reportH.Update)
	})

	log.Printf("Starting API server on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func corsMiddleware(origin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
