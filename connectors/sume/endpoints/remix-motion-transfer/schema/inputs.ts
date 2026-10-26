import { z } from "zod";
import {
    zDuration,
    zImageUrl,
    zPrompt,
    zResolution,
    zVideoUrl,
} from "../../../schema/remix.ts";

export const zMotionTransferBody = z.object({
    video_url: zVideoUrl,
    image_urls: z.array(zImageUrl).min(1).max(8).describe(
        "1 to 8 photos of the people, and the look, to put into the source " +
            "video's movement and camera.",
    ),
    prompt: zPrompt.optional(),
    resolution: zResolution.default("720p"),
    duration: zDuration.optional(),
}).strict();
