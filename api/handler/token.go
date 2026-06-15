package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/aidashboard/api/model"
)

type TokenHandler struct {
	db *sql.DB
}

func NewTokenHandler(db *sql.DB) *TokenHandler {
	return &TokenHandler{db: db}
}

// Aggregate returns:
//   - total/input/output sums within the period
//   - groups: breakdown by group_by dimension (team|user|requirement|task|model)
//   - series: daily totals within the period
//
// Query: GET /tokens?period=today|week|month|range&from=&to=&group_by=
func (h *TokenHandler) Aggregate(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "week"
	}
	groupBy := r.URL.Query().Get("group_by")
	if groupBy == "" {
		groupBy = "model"
	}

	startDate, endDate, err := resolvePeriod(period, r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	// Build base WHERE with role scoping + period
	scope, args, argIdx := buildTokenScope(u)
	args = append(args, startDate)
	startIdx := argIdx
	argIdx++
	args = append(args, endDate)
	endIdx := argIdx
	argIdx++

	where := "WHERE tu.recorded_at >= $" + strconv.Itoa(startIdx) + " AND tu.recorded_at < ($" + strconv.Itoa(endIdx) + " + INTERVAL '1 day')"
	if scope != "" {
		where += " AND " + scope
	}

	// Totals
	var total, inputSum, outputSum int64
	err = h.db.QueryRow(`
		SELECT COALESCE(SUM(tu.total_tokens),0), COALESCE(SUM(tu.input_tokens),0), COALESCE(SUM(tu.output_tokens),0)
		FROM token_usage tu
		`+where, args...).Scan(&total, &inputSum, &outputSum)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Groups
	groups, err := h.queryGroups(where, args, groupBy, total)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Series (daily)
	series, err := h.querySeries(where, args)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, model.TokenAggregation{
		Total:     total,
		InputSum:  inputSum,
		OutputSum: outputSum,
		Groups:    groups,
		Series:    series,
		Period:    period,
		GroupBy:   groupBy,
	})
}

// buildTokenScope returns the role-scoped WHERE fragment for the current user.
// team_leader / pm see their team; employee sees only themselves; director sees everything.
func buildTokenScope(u *model.User) (string, []any, int) {
	switch u.Role {
	case "employee":
		return "tu.user_id = $1", []any{u.ID}, 2
	case "team_leader", "pm":
		if u.TeamID == nil {
			return "tu.user_id = $1", []any{u.ID}, 2
		}
		return "tu.user_id IN (SELECT id FROM users WHERE team_id = $1)", []any{*u.TeamID}, 2
	default:
		// director: no scope, but we still need a placeholder arg index
		return "", []any{}, 1
	}
}

func (h *TokenHandler) queryGroups(where string, args []any, groupBy string, total int64) ([]model.TokenGroup, error) {
	var groupExpr, labelExpr, extraJoins string
	switch groupBy {
	case "team":
		extraJoins = "LEFT JOIN users u ON u.id = tu.user_id LEFT JOIN teams tm ON tm.id = u.team_id"
		groupExpr = "COALESCE(tm.id, 'none')"
		labelExpr = "COALESCE(tm.name, '未分配团队')"
	case "user":
		extraJoins = "LEFT JOIN users u ON u.id = tu.user_id"
		groupExpr = "tu.user_id"
		labelExpr = "COALESCE(u.name, '未知')"
	case "requirement":
		extraJoins = "LEFT JOIN requirements r ON r.id = tu.requirement_id"
		groupExpr = "COALESCE(tu.requirement_id, 'none')"
		labelExpr = "COALESCE(r.title, '未关联需求')"
	case "task":
		extraJoins = "LEFT JOIN tasks t ON t.id = tu.task_id"
		groupExpr = "COALESCE(tu.task_id, 'none')"
		labelExpr = "COALESCE(t.title, '未关联任务')"
	case "model":
		fallthrough
	default:
		groupBy = "model"
		groupExpr = "tu.model"
		labelExpr = "COALESCE(NULLIF(tu.model, ''), 'unknown')"
	}

	q := fmt.Sprintf(`
		SELECT %s as key, %s as label, COALESCE(SUM(tu.total_tokens),0) as value
		FROM token_usage tu
		%s
		%s
		GROUP BY %s, %s
		ORDER BY value DESC`, groupExpr, labelExpr, extraJoins, where, groupExpr, labelExpr)

	rows, err := h.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groups := []model.TokenGroup{}
	for rows.Next() {
		var g model.TokenGroup
		if err := rows.Scan(&g.Key, &g.Label, &g.Value); err != nil {
			return nil, err
		}
		if total > 0 {
			g.Percent = float64(g.Value) * 100.0 / float64(total)
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

func (h *TokenHandler) querySeries(where string, args []any) ([]model.TokenPoint, error) {
	q := fmt.Sprintf(`
		SELECT DATE(tu.recorded_at) as d, COALESCE(SUM(tu.total_tokens),0) as v
		FROM token_usage tu
		%s
		GROUP BY d
		ORDER BY d`, where)

	rows, err := h.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pts := []model.TokenPoint{}
	for rows.Next() {
		var d time.Time
		var v int64
		if err := rows.Scan(&d, &v); err != nil {
			return nil, err
		}
		pts = append(pts, model.TokenPoint{Date: d.Format("2006-01-02"), Value: v})
	}
	return pts, rows.Err()
}

func resolvePeriod(period, from, to string) (string, string, error) {
	today := time.Now().Format("2006-01-02")
	switch period {
	case "today":
		return today, today, nil
	case "week":
		// Week starts Monday in date_trunc('week')
		start := time.Now().AddDate(0, 0, -int(time.Now().Weekday())+1)
		if time.Now().Weekday() == time.Sunday {
			start = time.Now().AddDate(0, 0, -6)
		}
		return start.Format("2006-01-02"), today, nil
	case "month":
		return time.Now().AddDate(0, 0, -time.Now().Day()+1).Format("2006-01-02"), today, nil
	case "range":
		if from == "" || to == "" {
			return "", "", fmt.Errorf("range period requires from and to")
		}
		return from, to, nil
	default:
		return "", "", fmt.Errorf("invalid period: %s", period)
	}
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
