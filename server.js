import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fetch from "node-fetch";
import fs from "fs";

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();

app.get("/", (req, res) => {
  res.send("Thumbnail API is running");
});

app.get("/thumb", async (req, res) => {
  const videoUrl = req.query.video;

  if (!videoUrl) {
    return res.status(400).send("Missing ?video=");
  }

  try {
    // baixa o vídeo temporário
    const tempFile = "temp_" + Date.now() + ".mp4";
    const tempThumb = "thumb_" + Date.now() + ".jpg";

    const response = await fetch(videoUrl);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(tempFile, Buffer.from(buffer));

    // extrai thumbnail real (0.1s)
    await new Promise((resolve, reject) => {
      ffmpeg(tempFile)
        .on("error", reject)
        .on("end", resolve)
        .screenshots({
          timestamps: ["0.1"],
          filename: tempThumb,
          folder: ".",
          size: "480x?"
        });
    });

    const img = fs.readFileSync(tempThumb);

    res.setHeader("Content-Type", "image/jpeg");
    res.send(img);

    // limpa
    fs.unlinkSync(tempFile);
    fs.unlinkSync(tempThumb);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro gerando thumbnail");
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
