import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import cors from "cors";
import { exec } from "child_process";

const app = express();
app.use(cors());

const TEMP_DIR = "/tmp/videx";
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.get("/", (req, res) => {
    res.send("Videx Thumbnail API OK");
});

/*
====================================================
   GERADOR DE THUMBNAIL COMPATÍVEL COM RENDER
====================================================
*/

app.get("/thumb", async (req, res) => {
    const videoUrl = req.query.video;

    if (!videoUrl) {
        return res.status(400).send("Missing video url.");
    }

    console.log("📥 Recebendo thumbnail de:", videoUrl);

    try {
        // nome temporário
        const tempVideo = path.join(TEMP_DIR, "input_" + Date.now() + ".mp4");
        const tempThumb = path.join(TEMP_DIR, "thumb_" + Date.now() + ".jpg");

        // ============================
        // 1) BAIXAR VÍDEO COM HEADERS
        // ============================
        console.log("⬇ Baixando vídeo...");

        const response = await fetch(videoUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://videx.space"
            }
        });

        if (!response.ok) {
            console.log("❌ Erro HTTP:", response.status);
            return res.status(500).send("Erro gerando thumbnail (download).");
        }

        const arrayBuf = await response.arrayBuffer();
        fs.writeFileSync(tempVideo, Buffer.from(arrayBuf));

        if (!fs.existsSync(tempVideo) || fs.statSync(tempVideo).size < 5000) {
            console.log("❌ Arquivo baixado muito pequeno, bloqueado pelo host.");
            return res.status(500).send("Erro gerando thumbnail (arquivo vazio).");
        }

        // ============================
        // 2) RODAR FFMPEG NO RENDER
        // ============================
        console.log("🎞 Executando FFmpeg...");

        const cmd = `ffmpeg -y -i "${tempVideo}" -ss 00:00:01 -vframes 1 -vf "scale=400:-1" "${tempThumb}"`;

        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.log("❌ FFmpeg error:", stderr);
                return res.status(500).send("Erro gerando thumbnail (ffmpeg).");
            }

            if (!fs.existsSync(tempThumb)) {
                console.log("❌ FFmpeg não gerou thumb.");
                return res.status(500).send("Erro gerando thumbnail.");
            }

            // ============================
            // 3) ENVIAR THUMB
            // ============================
            console.log("✅ Thumbnail gerado com sucesso!");

            res.setHeader("Content-Type", "image/jpeg");
            fs.createReadStream(tempThumb).pipe(res);

            // limpar após enviar
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempVideo);
                    fs.unlinkSync(tempThumb);
                } catch {}
            }, 5000);
        });

    } catch (err) {
        console.log("❌ Erro geral:", err);
        return res.status(500).send("Erro gerando thumbnail.");
    }
});

/*
============================================
   SERVIDOR RODANDO NO PORT PADRÃO DO RENDER
============================================
*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("🚀 Videx Thumbnail API rodando na porta " + PORT);
});
