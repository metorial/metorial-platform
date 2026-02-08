package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
)

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

func (hs *HttpService) authenticateRequest(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	authQuery := r.URL.Query().Get("metorial-code-bucket-token")

	tokenString := authQuery

	if authHeader != "" {
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return "", fmt.Errorf("missing or invalid authorization header")
		}

		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	}

	if tokenString == "" {
		return "", fmt.Errorf("missing authorization token")
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return hs.jwtSecret, nil
	})

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims.BucketID, nil
	}

	return "", fmt.Errorf("invalid token")
}

func (hs *HttpService) setCorsHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
}

func (hs *HttpService) handleGetFiles(w http.ResponseWriter, r *http.Request) {
	hs.setCorsHeaders(w)

	// Authenticate
	authBucketID, err := hs.authenticateRequest(r)
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
	filePath := vars["path"]

	// Authenticate
	authBucketID, err := hs.authenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	_, content, err := hs.fsm.GetBucketFile(r.Context(), authBucketID, filePath)
	if err != nil {
		if err.Error() == "file not found" {
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", content.ContentType)
	w.Write(content.Content)
}

func (hs *HttpService) handlePutFile(w http.ResponseWriter, r *http.Request) {
	hs.setCorsHeaders(w)

	vars := mux.Vars(r)
	filePath := vars["path"]

	// Authenticate
	authBucketID, err := hs.authenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
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
	filePath := vars["path"]

	// Authenticate
	authBucketID, err := hs.authenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
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
