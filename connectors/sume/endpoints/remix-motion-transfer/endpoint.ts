import { defineEndpoint } from "@shared/core";
import {
    remixEstimate,
    remixEvidence,
    type RemixUsageModel,
} from "../../schema/usage.ts";
import { zMotionTransferBody } from "./schema/inputs.ts";

export default defineEndpoint<RemixUsageModel, typeof zMotionTransferBody>({
    meta: {
        displayName: "Sume Remix Motion Transfer",
        summary:
            "Recast a video with the people from your photos, keeping its motion, camera, length and sound.",
        description: "Give a 4 to 15 second source video and 1 to 8 photos. " +
            "The people and look from the photos take over the source's " +
            "movement, framing and camera moves, shot for shot, and the " +
            "result keeps the source's length and its original sound. Sume " +
            "plans the edit from the media, so the prompt is optional. " +
            "Returns a Sume-hosted MP4 at 480p, 720p or 1080p, priced per " +
            "second of source video. To replace one person or object and " +
            "leave the rest of the shot unchanged, use Sume Remix Object " +
            "Swap; to change the whole look to a style, use Sume Remix " +
            "Restyle.",
        categories: ["video-generation"],
    },
    endpoint: "/v1/video/sume-remix-motion-transfer",
    request: { method: "POST", path: "/v1/sume/remix/motion-transfer/v1.0" },
    input: { schema: { body: zMotionTransferBody } },
    usage: {
        estimate: remixEstimate,
        evidence: remixEvidence,
    },
});
