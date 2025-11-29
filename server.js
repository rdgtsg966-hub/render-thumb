import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import cors from "cors";
import { exec } from "child_process";

const app = express();
app.use(cors());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

const TEMP_DIR = "/tmp/videx";
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.get("/", (req, res) => {
  res.send("Videx Thumbnail API OK");
});

app.get("/thumb", async (req, res) => {
  try {
    const videoUrl = req.query.video;
    if (!videoUrl) return res.status(400).send("Missing video URL");

    const tempVideo = path.join(TEMP_DIR, "v_" + Date.now() + ".mp4");
    const tempThumb = path.join(TEMP_DIR, "t_" + Date.now() + ".jpg");

    // 🔥 Baixar vídeo com headers completos
    const resp = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Referer": "https://videx.space"
      }
    });

    const buff = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(tempVideo, buff);

    // 🔥 Arquivo baixado vazio = retorna imagem fallback
    if (buff.length < 2000) {
      return res.sendFile(path.join(process.cwd(), "fallback.jpg"));
    }

    // 🔥 Gerar thumb
    const ff = `ffmpeg -y -i "${tempVideo}" -ss 00:00:01 -vframes 1 -vf "scale=400:-1" "${tempThumb}"`;

    exec(ff, (err) => {
      if (err || !fs.existsSync(tempThumb)) {
        return res.sendFile(path.join(process.cwd(), "fallback.jpg"));
      }

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      fs.createReadStream(tempThumb).pipe(res);

      setTimeout(() => {
        try { fs.unlinkSync(tempVideo); fs.unlinkSync(tempThumb); } catch {}
      }, 3000);
    });

  } catch (e) {
    return res.sendFile(path.join(process.cwd(), "fallback.jpg"));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Thumb server ON PORT " + PORT));
