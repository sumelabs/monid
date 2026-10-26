import { z } from "zod";
import { zDuration, zResolution, zVideoUrl } from "../../../schema/remix.ts";

export const zRestylePreset = z.enum([
    "cel-shaded-cg-anime",
    "chunky-textured-low-poly",
    "comic-3d",
    "expressive-2d-animation",
    "expressive-gouache-fashion",
    "felt-puppet-stop-motion",
    "graphic-cel",
    "grotesque-street-cgi",
    "hand-painted-cel-animation",
    "knitted-yarn-world",
    "neon-graphic-cinematic-3d",
    "nighttime-anime-pixel-art",
    "outline-free-cel",
    "painterly-cinematic-3d",
    "painterly-sculpted-animation",
    "retro-game-3d",
    "rounded-toy-cgi",
    "sculptural-3d-fashion",
    "textured-gouache-character-illustration",
    "warm-painterly-3d-animation",
]).describe(
    "The Sume style to redraw the video in, one of 20 ids. Previews: " +
        "GET https://api.sume.com/v1/sume/remix/restyle/v1.0/presets.",
);

export const zRestylePrompt = z.string().max(10_000).describe(
    "Optional note in any language that adds to the style, such as a time " +
        "of day or a mood.",
);

export const zRestyleBody = z.object({
    video_url: zVideoUrl,
    preset_id: zRestylePreset,
    prompt: zRestylePrompt.optional(),
    resolution: zResolution.default("720p"),
    duration: zDuration.optional(),
}).strict();
