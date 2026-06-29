package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/aidashboard/api/model"
)

const ScheduledAgentRunBusinessType = "scheduled_agent_run"

type ManagedAgentScheduleRunner struct {
	db       *sql.DB
	client   *ManagedAgentClient
	interval time.Duration
}

func NewManagedAgentScheduleRunner(db *sql.DB, client *ManagedAgentClient) *ManagedAgentScheduleRunner {
	return &ManagedAgentScheduleRunner{
		db:       db,
		client:   client,
		interval: time.Minute,
	}
}

func (r *ManagedAgentScheduleRunner) Start(ctx context.Context) {
	if r == nil || r.db == nil || r.client == nil || !r.client.Configured() {
		return
	}
	go func() {
		ticker := time.NewTicker(r.interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				if err := r.RunDue(ctx, now); err != nil {
					log.Printf("managed agent schedule runner failed: %v", err)
				}
			}
		}
	}()
}

func (r *ManagedAgentScheduleRunner) RunDue(ctx context.Context, now time.Time) error {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id::text, user_id::text, name, agent_id, model_id, message,
			params_json, schedule_type, weekdays_json, time_of_day, timezone,
			enabled, last_run_at, last_ai_run_id::text, created_at, updated_at
		FROM managed_agent_schedules
		WHERE enabled = true
		ORDER BY created_at`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		schedule, err := scanManagedAgentSchedule(rows)
		if err != nil {
			return err
		}
		if !IsManagedAgentScheduleDue(schedule, now) {
			continue
		}
		if err := r.runSchedule(ctx, schedule, now); err != nil {
			log.Printf("managed agent schedule %s run failed: %v", schedule.ID, err)
		}
	}
	return rows.Err()
}

func (r *ManagedAgentScheduleRunner) runSchedule(ctx context.Context, schedule model.ManagedAgentSchedule, now time.Time) error {
	params := map[string]string{}
	for key, value := range schedule.Params {
		params[key] = value
	}
	params["message"] = schedule.Message
	params["trigger_source"] = "schedule"
	params["schedule_id"] = schedule.ID

	modelID := ""
	if schedule.ModelID != nil {
		modelID = *schedule.ModelID
	}

	submitResp, submitErr := r.client.SubmitTask(ctx, SubmitManagedTaskRequest{
		AgentID: schedule.AgentID,
		ModelID: modelID,
		Params:  params,
	})

	inputRef := map[string]any{
		"schedule_id":    schedule.ID,
		"schedule_name":  schedule.Name,
		"message":        schedule.Message,
		"params":         schedule.Params,
		"trigger_source": "schedule",
	}

	var runID string
	if submitErr != nil {
		var err error
		runID, err = insertManagedAgentRun(ctx, r.db, schedule.UserID, ScheduledAgentRunBusinessType, schedule.AgentID, nil, modelID, inputRef, "failed", submitErr.Error())
		if err != nil {
			return err
		}
	} else {
		var err error
		runID, err = insertManagedAgentRun(ctx, r.db, schedule.UserID, ScheduledAgentRunBusinessType, schedule.AgentID, submitResp, modelID, inputRef, NormalizeManagedRunStatus(submitResp.Status), "")
		if err != nil {
			return err
		}
	}

	_, err := r.db.ExecContext(ctx, `
		UPDATE managed_agent_schedules
		SET last_run_at = $1, last_ai_run_id = $2, updated_at = now()
		WHERE id = $3`, now, runID, schedule.ID)
	if submitErr != nil {
		return submitErr
	}
	return err
}

func IsManagedAgentScheduleDue(schedule model.ManagedAgentSchedule, now time.Time) bool {
	if !schedule.Enabled {
		return false
	}
	hour, minute, ok := parseTimeOfDay(schedule.TimeOfDay)
	if !ok {
		return false
	}
	loc := time.Local
	if schedule.Timezone != "" {
		if loaded, err := time.LoadLocation(schedule.Timezone); err == nil {
			loc = loaded
		}
	}

	localNow := now.In(loc)
	scheduledAt := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), hour, minute, 0, 0, loc)
	if localNow.Before(scheduledAt) {
		return false
	}
	if schedule.LastRunAt != nil {
		last := schedule.LastRunAt.In(loc)
		if last.Year() == localNow.Year() && last.YearDay() == localNow.YearDay() {
			return false
		}
	}

	switch schedule.ScheduleType {
	case "daily":
		return true
	case "weekly":
		today := int(localNow.Weekday())
		if today == 0 {
			today = 7
		}
		for _, weekday := range schedule.Weekdays {
			if weekday == today {
				return true
			}
		}
	}
	return false
}

func parseTimeOfDay(value string) (hour int, minute int, ok bool) {
	parsed, err := time.Parse("15:04", strings.TrimSpace(value))
	if err != nil {
		return 0, 0, false
	}
	return parsed.Hour(), parsed.Minute(), true
}

func scanManagedAgentSchedule(row interface{ Scan(dest ...any) error }) (model.ManagedAgentSchedule, error) {
	var schedule model.ManagedAgentSchedule
	var modelID, lastRunID sql.NullString
	var paramsRaw, weekdaysRaw []byte
	var lastRunAt sql.NullTime
	if err := row.Scan(
		&schedule.ID, &schedule.UserID, &schedule.Name, &schedule.AgentID, &modelID,
		&schedule.Message, &paramsRaw, &schedule.ScheduleType, &weekdaysRaw,
		&schedule.TimeOfDay, &schedule.Timezone, &schedule.Enabled, &lastRunAt,
		&lastRunID, &schedule.CreatedAt, &schedule.UpdatedAt,
	); err != nil {
		return schedule, err
	}
	if modelID.Valid {
		schedule.ModelID = &modelID.String
	}
	if lastRunAt.Valid {
		schedule.LastRunAt = &lastRunAt.Time
	}
	if lastRunID.Valid {
		schedule.LastAIRunID = &lastRunID.String
	}
	_ = json.Unmarshal(paramsRaw, &schedule.Params)
	_ = json.Unmarshal(weekdaysRaw, &schedule.Weekdays)
	if schedule.Params == nil {
		schedule.Params = map[string]string{}
	}
	return schedule, nil
}

func insertManagedAgentRun(
	ctx context.Context,
	db *sql.DB,
	userID string,
	businessType string,
	agentID string,
	submit *SubmitManagedTaskResponse,
	modelID string,
	inputRef map[string]any,
	status string,
	errorMessage string,
) (string, error) {
	inputJSON, _ := json.Marshal(inputRef)
	externalTaskID := any(nil)
	if submit != nil && submit.TaskID != "" {
		externalTaskID = submit.TaskID
	}
	var errValue any
	if errorMessage != "" {
		errValue = errorMessage
	}
	var runID string
	err := db.QueryRowContext(ctx, `
		INSERT INTO ai_runs (
			user_id, business_type, runtime_type, agent_id, external_task_id,
			model_id, status, input_ref_json, error_message, started_at, finished_at
		)
		VALUES ($1, $2, 'managed_task', $3, $4, $5, $6, $7, $8, now(),
			CASE WHEN $6 IN ('succeeded', 'failed', 'timeout') THEN now() ELSE NULL END)
		RETURNING id::text`,
		userID, businessType, agentID, externalTaskID, nullableScheduledString(modelID), status, inputJSON, errValue,
	).Scan(&runID)
	return runID, err
}

func nullableScheduledString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
