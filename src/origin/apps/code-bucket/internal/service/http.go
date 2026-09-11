package service

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
	"github.com/metorial/metorial/services/code-bucket/pkg/util"
)

const maxServedFileBytes int64 = 10 << 20

const FileTooLargeHeader = "X-Metorial-File-Too-Large"

type HttpService struct {
	fsm       *fs.FileSystemManager
	jwtSecret []byte
}

type Claims struct {
	BucketID   string `json:"bucket_id"`
	IsReadOnly bool   `json:"is_read_only"`
	jwt.RegisteredClaims
}

func newHttpServiceRouter(service *Service) *mux.Router {
	hs := &HttpService{
		fsm:       service.fsm,
		jwtSecret: service.jwtSecret,
	}

	httpRouter := mux.NewRouter()
	httpRouter.HandleFunc("/files", hs.handleGetFiles).Methods("GET")
	httpRouter.HandleFunc("/files/{path:.*}", hs.handleGetFile).Methods("GET")
	httpRouter.HandleFunc("/files/{path:.*}", hs.handlePutFile).Methods("PUT")
	httpRouter.HandleFunc("/files/{path:.*}", hs.handleDeleteFile).Methods("DELETE")
	httpRouter.HandleFunc("/files/{path:.*}", hs.handleOptions).Methods("OPTIONS")

	return httpRouter
}

func (hs *HttpService) authenticateRequest(r *http.Request) (string, bool, error) {
	authHeader := r.Header.Get("Authorization")
	authQuery := r.URL.Query().Get("metorial-code-bucket-token")

	tokenString := authQuery

	if authHeader != "" {
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return "", false, fmt.Errorf("missing or invalid authorization header")
		}

		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	}

	if tokenString == "" {
		return "", false, fmt.Errorf("missing authorization token")
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return hs.jwtSecret, nil
	})

	if err != nil {
		return "", false, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims.BucketID, claims.IsReadOnly, nil
	}

	return "", false, fmt.Errorf("invalid token")
}

func (hs *HttpService) setCorsHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")

	// Without this the browser hides the header from the editor, which would then
	// mistake a placeholder for real content.
	w.Header().Set("Access-Control-Expose-Headers", FileTooLargeHeader)
}

func (hs *HttpService) handleGetFiles(w http.ResponseWriter, r *http.Request) {
	hs.setCorsHeaders(w)

	// Authenticate
	authBucketID, _, err := hs.authenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	files, err := hs.fsm.GetBucketFiles(r.Context(), authBucketID, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func (hs *HttpService) handleGetFile(w http.ResponseWriter, r *http.Request) {
	hs.setCorsHeaders(w)

	vars := mux.Vars(r)
	filePath := util.NormalizePath(vars["path"])

	// Authenticate
	authBucketID, _, err := hs.authenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	body, info, err := hs.fsm.OpenBucketFile(r.Context(), authBucketID, filePath)
	if err != nil {
		if err.Error() == "file not found" {
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	defer body.Close()

	placeholder, err := writeFileResponse(w, info, body)
	if placeholder {
		log.Printf(
			"[code-bucket http] served placeholder bucket=%s path=%s size=%d limit=%d",
			authBucketID, filePath, info.Size, maxServedFileBytes,
		)
	}
	if err != nil {
		log.Printf(
			"[code-bucket http] failed to write body bucket=%s path=%s err=%v",
			authBucketID, filePath, err,
		)
	}
}

func writeFileResponse(w http.ResponseWriter, info *fs.FileInfo, body io.Reader) (bool, error) {
	if info.Size > maxServedFileBytes {
		w.Header().Set(FileTooLargeHeader, "true")
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		_, err := fmt.Fprintf(w, "%s\n", fileTooLargeMessage(info.Size))
		return true, err
	}

	w.Header().Set("Content-Type", info.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size, 10))

	_, err := io.Copy(w, body)
	return false, err
}

func fileTooLargeMessage(size int64) string {
	return fmt.Sprintf(
		"This file is too large to display (%s, over the %s limit).",
		filelimit.HumanBytes(size), filelimit.HumanBytes(maxServedFileBytes),
	)
}

func (hs *HttpService) handlePutFile(w http.ResponseWriter, r *http.Request) {
	hs.setCorsHeaders(w)

	vars := mux.Vars(r)
	filePath := util.NormalizePath(vars["path"])

	// Authenticate
	authBucketID, isReadOnly, err := hs.authenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	// Silently ignore write operations for read-only tokens
	if isReadOnly {
		w.WriteHeader(http.StatusCreated)
		return
	}

	content, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	contentType := r.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	err = hs.fsm.PutBucketFile(r.Context(), authBucketID, filePath, content, contentType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (hs *HttpService) handleDeleteFile(w http.ResponseWriter, r *http.Request) {
	hs.setCorsHeaders(w)

	vars := mux.Vars(r)
	filePath := util.NormalizePath(vars["path"])

	// Authenticate
	authBucketID, isReadOnly, err := hs.authenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	// Silently ignore delete operations for read-only tokens
	if isReadOnly {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	err = hs.fsm.DeleteBucketFile(r.Context(), authBucketID, filePath)
	if err != nil {
		if err.Error() == "file not found" {
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (hs *HttpService) handleOptions(w http.ResponseWriter, r *http.Request) {
	hs.setCorsHeaders(w)
	w.WriteHeader(http.StatusOK)
}
