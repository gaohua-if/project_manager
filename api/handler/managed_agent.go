package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/go-chi/chi/v5"
)

type ManagedAgentHandler struct {
	db       *sql.DB
	client   *service.ManagedAgentClient
	defaults ManagedAgentDefaults
}

const (
	personalDailyReportType       = "personal_daily"
	defaultPersonalDailyAgentName = "日报"
	defaultReportAgentMarker      = "AIDA_REPORT_AGENT:personal_daily"
	defaultManagedAgentMarker     = "AIDA_MANAGED_DEFAULT_AGENT:true"
	reportMCPCredentialSlot       = "AIDA_REPORT_MCP_AUTH"
	managedAgentConfigInvalidCode = "MANAGED_AGENT_CONFIG_INVALID"
)

type ManagedAgentDefaults struct {
	Engine            string
	ModelID           string
	ReportMCPSlug     string
	ReportMCPVersion  string
	AIDAPublicBaseURL string
}

func NewManagedAgentHandler(db *sql.DB, client *service.ManagedAgentClient) *ManagedAgentHandler {
	return NewManagedAgentHandlerWithDefaults(db, client, ManagedAgentDefaults{})
}

func NewManagedAgentHandlerWithDefaults(db *sql.DB, client *service.ManagedAgentClient, defaults ManagedAgentDefaults) *ManagedAgentHandler {
	return &ManagedAgentHandler{db: db, client: client, defaults: normalizeManagedAgentDefaults(defaults)}
}

func normalizeManagedAgentDefaults(defaults ManagedAgentDefaults) ManagedAgentDefaults {
	defaults.Engine = strings.TrimSpace(defaults.Engine)
	if defaults.Engine == "" {
		defaults.Engine = "claude-code"
	}
	defaults.ModelID = strings.TrimSpace(defaults.ModelID)
	if defaults.ModelID == "" {
		defaults.ModelID = "MiniMax-M2.5"
	}
	defaults.ReportMCPSlug = strings.TrimSpace(defaults.ReportMCPSlug)
	if defaults.ReportMCPSlug == "" {
		defaults.ReportMCPSlug = "aida-report-mcp-p0"
	}
	defaults.ReportMCPVersion = strings.TrimSpace(defaults.ReportMCPVersion)
	if defaults.ReportMCPVersion == "" {
		defaults.ReportMCPVersion = "personal-daily-v1"
	}
	defaults.AIDAPublicBaseURL = strings.TrimRight(strings.TrimSpace(defaults.AIDAPublicBaseURL), "/")
	return defaults
}

func (h *ManagedAgentHandler) clientForRequest(r *http.Request) *service.ManagedAgentClient {
	if h.client == nil {
		return nil
	}
	return h.client.WithToken(bearerTokenFromRequest(r))
}

func bearerTokenFromRequest(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		return ""
	}
	return strings.TrimSpace(token)
}

func generateManagedAgentID(name string) string {
	base := strings.Builder{}
	lastDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			base.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash && base.Len() > 0 {
			base.WriteByte('-')
			lastDash = true
		}
	}
	baseString := strings.Trim(base.String(), "-")
	if baseString == "" {
		baseString = "agent"
	}
	return "aida-" + baseString + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func (h *ManagedAgentHandler) ensureConfigured(w http.ResponseWriter) bool {
	if h.client == nil || !h.client.Configured() {
		writeManagedAgentError(w, &service.ManagedAgentError{
			Code:    service.ManagedAgentNotConfiguredCode,
			Message: "managed agent platform is not configured",
		})
		return false
	}
	return true
}

func writeManagedAgentError(w http.ResponseWriter, err error) {
	var managedErr *service.ManagedAgentError
	if errors.As(err, &managedErr) {
		status := http.StatusBadGateway
		if managedErr.Code == service.ManagedAgentNotConfiguredCode || managedErr.Code == managedAgentConfigInvalidCode {
			status = http.StatusServiceUnavailable
		}
		writeJSON(w, status, map[string]any{
			"code":  managedErr.Code,
			"error": managedErr.Message,
		})
		return
	}
	writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
}

func writeManagedAgentConfigError(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{
		"code":  managedAgentConfigInvalidCode,
		"error": message,
	})
}

// proxyJSON runs the ensureConfigured + call + standard error/writeJSON sequence
// shared by every pass-through managed-agent endpoint.
func (h *ManagedAgentHandler) proxyJSON(w http.ResponseWriter, call func() (any, error)) {
	if !h.ensureConfigured(w) {
		return
	}
	resp, err := call()
	if err != nil {
		writeManagedAgentError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *ManagedAgentHandler) ListSkills(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	client := h.clientForRequest(r)
	h.proxyJSON(w, func() (any, error) { return client.ListSkills(r.Context(), scope) })
}

func (h *ManagedAgentHandler) ListMCPEntries(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	client := h.clientForRequest(r)
	h.proxyJSON(w, func() (any, error) { return client.ListMCPEntries(r.Context(), scope) })
}

func (h *ManagedAgentHandler) CreateMCPEntry(w http.ResponseWriter, r *http.Request) {
	var req model.CreateManagedMCPEntryRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if strings.TrimSpace(req.Slug) == "" || strings.TrimSpace(req.Version) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slug and version are required"})
		return
	}
	client := h.clientForRequest(r)
	h.proxyJSON(w, func() (any, error) { return client.CreateMCPEntry(r.Context(), req) })
}

