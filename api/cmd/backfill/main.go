// Command backfill recomputes token_usage cache fields from raw JSONL stored
// in MinIO. Safe to re-run — only updates rows still missing cache data.
//
// Usage (inside the api container):
//   docker compose exec api /usr/local/bin/backfill
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"log"
	"strings"
	"time"

	"github.com/aidashboard/api/config"
	"github.com/aidashboard/api/db"
	"github.com/aidashboard/api/storage"
	"github.com/lib/pq"
)

type event struct {
	Type      string          `json:"type"`
	Message   json.RawMessage `json:"message,omitempty"`
}

type assistantMsg struct {
	Model   string     `json:"model"`
	Usage   *usageInfo `json:"usage"`
}

type usageInfo struct {
	InputTokens              int64 `json:"input_tokens"`
	OutputTokens             int64 `json:"output_tokens"`
	CacheCreationInputTokens int64 `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int64 `json:"cache_read_input_tokens"`
}

type aggregate struct {
	input, output, cacheCreate, cacheRead int64
	models                                []string
}

func (a *aggregate) total() int64 {
	return a.input + a.output + a.cacheCreate + a.cacheRead
}

func main() {
	cfg := config.Load()
	if !cfg.MinioConfigured() {
		log.Fatal("MinIO not configured; cannot read raw logs")
	}

	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer database.Close()

	store, err := storage.NewMinioStorage(cfg)
	if err != nil {
		log.Fatalf("minio init: %v", err)
	}

	rows, err := database.Query(`
		SELECT s.id, s.raw_log_url
		FROM sessions s
		WHERE s.raw_log_url IS NOT NULL AND s.raw_log_url <> ''
		  AND EXISTS (SELECT 1 FROM token_usage tu WHERE tu.session_id = s.id)
		  AND EXISTS (
		    SELECT 1 FROM token_usage tu
		    WHERE tu.session_id = s.id
		      AND (tu.cache_creation_tokens + tu.cache_read_tokens) = 0
		  )`)
	if err != nil {
		log.Fatalf("query sessions: %v", err)
	}
	defer rows.Close()

	type pending struct {
		id      string
		logURL  string
	}
	var todo []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.logURL); err != nil {
			log.Fatalf("scan: %v", err)
		}
		todo = append(todo, p)
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("rows iter: %v", err)
	}

	log.Printf("backfill: %d session(s) to process", len(todo))

	processed, skipped, failed := 0, 0, 0
	for i, p := range todo {
		agg, err := reparse(store, p.logURL)
		if err != nil {
			log.Printf("[%d/%d] %s: parse failed: %v", i+1, len(todo), p.id, err)
			failed++
			continue
		}
		if agg.total() == 0 && len(agg.models) == 0 {
			skipped++
			continue
		}
		models := agg.models
		if len(models) == 0 {
			models = []string{}
		}
		_, err = database.Exec(`
			UPDATE token_usage SET
			  input_tokens = $2,
			  output_tokens = $3,
			  cache_creation_tokens = $4,
			  cache_read_tokens = $5,
			  total_tokens = $6,
			  models = $7
			WHERE session_id = $1`,
			p.id, agg.input, agg.output, agg.cacheCreate, agg.cacheRead,
			agg.total(), pq.Array(models))
		if err != nil {
			log.Printf("[%d/%d] %s: update failed: %v", i+1, len(todo), p.id, err)
			failed++
			continue
		}
		processed++
		if len(models) > 0 {
			_, _ = database.Exec(`UPDATE sessions SET models = $2 WHERE id = $1 AND (models IS NULL OR models = '{}')`,
				p.id, pq.Array(models))
		}
		if (i+1)%50 == 0 {
			log.Printf("[%d/%d] progress", i+1, len(todo))
		}
	}

	log.Printf("backfill done: processed=%d skipped=%d failed=%d", processed, skipped, failed)
}

func reparse(store *storage.MinioStorage, objectName string) (*aggregate, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	stream, err := store.Download(ctx, objectName)
	if err != nil {
		return nil, err
	}
	defer stream.Close()

	agg := &aggregate{}
	seen := map[string]struct{}{}

	scanner := bufio.NewScanner(stream)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var ev event
		if json.Unmarshal([]byte(line), &ev) != nil {
			continue
		}
		if ev.Type != "assistant" {
			continue
		}
		var msg assistantMsg
		if json.Unmarshal(ev.Message, &msg) != nil {
			continue
		}
		if msg.Model != "" && msg.Model != "<synthetic>" {
			if _, ok := seen[msg.Model]; !ok {
				seen[msg.Model] = struct{}{}
				agg.models = append(agg.models, msg.Model)
			}
		}
		if msg.Usage != nil {
			agg.input += msg.Usage.InputTokens
			agg.output += msg.Usage.OutputTokens
			agg.cacheCreate += msg.Usage.CacheCreationInputTokens
			agg.cacheRead += msg.Usage.CacheReadInputTokens
		}
	}
	if err := scanner.Err(); err != nil && err != io.EOF {
		return nil, err
	}
	return agg, nil
}
