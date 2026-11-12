require("dotenv").config();

const express = require("express");
const session = require("express-session");
const { google } = require("googleapis");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(express.json());
app.use(session({
  name: "ytap.sid",
  secret: process.env.SESSION_SECRET || "desenvolvimento-local-apenas",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, "public")));

function oauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("A configuração OAuth do Google ainda não foi concluída.");
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

app.get("/auth/google", (req, res) => {
  try {
    const oauth2 = oauthClient();
    const state = crypto.randomBytes(24).toString("hex");
    req.session.oauthStates = req.session.oauthStates || {};
    req.session.oauthStates[state] = Date.now();
    // Persist the session before redirecting to Google so the state cookie is available on callback.
    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      state,
      scope: [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly"
      ]
    });
    req.session.save(saveError => {
      if (saveError) {
        console.error("[OAuth] Não foi possível salvar a sessão antes do redirecionamento:", saveError.message);
        return res.status(500).send("Não foi possível iniciar a conexão com o Google. Atualize o painel e tente novamente.");
      }
      res.redirect(url);
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const state = String(req.query.state || "");
    const createdAt = req.session.oauthStates && req.session.oauthStates[state];
    const stateIsValid = Boolean(createdAt && Date.now() - createdAt <= 10 * 60 * 1000);
    if (!stateIsValid) {
      return res.status(400).send("Validação de segurança inválida. Volte ao painel, atualize a página e tente novamente.");
    }
    // Consume only the matching state; other simultaneous login attempts remain valid.
    delete req.session.oauthStates[state];
    if (req.query.error) {
      return req.session.save(() => res.redirect("/?auth=cancelled"));
    }
    const oauth2 = oauthClient();
    const { tokens } = await oauth2.getToken(String(req.query.code || ""));
    req.session.tokens = tokens;
    req.session.save(saveError => {
      if (saveError) {
        console.error("[OAuth] Não foi possível salvar a sessão após a autorização:", saveError.message);
        return res.status(500).send("A autorização foi concluída, mas não foi possível salvar a sessão. Volte ao painel e conecte novamente.");
      }
      res.redirect("/?auth=connected");
    });
  } catch (error) {
    console.error("[OAuth] Falha no retorno do Google:", error.message);
    res.status(500).send("Não foi possível concluir a conexão com o Google. Confira a configuração OAuth.");
  }
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/status", (req, res) => {
  res.json({ connected: Boolean(req.session.tokens), configured: Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI
  )});
});

function googleAuth(req) {
  if (!req.session.tokens) return null;
  const auth = oauthClient();
  auth.setCredentials(req.session.tokens);
  auth.on("tokens", tokens => {
    req.session.tokens = { ...req.session.tokens, ...tokens };
  });
  return auth;
}

app.get("/api/channel", async (req, res) => {
  try {
    const auth = googleAuth(req);
    if (!auth) return res.status(401).json({ error: "Conecte seu canal primeiro." });
    const yt = google.youtube({ version: "v3", auth });
    const response = await yt.channels.list({ part: ["snippet", "statistics"], mine: true });
    const channel = response.data.items && response.data.items[0];
    if (!channel) return res.status(404).json({ error: "Nenhum canal foi encontrado nesta conta Google." });
    res.json({
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
      subscribers: channel.statistics.subscriberCount,
      views: channel.statistics.viewCount,
      videos: channel.statistics.videoCount
    });
  } catch (error) {
    // Registra somente os detalhes do erro da API; nunca registra tokens ou credenciais.
    console.error("[YouTube Data API] Falha ao consultar canal:", {
      status: error.response?.status || error.status || null,
      code: error.code || null,
      message: error.message || "Erro sem mensagem",
      errors: error.response?.data?.error?.errors || error.errors || null,
      reason: error.response?.data?.error?.status || null
    });
    res.status(500).json({ error: "Falha ao consultar o canal. Verifique os logs do serviço no Render para identificar o motivo." });
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    const auth = googleAuth(req);
    if (!auth) return res.status(401).json({ error: "Conecte seu canal primeiro." });
    const analytics = google.youtubeAnalytics({ version: "v2", auth });
    const end = new Date();
    end.setDate(end.getDate() - 2);
    const start = new Date(end);
    start.setDate(start.getDate() - 27);
    const fmt = d => d.toISOString().slice(0, 10);
    const response = await analytics.reports.query({
      ids: "channel==MINE",
      startDate: fmt(start),
      endDate: fmt(end),
      metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained",
      dimensions: "day",
      sort: "day"
    });
    const annualStart = new Date(end);
    annualStart.setDate(annualStart.getDate() - 364);
    const annualResponse = await analytics.reports.query({
      ids: "channel==MINE",
      startDate: fmt(annualStart),
      endDate: fmt(end),
      metrics: "estimatedMinutesWatched"
    });
    const annualMinutes = Number(annualResponse.data.rows?.[0]?.[0] || 0);
    res.json({
      startDate: fmt(start),
      endDate: fmt(end),
      rows: response.data.rows || [],
      annualStartDate: fmt(annualStart),
      annualEndDate: fmt(end),
      watchHours365: Math.round(annualMinutes / 60)
    });
  } catch (error) {
    res.status(500).json({ error: "Não foi possível carregar as métricas do YouTube Analytics." });
  }
});


app.get("/api/top-videos", async (req, res) => {
  try {
    const auth = googleAuth(req);
    if (!auth) return res.status(401).json({ error: "Conecte seu canal primeiro." });
    const analytics = google.youtubeAnalytics({ version: "v2", auth });
    const end = new Date();
    end.setDate(end.getDate() - 2);
    const start = new Date(end);
    start.setDate(start.getDate() - 27);
    const fmt = d => d.toISOString().slice(0, 10);
    const report = await analytics.reports.query({
      ids: "channel==MINE",
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: "video",
      metrics: "views,estimatedMinutesWatched,averageViewDuration,impressions,impressionClickThroughRate",
      sort: "-estimatedMinutesWatched",
      maxResults: 10
    });
    const rows = report.data.rows || [];
    if (!rows.length) return res.json({ startDate: fmt(start), endDate: fmt(end), videos: [] });
    const ids = rows.map(row => row[0]).filter(Boolean);
    const yt = google.youtube({ version: "v3", auth });
    const details = await yt.videos.list({ part: ["snippet", "contentDetails"], id: ids });
    const byId = new Map((details.data.items || []).map(video => [video.id, video]));
    const videos = rows.map(row => {
      const video = byId.get(row[0]);
      if (!video) return null;
      return {
        id: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || "",
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration,
        views: Number(row[1] || 0),
        watchHours: Math.round(Number(row[2] || 0) / 60),
        averageViewDuration: Number(row[3] || 0),
        impressions: Number(row[4] || 0),
        clickThroughRate: Number(row[5] || 0)
      };
    }).filter(Boolean);
    res.json({ startDate: fmt(start), endDate: fmt(end), videos });
  } catch (error) {
    console.error("[YouTube Analytics] Falha ao consultar vídeos:", error.message);
    res.status(500).json({ error: "Não foi possível analisar os vídeos. Confira se o canal possui dados no período." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`YouTube AutoPromoter disponível na porta ${PORT}`));
