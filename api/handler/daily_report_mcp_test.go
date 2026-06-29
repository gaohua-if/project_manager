package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDailyReportMCPToolsList(t *testing.T) {
	h := NewDailyReportMCPHandler(nil)
	req := httptest.NewRequest(http.MethodPost, "/mcp/daily-report", bytes.NewBufferString(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	rec := httptest.NewRecorder()

	h.Serve(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Result struct {
			Tools []struct {
				Name string `json:"name"`
			} `json:"tools"`
		} `json:"result"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Result.Tools) != 2 {
		t.Fatalf("tools len = %d, want 2", len(resp.Result.Tools))
	}
	if resp.Result.Tools[0].Name != dailyReportContextTool || resp.Result.Tools[1].Name != dailyReportSaveDraftTool {
		t.Fatalf("unexpected tools: %#v", resp.Result.Tools)
	}
}
