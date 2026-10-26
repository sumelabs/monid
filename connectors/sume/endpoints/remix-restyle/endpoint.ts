import { defineEndpoint } from "@shared/core";
import {
    remixEstimate,
    remixEvidence,
    type RemixUsageModel,
} from "../../schema/usage.ts";
import { zRestyleBody } from "./schema/inputs.ts";

export default defineEndpoint<RemixUsageModel, typeof zRestyleBody>({
    meta: {
        displayName: "Sume Remix Restyle",
        summary:
            "Redraw a whole video in one of 20 Sume styles, keeping its motion, camera, length and sound.",
        description: "Give a 4 to 15 second source video and a preset_id " +
            "naming one of 20 Sume styles, from anime cel shading and " +
            "pixel art to felt stop motion, knitted yarn and toy CGI. The " +
            "people and setting are redrawn in that style while every " +
            "movement and camera move of the source stays, and the result " +
            "keeps the source's length and its original sound. The prompt " +
            "is optional and adds to the style. Takes no reference photos. " +
            "Returns a Sume-hosted MP4 at 480p, 720p or 1080p, priced per " +
            "second of source video. To put specific people or objects into " +
            "the video, use Sume Remix Motion Transfer or Sume Remix Object " +
            "Swap.",
        docsUrl: "https://www.sume.com/sume-api/models/sume/sume-remix-restyle",
        categories: ["video-generation"],
    },
    endpoint: "/v1/video/sume-remix-restyle",
    request: { method: "POST", path: "/v1/sume/remix/restyle/v1.0" },
    input: { schema: { body: zRestyleBody } },
    usage: {
        estimate: remixEstimate,
        evidence: remixEvidence,
    },
});