func (h *ManagedAgentHandler) ListMyAgents(w http.ResponseWriter, r *http.Request) {
	client := h.clientForRequest(r)
	h.proxyJSON(w, func() (any, error) {
		resp, err := client.ListMyAgents(r.Context())
		if err != nil {
			return nil, err
		}
		if resp.Agents == nil {
			resp.Agents = []model.ManagedAgent{}
		}
		return resp, nil
	})
}

func (h *ManagedAgentHandler) CreateMyAgent(w http.ResponseWriter, r *http.Request) {
	var req model.UpsertManagedAgentRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Engine) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and engine are required"})
		return
	}
	if strings.TrimSpace(req.AgentID) == "" {
		req.AgentID = generateManagedAgentID(req.Name)
	}
	client := h.clientForRequest(r)
	h.proxyJSON(w, func() (any, error) { return client.CreateMyAgent(r.Context(), req) })
}

func (h *ManagedAgentHandler) UpdateMyAgent(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agentId")
	var req model.UpsertManagedAgentRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	client := h.clientForRequest(r)
	h.proxyJSON(w, func() (any, error) { return client.UpdateMyAgent(r.Context(), agentID, req) })
}

func (h *ManagedAgentHandler) ensureReportMCPEntry(r *http.Request, client *service.ManagedAgentClient) error {
	expectedURL := h.reportMCPURL()
	resp, err := client.ListMCPEntries(r.Context(), string(model.ManagedScopeMine))
	if err != nil {
		return err
	}
	for _, entry := range resp.Entries {
		if entry.Slug != h.defaults.ReportMCPSlug || entry.Version != h.defaults.ReportMCPVersion {
			continue
		}
		if entry.URL != "" && strings.TrimRight(entry.URL, "/") != expectedURL {
			return &service.ManagedAgentError{
				Code:    managedAgentConfigInvalidCode,
				Message: fmt.Sprintf("Report MCP entry %s@%s already exists with different url", h.defaults.ReportMCPSlug, h.defaults.ReportMCPVersion),
			}
		}
		return nil
	}
	_, err = client.CreateMCPEntry(r.Context(), model.CreateManagedMCPEntryRequest{
		Slug:               h.defaults.ReportMCPSlug,
		Version:            h.defaults.ReportMCPVersion,
		Name:               "Aida Report MCP",
		Description:        "Aida personal_daily Report MCP endpoint.",
		Transport:          "http",
		URL:                expectedURL,
		AuthHeader:         "Authorization",
		AuthScheme:         "Bearer",
		RequiresCredential: true,
	})
	return err
}

func (h *ManagedAgentHandler) ensureDefaultPersonalDailyAgent(r *http.Request, client *service.ManagedAgentClient) (string, error) {
	resp, err := client.ListMyAgents(r.Context())
	if err != nil {
		return "", err
	}
	agents := resp.Agents
	if agents == nil {
		agents = []model.ManagedAgent{}
	}
	selected, found := h.selectDefaultPersonalDailyAgent(agents)
	if !found {
		req := h.defaultPersonalDailyAgentRequest()
		req.AgentID = generateManagedAgentID(defaultPersonalDailyAgentName)
		created, err := client.CreateMyAgent(r.Context(), req)
		if err != nil {
			return "", err
		}
		return created.AgentID, nil
	}
	patch, needsRepair := h.repairedPersonalDailyAgentRequest(selected)
	if needsRepair {
		if _, err := client.UpdateMyAgent(r.Context(), selected.AgentID, patch); err != nil {
			return "", err
		}
	}
	return selected.AgentID, nil
}

func (h *ManagedAgentHandler) reportMCPURL() string {
	return h.defaults.AIDAPublicBaseURL + "/api/v1/mcp/reports"
}

func (h *ManagedAgentHandler) defaultReportMCPBinding() model.ManagedMCPBinding {
	return model.ManagedMCPBinding{
		Slug:           h.defaults.ReportMCPSlug,
		Version:        h.defaults.ReportMCPVersion,
		CredentialSlot: reportMCPCredentialSlot,
	}
}

func (h *ManagedAgentHandler) defaultPersonalDailyAgentRequest() model.UpsertManagedAgentRequest {
	description := strings.Join([]string{
		"默认个人日报 Agent。",
		defaultReportAgentMarker,
		defaultManagedAgentMarker,
	}, "\n")
	return model.UpsertManagedAgentRequest{
		Name:                defaultPersonalDailyAgentName,
		Description:         description,
		Engine:              h.defaults.Engine,
		DefaultModelID:      h.defaults.ModelID,
		Instructions:        defaultPersonalDailyInstructions(),
		StartPromptTemplate: defaultPersonalDailyStartPromptTemplate(),
		CredentialSlots: []model.ManagedCredentialSlot{{
			Name:     reportMCPCredentialSlot,
			Required: true,
		}},
		MCPBindings: []model.ManagedMCPBinding{h.defaultReportMCPBinding()},
	}
}

func defaultPersonalDailyInstructions() string {
	return strings.Join([]string{
		defaultReportAgentMarker,
		defaultManagedAgentMarker,
		"你是 Aida 个人日报生成 Agent，只处理 report_type=personal_daily。",
		"运行参数会包含 run_id、report_type、period.date、mcp_url、mcp_authorization。",
		"Aida Report MCP 已通过当前用户凭据槽配置 Authorization；调用 MCP 时不要再手工拼接管理员 token。",
		"必须使用当前用户身份调用 Aida Report MCP，不要要求用户提供 session_ids 或来源列表。",
		"按以下顺序调用 Aida Report MCP 原子工具：先 get_existing_report 获取已有内容，再 get_sessions + get_tasks + get_requirements 拉取当日上下文，基于上下文生成中文个人日报。",
		"生成成功后调用 write_report_result，传入相同 run_id、report_type、period.date 和 content。",
		"生成失败时调用 write_report_failure。不要处理 weekly、team、department。",
		"不要编造 Aida 上下文之外的事实；如果上下文为空，应明确说明暂无记录。",
	}, "\n")
}

