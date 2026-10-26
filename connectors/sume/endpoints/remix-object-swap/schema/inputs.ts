import { z } from "zod";
import {
    zDuration,
    zImageUrl,
    zPrompt,
    zResolution,
    zVideoUrl,
} from "../../../schema/remix.ts";

export const zObjectSwapBody = z.object({
    video_url: zVideoUrl,
    image_urls: z.array(zImageUrl).min(1).max(8).describe(
        "1 to 8 photos of what to put in: a person, an outfit, a product or " +
            "any object that replaces its counterpart in the source.",
    ),
    prompt: zPrompt.optional(),
    resolution: zResolution.default("720p"),
    duration: zDuration.optional(),
}).strict();
