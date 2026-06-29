package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"
)

const ManagedAgentRunTimeout = time.Hour

type ManagedAgentRunStatusSyncer struct {
	db         *sql.DB
	client     *ManagedAgentClient
	interval   time.Duration
	timeout    time.Duration
	batchLimit int
}

type managedAgentRunStatusRow struct {
	ID             string
	ExternalTaskID string
	Status         string
	StartedAt      time.Time
}

func NewManagedAgentRunStatusSyncer(db *sql.DB, client *ManagedAgentClient) *ManagedAgentRunStatusSyncer {
	return &ManagedAgentRunStatusSyncer{
		db:         db,
		client:     client,
		interval:   time.Minute,
		timeout:    ManagedAgentRunTimeout,
		batchLimit: 100,
	}
}

func (s *ManagedAgentRunStatusSyncer) Start(ctx context.Context) {
	if s == nil || s.db == nil || s.client == nil || !s.client.Configured() {
		return
	}
	go func() {
		if err := s.RunOnce(ctx, time.Now()); err != nil {
			log.Printf("managed agent run status syncer failed: %v", err)
		}

		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				if err := s.RunOnce(ctx, now); err != nil {
					log.Printf("managed agent run status syncer failed: %v", err)
				}
			}
		}
	}()
}

func (s *ManagedAgentRunStatusSyncer) RunOnce(ctx context.Context, now time.Time) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id::text, external_task_id, status, COALESCE(started_at, created_at)
		FROM ai_runs
		WHERE external_task_id IS NOT NULL
			AND status NOT IN ('succeeded', 'failed', 'timeout')
		ORDER BY created_at ASC
		LIMIT $1`, s.batchLimit)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var run managedAgentRunStatusRow
		if err := rows.Scan(&run.ID, &run.ExternalTaskID, &run.Status, &run.StartedAt); err != nil {
			return err
		}
		if err := s.refreshRun(ctx, run, now); err != nil {
			log.Printf("managed agent run %s status refresh failed: %v", run.ID, err)
		}
	}
	return rows.Err()
}

func (s *ManagedAgentRunStatusSyncer) refreshRun(ctx context.Context, run managedAgentRunStatusRow, now time.Time) error {
	task, err := s.client.GetTaskStatus(ctx, run.ExternalTaskID)
	if err != nil {
		if s.isTimedOut(run, now) {
			msg := "managed agent run timed out after 1h while refreshing status: " + err.Error()
			return s.updateRunStatus(ctx, run, nil, "timeout", msg, now)
		}
		return err
	}

	status := NormalizeManagedRunStatus(task.Status)
	errMsg := ""
	if status == "failed" && strings.TrimSpace(task.Error) != "" {
		errMsg = task.Error
	}
	if !IsTerminalManagedRunStatus(status) && s.isTimedOut(run, now) {
		status = "timeout"
		errMsg = "managed agent run timed out after 1h"
	}
	return s.updateRunStatus(ctx, run, task, status, errMsg, now)
}

func (s *ManagedAgentRunStatusSyncer) isTimedOut(run managedAgentRunStatusRow, now time.Time) bool {
	return !run.StartedAt.IsZero() && !now.Before(run.StartedAt.Add(s.timeout))
}

func (s *ManagedAgentRunStatusSyncer) updateRunStatus(ctx context.Context, run managedAgentRunStatusRow, task *ManagedTaskStatus, status string, errorMessage string, now time.Time) error {
	output := map[string]any{
		"task_id":   run.ExternalTaskID,
		"status":    status,
		"synced_at": now.UTC().Format(time.RFC3339),
	}
	agentVersionID := 0
	modelID := ""
	if task != nil {
		if task.TaskID != "" {
			output["task_id"] = task.TaskID
		}
		if task.Status != "" {
			output["status"] = task.Status
		}
		if task.Progress != "" {
			output["progress"] = task.Progress
		}
		if task.Error != "" {
			output["error"] = task.Error
		}
		agentVersionID = task.AgentVersionID
		modelID = strings.TrimSpace(task.ModelID)
	}
	if errorMessage != "" {
		output["error"] = errorMessage
	}
	outputJSON, _ := json.Marshal(output)

	sets := []string{"status = $1", "output_ref_json = $2", "agent_version_id = $3"}
	args := []any{status, outputJSON, nullableManagedInt(agentVersionID)}
	argIdx := 4
	if modelID != "" {
		sets = append(sets, fmt.Sprintf("model_id = $%d", argIdx))
		args = append(args, modelID)
		argIdx++
	}
	if errorMessage != "" {
		sets = append(sets, fmt.Sprintf("error_message = $%d", argIdx))
		args = append(args, errorMessage)
		argIdx++
	}
	if IsTerminalManagedRunStatus(status) {
		sets = append(sets, fmt.Sprintf("finished_at = $%d", argIdx))
		args = append(args, now)
		argIdx++
	}
	args = append(args, run.ID)
	_, err := s.db.ExecContext(ctx, fmt.Sprintf("UPDATE ai_runs SET %s WHERE id = $%d", strings.Join(sets, ", "), argIdx), args...)
	return err
}

func NormalizeManagedRunStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "completed", "complete", "done", "success", "succeeded":
		return "succeeded"
	case "failed", "error", "cancelled", "canceled":
		return "failed"
	case "timeout", "timed_out":
		return "timeout"
	case "running", "in_progress", "processing":
		return "running"
	default:
		return "pending"
	}
}

func IsTerminalManagedRunStatus(status string) bool {
	return status == "succeeded" || status == "failed" || status == "timeout"
}

func nullableManagedInt(value int) any {
	if value == 0 {
		return nil
	}
	return value
}
