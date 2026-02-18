import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// 🔐 Token cacheado
let accessToken = null;
let tokenExpiry = 0;

async function getToken() {
    const now = Date.now();

    // Si el token aún sirve, reutilizarlo
    if (accessToken && now < tokenExpiry) {
        return accessToken;
    }

    console.log("🔄 Generating new Twitch token...");

    const res = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
        { method: "POST" }
    );

    const data = await res.json();

    accessToken = data.access_token;
    tokenExpiry = now + (data.expires_in - 60) * 1000; // margen de seguridad

    return accessToken;
}

// 🧪 Test endpoint
app.get("/test", (req, res) => {
    res.send("Backend OK");
});

// obtener offline image desde video

app.get("/offline-image-from-video/:videoId", async (req, res) => {
    const videoId = req.params.videoId;
    console.log(`🔍 Fetching offline image for video ID: ${videoId}`);
    try {
        const token = await getToken();
        const videoRes = await fetch(
            `https://api.twitch.tv/helix/videos?id=${videoId}`,
            {
                headers: {
                    "Client-ID": CLIENT_ID,
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const videoData = await videoRes.json();
        console.log("VIDEO DATA:");
        console.dir(videoData, { depth: null });
        const userLogin = videoData.data?.[0]?.user_login;
        if (!userLogin) {
            return res.json({ url: null, error: "Video or user not found" });
        }
        const channelDataFull = await fetch(
            `https://api.twitch.tv/helix/users?login=${userLogin}`,
            {
                headers: {
                    "Client-ID": CLIENT_ID,
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const channelDataFullJson = await channelDataFull.json();
        console.log("FULL CHANNEL DATA:");
        console.dir(channelDataFullJson, { depth: null });
        const offlineImage = channelDataFullJson.data?.[0]?.offline_image_url;

        res.json({ url: offlineImage });
    } catch (err) {
        console.error("❌ ERROR:", err);
        res.status(500).json({ error: "Internal error" });
    }
});

// 🎯 Obtener offline image
app.get("/offline-image/:login", async (req, res) => {
    const login = req.params.login;
    console.log(`🔍 Fetching offline image for: ${login}`);
    try {
        const token = await getToken();

        // 1️⃣ Buscar usuario
        const userRes = await fetch(
            `https://api.twitch.tv/helix/users?login=${login}`,
            {
                headers: {
                    "Client-ID": CLIENT_ID,
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const userData = await userRes.json();

        if (!userData.data || userData.data.length === 0) {
            return res.json({ url: null, error: "User not found" });
        }

        const id = userData.data[0].id;

        // 2️⃣ Obtener canal
        const channelRes = await fetch(
            `https://api.twitch.tv/helix/channels?broadcaster_id=${id}`,
            {
                headers: {
                    "Client-ID": CLIENT_ID,
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const channelData = await channelRes.json();

        console.log("RAW CHANNEL DATA:");
        console.dir(channelData, { depth: null });
        console.log("Extracted broadcaster_name:", channelData.data?.[0]?.broadcaster_login);
        const channelDataFull = await fetch(
            `https://api.twitch.tv/helix/users?id=${id}`,
            {
                headers: {
                    "Client-ID": CLIENT_ID,
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const channelDataFullJson = await channelDataFull.json();
        console.log("FULL CHANNEL DATA:");
        console.dir(channelDataFullJson, { depth: null });
        const offlineImage = channelDataFullJson.data?.[0]?.offline_image_url;

        res.json({ url: offlineImage });

    } catch (err) {
        console.error("❌ ERROR:", err);
        res.status(500).json({ error: "Internal error" });
    }
});
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));
