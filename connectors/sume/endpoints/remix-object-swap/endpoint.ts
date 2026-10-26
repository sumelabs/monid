import { defineEndpoint } from "@shared/core";
import {
    remixEstimate,
    remixEvidence,
    type RemixUsageModel,
} from "../../schema/usage.ts";
import { zObjectSwapBody } from "./schema/inputs.ts";

export default defineEndpoint<RemixUsageModel, typeof zObjectSwapBody>({
    meta: {
        displayName: "Sume Remix Object Swap",
        summary:
            "Replace a person or object in a video with one from your photos and leave the rest of the shot as it was.",
        description: "Give a 4 to 15 second source video and 1 to 8 photos " +
            "of what to put in. The matching person, product or object is " +
            "replaced in every shot, while the setting, the other people, " +
            "the motion and the camera stay as in the source. The result " +
            "keeps the source's length and its original sound. Say in the " +
            "optional prompt which subject to replace when the source has " +
            "several. Returns a Sume-hosted MP4 at 480p, 720p or 1080p, " +
            "priced per second of source video. To recast everyone in the " +
            "source, use Sume Remix Motion Transfer; to change the whole " +
            "look, use Sume Remix Restyle.",
        docsUrl:
            "https://www.sume.com/sume-api/models/sume/sume-remix-object-swap",
        categories: ["video-generation"],
    },
    endpoint: "/v1/video/sume-remix-object-swap",
    request: { method: "POST", path: "/v1/sume/remix/object-swap/v1.0" },
    input: { schema: { body: zObjectSwapBody } },
    usage: {
        estimate: remixEstimate,
        evidence: remixEvidence,
    },
});