func defaultPersonalDailyStartPromptTemplate() string {
	return strings.Join([]string{
		"请生成 {{ report_date }} 的个人日报。",
		"report_type={{ report_type }}",
		"period.date={{ report_date }}",
		"run_id={{ run_id }}",
		"mcp_url={{ mcp_url }}",
		"mcp_authorization 由平台凭据槽注入到 MCP Authorization header，不会出现在 prompt 中。",
		"必须先通过 Aida Report MCP 获取上下文，再回写生成结果。",
	}, "\n")
}

func (h *ManagedAgentHandler) selectDefaultPersonalDailyAgent(agents []model.ManagedAgent) (model.ManagedAgent, bool) {
	var marked []model.ManagedAgent
	var namedWithMCP []model.ManagedAgent
	for _, agent := range agents {
		if agent.Archived {
			continue
		}
		if isMarkedDefaultPersonalDailyAgent(agent) {
			marked = append(marked, agent)
			continue
		}
		if strings.TrimSpace(agent.Name) == defaultPersonalDailyAgentName && h.hasReportMCPBinding(agent.MCPBindings) {
			namedWithMCP = append(namedWithMCP, agent)
		}
	}
	if len(marked) > 0 {
		return bestPersonalDailyAgent(marked, h), true
	}
	if len(namedWithMCP) > 0 {
		return bestPersonalDailyAgent(namedWithMCP, h), true
	}
	return model.ManagedAgent{}, false
}

func bestPersonalDailyAgent(agents []model.ManagedAgent, h *ManagedAgentHandler) model.ManagedAgent {
	best := agents[0]
	bestScore := h.personalDailyAgentScore(best)
	for _, agent := range agents[1:] {
		score := h.personalDailyAgentScore(agent)
		if score > bestScore || score == bestScore && agent.CreatedAt > best.CreatedAt {
			best = agent
			bestScore = score
		}
	}
	return best
}

func (h *ManagedAgentHandler) personalDailyAgentScore(agent model.ManagedAgent) int {
	score := 0
	if isMarkedDefaultPersonalDailyAgent(agent) {
		score += 100
	}
	if strings.TrimSpace(agent.DefaultModelID) != "" {
		score += 10
	}
	if h.hasReportMCPBinding(agent.MCPBindings) {
		score += 10
	}
	if strings.TrimSpace(agent.Instructions) != "" {
		score += 5
	}
	if strings.TrimSpace(agent.StartPromptTemplate) != "" {
		score += 5
	}
	return score
}

func isMarkedDefaultPersonalDailyAgent(agent model.ManagedAgent) bool {
	text := strings.Join([]string{agent.Description, agent.Instructions}, "\n")
	return strings.Contains(text, defaultReportAgentMarker) && strings.Contains(text, defaultManagedAgentMarker)
}

func (h *ManagedAgentHandler) repairedPersonalDailyAgentRequest(agent model.ManagedAgent) (model.UpsertManagedAgentRequest, bool) {
	req := model.UpsertManagedAgentRequest{
		AgentID:             agent.AgentID,
		Name:                agent.Name,
		Description:         agent.Description,
		Engine:              agent.Engine,
		Instructions:        agent.Instructions,
		DefaultModelID:      agent.DefaultModelID,
		StartPromptTemplate: agent.StartPromptTemplate,
		CredentialSlots:     agent.CredentialSlots,
		DefaultBindings:     agent.DefaultBindings,
		Skills:              agent.Skills,
		MCPBindings:         agent.MCPBindings,
	}
	changed := false
	if strings.TrimSpace(req.Name) == "" {
		req.Name = defaultPersonalDailyAgentName
		changed = true
	}
	if strings.TrimSpace(req.Description) == "" {
		req.Description = strings.Join([]string{"默认个人日报 Agent。", defaultReportAgentMarker, defaultManagedAgentMarker}, "\n")
		changed = true
	} else {
		if !strings.Contains(req.Description, defaultReportAgentMarker) {
			req.Description += "\n" + defaultReportAgentMarker
			changed = true
		}
		if !strings.Contains(req.Description, defaultManagedAgentMarker) {
			req.Description += "\n" + defaultManagedAgentMarker
			changed = true
		}
	}
	if strings.TrimSpace(req.Engine) == "" {
		req.Engine = h.defaults.Engine
		changed = true
	} else if isMarkedDefaultPersonalDailyAgent(agent) && strings.TrimSpace(agent.Instructions) == defaultPersonalDailyInstructions() && req.Engine != h.defaults.Engine {
		req.Engine = h.defaults.Engine
		changed = true
	}
	if strings.TrimSpace(req.DefaultModelID) == "" {
		req.DefaultModelID = h.defaults.ModelID
		changed = true
	}
	if !hasCredentialSlot(req.CredentialSlots, reportMCPCredentialSlot) {
		req.CredentialSlots = append(req.CredentialSlots, model.ManagedCredentialSlot{
			Name:     reportMCPCredentialSlot,
			Required: true,
		})
		changed = true
	}
	if !h.hasReportMCPBinding(req.MCPBindings) {
		req.MCPBindings = append(req.MCPBindings, h.defaultReportMCPBinding())
		changed = true
	} else if ensureReportMCPBindingCredentialSlot(req.MCPBindings, h.defaults.ReportMCPSlug, h.defaults.ReportMCPVersion, reportMCPCredentialSlot) {
		changed = true
	}
	instructions := strings.TrimSpace(req.Instructions)
	if instructions == "" || containsDefaultMarkers(instructions) && isDefaultLikeInstructions(instructions) {
		defaultInstructions := defaultPersonalDailyInstructions()
		if req.Instructions != defaultInstructions {
			req.Instructions = defaultInstructions
			changed = true
		}
	}
	if strings.TrimSpace(req.StartPromptTemplate) == "" {
		req.StartPromptTemplate = defaultPersonalDailyStartPromptTemplate()
		changed = true
	}
	return req, changed
}

