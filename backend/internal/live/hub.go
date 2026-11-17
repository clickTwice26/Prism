// Package live relays a teacher's live class (captions + WebM video) to
// students over WebSockets. Rooms are coordinated through Redis pub/sub, so
// any number of API instances can serve the same class.
//
// Text frames (JSON)
//
//	client → server: hello{role,name} | caption{final,text} | clear | video_start{mime} | video_stop
//	server → client: joined{room} | roster{students,count} (teachers) | caption | clear | video_start | video_stop
//
// Binary frames: teacher → students WebM chunks. The first chunk after
// video_start (the WebM init segment) is kept in Redis so late joiners can
// start decoding mid-stream.
package live

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/redis/go-redis/v9"
)

var roomPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,40}$`)

func ValidRoom(room string) bool { return roomPattern.MatchString(room) }

const (
	channelPrefix = "live:ch:"
	keyTTL        = 12 * time.Hour
	sendBuffer    = 512
)

type frame struct {
	binary bool
	data   []byte
}

type Client struct {
	id, room     string
	role, name   string
	startedVideo bool
	out          chan frame
}

// envelope is what travels over Redis between instances.
type envelope struct {
	Origin string          `json:"o"`
	To     string          `json:"t"` // others | students | teachers
	Text   json.RawMessage `json:"x,omitempty"`
	Bin    []byte          `json:"b,omitempty"`
}

type Hub struct {
	rdb   *redis.Client
	mu    sync.RWMutex
	rooms map[string]map[*Client]struct{}
	log   *slog.Logger
}

func NewHub(rdb *redis.Client, log *slog.Logger) *Hub {
	return &Hub{rdb: rdb, rooms: map[string]map[*Client]struct{}{}, log: log}
}

// Run subscribes to every room channel and fans messages out to the clients
// connected to this instance. It blocks until ctx is cancelled.
func (h *Hub) Run(ctx context.Context) {
	sub := h.rdb.PSubscribe(ctx, channelPrefix+"*")
	defer sub.Close()
	ch := sub.Channel(redis.WithChannelSize(1024))
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			var env envelope
			if err := json.Unmarshal([]byte(msg.Payload), &env); err != nil {
				continue
			}
			h.deliver(strings.TrimPrefix(msg.Channel, channelPrefix), env)
		}
	}
}

func (h *Hub) deliver(room string, env envelope) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.rooms[room] {
		if c.id == env.Origin {
			continue
		}
		if (env.To == "students" && c.role != "student") || (env.To == "teachers" && c.role != "teacher") {
			continue
		}
		f := frame{data: env.Text}
		if env.Bin != nil {
			f = frame{binary: true, data: env.Bin}
		}
		select {
		case c.out <- f:
		default: // slow client: drop rather than stall the room
		}
	}
}

func (h *Hub) publish(ctx context.Context, room string, env envelope) {
	raw, _ := json.Marshal(env)
	if err := h.rdb.Publish(ctx, channelPrefix+room, raw).Err(); err != nil {
		h.log.Warn("live publish failed", "room", room, "err", err)
	}
}

func (h *Hub) publishJSON(ctx context.Context, room, origin, to string, v any) {
	raw, _ := json.Marshal(v)
	h.publish(ctx, room, envelope{Origin: origin, To: to, Text: raw})
}

func studentsKey(room string) string { return "live:" + room + ":students" }
func videoKey(room string) string    { return "live:" + room + ":video" }

func (h *Hub) roster(ctx context.Context, room string) map[string]any {
	names, _ := h.rdb.HVals(ctx, studentsKey(room)).Result()
	if names == nil {
		names = []string{}
	}
	return map[string]any{"type": "roster", "students": names, "count": len(names)}
}

// Serve runs one WebSocket connection until it closes.
func (h *Hub) Serve(ctx context.Context, conn *websocket.Conn, room string) {
	conn.SetReadLimit(8 << 20)
	c := &Client{id: newID(), room: room, out: make(chan frame, sendBuffer)}

	h.mu.Lock()
	if h.rooms[room] == nil {
		h.rooms[room] = map[*Client]struct{}{}
	}
	h.rooms[room][c] = struct{}{}
	h.mu.Unlock()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go h.writeLoop(ctx, conn, c, cancel)

	h.sendJSON(c, map[string]any{"type": "joined", "room": room})
	defer h.leave(context.WithoutCancel(ctx), c)

	for {
		typ, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		if typ == websocket.MessageBinary {
			h.onVideoChunk(ctx, c, data)
			continue
		}
		h.onText(ctx, c, data)
	}
}

func (h *Hub) writeLoop(ctx context.Context, conn *websocket.Conn, c *Client, cancel func()) {
	defer cancel()
	for {
		select {
		case <-ctx.Done():
			return
		case f := <-c.out:
			typ := websocket.MessageText
			if f.binary {
				typ = websocket.MessageBinary
			}
			wctx, done := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Write(wctx, typ, f.data)
			done()
			if err != nil {
				return
			}
		}
	}
}

func (h *Hub) sendJSON(c *Client, v any) {
	raw, _ := json.Marshal(v)
	select {
	case c.out <- frame{data: raw}:
	default:
	}
}

type inbound struct {
	Type  string `json:"type"`
	Role  string `json:"role"`
	Name  string `json:"name"`
	Final bool   `json:"final"`
	Text  string `json:"text"`
	Mime  string `json:"mime"`
}

func (h *Hub) onText(ctx context.Context, c *Client, data []byte) {
	var m inbound
	if json.Unmarshal(data, &m) != nil {
		return
	}
	switch m.Type {
	case "hello":
		if m.Role != "teacher" && m.Role != "student" {
			return
		}
		c.role, c.name = m.Role, clip(m.Name, 40)
		if c.role == "student" {
			if c.name == "" {
				c.name = "Student"
			}
			h.rdb.HSet(ctx, studentsKey(c.room), c.id, c.name)
			h.rdb.Expire(ctx, studentsKey(c.room), keyTTL)
			h.publishJSON(ctx, c.room, c.id, "teachers", h.roster(ctx, c.room))
			h.catchUpVideo(ctx, c)
		} else {
			h.sendJSON(c, h.roster(ctx, c.room))
		}
	case "caption":
		if c.role != "teacher" {
			return
		}
		h.publishJSON(ctx, c.room, c.id, "others", map[string]any{"type": "caption", "final": m.Final, "text": clip(m.Text, 2000)})
	case "clear":
		if c.role == "teacher" {
			h.publishJSON(ctx, c.room, c.id, "others", map[string]any{"type": "clear"})
		}
	case "video_start":
		if c.role != "teacher" {
			return
		}
		mime := clip(m.Mime, 80)
		if !strings.HasPrefix(mime, "video/") && !strings.HasPrefix(mime, "audio/") {
			return
		}
		c.startedVideo = true
		h.rdb.Del(ctx, videoKey(c.room))
		h.rdb.HSet(ctx, videoKey(c.room), "mime", mime)
		h.rdb.Expire(ctx, videoKey(c.room), keyTTL)
		h.publishJSON(ctx, c.room, c.id, "students", map[string]any{"type": "video_start", "mime": mime})
	case "video_stop":
		if c.role == "teacher" {
			h.stopVideo(ctx, c)
		}
	}
}

func (h *Hub) onVideoChunk(ctx context.Context, c *Client, data []byte) {
	if c.role != "teacher" || !c.startedVideo {
		return
	}
	// The first chunk is the WebM init segment; keep it for late joiners.
	h.rdb.HSetNX(ctx, videoKey(c.room), "header", data)
	h.publish(ctx, c.room, envelope{Origin: c.id, To: "students", Bin: data})
}

func (h *Hub) catchUpVideo(ctx context.Context, c *Client) {
	v, err := h.rdb.HGetAll(ctx, videoKey(c.room)).Result()
	if err != nil || v["mime"] == "" {
		return
	}
	h.sendJSON(c, map[string]any{"type": "video_start", "mime": v["mime"]})
	if hdr := v["header"]; hdr != "" {
		select {
		case c.out <- frame{binary: true, data: []byte(hdr)}:
		default:
		}
	}
}

func (h *Hub) stopVideo(ctx context.Context, c *Client) {
	c.startedVideo = false
	h.rdb.Del(ctx, videoKey(c.room))
	h.publishJSON(ctx, c.room, c.id, "students", map[string]any{"type": "video_stop"})
}

func (h *Hub) leave(ctx context.Context, c *Client) {
	h.mu.Lock()
	delete(h.rooms[c.room], c)
	if len(h.rooms[c.room]) == 0 {
		delete(h.rooms, c.room)
	}
	h.mu.Unlock()

	switch c.role {
	case "student":
		h.rdb.HDel(ctx, studentsKey(c.room), c.id)
		h.publishJSON(ctx, c.room, c.id, "teachers", h.roster(ctx, c.room))
	case "teacher":
		if c.startedVideo {
			h.stopVideo(ctx, c)
		}
	}
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}
