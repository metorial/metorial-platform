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
	BucketID string `json:"bucket_id"`
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

	return httpRouter
}

func (hs *HttpService) authenticateRequest(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", fmt.Errorf("missing or invalid authorization header")
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
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

func (hs *HttpService) handleGetFiles(w http.ResponseWriter, r *http.Request) {
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
	vars := mux.Vars(r)
	filePath := vars["path"]

	// Authenticate
	authBucketID, err := hs.authenticateRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	content, contentType, err := hs.fsm.GetBucketFile(r.Context(), authBucketID, filePath)
	if err != nil {
		if err.Error() == "file not found" {
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Write(content)
}

func (hs *HttpService) handlePutFile(w http.ResponseWriter, r *http.Request) {
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
