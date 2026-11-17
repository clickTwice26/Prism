// Command api runs the Prism HTTP and WebSocket server.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/clickTwice26/Prism/backend/internal/ai"
	"github.com/clickTwice26/Prism/backend/internal/cache"
	"github.com/clickTwice26/Prism/backend/internal/config"
	"github.com/clickTwice26/Prism/backend/internal/httpapi"
	"github.com/clickTwice26/Prism/backend/internal/live"
	"github.com/clickTwice26/Prism/backend/internal/store"
	"github.com/clickTwice26/Prism/backend/internal/tts"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := db.Migrate(ctx); err != nil {
		return err
	}
	if err := db.SeedLessons(ctx); err != nil {
		return err
	}

	rc, err := cache.Open(ctx, cfg.RedisURL)
	if err != nil {
		return err
	}
	defer rc.Close()

	hub := live.NewHub(rc.R, log)
	go hub.Run(ctx)

	aic := ai.New(cfg.OpenAIKey, cfg.OpenAIBaseURL, cfg.OpenAIModel, cfg.OpenAIImageModel, cfg.OpenAITTSModel, cfg.OpenAITTSVoice)
	if !aic.Enabled() {
		log.Warn("OPENAI_API_KEY not set: AI features return 503, simplify uses the offline rules")
	}
	piper := tts.NewPiper(cfg.PiperBin, cfg.PiperVoicesDir)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.New(cfg, db, rc, aic, piper, hub, log).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	errc := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", srv.Addr)
		errc <- srv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		log.Info("shutting down")
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
