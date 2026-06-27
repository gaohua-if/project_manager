package handler

import (
	"database/sql"
	"net/http"
	"strconv"
)

const editConflictCode = "EDIT_CONFLICT"

func writeEditConflict(w http.ResponseWriter, currentVersion int64) {
	writeJSON(w, http.StatusConflict, map[string]any{
		"code":            editConflictCode,
		"error":           "content has been updated by another user",
		"current_version": currentVersion,
	})
}

func writeNoFieldsToUpdate(w http.ResponseWriter) {
	writeJSON(w, http.StatusBadRequest, map[string]string{
		"code":  "no_fields_to_update",
		"error": "no fields to update",
	})
}

func requireBaseVersion(w http.ResponseWriter, baseVersion int64) bool {
	if baseVersion > 0 {
		return true
	}
	writeJSON(w, http.StatusBadRequest, map[string]string{"error": "base_version is required"})
	return false
}

func parseBaseVersionFromQuery(w http.ResponseWriter, r *http.Request) (int64, bool) {
	raw := r.URL.Query().Get("base_version")
	version, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || version <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "base_version is required"})
		return 0, false
	}
	return version, true
}

func currentRequirementVersion(db *sql.DB, id string) (int64, bool, error) {
	var version int64
	err := db.QueryRow(`SELECT version FROM requirements WHERE id = $1`, id).Scan(&version)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	return version, err == nil, err
}

func currentTaskVersion(db *sql.DB, id string) (int64, bool, error) {
	var version int64
	err := db.QueryRow(`SELECT version FROM tasks WHERE id = $1`, id).Scan(&version)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	return version, err == nil, err
}

func writeRequirementNotFoundOrConflict(w http.ResponseWriter, db *sql.DB, id string) {
	version, exists, err := currentRequirementVersion(db, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeEditConflict(w, version)
}

func writeTaskNotFoundOrConflict(w http.ResponseWriter, db *sql.DB, id string) {
	version, exists, err := currentTaskVersion(db, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeEditConflict(w, version)
}