func hasCredentialSlot(slots []model.ManagedCredentialSlot, name string) bool {
	for _, slot := range slots {
		if slot.Name == name {
			return true
		}
	}
	return false
}

func ensureReportMCPBindingCredentialSlot(bindings []model.ManagedMCPBinding, slug, version, slot string) bool {
	changed := false
	for i := range bindings {
		if bindings[i].Slug == slug && bindings[i].Version == version && bindings[i].CredentialSlot == "" {
			bindings[i].CredentialSlot = slot
			changed = true
		}
	}
	return changed
}

func containsDefaultMarkers(text string) bool {
	return strings.Contains(text, defaultReportAgentMarker) && strings.Contains(text, defaultManagedAgentMarker)
}

func isDefaultLikeInstructions(text string) bool {
	return strings.Contains(text, "personal_daily") && strings.Contains(text, "write_report_result")
}

func (h *ManagedAgentHandler) hasReportMCPBinding(bindings []model.ManagedMCPBinding) bool {
	for _, binding := range bindings {
		if binding.Slug == h.defaults.ReportMCPSlug && binding.Version == h.defaults.ReportMCPVersion {
			return true
		}
	}
	return false
}

func (h *ManagedAgentHandler) StartAgentRun(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	agentID := chi.URLParam(r, "agentId")
	var req model.ManagedAgentManualRunRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if agentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id is required"})
		return
	}
	req.ModelID = strings.TrimSpace(req.ModelID)

	params := map[string]string{}
	for key, value := range req.Params {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		params[key] = strings.TrimSpace(value)
	}
	if req.Message != "" {
		params["message"] = req.Message
	}
	if len(params) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message or params is required"})
		return
	}

	if isPersonalDailyReportRun(params) {
		h.startPersonalDailyAgentRunWithAgent(w, r, u, agentID, req.Message, req.ModelID, params)
		return
	}

	client := h.clientForRequest(r)
	submitResp, err := client.SubmitTask(r.Context(), service.SubmitManagedTaskRequest{
		AgentID: agentID,
		ModelID: req.ModelID,
		Params:  params,
	})
	if err != nil {
		writeManagedAgentError(w, err)
		return
	}

	inputRef := map[string]any{
		"message":        req.Message,
		"params":         req.Params,
		"trigger_source": "manual",
	}
	runID, err := h.insertAIRun(u.ID, "manual_agent_run", agentID, submitResp, req.ModelID, inputRef)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	run, err := h.loadAIRun(runID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) startPersonalDailyAgentRunWithAgent(w http.ResponseWriter, r *http.Request, u *model.User, agentID, message, modelID string, params map[string]string) {
	periodDate := strings.TrimSpace(params["period.date"])
	if periodDate == "" {
		periodDate = strings.TrimSpace(params["report_date"])
	}
	if periodDate == "" {
		periodDate = strings.TrimSpace(params["date"])
	}
	if periodDate == "" {
		periodDate = service.TodayInLocalDate()
	}
	params["report_type"] = "personal_daily"
	params["period.date"] = periodDate
	params["report_date"] = periodDate
	if strings.TrimSpace(params["mcp_url"]) == "" {
		params["mcp_url"] = agentCallbackURL(r, "/api/v1/mcp/reports")
	}
	if strings.TrimSpace(params["aida_report_mcp_url"]) == "" {
		params["aida_report_mcp_url"] = params["mcp_url"]
	}
	if token := bearerTokenFromRequest(r); token != "" {
		params["mcp_authorization"] = "Bearer " + token
	}

	inputRef := map[string]any{
		"message":        message,
		"params":         copyStringMapForInputRef(params),
		"trigger_source": "manual",
		"report_type":    "personal_daily",
		"period": map[string]string{
			"date": periodDate,
		},
	}
	runID, err := h.insertPendingAIRun(u.ID, "manual_agent_run", agentID, modelID, inputRef)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	params["run_id"] = runID
	inputRef["params"] = copyStringMapForInputRef(params)

	client := h.clientForRequest(r)
	submitResp, err := client.SubmitTask(r.Context(), service.SubmitManagedTaskRequest{
		AgentID: agentID,
		ModelID: modelID,
		Params:  params,
	})
	if err != nil {
		_ = h.markAIRunSubmitFailed(r, runID, u.ID, err.Error())
		writeManagedAgentError(w, err)
		return
	}
	if modelID == "" && submitResp.ModelID != "" {
		modelID = submitResp.ModelID
	}
	if err := h.attachSubmittedAIRun(runID, u.ID, submitResp, modelID, inputRef); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	run, err := h.loadAIRun(runID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) GetAgentRun(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	runID := chi.URLParam(r, "runId")
	run, err := h.loadAIRun(runID, u.ID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if run.ExternalTaskID != nil && (!isTerminalManagedStatus(run.Status) || (run.Status == "succeeded" && run.Result == "")) {
		refreshed, err := h.refreshAIRun(r, run)
		if err != nil {
			msg := err.Error()
			run.ErrorMessage = &msg
			writeJSON(w, http.StatusOK, run)
			return
		}
		run = refreshed
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) ListAgentRuns(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	agentID := strings.TrimSpace(r.URL.Query().Get("agent_id"))
	businessType := strings.TrimSpace(r.URL.Query().Get("business_type"))
	_, limit := parsePagination(r, 50, 100)

	query := aiRunSelectColumns + " WHERE user_id = $1"
	args := []any{u.ID}
	argIdx := 2
	if agentID != "" {
		query += fmt.Sprintf(" AND agent_id = $%d", argIdx)
		args = append(args, agentID)
		argIdx++
	}
	if businessType != "" {
		query += fmt.Sprintf(" AND business_type = $%d", argIdx)
		args = append(args, businessType)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIdx)
	args = append(args, limit)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	runs := []model.AIRun{}
	for rows.Next() {
		run, err := scanAIRun(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		runs = append(runs, *run)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"runs": runs})
}

func (h *ManagedAgentHandler) DailyReportIntegration(w http.ResponseWriter, r *http.Request) {
	mcpURL := absoluteRequestURL(r, "/api/v1/mcp/reports")
	writeJSON(w, http.StatusOK, map[string]any{
		"mcp": map[string]any{
			"name":        "Aida Report MCP",
			"url":         mcpURL,
			"transport":   "http",
			"description": "Provides 9 atomic tools for reading sessions/tasks/requirements and writing 6-class reports.",
			"tools": []string{
				"get_sessions",
				"get_daily_reports",
				"get_weekly_reports",
				"get_tasks",
				"get_requirements",
				"get_existing_report",
				"get_report_inventory",
				"write_report_result",
				"write_report_failure",
			},
		},
		"skill": map[string]string{
			"slug":     service.DailyReportSkillSlug,
			"version":  service.DailyReportSkillVersion,
			"name":     service.DailyReportSkillName,
			"skill_md": service.DailyReportSkillMarkdown(mcpURL),
		},
	})
}

func (h *ManagedAgentHandler) ListAgentSchedules(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	rows, err := h.db.Query(managedAgentScheduleSelectColumns+" WHERE user_id = $1 ORDER BY created_at DESC", u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := []model.ManagedAgentSchedule{}
	for rows.Next() {
		item, err := scanManagedAgentSchedule(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"schedules": items})
}

func (h *ManagedAgentHandler) CreateAgentSchedule(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	var req model.UpsertManagedAgentScheduleRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	normalized, err := normalizeManagedAgentScheduleRequest(req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	paramsJSON, _ := json.Marshal(normalized.Params)
	weekdaysJSON, _ := json.Marshal(normalized.Weekdays)

	var id string
	err = h.db.QueryRow(`
		INSERT INTO managed_agent_schedules (
			user_id, name, agent_id, model_id, message, params_json,
			schedule_type, weekdays_json, time_of_day, timezone, enabled
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id::text`,
		u.ID, normalized.Name, normalized.AgentID, nullString(&normalized.ModelID),
		normalized.Message, paramsJSON, normalized.ScheduleType, weekdaysJSON,
		normalized.TimeOfDay, normalized.Timezone, normalized.Enabled,
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	schedule, err := h.loadManagedAgentSchedule(id, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, schedule)
}

func (h *ManagedAgentHandler) UpdateAgentSchedule(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	scheduleID := chi.URLParam(r, "scheduleId")
	var req model.UpsertManagedAgentScheduleRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	normalized, err := normalizeManagedAgentScheduleRequest(req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	paramsJSON, _ := json.Marshal(normalized.Params)
	weekdaysJSON, _ := json.Marshal(normalized.Weekdays)

	res, err := h.db.Exec(`
		UPDATE managed_agent_schedules
		SET name = $1, agent_id = $2, model_id = $3, message = $4,
			params_json = $5, schedule_type = $6, weekdays_json = $7,
			time_of_day = $8, timezone = $9, enabled = $10, updated_at = now()
		WHERE id = $11 AND user_id = $12`,
		normalized.Name, normalized.AgentID, nullString(&normalized.ModelID),
		normalized.Message, paramsJSON, normalized.ScheduleType, weekdaysJSON,
		normalized.TimeOfDay, normalized.Timezone, normalized.Enabled, scheduleID, u.ID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	schedule, err := h.loadManagedAgentSchedule(scheduleID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, schedule)
}

func (h *ManagedAgentHandler) DeleteAgentSchedule(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	scheduleID := chi.URLParam(r, "scheduleId")
	res, err := h.db.Exec(`DELETE FROM managed_agent_schedules WHERE id = $1 AND user_id = $2`, scheduleID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *ManagedAgentHandler) RunAgentScheduleNow(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	scheduleID := chi.URLParam(r, "scheduleId")
	schedule, err := h.loadManagedAgentSchedule(scheduleID, u.ID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	params := map[string]string{"message": schedule.Message, "trigger_source": "manual", "schedule_id": schedule.ID}
	for key, value := range schedule.Params {
		params[key] = value
	}
	modelID := ""
	if schedule.ModelID != nil {
		modelID = *schedule.ModelID
	}
	client := h.clientForRequest(r)
	submitResp, err := client.SubmitTask(r.Context(), service.SubmitManagedTaskRequest{
		AgentID: schedule.AgentID,
		ModelID: modelID,
		Params:  params,
	})
	if err != nil {
		writeManagedAgentError(w, err)
		return
	}

	inputRef := map[string]any{
		"schedule_id":    schedule.ID,
		"schedule_name":  schedule.Name,
		"message":        schedule.Message,
		"params":         schedule.Params,
		"trigger_source": "manual",
	}
	runID, err := h.insertAIRun(u.ID, "manual_agent_run", schedule.AgentID, submitResp, modelID, inputRef)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	_, _ = h.db.Exec(`
		UPDATE managed_agent_schedules
		SET last_run_at = now(), last_ai_run_id = $1, updated_at = now()
		WHERE id = $2 AND user_id = $3`, runID, schedule.ID, u.ID)
	run, err := h.loadAIRun(runID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) StartReportRun(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	var req model.ManagedReportRunRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	req.SessionIDs = uniqueStringsPreserveOrder(req.SessionIDs)
	if strings.TrimSpace(req.AgentID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id is required"})
		return
	}
	if len(req.SessionIDs) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "session_ids is required"})
		return
	}
	reportType := strings.TrimSpace(req.ReportType)
	if reportType == "" {
		reportType = "personal_daily"
	}
	if reportType != "personal_daily" && reportType != "personal_weekly" &&
		reportType != "team_daily" && reportType != "team_weekly" &&
		reportType != "department_daily" && reportType != "department_weekly" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported report_type"})
		return
	}
	reportDate := req.ReportDate
	if reportDate == "" {
		reportDate = service.TodayInLocalDate()
	}

	sessions, err := loadDraftSessions(h.db, u.ID, req.SessionIDs)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if len(sessions) != len(req.SessionIDs) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "one or more sessions are not accessible"})
		return
	}
	sessionURLs := dailyReportSessionLogURLs(r, orderDraftSessions(sessions, req.SessionIDs))
	urlsJSON, _ := json.Marshal(sessionURLs)
	req.ModelID = strings.TrimSpace(req.ModelID)
	if req.ModelID == "" {
		req.ModelID = h.defaults.ModelID
	}

	client := h.clientForRequest(r)
	submitResp, err := client.SubmitTask(r.Context(), service.SubmitManagedTaskRequest{
		AgentID: req.AgentID,
		ModelID: req.ModelID,
		Params: map[string]string{
			"urls":            string(urlsJSON),
			"output_contract": service.DailyReportOutputContract(),
			"report_date":     reportDate,
			"report_type":     reportType,
		},
	})
	if err != nil {
		writeManagedAgentError(w, err)
		return
	}

	period := map[string]any{"date": reportDate}
	if reportType == "personal_weekly" || reportType == "team_weekly" || reportType == "department_weekly" {
		period = map[string]any{"week_start": req.WeekStart, "week_end": req.WeekEnd}
	}
	inputRef := map[string]any{
		"report_type": reportType,
		"period":      period,
		"report_date": reportDate,
		"session_ids": req.SessionIDs,
		"urls":        sessionURLs,
	}
	runID, err := h.insertAIRun(u.ID, reportType, req.AgentID, submitResp, req.ModelID, inputRef)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	run, err := h.loadAIRun(runID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) GetDailyReportRun(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	runID := chi.URLParam(r, "runId")
	run, err := h.loadAIRun(runID, u.ID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if run.ExternalTaskID != nil && !isTerminalManagedStatus(run.Status) {
		refreshed, err := h.refreshAIRun(r, run)
		if err != nil {
			writeJSON(w, http.StatusOK, run)
			return
		}
		run = refreshed
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) refreshAIRun(r *http.Request, run *model.AIRun) (*model.AIRun, error) {
	client := h.clientForRequest(r)
	task, err := client.GetTaskResult(r.Context(), *run.ExternalTaskID)
	if err != nil {
		return nil, err
	}
	status := normalizeManagedRunStatus(task.Status)
	output := map[string]any{
		"task_id":  task.TaskID,
		"status":   task.Status,
		"progress": task.Progress,
		"result":   task.Result,
	}
	if task.Error != "" {
		output["error"] = task.Error
	}
	if len(task.Raw) > 0 {
		var raw any
		if json.Unmarshal(task.Raw, &raw) == nil {
			output["raw"] = raw
		}
	}

	var errMsg *string
	if status == "failed" && task.Error != "" {
		errMsg = &task.Error
	}

	outputJSON, _ := json.Marshal(output)
	sets := []string{"status = $1", "output_ref_json = $2", "agent_version_id = $3"}
	args := []any{status, outputJSON, nullableInt(task.AgentVersionID)}
	argIdx := 4
	if task.ModelID != "" {
		sets = append(sets, fmt.Sprintf("model_id = $%d", argIdx))
		args = append(args, task.ModelID)
		argIdx++
	}
	if errMsg != nil {
		sets = append(sets, fmt.Sprintf("error_message = $%d", argIdx))
		args = append(args, *errMsg)
		argIdx++
	}
	if isTerminalManagedStatus(status) {
		sets = append(sets, "finished_at = now()")
	}
	args = append(args, run.ID)
	if _, err := h.db.Exec(fmt.Sprintf("UPDATE ai_runs SET %s WHERE id = $%d", joinWithCommas(sets), argIdx), args...); err != nil {
		return nil, err
	}

	refreshed, err := h.loadAIRun(run.ID, run.UserID)
	if err != nil {
		return nil, err
	}
	return refreshed, nil
}

// insertAIRun persists a freshly submitted managed-agent task as an ai_runs row
// and returns the new run id. Shared by the manual-agent and daily-report runs.
func (h *ManagedAgentHandler) insertAIRun(userID, businessType, agentID string, submit *service.SubmitManagedTaskResponse, modelID string, inputRef map[string]any) (string, error) {
	inputJSON, _ := json.Marshal(inputRef)
	var runID string
	err := h.db.QueryRow(`
		INSERT INTO ai_runs (
			user_id, business_type, runtime_type, agent_id, external_task_id,
			model_id, status, input_ref_json, started_at
		)
		VALUES ($1, $2, 'managed_task', $3, $4, $5, $6, $7, now())
		RETURNING id::text`,
		userID, businessType, agentID, submit.TaskID, nullableString(modelID), normalizeManagedRunStatus(submit.Status), inputJSON,
	).Scan(&runID)
	return runID, err
}

func (h *ManagedAgentHandler) insertPendingAIRun(userID, businessType, agentID, modelID string, inputRef map[string]any) (string, error) {
	inputJSON, _ := json.Marshal(inputRef)
	var runID string
	err := h.db.QueryRow(`
		INSERT INTO ai_runs (
			user_id, business_type, runtime_type, agent_id,
			model_id, status, input_ref_json, started_at
		)
		VALUES ($1, $2, 'managed_task', $3, $4, 'pending', $5, now())
		RETURNING id::text`,
		userID, businessType, agentID, nullableString(modelID), inputJSON,
	).Scan(&runID)
	return runID, err
}

func (h *ManagedAgentHandler) attachSubmittedAIRun(runID, userID string, submit *service.SubmitManagedTaskResponse, modelID string, inputRef map[string]any) error {
	inputJSON, _ := json.Marshal(inputRef)
	_, err := h.db.Exec(`
		UPDATE ai_runs
		SET external_task_id = $1, model_id = $2, status = $3, input_ref_json = $4
		WHERE id = $5 AND user_id = $6`,
		submit.TaskID, nullableString(modelID), normalizeManagedRunStatus(submit.Status), inputJSON, runID, userID,
	)
	return err
}

func (h *ManagedAgentHandler) markAIRunSubmitFailed(r *http.Request, runID, userID, message string) error {
	_, err := h.db.ExecContext(r.Context(), `
		UPDATE ai_runs
		SET status = 'failed', error_message = $1, finished_at = now()
		WHERE id = $2 AND user_id = $3`,
		message, runID, userID,
	)
	return err
}

func isPersonalDailyReportRun(params map[string]string) bool {
	return strings.TrimSpace(params["report_type"]) == "personal_daily"
}

func copyStringMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for key, value := range in {
		out[key] = value
	}
	return out
}

func copyStringMapForInputRef(in map[string]string) map[string]string {
	out := copyStringMap(in)
	if _, ok := out["mcp_authorization"]; ok {
		out["mcp_authorization"] = "Bearer <redacted>"
	}
	return out
}

func agentCallbackURL(r *http.Request, path string) string {
	if origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/"); origin != "" {
		if parsed, err := url.Parse(origin); err == nil && parsed.Scheme != "" && parsed.Host != "" {
			return origin + path
		}
	}
	return absoluteRequestURL(r, path)
}

const aiRunSelectColumns = `SELECT id::text, user_id::text, business_type, business_id::text, runtime_type,
			agent_id, agent_version_id, external_task_id, external_session_id, model_id,
			status, input_ref_json, output_ref_json, error_message, started_at, finished_at, created_at
		FROM ai_runs`

// scanAIRun scans one ai_runs row (from *sql.Row or *sql.Rows) into a model.AIRun.
// Shared by loadAIRun (point lookup) and ListAgentRuns (batch) so the column
// list and the scan cannot drift apart.
func scanAIRun(row rowScanner) (*model.AIRun, error) {
	var run model.AIRun
	var businessID, externalTaskID, externalSessionID, modelID, errMsg sql.NullString
	var agentVersionID sql.NullInt64
	var startedAt, finishedAt sql.NullTime
	var inputRaw, outputRaw []byte
	if err := row.Scan(
		&run.ID, &run.UserID, &run.BusinessType, &businessID, &run.RuntimeType,
		&run.AgentID, &agentVersionID, &externalTaskID, &externalSessionID, &modelID,
		&run.Status, &inputRaw, &outputRaw, &errMsg, &startedAt, &finishedAt, &run.CreatedAt,
	); err != nil {
		return nil, err
	}
	run.BusinessID = nullStringPtr(businessID)
	run.ExternalTaskID = nullStringPtr(externalTaskID)
	run.ExternalSessionID = nullStringPtr(externalSessionID)
	run.ModelID = nullStringPtr(modelID)
	run.ErrorMessage = nullStringPtr(errMsg)
	if agentVersionID.Valid {
		v := int(agentVersionID.Int64)
		run.AgentVersionID = &v
	}
	if startedAt.Valid {
		run.StartedAt = &startedAt.Time
	}
	if finishedAt.Valid {
		run.FinishedAt = &finishedAt.Time
	}
	_ = json.Unmarshal(inputRaw, &run.InputRef)
	_ = json.Unmarshal(outputRaw, &run.OutputRef)
	if result, ok := run.OutputRef["result"].(string); ok {
		run.Result = result
	}
	if draftRaw, ok := run.OutputRef["draft"]; ok {
		if b, err := json.Marshal(draftRaw); err == nil {
			var draft model.GenerateReportDraftResponse
			if json.Unmarshal(b, &draft) == nil && draft.ReportMarkdown != "" {
				run.Draft = &draft
			}
		}
	}
	return &run, nil
}

func (h *ManagedAgentHandler) loadAIRun(runID, userID string) (*model.AIRun, error) {
	return scanAIRun(h.db.QueryRow(aiRunSelectColumns+" WHERE id = $1 AND user_id = $2", runID, userID))
}

const managedAgentScheduleSelectColumns = `SELECT id::text, user_id::text, name, agent_id, model_id, message,
			params_json, schedule_type, weekdays_json, time_of_day, timezone, enabled,
			last_run_at, last_ai_run_id::text, created_at, updated_at
		FROM managed_agent_schedules`

type normalizedManagedAgentScheduleRequest struct {
	Name         string
	AgentID      string
	ModelID      string
	Message      string
	Params       map[string]string
	ScheduleType string
	Weekdays     []int
	TimeOfDay    string
	Timezone     string
	Enabled      bool
}

func normalizeManagedAgentScheduleRequest(req model.UpsertManagedAgentScheduleRequest) (normalizedManagedAgentScheduleRequest, error) {
	normalized := normalizedManagedAgentScheduleRequest{
		Name:         strings.TrimSpace(req.Name),
		AgentID:      strings.TrimSpace(req.AgentID),
		ModelID:      strings.TrimSpace(req.ModelID),
		Message:      strings.TrimSpace(req.Message),
		ScheduleType: strings.TrimSpace(req.ScheduleType),
		TimeOfDay:    strings.TrimSpace(req.TimeOfDay),
		Timezone:     strings.TrimSpace(req.Timezone),
		Enabled:      true,
		Params:       map[string]string{},
	}
	if req.Enabled != nil {
		normalized.Enabled = *req.Enabled
	}
	if normalized.ScheduleType == "" {
		normalized.ScheduleType = "daily"
	}
	if normalized.Timezone == "" {
		normalized.Timezone = "Asia/Shanghai"
	}
	for key, value := range req.Params {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		normalized.Params[key] = strings.TrimSpace(value)
	}

	if normalized.Name == "" {
		return normalized, fmt.Errorf("name is required")
	}
	if normalized.AgentID == "" {
		return normalized, fmt.Errorf("agent_id is required")
	}
	if normalized.Message == "" {
		return normalized, fmt.Errorf("message is required")
	}
	if _, err := time.Parse("15:04", normalized.TimeOfDay); err != nil {
		return normalized, fmt.Errorf("time_of_day must use HH:mm")
	}
	if _, err := time.LoadLocation(normalized.Timezone); err != nil {
		return normalized, fmt.Errorf("timezone is invalid")
	}

	switch normalized.ScheduleType {
	case "daily":
		normalized.Weekdays = []int{}
	case "weekly":
		seen := map[int]bool{}
		for _, weekday := range req.Weekdays {
			if weekday < 1 || weekday > 7 {
				return normalized, fmt.Errorf("weekdays must be between 1 and 7")
			}
			if !seen[weekday] {
				normalized.Weekdays = append(normalized.Weekdays, weekday)
				seen[weekday] = true
			}
		}
		if len(normalized.Weekdays) == 0 {
			return normalized, fmt.Errorf("weekdays is required for weekly schedules")
		}
	default:
		return normalized, fmt.Errorf("schedule_type must be daily or weekly")
	}
	return normalized, nil
}

func scanManagedAgentSchedule(row rowScanner) (model.ManagedAgentSchedule, error) {
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
	schedule.ModelID = nullStringPtr(modelID)
	schedule.LastAIRunID = nullStringPtr(lastRunID)
	if lastRunAt.Valid {
		schedule.LastRunAt = &lastRunAt.Time
	}
	_ = json.Unmarshal(paramsRaw, &schedule.Params)
	_ = json.Unmarshal(weekdaysRaw, &schedule.Weekdays)
	if schedule.Params == nil {
		schedule.Params = map[string]string{}
	}
	return schedule, nil
}

func (h *ManagedAgentHandler) loadManagedAgentSchedule(scheduleID, userID string) (model.ManagedAgentSchedule, error) {
	return scanManagedAgentSchedule(h.db.QueryRow(managedAgentScheduleSelectColumns+" WHERE id = $1 AND user_id = $2", scheduleID, userID))
}

func normalizeManagedRunStatus(status string) string {
	switch strings.ToLower(status) {
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

func isTerminalManagedStatus(status string) bool {
	return status == "succeeded" || status == "failed" || status == "timeout"
}

func nullableString(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func nullableInt(v int) any {
	if v == 0 {
		return nil
	}
	return v
}

func absoluteRequestURL(r *http.Request, path string) string {
	proto := r.Header.Get("X-Forwarded-Proto")
	if proto == "" {
		proto = "http"
		if r.TLS != nil {
			proto = "https"
		}
	}
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	return proto + "://" + host + path
}

func dailyReportSessionLogURLs(r *http.Request, sessions []model.ReportDraftSession) []string {
	urls := make([]string, 0, len(sessions))
	for _, session := range sessions {
		urls = append(urls, absoluteRequestURL(r, "/api/v1/sessions/"+url.PathEscape(session.ID)+"/log"))
	}
	return urls
}
