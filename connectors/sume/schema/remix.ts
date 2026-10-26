import { z } from "zod";

export const zVideoUrl = z.string().regex(/^https:\/\/\S+$/).describe(
    "Public https:// URL of the source video, MP4 or MOV, 4 to 15 seconds " +
        "long and at most 200 MiB. A longer source is refused, not trimmed.",
);

export const zImageUrl = z.string().regex(/^https:\/\/\S+$/).describe(
    "Public https:// URL of a reference photo, at most 64 MiB.",
);

export const zPrompt = z.string().max(10_000).describe(
    "Optional note in any language about what the edit should do. Refer to " +
        "the photos as Image 1, Image 2 and so on.",
);

export const zResolution = z.enum(["480p", "720p", "1080p"]).describe(
    "Output resolution; the aspect ratio follows the source. Sets the price " +
        "per second of source video.",
);

export const zDuration = z.number().int().min(4).max(15).describe(
    "Source length in whole seconds. Leave it out and Sume reads it from the " +
        "file; when sent, the price follows it.",
);
